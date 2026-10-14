// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 fix: both font file kinds store each point as a step from the one before it (CFF
	charstrings in an .otf, the glyf table in a .ttf), and a step holds -32,768 to 32,767.
	A bigger step wraps around and the shape comes back broken, so the check names it,
	even when every point on its own is in range. Each case is round-tripped through a real
	export so the test shows what the font file actually holds.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { PROBLEM, validateFont } from '../validate.js';
import { edgeProjectJSON, openProject, square } from './fixtures.js';

const TOO_FAR = 'small a has a point too far out for the font file to hold.';

/** A closed 4-point rectangle with straight sides. */
function rect(x0, y0, x1, y1) {
	return {
		name: 'Rect',
		pathPoints: [
			{ p: { coord: { x: x0, y: y0 } } },
			{ p: { coord: { x: x1, y: y0 } } },
			{ p: { coord: { x: x1, y: y1 } } },
			{ p: { coord: { x: x0, y: y1 } } },
		],
	};
}

/** The edge project with small a made of these shapes. */
function openA(shapes) {
	const json = edgeProjectJSON();
	json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 600, shapes };
	return openProject(json);
}

/** Every x and y small a has in the exported font file, after reading it back. */
async function roundTrip(suffix) {
	const buffer = await ioFont_exportFont(suffix, true);
	const glyph = FontFlux.open(buffer).glyphs.find((g) => g.unicode === 0x61);
	const points = glyph.contours.flat().filter((p) => typeof p.x === 'number');
	return {
		x: [Math.min(...points.map((p) => p.x)), Math.max(...points.map((p) => p.x))],
		y: [Math.min(...points.map((p) => p.y)), Math.max(...points.map((p) => p.y))],
	};
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('a step between neighboring points', () => {
	it('a rectangle from -20,000 to 20,000: every point fits, the 40,000 jump does not', async () => {
		const { project } = openA([rect(-20000, 0, 20000, 400)]);
		expect(validateFont(project)).toEqual([
			{ itemId: 'glyph-0x61', problem: PROBLEM.point, message: TOO_FAR },
		]);
		// what the font file really holds: the right side wrapped around to -45,536
		for (const suffix of ['otf', 'ttf']) {
			expect((await roundTrip(suffix)).x).not.toEqual([-20000, 20000]);
		}
	});

	it('a 32,000 jump fits and comes back exactly', async () => {
		const { project } = openA([rect(-16000, 0, 16000, 400)]);
		expect(validateFont(project)).toEqual([]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await roundTrip(suffix)).x).toEqual([-16000, 16000]);
		}
	});

	it('32,767 is the biggest step forward; 32,768 is one too many', async () => {
		let { project } = openA([rect(-16384, 0, 16383, 400)]);
		expect(validateFont(project)).toEqual([]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await roundTrip(suffix)).x).toEqual([-16384, 16383]);
		}

		({ project } = openA([rect(-16384, 0, 16384, 400)]));
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.point]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await roundTrip(suffix)).x).not.toEqual([-16384, 16384]);
		}
	});

	it('steps are measured after rounding, like the exporter writes them', () => {
		// 16,383.4 rounds to 16,383: a step of 32,767, which fits
		let { project } = openA([rect(-16384, 0, 16383.4, 400)]);
		expect(validateFont(project)).toEqual([]);
		// 16,383.6 rounds to 16,384: a step of 32,768, which doesn't
		({ project } = openA([rect(-16384, 0, 16383.6, 400)]));
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.point]);
	});

	it('the closing side, back to the first point, counts', async () => {
		const triangle = {
			name: 'Triangle',
			pathPoints: [
				{ p: { coord: { x: -16500, y: 0 } } },
				{ p: { coord: { x: 0, y: 10000 } } },
				{ p: { coord: { x: 16500, y: 0 } } },
			],
		};
		const { project } = openA([triangle]);
		// -16,500 to 0 and 0 to 16,500 fit; 16,500 back to -16,500 is a 33,000 jump
		expect(validateFont(project)).toEqual([
			{ itemId: 'glyph-0x61', problem: PROBLEM.point, message: TOO_FAR },
		]);
		// the .otf writes that closing side as a step, and it wraps
		expect((await roundTrip('otf')).x).not.toEqual([-16500, 16500]);
	});

	it('the jump from one shape to the next counts', async () => {
		const { project } = openA([square(-20000, 0, 400), square(19600, 0, 400)]);
		expect(validateFont(project)).toEqual([
			{ itemId: 'glyph-0x61', problem: PROBLEM.point, message: TOO_FAR },
		]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await roundTrip(suffix)).x).not.toEqual([-20000, 20000]);
		}
	});

	it('shapes close to each other are fine, wherever they sit', () => {
		const { project } = openA([square(-20000, 0, 400), square(-19000, 0, 400)]);
		expect(validateFont(project)).toEqual([]);
	});

	it('a curve handle is a step too', () => {
		const curve = {
			name: 'Curve',
			pathPoints: [
				{
					p: { coord: { x: 0, y: 0 } },
					h1: { coord: { x: 0, y: 0 } },
					h2: { coord: { x: 20000, y: 0 } },
					type: 'corner',
				},
				{
					p: { coord: { x: 100, y: 400 } },
					h1: { coord: { x: -20000, y: 400 } },
					h2: { coord: { x: 100, y: 400 } },
					type: 'corner',
				},
			],
		};
		// every number fits on its own; the handle-to-handle step is 40,000
		const { project } = openA([curve]);
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.point]);
	});

	it('a letter made from another letter is checked where the font file puts it', () => {
		const json = edgeProjectJSON();
		// A is a small square near 0; b is two copies of A, 39,600 apart
		json.glyphs['glyph-0x41'] = {
			id: 'glyph-0x41',
			advanceWidth: 600,
			shapes: [square(0, 0, 400)],
		};
		json.glyphs['glyph-0x62'] = {
			id: 'glyph-0x62',
			advanceWidth: 600,
			shapes: [
				{ link: 'glyph-0x41', translateX: -20000, translateY: 0 },
				{ link: 'glyph-0x41', translateX: 19600, translateY: 0 },
			],
		};
		const { project } = openProject(json);
		expect(validateFont(project).map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x62', PROBLEM.point],
		]);
	});
});

