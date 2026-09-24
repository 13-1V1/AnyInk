// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track B: which pixels of the trace image lie inside the glyph box
// (trace_region.js regionForGlyph). Font: ascent 800, descent -200. Glyph advance 600.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { makeTrace, scaleTraceFromCorner, traceBounds } from '../../trace/trace_model.js';
import { potraceSvgToShapes } from '../svg_to_shapes.js';
import {
	ACCENT_GAP_EM,
	ACCENT_MARGIN_EM,
	BOX_MARGIN_EM,
	glyphBoxFontUnits,
	keepShapesInGlyphBox,
	regionForGlyph,
} from '../trace_region.js';

const LETTER_O = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'letter_o.svg'),
	'utf8'
);

const FONT = { upm: 1000, ascent: 800, descent: -200 };
const ITEM = { advanceWidth: 600 };
const trace = (fields) => ({ asset: 'img-region01', ...fields });

describe('regionForGlyph', () => {
	it('an image fully inside the box gives the whole image', () => {
		// x 50..250, y 300..700
		const t = trace({ x: 50, y: 700, width: 100, height: 200, scale: 2 });
		expect(regionForGlyph(t, ITEM, FONT)).toEqual({ x: 0, y: 0, width: 100, height: 200 });
	});

	it('an image bigger than the box, with a negative x, gives the part inside the box', () => {
		// x -100..900, y 1000..-600; box x 0..600 -> px 50..350; y 800..-200 -> py 100..600
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 2 });
		expect(regionForGlyph(t, ITEM, FONT)).toEqual({ x: 50, y: 100, width: 300, height: 500 });
	});

	it('partly inside on one corner: clamped to the image', () => {
		// x 500..700, y 900..700; box right edge 600 -> px 0..50; ascent 800 -> py 50..100
		const t = trace({ x: 500, y: 900, width: 100, height: 100, scale: 2 });
		expect(regionForGlyph(t, ITEM, FONT)).toEqual({ x: 0, y: 50, width: 50, height: 50 });
	});

	it('an image outside the box gives null (right of it, above it, below it, left of it)', () => {
		expect(
			regionForGlyph(trace({ x: 700, y: 500, width: 50, height: 50, scale: 2 }), ITEM, FONT)
		).toBeNull();
		expect(
			regionForGlyph(trace({ x: 0, y: 1200, width: 50, height: 50, scale: 2 }), ITEM, FONT)
		).toBeNull();
		expect(
			regionForGlyph(trace({ x: 0, y: -300, width: 50, height: 50, scale: 2 }), ITEM, FONT)
		).toBeNull();
		expect(
			regionForGlyph(trace({ x: -200, y: 500, width: 50, height: 50, scale: 2 }), ITEM, FONT)
		).toBeNull();
	});

	it('an image that only touches the box edge gives null (no pixel is inside)', () => {
		// x 600..700: its left edge sits on the advance width
		expect(
			regionForGlyph(trace({ x: 600, y: 500, width: 50, height: 50, scale: 2 }), ITEM, FONT)
		).toBeNull();
	});

	it('follows a scale change: the same image at twice the scale covers half the pixels', () => {
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 2 });
		// scale 4: x -100..1900 -> px 25..175; y 1000..-2200 -> py 50..300
		expect(regionForGlyph({ ...t, scale: 4 }, ITEM, FONT)).toEqual({
			x: 25,
			y: 50,
			width: 150,
			height: 250,
		});
	});

	it('follows a resize made the way the Trace panel makes it (scaleTraceFromCorner)', () => {
		const start = makeTrace({ asset: 'img-region01', width: 400, height: 1000 }, FONT);
		// Default placement: top on the ascent, as tall as ascent - descent: all rows inside
		expect(regionForGlyph(start, ITEM, FONT)).toEqual({ x: 0, y: 0, width: 400, height: 1000 });
		// Drag the bottom-right corner out to twice the size (top-left stays put)
		const b = traceBounds(start);
		const bigger = scaleTraceFromCorner(start, 'se', {
			x: b.xMin + (b.xMax - b.xMin) * 2,
			y: b.yMax - (b.yMax - b.yMin) * 2,
		});
		expect(bigger.scale).toBeCloseTo(start.scale * 2, 9);
		// Now only the top half of the rows (and the columns up to x 600) are in the box
		expect(regionForGlyph(bigger, ITEM, FONT)).toEqual({ x: 0, y: 0, width: 300, height: 500 });
	});

	it('edges round outward, so a partly covered pixel is included', () => {
		// scale 3: box x 0..600 -> px 33.33..233.33 -> 33..234
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 3 });
		const r = regionForGlyph(t, ITEM, FONT);
		expect(r.x).toBe(33);
		expect(r.x + r.width).toBe(234);
		// y: (1000 - 800) / 3 = 66.67 -> 66; (1000 + 200) / 3 = 400 -> 400
		expect(r.y).toBe(66);
		expect(r.y + r.height).toBe(400);
	});

	it('floating-point noise on an exact edge does not add a pixel', () => {
		// x = 600 - 0.1 * 137 = 586.3, so the advance edge is exactly 137 px in; in floating
		// point (600 - 586.3) / 0.1 is 137.00000000000045, which a bare ceil makes 138
		const t = trace({ x: 586.3, y: 800, width: 300, height: 100, scale: 0.1 });
		expect((600 - t.x) / t.scale).toBeGreaterThan(137);
		expect(regionForGlyph(t, ITEM, FONT)).toEqual({ x: 0, y: 0, width: 137, height: 100 });
	});

	it('an item with no advance width (a component) is limited only by ascent and descent', () => {
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 2 });
		expect(regionForGlyph(t, { advanceWidth: 0 }, FONT)).toEqual({
			x: 0,
			y: 100,
			width: 500,
			height: 500,
		});
		expect(regionForGlyph(t, {}, FONT)).toEqual({ x: 0, y: 100, width: 500, height: 500 });
	});

	it('a font with no usable ascent / descent limits nothing vertically', () => {
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 2 });
		expect(regionForGlyph(t, ITEM, {})).toEqual({ x: 50, y: 0, width: 300, height: 800 });
		expect(regionForGlyph(t, ITEM, { ascent: -200, descent: 800 })).toEqual({
			x: 50,
			y: 0,
			width: 300,
			height: 800,
		});
	});

	it('a trace with no size or no scale gives null; an asset id is not needed', () => {
		expect(regionForGlyph(null, ITEM, FONT)).toBeNull();
		expect(regionForGlyph({ x: 0, y: 800, width: 0, height: 10, scale: 1 }, ITEM, FONT)).toBeNull();
		expect(
			regionForGlyph({ x: 0, y: 800, width: 10, height: 10, scale: 0 }, ITEM, FONT)
		).toBeNull();
		expect(
			regionForGlyph({ x: 0, y: 800, width: 10, height: 10, scale: 'big' }, ITEM, FONT)
		).toBeNull();
		expect(regionForGlyph({ x: 0, y: 800, width: 10, height: 10, scale: 1 }, ITEM, FONT)).toEqual({
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		});
	});

	it('works with a real glyph and the real font settings', () => {
		const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		const glyph = project.getItem('glyph-0x41'); // advance 530
		const font = project.settings.font; // ascent 800, descent -200
		const t = makeTrace({ asset: 'img-region01', width: 1000, height: 1000 }, font);
		// 1 unit per px, top-left (0, 800): columns 0..530 are inside, all rows
		expect(regionForGlyph(t, glyph, font)).toEqual({ x: 0, y: 0, width: 530, height: 1000 });
	});
});

