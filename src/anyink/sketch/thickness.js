// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 3 "Thickness", section 6 "The edge rule"): one thickness per letter
	for every Centerline piece, and the font's thickness (settings.anyink.sketchThickness) that
	every new sketched letter starts at. Pure, but for commitThickness, which records the step.

	Changing a letter's thickness moves more than the ink: every point pinned to a writing line
	with its ink edge on it (inset 'edge') sits half the thickness inside the line, so it is
	placed again (edge_rule.js placeEdgePoints), and so is the top or bottom of an Arc that was put
	on a line (a part tagged `top: { on }`): its bend (build.js placeArcTops) or, for a tangent
	Arc, its end along its own circle (slideTangentTops; when the piece goes on from that end, as
	n's arch into its leg, the arc moves straight up or down instead, so the leg keeps its x) is
	worked out again so the arc's extreme lands where the edge rule says.

	The ink width is always edge_rule.js edgeThickness (at most the slider's thick end and the
	small-letter height), never the raw stored number, so the ink matches the pinned points.

	  hasCenterline(sketch)             an inked Centerline piece (not a helper, not hidden)
	  hasOpenCenterline(sketch)         one with open ends (Ends: Round / Flat mean something)
	  letterThickness(item, project)    the letter's thickness, else the font's (model.js)
	  clampThickness(project, value)    whole units inside thicknessRange
	  thicknessInches(project, value)   the ink width on 1 in capitals, two places ("0.07")
	  thicknessReadout(project, value)  "0.07 in wide on 1 in capitals"
	  slideTangentTops(sketch, font)    tangent arcs tagged `top` re-placed for sketch.thickness
	  withThickness(sketch, project, value)   a copy at that thickness, edge points and arc tops
	                                    placed again, and a live circle between two lines solved
	                                    again as a circle (circle_fit.js; the sketch passed in is
	                                    left as it is)
	  previewOutlines(sketch, project, value) the real swept ink of the Centerline pieces at
	                                    that thickness (build_center.js centerOutlines: the
	                                    build's own sweep and ends), no refit: [[x, y], ...] each
	  commitThickness(editor, value, { title })   the open letter at that thickness and the
	                                    font's thickness set, as ONE item step ("changed the
	                                    thickness of small n"); History's sketch hook rebuilds
	                                    the ink inside it. false when nothing changed
	  sketchedLetters(project)          [{ id, item, sketch }] letters with an active sketch that
	                                    has Centerline ink
	  lettersAtOtherThickness(project, value, { except })   the ones whose thickness differs
*/
import { word } from '../words/words.js';
import { letterName } from '../words/letter_name.js';
import { guideLines } from '../placement/classes.js';
import { arcDirs, tangentBulge } from './arc.js';
import { placeArcTops } from './build.js';
import { centerOutlines, centerWidth } from './build_center.js';
import { fitCircles } from './circle_fit.js';
import { pieceSkeleton, startDirection } from './curves.js';
import { edgeThickness, LINE_NAMES, placeEdgePoints } from './edge_rule.js';
import { arcExtreme, extremeTargets } from './tools/arc_snap.js';
// a sketched letter votes on the font's slant with its centerline, never its swept ink
import './slant_vote.js';
import {
	isSketchActive,
	setSketchThickness,
	sketchOf,
	sketchThickness,
	thicknessRange,
} from './model.js';

const DEG = Math.PI / 180;

// --------------------------------------------------------------
// What a sketch has
// --------------------------------------------------------------

/** @returns {Boolean} a piece that makes Centerline ink */
function inksCenter(piece) {
	return !!piece && piece.use === 'center' && !piece.hidden && Array.isArray(piece.parts);
}

/**
 * @param {Object | null} sketch
 * @returns {Boolean}
 */
export function hasCenterline(sketch) {
	return (sketch?.pieces ?? []).some((piece) => inksCenter(piece) && piece.parts.length > 0);
}

/**
 * @param {Object | null} sketch
 * @returns {Boolean}
 */
export function hasOpenCenterline(sketch) {
	return (sketch?.pieces ?? []).some(
		(piece) => inksCenter(piece) && piece.parts.length > 0 && !piece.closed
	);
}

// --------------------------------------------------------------
// The number and its readout
// --------------------------------------------------------------

/**
 * @param {Object} project
 * @param {Number} value
 * @returns {Number} whole font units inside the slider's range
 */
export function clampThickness(project, value) {
	const { min, max } = thicknessRange(project);
	const number = Number(value);
	if (!Number.isFinite(number)) return min;
	return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * @param {Object} item - Glyph
 * @param {Object} project
 * @returns {Number} the letter's own thickness, else the font's
 */
export function letterThickness(item, project) {
	const own = Number(sketchOf(item)?.thickness);
	return own > 0 ? Math.round(own) : sketchThickness(project);
}

/**
 * The stroke's width if the capitals were printed 1 in tall (the ink's real width, edgeThickness).
 * @param {Object} project
 * @param {Number} value - font units
 * @returns {String} two places, "0.07"
 */
export function thicknessInches(project, value) {
	const font = project?.settings?.font || {};
	const capitals = guideLines(font).capitals;
	const ink = edgeThickness(font, value);
	const inches = capitals > 0 ? ink / capitals : 0;
	return (Number.isFinite(inches) ? inches : 0).toFixed(2);
}

/**
 * @param {Object} project
 * @param {Number} value
 * @returns {String} "0.07 in wide on 1 in capitals"
 */
export function thicknessReadout(project, value) {
	return word('sketch.thickness.readout', { width: thicknessInches(project, value) });
}

// --------------------------------------------------------------
// Arc tops on a line
// --------------------------------------------------------------

/**
 * Tangent Arcs tagged `top: { on }` get their extreme back on that line for sketch.thickness: the
 * arc keeps its way in and slides its end round its own circle (the end stays put when another
 * piece shares it, or it is itself pinned to a line). A 3-point Arc keeps its ends and changes
 * its bend: that is build.js placeArcTops, which every build runs; withThickness runs both.
 * @param {Object} sketch
 * @param {Object} font - project.settings.font
 * @returns {Object} the sketch, or a copy with the arcs placed again
 */
export function slideTangentTops(sketch, font) {
	if (!sketch?.points || !Array.isArray(sketch.pieces)) return sketch;
	let points = sketch.points;
	let changed = false;
	const pieces = sketch.pieces.map((piece) => {
		if (!piece || !Array.isArray(piece.parts) || !piece.parts.some(isTangentTop)) return piece;
		const use = piece.use === 'outline' ? 'outline' : 'center';
		const parts = piece.parts.map((part) => {
			if (!isTangentTop(part)) return part;
			const p0 = at(points, part.from);
			const p1 = at(points, part.to);
			if (!p0 || !p1) return part;
			const target = extremeTargets(font, sketch.thickness, use).find(
				(entry) => entry.on === part.top.on
			);
			if (!target) return part;
			const moved = slideTangentEnd({ ...sketch, points }, piece, part, p0, p1, target);
			if (!moved) return part;
			points = { ...points, [part.to]: { ...points[part.to], ...moved.end } };
			if (moved.start) points[part.from] = { ...points[part.from], ...moved.start };
			changed = true;
			return moved.bulge === part.bulge ? part : { ...part, bulge: moved.bulge };
		});
		return parts.some((part, i) => part !== piece.parts[i]) ? { ...piece, parts } : piece;
	});
	return changed ? { ...sketch, points, pieces } : sketch;
}

function isTangentTop(part) {
	return part?.type === 'arc' && part.tangent === true && LINE_NAMES.includes(part.top?.on);
}

function at(points, id) {
	const point = points?.[id];
	const x = Number(point?.x);
	const y = Number(point?.y);
	return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/**
 * A tangent Arc's end slid round the circle that leaves p0 the same way and touches y. An end
 * another piece shares never moves. An end the same piece goes on from (n's arch into its leg)
 * is held: the arc moves up or down instead (heldShift), so the leg he drew keeps its x.
 */
function slideTangentEnd(sketch, piece, part, p0, p1, target) {
	const end = sketch.points[part.to];
	if (end?.on || sharedEnd(sketch, piece, part.to)) return null;
	if (goesOn(piece, part)) return heldShift(sketch, piece, part, p0, p1, target);
	const dir = wayIn(sketch, piece, part, p0, p1);
	if (dir === null) return null;
	const free = tangentBulge(p0, p1, dir);
	if (!free) return null;
	const sign = Math.sign(free);
	const a = dir * DEG;
	const n = [-Math.sin(a) * sign, Math.cos(a) * sign];
	const k = target.side === 'top' ? 1 + n[1] : n[1] - 1;
	if (Math.abs(k) < 1e-6) return null;
	const radius = (target.y - p0[1]) / k;
	if (!(radius > 1)) return null;
	const center = [p0[0] + radius * n[0], p0[1] + radius * n[1]];
	const away = Math.hypot(p1[0] - center[0], p1[1] - center[1]);
	if (away < 1e-6) return null;
	const placed = [
		Math.round(center[0] + (radius * (p1[0] - center[0])) / away),
		Math.round(center[1] + (radius * (p1[1] - center[1])) / away),
	];
	if (placed[0] === p1[0] && placed[1] === p1[1]) return null;
	const bulge = tangentBulge(p0, placed, dir);
	if (bulge === null) return null;
	return { end: { x: placed[0], y: placed[1] }, bulge };
}

/** @returns {Boolean} another part of the same piece starts or ends at the arc's end */
function goesOn(piece, part) {
	if (piece.closed) return true;
	return piece.parts.some(
		(other) =>
			other !== part &&
			(Array.isArray(other.points)
				? other.points.includes(part.to)
				: other.from === part.to || other.to === part.to)
	);
}

/**
 * A tangent Arc whose end is held, moved straight up or down so its top (or bottom) lands on y:
 * both its ends move by the same whole amount, so its width and the parts it joins keep their x.
 * Nothing moves when its start is pinned to a line.
 */
function heldShift(sketch, piece, part, p0, p1, target) {
	const start = sketch.points[part.from];
	if (start?.on || sharedEnd(sketch, piece, part.from)) return null;
	const bulge = Number(part.bulge);
	if (!Number.isFinite(bulge) || !bulge) return null;
	const top = arcExtreme(p0, p1, bulge, target.side);
	if (!top) return null;
	const dy = Math.round(target.y - top.y);
	if (!dy) return null;
	const a = [p0[0], p0[1] + dy];
	const b = [p1[0], p1[1] + dy];
	const points = { ...sketch.points };
	points[part.from] = { ...points[part.from], y: a[1] };
	points[part.to] = { ...points[part.to], y: b[1] };
	const dir = wayIn({ ...sketch, points }, piece, part, a, b);
	const next = dir === null ? null : tangentBulge(a, b, dir);
	return {
		start: { y: a[1] },
		end: { y: b[1] },
		bulge: Number.isFinite(next) && next ? next : bulge,
	};
}

/** The way the piece arrives at the arc's first end: the built curve's own direction there */
function wayIn(sketch, piece, part, p0, p1) {
	const index = piece.parts.indexOf(part);
	if (index <= 0 && !piece.closed) {
		const stored = Number(part.bulge);
		return Number.isFinite(stored) && stored ? arcDirs(p0, p1, stored).start : null;
	}
	const cubics = pieceSkeleton(piece, sketch);
	const found = cubics.find(
		(cubic, i) =>
			i > 0 && Math.hypot(cubic[0][0] - p0[0], cubic[0][1] - p0[1]) < 1e-6 && arcLike(cubic, p1)
	);
	return found ? startDirection(found) : null;
}

/** The cubic heads toward the arc's end side (it is the arc, not the part before it) */
function arcLike(cubic, p1) {
	const [x0, y0] = cubic[0];
	const [x3, y3] = cubic[3];
	return Math.hypot(x3 - p1[0], y3 - p1[1]) < Math.hypot(x0 - p1[0], y0 - p1[1]) + 1e-6;
}

/** @returns {Boolean} another piece uses this point too */
function sharedEnd(sketch, piece, id) {
	return sketch.pieces.some(
		(other) =>
			other !== piece &&
			(other?.parts ?? []).some((part) =>
				Array.isArray(part.points) ? part.points.includes(id) : part.from === id || part.to === id
			)
	);
}

// --------------------------------------------------------------
// A sketch at another thickness
// --------------------------------------------------------------

/**
 * @param {Object} sketch
 * @param {Object} project
 * @param {Number} value - font units
 * @returns {Object} a copy at that thickness (whole, in range), placed again
 */
export function withThickness(sketch, project, value) {
	const font = project?.settings?.font || {};
	const thickness = clampThickness(project, value);
	const next = { ...sketch, thickness };
	const placed = fitCircles(placeEdgePoints(next, font));
	return slideTangentTops(placeArcTops(placed, font), font);
}

/**
 * The Centerline ink at that thickness, swept for real (build_center.js), without the refit: what
 * the slider shows while it is dragged.
 * @param {Object} sketch
 * @param {Object} project
 * @param {Number} value
 * @returns {Array<Array<[Number, Number]>>} font units
 */
export function previewOutlines(sketch, project, value) {
	if (!sketch?.pieces) return [];
	const font = project?.settings?.font || {};
	const placed = withThickness(sketch, project, value);
	const width = centerWidth(placed, font, placed.thickness);
	const out = [];
	for (const piece of placed.pieces) {
		if (!inksCenter(piece) || !piece.parts.length) continue;
		try {
			out.push(...centerOutlines(piece, placed, { font, width }));
		} catch (error) {
			console.warn('ANY-INK sketch: a piece could not be previewed', error);
		}
	}
	return out;
}

// --------------------------------------------------------------
// The step
// --------------------------------------------------------------

/**
 * The open letter at a new thickness, and the font's thickness with it, as one item step.
 * History's sketch hook (history_hook.js beforeSketchStep) rebuilds the ink inside the step,
 * as it does for every sketch step. The font's thickness is the one new letters start at, like
 * the Brush's size: Undo puts the letter back, not that starting point.
 * @param {Object} editor - ProjectEditor
 * @param {Number} value - font units
 * @param {{title?: String}} [options]
 * @returns {Boolean} true when a step was recorded
 */
export function commitThickness(editor, value, { title } = {}) {
	const project = editor?.project;
	const item = editor?.selectedItem;
	const sketch = sketchOf(item);
	if (!project || !item || !isSketchActive(sketch) || !hasCenterline(sketch)) return false;
	const thickness = clampThickness(project, value);
	setSketchThickness(project, thickness);
	if (thickness === Number(sketch.thickness)) return false;
	const next = withThickness(sketch, project, thickness);
	Object.assign(sketch, { thickness: next.thickness, points: next.points, pieces: next.pieces });
	sketch.at = Date.now();
	editor.history.addState(title || word('sketch.step.thickness', { letter: nameOf(item, editor) }));
	editor.publish?.('currentItem', item);
	return true;
}

/** @returns {String} 'small n' */
function nameOf(item, editor) {
	const char = item?.char || charFromId(editor?.selectedItemID || editor?.selectedGlyphID);
	return letterName(char) || word('check.aLetter');
}

function charFromId(id) {
	const code = parseInt(String(id || '').replace(/^glyph-/, ''), 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}

// --------------------------------------------------------------
// The font's sketched letters
// --------------------------------------------------------------

/**
 * @param {Object} project
 * @returns {Array<{id: String, item: Object, sketch: Object}>} in the font's order
 */
export function sketchedLetters(project) {
	const out = [];
	for (const group of ['glyphs', 'ligatures', 'components']) {
		for (const [id, item] of Object.entries(project?.[group] || {})) {
			const sketch = sketchOf(item);
			if (isSketchActive(sketch) && hasCenterline(sketch)) out.push({ id, item, sketch });
		}
	}
	return out;
}

/**
 * @param {Object} project
 * @param {Number} value
 * @param {{except?: String}} [options] - a letter id left out (the one just changed)
 * @returns {Array<{id: String, item: Object, sketch: Object}>}
 */
export function lettersAtOtherThickness(project, value, { except = null } = {}) {
	const thickness = clampThickness(project, value);
	return sketchedLetters(project).filter(
		({ id, sketch }) => id !== except && Math.round(Number(sketch.thickness)) !== thickness
	);
}
