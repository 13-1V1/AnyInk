// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 fixes, the shapes part (UX-BEGINNER.md 4.2, 7.2, section 10 B11). Pure: no editor, no
	Undo step, no topics. fixes.js turns each into one Undo step; fit_lines_to_writing.js reads
	the body measures. Font units, y-up, the writing line at 0; the five lines come from
	placement/classes.js (guideLines, lineTargets), so a fixed letter lands where the photo
	flow would have put it. A letter is measured the way the checks measure it (checks.js
	measureLetter: its body leaves out specks and the marks above it, its line is the one its
	size is judged by), so a fix clears the very check that offered it.

	  bodyBottom(item, font, { slant })   what belongs on the writing line: checks.js's lineAt,
	                               the very height the check judges (B10 + B11 finalize: the bowl
	                               of g p q Q, the joint of y, the head of , ;, a short-tailed j's
	                               top; the half-width row this file read before sank a y). null
	                               with no ink
	  seatPlan(item, font, { slant })   Sit on the line: the move that puts it where its class
	                               sits (the writing line; 1.5 % under it when round). S3: a
	                               Centerline sketch whose top is near its line gets Match size's
	                               plan instead, so the move never pushes its top past the line
	  sizePlan(item, font, { slant })   Match size: the scale that makes the body as tall as its
	                               line (checks.js's line, round letters' overshoot included),
	                               from the body bottom and the left ink edge, seated on the line
	                               too (a tail letter by its bowl or joint, B10 + B11 finalize)
	  shrinkPlan(item, font)       Shrink to fit: the scale, from the writing line and the left
	                               ink edge, that brings ink poking past the top line or the tail
	                               line back onto it (specks don't count, as in the check)
	  applyPlan(item, plan)        moves and scales the letter's own shapes and its photo
	                               through a plan, every point and handle in use rounded to whole
	                               units (handles not in use keep their distance from their
	                               point). The width is the caller's (spacing refits it)
	  speckShapeGroups(item)       the letter's own shapes of each speck (one list per speck): the
	                               specks are checks.js speckPieces, so Remove N specks takes out
	                               exactly the N the check counted
	  removeSpeckShapes(item)      takes the specks' shapes out; returns how many specks went
	  fontFileFix(item, project)   Fix it: stray shapes out (the font check's rule), every point
	                               whole, the space a quarter of the letter box when it has no
	                               width, and the spacing refit: an automatic letter fitted, a
	                               letter whose width the font file can't hold made automatic and
	                               fitted, any other width rounded (options.fit false: the
	                               automatic letter's fit is left to Simple's spacing hook)
	A plan is { k, ox, oy, dx, dy, grow }: x' = ox + (x - ox) * k + dx, y' = oy + (y - oy) * k + dy,
	then (B16, Match size) every outline pushed `grow` font units away from its ink, so a scaled
	letter keeps the width of the pen that wrote it (keep_weight.js; the photo follows the map).
	Match size's k and grow land the body on its line at the same stroke (weightPlan).
	Components inside a letter are left as they are (they are another letter's shapes).

	S3 (docs/SKETCH.md section 7): a sketched letter. applyPlan hands the same plan to the sketch
	(sketch/follow.js followShapes, the matrix of { k, ox, oy, dx, dy } and the grow), so the
	sketch moves with its ink inside the fix's step and is never set aside. A letter whose own ink
	is all Centerline sketch (keep_weight.js sketchStroke) has one thickness that never scales:
	Match size keeps it by weightPlan with that thickness as the stroke, and Shrink to fit
	shrinks its center line from the writing line's ink line (half the thickness up) with the
	same push, so the rebuilt ink lands where the plan said. Remove specks never takes a sketched
	shape (a sketched dot is never a speck).
*/
import { guideLines, lineTargets } from '../placement/classes.js';
import { fitSpacing, sitsAtFit } from '../spacing/auto_space.js';
import { inkBounds } from '../spacing/measure.js';
import { inkPaths, isStrayPath, pathContour } from '../spacing/outline.js';
import { isAutomatic, markAuto } from '../spacing/owner.js';
import { roundItemPoints, roundWidth, whole } from '../spacing/round.js';
import { getTrace, setTrace } from '../trace/trace_model.js';
import { followShapes } from '../sketch/follow.js';
import { fromFixPlan } from '../sketch/follow_matrix.js';
import { isBuiltShape } from '../sketch/sketch_record.js';
import { LINE_SHARE, measureLetter, speckPieces } from './checks.js';
import { topOffBy } from './sketch_top.js';
import { sketchStroke, thickenShapes, weightPlan } from './keep_weight.js';

/** The widest width the font file holds (fontcheck/validate.js MAX_WIDTH; a test keeps them equal) */
export const MAX_WIDTH = 65535;
/** The space and the no-break space */
const SPACES = new Set([' ', ' ']);

// --------------------------------------------------------------
// Measures
// --------------------------------------------------------------

/**
 * @param {Object} item - Glyph
 * @returns {String} its one character, or '' (joined letters, or none)
 */
export function charOf(item) {
	const chars = typeof item?.chars === 'string' ? [...item.chars] : [];
	return chars.length === 1 ? chars[0] : '';
}

/**
 * B10 + B11 finalize: the checks' own lineAt (checks.js measureLetter), for every letter: the
 * bowl of g p q Q, the joint of y, the head of , ;, a j's top when its tail is short. The rules
 * here used to be their own (a half-width row), which seats a y half way up its V: the critic's
 * lifted y sank under the line and read Ready, and a y written as a u with a tail moved the wrong
 * way and then could not move.
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {{slant?: Number}} [options] - the slant the letter's edges are measured in (checks.js
 *   spacingSlantOf), which the y's joint reads
 * @returns {Number | null} font units; null with no ink
 */
export function bodyBottom(item, font, { slant = 0 } = {}) {
	const measures = measureLetter(item, font, { slant });
	return measures ? seatLine(measures) : null;
}

/**
 * B10 + B11 finalize: what the fixes put on the writing line. A Brush letter's is the line the
 * pen drew (its center, checks.js penBottom), so a fixed Brush letter sits where one drawn to
 * the line does, its round end half a nib under it; that clears both ways of the check (it
 * floats by its ink, sinks by its pen line). Every other letter's is lineAt.
 * @param {Object} measures - checks.js measureLetter
 * @returns {Number}
 */
function seatLine(measures) {
	const { tail, markBelow, penBottom, body } = measures;
	if (!tail && !markBelow && Number.isFinite(penBottom) && penBottom > body.bottom) {
		return penBottom;
	}
	return measures.lineAt;
}

// --------------------------------------------------------------
// Plans
// --------------------------------------------------------------

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {{k: Number, ox: Number, oy: Number, dx: Number, dy: Number} | null} null when the
 *   body already sits where its class does (to the unit), or the letter has no ink or isn't
 *   seated by its bottom (the apostrophe, the hyphen, brackets)
 */
export function seatPlan(item, font, { slant = 0 } = {}) {
	const target = lineTargets(charOf(item), font);
	const measures = measureLetter(item, font, { slant });
	if (target.seat !== 'bottom' || !measures) return null;
	const dy = whole(target.bottom - seatLine(measures));
	if (!dy) return null;
	// S3 follow fix: a Centerline sketch whose top is near its line keeps it there (scaled
	// between the lines at its own thickness, sizePlan) rather than pushed past it by the move
	if (keepsTop(item, font, measures, dy)) return sizePlan(item, font, { slant }) || null;
	return { k: 1, ox: 0, oy: 0, dx: 0, dy };
}

/**
 * S3 follow fix (the critic's B: a stem sketched just inside both lines, -52..1530 at 160,
 * moved up 52 to stand 102 units over the capitals line): Sit on the line on a letter whose ink
 * is all Centerline sketch, with no tail, whose body top is off its line (sketch_top.js
 * topLine) by no more than the bottom is off the writing line plus LINE_SHARE of the letter box,
 * when the move would leave the top further from its line than it was and by more than that
 * share. The edge rule puts both ends on lines; the move alone keeps only one.
 * @returns {Boolean}
 */
function keepsTop(item, font, measures, dy) {
	if (measures.tail || sketchStroke(item, font) === null) return false;
	const lines = guideLines(font);
	const off = topOffBy(measures, lines);
	if (off === null) return false;
	const share = LINE_SHARE * lines.box;
	const before = Math.abs(off);
	const after = Math.abs(off + dy);
	return before <= Math.abs(dy) + share && after > share && after > before;
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {{k: Number, ox: Number, oy: Number, dx: Number, dy: Number} | null} null when it
 *   is the size its line says already, or has no ink or no line to be sized by
 */
export function sizePlan(item, font, { slant = 0 } = {}) {
	const measures = measureLetter(item, font, { slant });
	if (!measures?.line) return null;
	const { body, ink, line } = measures;
	const height = body.top - body.bottom;
	if (!(height > 0) || !(line.height > 0)) return null;
	// B16: the letter changes size, never its pen (keep_weight.js): scaled by k, then pushed out
	// by what the scale took off its stroke, so the body lands on its line at the same width
	// S3: a Centerline sketch's stroke is its thickness, which never scales
	const sketched = sketchStroke(item, font);
	const stroke = sketched ?? measures.stroke;
	const { k, grow } = weightPlan({ height, line: line.height, stroke, exact: sketched !== null });
	const target = lineTargets(charOf(item), font);
	// B10 + B11 finalize: a tail letter's body is seated too (its bowl or joint), so Match size
	// never leaves a lifted g floating
	const seated = target.seat === 'bottom' ? target.bottom : body.bottom;
	// B10 + B11 finalize: what belongs on the line is lineAt (a Brush letter's pen line, half a
	// nib over its ink: the same nib after the scale, penAllowance reads the stroke's own)
	const above = seatLine(measures) - body.bottom;
	// the push moves the bottom and the left edge out by grow: the move takes it back
	const dy = seated - body.bottom - (target.seat === 'bottom' ? above : 0) + grow;
	if (Math.abs(k - 1) < 1e-6 && Math.abs(dy) < 0.5) return null;
	return { k, ox: ink.xMin, oy: body.bottom, dx: grow, dy, grow };
}

/**
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @returns {{k: Number, ox: Number, oy: Number, dx: Number, dy: Number} | null} null when
 *   nothing pokes past the top or tail line
 */
export function shrinkPlan(item, font) {
	const ink = measureLetter(item, font)?.ink;
	if (!ink) return null;
	const lines = guideLines(font);
	// S3: a Centerline sketch keeps its thickness; its center line shrinks from the writing
	// line's ink line, and the ink is pushed back out by what the scale took (as Match size)
	const r = (sketchStroke(item, font) ?? 0) / 2;
	let k = 1;
	if (ink.yMax > lines.top && ink.yMax > 0) {
		k = Math.min(
			k,
			r && ink.yMax > 2 * r ? (lines.top - 2 * r) / (ink.yMax - 2 * r) : lines.top / ink.yMax
		);
	}
	if (ink.yMin < lines.tail && ink.yMin < 0) k = Math.min(k, lines.tail / ink.yMin);
	if (!(k > 0) || k >= 1) return null;
	if (!r) return { k, ox: ink.xMin, oy: 0, dx: 0, dy: 0 };
	const grow = (1 - k) * r;
	return { k, ox: ink.xMin, oy: r, dx: grow, dy: 0, grow };
}

/**
 * @param {Object} item - Glyph (mutated)
 * @param {{k?: Number, ox?: Number, oy?: Number, dx?: Number, dy?: Number}} plan
 * @returns {Boolean} true when a shape or the photo changed
 */
export function applyPlan(item, plan) {
	if (!item || !plan) return false;
	const { k = 1, ox = 0, oy = 0, dx = 0, dy = 0 } = plan;
	if (![k, ox, oy, dx, dy].every(Number.isFinite) || !(k > 0)) return false;
	const mapX = (x) => ox + (x - ox) * k + dx;
	const mapY = (y) => oy + (y - oy) * k + dy;
	let changed = false;
	for (const shape of item.shapes || []) {
		if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) continue;
		let moved = false;
		for (const point of shape.pathPoints) {
			const px = point.p.coord.x;
			const py = point.p.coord.y;
			const x = whole(mapX(px));
			const y = whole(mapY(py));
			for (const handle of [point.h1, point.h2]) {
				if (!handle?.coord) continue;
				const hx = handle.coord.x;
				const hy = handle.coord.y;
				const nx = handle.use ? whole(mapX(hx)) : whole(x + (hx - px));
				const ny = handle.use ? whole(mapY(hy)) : whole(y + (hy - py));
				if (nx !== hx || ny !== hy) moved = true;
				handle.coord.x = nx;
				handle.coord.y = ny;
			}
			if (x !== px || y !== py) moved = true;
			point.p.coord.x = x;
			point.p.coord.y = y;
		}
		if (moved) {
			shape.changed?.();
			changed = true;
		}
	}
	// B16: a plan that keeps the pen width pushes the outlines out after the scale (keep_weight.js)
	if (Number.isFinite(plan.grow) && plan.grow) changed = thickenShapes(item, plan.grow) || changed;
	const trace = getTrace(item);
	if (trace) {
		const scale = Number(trace.scale) * k;
		changed = setTrace(item, { ...trace, x: mapX(trace.x), y: mapY(trace.y), scale }) || changed;
	}
	// S3: the sketch and the Brush strokes take the same plan, inside the same step
	if (changed) followShapes(item, { matrix: fromFixPlan(plan), grow: Number(plan.grow) || 0 });
	if (changed) item.changed?.();
	return changed;
}

// --------------------------------------------------------------
// Specks
// --------------------------------------------------------------

/**
 * The letter's own shapes that make up each speck. A speck inside a part made from another
 * letter (a component) isn't this letter's to take out, so it isn't listed.
 * @param {Object} item - Glyph
 * @returns {Array<Array<Object>>} one list of Path shapes per speck, biggest speck first
 */
export function speckShapeGroups(item) {
	const specks = speckPieces(item);
	if (!specks.length) return [];
	const own = new Map();
	(item.shapes || []).forEach((shape) => {
		// S3: a sketched shape is never a speck's (a sketched dot is his i's dot)
		if (shape?.objType !== 'Path' || isBuiltShape(shape)) return;
		const contour = pathContour(shape);
		if (contour) own.set(contour, shape);
	});
	return specks
		.map((piece) => piece.contours.map((contour) => own.get(contour)))
		.filter((shapes) => shapes.every(Boolean));
}

/**
 * @param {Object} item - Glyph (mutated)
 * @returns {Number} how many specks were taken out
 */
export function removeSpeckShapes(item) {
	const groups = speckShapeGroups(item);
	groups.flat().forEach((shape) => {
		const at = item.shapes.indexOf(shape);
		if (at > -1) item.shapes.splice(at, 1);
	});
	if (groups.length) item.changed?.();
	return groups.length;
}

// --------------------------------------------------------------
// Fix it (the font file)
// --------------------------------------------------------------

/**
 * @param {Object} item - Glyph (mutated)
 * @param {Object} project - GlyphrStudioProject
 * @param {{fit?: Boolean}} [options] - fit: false leaves an automatic letter's fitting to the
 *   caller (Simple's spacing hook fits it inside the step) and counts it as a change when it
 *   isn't at its fit
 * @returns {Boolean} true when anything changed
 */
export function fontFileFix(item, project, { fit = true } = {}) {
	if (!item) return false;
	let changed = false;
	const stray = (item.shapes || []).filter(isStrayPath);
	stray.forEach((shape) => item.shapes.splice(item.shapes.indexOf(shape), 1));
	if (stray.length) {
		item.changed?.();
		changed = true;
	}
	if (roundItemPoints(item) > 0) changed = true;
	const box = guideLines(project?.settings?.font).box;
	if (SPACES.has(charOf(item)) && !inkPaths(item).length) {
		if (whole(item.advanceWidth) > 0) return roundWidth(item) || changed;
		item.advanceWidth = whole(box / 4);
		return true;
	}
	if (!inkBounds(item)) return roundWidth(item) || changed;
	const width = Number(item.advanceWidth);
	const broken = !Number.isFinite(width) || whole(width) <= 0 || whole(width) > MAX_WIDTH;
	if (broken) changed = markAuto(item) || changed;
	if (!isAutomatic(item)) return roundWidth(item) || changed;
	if (!fit) return !sitsAtFit(item, project) || roundWidth(item) || changed;
	return fitSpacing(item, project).changed || changed;
}
