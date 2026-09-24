// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track B: potrace SVG to upstream Paths in font units (svg_to_shapes.js),
// against real potrace output (tests/fixtures, traced by esm-potrace-wasm 0.5.1 in Chrome).
// Holes are checked with the rule the canvas and the font use (nonzero, geometry_helpers.js),
// and placements with crops and downscales are checked against trace_model's traceBounds.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { drawGlyph } from '../../../display_canvas/draw_paths.js';
import { ioSVG_convertSVGTagsToGlyph } from '../../../formats_io/svg_outlines/svg_outline_import.js';
import { Glyph } from '../../../project_data/glyph.js';
import { traceBounds } from '../../trace/trace_model.js';
import {
	countPoints,
	mapPixelToFont,
	potraceSvgToShapes,
	STRAIGHT_TOLERANCE_PX,
	svgShapeStats,
} from '../svg_to_shapes.js';
import {
	evenOddInk,
	flattenPath,
	gridPoints,
	nonzeroInk,
	signedArea,
	windingNumber,
} from './geometry_helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', `${name}.svg`), 'utf8');
const sidecar = (name) => JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'));

// A trace image the size of the fixture, placed like a real one: 2.5 font units per pixel,
// top-left corner at (-40, 900)
function traceFor(name, scale = 2.5) {
	const meta = sidecar(name);
	return { asset: 'img-fixture', width: meta.width, height: meta.height, x: -40, y: 900, scale };
}

/** Where a pixel of the trace image is drawn, from traceBounds (the canvas uses the same). */
function pixelOnTrace(trace, px, py) {
	const b = traceBounds(trace);
	return {
		x: b.xMin + (px * (b.xMax - b.xMin)) / trace.width,
		y: b.yMax - (py * (b.yMax - b.yMin)) / trace.height,
	};
}

const polygons = (shapes) => shapes.map((shape) => flattenPath(shape));
const boundsOf = (shape) => {
	const m = shape.maxes;
	return { xMin: m.xMin, xMax: m.xMax, yMin: m.yMin, yMax: m.yMax };
};
function expectBoundsClose(actual, expected, digits = 9) {
	for (const key of ['xMin', 'xMax', 'yMin', 'yMax']) {
		expect(actual[key], key).toBeCloseTo(expected[key], digits);
	}
}

/** Every grid point: nonzero fill equals even-odd fill, so no contour points the wrong way. */
function expectNonzeroMatchesGeometry(shapes) {
	const polys = polygons(shapes);
	const all = shapes.map(boundsOf).reduce((a, b) => ({
		xMin: Math.min(a.xMin, b.xMin),
		xMax: Math.max(a.xMax, b.xMax),
		yMin: Math.min(a.yMin, b.yMin),
		yMax: Math.max(a.yMax, b.yMax),
	}));
	let ink = 0;
	for (const point of gridPoints(all)) {
		const nz = nonzeroInk(polys, point);
		expect(nz).toBe(evenOddInk(polys, point));
		if (nz) ink++;
	}
	expect(ink).toBeGreaterThan(0);
}

