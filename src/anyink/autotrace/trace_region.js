// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK auto-trace: which part of the trace image to trace (Milestone 8). Pure.
	Owner: TRACK B (svg_to_shapes, trace_region, apply, preview_draw).

	Contract:
	- regionForGlyph(trace, item, font, { margin = 0, marginTop = margin }) -> pixel rect
	  {x, y, width, height}
	  of the trace image (item.anyink.trace: x, y = top-left in font units, y-up; scale = font
	  units per pixel)
	  that lies inside the glyph box (x from 0 to item.advanceWidth, y from font.descent to
	  font.ascent), clamped to the image, or null when they do not overlap. When the options'
	  insideBoxOnly is false the caller uses the whole image instead.

	Details:
	- The rect is in whole pixels and covers every pixel the box touches (edges round
	  outward), so nothing inside the box is ever cut off.
	- An item with no advance width (components usually have none) has no right edge, so
	  only the ascent-to-descent band limits it; the image's own width is used across.
	- A font whose ascent is not above its descent limits nothing vertically.
	- A trace with no size or no scale gives null. Only x, y, width, height, and scale are
	  read, so a trace-shaped object without an asset id (a sheet box, say) works too.

	Whole shapes (M8 integration, D-029): cutting the image at the box edge cut a letter that
	reaches a little past its box (the leg of an R, the tail of a j) with a flat edge. So
	'Only inside the glyph box' keeps whole shapes instead:
	- regionForGlyph(trace, item, font, { margin, marginTop }) grows the box by `margin` font
	  units on the sides and below and by `marginTop` above before it becomes pixels (the
	  facade traces the box plus BOX_MARGIN_EM, and ACCENT_MARGIN_EM above the ascent).
	- glyphBoxFontUnits(item, font) -> { xMin, xMax, yMin, yMax } in font units, with
	  -Infinity / Infinity on a side nothing limits.
	- keepShapesInGlyphBox(shapes, item, font, { crop } = {}) -> the shapes whose middle
	  (bounding box center) is inside the glyph box. A shape inside another shape's bounding
	  box (a counter, a hole) goes with that shape, so a kept letter keeps its holes and a
	  dropped neighbor takes its holes along.

	Fixes, 09/24/2026:
	- Accents and dots: an outline whose middle is across the box (0 to the advance width)
	  but above the ascent or below the descent is kept when it overlaps a kept outline from
	  side to side and lies wholly inside `crop`, the traced area in font units (the caller
	  shrinks it by its edge tolerance; no crop, no accents). An É whose accent sits above the ascent lost the
	  accent. A shape the traced area cuts (the top of the next line of writing) is part of
	  something else and stays out, and so does anything whose middle is past the side of
	  the box (a neighbor).
	- Accents, second fix: a mark is kept only when it sits within ACCENT_GAP_EM of a kept
	  outline above or below it (the gap between their bounding boxes) and is smaller than
	  that outline. The dot of an i on the next line of writing, wholly inside the margin
	  under an o, came along as if it were a cedilla (0.36 em below the o). And the traced
	  area reaches ACCENT_MARGIN_EM above the ascent (was 1/4 em), so an accent up to half
	  an em over a capital is not cut by the crop and dropped.
	- Speed: each shape's parent comes from a grid over the bounding boxes instead of
	  comparing every pair, with the same answers. 20,000 specks took 1.3 s and 44,000 about
	  12 s, on the main thread; 40,000 now take a few tens of ms.

	B9, 10/15/2026 (UX-BEGINNER 4.4 "Never greyed out", section 10 B9): Simple takes the part's
	rectangle instead of the glyph box. The old "Only inside the glyph box" rule is gone in
	Simple: the part he picked in the photo dialog (a found part, or a box he drew) is the area
	traced, whatever the letter's width (an empty letter has none). All tools is exactly as
	before: regionForGlyph and keepShapesInGlyphBox are unchanged, and the two functions that
	choose give them whenever the mode isn't Simple or no part is given.
	- partMarginPx(part) -> pixels of paper traced round a part: PART_MARGIN_SHARE of its long
	  side, at least PART_MARGIN_MIN_PX, so the automatic ink cutoff sees paper on every side
	  and a stroke a slider makes a little fatter is never cut by the crop.
	- regionForPart(part, size, { margin = partMarginPx(part) }) -> the pixel rect
	  {x, y, width, height} of the part (image pixels, y down, right and bottom exclusive, as
	  ink_parts.js gives them) grown by the margin and clamped to the photo (size: { width,
	  height }, a trace works), or null.
	- partBoxFontUnits(part, trace) -> the part's box in font units through the photo's
	  placement (trace x, y, scale), or null.
	- keepShapesInPart(shapes, part, trace, { slack = 2 px }) -> the whole shapes whose middle is
	  inside the part's box (grown by slack font units), a shape inside another one's bounding box
	  going with it (holes, the dot of a bullseye), as keepShapesInGlyphBox does. No mark is ever
	  rescued from outside: a part already holds its own dots and accents (ink_parts.js joins
	  them), so anything else over or under it is another letter's.
	- regionFor(trace, item, font, { part, margin, marginTop }) -> Simple with a part:
	  regionForPart(part, trace); otherwise regionForGlyph(trace, item, font, { margin,
	  marginTop }).
	- keepShapesFor(shapes, item, font, { part, trace, crop, pen, specks }) -> Simple with a part:
	  keepShapesInPart(shapes, part, trace, { pen, specks }); otherwise keepShapesInGlyphBox(shapes,
	  item, font, { crop }).

	B9 fix pass, 10/15/2026 (first-timer: a part of nothing but ruled-line bits traced to four dots
	that replaced his H; a bit of blue rule came into the font beside the F): the outlines no pen
	made. With the photo's pen (pixels, ink_parts.js findInk's stroke), keepShapesInPart also
	takes out what keepPenShapes says:
	- keepPenShapes(shapes, { pen, scale, specks = true }) -> shapes in font units, through the
	  photo's scale (font units per pixel). An outline (no parent) is no pen's when its area is
	  under SPECK_PEN_SHARE of the pen squared (B11's speck rule: a dot of the pen is about three
	  quarters of it) or it is thinner than THIN_PEN_SHARE of the pen (2 x area / perimeter: a
	  ruled-line bit is a quarter of the pen; a dot of the pen reads half of it). Holes and dots
	  inside an outline go with it; a shape that only sits in the empty corner of another one's
	  bounding box (the bit of rule at the F's lower right) is an outline of its own. Every outline no pen's: nothing (the flow then says "No ink
	  found", whatever Remove specks says: specks alone are never a letter). Otherwise, with specks
	  (Remove specks on), the pen's outlines only; with it off, all of them. No pen: as they are.
	- outlineMeasure(shape) -> { area, perimeter } in font units, curves flattened.
*/
import { isSimpleMode } from '../mode/mode.js';

/** Paper traced round a picked part (Simple), as a share of the part's long side... */
export const PART_MARGIN_SHARE = 0.25;

/** ...and never fewer pixels than this (a period, a hyphen). */
export const PART_MARGIN_MIN_PX = 8;

/** Rounding slack round a part's box when its shapes are kept, in traced pixels. */
export const PART_SLACK_PX = 2;

/** A traced outline smaller than this share of the pen squared is a speck (B11's rule)... */
export const SPECK_PEN_SHARE = 0.25;

/** ...and one thinner than this share of the pen (2 x area / perimeter) a bit of a ruled line. */
export const THIN_PEN_SHARE = 0.35;

/** Points per curve when an outline is measured. */
const CURVE_STEPS = 8;

/** How far past the glyph box the facade traces, as a share of the em (sides, below). */
export const BOX_MARGIN_EM = 0.25;

/** How far above the ascent the facade traces, as a share of the em (accents live there). */
export const ACCENT_MARGIN_EM = 0.5;

/** Largest gap between a kept outline and a mark kept with it, as a share of the em. */
export const ACCENT_GAP_EM = 0.2;

/** Rounding slack, in pixels, so 499.9999999 still counts as 500. */
const EDGE_EPSILON = 1e-6;

/**
 * @param {Object} trace - item.anyink.trace
 * @param {Object} item - Glyph (glyph, ligature, or component)
 * @param {Object} font - project.settings.font (ascent, descent)
 * @param {{margin?: Number, marginTop?: Number}} [grow] - font units added to the sides and
 *   the bottom of the box, and to its top (default: margin)
 * @returns {{x: Number, y: Number, width: Number, height: Number} | null}
 */
export function regionForGlyph(trace, item, font, { margin = 0, marginTop } = {}) {
	const t = readTrace(trace);
	if (!t) return null;

	// The glyph box, in font units, grown by the margins
	const box = glyphBoxFontUnits(item, font);
	const grow = positiveOr(margin, 0);
	const growTop = positiveOr(marginTop, grow);

	// Font units to image pixels: px = (fontX - x) / scale, py = (y - fontY) / scale
	let left = 0;
	let right = t.width;
	if (Number.isFinite(box.xMax)) {
		left = (box.xMin - grow - t.x) / t.scale;
		right = (box.xMax + grow - t.x) / t.scale;
	}
	let top = 0;
	let bottom = t.height;
	if (Number.isFinite(box.yMax)) {
		top = (t.y - (box.yMax + growTop)) / t.scale;
		bottom = (t.y - (box.yMin - grow)) / t.scale;
	}

	const x0 = Math.max(0, Math.floor(left + EDGE_EPSILON));
	const x1 = Math.min(t.width, Math.ceil(right - EDGE_EPSILON));
	const y0 = Math.max(0, Math.floor(top + EDGE_EPSILON));
	const y1 = Math.min(t.height, Math.ceil(bottom - EDGE_EPSILON));
	if (!(x1 > x0) || !(y1 > y0)) return null;

	return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * The glyph box in font units: x from 0 to the advance width, y from descent to ascent. A side
 * nothing limits (no advance width, no usable ascent / descent) is -Infinity / Infinity.
 * @param {Object} item - Glyph (glyph, ligature, or component)
 * @param {Object} font - project.settings.font (ascent, descent)
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number}}
 */
export function glyphBoxFontUnits(item, font) {
	const advance = Number(item?.advanceWidth);
	const hasWidth = Number.isFinite(advance) && advance > 0;
	const ascent = Number(font?.ascent);
	const descent = Number(font?.descent);
	const hasBand = Number.isFinite(ascent) && Number.isFinite(descent) && ascent > descent;
	return {
		xMin: hasWidth ? 0 : -Infinity,
		xMax: hasWidth ? advance : Infinity,
		yMin: hasBand ? descent : -Infinity,
		yMax: hasBand ? ascent : Infinity,
	};
}

/**
 * The shapes whose middle is inside the glyph box, plus accents and dots over them; a shape
 * inside another shape's bounding box goes with that shape (see the header).
 * @param {Array} shapes - Path objects in font units
 * @param {Object} item
 * @param {Object} font
 * @param {{crop?: {xMin: Number, xMax: Number, yMin: Number, yMax: Number}}} [area] - the
 *   traced area in font units, already shrunk by the caller's edge tolerance: only a shape
 *   wholly inside it can be kept as an accent (one it cuts is part of something else).
 *   Without it no accent is kept, as before.
 * @returns {Array} the kept shapes, in their original order
 */
export function keepShapesInGlyphBox(shapes, item, font, { crop } = {}) {
	if (!Array.isArray(shapes) || !shapes.length) return [];
	const box = glyphBoxFontUnits(item, font);
	const boxes = shapes.map(boundsOf);
	const parent = findParents(boxes);
	const n = shapes.length;

	// Outlines (no parent): kept when their middle is in the box
	const roots = [];
	const keepRoot = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		if (parent[i] >= 0) continue;
		roots.push(i);
		keepRoot[i] = middleInBox(boxes[i], box) ? 1 : 0;
	}

	// Accents and dots: an outline across the box whose middle is above or below it, wholly
	// inside the traced area, close over or under a larger kept outline it overlaps from
	// side to side
	const letters = roots.filter((i) => keepRoot[i] && boxes[i]).map((i) => boxes[i]);
	if (letters.length) {
		const upm = Number(font?.upm) > 0 ? Number(font.upm) : 1000;
		const gap = ACCENT_GAP_EM * upm;
		for (const i of roots) {
			if (keepRoot[i]) continue;
			const b = boxes[i];
			if (!b) continue;
			const cx = (b.xMin + b.xMax) / 2;
			if (!(cx >= box.xMin && cx <= box.xMax)) continue;
			if (!insideArea(b, crop)) continue;
			if (letters.some((letter) => marksLetter(b, letter, gap))) keepRoot[i] = 2;
		}
	}

	return followOutlines(shapes, parent, keepRoot);
}

