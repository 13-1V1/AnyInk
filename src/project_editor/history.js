// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	collectionNameFromID,
	indexOfNextItemEntry,
	indexOfSettingsEntryBetween,
	isNavigationBetween,
	objTypeFromID,
} from '../anyink/history/history_helpers.js';
import {
	applySettingsSnapshot,
	findPreviousSettingsSnapshot,
	makeSettingsSnapshot,
	systemGuidesFromList,
} from '../anyink/history/settings_snapshot.js';
import { notifyKernPairsChanged } from '../anyink/kerning/kern_lookup.js';
import { markDirty } from '../anyink/recovery/recovery.js';
import { getCurrentProjectEditor } from '../app/main.js';
import { clone } from '../common/functions.js';
import { showToast } from '../controls/dialogs/dialogs.js';
import { refreshPanel } from '../panels/panels.js';
import { Glyph } from '../project_data/glyph.js';
import { GlyphrStudioProject } from '../project_data/glyphr_studio_project.js';
import { KernGroup } from '../project_data/kern_group.js';

/**
	History
	An object that stores a Glyphr Studio Project
	state, to enable undo.  History changes are saved per
	item (Glyph, Component, Ligature, Kern)

	ANY-INK (D-018): three kinds of entry share the queue.
	  - item entry: itemState is a Glyph or KernGroup (upstream)
	  - whole-project entry: itemState is a GlyphrStudioProject (upstream)
	  - settings entry: settingsSave is true and settingsState holds a copy
	    of settings.font and settings.app.guides (metric / guide drags)
	queue[0] always mirrors the live state; undo applies the nearest older
	entry of the same kind and moves queue[0] to the redo queue.

	ANY-INK (M6, D-026): the queue lives in memory only. Crash recovery stores
	serializeForStorage() inside each snapshot record, next to the project it
	describes, and a restore hands it back through adoptSnapshot(), so the two can
	never diverge. (Upstream's own IndexedDB copy, one per project id, was shared by
	every copy of a font and read by nothing once recovery took over; it is gone.)
	Every new entry, undo and redo calls recovery's markDirty(this).

	Saved marker: the undo state the project's .gs2 on disk holds. It starts as null
	(no file: a new project, a sample, an imported font or SVG, a recovered session);
	ProjectEditor's project setter sets SAVED_AT_EMPTY when the project was opened
	from its .gs2, and setProjectAsSaved() records the entry on top of the queue. A
	save that an edit overtook records the entry it actually wrote
	(markSavedStateAt). After an undo or redo the title dot is cleared only when that
	entry is on top again (isAtSavedState).
**/
export class History {
	constructor() {
		this.queue = [];
		this.redoQueue = [];
		this.initialTimeStamp = 0;
		this.initialProject = {};
		this.projectID = false;
		// True while restoreState / redoState run, so on-demand item creation
		// (ProjectEditor.selectedGlyph) does not push entries mid-restore
		this.isRestoring = false;
		// The undo state the file on disk holds: a queue entry, SAVED_AT_EMPTY, or null
		// (no file holds this project: new, sample, imported, recovered)
		this.savedMarker = null;
	}

	/**
	 * Starts a fresh queue for a project. Nothing is known to match a file yet: the
	 * caller marks the empty queue as saved when the project came from its .gs2
	 * (ProjectEditor's project setter), and a save marks what it wrote.
	 * @param {Object} project - GlyphrStudioProject
	 */
	initialize(project) {
		this.projectID = project.settings.project.id;
		this.initialProject = new GlyphrStudioProject(project.save());
		this.savedMarker = null;
	}

	/**
	 * Plain, structured-cloneable copy of the undo state for a crash-recovery snapshot.
	 * @returns {Object} { projectID, version, initialTimeStamp, initialProject, queue, redoQueue }
	 */
	serializeForStorage() {
		const hasInitial = typeof this.initialProject?.save === 'function';
		return {
			projectID: this.projectID,
			version: HISTORY_FORMAT_VERSION,
			initialTimeStamp: this.initialTimeStamp,
			initialProject: hasInitial ? this.initialProject.save() : null,
			queue: this.queue.map(serializeHistoryEntry),
			redoQueue: this.redoQueue.map((entries) => entries.map(serializeHistoryEntry)),
		};
	}

