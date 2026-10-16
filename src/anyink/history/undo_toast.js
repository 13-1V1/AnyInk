// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the undo and redo toasts (UX-BEGINNER.md 4.0 Toasts and Top bar, 7.3, principle 6). Every
	Undo and Redo press in Simple is named, in house words through historyText:
	  in a letter view          "Undid: traced Capital B" [Redo]
	  the view moved to another letter, and the change doesn't name it
	                            "Undid: added a rectangle on small r" [Redo]
	  on the board (Help, About: the view stays, B2's showMe)
	                            "Undid: traced small r" [Show me]
	  Redo                      "Redid: traced Capital B" ([Show me] on the board)
	A press that changed nothing says nothing (B2). Kind 'undo', the highest (4.0), in one group, so
	a quick second press takes the first one's place at once.
	B6 fix: each press's toast is good only while it speaks for the newest change (toast.js
	stillGood): an Undo toast while the step it took back is still first on the Redo list (so its
	[Redo] puts back exactly that step), a Redo toast while the step it put back is still the
	newest change; both only while its font is the one open. A new change empties the Redo list,
	so the toast is over: its button does nothing (toast.js), a toast that is over keeps no place
	in the toast queue (queue.js add), so "Cleared small b. [Undo]" after Ctrl+Z shows at once,
	and it goes at the step itself (B6 + B7 finalize: every step sends the save status event, and
	this module answers it with toast.js dropStaleToasts), never staying up with a dead button.
	Two presses that read the same each draw their own toast (toast.js), so the [Redo] on screen
	is always the newest press's.
	With the 'coach' flag off (B6 not on), B5's toast stays exactly as it was
	(undo_elsewhere.js: only a letter changed away from its page is said).
	S2 (docs/SKETCH.md section 7): every press here reaches simple_undo.js, which asks the sketch's
	Undo gate first, so while a sketch piece is open the top bar's Undo takes back its last click
	and Redo (the bar's, a toast's [Redo]) does nothing, with no toast. A destructive toast's [Undo] is for
	an older step: it runs with the open piece held aside, then the piece is finished as its own
	step (undo_gate.js underOpenPiece). A finished piece is named by its own title ("Undid:
	sketched a line on small n").

	  changeWords(title, itemID, project)   the step in plain words ("traced Capital B"); "your
	                                         last change" for a title no rule knows
	  charsOfItem(project, itemID)           the letter a step is about ('B'), or ''
	  letterToName(change, itemID, project, elsewhere)
	                                         the letter to add ("small r"), or '': only when the
	                                         letter isn't the one in front of him and the change
	                                         doesn't name it already. The toasts and the top bar's
	                                         Undo / Redo tooltips both say it this way
	  undoToastWords(result, { redo, project })
	      -> { key, vars, button: 'redo' | 'showMe' | null } | null   (pure: the toast text map)
	  sayUndone(result, editor, { redo })    shows it; once per result (history.js and the top
	                                         bar's buttons may both say a press)
	  stillGoodAfterPress(editor, { redo })  () => Boolean, made right after a press: the
	                                         toast's stillGood (see above)
	  undoOffer(editor)                      { action, stillGood } for a destructive toast made
	                                         right after its step ("Cleared small b. [Undo]"): its
	                                         [Undo] takes back that step, and only while it is
	                                         still the newest change in this font (B6 + B7
	                                         finalize); the toast goes at the next step
	  pressUndo(editor) / pressRedo(editor)  the top bar's buttons and the toast's [Redo]: the
	                                         press (with the landing rule's cause, band.js), then
	                                         its toast; returns simple_undo's result, or
	                                         { done: false } when nothing was done
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { isFeatureOn } from '../mode/features.js';
import { withLandingCause } from '../mode/band.js';
import { showItem } from '../preview/show_item.js';
import { dropStaleToasts, toast } from '../toast/toast.js';
import { historyText } from '../words/history_text.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { underOpenPiece } from '../sketch/tools/undo_gate.js';
import { sayUndoneElsewhere } from './undo_elsewhere.js';

/** Results already said: one press, one toast. */
const said = new WeakSet();

/**
 * @param {Object} project
 * @param {String | false} itemID - 'glyph-0x42'
 * @returns {String} its characters ('B'), or ''
 */
export function charsOfItem(project, itemID) {
	if (!itemID) return '';
	const item = typeof project?.getItem === 'function' ? project.getItem(itemID) : null;
	if (item?.chars) return item.chars;
	// a letter whose record is gone (an Undo of its making) is still named by its id
	const hex = /^glyph-0x([0-9a-f]+)$/i.exec(String(itemID));
	return hex ? String.fromCodePoint(parseInt(hex[1], 16)) : '';
}

/**
 * @param {String} title - as History recorded it
 * @param {String | false} itemID
 * @param {Object} [project]
 * @returns {String} plain words, never ''
 */
export function changeWords(title, itemID, project) {
	const chars = charsOfItem(project, itemID);
	const context = chars ? { chars, project } : { project };
	return historyText(title || '', context) || word('history.unknown');
}

/**
 * The letter to name after the change ("added a rectangle on small r"), the one rule the toasts
 * and the top bar's tooltips share: only for a step on a letter that isn't the one in front of
 * him, and never twice ("traced small r" already names it).
 * @param {String} change - changeWords
 * @param {String | false} itemID - the step's item
 * @param {Object} [project]
 * @param {Boolean} elsewhere - the letter isn't the one open (or no letter is open)
 * @returns {String} 'small r', or ''
 */
export function letterToName(change, itemID, project, elsewhere) {
	if (!elsewhere || !itemID) return '';
	const letter = letterPhrase(charsOfItem(project, itemID));
	return letter && !String(change).includes(letter) ? letter : '';
}

/**
 * The toast text map.
 * @param {{done: Boolean, title: String, itemID: String | false, moved: Boolean,
 *   showMe: {itemID: String, page: String} | null} | null} result - simple_undo.js
 * @param {{redo?: Boolean, project?: Object}} [options]
 * @returns {{key: String, vars: Object, button: 'redo' | 'showMe' | null} | null}
 */
export function undoToastWords(result, { redo = false, project } = {}) {
	if (!result?.done) return null;
	const change = changeWords(result.title, result.itemID, project);
	const elsewhere = !!result.showMe || !!result.moved;
	const letter = letterToName(change, result.itemID, project, elsewhere);
	const nameIt = !!letter;
	const base = redo ? 'undo.redid' : 'undo.undid';
	let button = null;
	if (result.showMe) button = 'showMe';
	else if (!redo) button = 'redo';
	return {
		key: nameIt ? `${base}On` : base,
		vars: nameIt ? { change, letter } : { change },
		button,
	};
}

/**
 * @returns {Object | null} the editor of the font that is open
 */
function openEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/**
 * How long a press's toast is good, made right after the press: an Undo toast while the step it
 * took back is still first on the Redo list (its [Redo] puts back exactly that), a Redo toast
 * while the step it put back is still the newest change; both only while its font is open. A new
 * change empties the Redo list (and puts a newer step on top), another Undo or Redo moves them.
 * @param {Object} editor - ProjectEditor
 * @param {{redo?: Boolean}} [options]
 * @returns {() => Boolean}
 */
export function stillGoodAfterPress(editor, { redo = false } = {}) {
	const history = editor?.history;
	const list = redo ? history?.queue : history?.redoQueue;
	const mark = Array.isArray(list) ? list[0] : undefined;
	if (!mark) return () => false;
	return () => {
		if (openEditor() !== editor || editor.history !== history) return false;
		return (redo ? history.queue : history.redoQueue)?.[0] === mark;
	};
}

let listening = false;

/** Every step, Undo and Redo sends the save status event: a toast that is over goes then. */
function listenForSteps() {
	if (listening || typeof globalThis.addEventListener !== 'function') return;
	listening = true;
	globalThis.addEventListener(SAVE_STATUS_EVENT, () => dropStaleToasts());
}

/**
 * B6 + B7 finalize: the [Undo] of a destructive toast (Clear letter, Delete), made right after
 * its step: it takes back that step and nothing else, so once a newer change is made it does
 * nothing, and the toast goes at that change (listenForSteps).
 * @param {Object} editor - ProjectEditor
 * @returns {{action: {key: String, run: Function}, stillGood: () => Boolean}}
 */
export function undoOffer(editor) {
	listenForSteps();
	const history = editor?.history;
	const mark = Array.isArray(history?.queue) ? history.queue[0] : undefined;
	const stillGood = () =>
		!!mark && openEditor() === editor && editor.history === history && history.queue[0] === mark;
	// an older step: with a sketch piece open, the piece waits aside, then is its own step
	const run = () => underOpenPiece(() => pressUndo(editor));
	return { action: { key: 'letter.toast.undo', run }, stillGood };
}

/**
 * Shows the toast for one press.
 * @param {Object | null | undefined} result - simple_undo.js undoNewest / redoNewest
 * @param {Object} editor - ProjectEditor
 * @param {{redo?: Boolean}} [options]
 * @returns {Boolean} true when a toast was asked for
 */
export function sayUndone(result, editor, { redo = false } = {}) {
	if (!result?.done || typeof result !== 'object' || said.has(result)) return false;
	said.add(result);
	if (!isFeatureOn('coach')) {
		sayUndoneElsewhere(result, editor, { redo });
		return true;
	}
	const words = undoToastWords(result, { redo, project: editor?.project });
	if (!words) return false;
	listenForSteps();
	toast(words.key, words.vars, {
		kind: 'undo',
		group: 'undo',
		action: buttonFor(words, result, editor),
		stillGood: stillGoodAfterPress(editor, { redo }),
	});
	return true;
}

/**
 * @param {{button: String | null}} words
 * @param {Object} result
 * @param {Object} editor
 * @returns {{key: String, run: Function} | undefined}
 */
function buttonFor(words, result, editor) {
	if (words.button === 'redo') return { key: 'topbar.redo', run: () => pressRedo(editor) };
	if (words.button === 'showMe') {
		const { itemID } = result.showMe;
		return { key: 'check.showMe', run: () => showItem(editor, itemID) };
	}
	return undefined;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {'undo' | 'redo'} kind
 * @returns {Object} the press's result, { done: false } when nothing was done
 */
function press(editor, kind) {
	const history = editor?.history;
	if (!history) return { done: false };
	const result = withLandingCause(kind, () =>
		kind === 'undo' ? history.restoreState() : history.redoState()
	);
	sayUndone(result, editor, { redo: kind === 'redo' });
	return result && typeof result === 'object' ? result : { done: false };
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Object} simple_undo.js's result
 */
export function pressUndo(editor) {
	return press(editor, 'undo');
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Object} simple_undo.js's result
 */
export function pressRedo(editor) {
	return press(editor, 'redo');
}