describe('square_hole (64 x 64, a 48 px square with a 16 px hole)', () => {
	const trace = traceFor('square_hole');
	const place = { x: trace.x, y: trace.y, scale: trace.scale };
	const shapes = potraceSvgToShapes(fixture('square_hole'), place);

	it('gives 2 contours: the square and its hole, with opposite winding', () => {
		expect(shapes).toHaveLength(2);
		const [outer, hole] = polygons(shapes);
		// Outer counterclockwise in font units (y-up), hole clockwise: the CFF convention
		expect(signedArea(outer)).toBeGreaterThan(0);
		expect(signedArea(hole)).toBeLessThan(0);
		expect(Math.sign(shapes[0].winding)).toBe(1);
		expect(Math.sign(shapes[1].winding)).toBe(-1);
	});

	it('the hole stays a hole under the nonzero rule; the ring is ink; outside is paper', () => {
		const polys = polygons(shapes);
		const at = (px, py) => pixelOnTrace(trace, px, py);
		expect(windingNumber(polys, at(32, 32))).toBe(0); // middle of the hole
		expect(nonzeroInk(polys, at(16, 32))).toBe(true); // left side of the ring
		expect(nonzeroInk(polys, at(32, 50))).toBe(true); // bottom of the ring
		expect(nonzeroInk(polys, at(4, 4))).toBe(false); // paper around it
		expectNonzeroMatchesGeometry(shapes);
	});

	it('lands where the trace image shows the square and the hole', () => {
		const tl = pixelOnTrace(trace, 8, 8);
		const br = pixelOnTrace(trace, 56, 56);
		expectBoundsClose(boundsOf(shapes[0]), { xMin: tl.x, xMax: br.x, yMin: br.y, yMax: tl.y });
		const htl = pixelOnTrace(trace, 24, 24);
		const hbr = pixelOnTrace(trace, 40, 40);
		expectBoundsClose(boundsOf(shapes[1]), { xMin: htl.x, xMax: hbr.x, yMin: hbr.y, yMax: htl.y });
	});

	it('drops the points potrace leaves in the middle of straight edges (8 + 8 become 4 + 4)', () => {
		const raw = ioSVG_convertSVGTagsToGlyph(fixture('square_hole'), false);
		expect(countPoints(raw.shapes)).toBe(16);
		expect(shapes.map((s) => s.pathPoints.length)).toEqual([4, 4]);
		expect(countPoints(shapes)).toBe(8);
		// Same area as the pixels: 48 x 48 and 16 x 16, in font units
		const s2 = trace.scale * trace.scale;
		const [outer, hole] = polygons(shapes);
		expect(signedArea(outer)).toBeCloseTo(48 * 48 * s2, 6);
		expect(signedArea(hole)).toBeCloseTo(-16 * 16 * s2, 6);
	});

	it('the edit canvas fills with the nonzero rule (the rule checked above)', () => {
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		const fill = vi.spyOn(ctx, 'fill');
		drawGlyph(new Glyph({ shapes }), ctx, { dx: 0, dy: 0, dz: 1 });
		expect(fill).toHaveBeenCalledTimes(1);
		expect(fill).toHaveBeenCalledWith('nonzero');
	});
});

describe('letter_o (200 x 200 ring, radius 45 to 85)', () => {
	const trace = traceFor('letter_o', 4);
	const shapes = potraceSvgToShapes(fixture('letter_o'), {
		x: trace.x,
		y: trace.y,
		scale: trace.scale,
	});

	it('gives the outline and the counter with opposite winding, and the counter is empty', () => {
		expect(shapes).toHaveLength(2);
		const polys = polygons(shapes);
		expect(signedArea(polys[0])).toBeGreaterThan(0);
		expect(signedArea(polys[1])).toBeLessThan(0);
		const at = (px, py) => pixelOnTrace(trace, px, py);
		expect(windingNumber(polys, at(100, 100))).toBe(0);
		for (const angle of [0, 1, 2, 3, 4, 5]) {
			const px = 100 + 65 * Math.cos(angle);
			const py = 100 + 65 * Math.sin(angle);
			expect(nonzeroInk(polys, at(px, py)), `ring at angle ${angle}`).toBe(true);
		}
		expect(nonzeroInk(polys, at(100, 8))).toBe(false);
		expectNonzeroMatchesGeometry(shapes);
	});

	it('keeps the ring size (outer radius 85 px, inner 45 px, within a pixel)', () => {
		const outer = boundsOf(shapes[0]);
		const inner = boundsOf(shapes[1]);
		const s = trace.scale;
		expect((outer.xMax - outer.xMin) / s / 2).toBeGreaterThan(84);
		expect((outer.xMax - outer.xMin) / s / 2).toBeLessThan(86);
		expect((inner.xMax - inner.xMin) / s / 2).toBeGreaterThan(44);
		expect((inner.xMax - inner.xMin) / s / 2).toBeLessThan(46);
	});
});

describe('letter_a (Georgia bold A, 300 x 300, baseline at 250 px)', () => {
	const trace = traceFor('letter_a', 2);
	const shapes = potraceSvgToShapes(fixture('letter_a'), {
		x: trace.x,
		y: trace.y,
		scale: trace.scale,
	});

	it('has the counter: 2 contours, opposite winding, the counter is empty under nonzero', () => {
		expect(shapes).toHaveLength(2);
		const polys = polygons(shapes);
		expect(signedArea(polys[0])).toBeGreaterThan(0);
		expect(signedArea(polys[1])).toBeLessThan(0);
		// A point inside the counter's own outline is paper for the whole glyph
		const c = boundsOf(shapes[1]);
		const inCounter = { x: (c.xMin + c.xMax) / 2, y: c.yMin + (c.yMax - c.yMin) * 0.3 };
		expect(windingNumber([polys[1]], inCounter)).not.toBe(0);
		expect(windingNumber(polys, inCounter)).toBe(0);
		expectNonzeroMatchesGeometry(shapes);
	});

	it('sits on the baseline the image shows (bottom of the feet at 250 px)', () => {
		const bottom = Math.min(...shapes.map((s) => s.maxes.yMin));
		expect(bottom).toBeCloseTo(pixelOnTrace(trace, 0, 250).y, 6);
	});

	it('dropping straight-edge midpoints does not move the outline anywhere', () => {
		// The same SVG through upstream's importer with the placement applied by hand
		const raw = ioSVG_convertSVGTagsToGlyph(fixture('letter_a'), false).shapes;
		const mapped = raw.map((path) =>
			flattenPath(path).map((p) => ({
				x: trace.x + p.x * trace.scale,
				y: trace.y - p.y * trace.scale,
			}))
		);
		expect(countPoints(shapes)).toBeLessThan(countPoints(raw));
		const polys = polygons(shapes);
		for (const point of gridPoints(traceBounds(trace), 80)) {
			expect(nonzeroInk(polys, point)).toBe(evenOddInk(mapped, point));
		}
	});
});

