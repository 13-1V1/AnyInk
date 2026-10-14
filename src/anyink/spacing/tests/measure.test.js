// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3: measuring ink (UX-BEGINNER 10, B3 measure.js): ink bounds, the stroke estimate
// (2 x area / perimeter of the largest piece), the measured side kinds for letters the table
// doesn't know, and medians that never count punctuation.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { merriweatherSans } from '../../../samples/merriweather_sans.js';
import { tableSides } from '../letter_classes.js';
import { isStrayShape } from '../../fontcheck/validate.js';
import { isStrayPath, itemContours } from '../outline.js';
import {
	inkBounds,
	measuredShares,
	measuredSides,
	median,
	medianOver,
	rowExtent,
	strokeEstimate,
} from '../measure.js';
import {
	GRIDS,
	at,
	glyphId,
	letter,
	letterShapes,
	oval,
	rect,
	ring,
	spacingProject,
} from './fixtures.js';

const glyph = (shapes, id = 'glyph-0x41') => new Glyph({ id, shapes });

describe('outline', () => {
	it('flattens straight and curved shapes into closed point lists with signed areas', () => {
		const [square] = itemContours(glyph([rect(0, 0, 100, 100)]));
		expect(square.points).toHaveLength(4);
		expect(square.area).toBeCloseTo(10000, 6);
		const [hole] = itemContours(glyph([rect(0, 0, 100, 100, { hole: true })]));
		expect(hole.area).toBeCloseTo(-10000, 6);
		const [circle] = itemContours(glyph([oval(0, 0, 100, 100)]));
		expect(circle.area / (Math.PI * 100 * 100)).toBeCloseTo(1, 2);
		expect(circle.perimeter / (2 * Math.PI * 100)).toBeCloseTo(1, 2);
	});

	it('judges stray shapes exactly as the font check does', () => {
		const curved = {
			pathPoints: [
				{ p: { coord: { x: 0, y: 0 } }, h2: { coord: { x: 50, y: 100 } } },
				{ p: { coord: { x: 200, y: 0 } } },
			],
		};
		const almost = {
			pathPoints: [
				{ p: { coord: { x: 0, y: 0 } }, h2: { coord: { x: 0.4, y: 0.3 } } },
				{ p: { coord: { x: 200, y: 0 } } },
			],
		};
		const shapes = glyph([
			{ pathPoints: [] },
			{ pathPoints: [at(0, 0)] },
			{ pathPoints: [at(0, 0), at(500, 500)] },
			curved,
			almost,
			rect(0, 0, 10, 10),
			oval(0, 0, 10, 10),
		]).shapes;
		const verdicts = shapes.map(isStrayPath);
		expect(verdicts).toEqual(shapes.map(isStrayShape));
		expect(verdicts).toEqual([false, true, true, false, true, false, false]);
	});

	it('leaves out empty shapes and stray 1- or 2-point lines', () => {
		const contours = itemContours(
			glyph([{ pathPoints: [] }, { pathPoints: [at(0, 0), at(500, 500)] }, rect(0, 0, 10, 10)])
		);
		expect(contours).toHaveLength(1);
	});
});

describe('inkBounds', () => {
	it('is the box around the ink, curves included', () => {
		expect(inkBounds(glyph([rect(10, -5, 110, 200)]))).toEqual({
			xMin: 10,
			xMax: 110,
			yMin: -5,
			yMax: 200,
		});
		const b = inkBounds(glyph([oval(300, 300, 100, 50)]));
		expect(b.xMin).toBeCloseTo(200, 6);
		expect(b.xMax).toBeCloseTo(400, 6);
		expect(b.yMin).toBeCloseTo(250, 6);
	});

	it('ignores stray lines and is null when there is no ink', () => {
		const stray = { pathPoints: [at(-900, 0), at(-800, 0)] };
		expect(inkBounds(glyph([stray, rect(10, 0, 20, 30)])).xMin).toBe(10);
		expect(inkBounds(glyph([]))).toBeNull();
		expect(inkBounds(glyph([stray]))).toBeNull();
		expect(inkBounds(null)).toBeNull();
	});
});