describe('regionForGlyph with a margin (M8 integration)', () => {
	it('grows the box by the margin in font units on every side, still clamped', () => {
		// box px 50..350 x 100..600; 40 font units = 20 px each side
		const t = trace({ x: -100, y: 1000, width: 500, height: 800, scale: 2 });
		expect(regionForGlyph(t, ITEM, FONT, { margin: 40 })).toEqual({
			x: 30,
			y: 80,
			width: 340,
			height: 540,
		});
		expect(regionForGlyph(t, ITEM, FONT, { margin: 10000 })).toEqual({
			x: 0,
			y: 0,
			width: 500,
			height: 800,
		});
		expect(regionForGlyph(t, ITEM, FONT, { margin: -5 })).toEqual(regionForGlyph(t, ITEM, FONT));
	});
});

describe('glyphBoxFontUnits', () => {
	it('is 0..advance by descent..ascent; an unlimited side is infinite', () => {
		expect(glyphBoxFontUnits(ITEM, FONT)).toEqual({ xMin: 0, xMax: 600, yMin: -200, yMax: 800 });
		expect(glyphBoxFontUnits({ advanceWidth: 0 }, FONT)).toMatchObject({
			xMin: -Infinity,
			xMax: Infinity,
		});
		expect(glyphBoxFontUnits(ITEM, {})).toMatchObject({ yMin: -Infinity, yMax: Infinity });
	});
});