describe('bullseye (ring, hole, and an island inside the hole)', () => {
	const trace = traceFor('bullseye', 3);
	const shapes = potraceSvgToShapes(fixture('bullseye'), {
		x: trace.x,
		y: trace.y,
		scale: trace.scale,
	});

	it('island is ink, hole is paper, ring is ink, outside is paper', () => {
		expect(shapes).toHaveLength(3);
		const polys = polygons(shapes);
		expect(polys.map((p) => Math.sign(signedArea(p)))).toEqual([1, -1, 1]);
		const at = (r) => pixelOnTrace(trace, 60 + r, 60);
		expect(nonzeroInk(polys, at(0))).toBe(true);
		expect(nonzeroInk(polys, at(27))).toBe(false);
		expect(nonzeroInk(polys, at(42))).toBe(true);
		expect(nonzeroInk(polys, at(56))).toBe(false);
		expectNonzeroMatchesGeometry(shapes);
	});
});

describe('letter_i (two separate shapes)', () => {
	it('gives the dot and the stem, both counterclockwise', () => {
		const trace = traceFor('letter_i', 2);
		const shapes = potraceSvgToShapes(fixture('letter_i'), {
			x: trace.x,
			y: trace.y,
			scale: trace.scale,
		});
		expect(shapes).toHaveLength(2);
		expect(polygons(shapes).map((p) => Math.sign(signedArea(p)))).toEqual([1, 1]);
		expect(shapes.map((s) => s.name)).toEqual(['Auto-trace 1', 'Auto-trace 2']);
		expectNonzeroMatchesGeometry(shapes);
	});
});

describe('same direction as upstream paste (flipNS then reverseWinding), so no reverseWinding', () => {
	for (const name of ['square_hole', 'letter_o', 'letter_a', 'bullseye', 'letter_i']) {
		it(name, () => {
			const upstream = ioSVG_convertSVGTagsToGlyph(fixture(name), false);
			upstream.flipNS();
			upstream.reverseWinding();
			const ours = potraceSvgToShapes(fixture(name), { x: 0, y: 0, scale: 1 });
			expect(ours.map((s) => Math.sign(signedArea(flattenPath(s))))).toEqual(
				upstream.shapes.map((s) => Math.sign(signedArea(flattenPath(s))))
			);
		});
	}
});