	/**
	 * Adopts an undo state written by serializeForStorage(), for a project restored
	 * from the same snapshot record. Call it right after `editor.project = restored`.
	 * A restored project matches no file on disk, so the saved marker is cleared
	 * either way: undo never clears the title dot on it.
	 * @param {Object} snapshot
	 * @returns {Boolean} true when the queue was adopted (false: missing, another
	 *   format, or unreadable; the queue stays empty)
	 */
	adoptSnapshot(snapshot) {
		this.savedMarker = null;
		if (!snapshot || snapshot.version !== HISTORY_FORMAT_VERSION) return false;
		let initialProject;
		let queue;
		let redoQueue;
		try {
			initialProject = snapshot.initialProject
				? new GlyphrStudioProject(snapshot.initialProject)
				: this.initialProject;
			queue = (snapshot.queue || []).map(deserializeHistoryEntry);
			redoQueue = (snapshot.redoQueue || []).map((entries) => entries.map(deserializeHistoryEntry));
		} catch (error) {
			console.warn('ANY-INK history: could not adopt the recovered undo queue', error);
			return false;
		}
		this.initialTimeStamp = snapshot.initialTimeStamp ?? this.initialTimeStamp;
		this.initialProject = initialProject;
		this.queue = queue;
		this.redoQueue = redoQueue;

		const editor = getCurrentProjectEditor();
		if (editor?.history === this) {
			if (editor.nav?.panel === 'History') refreshPanel();
			const undoButton = document.querySelector('#actionButtonUndo');
			if (undoButton && queue.length) undoButton.removeAttribute('disabled');
			const redoButton = document.querySelector('#actionButtonRedo');
			if (redoButton && redoQueue.length) redoButton.removeAttribute('disabled');
		}
		return true;
	}

	/** The undo state on top of the queue is what the file on disk now holds. */
	markSavedState() {
		this.markSavedStateAt(this.queue[0] || SAVED_AT_EMPTY);
	}

	/**
	 * A save wrote this undo state, but newer edits landed while it was writing: the
	 * file holds `entry`, not the top of the queue. Undo / redo back to `entry` clears
	 * the dot. The entry keeps its identity when it moves to the redo queue and back.
	 * @param {Object | String} entry - a queue entry, or SAVED_AT_EMPTY
	 */
	markSavedStateAt(entry) {
		this.savedMarker = entry || SAVED_AT_EMPTY;
	}

	/** @returns {Boolean} true when the live state is the one the file on disk holds */
	isAtSavedState() {
		return this.savedMarker !== null && (this.queue[0] || SAVED_AT_EMPTY) === this.savedMarker;
	}

	/**
	 * Calculates the number of unique changes in the undo queue
	 * (Whole project changes have two entries in the queue)
	 */
	get length() {
		let items = this.queue.filter((item) => item.title !== '_whole_project_change_post_state_');
		return items.length;
	}

	/**
	 * Capture the current state of an Item (and related Items) and put
	 * it into the History queue.
	 * 	- For normal changes, call addState after change is made
	 * 	- For deleting items, call addState before deletion, and mark as itemWasDeleted
	 * @param {String} title - What to call this change in the History panel
	 * @param {Object} itemWasDeleted - flag so the item can be added back to the project
	 */
	addState(title = '', itemWasDeleted = false) {
		// log(`History.addState`, 'start');
		const entry = makeHistoryEntry({ title: title, itemWasDeleted: itemWasDeleted });
		this.queue.unshift(entry);
		this.redoQueue = [];
		this.updateAfterSaveState();
		// log(this);
		// log(`History.addState`, 'end');
	}

