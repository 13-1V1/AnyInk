// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (acceptance T3: stroke weight of all seven letters within 15 % of their median): Match
// size keeps the pen's width. A handwritten H with one tall stem was scaled by 0.77 and came
// out 27 % thinner than his other letters; now the outline is thickened by what the scale took
// (keep_weight.js thickenShapes), so the letter changes size, not pen.
import { describe, expect, it } from 'vitest';
import { inkBounds, strokeEstimate } from '../../spacing/measure.js';
import { oval, rect, ring, spacingProject } from '../../spacing/tests/fixtures.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { checkLetter } from '../checks.js';
import { applyPlan, sizePlan } from '../fix_shapes.js';
import { thickenShapes, weightPlan } from '../keep_weight.js';
import { FONT, glyphId, photo, shapesOf } from './fix_fixtures.js';
import { FONT as FONT_2048, brushInto, checksFont, letter, penLine } from './letters.js';

function letterOf(char, shapes) {
	const project = spacingProject(1000, { [char]: { shapes, advanceWidth: 600 } });
	return project.glyphs[glyphId(char)];
}

describe('Match size keeps the pen width', () => {
	it('an H scaled by 0.77 keeps its stroke estimate within 15 % of before', () => {
		const H = letterOf('H', shapesOf('H', { k: 1 / 0.77 }));
		const before = strokeEstimate(H);
		const plan = sizePlan(H, FONT);
		expect(plan.k).toBeLessThan(0.85);
		applyPlan(H, plan);
		const after = strokeEstimate(H);
		expect(Math.abs(after - before) / before).toBeLessThanOrEqual(0.15);
		// ...and still lands on its line, seated, its left ink edge kept
		const ink = inkBounds(H);
		expect(ink.yMin).toBe(0);
		expect(Math.abs(ink.yMax - FONT.capHeight)).toBeLessThanOrEqual(1);
		expect(ink.xMin).toBe(100);
	});

	it('keeps the width when a small letter grows too', () => {
		const n = letterOf('n', shapesOf('n', { k: 0.7 }));
		const before = strokeEstimate(n);
		applyPlan(n, sizePlan(n, FONT));
		expect(Math.abs(strokeEstimate(n) - before) / before).toBeLessThanOrEqual(0.15);
		expect(Math.abs(inkBounds(n).yMax - FONT.xHeight)).toBeLessThanOrEqual(1);
	});

	it('moves the photo with the shapes, by the same scale', () => {
		const H = letterOf('H', shapesOf('H', { k: 1.3 }));
		setTrace(H, photo({ x: 60, y: 900, scale: 2 }));
		const plan = sizePlan(H, FONT);
		applyPlan(H, plan);
		expect(getTrace(H).scale).toBeCloseTo(2 * plan.k, 6);
	});
});

describe('Match size on a Brush H with one tall stem (the acceptance run)', () => {
	it('clears the size check, stays on the line, and keeps its nib width', () => {
		const project = checksFont({ H: [] }, { fit: false });
		const H = letter(project, 'H');
		const nib = 180;
		brushInto(H, penLine([300, 1914], [300, 0]), nib);
		brushInto(H, penLine([900, 1480], [900, 0]), nib);
		brushInto(H, penLine([300, 740], [900, 740]), nib);
		const font = project.settings.font;
		expect(checkLetter(H, { font }).map((check) => check.id)).toContain('size');
		const before = strokeEstimate(H);
		const plan = sizePlan(H, font);
		expect(plan.k).toBeLessThan(0.85);
		applyPlan(H, plan);
		expect(Math.abs(strokeEstimate(H) - before) / before).toBeLessThanOrEqual(0.15);
		const ids = checkLetter(H, { font }).map((check) => check.id);
		expect(ids).not.toContain('size');
		expect(ids).not.toContain('offLine');
		expect(FONT_2048.capHeight).toBe(1480);
	});
});

describe('weightPlan', () => {
	it('gives the scale and the thickening that land the body on its line at the same width', () => {
		const { k, grow } = weightPlan({ height: 1000, line: 700, stroke: 100 });
		expect(k * 1000 + 2 * grow).toBeCloseTo(700, 6);
		expect(k * 100 + 2 * grow).toBeCloseTo(100, 6);
	});

	it('plain scale with no stroke to keep', () => {
		expect(weightPlan({ height: 1000, line: 700, stroke: null })).toEqual({ k: 0.7, grow: 0 });
	});

	it('never thins by more than a quarter of the stroke each side', () => {
		const { k, grow } = weightPlan({ height: 200, line: 800, stroke: 100 });
		expect(grow).toBeCloseTo(-25, 6);
		expect(k * 200 + 2 * grow).toBeCloseTo(800, 6);
	});
});

describe('thickenShapes', () => {
	it('grows a box by the amount on every side', () => {
		const item = letterOf('I', [rect(100, 0, 200, 700)]);
		expect(thickenShapes(item, 10)).toBe(true);
		expect(inkBounds(item)).toEqual({ xMin: 90, xMax: 210, yMin: -10, yMax: 710 });
	});

	it('grows a ring outward and closes its hole by the same amount', () => {
		const item = letterOf('o', ring(300, 250, 200, 250, 60));
		thickenShapes(item, 10);
		expect(inkBounds(item)).toEqual({ xMin: 90, xMax: 510, yMin: -10, yMax: 510 });
		const hole = item.shapes[1].pathPoints.map((point) => [point.p.x, point.p.y]);
		const xs = hole.map(([x]) => x);
		expect(Math.min(...xs)).toBe(170);
		expect(Math.max(...xs)).toBe(430);
	});

	it('keeps a curve round: its handles grow with it', () => {
		const item = letterOf('o', [oval(300, 300, 100, 100)]);
		thickenShapes(item, 20);
		const right = item.shapes[0].pathPoints[0];
		expect(right.p.x).toBe(420);
		expect(right.h2.y - right.p.y).toBe(Math.round(0.5522847498 * 120));
	});

	it('a hole drawn the same way as its letter still counts as a hole by the fill', () => {
		// a box drawn clockwise is still ink on its own
		const item = letterOf('I', [rect(100, 0, 200, 700, { hole: true })]);
		thickenShapes(item, 10);
		expect(inkBounds(item)).toEqual({ xMin: 90, xMax: 210, yMin: -10, yMax: 710 });
	});
});