/**
 * Everything follows its outermost outline: a shape is kept exactly when the outline it sits
 * in (through every level of nesting) is kept.
 * @param {Array} shapes
 * @param {Int32Array} parent - findParents
 * @param {Uint8Array} keepRoot - per outline (no parent): 1 keep, else drop
 * @returns {Array} the kept shapes, in their original order
 */
function followOutlines(shapes, parent, keepRoot) {
	const n = shapes.length;
	const keep = new Int8Array(n).fill(-1);
	const chain = [];
	for (let i = 0; i < n; i++) {
		let j = i;
		while (keep[j] < 0 && parent[j] >= 0 && chain.length <= n) {
			chain.push(j);
			j = parent[j];
		}
		const value = keep[j] >= 0 ? keep[j] : keepRoot[j] ? 1 : 0;
		keep[j] = value;
		for (const k of chain) keep[k] = value;
		chain.length = 0;
	}
	return shapes.filter((shape, i) => keep[i] === 1);
}

// --------------------------------------------------------------
// B9: the part he picked (Simple)
// --------------------------------------------------------------

/**
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} part - image pixels
 * @returns {Number} pixels of paper traced round it
 */
export function partMarginPx(part) {
	const p = readPart(part);
	if (!p) return PART_MARGIN_MIN_PX;
	const long = Math.max(p.right - p.left, p.bottom - p.top);
	return Math.max(PART_MARGIN_MIN_PX, Math.round(PART_MARGIN_SHARE * long));
}

