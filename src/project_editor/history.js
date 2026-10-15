// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	SAVED_AT_EMPTY,
	collectionNameFromID,
	indexOfNextItemEntry,
	indexOfPairedPre,
	indexOfSettingsEntryBetween,
	isAutoNavigationTitle,
	isLookingAroundEntry,
	isNavigationBetween,
	isNavigationTitle,
	objTypeFromID,
	pageFromItemID,
} from '../anyink/history/history_helpers.js';
import {
	applySettingsSnapshot,
	findPreviousSettingsSnapshot,
	makeSettingsSnapshot,
	systemGuidesFromList,
} from '../anyink/history/settings_snapshot.js';
import { writeItemState } from '../anyink/history/item_state.js';
import { previousItemState, redoNewest, undoNewest } from '../anyink/history/simple_undo.js';
import { sayUndone } from '../anyink/history/undo_toast.js';
import {
	MAX_UNDO_POINTS,
	MAX_UNDO_STEPS,
	capUndoQueue,
	countSteps,
} from '../anyink/history/undo_cap.js';
import { notifyKernPairsChanged } from '../anyink/kerning/kern_lookup.js';
import { isSimpleMode } from '../anyink/mode/mode.js';
import { beforeStrokeStep } from '../anyink/nib/history_hook.js';
import { carryPhotos } from '../anyink/photo/photo_registry.js';
import { markDirty } from '../anyink/recovery/recovery.js';
import { upstreamToast } from '../anyink/toast/toast.js';
import {
	beforeItemStep,
	beforeWholeProjectPost,
	settingsBeforeGapChange,
} from '../anyink/spacing/history_hook.js';
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

	ANY-INK (B2, UX-BEGINNER 7.3):
	  - In Simple (mode.js), restoreState / redoState hand over to simple_undo.js: one press
	    undoes the newest change wherever it is, and looking around is never an Undo step.
	  - "Navigated to" steps: none at all in Simple. All tools still records them (upstream's
	    undo reads them), but one never changes the saved state: no title dot, no "pending"
	    work file, no crash-recovery write; on a saved font the saved marker moves onto it.
	  - A whole-project pre / post pair takes the id of the letter that was open (or the one
	    passed in), not the id of whatever step was on top before it.
	  - undo_cap.js keeps the newest 200 steps and at most 30 whole-project steps, in both
	    modes; looking around counts toward neither, and past 30 "Navigated to" entries the
	    ones that only pass the view along leave. Dropped steps are written into undoFloor,
	    which undo falls back to (undoBase); initialProject stays the font as it was loaded
	    (the leave-site check reads it).

	ANY-INK (B3, UX-BEGINNER 7.2): the spacing hook (src/anyink/spacing/history_hook.js) runs
	before a step is captured, so whatever it changes is part of that one step. addState: in
	Simple an automatic letter is refit; in All tools a letter whose left space or width the step
	changed is marked "set by you" (never refit). addWholeProjectChangePostState: Simple ends with
	every automatic letter at its fit; All tools marks every automatic letter the whole-font
	change moved. Looking around never reaches the hook.

	ANY-INK (B3 fixes, 10/14/2026):
	  - Step parts: when Simple refits automatic letters made from the open one (components),
	    addState records an item entry for each of them right under the open letter's, all with
	    one `step` key. One press undoes or redoes the whole step (both modes); the 200-step
	    limit counts it once and drops it whole (capQueue); the History panel's rows count as one
	    press each (jumpToState). Each letter's newest state is an ordinary item entry, so every
	    reader of the list finds it.
	  - A settings step that moves the gaps in Simple (the small-letter line, the grid size)
	    becomes one whole-font step about no letter, refit inside it (addSettingsState).
	  - addWholeProjectChangePreState(title, { itemID: null }) is about no letter: font-wide
	    actions (the letter-spacing slider, gap fixes, guide lines) pass null, so Undo from
	    another letter never jumps to the one that happened to be open.
	  - All tools takes the step on top for upstream's "navigated without undoing" only when it
	    is a navigation step (or upstream's "Automatically navigated to" step, recorded after a
	    deletion). Any other step whose letter's earlier state is not right under it (a list
	    made in Simple, which records no navigation steps, then used after a crash restore or a
	    mode switch; or a letter opened without a step, like the item links) is undone from that
	    letter's own newest older state, never dropped; a deletion on top puts its letter back.
	  - Simple records no "Automatically navigated to" step either (the Delete buttons), so one
	    press brings a deleted letter back.
	  - Bursts (Simple): presses of one arrow key on one guide line (options.burst names the
	    line), each within BURST_MS of the last, are one step: the newest press takes the place
	    of the one before it, so a held key never fills the list with whole-font copies.
