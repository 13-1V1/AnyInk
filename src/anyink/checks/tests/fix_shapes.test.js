// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 fixes, the shapes part (UX-BEGINNER.md 4.2, 7.2, section 10 B11): where a letter's body
// ends, the move and the scales that Sit on the line, Match size and Shrink to fit make (the
// photo moves with the ink, every point whole), the specks rule (dots of i j ! ? : ; never),
// and Fix it's rounding and refit.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { MAX_WIDTH as FONT_FILE_MAX_WIDTH } from '../../fontcheck/validate.js';
import { lineTargets } from '../../placement/classes.js';
import { sitsAtFit } from '../../spacing/auto_space.js';
import { inkBounds } from '../../spacing/measure.js';
import { isAutomatic } from '../../spacing/owner.js';
import { dottedI, oval, rect, ring, spacingProject } from '../../spacing/tests/fixtures.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import {
	MAX_WIDTH,
	applyPlan,
	bodyBottom,
	fontFileFix,
	removeSpeckShapes,
	seatPlan,
	shrinkPlan,
	sizePlan,
	speckShapeGroups,
} from '../fix_shapes.js';
import { FONT, glyphId, photo, shapesOf, speck } from './fix_fixtures.js';

/** A letter of a 1,000-unit font, shapes as given */
function letterOf(char, shapes, { advanceWidth = 600, anyink = {} } = {}) {
	const project = spacingProject(1000, { [char]: { shapes, advanceWidth, anyink } });
	return { project, item: project.glyphs[glyphId(char)] };
}

/** Every point and handle in use, as numbers */
function numbers(item) {
	const out = [];
	item.shapes.forEach((shape) =>
		shape.pathPoints.forEach((point) => {
			out.push(point.p.coord.x, point.p.coord.y);
			if (point.h1.use) out.push(point.h1.coord.x, point.h1.coord.y);
			if (point.h2.use) out.push(point.h2.coord.x, point.h2.coord.y);
		})
	);
	return out;
}

describe('bodyBottom', () => {
	it('is the ink bottom of a letter with no tail', () => {
		const { item } = letterOf('n', shapesOf('n', { dy: 80 }));
		expect(bodyBottom(item, FONT)).toBe(80);
	});

	it("stops at the bowl of a g whose tail hangs, not at the tail's end", () => {
		const { item } = letterOf('g', shapesOf('g'));
		expect(inkBounds(item).yMin).toBeLessThan(-100);
		// The bowl is a ring sitting on the writing line
		expect(Math.abs(bodyBottom(item, FONT))).toBeLessThan(5);
	});

	it("stops at a comma's head, not at the end of its tail", () => {
		const head = oval(130, 60, 30, 30);
		const tail = rect(110, -90, 125, 40);
		const { item } = letterOf(',', [head, tail]);
		const bottom = bodyBottom(item, FONT);
		expect(bottom).toBeGreaterThan(10);
		expect(bottom).toBeLessThan(45);
	});
});

describe('Sit on the line (seatPlan)', () => {
	it('moves a floating letter down onto the writing line, the photo with it', () => {
		const { item } = letterOf('n', shapesOf('n', { dy: 80 }));
		setTrace(item, photo({ y: 980 }));
		const plan = seatPlan(item, FONT);
		expect(plan).toMatchObject({ k: 1, dy: -80 });
		expect(applyPlan(item, plan)).toBe(true);
		expect(inkBounds(item).yMin).toBe(0);
		expect(getTrace(item).y).toBe(900);
		expect(getTrace(item).scale).toBe(2);
	});

	it('lifts a sunken letter, and puts a round one 1.5 % of the letter box under the line', () => {
		const sunk = letterOf('n', shapesOf('n', { dy: -60 })).item;
		expect(seatPlan(sunk, FONT).dy).toBe(60);
		const round = letterOf('o', shapesOf('o', { dy: 50 })).item;
		applyPlan(round, seatPlan(round, FONT));
		expect(Math.round(inkBounds(round).yMin)).toBe(lineTargets('o', FONT).bottom);
	});

	it('has nothing to do on a letter already on the line', () => {
		expect(seatPlan(letterOf('n', shapesOf('n')).item, FONT)).toBeNull();
	});
});

describe('Match size (sizePlan)', () => {
	it('scales a letter 40 % too tall to its line, from its left ink edge, seated', () => {
		const { item } = letterOf('n', shapesOf('n', { k: 1.4, dy: 30 }));
		setTrace(item, photo({ x: 60, y: 900, scale: 2 }));
		const before = inkBounds(item);
		applyPlan(item, sizePlan(item, FONT));
		const after = inkBounds(item);
		expect(after.yMin).toBe(0);
		expect(after.yMax).toBe(500);
		expect(after.xMin).toBe(before.xMin);
		expect(Math.round(after.xMax - after.xMin)).toBe(Math.round((before.xMax - before.xMin) / 1.4));
		// The photo scaled through the same map: 1 / 1.4 of its size
		expect(getTrace(item).scale).toBeCloseTo(2 / 1.4, 6);
		expect(numbers(item).every(Number.isInteger)).toBe(true);
	});

	it('sizes a capital by the capitals line and a tall letter by the top line', () => {
		const H = letterOf('H', shapesOf('H', { k: 0.6 })).item;
		applyPlan(H, sizePlan(H, FONT));
		expect(inkBounds(H).yMax).toBe(700);
		const l = letterOf('l', shapesOf('l', { k: 0.7 })).item;
		applyPlan(l, sizePlan(l, FONT));
		expect(inkBounds(l).yMax).toBe(800);
	});
});

