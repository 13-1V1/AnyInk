// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 checks test letters: shapes drawn from the font's own lines (the B3 spacing fixtures do
	the plain letters), plus the ones B11's tests name: a j with its hook and dot, a felt-tip i
	(a dot wider than the stem, drifted right), a long g tail that hooks left past its edge, a Q
	whose tail hangs, a comma, a question mark, a colon, and stray specks. Every font is spaced by
	B3's own fitter (every letter automatic), so widths are the ones the app would give.
	Shapes are plain Path save objects, outer outlines counter-clockwise, holes clockwise.
	B10 + B11 fix pass (the critic's "the tests miss every case above"): a p and a q with a real
	bowl and stem, a y written as a u with a tail, a tiny comma and a comma written as a slash,
	a plain-stroke I and 1, and real Brush strokes (the B8 pipeline: nib/ink.js inkStroke, the
	round nib's ends included, tagged and recorded as the Brush does) drawn into a letter.
*/
import { inkStroke } from '../../nib/ink.js';
import {
	addStrokeRecord,
	newStrokeKey,
	nextStrokeId,
	strokeName,
	tagStroke,
} from '../../nib/stroke_record.js';
import { strokePaths } from '../../nib/stroke_shapes.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import {
	GRIDS,
	dottedI,
	letter,
	letterShapes,
	oval,
	polygon,
	rect,
	ring,
	spacingProject,
	tailedG,
} from '../../spacing/tests/fixtures.js';

export { GRIDS, letter, oval, polygon, rect, ring };

export const FONT = GRIDS[2048];
/** The stroke the fixtures draw with: 12 % of the small-letter height */
export const STROKE = Math.round(FONT.xHeight * 0.12);
export const AUTO = { spacing: 'auto' };

/**
 * Shapes for one letter at the default grid. Letters the B3 fixtures draw come from there.
 * @param {String} char
 * @param {Number} [x0] - left end of the ink
 * @returns {Array<Object>}
 */
export function shapesFor(char, x0 = 100) {
	const font = FONT;
	const x = font.xHeight;
	const cap = font.capHeight;
	const w = STROKE;
	switch (char) {
		case 'j':
			return hookedJ(x0, 0);
		case 'i':
			return dottedI(font, x0, 0);
		case 'g':
			return tailedG(font, x0);
		case 'e':
		case 'a':
			return ring(x0 + x * 0.45, x / 2, x * 0.45, x / 2, w);
		case 'b':
		case 'd':
		case 'h':
		case 'k':
			return [rect(x0, 0, x0 + w, font.ascent), ...ring(x0 + x * 0.45, x / 2, x * 0.45, x / 2, w)];
		case 'B':
		case 'E':
			return [rect(x0, 0, x0 + Math.round(cap * 0.6), cap)];
		case 'Q':
			return tailedQ(x0, 0.2);
		case ',':
			return comma(x0);
		case '?':
			return [
				rect(x0, cap * 0.35, x0 + w, cap),
				rect(x0 - w * 2, cap - w, x0 + w, cap),
				oval(x0 + w / 2, w * 0.6, w * 0.6, w * 0.6),
			];
		case ':':
			return [
				oval(x0 + w * 0.7, w * 0.7, w * 0.7, w * 0.7),
				oval(x0 + w * 0.7, x - w * 0.7, w * 0.7, w * 0.7),
			];
		case ';':
			return [...comma(x0), oval(x0 + w * 0.7, x - w * 0.7, w * 0.7, w * 0.7)];
		default:
			return letterShapes(char, font, x0);
	}
}

/**
 * A j: a stem from the small-letter line to 80 % of the tail line, a hook at its foot reaching
 * `hook` units left of the stem, and a square dot `dotShift` right of straight above the stem.
 * @returns {Array<Object>}
 */
export function hookedJ(x0 = 100, hook = 160, dotShift = 0) {
	const x = FONT.xHeight;
	const w = STROKE;
	const bottom = Math.round(FONT.descent * 0.8);
	return [
		rect(x0, bottom, x0 + w, x),
		rect(x0 - hook, bottom, x0 + w, bottom + w),
		rect(x0 + dotShift, x + w * 1.5, x0 + dotShift + w, x + w * 2.5),
	];
}

/**
 * A felt-tip i: the stem, and a round dot as wide as 1.6 strokes, drifted `drift` units right
 * and written a little low.
 * @returns {Array<Object>}
 */
export function feltTipI(x0 = 100, drift = 90) {
	const x = FONT.xHeight;
	const w = STROKE;
	const r = w * 0.8;
	return [rect(x0, 0, x0 + w, x), oval(x0 + w / 2 + drift, x + w * 1.6, r, r)];
}

/**
 * A g whose tail runs long: down to the tail line and hooking `hook` units left past the bowl.
 * @returns {Array<Object>}
 */
export function longTailG(x0 = 100, hook = 160) {
	const x = FONT.xHeight;
	const w = STROKE;
	const r = x / 2;
	const bottom = FONT.descent; // right on the tail line
	return [
		...ring(x0 + r, r, r, r, w),
		rect(x0 + 2 * r - w, bottom, x0 + 2 * r, x),
		rect(x0 - hook, bottom, x0 + 2 * r, bottom + w),
	];
}

/**
 * A Q: a round bowl on the writing line (1.5 % under it, as a round letter sits) and a tail
 * crossing its foot that hangs `drop` of the letter box under the writing line.
 * @returns {Array<Object>}
 */
export function tailedQ(x0 = 100, drop = 0.2) {
	const cap = FONT.capHeight;
	const w = STROKE;
	const over = Math.round(FONT.upm * 0.015);
	const r = (cap + 2 * over) / 2;
	const cy = cap / 2;
	const low = -Math.round(drop * FONT.upm);
	return [
		...ring(x0 + r, cy, r, r, w),
		polygon([
			[x0 + r, w * 2],
			[x0 + r + w, w * 2 + w],
			[x0 + 2 * r + w, low + w],
			[x0 + 2 * r, low],
		]),
	];
}

/**
 * A comma: a round head sitting on the writing line and a tail down and to the left. (B10 + B11
 * fix pass: the tail is drawn counter-clockwise, as ink; drawn the other way round it was a
 * hole in the head, so this comma had no tail at all.)
 * @param {Number} [x0]
 * @param {Number} [dy] - how far up (+) or down (-) the whole comma is moved
 * @returns {Array<Object>}
 */
export function comma(x0 = 100, dy = 0) {
	const w = STROKE;
	const r = w * 0.75;
	const cx = x0 + w;
	return [
		oval(cx, r + dy, r, r),
		polygon([
			[cx + r * 0.2, r + dy],
			[cx - r * 0.9, -Math.round(FONT.xHeight * 0.3) + dy],
			[cx - r * 0.6, -Math.round(FONT.xHeight * 0.3) + dy],
			[cx + r, r + dy],
		]),
	];
}

/**
 * A p or a q: a round bowl on the writing line and a stem from the small-letter line down to
 * 80 % of the tail line, on the bowl's left (p) or right (q).
 * @param {'p' | 'q'} char
 * @param {Number} [x0]
 * @returns {Array<Object>}
 */
export function bowlAndStem(char, x0 = 100) {
	const x = FONT.xHeight;
	const w = STROKE;
	const r = x / 2;
	const bottom = Math.round(FONT.descent * 0.8);
	const stem = char === 'p' ? x0 : x0 + 2 * r - w;
	return [...ring(x0 + r, r, r, r, w), rect(stem, bottom, stem + w, x)];
}

/**
 * A y written as a u whose right stem runs on down into a tail hooking left.
 * @returns {Array<Object>}
 */
export function uTailY(x0 = 100) {
	const x = FONT.xHeight;
	const w = STROKE;
	const width = Math.round(x * 0.8);
	const bottom = Math.round(FONT.descent * 0.8);
	return [
		polygon([
			[x0, x],
			[x0, 0],
			[x0 + width - w, 0],
			[x0 + width - w, w],
			[x0 + w, w],
			[x0 + w, x],
		]),
		rect(x0 + width - w, bottom, x0 + width, x),
		rect(x0 + w, bottom, x0 + width, bottom + w),
	];
}

/**
 * A comma written small: a round head `size` units across sitting on the writing line, and a
 * short tail.
 * @returns {Array<Object>}
 */
export function tinyComma(x0 = 100, size = 50) {
	const r = size / 2;
	const cx = x0 + r;
	return [
		oval(cx, r, r, r),
		polygon([
			[cx, r],
			[cx - r, -size],
			[cx - r * 0.5, -size],
			[cx + r, r],
		]),
	];
}

/**
 * A comma written as one short slash of the pen, from `top` down and to the left.
 * @returns {Array<Object>}
 */
export function slashComma(x0 = 100, top = 40) {
	const w = Math.round(STROKE * 0.6);
	return [
		polygon([
			[x0 + 120, top],
			[x0, top - 300],
			[x0 + w, top - 300],
			[x0 + 120 + w, top],
		]),
	];
}

/**
 * A Brush stroke drawn into a letter the way the Brush puts it there (nib/commit.js without
 * the editor): inked with the round nib, one shape per outline, tagged, and its record kept.
 * @param {Object} item - Glyph
 * @param {Array<[Number, Number]>} points - the pen's path, font units
 * @param {Number} size - the nib's width
 * @returns {Array<Object>} the shapes
 */
export function brushInto(item, points, size) {
	const ink = inkStroke(points, { size });
	const id = nextStrokeId(item);
	const key = newStrokeKey();
	const shapes = strokePaths(ink.contours, { name: strokeName(id) }).map((path, part) => {
		const shape = item.addOneShape(path);
		tagStroke(shape, id, { key, part });
		return shape;
	});
	addStrokeRecord(item, { id, key, size: ink.size, skeleton: ink.skeleton, shapes });
	return shapes;
}

/**
 * The pen's path along a straight line, a point every few units.
 * @returns {Array<[Number, Number]>}
 */
export function penLine([x0, y0], [x1, y1], step = 4) {
	const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
	return Array.from({ length: count + 1 }, (_, i) => [
		x0 + ((x1 - x0) * i) / count,
		y0 + ((y1 - y0) * i) / count,
	]);
}

/**
 * The pen's path along part of a circle (degrees, counterclockwise).
 * @returns {Array<[Number, Number]>}
 */
export function penArc(cx, cy, r, from, to, step = 4) {
	const sweep = ((to - from) * Math.PI) / 180;
	const count = Math.max(1, Math.ceil((Math.abs(sweep) * r) / step));
	return Array.from({ length: count + 1 }, (_, i) => {
		const a = (from * Math.PI) / 180 + (sweep * i) / count;
		return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
	});
}

/**
 * A square speck, `size` units across, its lower left corner at (x, y).
 * @returns {Object}
 */
export function speck(x, y, size = 30) {
	return rect(x, y, x + size, y + size);
}

/**
 * Shapes moved by (dx, dy) (handles too).
 * @param {Array<Object>} shapes
 * @returns {Array<Object>}
 */
export function moved(shapes, dx = 0, dy = 0) {
	const move = (coord) => coord && { x: coord.x + dx, y: coord.y + dy };
	return shapes.map((shape) => ({
		pathPoints: shape.pathPoints.map((point) => ({
			p: { coord: move(point.p.coord) },
			...(point.h1 ? { h1: { coord: move(point.h1.coord) } } : {}),
			...(point.h2 ? { h2: { coord: move(point.h2.coord) } } : {}),
		})),
	}));
}

/**
 * Shapes scaled by k about (ox, oy) (handles too).
 * @returns {Array<Object>}
 */
export function scaled(shapes, k, ox = 100, oy = 0) {
	const map = (coord) => coord && { x: ox + (coord.x - ox) * k, y: oy + (coord.y - oy) * k };
	return shapes.map((shape) => ({
		pathPoints: shape.pathPoints.map((point) => ({
			p: { coord: map(point.p.coord) },
			...(point.h1 ? { h1: { coord: map(point.h1.coord) } } : {}),
			...(point.h2 ? { h2: { coord: map(point.h2.coord) } } : {}),
		})),
	}));
}

/**
 * A font at the default grid with these letters, every one automatic and spaced by B3.
 * @param {Object<String, Array<Object> | {shapes: Array<Object>, advanceWidth?: Number,
 *   anyink?: Object}>} letters - char -> shapes, or a spec; a char with null gets shapesFor(char)
 * @param {{fit?: Boolean}} [options] - fit: false keeps the widths as given (0 by default)
 * @returns {Object} GlyphrStudioProject
 */
export function checksFont(letters, { fit = true } = {}) {
	const specs = {};
	Object.entries(letters).forEach(([char, value]) => {
		if (Array.isArray(value)) specs[char] = { shapes: value, anyink: { ...AUTO } };
		else if (value && typeof value === 'object') specs[char] = { anyink: { ...AUTO }, ...value };
		else specs[char] = { shapes: shapesFor(char), anyink: { ...AUTO } };
	});
	const project = spacingProject(2048, specs);
	if (fit) fitAllAutomatic(project);
	return project;
}

/**
 * @param {String} chars - e.g. 'Bnoe'
 * @returns {Object<String, null>} for checksFont
 */
export function plain(chars) {
	return Object.fromEntries([...chars].map((char) => [char, null]));
}