describe('keepShapesInGlyphBox (M8 integration: whole shapes, not a cut)', () => {
	// The traced O is 200 px square, ring radius 45..85 around (100, 100); at 2 fu per px it
	// is 340 fu wide: x from x + 30 to x + 370
	const tracedO = (x) => potraceSvgToShapes(LETTER_O, { x, y: 700, scale: 2 });

	it('keeps a letter whose middle is in the box whole, even where it passes the edge', () => {
		const shapes = tracedO(300); // x 330..670, past the advance 600; middle x 500
		expect(shapes).toHaveLength(2);
		const kept = keepShapesInGlyphBox(shapes, ITEM, FONT);
		expect(kept).toEqual(shapes);
		expect(Math.max(...kept.map((s) => s.maxes.xMax))).toBeGreaterThan(600);
	});

	it('drops a neighbor whose middle is outside, holes and all', () => {
		const inside = tracedO(100); // middle x 300
		const neighbor = tracedO(450); // middle x 650
		const kept = keepShapesInGlyphBox([...inside, ...neighbor], ITEM, FONT);
		expect(kept).toEqual(inside);
	});

	it('a hole goes with its outline, even when the hole alone would be kept', () => {
		const box = (x0, x1, y0, y1) => ({
			pathPoints: [
				{ p: { x: x0, y: y0 } },
				{ p: { x: x1, y: y0 } },
				{ p: { x: x1, y: y1 } },
				{ p: { x: x0, y: y1 } },
			],
		});
		const outline = box(500, 900, 0, 400); // middle x 700: outside
		const hole = box(520, 580, 100, 300); // middle x 550: inside on its own
		const dot = box(100, 200, 100, 200); // inside, on its own
		expect(keepShapesInGlyphBox([outline, hole, dot], ITEM, FONT)).toEqual([dot]);
		expect(keepShapesInGlyphBox([hole], ITEM, FONT)).toEqual([hole]);
	});

	it('a component (no advance width) is limited only by ascent and descent', () => {
		const high = potraceSvgToShapes(LETTER_O, { x: 5000, y: 1500, scale: 2 }); // middle y 1300
		const wide = tracedO(5000);
		expect(keepShapesInGlyphBox([...high, ...wide], { advanceWidth: 0 }, FONT)).toEqual(wide);
		expect(keepShapesInGlyphBox([], ITEM, FONT)).toEqual([]);
		expect(keepShapesInGlyphBox(null, ITEM, FONT)).toEqual([]);
	});
});

// --------------------------------------------------------------
// Fixes, 09/24/2026
// --------------------------------------------------------------

/** A plain shape with just a bounding box (what keepShapesInGlyphBox reads first). */
const boxShape = (xMin, xMax, yMin, yMax, name = '') => ({
	name,
	maxes: { xMin, xMax, yMin, yMax },
});

