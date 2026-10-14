// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing fixtures: fonts at the two grid sizes the engine is tested at (1,000 and 2,048
	units), and letter shapes drawn from the font's own lines, so every fixture scales with the
	grid. Used by the spacing unit tests and by tests/spacing.html.
	Also: an i with its dot drifted right, a g whose tail hooks left, shapes leaning like a
	slanted hand (shearShapes), and how close two letters come side by side (closestGap).
	Shapes are plain Path save objects ({ pathPoints }), ready for Glyph({ shapes }).
	Outer outlines run counter-clockwise (y-up), holes clockwise, as auto-trace makes them.
*/
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { inkBounds, rowExtent } from '../measure.js';
import { itemContours } from '../outline.js';

/** The two grid sizes. 2,048 is the app's default; 1,000 is the other common size. */
export const GRIDS = {
	1000: { upm: 1000, ascent: 800, descent: -200, capHeight: 700, xHeight: 500 },
	2048: { upm: 2048, ascent: 1550, descent: -440, capHeight: 1480, xHeight: 1100 },
};

const KAPPA = 0.5522847498;

/**
 * @param {Number} x
 * @param {Number} y
 * @returns {Object} a corner point
 */
export const at = (x, y) => ({ p: { coord: { x, y } } });

/**
 * A closed polygon. Points are [x, y] pairs; the order sets the winding.
 * @param {Array<Array<Number>>} points
 * @returns {{pathPoints: Array<Object>}}
 */
export function polygon(points) {
	return { pathPoints: points.map(([x, y]) => at(x, y)) };
}

/**
 * A rectangle, counter-clockwise (or clockwise for a hole).
 * @returns {{pathPoints: Array<Object>}}
 */
export function rect(x0, y0, x1, y1, { hole = false } = {}) {
	const points = [
		[x0, y0],
		[x1, y0],
		[x1, y1],
		[x0, y1],
	];
	return polygon(hole ? points.reverse() : points);
}

/**
 * An oval from four curve points, counter-clockwise (or clockwise for a hole).
 * @returns {{pathPoints: Array<Object>}}
 */
export function oval(cx, cy, rx, ry, { hole = false } = {}) {
	const kx = KAPPA * rx;
	const ky = KAPPA * ry;
	// Each point: where it is, the handle coming in, the handle going out (counter-clockwise)
	const ccw = [
		[cx + rx, cy, cx + rx, cy - ky, cx + rx, cy + ky],
		[cx, cy + ry, cx + kx, cy + ry, cx - kx, cy + ry],
		[cx - rx, cy, cx - rx, cy + ky, cx - rx, cy - ky],
		[cx, cy - ry, cx - kx, cy - ry, cx + kx, cy - ry],
	];
	const rows = hole ? ccw.reverse().map(([x, y, ix, iy, ox, oy]) => [x, y, ox, oy, ix, iy]) : ccw;
	return {
		pathPoints: rows.map(([x, y, ix, iy, ox, oy]) => ({
			p: { coord: { x, y } },
			h1: { coord: { x: ix, y: iy } },
			h2: { coord: { x: ox, y: oy } },
		})),
	};
}

/**
 * A ring: an oval with an oval hole, the stroke `weight` thick.
 * @returns {Array<Object>} two shapes
 */
export function ring(cx, cy, rx, ry, weight) {
	return [oval(cx, cy, rx, ry), oval(cx, cy, rx - weight, ry - weight, { hole: true })];
}

/**
 * Letter-like shapes for a font, from its lines. `x0` is where the ink starts.
 * The shapes only need to be the right kind of side for the letter (straight, round or
 * open); letters in the side table are classed by name, not by shape.
 * @param {String} char
 * @param {Object} font - GRIDS entry (or settings.font)
 * @param {Number} [x0] - left end of the ink
 * @returns {Array<Object>} shapes
 */