describe('strokeEstimate', () => {
	it('is exactly the stroke of a square ring', () => {
		const shapes = [rect(0, 0, 400, 400), rect(100, 100, 300, 300, { hole: true })];
		expect(strokeEstimate(glyph(shapes))).toBeCloseTo(100, 6);
	});

	it('is close to the stroke of a round ring and of a long bar', () => {
		expect(strokeEstimate(glyph(ring(500, 500, 400, 400, 80))) / 80).toBeCloseTo(1, 1);
		expect(strokeEstimate(glyph([rect(0, 0, 50, 1000)])) / 50).toBeGreaterThan(0.94);
	});

	it('uses the largest piece: the stem of an i, not its dot', () => {
		const i = [rect(0, 0, 60, 500), oval(30, 650, 50, 50)];
		expect(strokeEstimate(glyph(i))).toBeCloseTo((2 * 60 * 500) / (2 * 560), 6);
	});

	it('treats a crossing stroke drawn the same way round as ink, not as a hole', () => {
		// Two brush-like strokes crossing, the second starting inside the first: neither is a
		// hole (both fill), so the bigger one is measured whole
		const cross = [rect(0, 200, 600, 260), rect(270, 220, 330, 500)];
		expect(strokeEstimate(glyph(cross))).toBeCloseTo((2 * 60 * 600) / (2 * 660), 6);
	});

	it('is null with no ink', () => {
		expect(strokeEstimate(glyph([]))).toBeNull();
	});
});

describe('rowExtent', () => {
	it('finds the leftmost and rightmost ink on one row, holes inside ignored', () => {
		const contours = itemContours(glyph(ring(500, 500, 400, 400, 80)));
		const row = rowExtent(contours, 500);
		expect(row.left).toBeCloseTo(100, 0);
		expect(row.right).toBeCloseTo(900, 0);
		expect(rowExtent(contours, 2000)).toBeNull();
	});
});

describe.each([1000, 2048])('measured side kinds at %i units', (grid) => {
	const font = GRIDS[grid];
	const sides = (char) => measuredSides(glyph(letterShapes(char, font)), font);

	it('a stem on each side is straight on both sides', () => {
		expect(sides('Ħ')).toEqual({ left: 'S', right: 'S' });
		expect(sides('n')).toEqual({ left: 'S', right: 'S' });
	});

	it('a ring is round on both sides', () => {
		expect(sides('ø')).toEqual({ left: 'R', right: 'R' });
	});

	it('a c is round on the left and open on the right; a turned c the other way', () => {
		expect(sides('c')).toEqual({ left: 'R', right: 'O' });
		expect(sides('ɔ')).toEqual({ left: 'O', right: 'R' });
	});

	it('a v slants on both sides', () => {
		expect(sides('v')).toEqual({ left: 'O', right: 'O' });
	});

	it('ink that never reaches the small letters counts as open', () => {
		expect(sides("'")).toEqual({ left: 'O', right: 'O' });
	});

	it('has nothing to say about a letter with no ink', () => {
		expect(measuredSides(glyph([]), font)).toBeNull();
		expect(measuredShares(glyph([]), font)).toBeNull();
	});

	it('the shares behind the kinds: all of the height for a stem, about half for a bowl', () => {
		expect(measuredShares(glyph(letterShapes('n', font)), font)).toEqual({ left: 1, right: 1 });
		const ring = measuredShares(glyph(letterShapes('ø', font)), font);
		expect(ring.left).toBeGreaterThan(0.45);
		expect(ring.left).toBeLessThan(0.65);
	});
});

describe('measured side kinds on a real typeface', () => {
	it('agree with the side table on at least 85% of the letter sides of Merriweather Sans', () => {
		const project = importGlyphrProjectFromText(merriweatherSans);
		// The sample's old-format file loses its line heights on import; these are its own
		const font = { ...project.settings.font, xHeight: 1140, capHeight: 1522, ascent: 2014 };
		let agree = 0;
		let total = 0;
		[...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'].forEach((char) => {
			const measured = measuredSides(project.glyphs[glyphId(char)], font);
			const table = tableSides(char);
			total += 2;
			agree += (measured.left === table.left) + (measured.right === table.right);
		});
		expect(total).toBe(104);
		expect(agree / total).toBeGreaterThanOrEqual(0.85);
	});
});

describe('medians', () => {
	it('is the middle value, or the mean of the middle two', () => {
		expect(median([3, 1, 2])).toBe(2);
		expect(median([4, 1, 3, 2])).toBe(2.5);
		expect(median([])).toBeNull();
		expect(median([1, NaN, 3])).toBe(2);
	});

	it('never counts punctuation, and skips letters with no value', () => {
		const project = spacingProject(2048, {
			n: { shapes: [rect(0, 0, 100, 1100)] },
			o: { shapes: [rect(0, 0, 120, 1100)] },
			'.': { shapes: [rect(0, 0, 900, 900)] },
			',': { shapes: [rect(0, 0, 900, 900)] },
			x: { shapes: [] },
		});
		const items = ['n', 'o', '.', ',', 'x'].map((char) => letter(project, char));
		expect(medianOver(items, (item) => inkBounds(item)?.xMax)).toBe(110);
	});
});
