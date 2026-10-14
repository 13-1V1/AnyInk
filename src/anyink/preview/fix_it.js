// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 interim [Fix it] for the font check line (until B3's refit and B11's checks): fixes what
	the font check found, on the letter it names, as one Undo step there.
	  - a width (ink with no width, or a width the font file can't hold): the letter gets a
	    whole-number width that gives its right side the same space as its left
	    (fittedWidth), so "bbb" no longer piles up. A letter whose spacing is automatic (B3)
	    is fitted instead (spacing/auto_space.js fitSpacing: whole points, its gap rule, the
	    photo moved with the shapes), and stays automatic
	  - a space with no width: the default letter width, so typed words don't run together
	  - stray shapes (fewer than 3 points and no curve): removed. They hold no ink, and the
	    font file can't hold them. Which shapes are stray is the font check's own rule
	    (validate.js isStrayShape), so the two never disagree. Stray shapes that sit inside a
	    letter this one is made from aren't this letter's to remove: no Fix it (canFixProblem).
	A point too far out, or a gap moved too far, has no safe fix; the line offers Show me and
	says what to do (font_status.js hintFor).
	Fix it acts only on a problem that is still there: the check line can be up to 2 s old, and
	he may have fixed it himself since.
	History records the letter that is open, so a letter that isn't open is opened first
	(show_item.js); the person sees the letter that changed.
*/
import { MAX_WIDTH, PROBLEM, isStrayShape, validateItem } from '../fontcheck/validate.js';
import { fitSpacing } from '../spacing/auto_space.js';
import { isAutomatic } from '../spacing/owner.js';
import { letterPhrase } from '../words/letter_name.js';
import { FIX_IT } from './font_status.js';
import { isItemOpen, showItem } from './show_item.js';

export { FIX_IT };

const FIXABLE = [PROBLEM.inkNoWidth, PROBLEM.width, PROBLEM.spaceNoWidth, PROBLEM.shape];
const LETTER_ID = /^(glyph|liga)-/;

/**
 * @param {String} problem - a font check problem kind (validate.js PROBLEM)
 * @returns {Boolean} true for the kinds Fix it knows how to fix
 */
export function canFix(problem) {
	return FIXABLE.includes(problem);
}

/**
 * True when [Fix it] would really fix this problem on this letter: its kind is one Fix it
 * knows, and stray shapes are the letter's own (not inside a letter it is made from).
 * @param {Object} project
 * @param {{itemId: String|null, problem: String|null}} problem - from the 'fontCheck' topic
 * @returns {Boolean}
 */
export function canFixProblem(project, problem) {
	if (!project || !canFix(problem?.problem)) return false;
	const itemId = problem.itemId;
	if (typeof itemId !== 'string' || !LETTER_ID.test(itemId)) return false;
	const item = project.getItem?.(itemId);
	if (!item) return false;
	if (problem.problem === PROBLEM.shape) return (item.shapes || []).some(isStrayShape);
	return true;
}

/**
 * A whole-number width for a letter: its ink plus, on the right, the same space it has on the
 * left. Ink that starts at or left of the left edge ends the letter at its ink; ink wholly
 * left of the edge gets a width as wide as the ink. A letter with no ink gets the default width.
 * @param {Object} item - Glyph
 * @param {Number} [defaultWidth] - project.defaultAdvanceWidth
 * @returns {Number} 0..65,535; above 0 whenever the letter has ink
 */
export function fittedWidth(item, defaultWidth = 0) {
	const ink = inkExtent(item);
	if (!ink) return clamp(Math.round(Number(defaultWidth) || 0), 0, MAX_WIDTH);
	const left = Math.max(0, Math.round(ink.xMin));
	const right = Math.round(ink.xMax);
	const inkWidth = Math.round(ink.xMax - ink.xMin);
	const width = right > 0 ? right + left : inkWidth;
	return clamp(width, 1, MAX_WIDTH);
}

/**
 * Left and right edges of the letter's ink: every shape but stray ones.
 * @param {Object} item - Glyph
 * @returns {{xMin: Number, xMax: Number}|null} null when there is no ink
 */
function inkExtent(item) {
	let xMin = Infinity;
	let xMax = -Infinity;
	inkShapes(item).forEach((shape) => {
		const maxes = shape.maxes;
		if (Number.isFinite(maxes?.xMin)) xMin = Math.min(xMin, maxes.xMin);
		if (Number.isFinite(maxes?.xMax)) xMax = Math.max(xMax, maxes.xMax);
	});
	return xMin <= xMax ? { xMin, xMax } : null;
}

/**
 * Fixes one font check problem on its letter, as one Undo step.
 * @param {Object} editor - ProjectEditor
 * @param {{itemId: String|null, problem: String}} problem - from the 'fontCheck' topic
 * @returns {Boolean} true when the letter was changed
 */
export function fixProblem(editor, problem) {
	if (!editor || !canFixProblem(editor.project, problem)) return false;
	const itemId = problem.itemId;
	const target = editor.project.getItem(itemId);
	// The line may be up to 2 s old: act only on a problem that is still there
	if (!validateItem(target).some((found) => found.problem === problem.problem)) return false;
	// As it is now: opening a letter can change it (the Characters page's selection handler
	// gives a one-shape letter with no width a width, with no Undo step), and the step this
	// records must cover that too.
	const widthBefore = Number(target.advanceWidth);
	const shapesBefore = target.shapes.length;
	if (!isItemOpen(editor, itemId) && !showItem(editor, itemId)) return false;

	const item = editor.selectedItem;
	if (!item || item.id !== itemId) return false;
	const name = letterPhrase(item.chars) || 'this letter';

	let title = '';
	if (problem.problem === PROBLEM.shape) {
		const stray = item.shapes.filter(isStrayShape);
		stray.forEach((shape) => item.shapes.splice(item.shapes.indexOf(shape), 1));
		if (stray.length) {
			item.changed?.();
			editor.multiSelect?.points?.clear?.();
			editor.multiSelect?.shapes?.clear?.();
		}
		const removed = shapesBefore - item.shapes.length;
		if (removed < 1) return false;
		title =
			removed === 1
				? `removed a stray shape from ${name}`
				: `removed ${removed} stray shapes from ${name}`;
	} else {
		// B3: an automatic letter gets its fitted spacing, so the fix is one ANY-INK would make
		const fitted = isAutomatic(item) && fitSpacing(item, editor.project).changed;
		if (!fitted) item.advanceWidth = fittedWidth(item, editor.project.defaultAdvanceWidth);
		if (!fitted && Number(item.advanceWidth) === widthBefore) return false;
		const hadWidth = Number.isFinite(widthBefore) && Math.round(widthBefore) !== 0;
		title = hadWidth ? `fixed the width of ${name}` : `gave ${name} a width`;
	}

	editor.history.addState(title);
	editor.publish('currentItem', item);
	return true;
}

/** @returns {Array<Object>} the shapes that hold ink (not stray) */
function inkShapes(item) {
	return (item?.shapes || []).filter(
		(shape) =>
			shape?.objType === 'ComponentInstance' ||
			(Array.isArray(shape?.pathPoints) && shape.pathPoints.length > 0 && !isStrayShape(shape))
	);
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
