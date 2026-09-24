// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: potrace's SVG to upstream Path objects in font units (Milestone 8).
	Owner: TRACK B (svg_to_shapes, trace_region, apply, preview_draw).

	Contract:
	- potraceSvgToShapes(svg, placement) -> Array of upstream Path objects in font units.
	  placement = { x, y, scale, offsetX = 0, offsetY = 0 } maps image pixel (px, py) (y-down;
	  the offsets locate a cropped or downscaled region in the full image) to font units:
	    fontX = x + (px + offsetX) * scale
	    fontY = y - (py + offsetY) * scale
	- countPoints(shapes) -> Number of path points.
	- mapPixelToFont(placement, px, py) -> {x, y}: the same mapping for one pixel position.
	- svgShapeStats(svg) -> { shapes, points }: what potraceSvgToShapes would make, counted
	  from the path data without building anything (one pass over the text): shapes = the
	  subpaths, points = their segments, which is the importer's point count before step 2
	  below. Fix, 09/24/2026: the facade checks this first, because converting 44,000 speck
	  shapes took 6 s on the main thread before anything could say "too many".

	How it works:
	1. upstream's ioSVG_convertSVGTagsToGlyph parses the whole SVG, potrace's transform group
	   included (D-024), so every coordinate comes out in image pixels, y-down. It runs with
	   showErrors false: an image with no ink gives an SVG with no <path>, which is an empty
	   result here, not an error box.
	2. Where potrace splits a straight edge between two corners, it leaves a point in the
	   middle of the edge. Those points change nothing about the outline and only add work
	   for whoever edits it, so they are dropped (within 0.06 px, which is below potrace's
	   own tenth-of-a-pixel output precision).
	3. The placement is applied to every point and handle.

	Winding (D-024 amended, 09/24/2026): no reverseWinding(). Upstream's paste handler runs
	flipNS() and then reverseWinding(); flipNS() mirrors the points and also reverses their
	order, so the pair is a pure mirror. The y-flip above is the same pure mirror (plus scale and
	offset), so the outlines keep potrace's own direction: outer edges counterclockwise in
	font units (y-up) and holes clockwise, the PostScript / CFF convention. A hole is a hole
	under the nonzero rule both on the edit canvas (drawGlyph fills 'nonzero') and in the
	exported OTF. tests/svg_to_shapes.test.js and tests/autotrace_export.test.js check both.
*/
import { ioSVG_convertSVGTagsToGlyph } from '../../formats_io/svg_outlines/svg_outline_import.js';

/** A point this close (image pixels) to the straight line through its neighbors is dropped. */
export const STRAIGHT_TOLERANCE_PX = 0.06;

/**
 * @param {String} svg - potrace's SVG (pathonly: false)
 * @param {{x: Number, y: Number, scale: Number, offsetX?: Number, offsetY?: Number}} placement
 * @returns {Array} upstream Path objects, named 'Auto-trace 1', 'Auto-trace 2', ...
 * @throws {TypeError} when the placement has no finite x, y, offsets, or no positive scale
 */
export function potraceSvgToShapes(svg, placement) {
	const place = readPlacement(placement);
	if (typeof svg !== 'string' || !/<path[\s>]/i.test(svg)) return [];

	const glyph = ioSVG_convertSVGTagsToGlyph(svg, false);
	const shapes = [];
	for (const path of glyph?.shapes || []) {
		if (path?.objType !== 'Path' || !Array.isArray(path.pathPoints)) continue;
		// Detached from the scratch glyph, so each coordinate change stays inside this path
		path.parent = false;
		dropStraightMidpoints(path);
		if (path.pathPoints.length < 2) continue;
		mapPath(path, place);
		path.name = `Auto-trace ${shapes.length + 1}`;
		path.changed();
		shapes.push(path);
	}
	return shapes;
}

/**
 * @param {Array} shapes - Path objects (anything else counts 0)
 * @returns {Number}
 */
export function countPoints(shapes) {
	if (!Array.isArray(shapes)) return 0;
	let total = 0;
	for (const shape of shapes) {
		if (Array.isArray(shape?.pathPoints)) total += shape.pathPoints.length;
	}
	return total;
}

/**
 * Where an image pixel position lands in font units.
 * @param {{x: Number, y: Number, scale: Number, offsetX?: Number, offsetY?: Number}} placement
 * @param {Number} px - image pixels from the left edge of the traced image
 * @param {Number} py - image pixels from the top edge of the traced image
 * @returns {{x: Number, y: Number}}
 */
export function mapPixelToFont(placement, px, py) {
	const place = readPlacement(placement);
	return { x: place.fx(px), y: place.fy(py) };
}

/**
 * Shapes and points in potrace's SVG, counted from the path data alone.
 * @param {String} svg
 * @returns {{shapes: Number, points: Number}}
 */