	/**
	 * ANY-INK: Capture the font metrics and guide settings after a change
	 * (metric line drag, guide drag, guide visibility) as a lightweight
	 * 'settings' entry. Call it AFTER the change, like addState.
	 * @param {String} title - What to call this change in the History panel
	 */
	addSettingsState(title = '') {
		const editor = getCurrentProjectEditor();
		const entry = makeSettingsHistoryEntry(title, editor, this.queue[0]);
		this.queue.unshift(entry);
		this.redoQueue = [];
		this.updateAfterSaveState();
	}

	/**
	 * #### Call this method *before* a whole-project change
	 * Capture the current state of the entire Project and put it into the History queue.
	 * This is used for cross-item actions, where multiple dependent items are updated at
	 * once, or for bulk actions, where many items are modified at the same time.
	 * @param {String} title - What to call this change in the History panel
	 */
	addWholeProjectChangePreState(title = '') {
		title = title || `Update to many items across the project.`;
		const entry = makeHistoryEntry({ title: title, wholeProjectSave: true });
		if (this.queue.length) {
			entry.itemID = this.queue[0].itemID;
			entry.page = this.queue[0].page;
		} else {
			const editor = getCurrentProjectEditor();
			entry.itemID = editor.selectedItemID;
			entry.page = editor.nav.page;
		}
		this.queue.unshift(entry);
		this.redoQueue = [];
		this.updateAfterSaveState();
	}

	/**
	 * #### Call this method *after* a whole-project change
	 */
	addWholeProjectChangePostState() {
		const entry = makeHistoryEntry({
			title: '_whole_project_change_post_state_',
			wholeProjectSave: true,
		});
		if (this.queue.length) {
			entry.itemID = this.queue[0].itemID;
			entry.page = this.queue[0].page;
		} else {
			const editor = getCurrentProjectEditor();
			entry.itemID = editor.selectedItemID;
			entry.page = editor.nav.page;
		}
		this.queue.unshift(entry);
	}

	discardLatestState() {
		this.queue.shift();
		// The failed action changed nothing: back on the saved entry means clean again
		syncSavedIndicator(getCurrentProjectEditor(), this);
	}

	/**
	 * Update common project, editor, and UI stuff after a new state is added
	 */
	updateAfterSaveState() {
		// ANY-INK (D-018): one choke point tells crash recovery the project changed.
		markDirty(this);
		const editor = getCurrentProjectEditor();
		editor.setProjectAsUnsaved();
		if (editor.nav.panel === 'History') {
			refreshPanel();
		}

		const undoButton = document.querySelector('#actionButtonUndo');
		if (undoButton) undoButton.removeAttribute('disabled');

		const redoButton = document.querySelector('#actionButtonRedo');
		if (redoButton) redoButton.setAttribute('disabled', 'disabled');

		// ANY-INK: upstream's localStorage auto-save lived here; crash recovery
		// (src/anyink/recovery) replaces it, driven by markDirty() above.
	}