describe('the jump into the next shape starts where the shape before it closed (B1 fix pass)', () => {
	// Both file kinds close a shape on its first point and move on from there, so the point
	// stored just before the closing point doesn't matter. Measuring from it named shapes the
	// font file holds fine.
	const P = (x, y, h1, h2) => ({
		p: { coord: { x, y } },
		...(h1 ? { h1: { coord: { x: h1[0], y: h1[1] } } } : {}),
		...(h2 ? { h2: { coord: { x: h2[0], y: h2[1] } } } : {}),
	});
	const nextShape = { name: 'B', pathPoints: [P(15000, 0), P(15400, 0), P(15400, 400), P(15000, 400)] };

	/** Each shape's smallest and largest x in the exported file, after reading it back. */
	async function shapeSpans(suffix) {
		const buffer = await ioFont_exportFont(suffix, true);
		const glyph = FontFlux.open(buffer).glyphs.find((g) => g.unicode === 0x61);
		return glyph.contours.map((contour) => {
			const xs = contour.filter((p) => typeof p.x === 'number').map((p) => p.x);
			return [Math.min(...xs), Math.max(...xs)];
		});
	}

	it('straight closing side: a far point just before the close is not a problem', async () => {
		const first = { name: 'A', pathPoints: [P(0, 0), P(0, 400), P(-20000, 400), P(-20000, 0)] };
		const { project } = openA([first, nextShape]);
		expect(validateFont(project)).toEqual([]);
		for (const suffix of ['otf', 'ttf']) {
			expect(await shapeSpans(suffix), suffix).toEqual([
				[-20000, 0],
				[15000, 15400],
			]);
		}
	});

	it('curved closing side: a far curve handle just before the close is not a problem', async () => {
		const first = {
			name: 'A',
			pathPoints: [
				P(0, 0, [-20000, 0], [0, 0]),
				P(0, 400, [0, 400], [0, 400]),
				P(-1000, 400, [-1000, 400], [-1000, -2000]),
			],
		};
		const { project } = openA([first, nextShape]);
		expect(validateFont(project)).toEqual([]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await shapeSpans(suffix))[1], suffix).toEqual([15000, 15400]);
		}
	});

	it('a shape whose first point is far from the next shape is still named', async () => {
		const first = { name: 'A', pathPoints: [P(-20000, 0), P(-20000, 400), P(0, 400), P(0, 0)] };
		const { project } = openA([first, nextShape]);
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.point]);
		for (const suffix of ['otf', 'ttf']) {
			expect((await shapeSpans(suffix))[1], suffix).not.toEqual([15000, 15400]);
		}
	});
});

describe('the smallest number', () => {
	it('-32,768 fits in the font file, so it is not named', async () => {
		const { project } = openA([square(-32768, -32768, 400)]);
		expect(validateFont(project)).toEqual([]);
		for (const suffix of ['otf', 'ttf']) {
			const { x, y } = await roundTrip(suffix);
			expect(x).toEqual([-32768, -32368]);
			expect(y).toEqual([-32768, -32368]);
		}
	});

	it('-32,769 does not', () => {
		const { project } = openA([square(-32769, 0, 400)]);
		expect(validateFont(project).map((p) => p.problem)).toEqual([PROBLEM.point]);
	});
});