describe('placement: crops, downscales, and traceBounds', () => {
	it('an all-ink image traces to exactly the trace image bounds', () => {
		const trace = traceFor('solid_rect', 7.5);
		trace.x = -12.5;
		trace.y = 810;
		const [shape, ...rest] = potraceSvgToShapes(fixture('solid_rect'), {
			x: trace.x,
			y: trace.y,
			scale: trace.scale,
		});
		expect(rest).toHaveLength(0);
		expectBoundsClose(boundsOf(shape), traceBounds(trace));
		expect(shape.pathPoints).toHaveLength(4);
	});

	it('the same image traced after a 4x downscale still lands on traceBounds', () => {
		// The stored image is 160 x 120; the preview traced a 40 x 30 copy of it
		const trace = { asset: 'img-big', width: 160, height: 120, x: 30, y: 700, scale: 1.25 };
		const factor = 40 / 160;
		const [shape] = potraceSvgToShapes(fixture('solid_rect'), {
			x: trace.x,
			y: trace.y,
			scale: trace.scale / factor,
		});
		expectBoundsClose(boundsOf(shape), traceBounds(trace));
	});

	it('a cropped, downscaled region lands where the full image shows it (offsets)', () => {
		// Full image 512 x 384. The glyph box crop is x 100, y 60, 256 x 256, downscaled 4x to
		// the 64 x 64 fixture: its square (8..56 px) is 132..324 by 92..284 in the full image.
		const trace = { asset: 'img-big', width: 512, height: 384, x: -40, y: 900, scale: 1.25 };
		const factor = 64 / 256;
		const placement = {
			x: trace.x,
			y: trace.y,
			scale: trace.scale / factor,
			offsetX: 100 * factor,
			offsetY: 60 * factor,
		};
		const [outer, hole] = potraceSvgToShapes(fixture('square_hole'), placement);
		const box = (x0, y0, x1, y1) => {
			const a = pixelOnTrace(trace, x0, y0);
			const b = pixelOnTrace(trace, x1, y1);
			return { xMin: a.x, xMax: b.x, yMin: b.y, yMax: a.y };
		};
		expectBoundsClose(boundsOf(outer), box(132, 92, 324, 284));
		expectBoundsClose(boundsOf(hole), box(196, 156, 260, 220));

		// Folding the crop into x and y instead of offsets gives the very same shapes
		const folded = potraceSvgToShapes(fixture('square_hole'), {
			x: trace.x + 100 * trace.scale,
			y: trace.y - 60 * trace.scale,
			scale: trace.scale / factor,
		});
		expect(folded.map((s) => s.save())).toEqual([outer.save(), hole.save()]);
	});

	it('a downscale that is not a whole number still lands on the full image pixels', () => {
		// Crop 250 x 250 at (100, 60), downscaled to 64 x 64: factor 0.256
		const trace = { asset: 'img-big', width: 512, height: 384, x: 0, y: 800, scale: 2 };
		const factor = 64 / 250;
		const [outer] = potraceSvgToShapes(fixture('square_hole'), {
			x: trace.x,
			y: trace.y,
			scale: trace.scale / factor,
			offsetX: 100 * factor,
			offsetY: 60 * factor,
		});
		const a = pixelOnTrace(trace, 100 + 8 / factor, 60 + 8 / factor);
		const b = pixelOnTrace(trace, 100 + 56 / factor, 60 + 56 / factor);
		expectBoundsClose(boundsOf(outer), { xMin: a.x, xMax: b.x, yMin: b.y, yMax: a.y }, 6);
	});

	it('mapPixelToFont is the same mapping', () => {
		const placement = { x: 10, y: 700, scale: 2, offsetX: 3, offsetY: 5 };
		expect(mapPixelToFont(placement, 0, 0)).toEqual({ x: 16, y: 690 });
		expect(mapPixelToFont(placement, 7, 20)).toEqual({ x: 30, y: 650 });
		expect(mapPixelToFont({ x: 1, y: 2, scale: 1 }, 0, 0)).toEqual({ x: 1, y: 2 });
	});
});