export function letterShapes(char, font, x0 = 100) {
	const x = font.xHeight;
	const cap = font.capHeight;
	const w = Math.round(x * 0.12); // stroke
	switch (char) {
		case 'H':
		case 'Ħ': {
			const width = Math.round(cap * 0.7);
			return [
				polygon([
					[x0, 0],
					[x0 + w, 0],
					[x0 + w, cap / 2 - w / 2],
					[x0 + width - w, cap / 2 - w / 2],
					[x0 + width - w, 0],
					[x0 + width, 0],
					[x0 + width, cap],
					[x0 + width - w, cap],
					[x0 + width - w, cap / 2 + w / 2],
					[x0 + w, cap / 2 + w / 2],
					[x0 + w, cap],
					[x0, cap],
				]),
			];
		}
		case 'n': {
			const width = Math.round(x * 0.8);
			return [
				polygon([
					[x0, 0],
					[x0 + w, 0],
					[x0 + w, x - 2 * w],
					[x0 + width - w, x - 2 * w],
					[x0 + width - w, 0],
					[x0 + width, 0],
					[x0 + width, x],
					[x0, x],
				]),
			];
		}
		case 'o':
		case 'ø':
			return ring(x0 + x * 0.45, x / 2, x * 0.45, x / 2, w);
		case 'c':
		case 'ɔ': {
			// A ring with its right quarter cut away (mirrored for ɔ): round on one side, open
			// on the other
			const r = x / 2;
			const cx = x0 + r;
			const arc = [];
			const steps = 24;
			for (let i = 0; i <= steps; i++) {
				const a = Math.PI / 4 + (i / steps) * (Math.PI * 1.5);
				arc.push([cx + r * Math.cos(a), r + r * Math.sin(a)]);
			}
			for (let i = steps; i >= 0; i--) {
				const a = Math.PI / 4 + (i / steps) * (Math.PI * 1.5);
				arc.push([cx + (r - w) * Math.cos(a), r + (r - w) * Math.sin(a)]);
			}
			const points = char === 'ɔ' ? arc.map(([px, py]) => [2 * cx - px, py]).reverse() : arc;
			return [polygon(points)];
		}
		case 'v': {
			const width = Math.round(x * 0.9);
			const mid = x0 + width / 2;
			return [
				polygon([
					[mid - w / 2, 0],
					[mid + w / 2, 0],
					[x0 + width, x],
					[x0 + width - w, x],
					[mid, w * 1.5],
					[x0 + w, x],
					[x0, x],
				]),
			];
		}
		case 'r':
			return [rect(x0, 0, x0 + w, x), rect(x0, x - w, x0 + x * 0.45, x)];
		case '.':
			return [oval(x0 + w * 0.75, w * 0.75, w * 0.75, w * 0.75)];
		case '!':
			return [rect(x0, cap * 0.3, x0 + w, cap), oval(x0 + w / 2, w * 0.6, w * 0.6, w * 0.6)];
		case "'":
			return [rect(x0, cap * 0.75, x0 + w, cap)];
		case 'f': {
			// The arm reaches right well past the stem: the letter's ink is wide at the top only
			const top = font.ascent;
			return [rect(x0, 0, x0 + w, top), rect(x0, top - w, x0 + x * 0.5, top)];
		}
		case 'l':
			return [rect(x0, 0, x0 + w, font.ascent)];
		case 'i':
			return dottedI(font, x0, 0);
		case 't': {
			// The bar reaches out on both sides of the stem at the small-letter line
			const stem = x0 + Math.round(x * 0.15);
			return [
				rect(stem, 0, stem + w, Math.round((x + font.ascent) / 2)),
				rect(x0, x - w, x0 + Math.round(x * 0.5), x),
			];
		}
		case 'y': {
			// A v whose right arm runs on down below the writing line
			const width = Math.round(x * 0.9);
			const mid = x0 + width / 2;
			const tail = Math.round(font.descent * 0.8);
			const drop = (mid - x0) * (tail / x);
			return [
				polygon([
					[mid - w / 2, 0],
					[mid + w / 2, 0],
					[mid + w / 2, w * 1.5],
					[x0 + w, x],
					[x0, x],
				]),
				polygon([
					[mid - w / 2 + drop, tail],
					[mid + w / 2 + drop, tail],
					[x0 + width, x],
					[x0 + width - w, x],
				]),
			];
		}
		case 'A': {
			const width = Math.round(cap * 0.8);
			const mid = x0 + width / 2;
			return [
				polygon([
					[x0, 0],
					[x0 + w, 0],
					[mid, cap - w * 1.5],
					[x0 + width - w, 0],
					[x0 + width, 0],
					[mid + w / 2, cap],
					[mid - w / 2, cap],
				]),
				rect(x0 + width * 0.25, cap * 0.3, x0 + width * 0.75, cap * 0.3 + w),
			];
		}
		case 'g':
			return tailedG(font, x0, { hook: 0 });
		default:
			// A plain block, x-height tall
			return [rect(x0, 0, x0 + Math.round(x * 0.6), x)];
	}
}

/**
 * An i: a stem from the writing line to the small-letter line and a square dot above it.
 * @param {Object} font - GRIDS entry
 * @param {Number} [x0] - left end of the stem
 * @param {Number} [dotShift] - how far right of straight above the stem the dot sits
 * @returns {Array<Object>} shapes
 */
export function dottedI(font, x0 = 100, dotShift = 0) {
	const x = font.xHeight;
	const w = Math.round(x * 0.12);
	const dot = x0 + dotShift;
	return [rect(x0, 0, x0 + w, x), rect(dot, x + w * 1.5, dot + w, x + w * 2.5)];
}

