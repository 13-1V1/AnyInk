// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md sections 3, 4, 7 and 8; D-047 points 1-3): a letter's sketch to its ink. The
	sketch is the source of truth; the ink is rebuilt from it inside every step (history_hook.js
	beforeSketchStep for the open letter; the thickness, follow and line-move steps call
	rebuildItem for the letters they change).

	buildSketch is pure:
	  1. The edge rule places every pinned point (edge_rule.js placeEdgePoints), a live circle
	     whose top or bottom it moved is solved again as a circle (circle_fit.js), and every arc whose
	     top or bottom was snapped to a line (part.top = { on }) gets the bend that puts its top
	     where the edge rule puts a round top (placeArcTops), so a thickness or line change keeps
	     the ink edge on the line.
	  2. Centerline pieces (use 'center', not hidden) are swept with the round nib
	     (build_center.js); Outline loops (build_outline.js) are built by nesting. Helper and
	     hidden pieces, and open Outline pieces, make no ink.
	  3. Each outline becomes one shape, tagged { sketchId: piece id, sketchKey, sketchPart }.
	  The same sketch on the same lines always gives the same shapes; results are kept by what
	  they were built from (BUILD_CACHE of them), so a step that changed nothing costs a lookup.

	rebuildItem(item, { project, editor }) puts that ink in the letter:
	  - nothing for a letter with no sketch, one set aside, or one from a newer app
	  - first the hash check (sketch_record.js builtMatches): built shapes changed behind the
	    sketch's back are never rebuilt over; it returns { mismatch: true } and the caller sets
	    the sketch aside (detach.js)
	  - the placed points (and re-placed arc bends) are written back into the stored sketch (its
	    x / y are the built position, SKETCH.md section 8)
	  - the old built shapes go and the new ones take the place of the first of them (or go at
	    the end), unless they would hash the same (then nothing in the letter changes); the hash
	    is stored (markBuilt), the build version set, and the new shapes are remembered as the
	    letter's own for the next reconcile (a paste of a copy then loses its tags, never them)
	  - a picked shape that was replaced is let go of (the editor's shape and point picks cleared)

	  BUILD_CACHE
	  placeArcTops(sketch, font)              a sketch whose topped arcs have the right bend
	                                          (shared with the input where nothing changed)
	  buildSketch(sketch, { font, thickness })   { placed, width, shapes: [{ pieceId, part,
	                                          curves }] }; thickness: used when the sketch has
	                                          none (model.js sketchThickness)
	  builtPaths(sketch, built)               the shapes as tagged Paths, not yet in a letter
	  rebuildItem(item, { project, editor, font, force })  { changed, mismatch, shapes }; font:
	                                          the lines to build on (the project's by default);
	                                          force: no hash check first (a follow plan already
	                                          moved the ink with the sketch, follow.js)
	  clearBuildCache()                       tests
	The build hands rebuildItem (forced) to follow.js (setSketchRebuild) when it loads, so a
	follow plan that scales, flips or moves by part of a unit, and a moved line, rebuild the ink
	from the moved sketch inside the feature's own step.
*/
import { guideLines } from '../placement/classes.js';
import { strokePaths } from '../nib/stroke_shapes.js';
import { word } from '../words/words.js';
import { arcExtreme, extremeTargets } from './tools/arc_snap.js';
import { centerContours, centerWidth } from './build_center.js';
import { fitCircles } from './circle_fit.js';
import { outlineContours } from './build_outline.js';
import { pieceSkeleton } from './curves.js';
import { LINE_NAMES, placeEdgePoints } from './edge_rule.js';
import { setSketchRebuild } from './follow.js';
import { BUILD_V, isSketchActive, sketchOf, sketchThickness } from './model.js';
import {
	builtMatches,
	builtShapes,
	hashBuilt,
	markBuilt,
	noteKnown,
	tagBuilt,
} from './sketch_record.js';

export const BUILD_CACHE = 200;
const DEG = Math.PI / 180;
/** The largest bend tried for an arc top (degrees of sweep) */
const MOST_SWEEP = 358;

/** what a build was made from -> its result */
const cache = new Map();

/** Tests: forget every kept build */
export function clearBuildCache() {
	cache.clear();
}

/**
 * @param {Object} sketch
 * @param {Object} font
 * @returns {Object}
 */
export function placeArcTops(sketch, font) {
	if (!Array.isArray(sketch?.pieces) || !sketch.points) return sketch;
	let changed = false;
	const pieces = sketch.pieces.map((piece) => {
		if (!Array.isArray(piece?.parts)) return piece;
		let pieceChanged = false;
		const parts = piece.parts.map((part) => {
			if (part?.type !== 'arc' || part.tangent || !LINE_NAMES.includes(part.top?.on)) return part;
			const a = sketch.points[part.from];
			const b = sketch.points[part.to];
			if (!a || !b || !Number(part.bulge)) return part;
			const use = piece.use === 'outline' ? 'outline' : 'center';
			const target = extremeTargets(font, sketch.thickness, use).find(
				(entry) => entry.on === part.top.on
			);
			let bulge = bulgeForExtreme(
				[a.x, a.y],
				[b.x, b.y],
				Math.sign(part.bulge),
				target.side,
				target.y
			);
			// S3 integration: an arc that gives way to a Line after it (curves.js) is built as a
			// curve, whose top is not the arc's: the bend is worked out again on the built curve
			if (bulge !== null) {
				bulge = refineOnBuilt(piece, part, sketch.points, target, bulge) ?? bulge;
			}
			if (bulge === null || Math.abs(bulge - part.bulge) < 1e-9) return part;
			pieceChanged = true;
			return { ...part, bulge };
		});
		if (!pieceChanged) return piece;
		changed = true;
		return { ...piece, parts };
	});
	return changed ? { ...sketch, pieces } : sketch;
}

/**
 * @param {Object} sketch
 * @param {{font: Object, thickness?: Number}} options
 * @returns {{placed: Object, width: Number, shapes: Array}}
 */
export function buildSketch(sketch, { font, thickness = 0 } = {}) {
	const base =
		Number(sketch?.thickness) > 0 || !(thickness > 0) ? sketch : { ...sketch, thickness };
	const placed = placeArcTops(fitCircles(placeEdgePoints(base, font)), font);
	const width = centerWidth(placed, font, thickness);
	const source = sourceOf(placed, font, width);
	const kept = cache.get(source);
	if (kept) {
		cache.delete(source);
		cache.set(source, kept);
		return { placed, width, shapes: kept };
	}
	const shapes = [];
	(placed.pieces || []).forEach((piece) => {
		if (piece?.use !== 'center' || piece.hidden) return;
		centerContours(piece, placed, { font, width }).forEach((contour, part) => {
			shapes.push({ pieceId: piece.id, part, curves: contour.curves });
		});
	});
	const parts = new Map();
	outlineContours(placed).forEach((contour) => {
		const part = parts.get(contour.pieceId) || 0;
		parts.set(contour.pieceId, part + 1);
		shapes.push({ pieceId: contour.pieceId, part, curves: contour.curves });
	});
	cache.set(source, shapes);
	if (cache.size > BUILD_CACHE) cache.delete(cache.keys().next().value);
	return { placed, width, shapes };
}

/**
 * @param {Object} sketch
 * @param {Array<{pieceId, part, curves}>} built
 * @returns {Array<Object>} Paths, tagged
 */
export function builtPaths(sketch, built) {
	return built.flatMap(({ pieceId, part, curves }) =>
		strokePaths([{ curves }], { name: word('sketch.shapeName', { number: pieceId }) }).map(
			(path) => {
				tagBuilt(path, { id: pieceId, key: sketch.key, part });
				return path;
			}
		)
	);
}

/**
 * @param {Object} item - Glyph, Ligature or Component
 * @param {{project: Object, editor?: Object, font?: Object, force?: Boolean}} options
 * @returns {{changed: Boolean, mismatch: Boolean, shapes: Array<Object>}}
 */
export function rebuildItem(item, { project, editor = null, font = null, force = false } = {}) {
	const none = { changed: false, mismatch: false, shapes: [] };
	const sketch = sketchOf(item);
	if (!Array.isArray(item?.shapes) || !isSketchActive(sketch)) return none;
	if (!sketch.points || typeof sketch.points !== 'object' || !Array.isArray(sketch.pieces)) {
		return none;
	}
	if (!force && !builtMatches(item)) return { ...none, mismatch: true };
	const lines = font || project?.settings?.font || {};
	const { placed, shapes } = buildSketch(sketch, {
		font: lines,
		thickness: sketchThickness(project),
	});
	writeBack(sketch, placed);
	const paths = builtPaths(sketch, shapes);
	sketch.build = BUILD_V;
	if (hashBuilt({ shapes: paths }, sketch.key) === hashBuilt(item, sketch.key)) {
		markBuilt(item);
		noteKnown(item);
		return { ...none, shapes: builtShapes(item, sketch.key) };
	}
	const added = replaceBuilt(item, sketch.key, paths, editor);
	markBuilt(item);
	noteKnown(item);
	return { changed: true, mismatch: false, shapes: added };
}

setSketchRebuild(
	(item, { font, project } = {}) => rebuildItem(item, { project, font, force: true }).changed
);

// --------------------------------------------------------------
// Inside
// --------------------------------------------------------------

/** What a build is made from: the placed sketch's pieces and points, its ends, the lines */
function sourceOf(placed, font, width) {
	const lines = guideLines(font);
	return JSON.stringify([
		width,
		placed.ends,
		placed.way,
		placed.mirror,
		placed.pieces,
		placed.points,
		placed.relations,
		[lines.top, lines.capitals, lines.small, lines.writing, lines.tail, lines.overshoot],
	]);
}

/** The placed points and re-bent arcs into the stored sketch (only what moved) */
function writeBack(sketch, placed) {
	if (placed === sketch) return;
	Object.entries(placed.points || {}).forEach(([id, point]) => {
		if (sketch.points[id] !== point) sketch.points[id] = point;
	});
	if (placed.pieces !== sketch.pieces) {
		placed.pieces.forEach((piece, i) => {
			if (sketch.pieces[i] !== piece) sketch.pieces[i] = piece;
		});
	}
	if (placed.thickness !== sketch.thickness && !(Number(sketch.thickness) > 0)) {
		sketch.thickness = placed.thickness;
	}
}

/** The old built shapes out, the new in where the first old one was; returns the new ones */
function replaceBuilt(item, key, paths, editor) {
	const list = item.shapes;
	const old = new Set(builtShapes(item, key));
	const firstOld = list.findIndex((shape) => old.has(shape));
	let at = firstOld < 0 ? list.length : firstOld;
	for (let i = list.length - 1; i >= 0; i--) {
		if (!old.has(list[i])) continue;
		list.splice(i, 1);
		if (i < at) at -= 1;
	}
	const added = paths.map((path) => {
		const shape = item.addOneShape(path);
		tagBuilt(shape, {
			id: path.anyink.sketchId,
			key: path.anyink.sketchKey,
			part: path.anyink.sketchPart,
		});
		return shape;
	});
	list.splice(list.length - added.length, added.length);
	list.splice(at, 0, ...added);
	item.changed?.();
	letGoOf(editor, old);
	return added;
}

function letGoOf(editor, old) {
	const shapes = editor?.multiSelect?.shapes;
	const members = Array.isArray(shapes?.members) ? shapes.members : [];
	if (!members.some((shape) => old.has(shape))) return;
	shapes.clear?.();
	editor.multiSelect?.points?.clear?.();
}

/** The bulge whose extreme on one side lands on y (as tools/arc_snap.js: bisection) */
/** How far the built top may be off its target before the bend is worked out on the build */
const BUILT_TOLERANCE = 0.25;
/** Samples per cubic when the built top is read */
const TOP_SAMPLES = 48;

/**
 * S3 integration: the top (or bottom) of the piece as built, between the arc's two ends; null
 * when the piece's extreme there is at one of the ends (no top to place).
 * @returns {Number | null}
 */
function builtExtreme(piece, part, points, side, bulge) {
	const a = points[part.from];
	const b = points[part.to];
	const lo = Math.min(a.x, b.x);
	const hi = Math.max(a.x, b.x);
	const parts = piece.parts.map((other) => (other === part ? { ...part, bulge } : other));
	let best = null;
	pieceSkeleton({ ...piece, parts }, points).forEach((cubic) => {
		for (let i = 0; i <= TOP_SAMPLES; i++) {
			const [x, y] = cubicPoint(cubic, i / TOP_SAMPLES);
			if (x < lo - 0.01 || x > hi + 0.01) continue;
			if (!best || (side === 'top' ? y > best.y : y < best.y)) best = { x, y };
		}
	});
	if (!best || best.x - lo < 0.5 || hi - best.x < 0.5) return null;
	return best.y;
}

function cubicPoint([p0, p1, p2, p3], t) {
	const u = 1 - t;
	const w0 = u * u * u;
	const w1 = 3 * u * u * t;
	const w2 = 3 * u * t * t;
	const w3 = t * t * t;
	return [
		w0 * p0[0] + w1 * p1[0] + w2 * p2[0] + w3 * p3[0],
		w0 * p0[1] + w1 * p1[1] + w2 * p2[1] + w3 * p3[1],
	];
}

/**
 * The bend whose built top lands on the target (secant steps on the sweep from the arc's own
 * answer), or null when the build already agrees or no better bend is found.
 * @returns {Number | null}
 */
function refineOnBuilt(piece, part, points, target, bulge) {
	const miss = (sweep) => {
		const y = builtExtreme(
			piece,
			part,
			points,
			target.side,
			Math.sign(bulge) * Math.tan((sweep * DEG) / 4)
		);
		return y === null ? null : y - target.y;
	};
	let s0 = (Math.atan(Math.abs(bulge)) * 4) / DEG;
	let f0 = miss(s0);
	if (f0 === null || Math.abs(f0) <= BUILT_TOLERANCE) return null;
	let s1 = Math.min(MOST_SWEEP, s0 * 1.02);
	let f1 = miss(s1);
	for (let i = 0; i < 10 && f1 !== null; i++) {
		if (Math.abs(f1) <= BUILT_TOLERANCE / 4) break;
		if (f1 === f0) return null;
		const s2 = s1 - (f1 * (s1 - s0)) / (f1 - f0);
		if (!(s2 > 0) || s2 > MOST_SWEEP) return null;
		[s0, f0, s1] = [s1, f1, s2];
		f1 = miss(s1);
	}
	if (f1 === null || Math.abs(f1) > BUILT_TOLERANCE) return null;
	return Math.sign(bulge) * Math.tan((s1 * DEG) / 4);
}

function bulgeForExtreme(p0, p1, sign, side, y) {
	if (!sign) return null;
	const reach = (sweep) => {
		const extreme = arcExtreme(p0, p1, sign * Math.tan((sweep * DEG) / 4), side);
		if (extreme) return extreme.y;
		return side === 'top' ? Math.max(p0[1], p1[1]) : Math.min(p0[1], p1[1]);
	};
	const goes = side === 'top' ? 1 : -1;
	if (goes * (reach(MOST_SWEEP) - y) < 0) return null;
	let lo = 0;
	let hi = MOST_SWEEP;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (goes * (reach(mid) - y) < 0) lo = mid;
		else hi = mid;
	}
	const bulge = sign * Math.tan((hi * DEG) / 4);
	const extreme = arcExtreme(p0, p1, bulge, side);
	return extreme && Math.abs(extreme.y - y) < 0.01 ? bulge : null;
}
