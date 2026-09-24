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
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../app/main.js';
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
**/
export class History {
	constructor() {
		this.queue = [];
		this.redoQueue = [];
		this.initialTimeStamp = 0;
		this.initialProject = {};
		this.projectID = false;
		this.storageReady = Promise.resolve();
		this.storageDirty = false;
		this.storageWrite = Promise.resolve();
		// True while restoreState / redoState run, so on-demand item creation
		// (ProjectEditor.selectedGlyph) does not push entries mid-restore
		this.isRestoring = false;
		// True only when the project came back from an auto-save of the same live state
		this.adoptStored = false;
	}

	/**
	 * Starts a fresh queue for a project. Upstream persists the queue to IndexedDB by
	 * project id and adopts it on every load; ANY-INK adopts it only when the caller
	 * says the project came back from an auto-save / crash recovery of the same live
	 * state (see adoptStoredHistory). A file or sample loaded fresh gets an empty queue
	 * and the stale stored one is overwritten, so undo can never apply another
	 * session's snapshots to a project that never had them.
	 * @param {Object} project - GlyphrStudioProject
	 */
	initialize(project) {
		this.projectID = project.settings.project.id;
		this.initialProject = new GlyphrStudioProject(project.save());
		this.storageDirty = false;
		this.adoptStored = false;
		this.storageReady = this.loadStoredSnapshot()
			.then((snapshot) => {
				if (this.storageDirty) return;
				if (!this.adoptStored) {
					if (snapshot) this.persist();
					return;
				}
				if (!snapshot || snapshot.version !== HISTORY_FORMAT_VERSION) return;
				const initialProject = new GlyphrStudioProject(snapshot.initialProject);
				const queue = (snapshot.queue || []).map(deserializeHistoryEntry);
				const redoQueue = (snapshot.redoQueue || []).map((entries) =>
					entries.map(deserializeHistoryEntry)
				);
				this.initialTimeStamp = snapshot.initialTimeStamp;
				this.initialProject = initialProject;
				this.queue = queue;
				this.redoQueue = redoQueue;
				if (getCurrentProjectEditor()?.history === this) refreshPanel();
			})
			.catch(() => undefined);
	}

	/**
	 * Call right after `editor.project = restoredProject` when that project is the
	 * auto-saved / recovered copy of the last live state, so the stored queue still
	 * describes it. Must run before the storage read resolves (synchronously after
	 * the assignment is fine).
	 */
	adoptStoredHistory() {
		this.adoptStored = true;
	}

	/** Reads this project's stored snapshot; split out so tests can stub storage. */
	loadStoredSnapshot() {
		return loadHistory(this.projectID);
	}

	persist() {
		if (!this.projectID) return;
		this.storageDirty = true;
		const snapshot = {
			projectID: this.projectID,
			version: HISTORY_FORMAT_VERSION,
			initialTimeStamp: this.initialTimeStamp,
			initialProject: this.initialProject.save(),
			queue: this.queue.map(serializeHistoryEntry),
			redoQueue: this.redoQueue.map((entries) => entries.map(serializeHistoryEntry)),
		};
		this.storageWrite = this.storageWrite.then(() => saveHistory(snapshot)).catch(() => undefined);
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
		this.persist();
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
		this.persist();
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
		this.persist();
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
		this.persist();
	}

	discardLatestState() {
		this.queue.shift();
		this.persist();
	}

	/**
	 * Update common project, editor, and UI stuff after a new state is added
	 */
	updateAfterSaveState() {
		const editor = getCurrentProjectEditor();
		editor.setProjectAsUnsaved();
		if (editor.nav.panel === 'History') {
			refreshPanel();
		}

		const undoButton = document.querySelector('#actionButtonUndo');
		if (undoButton) undoButton.removeAttribute('disabled');

		const redoButton = document.querySelector('#actionButtonRedo');
		if (redoButton) redoButton.setAttribute('disabled', 'disabled');

		if (editor.project.settings.app.autoSave) {
			const app = getGlyphrStudioApp();
			if (app.settings.dev.mode) {
				if (app.settings.dev.autoSave) app.addAutoSaveState();
			} else {
				app.addAutoSaveState();
			}
		}
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
			editor.setProjectAsSaved();
			const undoButton = document.querySelector('#actionButtonUndo');
			if (undoButton) undoButton.setAttribute('disabled', 'disabled');
			showToast(`No more undo`);
			// log(`Queue is 0, returning`);
			// log(`History.restoreState`, 'end');
			return;
		}

		this.isRestoring = true;
		try {
			// --------------------------------------------------------------
			// Settings entries (metrics, guides) belong to no item
			// --------------------------------------------------------------

			if (q[0].settingsSave) {
				const snapshot = findPreviousSettingsSnapshot(q, 1, this.initialProject);
				applySettingsToEditor(editor, snapshot);
				const redoEntries = [q.shift()];
				this.redoQueue.unshift(redoEntries);
				this.persist();
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
				q.shift();
				nextIndex -= 1;
				this.persist();
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
			this.persist();

			// Finalize UI stuff
			this.finishUndoUI(editor);
		} finally {
			this.isRestoring = false;
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
			editor.setProjectAsSaved();
			const undoButton = document.querySelector('#actionButtonUndo');
			if (undoButton) undoButton.setAttribute('disabled', 'disabled');
		}

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
			this.persist();
		} finally {
			this.isRestoring = false;
		}

		editor.setProjectAsUnsaved();
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
// History storage
// --------------------------------------------------------------

const DATABASE_NAME = 'GlyphrStudio';
const DATABASE_VERSION = 1;
const STORE_NAME = 'history';
// Bumped from 2 to 3 for the settings entry kind; older stored queues are ignored.
export const HISTORY_FORMAT_VERSION = 3;

function openDatabase() {
	return new Promise((resolve, reject) => {
		if (!globalThis.indexedDB) {
			reject(new Error('IndexedDB is not available'));
			return;
		}

		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE_NAME)) {
				request.result.createObjectStore(STORE_NAME, { keyPath: 'projectID' });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function runTransaction(mode, callback) {
	return openDatabase().then(
		(db) =>
			new Promise((resolve, reject) => {
				const transaction = db.transaction(STORE_NAME, mode);
				const request = callback(transaction.objectStore(STORE_NAME));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
				transaction.onabort = () => reject(transaction.error);
				transaction.oncomplete = () => db.close();
			})
	);
}

export function loadHistory(projectID) {
	return runTransaction('readonly', (store) => store.get(projectID));
}

export function saveHistory(snapshot) {
	return runTransaction('readwrite', (store) => store.put(snapshot));
}