	/**
	 * Get the latest change, and restore it to the currently selected item.
	 * The current state is at queue index 0, so to undo we need to take two
	 * steps back and restore queue index 1.
	 */
	restoreState() {
		// log(`History.restoreState`, 'start');
		const editor = getCurrentProjectEditor();
		let q = this.queue;

		// --------------------------------------------------------------
		// Check for empty queue
		// --------------------------------------------------------------

		if (q.length === 0) {
			// ANY-INK: an empty queue says nothing about the file on disk; the dot stays
			const undoButton = document.querySelector('#actionButtonUndo');
			if (undoButton) undoButton.setAttribute('disabled', 'disabled');
			showToast(`No more undo`);
			// log(`Queue is 0, returning`);
			// log(`History.restoreState`, 'end');
			return;
		}

		this.isRestoring = true;
		let changed = false;
		try {
			// --------------------------------------------------------------
			// Settings entries (metrics, guides) belong to no item
			// --------------------------------------------------------------

			if (q[0].settingsSave) {
				const snapshot = findPreviousSettingsSnapshot(q, 1, this.initialProject);
				applySettingsToEditor(editor, snapshot);
				const redoEntries = [q.shift()];
				this.redoQueue.unshift(redoEntries);
				changed = true;
				this.finishUndoUI(editor);
				return;
			}

			// --------------------------------------------------------------
			// Find the entry holding the previous state of the item, and
			// check if it is for a different item than the current one
			// --------------------------------------------------------------

			let topIndex = 0;
			let nextIndex = indexOfNextItemEntry(q, 1);
			let nextEntry = nextIndex > -1 ? q[nextIndex] : false;

			if (isNavigationBetween(q[0], nextEntry)) {
				// Assumes navigate adds an entry to the queue
				if (nextEntry.page) editor.nav.page = nextEntry.page;
				if (nextEntry.itemID) {
					ensureItemExists(editor, nextEntry);
					editor.selectedItemID = nextEntry.itemID;
				}
				const dropped = q.shift();
				// Navigation changes nothing in the project: the saved state moves with it
				if (this.savedMarker === dropped) this.savedMarker = q[0] || SAVED_AT_EMPTY;
				nextIndex -= 1;
				editor.navigate();

				if (nextEntry.itemWasDeleted) {
					showToast(`Restored deleted item<br>${nextEntry.itemState.name}`);
					// Continue: undo the deletion entry itself
					topIndex = nextIndex;
					nextIndex = indexOfNextItemEntry(q, topIndex + 1);
					nextEntry = nextIndex > -1 ? q[nextIndex] : false;
				} else {
					showToast('Navigated without undo-ing');
					if (editor.nav.panel === 'History') refreshPanel();
					// log(`Need to navigate to next changed item`);
					// log(`History.restoreState`, 'end');
					return;
				}
			}

			const undoneEntry = q[topIndex];

			// --------------------------------------------------------------
			// Nothing older in the queue: fall back to the initial project
			// --------------------------------------------------------------

			if (!nextEntry) {
				nextEntry = makeInitialFallbackEntry(editor, this.initialProject, undoneEntry);
				// log(`No older item entry, setting 'nextEntry' to base project`);
				// log(nextEntry);
			}

			// --------------------------------------------------------------
			// proceed with the undo
			// --------------------------------------------------------------

			// log(`Undoing to: ${nextEntry.title}`);

			// Clear selections
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();

			// Capture entries being removed from the queue for redo
			const redoEntries = [undoneEntry];

			if (nextEntry.wholeProjectSave) {
				// log(`Overwriting whole project`);
				// Settings changed after that project snapshot stay as they are
				const settingsIndex =
					nextIndex > -1 ? indexOfSettingsEntryBetween(q, topIndex, nextIndex) : -1;
				const settingsOverride = settingsIndex > -1 ? q[settingsIndex].settingsState : false;
				swapProject(editor, nextEntry.itemState, settingsOverride);
				if (undoneEntry.wholeProjectSave && nextIndex > -1) {
					// Pre and post states of one change leave the queue together
					redoEntries.push(nextEntry);
					q.splice(nextIndex, 1);
				}
				q.splice(topIndex, 1);
				reconcileSelectionAfterProjectSwap(editor);
			} else {
				// log(`overwriting ${nextEntry.itemID}`);
				applyItemState(editor, nextEntry);
				q.splice(topIndex, 1);
			}
			publishCurrentItem(editor);

			// Save undone state for redo
			this.redoQueue.unshift(redoEntries);
			changed = true;

			// Finalize UI stuff
			this.finishUndoUI(editor);
		} finally {
			this.isRestoring = false;
			// ANY-INK: an undo changes the project; crash recovery snapshots it with its queue
			if (changed) markDirty(this);
		}
		// log(q);
		// log(`History.restoreState`, 'end');
	}