**/

/** ANY-INK (B3 fix): presses of one key on one line this close together are one step (Simple) */
export const BURST_MS = 1000;
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
		// (no file holds this project: new, sample, imported, recovered; or the cap dropped it)
		this.savedMarker = null;
		// ANY-INK (B2): the font with every step the cap dropped written in (undo_cap.js);
		// null while nothing has dropped, so undo falls back to initialProject
		this.undoFloor = null;
		// ANY-INK (B3 fix): the newest press of a burst on one guide line (Simple), see BURST_MS
		this.burst = null;
		this.burstPending = undefined;
	}

	/** The state undo falls back to when nothing older is left in the queue. */
	get undoBase() {
		return this.undoFloor || this.initialProject;
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
		this.undoFloor = null;
	}

	/**
	 * Plain, structured-cloneable copy of the undo state for a crash-recovery snapshot.
	 * @returns {Object} { projectID, version, initialTimeStamp, initialProject, undoFloor, queue,
	 *   redoQueue }
	 */
	serializeForStorage() {
		const hasInitial = typeof this.initialProject?.save === 'function';
		const hasFloor = typeof this.undoFloor?.save === 'function';
		return {
			projectID: this.projectID,
			version: HISTORY_FORMAT_VERSION,
			initialTimeStamp: this.initialTimeStamp,
			initialProject: hasInitial ? this.initialProject.save() : null,
			undoFloor: hasFloor ? this.undoFloor.save() : null,
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
		let undoFloor;
		let queue;
		let redoQueue;
		try {
			initialProject = snapshot.initialProject
				? new GlyphrStudioProject(snapshot.initialProject)
				: this.initialProject;
			undoFloor = snapshot.undoFloor ? new GlyphrStudioProject(snapshot.undoFloor) : null;
			queue = (snapshot.queue || []).map(deserializeHistoryEntry);
			redoQueue = (snapshot.redoQueue || []).map((entries) => entries.map(deserializeHistoryEntry));
		} catch (error) {
			console.warn('ANY-INK history: could not adopt the recovered undo queue', error);
			return false;
		}
		this.initialTimeStamp = snapshot.initialTimeStamp ?? this.initialTimeStamp;
		this.initialProject = initialProject;
		this.undoFloor = undoFloor;
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
		let items = this.queue.filter(
			(item, index) =>
				item.title !== '_whole_project_change_post_state_' && !isLaterPart(this.queue, index)
		);
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
		// ANY-INK (B2): looking at another item changes nothing in the font
		if (!itemWasDeleted && isNavigationTitle(title)) {
			this.addNavigationState(title);
			return;
		}
		// ANY-INK (B2 fix): nor does the Delete buttons' "Automatically navigated to" step; in
		// Simple it is no step (one Undo press brings the deleted letter back)
		if (!itemWasDeleted && isSimpleMode() && isAutoNavigationTitle(title)) return;
		// ANY-INK (B3): spacing, inside this step (Simple refits; All tools marks "set by you")
		const editor = getCurrentProjectEditor();
		// ANY-INK (B8 + B9 finalize): pasted brush strokes sorted out inside this step too
		if (!itemWasDeleted) beforeStrokeStep(editor);
		const spacing = beforeItemStep(this, editor, { itemWasDeleted });
		const entry = makeHistoryEntry({ title: title, itemWasDeleted: itemWasDeleted });
		// ANY-INK (B3 fix): letters refit with the open one are parts of this item step
		const others = spacing?.alsoChanged || [];
		if (others.length) entry.step = newStepKey(entry);
		const parts = others.map((letter) => makeStepPart(letter, entry));
		this.queue.unshift(entry, ...parts);
		this.redoQueue = [];
		// ANY-INK (B2): newest 200 steps, at most 30 whole-project steps (undo_cap.js)
		this.capQueue();
		this.updateAfterSaveState();
		// The letters made from it changed too: panels and the preview hear about it
		if (parts.length) publishCurrentItem(editor);
		// log(this);
		// log(`History.addState`, 'end');
	}

	/**
	 * ANY-INK (B2, B3 fix): the size limit (undo_cap.js), keeping a step with parts whole. A
	 * step's parts are not steps of their own, so the 200-step limit counts each step once
	 * (undo_cap.js counts entries: the limit grows by the parts the list holds, and is worked
	 * out again after each drop, since a dropped step takes its parts with it). The limit drops
	 * one entry at a time from the old end, and a step's parts sit under the entry of the letter
	 * he changed: when it took some of a step, the rest of that step goes too.
	 * @returns {Array} the entries dropped, oldest first
	 */
	capQueue() {
		const dropped = [];
		for (let tries = this.queue.length + 1; tries > 0; tries--) {
			const maxSteps = MAX_UNDO_STEPS + countLaterParts(this.queue);
			// ANY-INK (B8 + B9 finalize): and at most MAX_UNDO_POINTS points of shapes
			const taken = capUndoQueue(this, { maxSteps, maxPoints: MAX_UNDO_POINTS });
			if (!taken.length) break;
			dropped.push(...taken);
		}
		const keys = new Set(dropped.map((entry) => entry.step).filter(Boolean));
		let guard = this.queue.length;
		while (keys.size && keys.has(this.queue[this.queue.length - 1]?.step) && guard-- > 0) {
			const steps = countSteps(this.queue).steps;
			dropped.push(...capUndoQueue(this, { maxSteps: Math.max(0, steps - 1) }));
		}
		return dropped;
	}

	/**
	 * ANY-INK (B2): upstream's "Navigated to ..." step (its navigators all call addState with
	 * that title). Simple keeps none: looking around is never an Undo step there. All tools
	 * keeps it, since its undo reads the step under the newest one for the item's earlier
	 * state, but the font has not changed, so it never changes the saved state: no crash
	 * recovery write, no "pending" work file, no title dot, and on a saved font the saved
	 * marker moves onto the new step. Like any new step it clears Redo (as upstream did).
	 * @param {String} title - 'Navigated to <item name>'
	 */
	addNavigationState(title) {
		if (isSimpleMode()) return;
		const wasSaved = this.isAtSavedState();
		const entry = makeHistoryEntry({ title: title });
		entry.navigation = true;
		this.queue.unshift(entry);
		this.redoQueue = [];
		if (wasSaved) this.savedMarker = entry;
		this.capQueue();

		const editor = getCurrentProjectEditor();
		if (editor?.nav?.panel === 'History') refreshPanel();
		const undoButton = document.querySelector('#actionButtonUndo');
		if (undoButton) undoButton.removeAttribute('disabled');
		const redoButton = document.querySelector('#actionButtonRedo');
		if (redoButton) redoButton.setAttribute('disabled', 'disabled');
	}

	/**
	 * ANY-INK: Capture the font metrics and guide settings after a change
	 * (metric line drag, guide drag, guide visibility) as a lightweight
	 * 'settings' entry. Call it AFTER the change, like addState.
	 * @param {String} title - What to call this change in the History panel
	 */
	addSettingsState(title = '', { burst = null } = {}) {
		const editor = getCurrentProjectEditor();
		// ANY-INK (B3 fix): Simple: the next press of a burst on one line joins its step
		if (this.continuesBurst(burst) && this.extendBurst(title)) {
			this.noteBurst(burst);
			return;
		}
		// ANY-INK (B3 fix, UX-BEGINNER 7.3): in Simple, moving the small-letter line (or the grid
		// size) moves every gap, so it is one whole-font step that refits the automatic letters
		const settingsBefore = settingsBeforeGapChange(this, editor);
		if (settingsBefore) {
			this.addSettingsStepWithRefit(title, settingsBefore);
			this.noteBurst(burst);
			return;
		}
		const entry = makeSettingsHistoryEntry(title, editor, this.queue[0]);
		this.queue.unshift(entry);
		this.redoQueue = [];
		this.capQueue(); // ANY-INK (B2)
		this.updateAfterSaveState();
		this.noteBurst(burst);
	}

	/**
	 * ANY-INK (B3 fix), Simple: the step on top is the newest press of a burst on this line,
	 * still going (BURST_MS since that press, nothing recorded or undone since).
	 * @param {String | null} key - the line (options.burst); none: never a burst
	 * @returns {Boolean}
	 */
	continuesBurst(key) {
		const burst = this.burst;
		if (!key || !burst || burst.key !== key || !isSimpleMode()) return false;
		if (this.queue[0] !== burst.top || this.redoQueue.length) return false;
		return Date.now() - burst.at <= BURST_MS;
	}

	/**
	 * ANY-INK (B3 fix): remembers the step on top as the newest press of a burst (Simple).
	 * @param {String | null} key
	 */
	noteBurst(key) {
		this.burst = key && isSimpleMode() ? { key, at: Date.now(), top: this.queue[0] } : null;
	}

	/**
	 * ANY-INK (B3 fix): a burst's next settings press. A whole-font step (a line that moves the
	 * gaps) keeps its before-copy and gets a new after-copy, refit for this press, and this
	 * press's title. A settings entry is taken off: this press is then recorded from the state
	 * under it, as one step.
	 * @param {String} title
	 * @returns {Boolean} true when the step on top took this press
	 */
	extendBurst(title) {
		const preIndex = indexOfPairedPre(this.queue, 0);
		this.takeBurstTop();
		if (preIndex < 0) return false;
		this.queue[preIndex - 1].title = title;
		this.addWholeProjectChangePostState();
		this.updateAfterSaveState();
		publishCurrentItem(getCurrentProjectEditor());
		return true;
	}

	/** Takes the burst's newest entry off; no state in the list holds a file saved at it now. */
	takeBurstTop() {
		const top = this.queue.shift();
		if (this.savedMarker === top) this.savedMarker = null;
	}

	/**
	 * ANY-INK (B3 fix): a settings change recorded as a whole-font step about no letter. The
	 * change is already made, so the before-copy is the font now with the settings from before
	 * it; the after-copy comes after the spacing hook refits every automatic letter
	 * (addWholeProjectChangePostState).
	 * @param {String} title
	 * @param {Object} settingsBefore - settings snapshot from before the change
	 */
	addSettingsStepWithRefit(title, settingsBefore) {
		this.addWholeProjectChangePreState(title || 'Changed font metrics or guides', {
			itemID: null,
		});
		applySettingsSnapshot(this.queue[0].itemState.settings, settingsBefore);
		this.addWholeProjectChangePostState();
		publishCurrentItem(getCurrentProjectEditor());
	}

	/**
	 * #### Call this method *before* a whole-project change
	 * Capture the current state of the entire Project and put it into the History queue.
	 * This is used for cross-item actions, where multiple dependent items are updated at
	 * once, or for bulk actions, where many items are modified at the same time.
	 * @param {String} title - What to call this change in the History panel
	 * @param {Object} [options] - ANY-INK (B2)
	 * @param {String | null} [options.itemID] - the letter this change is about (default: the
	 *   one open). null: about no letter (B3 fix): font-wide actions such as the letter-spacing
	 *   slider, gap fixes and guide lines, so Undo never jumps to the letter that was open
	 * @param {Boolean} [options.creationOnly] - only makes an empty item (opening a letter):
	 *   Simple undo passes over the pair
	 */
	addWholeProjectChangePreState(title = '', { itemID, creationOnly = false, burst = null } = {}) {
		title = title || `Update to many items across the project.`;
		// ANY-INK (B3 fix): Simple: the next press of a burst keeps the step's before-copy, and
		// the after-copy that follows takes the place of the last one
		this.burstPending = burst;
		if (this.continuesBurst(burst) && indexOfPairedPre(this.queue, 0) > -1) {
			const preIndex = indexOfPairedPre(this.queue, 0);
			this.takeBurstTop();
			this.queue[preIndex - 1].title = title;
			this.updateAfterSaveState();
			return;
		}
		const entry = makeHistoryEntry({ title: title, wholeProjectSave: true });
		// ANY-INK (B2): the letter the change is about, not the id of the step that was on top
		// (in Simple no "Navigated to" step says which letter is open). With no letter open
		// (Global actions, the board), All tools keeps upstream's top-step id and Simple names
		// none, so undo never offers to show a letter the change wasn't about.
		const editor = getCurrentProjectEditor();
		const aboutNoLetter = itemID === null;
		const openID = aboutNoLetter ? false : itemID || editor.selectedItemID;
		if (openID) {
			entry.itemID = openID;
			entry.page = pageFromItemID(openID) || editor.nav.page;
		} else if (!aboutNoLetter && this.queue.length && !isSimpleMode()) {
			entry.itemID = this.queue[0].itemID;
			entry.page = this.queue[0].page;
		} else {
			entry.itemID = false;
			entry.page = editor.nav.page;
		}
		if (creationOnly) entry.creationOnly = true;
		this.queue.unshift(entry);
		this.redoQueue = [];
		this.updateAfterSaveState();
	}

	/**
	 * #### Call this method *after* a whole-project change
	 */
	addWholeProjectChangePostState() {
		// ANY-INK (B3): Simple ends with every automatic letter at its fit; All tools marks the
		// automatic letters this change moved "set by you"
		beforeWholeProjectPost(this, getCurrentProjectEditor());
		const entry = makeHistoryEntry({
			title: '_whole_project_change_post_state_',
			wholeProjectSave: true,
		});
		if (this.queue.length) {
			entry.itemID = this.queue[0].itemID;
			entry.page = this.queue[0].page;
			// ANY-INK (B2): the post closes the pre on top and is the same kind of step
			if (this.queue[0].wholeProjectSave && this.queue[0].creationOnly) entry.creationOnly = true;
		} else {
			const editor = getCurrentProjectEditor();
			entry.itemID = editor.selectedItemID;
			entry.page = editor.nav.page;
		}
		this.queue.unshift(entry);
		// ANY-INK (B2): the cap counts a whole-project step once it is complete, so an action
		// that fails between pre and post (discardLatestState) never costs an older step
		this.capQueue();
		// ANY-INK (B3 fix): a step recorded as a press of a burst
		if (this.burstPending !== undefined) {
			this.noteBurst(this.burstPending);
			this.burstPending = undefined;
		}
		// ANY-INK (B8 + B9 finalize): the step is done; the save status hears of it now, not at
		// the next change (only the pre-state told it, so the top bar showed the font before it)
		markDirty(this);
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
		// ANY-INK (B2): Simple undoes the newest change wherever it is (simple_undo.js) and
		// returns what it did, for the undo toast (B6). All tools carries on as upstream.
		// B3 fix: a step with parts (letters refit with the one he changed) goes in one press.
		if (isSimpleMode()) {
			const result = undoNewest(this, editor);
			if (result?.done) this.undoRestOfStep(editor);
			// B6: every press is named ("Undid: traced Capital B" [Redo]); with coach off, B5 as before
			sayUndone(result, editor);
			return result;
		}
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
				const snapshot = findPreviousSettingsSnapshot(q, 1, this.undoBase);
				applySettingsToEditor(editor, snapshot, q[0].settingsState);
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

			// ANY-INK (B3 fix): a step with parts, or a real step whose letter's earlier state is
			// not right under it (a list made in Simple), is undone from each letter's own newest
			// older state. Only a navigation step is ever passed as "navigated without undoing".
			if (q[0].step || isStepOverAnotherItem(q[0], nextEntry)) {
				this.undoFromOwnEarlierStates(editor);
				changed = true;
				this.finishUndoUI(editor);
				return;
			}

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
					// ANY-INK (B4): the one toast voice; the letter's characters name it in house
					// words ("Brought back small c", src/anyink/toast/upstream_map.js)
					upstreamToast(`Restored deleted item<br>${nextEntry.itemState.name}`, {
						context: { chars: nextEntry.itemState.chars },
					});
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
				nextEntry = makeInitialFallbackEntry(editor, this.undoBase, undoneEntry);
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
				// ANY-INK (B2): a navigation step changed nothing, so the saved state moves with it
				if (undoneEntry.navigation && this.savedMarker === undoneEntry) {
					this.savedMarker = q[0] || SAVED_AT_EMPTY;
				}
			}
			publishCurrentItem(editor);

			// Save undone state for redo
			this.redoQueue.unshift(redoEntries);
			// ANY-INK (B2): undoing a navigation step changes nothing in the font
			changed = !undoneEntry.navigation;

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
	 * ANY-INK (B3 fix): Simple's undo took the newest step's own entry (simple_undo.js); its
	 * parts, the letters refit with it, go back in the same press, each to its own newest older
	 * state, and join that press's Redo entry.
	 * @param {Object} editor - current ProjectEditor
	 */
	undoRestOfStep(editor) {
		const undone = this.redoQueue[0];
		const key = undone?.[0]?.step;
		if (!key || this.queue[0]?.step !== key) return;
		this.isRestoring = true;
		try {
			undone.push(...this.takeParts(editor, key));
		} finally {
			this.isRestoring = false;
		}
		publishCurrentItem(editor);
		markDirty(this);
		this.finishUndoUI(editor);
	}

	/**
	 * ANY-INK (B3 fix), All tools: undoes the step on top from its letter's own newest older state
	 * (as Simple does), with its parts, and moves the view to that letter the way upstream's undo
	 * of an item step does. Called inside restoreState's try.
	 * @param {Object} editor - current ProjectEditor
	 */
	undoFromOwnEarlierStates(editor) {
		const q = this.queue;
		const top = q[0];
		editor.multiSelect.points.clear();
		editor.multiSelect.shapes.clear();
		// A deletion step holds the item from before it was deleted
		const state = top.itemWasDeleted
			? top.itemState
			: previousItemState(q, top.itemID, this.undoBase);
		applyItemState(editor, {
			itemID: top.itemID,
			page: top.page || pageFromItemID(top.itemID),
			itemState: state || blankItemState(top.itemID),
		});
		const undone = [q.shift()];
		if (top.step) undone.push(...this.takeParts(editor, top.step));
		publishCurrentItem(editor);
		this.redoQueue.unshift(undone);
	}

	/**
	 * Takes the parts of a step off the top of the queue, writing each letter's own newest older
	 * state back into the font.
	 * @param {Object} editor
	 * @param {String} key - the step's key
	 * @returns {Array} the parts, newest first
	 */
	takeParts(editor, key) {
		const taken = [];
		while (this.queue[0]?.step === key) {
			const part = this.queue[0];
			const state = previousItemState(this.queue, part.itemID, this.undoBase);
			writeItemState(editor.project, part.itemID, state);
			taken.push(this.queue.shift());
		}
		refreshLettersWithParts(editor.project);
		return taken;
	}

	/**
	 * ANY-INK (B3 fix): a Redo put back the step's own entry; its parts go back too.
	 * @param {Object} editor
	 * @param {Array} entries - the Redo entry that was just redone
	 */
	redoRestOfStep(editor, entries) {
		const key = entries?.[0]?.step;
		const parts = key ? entries.slice(1).filter((entry) => entry.step === key) : [];
		if (!parts.length) return;
		parts.forEach((part) => writeItemState(editor.project, part.itemID, part.itemState));
		refreshLettersWithParts(editor.project);
		publishCurrentItem(editor);
		markDirty(this);
	}

	/**
	 * Step back N undos at once, used when the user clicks a specific
	 * entry in the History panel to revert to that point in time.
	 * Passing a number larger than queue length jumps to the initial state.
	 * ANY-INK (B3 fix): N counts the panel's rows; a step with parts shows a row for each part
	 * and goes in one press.
	 * @param {Number} steps - How many undo steps to apply
	 */
	jumpToState(steps) {
		let rows = steps;
		while (rows > 0 && this.queue.length) {
			rows -= rowsOfTopStep(this.queue);
			this.restoreState();
		}
	}

	/**
	 * Re-apply the most recently undone change. Reverses restoreState.
	 */
	redoState() {
		const editor = getCurrentProjectEditor();
		// ANY-INK (B2): Simple redoes the way it undoes (simple_undo.js)
		if (isSimpleMode()) {
			const entries = this.redoQueue[0];
			const result = redoNewest(this, editor);
			if (result?.done) this.redoRestOfStep(editor, entries);
			sayUndone(result, editor, { redo: true });
			return result;
		}

		if (this.redoQueue.length === 0) {
			const redoButton = document.querySelector('#actionButtonRedo');
			if (redoButton) redoButton.setAttribute('disabled', 'disabled');
			showToast(`No more redo`);
			return;
		}

		const entries = this.redoQueue.shift();
		const targetEntry = entries[0];
		// ANY-INK (B2): redoing a navigation step changes nothing; a saved font stays saved
		const keepSaved = !!targetEntry.navigation && this.isAtSavedState();

		this.isRestoring = true;
		try {
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();

			if (targetEntry.settingsSave) {
				const previous = findPreviousSettingsSnapshot(this.queue, 0, this.undoBase);
				applySettingsToEditor(editor, targetEntry.settingsState, previous);
			} else if (targetEntry.wholeProjectSave) {
				swapProject(editor, targetEntry.itemState);
				reconcileSelectionAfterProjectSwap(editor);
			} else {
				applyItemState(editor, targetEntry);
			}
			// ANY-INK (B3 fix): the letters refit with it go back too
			this.redoRestOfStep(editor, entries);
			publishCurrentItem(editor);

			// Restore the queue entries so subsequent undos behave correctly
			for (let i = entries.length - 1; i >= 0; i--) {
				this.queue.unshift(entries[i]);
			}
			if (keepSaved) this.savedMarker = targetEntry;
		} finally {
			this.isRestoring = false;
		}

		// ANY-INK: a redo changes the project; the dot follows the saved marker
		// (B2: redoing a navigation step changes nothing)
		if (!targetEntry.navigation) markDirty(this);
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

/**
 * Saved marker for "the file on disk holds the state with nothing in the queue".
 * ANY-INK (B2): defined in history_helpers.js, so undo_cap.js can move it too.
 */
export { SAVED_AT_EMPTY };

/**
 * Shows or clears the title dot from History's saved marker.
 * ANY-INK (B2): exported for simple_undo.js, as are the appliers below.
 * @param {Object} editor - ProjectEditor
 * @param {History} history
 */
export function syncSavedIndicator(editor, history) {
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

	// Item did not exist when the project was opened: back to blank
	const itemState = baseItem ? baseItem.save() : blankItemState(itemID, objType);

	return {
		itemState: itemState,
		itemID: itemID,
		page: undoneEntry.page || editor.nav.page,
		title: 'Initial state',
	};
}

/**
 * An item with nothing in it, for undo back to before it existed.
 * @param {String} itemID
 * @param {String | false} [objType]
 * @returns {Object} save() data
 */
function blankItemState(itemID, objType = objTypeFromID(itemID)) {
	if (objType === 'KernGroup') return new KernGroup({}).save();
	return new Glyph({ id: itemID, objType: objType || 'Glyph' }).save();
}

// --------------------------------------------------------------
// ANY-INK (B3 fix): steps with parts, and steps over another item
// --------------------------------------------------------------

let stepCount = 0;

/**
 * A letter refit with the one he changed, recorded as a part of that item step: an item entry
 * of its own (so its newest state is where every reader of the list looks for it) with the
 * step's key and title.
 * @param {Object} letter - the live letter, as the step left it
 * @param {Object} entry - the step's own entry (its key set)
 * @returns {Object} an item entry
 */
function makeStepPart(letter, entry) {
	return {
		timeStamp: entry.timeStamp,
		itemID: letter.id,
		itemState: new Glyph(letter.save()),
		title: entry.title,
		page: pageFromItemID(letter.id) || entry.page,
		itemWasDeleted: false,
		wholeProjectSave: false,
		settingsSave: false,
		settingsState: false,
		step: entry.step,
	};
}

/** @returns {String} a key no other step in this list has */
function newStepKey(entry) {
	stepCount += 1;
	return `step-${entry.timeStamp}-${stepCount}`;
}

/**
 * @param {Array} queue
 * @param {Number} index
 * @returns {Boolean} true for a part under the step's own entry (not a press of its own)
 */
function isLaterPart(queue, index) {
	const entry = queue[index];
	return index > 0 && !!entry?.step && queue[index - 1]?.step === entry.step;
}

/** @returns {Number} how many entries are parts under a step's own entry (not steps of their own) */
function countLaterParts(queue) {
	let parts = 0;
	for (let index = 1; index < queue.length; index++) if (isLaterPart(queue, index)) parts++;
	return parts;
}

/** @returns {Number} the History panel rows the step on top shows (its entry and its parts) */
function rowsOfTopStep(queue) {
	let rows = 1;
	while (isLaterPart(queue, rows)) rows++;
	return rows;
}

/**
 * All tools: a real step whose item's earlier state is not the entry under it. Upstream reads
 * that case as "the step on top is a navigation", which holds only for a navigation step, or
 * for the step the Delete buttons record right after a deletion ("Automatically navigated to",
 * over an item deletion or a whole-font one): upstream's undo of it moves the view and restores
 * the deleted item in the same press. Any other step is undone from its own item's newest older
 * state instead of being dropped; a deletion on top (no "Automatically navigated to" step over
 * it: a list made in Simple, or a Redo) puts back the item it holds.
 * @param {Object} top - queue[0]
 * @param {Object | false} next - the next item entry below it
 * @returns {Boolean}
 */
function isStepOverAnotherItem(top, next) {
	if (!top || top.wholeProjectSave || top.settingsSave || isLookingAroundEntry(top)) return false;
	if (top.itemWasDeleted) return !next || next.itemID !== top.itemID;
	return isNavigationBetween(top, next);
}

/**
 * Letters written back from the list are new objects; letters made from them (components)
 * measure again.
 * @param {Object} project
 */
function refreshLettersWithParts(project) {
	['glyphs', 'ligatures', 'components'].forEach((collection) => {
		Object.values(project?.[collection] || {}).forEach((owner) => {
			(owner?.shapes || []).forEach((shape) => {
				if (shape?.objType !== 'ComponentInstance') return;
				shape.cache = {};
				owner.cache = {};
			});
		});
	});
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
export function swapProject(editor, snapshotProject, settingsOverride = false) {
	const live = editor._project;
	editor._project = new GlyphrStudioProject(snapshotProject.save());
	if (settingsOverride) applySettingsSnapshot(editor._project.settings, settingsOverride);
	// ANY-INK (B8 + B9 finalize): the photo list is outside Undo, like the images it names
	// (photo_registry.js carryPhotos); the photo flow then lets the uses follow the letters
	carryPhotos(live, editor._project);
	syncSettingsToEditor(editor);
	// Kern groups are new objects now; the lookup and the preview strip must follow.
	notifyKernPairsChanged(editor);
}

/**
 * Writes a settings snapshot into the live project and tells everyone.
 * @param {Object} editor
 * @param {Object | false} snapshot
 * @param {Object | false} [changedFrom] - ANY-INK (B2): the snapshot an undo or redo leaves, so
 *   settings.anyink and the project name change only where that step changed them
 */
export function applySettingsToEditor(editor, snapshot, changedFrom = false) {
	if (snapshot) applySettingsSnapshot(editor.project.settings, snapshot, { changedFrom });
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
export function reconcileSelectionAfterProjectSwap(editor) {
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
export function publishCurrentItem(editor) {
	const item = editor.project.getItem(editor.selectedItemID);
	if (item) editor.publish('currentItem', item);
}

// --------------------------------------------------------------
// Serializing entries
// --------------------------------------------------------------

export function serializeHistoryEntry(entry) {
	const hasItem = entry.itemState && typeof entry.itemState.save === 'function';
	const wire = {
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
	// ANY-INK (B2): steps that only looked around keep saying so after a crash restore
	if (entry.navigation) wire.navigation = true;
	if (entry.creationOnly) wire.creationOnly = true;
	// ANY-INK (B3 fix): a step with parts stays one press after a crash restore
	if (entry.step) wire.step = entry.step;
	return wire;
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