/** The old rule, pair by pair (O(n^2)): the reference the fast search must match. */
function referenceKeep(shapes, item, font) {
	const box = glyphBoxFontUnits(item, font);
	const boxes = shapes.map((s) => s.maxes);
	const contains = (o, b) =>
		o.xMin <= b.xMin && o.xMax >= b.xMax && o.yMin <= b.yMin && o.yMax >= b.yMax;
	const same = (a, b) =>
		a.xMin === b.xMin && a.xMax === b.xMax && a.yMin === b.yMin && a.yMax === b.yMax;
	const parent = boxes.map((b, i) => {
		let best = -1;
		let bestArea = Infinity;
		boxes.forEach((o, j) => {
			if (j === i || !contains(o, b)) return;
			const area = (o.xMax - o.xMin) * (o.yMax - o.yMin);
			if (area < bestArea && !(same(o, b) && j > i)) {
				best = j;
				bestArea = area;
			}
		});
		return best;
	});
	const root = (i) => (parent[i] >= 0 ? root(parent[i]) : i);
	return shapes.filter((s, i) => {
		const b = boxes[root(i)];
		const cx = (b.xMin + b.xMax) / 2;
		const cy = (b.yMin + b.yMax) / 2;
		return cx >= box.xMin && cx <= box.xMax && cy >= box.yMin && cy <= box.yMax;
	});
}

/** Deterministic specks spread over x -600..1200, y -400..1000, some inside letters. */
function specks(count, seed = 3) {
	let s = seed;
	const next = () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
	const out = [];
	for (let i = 0; i < count; i++) {
		const x = -600 + next() * 1800;
		const y = -400 + next() * 1400;
		const w = 1 + next() * 4;
		out.push(boxShape(x, x + w, y, y + w, `speck ${i}`));
	}
	return out;
}

describe('keepShapesInGlyphBox stays fast with tens of thousands of specks (fix)', () => {
	// A letter with a counter, a neighbor with a counter, twin boxes, and specks everywhere
	const letters = () => [
		boxShape(50, 550, -100, 700, 'letter'),
		boxShape(200, 400, 100, 500, 'counter'),
		boxShape(650, 1100, 0, 600, 'neighbor'),
		boxShape(700, 1000, 100, 500, 'neighbor counter'),
		boxShape(100, 150, 600, 650, 'twin a'),
		boxShape(100, 150, 600, 650, 'twin b'),
	];

	it('gives exactly what the pair-by-pair rule gives', () => {
		const shapes = [...letters(), ...specks(3000)];
		expect(keepShapesInGlyphBox(shapes, ITEM, FONT)).toEqual(referenceKeep(shapes, ITEM, FONT));
	});

	it('40,000 shapes take well under a second (the pair-by-pair rule took seconds)', () => {
		const shapes = [...letters(), ...specks(40000, 7)];
		const started = performance.now();
		const kept = keepShapesInGlyphBox(shapes, ITEM, FONT);
		const ms = performance.now() - started;
		expect(ms).toBeLessThan(400);
		expect(kept.map((s) => s.name)).toContain('counter');
		expect(kept.map((s) => s.name)).not.toContain('neighbor counter');
	});
});

describe('keepShapesInGlyphBox keeps accents and dots over a kept letter (fix)', () => {
	// Oblegg-like metrics: ascent = cap height 1490, descent -410, upm 2048; advance 1100
	const font = { upm: 2048, ascent: 1490, descent: -410 };
	const item = { advanceWidth: 1100 };
	// The traced area: the box plus 1/4 em (512 fu) on every side
	const crop = { xMin: -512, xMax: 1612, yMin: -922, yMax: 2002 };
	const body = boxShape(120, 980, 0, 1497, 'E body');
	const acute = boxShape(430, 760, 1565, 1969, 'acute');

	it('an É keeps its accent above the ascent', () => {
		expect(keepShapesInGlyphBox([body, acute], item, font, { crop })).toEqual([body, acute]);
	});

	it('a cedilla below the descent stays too, with its own hole', () => {
		const cedilla = boxShape(450, 700, -700, -380, 'cedilla');
		const hole = boxShape(500, 560, -600, -500, 'cedilla hole');
		expect(keepShapesInGlyphBox([body, cedilla, hole], item, font, { crop })).toEqual([
			body,
			cedilla,
			hole,
		]);
	});

	it('not rescued: cut by the edge of the traced area (the next line), beside the letter, or off to the side', () => {
		const nextLine = boxShape(300, 700, -922, -600, 'next line, cut by the crop');
		const straySide = boxShape(1050, 1400, 1600, 1700, 'middle past the advance width');
		const clear = boxShape(1000, 1090, 1600, 1700, 'no letter under it');
		const shapes = [body, nextLine, straySide, clear];
		expect(keepShapesInGlyphBox(shapes, item, font, { crop })).toEqual([body]);
	});

	it('without a kept letter nothing is rescued', () => {
		expect(keepShapesInGlyphBox([acute], item, font, { crop })).toEqual([]);
	});
});