describe('edges', () => {
	const place = { x: 0, y: 0, scale: 1 };

	it('an image with no ink (an SVG with no <path>) gives no shapes and no error box', () => {
		const blank =
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><g transform="translate(0,10) scale(0.1,-0.1)"></g></svg>';
		expect(potraceSvgToShapes(blank, place)).toEqual([]);
		expect(potraceSvgToShapes('', place)).toEqual([]);
		expect(potraceSvgToShapes(null, place)).toEqual([]);
		expect(document.querySelector('dialog, .dialog-box')).toBeNull();
	});

	it('a placement with no scale, a scale of 0, or a missing x refuses loudly', () => {
		const svg = fixture('square_hole');
		expect(() => potraceSvgToShapes(svg, { x: 0, y: 0 })).toThrow(TypeError);
		expect(() => potraceSvgToShapes(svg, { x: 0, y: 0, scale: 0 })).toThrow(TypeError);
		expect(() => potraceSvgToShapes(svg, { x: 0, y: 0, scale: -1 })).toThrow(TypeError);
		expect(() => potraceSvgToShapes(svg, { y: 0, scale: 1 })).toThrow(TypeError);
		expect(() => potraceSvgToShapes(svg, { x: 0, y: 0, scale: 1, offsetX: NaN })).toThrow(
			TypeError
		);
		expect(() => potraceSvgToShapes(svg, null)).toThrow(TypeError);
	});

	it('shapes are free-standing Paths named Auto-trace N', () => {
		const shapes = potraceSvgToShapes(fixture('square_hole'), place);
		for (const shape of shapes) {
			expect(shape.objType).toBe('Path');
			expect(shape.parent).toBe(false);
		}
		expect(shapes.map((s) => s.name)).toEqual(['Auto-trace 1', 'Auto-trace 2']);
	});

	it('a handle that is not in use is parked beside its point, like a new point in upstream', () => {
		const [outer] = potraceSvgToShapes(fixture('square_hole'), { x: 500, y: 500, scale: 3 });
		for (const pp of outer.pathPoints) {
			const length = pp.defaultHandleLength;
			expect(length).toBeGreaterThan(0);
			expect(pp.h1.use).toBe(false);
			expect(pp.h2.use).toBe(false);
			expect(pp.h1.coord.x).toBeCloseTo(pp.p.coord.x - length, 9);
			expect(pp.h2.coord.x).toBeCloseTo(pp.p.coord.x + length, 9);
			expect(pp.h1.coord.y).toBeCloseTo(pp.p.coord.y, 9);
			expect(pp.h2.coord.y).toBeCloseTo(pp.p.coord.y, 9);
			// ...and, not in use, they still read as the point itself
			expect(pp.h1.x).toBe(pp.p.x);
			expect(pp.h2.y).toBe(pp.p.y);
		}
	});

	it('curve handles are mapped with their points', () => {
		const trace = traceFor('letter_o', 4);
		const [outer] = potraceSvgToShapes(fixture('letter_o'), {
			x: trace.x,
			y: trace.y,
			scale: trace.scale,
		});
		const used = outer.pathPoints.filter((pp) => pp.h1.use && pp.h2.use);
		expect(used.length).toBeGreaterThan(3);
		const b = traceBounds(trace);
		for (const pp of used) {
			for (const h of [pp.h1, pp.h2]) {
				expect(h.x).toBeGreaterThanOrEqual(b.xMin - 1e-9);
				expect(h.x).toBeLessThanOrEqual(b.xMax + 1e-9);
				expect(h.y).toBeGreaterThanOrEqual(b.yMin - 1e-9);
				expect(h.y).toBeLessThanOrEqual(b.yMax + 1e-9);
			}
		}
	});

	it('the straight-edge tolerance is below potrace output precision (a tenth of a pixel)', () => {
		expect(STRAIGHT_TOLERANCE_PX).toBeLessThan(0.1);
		expect(STRAIGHT_TOLERANCE_PX).toBeGreaterThan(0.05);
	});
});

describe('countPoints', () => {
	it('adds up path points and ignores anything that is not a path', () => {
		const shapes = potraceSvgToShapes(fixture('letter_o'), { x: 0, y: 0, scale: 1 });
		const expected = shapes[0].pathPoints.length + shapes[1].pathPoints.length;
		expect(countPoints(shapes)).toBe(expected);
		expect(countPoints([...shapes, { objType: 'ComponentInstance' }, null])).toBe(expected);
		expect(countPoints([])).toBe(0);
		expect(countPoints(null)).toBe(0);
		expect(countPoints(undefined)).toBe(0);
	});
});

// --------------------------------------------------------------
// Counting before converting (fix, 09/24/2026)
// --------------------------------------------------------------

describe('svgShapeStats: shapes and points of potrace SVG, without converting it', () => {
	it('matches what the importer makes from every fixture', () => {
		for (const name of [
			'letter_a',
			'letter_o',
			'letter_i',
			'bullseye',
			'square_hole',
			'solid_rect',
		]) {
			const svg = fixture(name);
			const glyph = ioSVG_convertSVGTagsToGlyph(svg, false);
			const shapes = glyph.shapes.filter((shape) => shape.objType === 'Path');
			const stats = svgShapeStats(svg);
			expect(stats.shapes, name).toBe(shapes.length);
			expect(stats.points, name).toBe(countPoints(shapes));
			// Dropping the straight midpoints only ever lowers the count
			expect(countPoints(potraceSvgToShapes(svg, { x: 0, y: 0, scale: 1 }))).toBeLessThanOrEqual(
				stats.points
			);
		}
	});

	it('counts 44,000 specks in a blink, where converting them froze the app for seconds', () => {
		const speck = 'M10 20 l5 0 0 5 -5 0 0 -5z ';
		const svg = `<svg><g transform="translate(0,100) scale(0.1,-0.1)"><path d="${speck.repeat(
			44000
		)}"/></g></svg>`;
		const started = performance.now();
		const stats = svgShapeStats(svg);
		expect(performance.now() - started).toBeLessThan(300);
		expect(stats).toEqual({ shapes: 44000, points: 44000 * 4 });
	});

	it('is zero for no path, or not a string', () => {
		expect(svgShapeStats('<svg><g></g></svg>')).toEqual({ shapes: 0, points: 0 });
		expect(svgShapeStats(null)).toEqual({ shapes: 0, points: 0 });
	});
});
