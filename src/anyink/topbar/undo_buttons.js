// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the top bar's Undo and Redo buttons, what they say and whether they can act
	(UX-BEGINNER.md 4.0 Top bar, principle 6: "Never grey out a control without a sentence saying
	why"). Pure.

	Undo can act when Simple's undo (history/simple_undo.js) has a step to take back: the newest
	entry that isn't looking around (a "Navigated to" step or the empty letter record All tools
	makes when a letter is opened; Simple passes over those in the same press and never names
	them). Its tooltip names that step in plain words: "Undo: traced Capital B". With nothing to
	take back it says "Nothing to undo yet". Redo the same over the Redo list: "Redo: traced
	Capital B" or "Nothing to redo".
	B6 fix: a step on a letter that isn't the one open (or with no letter open: the board) is
	named with its letter, in the toast's own words and by its rule (undo_toast.js
	letterToName): "Undo: added a rectangle on small r", since the press takes the view there.

	  nextUndoStep(queue)          { title, itemID } of the step Undo takes back, or null
	  nextRedoStep(redoQueue)      { title, itemID } of the step Redo puts back, or null
	  stepChange(step, project)    the step in plain words ("traced Capital B"); "your last
	                               change" for a title no rule knows
	  undoButtonsState(history, project, { openItemID })
	      { undo: { enabled, tip, change }, redo: { enabled, tip, change } }
	      openItemID: the item open in a letter view, false with none open (the board); left
	      out, no letter is named
	      pieceOpen: a sketch piece is open (default: sketch/tools/undo_gate.js isPieceOpen).
	      S2 (docs/SKETCH.md section 7): while it is, Undo is live with "Take back the last
	      point" and Redo greyed with "Finish the line first"; neither names a step
*/
import {
	indexOfPairedPre,
	isLookingAroundEntry,
	isWholeProjectPost,
	WHOLE_PROJECT_POST_TITLE,
} from '../history/history_helpers.js';
import { changeWords, letterToName } from '../history/undo_toast.js';
import { isPieceOpen } from '../sketch/tools/undo_gate.js';
import { word } from '../words/words.js';

/**
 * The title a step was recorded with: a whole-project step's is on its pre entry (the post
 * carries only upstream's internal marker, never a title anyone reads).
 * @param {Object} entry - the step's newest entry
 * @param {String} [preTitle] - the pre entry's title, for a whole-project post
 * @returns {String}
 */
function titleOf(entry, preTitle) {
	const title = isWholeProjectPost(entry) ? preTitle || '' : entry?.title || '';
	return title === WHOLE_PROJECT_POST_TITLE ? '' : title;
}

/**
 * @param {Array} queue - History.queue, newest first
 * @returns {{title: String, itemID: String | false} | null}
 */
export function nextUndoStep(queue = []) {
	const index = queue.findIndex((entry) => entry && !isLookingAroundEntry(entry));
	if (index < 0) return null;
	const entry = queue[index];
	const preIndex = indexOfPairedPre(queue, index);
	return {
		title: titleOf(entry, preIndex > -1 ? queue[preIndex].title : ''),
		itemID: entry.itemID || false,
	};
}

/**
 * @param {Array<Array>} redoQueue - History.redoQueue: each press's entries, newest first
 * @returns {{title: String, itemID: String | false} | null}
 */
export function nextRedoStep(redoQueue = []) {
	const entries = redoQueue[0];
	if (!Array.isArray(entries) || !entries.length) return null;
	const top = entries[0];
	const oldest = entries[entries.length - 1];
	const pre =
		isWholeProjectPost(top) && oldest?.wholeProjectSave && !isWholeProjectPost(oldest)
			? oldest.title
			: '';
	return { title: titleOf(top, pre), itemID: top.itemID || false };
}

/**
 * @param {{title: String, itemID: String | false}} step
 * @param {Object} [project]
 * @returns {String} plain words, never ''
 */
export function stepChange(step, project) {
	return changeWords(step?.title || '', step?.itemID || false, project);
}

/**
 * A button's tooltip: "Undo: {change}", or "Undo: {change} on {letter}" for a step on a letter
 * that isn't the one open.
 * @param {'undo' | 'redo'} kind
 * @param {{title: String, itemID: String | false}} step
 * @param {String} change - stepChange
 * @param {Object} [project]
 * @param {String | false | undefined} openItemID - undefined: unknown, no letter is named
 * @returns {String}
 */
function tipFor(kind, step, change, project, openItemID) {
	const elsewhere = openItemID !== undefined && step.itemID !== openItemID;
	const letter = letterToName(change, step.itemID, project, elsewhere);
	const key = kind === 'undo' ? 'topbar.undoTip' : 'topbar.redoTip';
	return letter ? word(`${key}On`, { change, letter }) : word(key, { change });
}

/**
 * @param {Object} history - History (queue, redoQueue)
 * @param {Object} [project]
 * @param {{openItemID?: String | false, pieceOpen?: Boolean}} [open] - the item open in a letter
 *   view (false: none); whether a sketch piece is open (default: the Undo gate says)
 * @returns {{undo: {enabled: Boolean, tip: String, change: String},
 *   redo: {enabled: Boolean, tip: String, change: String}}}
 */
export function undoButtonsState(history, project, { openItemID, pieceOpen = isPieceOpen() } = {}) {
	if (pieceOpen) {
		return {
			undo: { enabled: true, change: '', tip: word('sketch.undo.takeBack') },
			redo: { enabled: false, change: '', tip: word('sketch.undo.finishFirst') },
		};
	}
	const undoStep = nextUndoStep(history?.queue || []);
	const redoStep = nextRedoStep(history?.redoQueue || []);
	const undoChange = undoStep ? stepChange(undoStep, project) : '';
	const redoChange = redoStep ? stepChange(redoStep, project) : '';
	return {
		undo: {
			enabled: !!undoStep,
			change: undoChange,
			tip: undoStep
				? tipFor('undo', undoStep, undoChange, project, openItemID)
				: word('undo.nothing'),
		},
		redo: {
			enabled: !!redoStep,
			change: redoChange,
			tip: redoStep
				? tipFor('redo', redoStep, redoChange, project, openItemID)
				: word('undo.nothingToRedo'),
		},
	};
}