// --------------------------------------------------------------
// Finalize, 09/24/2026
// --------------------------------------------------------------

describe('marks from the next line are not accents; tall accents are not cut (finalize)', () => {
	// Oblegg: upm 2048, ascent 1490, descent -410, a lowercase o with advance 1150
	const font = { upm: 2048, ascent: 1490, descent: -410 };
	const item = { advanceWidth: 1150 };
	const o = boxShape(150, 1000, -20, 1010, 'o');
	const counter = boxShape(350, 800, 180, 810, 'o counter');

	it('the dot of an i on the next line, wholly inside the margin under an o, stays out', () => {
		// The photo reaches down to y -1200: the whole margin under the o is traced
		const crop = { xMin: -510, xMax: 1660, yMin: -920, yMax: 2500 };
		const dot = boxShape(520, 628, -874, -766, 'i dot, next line');
		expect(keepShapesInGlyphBox([o, counter, dot], item, font, { crop })).toEqual([o, counter]);
	});

	it('a smudge over the ascent far above an o stays out; a mark bigger than the letter too', () => {
		const crop = { xMin: -510, xMax: 1660, yMin: -920, yMax: 2500 };
		const smudge = boxShape(500, 700, 1600, 1700, 'smudge');
		// A small mark in the box (a period high up) and a bigger blot just over it
		const period = boxShape(500, 600, 1300, 1480, 'mark in the box');
		const blot = boxShape(300, 900, 1500, 1900, 'blot bigger than the mark');
		expect(keepShapesInGlyphBox([o, counter, smudge], item, font, { crop })).toEqual([o, counter]);
		expect(keepShapesInGlyphBox([period, blot], item, font, { crop })).toEqual([period]);
	});

	it('an accent close over a capital is still kept, and so is one just within the gap', () => {
		const crop = { xMin: -510, xMax: 1660, yMin: -920, yMax: 2500 };
		const E = boxShape(120, 980, 0, 1497, 'E');
		const acute = boxShape(430, 760, 1565, 1969, 'acute');
		const far = boxShape(430, 760, 1497 + ACCENT_GAP_EM * 2048 - 1, 2100, 'just within');
		expect(ACCENT_GAP_EM).toBe(0.2);
		expect(keepShapesInGlyphBox([E, acute], item, font, { crop })).toEqual([E, acute]);
		expect(keepShapesInGlyphBox([E, far], item, font, { crop })).toEqual([E, far]);
	});

	it('the traced area reaches half an em over the ascent, so an accent up to y 2050 is whole', () => {
		expect([BOX_MARGIN_EM, ACCENT_MARGIN_EM]).toEqual([0.25, 0.5]);
		// A 2000 x 3000 photo at 1 fu per pixel, top-left at (-500, 2600)
		const t = trace({ x: -500, y: 2600, width: 2000, height: 3000, scale: 1 });
		const region = regionForGlyph(t, item, font, {
			margin: BOX_MARGIN_EM * 2048,
			marginTop: ACCENT_MARGIN_EM * 2048,
		});
		// Top: 1490 + 1024 = 2514 (py 86); bottom: -410 - 512 = -922 (py 3522, clamped)
		expect(region).toEqual({ x: 0, y: 86, width: 2000, height: 2914 });
		const top = t.y - region.y * t.scale;
		const tall = boxShape(430, 760, 1565, 2050, 'acute reaching 2050');
		const E = boxShape(120, 980, 0, 1497, 'E');
		const crop = { xMin: -500, xMax: 1500, yMin: -400, yMax: top - 2 };
		expect(keepShapesInGlyphBox([E, tall], item, font, { crop })).toEqual([E, tall]);
		// Without marginTop the top margin is the side margin, as before
		expect(regionForGlyph(t, item, font, { margin: 512 })).toMatchObject({ y: 598 });
	});
});