	/**
	 * Shared UI updates at the end of an undo
	 * @param {Object} editor - current ProjectEditor
	 */
	finishUndoUI(editor) {
		if (editor.nav.panel === 'History') refreshPanel();
		if (this.queue.length === 0) {
			const undoButton = document.querySelector('#actionButtonUndo');
			if (undoButton) undoButton.setAttribute('disabled', 'disabled');
		}
		// ANY-INK: the dot clears only on the undo state the file on disk holds
		syncSavedIndicator(editor, this);

		const redoButton = document.querySelector('#actionButtonRedo');
		if (redoButton) redoButton.removeAttribute('disabled');
	}

	/**
	 * Step back N undos at once, used when the user clicks a specific
	 * entry in the History panel to revert to that point in time.
	 * Passing a number larger than queue length jumps to the initial state.
	 * @param {Number} steps - How many undo steps to apply
	 */
	jumpToState(steps) {
		for (let i = 0; i < steps; i++) {
			if (this.queue.length === 0) break;
			this.restoreState();
		}
	}

	/**
	 * Re-apply the most recently undone change. Reverses restoreState.
	 */
	redoState() {
		const editor = getCurrentProjectEditor();

		if (this.redoQueue.length === 0) {
			const redoButton = document.querySelector('#actionButtonRedo');
			if (redoButton) redoButton.setAttribute('disabled', 'disabled');
			showToast(`No more redo`);
			return;
		}

		const entries = this.redoQueue.shift();
		const targetEntry = entries[0];

		this.isRestoring = true;
		try {
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();

			if (targetEntry.settingsSave) {
				applySettingsToEditor(editor, targetEntry.settingsState);
			} else if (targetEntry.wholeProjectSave) {
				swapProject(editor, targetEntry.itemState);
				reconcileSelectionAfterProjectSwap(editor);
			} else {
				applyItemState(editor, targetEntry);
			}
			publishCurrentItem(editor);

			// Restore the queue entries so subsequent undos behave correctly
			for (let i = entries.length - 1; i >= 0; i--) {
				this.queue.unshift(entries[i]);
			}
		} finally {
			this.isRestoring = false;
		}

		// ANY-INK: a redo changes the project; the dot follows the saved marker
		markDirty(this);
		syncSavedIndicator(editor, this);
		if (editor.nav.panel === 'History') refreshPanel();

		const undoButton = document.querySelector('#actionButtonUndo');
		if (undoButton) undoButton.removeAttribute('disabled');

		if (this.redoQueue.length === 0) {
			const redoButton = document.querySelector('#actionButtonRedo');
			if (redoButton) redoButton.setAttribute('disabled', 'disabled');
		}
	}
}

// --------------------------------------------------------------
// Saved marker
// --------------------------------------------------------------

/** Saved marker for "the file on disk holds the state with nothing in the queue". */
export const SAVED_AT_EMPTY = 'empty';

/**
 * Shows or clears the title dot from History's saved marker.
 * @param {Object} editor - ProjectEditor
 * @param {History} history
 */
function syncSavedIndicator(editor, history) {
	if (!editor) return;
	if (typeof editor.updateSavedIndicator === 'function') editor.updateSavedIndicator(history);
	else if (!history.isAtSavedState()) editor.setProjectAsUnsaved?.();
}

// --------------------------------------------------------------
// Making entries
// --------------------------------------------------------------

function makeHistoryEntry({ title = '', itemWasDeleted = false, wholeProjectSave = false }) {
	const editor = getCurrentProjectEditor();
	let page;
	let item;

	if (wholeProjectSave) {
		// Whole project save point
		item = new GlyphrStudioProject(editor.project.save());
		title = title || `Changes across many items.`;
		page = false;
	} else {
		// Single item save point
		item = editor.selectedItem;
		if (editor.nav.page === 'Kerning') item = new KernGroup(item.save());
		else item = new Glyph(item.save());
		title = title || `Change to ${item.name}`;
		page = editor.nav.page;
	}

	let newEntry = {
		timeStamp: new Date().getTime(),
		itemID: editor.selectedItemID,
		itemState: item,
		title: title,
		page: page,
		itemWasDeleted: itemWasDeleted,
		wholeProjectSave: wholeProjectSave,
		settingsSave: false,
		settingsState: false,
	};

	return newEntry;
}