export function svgShapeStats(svg) {
	const stats = { shapes: 0, points: 0 };
	if (typeof svg !== 'string') return stats;
	const attribute = /\sd\s*=\s*(["'])([\s\S]*?)\1/g;
	let match;
	while ((match = attribute.exec(svg))) countPathData(match[2], stats);
	return stats;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Numbers each path command takes per segment (lower case). */
const COMMAND_ARITY = Object.freeze({ m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 });

/**
 * Adds one d attribute's subpaths (each move) and segments (each full set of numbers after
 * a command; the pairs after a move's first are straight lines) to stats.
 */
function countPathData(d, stats) {
	let command = '';
	let numbers = 0;
	const flush = () => {
		if (command === 'm') stats.points += Math.max(0, Math.floor(numbers / 2) - 1);
		else if (COMMAND_ARITY[command]) stats.points += Math.floor(numbers / COMMAND_ARITY[command]);
	};
	let inNumber = false;
	let seenDot = false;
	let seenExponent = false;
	for (let i = 0; i < d.length; i++) {
		const c = d.charCodeAt(i);
		if (c >= 48 && c <= 57) {
			// A digit: part of the number running, or the start of one
			if (!inNumber) {
				inNumber = true;
				seenDot = false;
				seenExponent = false;
				numbers++;
			}
		} else if (c === 46) {
			// '.': a second one (or one after an exponent) starts the next number
			if (!inNumber || seenDot || seenExponent) {
				inNumber = true;
				seenExponent = false;
				numbers++;
			}
			seenDot = true;
		} else if (c === 45 || c === 43) {
			// '-' or '+': an exponent's sign, else the start of the next number
			const before = d.charCodeAt(i - 1);
			if (!(inNumber && (before === 101 || before === 69))) {
				inNumber = true;
				seenDot = false;
				seenExponent = false;
				numbers++;
			}
		} else if ((c === 101 || c === 69) && inNumber) {
			seenExponent = true;
		} else {
			inNumber = false;
			const lower = c | 32;
			if (lower >= 97 && lower <= 122) {
				flush();
				command = String.fromCharCode(lower);
				numbers = 0;
				if (command === 'm') stats.shapes++;
			}
		}
	}
	flush();
}

function readPlacement(placement) {
	const x = Number(placement?.x);
	const y = Number(placement?.y);
	const scale = Number(placement?.scale);
	const offsetX = placement?.offsetX === undefined ? 0 : Number(placement.offsetX);
	const offsetY = placement?.offsetY === undefined ? 0 : Number(placement.offsetY);
	const finite = [x, y, scale, offsetX, offsetY].every(Number.isFinite);
	if (!finite || !(scale > 0)) {
		throw new TypeError('Auto-trace needs a placement with x, y, and a scale above 0.');
	}
	return {
		fx: (px) => x + (px + offsetX) * scale,
		fy: (py) => y - (py + offsetY) * scale,
	};
}

/**
 * Applies the placement to every point and handle. A handle that is not in use is parked
 * where upstream parks a new point's handles: level with the point, one default handle
 * length to the left (h1) or right (h2), so turning it on later shows it beside its point.
 * (The importer leaves them near the origin, because it sets the point after the handles.)
 */
function mapPath(path, place) {
	for (const pp of path.pathPoints) {
		const x = place.fx(pp.p.coord.x);
		const y = place.fy(pp.p.coord.y);
		const parked = Number(pp.defaultHandleLength) || 0;
		for (const [handle, side] of [
			[pp.h1, -1],
			[pp.h2, 1],
		]) {
			if (handle.use) {
				const hx = handle.coord.x;
				const hy = handle.coord.y;
				handle.coord.x = place.fx(hx);
				handle.coord.y = place.fy(hy);
			} else {
				handle.coord.x = x + side * parked;
				handle.coord.y = y;
			}
		}
		pp.p.coord.x = x;
		pp.p.coord.y = y;
	}
}

/** Both sides of the point are straight lines (no handle in use on either end). */
function isStraight(from, to) {
	return !from.h2.use && !to.h1.use;
}

/** p sits on the segment from a to b, strictly between them, within the tolerance. */
function liesBetween(a, p, b) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const length2 = dx * dx + dy * dy;
	if (!(length2 > 0)) return false;
	const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length2;
	if (!(t > 0 && t < 1)) return false;
	const distance = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.sqrt(length2);
	return distance <= STRAIGHT_TOLERANCE_PX;
}

function dropStraightMidpoints(path) {
	const points = path.pathPoints;
	let i = 0;
	while (points.length > 3 && i < points.length) {
		const n = points.length;
		const prev = points[(i - 1 + n) % n];
		const point = points[i];
		const next = points[(i + 1) % n];
		if (
			isStraight(prev, point) &&
			isStraight(point, next) &&
			liesBetween(prev.p, point.p, next.p)
		) {
			points.splice(i, 1);
			// The previous point has a new neighbor now, so look at it again
			if (i > 0) i--;
		} else {
			i++;
		}
	}
}
