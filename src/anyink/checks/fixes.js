// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: the one-click fixes (UX-BEGINNER.md 4.2, 4.3, 7.2, 7.3, 7.7, section 10 B11). A check
	(checks.js, the checks track) says { id, reason, fix }; a fix button runs applyFix with that
	fix, and the letter changes in one Undo step with a plain title. Nothing changes when there
	is nothing to fix: no step, no toast.

	  FIX                    the fix ids (checks.js's): fitSpacing, sitOnLine, matchSize,
	                         removeSpecks, shrinkToFit, fixIt, moveLine
	  fixIdOf(fix)           a check's fix as an id: a FIX id, { id } or { fix }; null when
	                         unknown
	  fixLabel(fix, vars)    the button's words ("Remove 3 specks": vars.count, or fix.count)
	  applyFix(editor, itemId, fix, options)    runs one fix on one letter
	    -> { done, fix, title, itemId, flipped } (flipped: other letters that need a look now
	       and didn't; Simple says so in a toast, fix_step.js)
	    options.needsALook   (item, { char, editor }) => truthy: the checks' "needs a look"
	                         (default: fix_step.js useNeedsALook)
	    options.showMe       (ids) => ...: what a toast's [Show me] does (default: opens the
	                         first letter)
	    options.include      moveLine only: which letters count for the line's median
	                         (default: every letter with ink on that line)
	  The fixes, each one Undo step about that letter (fix_step.js recordLetterStep), also
	  exported on their own as (editor, itemId, options):
	    fitSpacing    [Fit spacing]: the letter's spacing becomes automatic and is fitted (B3)
	    sitOnLine     [Sit on the line]: shapes and photo move up or down together until the
	                  body bottom sits where its class does (the writing line; 1.5 % of the
	                  letter box under it for o c e s O C G Q S)
	    matchSize     [Match size]: shapes and photo scale together, from the body bottom and the
	                  left ink edge, until the body is as tall as its line asks; seated too
	    removeSpecks  [Remove N specks]: the specks' shapes go (fix_shapes.js speckPieces)
	    shrinkToFit   [Shrink to fit]: shapes and photo scale down together, from the writing
	                  line and the left ink edge, until nothing pokes past the top or tail line
	    fixIt         [Fix it] (the font file can't hold the letter, B1): rounds and refits it
	  moveLine is a whole-font step (fit_lines_to_writing.js fitLineToWriting: the line of the
	  letter, or fix.line). When the median of his letters on that line is where the line is
	  already (only a few of them are off), or the line can't go there (past the letter box, or
	  pushing another line past letters that fit it: lineCanMoveTo), the line doesn't move, so
	  the letter pressed gets Match size instead: a fix button never does nothing (principle 6),
	  and the step says what it did ("resized small a to fit its line").
	  After a fix that moves or scales shapes, an automatic letter is fitted again in the same
	  step: in Simple by the spacing hook (spacing/history_hook.js), which keeps the ink still
	  on screen (4.3 "the drawing never jumps"), elsewhere here. A letter whose spacing he set
	  keeps its left and right space. Every point and width written is a whole number (7.2).
	  runFixAction(args, { editor })   the Next line's 'fixLetter' action (coach/actions.js
	                         setCoachAction): args { char | itemId, fix | check, ...the check's
	                         args } (coach rule 7 passes { char, check, ...look.args }, and
	                         checks.js's args hold { fix, line, count, way }). Simple with the
	                         'checks' flag only. Every press runs the font check at once
	                         (font_check.js runFontCheckNow, as the coach's fixFontProblem
	                         does): the checks read its last problems, so the [Fix it] it named
	                         is gone the moment the letter is fixed, and a [Fix it] it hadn't
	                         caught up with yet (2 s after a change) goes with the press too
*/
import { charToHex } from '../../common/character_ids.js';
import { runFontCheckNow } from '../fontcheck/font_check.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { fitSpacing as fitLetterSpacing, sitsAtFit } from '../spacing/auto_space.js';
import { inkBounds } from '../spacing/measure.js';
import { isAutomatic, markAuto } from '../spacing/owner.js';
import { fontSlant } from '../spacing/slant.js';
import { whole } from '../spacing/round.js';
import { word } from '../words/words.js';
import { TRACE_AGAIN_EVENT } from '../letter/letter_card.js';
import { FIX, spacingSlantOf } from './checks.js';
import { fitLineToWriting } from './fit_lines_to_writing.js';
import {
	applyPlan,
	fontFileFix,
	removeSpeckShapes,
	seatPlan,
	shrinkPlan,
	sizePlan,
	speckShapeGroups,
} from './fix_shapes.js';
import { nameOf, recordLetterStep } from './fix_step.js';

/** The fix ids: the checks' own list (checks.js FIX), so a check never names a fix that isn't here */
export { FIX };

/**
 * @param {String | {id?: String, fix?: String} | null} fix
 * @returns {String | null} a FIX id
 */
export function fixIdOf(fix) {
	const id = typeof fix === 'string' ? fix : fix?.id || fix?.fix;
	return typeof id === 'string' && Object.hasOwn(FIX, id) ? id : null;
}

/**
 * @param {String | Object} fix
 * @param {{count?: Number}} [vars]
 * @returns {String} '' for an unknown fix
 */
export function fixLabel(fix, vars = {}) {
	const id = fixIdOf(fix);
	if (!id) return '';
	const count = Number(vars.count ?? (typeof fix === 'object' ? fix?.count : undefined)) || 0;
	return word(`fixes.button.${id}`, { count });
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} itemId - 'glyph-0x61'
 * @param {String | Object} fix - from a check's { fix }
 * @param {Object} [options] - needsALook, showMe, include
 * @returns {{done: Boolean, fix: String | null, title: String, itemId: String,
 *   flipped: Array<String>}}
 */
export function applyFix(editor, itemId, fix, options = {}) {
	const id = fixIdOf(fix);
	const none = { done: false, fix: id, title: '', itemId, flipped: [] };
	if (!id || !editor?.project) return none;
	if (id === FIX.moveLine) {
		const line = typeof fix === 'object' && fix?.line ? fix.line : itemId;
		const moved = fitLineToWriting(editor, line, options);
		if (!moved.done) return matchSize(editor, itemId, options);
		return { done: true, fix: id, title: moved.title, itemId, flipped: moved.flipped };
	}
	return FIXES[id](editor, itemId, options);
}

/**
 * The Next line's [Fit spacing] etc. (coach rule 7 passes { char, check, ...look.args }).
 * @param {Object} args - { char | itemId, fix | check }
 * @param {{editor?: Object}} [context]
 * @returns {Boolean} true when the letter changed
 */
export function runFixAction(args, { editor = null } = {}) {
	if (!isSimpleMode() || !isFeatureOn('checks') || !editor) return false;
	const hex = typeof args?.char === 'string' ? charToHex(args.char) : false;
	const itemId = args?.itemId || (hex ? `glyph-${hex}` : null);
	const id = fixIdOf(args?.fix) || fixIdOf(args?.check);
	if (!itemId || !id) return false;
	// The check's args ride along: moveLine's line, the specks' count
	const done = applyFix(editor, itemId, { ...args, id }).done;
	// The font check again now, not 2 s from now, as the coach's fixFontProblem does: the
	// checks read its last problems, so a [Fix it] it named would stay, green and dead
	runFontCheckNow(editor);
	return done;
}

// --------------------------------------------------------------
// The fixes
// --------------------------------------------------------------

/** [Fit spacing] */
export function fitSpacing(editor, itemId, options = {}) {
	return letterFix(editor, itemId, FIX.fitSpacing, {}, options, (item, project) => {
		if (!inkBounds(item)) return false;
		const owner = markAuto(item);
		// Simple: the spacing hook fits it inside the step, keeping the ink still on screen
		if (isSimpleMode()) return owner || !sitsAtFit(item, project);
		return fitLetterSpacing(item, project).changed || owner;
	});
}

/** [Sit on the line] */
export function sitOnLine(editor, itemId, options = {}) {
	return letterFix(editor, itemId, FIX.sitOnLine, {}, options, (item, project) =>
		reshape(item, project, seatPlan(item, project.settings.font, slantOf(item, project)))
	);
}

/** [Match size] */
export function matchSize(editor, itemId, options = {}) {
	return letterFix(editor, itemId, FIX.matchSize, {}, options, (item, project) =>
		reshape(item, project, sizePlan(item, project.settings.font, slantOf(item, project)))
	);
}

/** [Remove N specks] */
export function removeSpecks(editor, itemId, options = {}) {
	const item = letterOf(editor, itemId);
	const count = item ? speckShapeGroups(item).length : 0;
	return letterFix(editor, itemId, FIX.removeSpecks, { count }, options, (letter, project) => {
		const ink = inkBounds(letter);
		if (!removeSpeckShapes(letter)) return false;
		refitOrKeep(letter, project, ink);
		return true;
	});
}

/** [Shrink to fit] */
export function shrinkToFit(editor, itemId, options = {}) {
	return letterFix(editor, itemId, FIX.shrinkToFit, {}, options, (item, project) =>
		reshape(item, project, shrinkPlan(item, project.settings.font))
	);
}

/** [Fix it]: rounds and refits the letter (the font file can't hold it as it is) */
export function fixIt(editor, itemId, options = {}) {
	return letterFix(editor, itemId, FIX.fixIt, {}, options, (item, project) =>
		fontFileFix(item, project, { fit: !isSimpleMode() })
	);
}

/**
 * B16 [Draw a box] (a letter that may be two touching letters): the photo dialog on the letter,
 * as the card's [Trace again] opens it (letter_card.js TRACE_AGAIN_EVENT); no step of its own
 */
export function drawBox(editor, itemId) {
	const none = { done: false, fix: FIX.drawBox, title: '', itemId, flipped: [] };
	if (!editor?.project || !itemId) return none;
	globalThis.dispatchEvent?.(new CustomEvent(TRACE_AGAIN_EVENT, { detail: { itemId } }));
	return none;
}

const FIXES = Object.freeze({
	fitSpacing,
	sitOnLine,
	matchSize,
	removeSpecks,
	shrinkToFit,
	fixIt,
	drawBox,
});

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/**
 * One fix on one letter as one step titled fixes.step.<id>.
 * @returns {{done: Boolean, fix: String, title: String, itemId: String, flipped: Array<String>}}
 */
function letterFix(editor, itemId, id, vars, options, change) {
	const item = letterOf(editor, itemId);
	if (!item) return { done: false, fix: id, title: '', itemId, flipped: [] };
	const title = word(`fixes.step.${id}`, { letter: nameOf(item), ...vars });
	const step = recordLetterStep(
		editor,
		itemId,
		title,
		(letter) => change(letter, editor.project),
		options
	);
	return { ...step, fix: id };
}

/**
 * Moves or scales the letter through a plan, then keeps its spacing right.
 * @returns {Boolean} true when it changed
 */
function reshape(item, project, plan) {
	if (!plan) return false;
	const ink = inkBounds(item);
	if (!applyPlan(item, plan)) return false;
	refitOrKeep(item, project, ink);
	return true;
}

/**
 * An automatic letter is fitted again; one whose spacing he set keeps its left space (the
 * shapes kept their left ink edge) and its right space.
 * @param {Object} item
 * @param {Object} project
 * @param {{xMax: Number} | null} inkBefore
 */
function refitOrKeep(item, project, inkBefore) {
	if (isAutomatic(item)) {
		// Simple: the spacing hook fits it inside the step, keeping the ink still on screen
		if (!isSimpleMode()) fitLetterSpacing(item, project);
		return;
	}
	const inkAfter = inkBounds(item);
	const width = Number(item.advanceWidth);
	if (!inkBefore || !inkAfter || !Number.isFinite(width) || width <= 0) return;
	item.advanceWidth = Math.max(1, whole(width + inkAfter.xMax - inkBefore.xMax));
}

/** The slant the checks measure the letter in (a y's joint reads it): { slant } */
function slantOf(item, project) {
	return { slant: spacingSlantOf(item, fontSlant(project)) };
}

function letterOf(editor, itemId) {
	if (typeof itemId !== 'string') return null;
	return editor?.project?.glyphs?.[itemId] || editor?.project?.ligatures?.[itemId] || null;
}
