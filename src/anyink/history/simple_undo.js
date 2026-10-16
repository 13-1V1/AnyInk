// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B2: Undo and Redo in Simple mode (UX-BEGINNER 7.3). History.restoreState and redoState hand
	over to these while mode.js says 'simple'; All tools keeps upstream's undo untouched.

	- One press undoes the newest change, wherever it was. In a letter view (any page that edits
	  one item) the view moves to the changed letter in the same press; anywhere else (the board)
	  the view stays and the result names the letter for a [Show me] button. There is never a
	  press that only moves the view.
	- Steps that only looked around are passed over in the same press and never named: navigation
	  steps and the creation-only steps All tools records when a letter is opened (Simple records
	  neither). They leave the list for good; the empty letter records they stand for stay.
	- An item step is undone from the nearest older state of that same item: an older step of that
	  item, or a whole-project copy that holds it, or the undo floor (the font as loaded, plus any
	  steps the cap dropped). So no step is needed when a letter is opened, unlike upstream, which
	  reads the "Navigated to" step under the newest one.
	- A whole-project step goes back to its pre-state copy and names the letter that was open
	  when it was made (History.addWholeProjectChangePreState).
	- A settings step is undone in place; it names no letter.

	  undoNewest(history, editor, options?)  -> result
	  redoNewest(history, editor, options?)  -> result
	  result: { done, title, itemID, page, moved, showMe } - title is the step's own title (B4
	    puts it in house words, B6 shows it as "Undid: ..."): for a whole-project step, the title
	    its pre entry was recorded with, never the post entry's internal marker; showMe is
	    { itemID, page } when the view stayed away from the changed letter, else null.
	  options.inLetterView: default, editor.nav.page is an item page (B7 / B10 may pass their own).
*/
import { markDirty } from '../recovery/recovery.js';
import { notifyKernPairsChanged } from '../kerning/kern_lookup.js';
import {
	SAVED_AT_EMPTY,
	applySettingsToEditor,
	publishCurrentItem,
	reconcileSelectionAfterProjectSwap,
	swapProject,
	syncSavedIndicator,
} from '../../project_editor/history.js';
import {
	indexOfNextItemEntry,
	indexOfPairedPre,
	isItemPage,
	isLookingAroundEntry,
	isWholeProjectPost,
	objTypeFromID,
	pageFromItemID,
	WHOLE_PROJECT_POST_TITLE,
} from './history_helpers.js';
import { itemIn, removeItem, writeItemState } from './item_state.js';
import { findPreviousSettingsSnapshot } from './settings_snapshot.js';

/** @returns {Object} the result of a press that changed nothing */
function nothing() {
	return { done: false, title: '', itemID: false, page: false, moved: false, showMe: null };
}

/**
 * @param {Object} history - History
 * @param {Object} editor - ProjectEditor
 * @param {{inLetterView?: Boolean}} [options]
 * @returns {Object} result (see the header)
 */
export function undoNewest(history, editor, { inLetterView } = {}) {
	if (!history || !editor) return nothing();
	const queue = history.queue;
	passOverLookingAround(history);
	if (!queue.length) {
		setButton('#actionButtonUndo', false);
		syncSavedIndicator(editor, history);
		return nothing();
	}
	const letterView = inLetterView ?? isItemPage(editor.nav?.page);
	const top = queue[0];
	let result;
	history.isRestoring = true;
	try {
		clearSelections(editor);
		let undone;
		let itemID = false;
		if (top.settingsSave) {
			const previous = findPreviousSettingsSnapshot(queue, 1, history.undoBase);
			applySettingsToEditor(editor, previous, top.settingsState);
			undone = queue.splice(0, 1);
		} else if (top.wholeProjectSave) {
			const preIndex = indexOfPairedPre(queue, 0);
			// A lone entry (no partner) goes back to its own copy
			swapProject(editor, (preIndex > -1 ? queue[preIndex] : top).itemState);
			undone = queue.splice(0, preIndex > -1 ? preIndex + 1 : 1);
			itemID = top.itemID || false;
		} else {
			itemID = top.itemID;
			const state = stateBeforeStep(queue, history.undoBase);
			writeItemState(editor.project, itemID, state);
			if (objTypeFromID(itemID) === 'KernGroup') notifyKernGroup(editor, itemID);
			undone = queue.splice(0, 1);
		}
		history.redoQueue.unshift(undone);
		result = finishPress(editor, stepTitle(undone), itemID, letterView, top.wholeProjectSave);
	} finally {
		history.isRestoring = false;
	}
	markDirty(history);
	history.finishUndoUI(editor);
	return result;
}

