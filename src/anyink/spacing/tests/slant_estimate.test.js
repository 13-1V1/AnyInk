// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (finding 1): how the font's slant is found and kept. One slant for the whole font,
// read from the stems of the letters that have them (the side table's straight sides), so
// neighbors are always measured the same way. Each automatic letter keeps the slant it was
// fitted with (glyph.anyink.spacingSlant, whole degrees, like spacingExtra), so it rides along
// in Undo steps; the font's slant is the one its automatic letters carry, and it moves only
// when the stems say it is more than 1.5 degrees off, so a new letter rarely refits the font.
// The sides themselves (sides.js) are measured with it taken out.
import { describe, expect, it } from 'vitest';
import { ComponentInstance } from '../../../project_data/component_instance.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { fitAllAutomatic, fitSpacing, sideKinds, sitsAtFit, spacingBounds } from '../auto_space.js';
import { inkBounds, measuredSides } from '../measure.js';
import { itemContours } from '../outline.js';
import { bodyBand, referenceHeight, sideBounds } from '../sides.js';
import {
	SLANT_STEP,
	estimateSlant,
	fittedSlant,
	fontSlant,
	letterSlant,
	nextSlant,
	recordSlant,
	stemRuns,
} from '../slant.js';
import {
	GRIDS,
	dottedI,
	letter,
	letterShapes,
	oval,
	rect,
	ring,
	shearShapes,
	spacingProject,
} from './fixtures.js';

const AUTO = { spacing: 'auto' };
const tan = (degrees) => Math.tan((degrees * Math.PI) / 180);

function hand(grid, slants) {
	const font = GRIDS[grid];
	const letters = {};
	Object.entries(slants).forEach(([char, degrees]) => {
		letters[char] = { anyink: AUTO, shapes: shearShapes(letterShapes(char, font), degrees, 0) };
	});
	return spacingProject(grid, letters);
}

describe.each([1000, 2048])('reading the slant from stems at %i units', (grid) => {
	const font = GRIDS[grid];

	it('a leaning stem gives its own slant; a bowl and a short stub give none', () => {
		const minHeight = font.xHeight * 0.4;
		const [l] = itemContours(new Glyph({ shapes: shearShapes([rect(0, 0, 60, 800)], 20, 0) }));
		const runs = stemRuns(l.points, minHeight);
		// Up the left edge and down the right one
		expect(runs).toHaveLength(2);
		runs.forEach((run) => expect(run.slope).toBeCloseTo(tan(20), 9));
		runs.forEach((run) => expect(run.height).toBeCloseTo(800, 9));
		const [outer, inner] = itemContours(new Glyph({ shapes: ring(500, 500, 400, 400, 80) }));
		expect(stemRuns(outer.points, minHeight)).toEqual([]);
		expect(stemRuns(inner.points, minHeight)).toEqual([]);
		const [stub] = itemContours(new Glyph({ shapes: [rect(0, 0, 60, minHeight * 0.75)] }));
		expect(stemRuns(stub.points, minHeight)).toEqual([]);
		// Leaning further than 50 degrees is not a stem (a z's diagonal)
		const [flat] = itemContours(new Glyph({ shapes: shearShapes([rect(0, 0, 60, 800)], 55, 0) }));
		expect(stemRuns(flat.points, minHeight)).toEqual([]);
	});

	it('each letter with a straight side votes with its stems; others do not vote', () => {
		const project = hand(grid, { n: 15, H: 15, o: 15, v: 15, '!': 15 });
		expect(letterSlant(letter(project, 'n'), font)).toBeCloseTo(tan(15), 9);
		expect(letterSlant(letter(project, 'H'), font)).toBeCloseTo(tan(15), 9);
		// Round, open and punctuation: no vote
		expect(letterSlant(letter(project, 'o'), font)).toBeNull();
		expect(letterSlant(letter(project, 'v'), font)).toBeNull();
		expect(letterSlant(letter(project, '!'), font)).toBeNull();
	});

	it('a letter made only from other letters does not vote; its own shapes do', () => {
		const project = hand(grid, { n: 18, m: 0 });
		const n = letter(project, 'n');
		const m = letter(project, 'm');
		m.shapes = [];
		m.shapes.push(new ComponentInstance({ link: n.id, parent: m }));
		expect(letterSlant(m, font)).toBeNull();
	});

	it('the font slant is the middle vote, in degrees; null with no votes', () => {
		const project = hand(grid, { l: 18, n: 20, H: 21, u: 26, o: 0 });
		expect(estimateSlant(project)).toBeCloseTo(20.5, 6);
		expect(estimateSlant(hand(grid, { o: 10, v: 10, c: 10 }))).toBeNull();
		expect(estimateSlant(spacingProject(grid, {}))).toBeNull();
	});

	it('a letter changed in place is read again', () => {
		const project = hand(grid, { l: 20 });
		expect(estimateSlant(project)).toBeCloseTo(20, 6);
		const l = letter(project, 'l');
		l.shapes = shearShapes(letterShapes('l', font), 30, 0);
		expect(estimateSlant(project)).toBeCloseTo(30, 6);
	});
});