/**
 * ANY-INK: settings entry. It carries no item state; itemID and page are
 * inherited from the entry below it so the History panel groups it with the
 * item the user was looking at, and undo never mistakes it for a navigation.
 * @param {String} title
 * @param {Object} editor - current ProjectEditor
 * @param {Object | undefined} topEntry - queue[0] before this entry is added
 */
function makeSettingsHistoryEntry(title, editor, topEntry) {
	return {
		timeStamp: new Date().getTime(),
		itemID: topEntry ? topEntry.itemID : editor.selectedItemID,
		itemState: false,
		title: title || 'Changed font metrics or guides',
		page: topEntry ? topEntry.page : editor.nav.page,
		itemWasDeleted: false,
		wholeProjectSave: false,
		settingsSave: true,
		settingsState: makeSettingsSnapshot(editor.project.settings),
	};
}

/**
 * When nothing older is left in the queue, undo goes back to the project
 * as it was when it was opened.
 * @param {Object} editor
 * @param {GlyphrStudioProject} initialProject
 * @param {Object} undoneEntry - the entry being undone
 * @returns {Object} entry-like object
 */
function makeInitialFallbackEntry(editor, initialProject, undoneEntry) {
	if (undoneEntry.wholeProjectSave) {
		return { itemState: initialProject, wholeProjectSave: true, title: 'Initial state' };
	}

	const itemID = undoneEntry.itemID || editor.selectedItemID;
	const objType = objTypeFromID(itemID);
	const collection = collectionNameFromID(itemID);
	const baseItem = collection ? initialProject?.[collection]?.[itemID] : false;

	let itemState;
	if (baseItem) {
		itemState = baseItem.save();
	} else if (objType === 'KernGroup') {
		// Item did not exist when the project was opened: back to blank
		itemState = new KernGroup({}).save();
	} else {
		itemState = new Glyph({ id: itemID, objType: objType || 'Glyph' }).save();
	}

	return {
		itemState: itemState,
		itemID: itemID,
		page: undoneEntry.page || editor.nav.page,
		title: 'Initial state',
	};
}

// --------------------------------------------------------------
// Applying entries
// --------------------------------------------------------------

/**
 * Replaces the editor's project with a fresh copy of a snapshot (never the
 * snapshot object itself, so later undos cannot corrupt the queue).
 * @param {Object} editor
 * @param {GlyphrStudioProject} snapshotProject
 * @param {Object | false} settingsOverride - newer settings snapshot to keep
 */
function swapProject(editor, snapshotProject, settingsOverride = false) {
	editor._project = new GlyphrStudioProject(snapshotProject.save());
	if (settingsOverride) applySettingsSnapshot(editor._project.settings, settingsOverride);
	syncSettingsToEditor(editor);
	// Kern groups are new objects now; the lookup and the preview strip must follow.
	notifyKernPairsChanged(editor);
}

/**
 * Writes a settings snapshot into the live project and tells everyone.
 * @param {Object} editor
 * @param {Object | false} snapshot
 */
function applySettingsToEditor(editor, snapshot) {
	if (snapshot) applySettingsSnapshot(editor.project.settings, snapshot);
	syncSettingsToEditor(editor);
	editor.publish('editCanvasView', editor.view);
}

/**
 * Re-syncs editor.systemGuides from the project (in place) and publishes the
 * settings topics that metric readouts, guides, and the preview strip follow.
 * @param {Object} editor
 */
function syncSettingsToEditor(editor) {
	const settings = editor.project.settings;
	const guides = settings.app.guides;
	if (Array.isArray(guides?.systemGuides)) {
		if (!editor.systemGuides) editor.systemGuides = {};
		Object.assign(editor.systemGuides, systemGuidesFromList(guides.systemGuides));
	}
	editor.publish('fontMetrics', settings.font);
	editor.publish('guides', guides);
}