describe('Shrink to fit (shrinkPlan)', () => {
	it('brings a letter poking past the top line back under it, on the writing line', () => {
		const { item } = letterOf('l', shapesOf('l', { k: 1.25 }));
		expect(inkBounds(item).yMax).toBe(1000);
		applyPlan(item, shrinkPlan(item, FONT));
		expect(inkBounds(item).yMax).toBeLessThanOrEqual(800);
		expect(inkBounds(item).yMin).toBe(0);
	});

	it('brings a tail poking past the tail line back above it', () => {
		const { item } = letterOf('y', shapesOf('y', { k: 1.9 }));
		expect(inkBounds(item).yMin).toBeLessThan(-250);
		applyPlan(item, shrinkPlan(item, FONT));
		expect(inkBounds(item).yMin).toBeGreaterThanOrEqual(-200);
	});

	it('has nothing to do on a letter inside the lines', () => {
		expect(shrinkPlan(letterOf('l', shapesOf('l')).item, FONT)).toBeNull();
	});
});

describe('specks', () => {
	it('finds pieces of ink much smaller than the stroke, beside the letter or in its hole', () => {
		const shapes = [...shapesOf('n'), speck(700, 300), speck(800, 100, 15)];
		const { item } = letterOf('n', shapes);
		expect(speckShapeGroups(item)).toHaveLength(2);
		const o = letterOf('o', [...ring(325, 250, 225, 250, 60), speck(315, 240)]).item;
		expect(speckShapeGroups(o)).toHaveLength(1);
	});

	it('never takes a piece sitting directly above or below another', () => {
		const { item } = letterOf('n', [...shapesOf('n'), speck(200, 560)]);
		expect(speckShapeGroups(item)).toHaveLength(0);
	});

	it('never calls the dot of i, j, !, ?, : or ; a speck, a drifted or felt-tip dot either', () => {
		const font = FONT;
		const fine = (char, shapes) =>
			expect(speckShapeGroups(letterOf(char, shapes).item)).toEqual([]);
		fine('i', dottedI(font, 100, 0));
		// A small dot drifted right of the stem
		fine('i', [rect(100, 0, 160, 500), rect(175, 560, 190, 575)]);
		// A felt-tip dot: round, wider than the stem
		fine('i', [rect(100, 0, 160, 500), oval(130, 600, 45, 45)]);
		fine('j', [rect(100, -150, 160, 500), rect(118, 560, 132, 574)]);
		fine('!', [rect(100, 210, 160, 700), oval(130, 30, 12, 12)]);
		fine('?', [rect(100, 210, 260, 700), oval(130, 30, 12, 12)]);
		fine(':', [rect(100, 0, 114, 14), rect(100, 400, 114, 414)]);
		fine(';', [rect(100, 400, 114, 414), rect(100, -80, 112, 14)]);
	});

	it('takes the specks out and leaves the letter', () => {
		const { item } = letterOf('n', [...shapesOf('n'), speck(700, 300), speck(800, 100, 15)]);
		expect(removeSpeckShapes(item)).toBe(2);
		expect(item.shapes).toHaveLength(1);
		expect(speckShapeGroups(item)).toEqual([]);
	});
});

describe('Fix it (fontFileFix)', () => {
	it('rounds every point, takes stray lines out and fits an automatic letter', () => {
		const n = moved(shapesOf('n'), 0.4);
		const stray = {
			pathPoints: [{ p: { coord: { x: 10, y: 10 } } }, { p: { coord: { x: 40, y: 10 } } }],
		};
		const { item, project } = letterOf('n', [...n, stray], {
			advanceWidth: 0,
			anyink: { spacing: 'auto' },
		});
		expect(fontFileFix(item, project)).toBe(true);
		expect(item.shapes).toHaveLength(1);
		expect(numbers(item).every(Number.isInteger)).toBe(true);
		expect(item.advanceWidth).toBeGreaterThan(0);
		expect(sitsAtFit(item, project)).toBe(true);
	});

	it('makes a letter with ink and no width automatic, and fits it', () => {
		const { item, project } = letterOf('n', shapesOf('n'), {
			advanceWidth: 0,
			anyink: { spacing: 'manual' },
		});
		expect(fontFileFix(item, project)).toBe(true);
		expect(isAutomatic(item)).toBe(true);
		expect(Number.isInteger(item.advanceWidth) && item.advanceWidth > 0).toBe(true);
	});

	it('gives a space with no width a quarter of the letter box', () => {
		const project = spacingProject(1000, {});
		const space = new Glyph({ id: 'glyph-0x20', advanceWidth: 0 });
		space.parent = project;
		expect(fontFileFix(space, project)).toBe(true);
		expect(space.advanceWidth).toBe(250);
	});

	it('changes nothing on a letter the font file can hold', () => {
		const { item, project } = letterOf('n', shapesOf('n'), { anyink: { spacing: 'manual' } });
		expect(fontFileFix(item, project)).toBe(false);
	});

	it("holds widths to the font file's own limit", () => {
		expect(MAX_WIDTH).toBe(FONT_FILE_MAX_WIDTH);
	});
});

/** Shapes nudged off whole units */
function moved(shapes, by) {
	return shapes.map((shape) => ({
		...shape,
		pathPoints: shape.pathPoints.map((point) => ({
			...point,
			p: { coord: { x: point.p.coord.x + by, y: point.p.coord.y + by } },
		})),
	}));
}