describe('keeping the slant', () => {
	/** Every letter of the font gets the record `degrees`, as if fitted with it */
	const recorded = (project, degrees) =>
		Object.values(project.glyphs).forEach((item) => recordSlant(item, degrees));

	it('each letter keeps the slant it was fitted with, in whole degrees; none when it is 0', () => {
		const project = spacingProject(2048, { l: { anyink: AUTO } });
		const l = letter(project, 'l');
		expect(fittedSlant(l)).toBe(0);
		expect(recordSlant(l, 19.6)).toBe(true);
		expect(l.anyink.spacingSlant).toBe(20);
		expect(fittedSlant(l)).toBe(20);
		expect(recordSlant(l, 20)).toBe(false);
		expect(recordSlant(l, 0)).toBe(true);
		expect(l.anyink).not.toHaveProperty('spacingSlant');
		l.anyink.spacingSlant = 'twenty';
		expect(fittedSlant(l)).toBe(0);
		l.anyink.spacingSlant = 89;
		expect(fittedSlant(l)).toBe(50);
	});

	it("the font's slant is the one its automatic letters were fitted with", () => {
		const project = hand(2048, { l: 20, n: 20, o: 20, H: 0 });
		expect(fontSlant(project)).toBe(0);
		recorded(project, 20);
		expect(fontSlant(project)).toBe(20);
		// Letters set by him, and letters with no ink, don't say
		letter(project, 'l').anyink.spacing = 'manual';
		recordSlant(letter(project, 'l'), -5);
		recordSlant(letter(project, 'H'), -5);
		letter(project, 'H').shapes = [];
		expect(fontSlant(project)).toBe(20);
	});

	it('rides along in the work file and in Undo copies of the letter', () => {
		const project = hand(2048, { l: 20 });
		fitAllAutomatic(project);
		const reloaded = new GlyphrStudioProject(JSON.parse(JSON.stringify(project.save())));
		expect(fittedSlant(letter(reloaded, 'l'))).toBe(20);
		expect(fontSlant(reloaded)).toBe(20);
		expect(fittedSlant(new Glyph(letter(reloaded, 'l').save()))).toBe(20);
	});

	it("a letter just inked (no record yet) does not pull the font's slant toward upright", () => {
		const project = hand(2048, { l: 20, n: 20 });
		recordSlant(letter(project, 'l'), 20);
		// n is automatic with ink but was never fitted: it says nothing about the font's slant
		expect(fontSlant(project)).toBe(20);
		fitSpacing(letter(project, 'n'), project);
		expect(fittedSlant(letter(project, 'n'))).toBe(20);
	});

	it('moves only when the stems say it is more than 1.5 degrees off', () => {
		expect(SLANT_STEP).toBe(1.5);
		const project = hand(2048, { l: 20 });
		expect(nextSlant(project)).toBe(20);
		recorded(project, 20);
		expect(nextSlant(project)).toBeNull();
		// A second letter a little steeper: the middle vote moves 1 degree, the font keeps 20
		const two = hand(2048, { l: 20, n: 22 });
		recorded(two, 20);
		expect(estimateSlant(two)).toBeCloseTo(21, 6);
		expect(nextSlant(two)).toBeNull();
		// Much steeper: it follows, to the nearest whole degree
		const three = hand(2048, { l: 20, n: 24, H: 24 });
		recorded(three, 20);
		expect(nextSlant(three)).toBe(24);
		// An upright hand's wobble never leaves 0
		expect(nextSlant(hand(2048, { l: 1.4, n: -1, H: 0.5 }))).toBeNull();
		expect(nextSlant(hand(2048, { l: 0, n: 0 }))).toBeNull();
	});

	it("fitAllAutomatic takes the stems' slant first, then fits; a second run changes nothing", () => {
		const project = hand(2048, { l: 20, o: 20 });
		expect(fitAllAutomatic(project).length).toBe(2);
		expect(fontSlant(project)).toBe(20);
		['l', 'o'].forEach((char) => expect(fittedSlant(letter(project, char))).toBe(20));
		expect(fitAllAutomatic(project)).toEqual([]);
		['l', 'o'].forEach((char) => expect(sitsAtFit(letter(project, char), project)).toBe(true));
	});
});