/**
 * If an entry's item is missing from the project (it was deleted), add it
 * back so the selection setters can point at it.
 * @param {Object} editor
 * @param {Object} entry - history entry with itemID and itemState
 */
function ensureItemExists(editor, entry) {
	const id = entry.itemID;
	if (!id || !entry.itemState || entry.wholeProjectSave) return;
	if (editor.project.getItem(id)) return;
	const objType = objTypeFromID(id);
	if (!objType) return;
	const state =
		typeof entry.itemState.save === 'function' ? entry.itemState.save() : entry.itemState;
	const item = objType === 'KernGroup' ? new KernGroup(state) : new Glyph(state);
	editor.project.addItemByType(item, objType, id);
}

/**
 * Writes an item entry's state into the project. If the editor is looking
 * somewhere else (undo from the Settings page, or after a deletion), it moves
 * to the item first so the state lands in the right slot.
 * @param {Object} editor
 * @param {Object} entry
 */
function applyItemState(editor, entry) {
	let moved = false;
	if (entry.page && editor.nav.page !== entry.page) {
		editor.nav.page = entry.page;
		moved = true;
	}
	if (entry.itemID && editor.selectedItemID !== entry.itemID) {
		ensureItemExists(editor, entry);
		editor.selectedItemID = entry.itemID;
		moved = true;
	}
	editor.selectedItem = entry.itemState;
	if (moved) editor.navigate();
	if (objTypeFromID(entry.itemID) === 'KernGroup') {
		notifyKernPairsChanged(editor, { groupID: entry.itemID, value: entry.itemState?.value });
	}
}

/**
 * After a whole-project swap the selected item may no longer exist (undo of
 * a creation). Pick the next best item and rebuild the page.
 * @param {Object} editor
 * @returns {Boolean} true when the selection had to change
 */
function reconcileSelectionAfterProjectSwap(editor) {
	const id = editor.selectedItemID;
	if (!id) return false;
	if (editor.project.getItem(id)) return false;
	const fallbackAcrossItemType = editor.selectFallbackItem(editor.nav.page);
	if (fallbackAcrossItemType) editor.nav.page = 'Characters';
	editor.navigate();
	return true;
}

/**
 * Publishes 'currentItem' without forcing an item into existence
 * (editor.selectedItem creates missing glyphs on read).
 * @param {Object} editor
 */
function publishCurrentItem(editor) {
	const item = editor.project.getItem(editor.selectedItemID);
	if (item) editor.publish('currentItem', item);
}

// --------------------------------------------------------------
// Serializing entries
// --------------------------------------------------------------

export function serializeHistoryEntry(entry) {
	const hasItem = entry.itemState && typeof entry.itemState.save === 'function';
	return {
		timeStamp: entry.timeStamp,
		itemID: entry.itemID,
		itemState: hasItem ? entry.itemState.save() : false,
		title: entry.title,
		page: entry.page,
		itemWasDeleted: !!entry.itemWasDeleted,
		wholeProjectSave: !!entry.wholeProjectSave,
		settingsSave: !!entry.settingsSave,
		settingsState: entry.settingsSave && entry.settingsState ? clone(entry.settingsState) : false,
	};
}

export function deserializeHistoryEntry(entry) {
	if (entry.settingsSave) {
		return {
			...entry,
			itemState: false,
			settingsState: entry.settingsState ? clone(entry.settingsState) : false,
		};
	}

	let itemState;
	if (entry.wholeProjectSave) itemState = new GlyphrStudioProject(entry.itemState);
	else if (entry.page === 'Kerning') itemState = new KernGroup(entry.itemState);
	else itemState = new Glyph(entry.itemState);

	return { ...entry, itemState, settingsSave: false, settingsState: false };
}

// --------------------------------------------------------------
// Snapshot format
// --------------------------------------------------------------

// Bumped from 2 to 3 for the settings entry kind; snapshots of another format are ignored.
export const HISTORY_FORMAT_VERSION = 3;