/**
 * The part he picked, with paper round it, in the photo's pixels.
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} part - image pixels,
 *   right and bottom exclusive (ink_parts.js, or a box he drew)
 * @param {{width: Number, height: Number}} size - the photo (a trace works)
 * @param {{margin?: Number}} [options] - pixels round it (default partMarginPx)
 * @returns {{x: Number, y: Number, width: Number, height: Number} | null}
 */
export function regionForPart(part, size, { margin } = {}) {
	const p = readPart(part);
	const width = Number(size?.width);
	const height = Number(size?.height);
	if (!p || !(width > 0) || !(height > 0)) return null;
	const grow = margin === undefined ? partMarginPx(p) : positiveOr(margin, 0);
	const x0 = Math.max(0, Math.floor(p.left - grow));
	const y0 = Math.max(0, Math.floor(p.top - grow));
	const x1 = Math.min(width, Math.ceil(p.right + grow));
	const y1 = Math.min(height, Math.ceil(p.bottom + grow));
	if (!(x1 > x0) || !(y1 > y0)) return null;
	return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * @param {{left: Number, top: Number, right: Number, bottom: Number}} part - image pixels
 * @param {Object} trace - the photo's placement (x, y = top-left in font units, scale)
 * @returns {{xMin: Number, xMax: Number, yMin: Number, yMax: Number} | null}
 */
export function partBoxFontUnits(part, trace) {
	const p = readPart(part);
	const t = readTrace(trace);
	if (!p || !t) return null;
	return {
		xMin: t.x + p.left * t.scale,
		xMax: t.x + p.right * t.scale,
		yMin: t.y - p.bottom * t.scale,
		yMax: t.y - p.top * t.scale,
	};
}

/**
 * The whole shapes of the picked part (see the header).
 * @param {Array} shapes - Path objects in font units
 * @param {Object} part - image pixels
 * @param {Object} trace - the photo's placement
 * @param {{slack?: Number, pen?: Number, specks?: Boolean}} [options] - slack: font units round
 *   the box (default PART_SLACK_PX pixels); pen and specks: keepPenShapes
 * @returns {Array} the kept shapes, in their original order
 */
export function keepShapesInPart(shapes, part, trace, { slack, pen, specks = true } = {}) {
	if (!Array.isArray(shapes) || !shapes.length) return [];
	const area = partBoxFontUnits(part, trace);
	if (!area) return [];
	const grow = slack === undefined ? PART_SLACK_PX * Number(trace.scale) : positiveOr(slack, 0);
	const box = {
		xMin: area.xMin - grow,
		xMax: area.xMax + grow,
		yMin: area.yMin - grow,
		yMax: area.yMax + grow,
	};
	const boxes = shapes.map(boundsOf);
	const parent = findParents(boxes);
	const keepRoot = new Uint8Array(shapes.length);
	for (let i = 0; i < shapes.length; i++) {
		if (parent[i] < 0) keepRoot[i] = middleInBox(boxes[i], box) ? 1 : 0;
	}
	const kept = followOutlines(shapes, parent, keepRoot);
	return pen === undefined
		? kept
		: keepPenShapes(kept, { pen, scale: Number(trace.scale), specks });
}

/**
 * The traced outlines a pen made (see the header).
 * @param {Array} shapes - Path objects in font units
 * @param {{pen?: Number, scale?: Number, specks?: Boolean}} [options] - pen: the photo's pen in
 *   pixels; scale: font units per pixel; specks: Remove specks
 * @returns {Array} the kept shapes, in their original order
 */
export function keepPenShapes(shapes, { pen, scale, specks = true } = {}) {
	if (!Array.isArray(shapes) || !shapes.length) return [];
	const px = Number(pen) * Number(scale);
	if (!(px > 0) || !Number.isFinite(px)) return shapes;
	const outlines = shapes.map(flatten);
	// A shape inside another's bounding box is its hole (or a dot in its hole) only when it lies
	// inside that outline; a bit in the empty corner of an F's box is a piece of its own
	const parent = findParents(shapes.map(boundsOf)).map((p, i) =>
		p >= 0 && insidePolygon(outlines[i][0], outlines[p]) ? p : -1
	);
	const keepRoot = new Uint8Array(shapes.length);
	let pens = 0;
	let others = 0;
	for (let i = 0; i < shapes.length; i++) {
		if (parent[i] >= 0) continue;
		const { area, perimeter } = measureOf(outlines[i]);
		const thick = perimeter > 0 ? (2 * area) / perimeter : 0;
		const penMade = area >= SPECK_PEN_SHARE * px * px && thick >= THIN_PEN_SHARE * px;
		keepRoot[i] = penMade || !specks ? 1 : 0;
		if (penMade) pens++;
		else others++;
	}
	if (!pens) return [];
	if (!others || !specks) return shapes;
	return followOutlines(shapes, parent, keepRoot);
}

/**
 * An outline's area and length, its curves flattened.
 * @param {Object} shape - a Path (pathPoints with p, h1, h2)
 * @returns {{area: Number, perimeter: Number}} font units
 */
export function outlineMeasure(shape) {
	return measureOf(flatten(shape));
}

/** Area (shoelace) and length of a closed polygon [[x, y], ...]. */
function measureOf(polygon) {
	let area = 0;
	let perimeter = 0;
	for (let k = 0; k < polygon.length; k++) {
		const [x0, y0] = polygon[k];
		const [x1, y1] = polygon[(k + 1) % polygon.length];
		area += x0 * y1 - x1 * y0;
		perimeter += Math.hypot(x1 - x0, y1 - y0);
	}
	return { area: Math.abs(area) / 2, perimeter };
}

/** A Path's outline as a polygon, CURVE_STEPS points per curve ([] with fewer than 2 points). */
function flatten(shape) {
	const points = Array.isArray(shape?.pathPoints) ? shape.pathPoints : [];
	const n = points.length;
	const out = [];
	if (n < 2) return out;
	const xy = (cp) => [Number(cp?.x), Number(cp?.y)];
	for (let k = 0; k < n; k++) {
		const a = points[k];
		const b = points[(k + 1) % n];
		const [x0, y0] = xy(a?.p);
		const [x1, y1] = xy(a?.h2);
		const [x2, y2] = xy(b?.h1);
		const [x3, y3] = xy(b?.p);
		if (![x0, y0, x1, y1, x2, y2, x3, y3].every(Number.isFinite)) continue;
		for (let step = 0; step < CURVE_STEPS; step++) {
			const t = step / CURVE_STEPS;
			const u = 1 - t;
			out.push([
				u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
				u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
			]);
		}
	}
	return out;
}

/** True when point lies inside the polygon (even-odd); false without either. */
function insidePolygon(point, polygon) {
	if (!point || !polygon?.length) return false;
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

/**
 * The area to trace: Simple takes the part he picked; All tools (or no part) the glyph box.
 * @param {Object} trace
 * @param {Object} item
 * @param {Object} font
 * @param {{part?: Object, margin?: Number, marginTop?: Number}} [options]
 * @returns {{x: Number, y: Number, width: Number, height: Number} | null}
 */
export function regionFor(trace, item, font, { part, margin, marginTop } = {}) {
	if (part && isSimpleMode()) return regionForPart(part, trace);
	return regionForGlyph(trace, item, font, { margin, marginTop });
}

/**
 * The shapes to keep: Simple takes the part he picked; All tools (or no part) the glyph box.
 * @param {Array} shapes
 * @param {Object} item
 * @param {Object} font
 * @param {{part?: Object, trace?: Object, crop?: Object, pen?: Number, specks?: Boolean}} [options]
 *   pen and specks: keepPenShapes (Simple with a part only)
 * @returns {Array}
 */
export function keepShapesFor(shapes, item, font, { part, trace, crop, pen, specks } = {}) {
	if (part && isSimpleMode()) return keepShapesInPart(shapes, part, trace, { pen, specks });
	return keepShapesInGlyphBox(shapes, item, font, { crop });
}

/** A part's box as numbers, or null when it has no area. */
function readPart(part) {
	if (!part || typeof part !== 'object') return null;
	const left = Number(part.left);
	const top = Number(part.top);
	const right = Number(part.right);
	const bottom = Number(part.bottom);
	if (![left, top, right, bottom].every(Number.isFinite)) return null;
	if (!(right > left) || !(bottom > top)) return null;
	return { left, top, right, bottom };
}

/** Cells across the grid of findParents, at most (the grid is at most this square). */
const GRID_MAX = 64;

/**
 * Each shape's parent: the smallest other bounding box around it (two identical boxes: the
 * earlier one is the parent, never both), or -1. A grid over all the boxes keeps this near
 * linear: a box around another one also covers its middle, so only the boxes filed under
 * the grid cell of that middle are candidates. Same answers as comparing every pair.
 * @param {Array<Object | null>} boxes
 * @returns {Int32Array}
 */
function findParents(boxes) {
	const n = boxes.length;
	const parent = new Int32Array(n).fill(-1);
	let xMin = Infinity;
	let xMax = -Infinity;
	let yMin = Infinity;
	let yMax = -Infinity;
	for (const b of boxes) {
		if (!b) continue;
		if (b.xMin < xMin) xMin = b.xMin;
		if (b.xMax > xMax) xMax = b.xMax;
		if (b.yMin < yMin) yMin = b.yMin;
		if (b.yMax > yMax) yMax = b.yMax;
	}
	if (!(xMax >= xMin) || !(yMax >= yMin)) return parent;

	const grid = Math.max(1, Math.min(GRID_MAX, Math.ceil(Math.sqrt(n))));
	const cellW = (xMax - xMin) / grid || 1;
	const cellH = (yMax - yMin) / grid || 1;
	const col = (x) => Math.min(grid - 1, Math.max(0, Math.floor((x - xMin) / cellW)));
	const row = (y) => Math.min(grid - 1, Math.max(0, Math.floor((y - yMin) / cellH)));
	const cells = Array.from({ length: grid * grid }, () => []);
	for (let j = 0; j < n; j++) {
		const b = boxes[j];
		if (!b) continue;
		const c0 = col(b.xMin);
		const c1 = col(b.xMax);
		for (let r = row(b.yMin), r1 = row(b.yMax); r <= r1; r++) {
			for (let c = c0; c <= c1; c++) cells[r * grid + c].push(j);
		}
	}

	for (let i = 0; i < n; i++) {
		const b = boxes[i];
		if (!b) continue;
		const candidates = cells[row((b.yMin + b.yMax) / 2) * grid + col((b.xMin + b.xMax) / 2)];
		let best = -1;
		let bestArea = Infinity;
		for (const j of candidates) {
			const o = boxes[j];
			if (j === i || !contains(o, b)) continue;
			const area = (o.xMax - o.xMin) * (o.yMax - o.yMin);
			if (area < bestArea && !(sameBox(o, b) && j > i)) {
				best = j;
				bestArea = area;
			}
		}
		parent[i] = best;
	}
	return parent;
}

function middleInBox(b, box) {
	if (!b) return false;
	const cx = (b.xMin + b.xMax) / 2;
	const cy = (b.yMin + b.yMax) / 2;
	return cx >= box.xMin && cx <= box.xMax && cy >= box.yMin && cy <= box.yMax;
}

/** Wholly inside the traced area (no area given: never, so nothing is rescued). */
function insideArea(b, crop) {
	if (!crop) return false;
	return b.xMin > crop.xMin && b.xMax < crop.xMax && b.yMin > crop.yMin && b.yMax < crop.yMax;
}

/**
 * True when mark b belongs to letter: they overlap from side to side, b is smaller, and
 * the gap between them, above or below, is at most `gap` font units.
 */
function marksLetter(b, letter, gap) {
	if (!(b.xMax > letter.xMin && b.xMin < letter.xMax)) return false;
	const area = (r) => (r.xMax - r.xMin) * (r.yMax - r.yMin);
	if (!(area(b) < area(letter))) return false;
	const between = Math.max(b.yMin - letter.yMax, letter.yMin - b.yMax, 0);
	return between <= gap;
}

/** A shape's bounding box in font units (Path.maxes, else its points), or null. */
function boundsOf(shape) {
	try {
		const m = shape?.maxes;
		if (m && [m.xMin, m.xMax, m.yMin, m.yMax].every(Number.isFinite)) {
			return { xMin: m.xMin, xMax: m.xMax, yMin: m.yMin, yMax: m.yMax };
		}
	} catch {
		// fall back to the points
	}
	const points = Array.isArray(shape?.pathPoints) ? shape.pathPoints : [];
	const xs = points.map((pp) => Number(pp?.p?.x)).filter(Number.isFinite);
	const ys = points.map((pp) => Number(pp?.p?.y)).filter(Number.isFinite);
	if (!xs.length || !ys.length) return null;
	return {
		xMin: Math.min(...xs),
		xMax: Math.max(...xs),
		yMin: Math.min(...ys),
		yMax: Math.max(...ys),
	};
}

function contains(outer, inner) {
	return (
		outer.xMin <= inner.xMin &&
		outer.xMax >= inner.xMax &&
		outer.yMin <= inner.yMin &&
		outer.yMax >= inner.yMax
	);
}

function sameBox(a, b) {
	return a.xMin === b.xMin && a.xMax === b.xMax && a.yMin === b.yMin && a.yMax === b.yMax;
}

function positiveOr(value, fallback) {
	const n = Number(value);
	if (value === undefined || value === null || !Number.isFinite(n)) return fallback;
	return n > 0 ? n : 0;
}

/**
 * @param {Object} trace
 * @returns {{x: Number, y: Number, width: Number, height: Number, scale: Number} | null}
 */
function readTrace(trace) {
	if (!trace || typeof trace !== 'object') return null;
	const width = Number(trace.width);
	const height = Number(trace.height);
	const scale = Number(trace.scale);
	const x = Number(trace.x);
	const y = Number(trace.y);
	if (![width, height, scale].every(Number.isFinite)) return null;
	if (!(width > 0) || !(height > 0) || !(scale > 0)) return null;
	return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0, width, height, scale };
}