describe.each([1000, 2048])('measuring the sides at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = Math.round(font.xHeight * 0.08);

	it('upright and inside its lines, a letter measures exactly like its ink box', () => {
		const project = spacingProject(grid, { n: {}, o: {}, H: {}, v: {} });
		['n', 'o', 'H', 'v'].forEach((char) => {
			const item = letter(project, char);
			const box = inkBounds(item);
			expect(sideBounds(item, font, 0), char).toEqual({ xMin: box.xMin, xMax: box.xMax });
		});
		const curved = spacingProject(grid, { o: { shapes: [oval(333.3, 250.7, 211.45, 249.9)] } });
		const o = letter(curved, 'o');
		expect(sideBounds(o, font, 0).xMin).toBeCloseTo(inkBounds(o).xMin, 9);
		expect(sideBounds(o, font, 0).xMax).toBeCloseTo(inkBounds(o).xMax, 9);
	});

	it('leaning, its sides are where they would be standing up, turned about half the small-letter height', () => {
		expect(referenceHeight(font)).toBe(font.xHeight / 2);
		const upright = letter(spacingProject(grid, { l: {} }), 'l');
		const leaning = letter(hand(grid, { l: 20 }), 'l');
		const box = inkBounds(upright);
		const sides = sideBounds(leaning, font, 20);
		// The shear about the writing line moved the l right by tan x half the small-letter
		// height at the turning height
		const shift = tan(20) * referenceHeight(font);
		expect(sides.xMin).toBeCloseTo(box.xMin + shift, 6);
		expect(sides.xMax).toBeCloseTo(box.xMax + shift, 6);
	});

	it("the body band: the writing line up to the letter's own top line; none for punctuation", () => {
		expect(bodyBand('i', font)).toEqual({ low: 0, high: font.xHeight });
		expect(bodyBand('l', font)).toEqual({ low: 0, high: font.ascent });
		expect(bodyBand('É', font)).toEqual({ low: 0, high: font.capHeight });
		expect(bodyBand('t', font)).toEqual({ low: 0, high: (font.xHeight + font.ascent) / 2 });
		expect(bodyBand(',', font)).toBeNull();
		expect(bodyBand('', font)).toBeNull();
	});

	it('spacingBounds reads the font slant the letters are fitted with', () => {
		const project = hand(grid, { l: 20 });
		fitAllAutomatic(project);
		const l = letter(project, 'l');
		expect(spacingBounds(l, project)).toEqual(sideBounds(l, font, 20));
		// The fit moves whole units, and a leaning side measured upright isn't a whole number:
		// it lands within half a unit of G
		expect(Math.abs(spacingBounds(l, project).xMin - G)).toBeLessThanOrEqual(0.5);
	});

	it('an i with its dot drifted right measures from the stem only', () => {
		const project = spacingProject(grid, { i: { shapes: dottedI(font, 100, 200) } });
		const i = letter(project, 'i');
		const stem = Math.round(font.xHeight * 0.12);
		expect(sideBounds(i, font, 0)).toEqual({ xMin: 100, xMax: 100 + stem });
	});

	it('a crossbar drawn as its own stroke, a little above the capitals line, still counts', () => {
		const stroke = Math.round(font.xHeight * 0.12);
		const cap = font.capHeight;
		// A T written a bit tall: the stem reaches 1.05 x the capitals line and the bar, a stroke
		// of its own, sits across the stem's top; it is wider than the stem on both sides
		const top = Math.round(cap * 1.05);
		const project = spacingProject(grid, {
			T: { shapes: [rect(400, 0, 400 + stroke, top), rect(100, top - stroke, 700 + stroke, top)] },
		});
		expect(sideBounds(letter(project, 'T'), font, 0)).toEqual({ xMin: 100, xMax: 700 + stroke });
	});

	it('a figure drawn as two separate rings, one above the other, keeps both', () => {
		const cap = font.capHeight;
		const stroke = Math.round(font.xHeight * 0.12);
		// The top ring is wider and starts exactly where the bottom one ends
		const project = spacingProject(grid, {
			8: {
				shapes: [
					...ring(500, cap / 4, cap / 5, cap / 4, stroke),
					...ring(500, (3 * cap) / 4, cap / 3, cap / 4, stroke),
				],
			},
		});
		const eight = letter(project, '8');
		expect(sideBounds(eight, font, 0).xMin).toBeCloseTo(500 - cap / 3, 6);
		expect(sideBounds(eight, font, 0).xMax).toBeCloseTo(500 + cap / 3, 6);
	});

	it('a letter the table does not know is measured with the slant taken out', () => {
		// Ħ: two stems, measured; leaning 20 degrees it still has two straight sides
		const leaning = letter(hand(grid, { Ħ: 20 }), 'Ħ');
		expect(measuredSides(leaning, font, 20)).toEqual({ left: 'S', right: 'S' });
		expect(sideKinds(leaning, font, 20)).toMatchObject({
			left: 'S',
			right: 'S',
			source: 'measured',
		});
		// Measured upright, the lean hides its stems
		expect(measuredSides(leaning, font, 0)).not.toEqual({ left: 'S', right: 'S' });
	});
});