/**
 * A g: a round bowl, a stem on its right running down below the writing line, and a tail
 * along the bottom that ends under the bowl, or hooks `hook` units further left than the
 * bowl reaches.
 * @param {Object} font - GRIDS entry
 * @param {Number} [x0] - left end of the bowl
 * @param {{hook?: Number}} [options]
 * @returns {Array<Object>} shapes
 */
export function tailedG(font, x0 = 100, { hook = 0 } = {}) {
	const x = font.xHeight;
	const w = Math.round(x * 0.12);
	const r = x / 2;
	const bottom = Math.round(font.descent * 0.8);
	const tailStart = hook > 0 ? x0 - hook : x0 + r;
	return [
		...ring(x0 + r, r, r, r, w),
		rect(x0 + 2 * r - w, bottom, x0 + 2 * r, x),
		rect(tailStart, bottom, x0 + 2 * r, bottom + w),
	];
}

/**
 * Shapes leaning `degrees` to the right: every point (handles too) moves right by
 * tan(degrees) x its height above `about`, the way a slanted hand writes them.
 * @param {Array<Object>} shapes - Path save objects (as letterShapes makes them)
 * @param {Number} degrees - positive leans right
 * @param {Number} about - the height that stays put
 * @returns {Array<Object>} new shapes
 */
export function shearShapes(shapes, degrees, about) {
	const k = Math.tan((degrees * Math.PI) / 180);
	const move = (coord) => coord && { x: coord.x + k * (coord.y - about), y: coord.y };
	return shapes.map((shape) => ({
		pathPoints: shape.pathPoints.map((point) => ({
			p: { coord: move(point.p.coord) },
			...(point.h1 ? { h1: { coord: move(point.h1.coord) } } : {}),
			...(point.h2 ? { h2: { coord: move(point.h2.coord) } } : {}),
		})),
	}));
}

/**
 * How close two letters' inks come when set side by side (the second at the first's width,
 * no gap fix): the smallest left-to-right gap on any row where both have ink, in font units.
 * Negative when they overlap.
 * @param {Object} first - Glyph
 * @param {Object} second - Glyph
 * @param {Number} [step] - rows every this many units
 * @returns {Number | null} null when no row has ink in both
 */
export function closestGap(first, second, step = 1) {
	const a = itemContours(first);
	const b = itemContours(second);
	const boxA = inkBounds(first);
	const boxB = inkBounds(second);
	if (!a.length || !b.length || !boxA || !boxB) return null;
	const low = Math.max(boxA.yMin, boxB.yMin);
	const high = Math.min(boxA.yMax, boxB.yMax);
	let closest = null;
	for (let y = Math.floor(low) + 0.5; y < high; y += step) {
		const left = rowExtent(a, y);
		const right = rowExtent(b, y);
		if (!left || !right) continue;
		const gap = first.advanceWidth + right.left - left.right;
		if (closest === null || gap < closest) closest = gap;
	}
	return closest;
}

/**
 * A project at one grid size with the given letters in it.
 * @param {Number} grid - 1000 or 2048
 * @param {Object} [letters] - { char: { shapes?, advanceWidth?, anyink? } }; shapes default
 *   to letterShapes(char)
 * @returns {GlyphrStudioProject}
 */
export function spacingProject(grid = 2048, letters = {}) {
	const font = GRIDS[grid];
	const glyphs = {};
	Object.entries(letters).forEach(([char, spec]) => {
		const id = glyphId(char);
		glyphs[id] = {
			id,
			advanceWidth: spec.advanceWidth ?? 0,
			shapes: spec.shapes ?? letterShapes(char, font),
			anyink: spec.anyink ?? {},
		};
	});
	return new GlyphrStudioProject({
		settings: {
			project: {
				name: `Spacing ${grid}`,
				id: `g2_SPACING${grid}`,
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: `Spacing ${grid}`, ...font },
		},
		glyphs,
	});
}

/**
 * @param {String} char
 * @returns {String} the project id of a letter ('glyph-0x48')
 */
export function glyphId(char) {
	return `glyph-0x${char.codePointAt(0).toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * @param {Object} project
 * @param {String} char
 * @returns {Object} the Glyph
 */
export function letter(project, char) {
	return project.glyphs[glyphId(char)];
}

/**
 * A fake photo record (only the numbers the trace model keeps), placed so its left edge
 * sits `offset` units left of the letter's ink.
 * @param {Object} item - Glyph
 * @param {Number} [offset]
 * @returns {Object} trace
 */
export function photoUnder(item, offset = 30) {
	return {
		asset: 'img-fixture',
		width: 400,
		height: 300,
		x: item.maxes.xMin - offset,
		y: 1000,
		scale: 2.5,
		opacity: 0.25,
		visible: true,
		locked: true,
		invert: false,
	};
}