/**
 * @param {Object} history - History
 * @param {Object} editor - ProjectEditor
 * @param {{inLetterView?: Boolean}} [options]
 * @returns {Object} result (see the header)
 */
export function redoNewest(history, editor, { inLetterView } = {}) {
	if (!history || !editor) return nothing();
	if (!history.redoQueue.length) {
		setButton('#actionButtonRedo', false);
		return nothing();
	}
	const letterView = inLetterView ?? isItemPage(editor.nav?.page);
	const entries = history.redoQueue.shift();
	const target = entries[0];
	let result;
	history.isRestoring = true;
	try {
		clearSelections(editor);
		let itemID = false;
		if (target.settingsSave) {
			const previous = findPreviousSettingsSnapshot(history.queue, 0, history.undoBase);
			applySettingsToEditor(editor, target.settingsState, previous);
		} else if (target.wholeProjectSave) {
			swapProject(editor, target.itemState);
			itemID = target.itemID || false;
		} else {
			itemID = target.itemID;
			if (target.itemWasDeleted) removeItem(editor.project, itemID);
			else writeItemState(editor.project, itemID, target.itemState);
			if (objTypeFromID(itemID) === 'KernGroup') notifyKernGroup(editor, itemID);
		}
		for (let i = entries.length - 1; i >= 0; i--) history.queue.unshift(entries[i]);
		result = finishPress(editor, stepTitle(entries), itemID, letterView, true);
	} finally {
		history.isRestoring = false;
	}
	markDirty(history);
	syncSavedIndicator(editor, history);
	setButton('#actionButtonUndo', true);
	setButton('#actionButtonRedo', history.redoQueue.length > 0);
	return result;
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/**
 * Takes steps that only looked around off the top of the list. The font does not change, so
 * the saved marker moves with them, as for upstream's navigation-only press.
 * @param {Object} history
 */
function passOverLookingAround(history) {
	const queue = history.queue;
	while (queue.length && isLookingAroundEntry(queue[0])) {
		const preIndex = isWholeProjectPost(queue[0]) ? indexOfPairedPre(queue, 0) : -1;
		const count = preIndex > -1 && queue[preIndex].creationOnly ? preIndex + 1 : 1;
		const gone = queue.splice(0, count);
		if (gone.includes(history.savedMarker)) history.savedMarker = queue[0] || SAVED_AT_EMPTY;
	}
}

/**
 * B16: the state the newest step (queue[0]) undoes to. A deletion step holds the item from before
 * it was deleted; a step that carries its own earlier state (`before`, markStepBefore) goes back
 * to that; any other item step to its item's nearest older state (previousItemState).
 * @param {Array} queue - History.queue, newest first
 * @param {Object} base - History.undoBase
 * @returns {Object | null}
 */
export function stateBeforeStep(queue, base) {
	const top = queue[0];
	if (!top) return null;
	if (top.itemWasDeleted) return top.itemState;
	if (top.before) return top.before;
	return previousItemState(queue, top.itemID, base);
}

/**
 * B16: gives the newest step its own earlier state, for a change whose real "before" is not in
 * the list. Use it on an empty letter: the photo went on at step C with no step of its own (a
 * look, never saved), so the letter's older state has no photo, while one Undo must bring back
 * the empty letter with its photo kept (UX-BEGINNER 9.2 T2). Only an item step of that item
 * takes it; a whole-project step already holds its own copy.
 * @param {Object} history
 * @param {String} itemID
 * @param {Object} state - the item's save() data, or an item with save()
 * @param {(data: Object) => Object} make - builds the stored item (new Glyph(data))
 * @returns {Boolean} true when the step took it
 */
export function markStepBefore(history, itemID, state, make) {
	const top = history?.queue?.[0];
	if (!top || top.itemID !== itemID || top.wholeProjectSave || top.settingsSave) return false;
	if (top.itemWasDeleted || !state) return false;
	const data = typeof state.save === 'function' ? state.save() : structuredClone(state);
	top.before = make(data);
	return true;
}

/**
 * The state an item had before the newest step (queue[0]) changed it.
 * @param {Array} queue - History.queue, newest first
 * @param {String} itemID
 * @param {Object} base - History.undoBase: the floor under the whole list
 * @returns {Object | null} an item, or null when it didn't exist then
 */
export function previousItemState(queue, itemID, base) {
	for (let i = indexOfNextItemEntry(queue, 1); i > -1; i = indexOfNextItemEntry(queue, i + 1)) {
		const entry = queue[i];
		if (entry.wholeProjectSave) return itemIn(entry.itemState, itemID);
		// A deletion step holds the item from before it was deleted: after it, it was gone
		if (entry.itemID === itemID) return entry.itemWasDeleted ? null : entry.itemState;
	}
	return itemIn(base, itemID);
}

/**
 * The title a step was recorded with. A whole-project step is a pre / post pair (with anything
 * recorded between its halves); its title is on the pre, the oldest entry. The post carries
 * only upstream's internal marker, which is never a title anyone reads.
 * @param {Array} entries - one step's entries, newest first (as undo and redo move them)
 * @returns {String}
 */
function stepTitle(entries) {
	const top = entries[0];
	const oldest = entries[entries.length - 1];
	const pre = isWholeProjectPost(top) && oldest?.wholeProjectSave && !isWholeProjectPost(oldest);
	const title = (pre ? oldest : top)?.title || '';
	return title === WHOLE_PROJECT_POST_TITLE ? '' : title;
}

/**
 * Settles the view after a press and builds its result. In a letter view the view moves to the
 * changed item (one navigate); elsewhere it stays and names the item for Show me.
 * @param {Object} editor
 * @param {String} title - the step's own title (stepTitle)
 * @param {String | false} itemID - the changed item
 * @param {Boolean} letterView
 * @param {Boolean} projectChanged - the item objects were replaced (whole-project swap, or a
 *   redo that may remove the open item): check the open item still exists
 * @returns {Object} result
 */
function finishPress(editor, title, itemID, letterView, projectChanged) {
	const page = itemID ? pageFromItemID(itemID) : false;
	const exists = !!page && !!itemIn(editor.project, itemID);
	let moved = false;
	let showMe = null;
	if (exists && letterView) {
		if (editor.nav.page !== page || editor.selectedItemID !== itemID) {
			editor.nav.page = page;
			editor.selectedItemID = itemID;
			editor.navigate();
			moved = true;
		}
	} else if (exists) {
		showMe = { itemID, page };
	}
	if (!moved && (projectChanged || !exists)) reconcileOpenItem(editor);
	publishCurrentItem(editor);
	return { done: true, title, itemID: itemID || false, page, moved, showMe };
}

/**
 * When the open item is gone (an undo of its creation), open the next best one.
 * @param {Object} editor
 */
function reconcileOpenItem(editor) {
	if (!isItemPage(editor.nav?.page)) return;
	reconcileSelectionAfterProjectSwap(editor);
}

function clearSelections(editor) {
	editor.multiSelect?.points?.clear?.();
	editor.multiSelect?.shapes?.clear?.();
}

function notifyKernGroup(editor, groupID) {
	notifyKernPairsChanged(editor, { groupID, value: editor.project.kerning?.[groupID]?.value });
}

/**
 * @param {String} selector - '#actionButtonUndo' | '#actionButtonRedo'
 * @param {Boolean} enabled
 */
function setButton(selector, enabled) {
	const button = document.querySelector(selector);
	if (!button) return;
	if (enabled) button.removeAttribute('disabled');
	else button.setAttribute('disabled', 'disabled');
}
