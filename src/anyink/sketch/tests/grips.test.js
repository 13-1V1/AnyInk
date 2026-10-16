// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md sections 5 and 8): the grips on a picked smooth point. They sit where the
	built curve's own handles are; the circle turns and pulls, the diamond only turns, the arrow
	only pulls (the arriving side's tension); a pull maps to tension through gripTension and the
	grip is drawn at gripPull(gripTension(pull)); Let it flow clears the aim. A point between two
	Lines has none; beside one Line only the arrow (a Line's direction never turns).
*/
import { describe, expect, it } from 'vitest';
import { pieceSkeleton } from '../curves.js';
import { dragGrip, gripLength, gripsFor, hitGrip, isAimed, letItFlow } from '../grips.js';
import { gripPull, gripTension } from '../hobby.js';
import { storedSketch } from './fixtures/stored_sketches.js';

describe('gripsFor', () => {
	it("s's middle point: circle, diamond and arrow, along the curve's own handles", () => {
		const sketch = storedSketch('s');
		const grips = gripsFor(sketch, 'middle');
		expect(grips.turns).toBe(true);
		expect(grips.out && grips.back && grips.diamond).toBeTruthy();
		const cubics = pieceSkeleton(sketch.pieces[0], sketch);
		const leaving = cubics.find((c) => c[0][0] === 300 && c[0][1] === 560);
		expect(grips.out.x).toBeCloseTo(leaving[1][0], 6);
		expect(grips.out.y).toBeCloseTo(leaving[1][1], 6);
		expect(grips.locked).toBe(false);
	});

	it("A's apex (a corner between two Lines) has none", () => {
		expect(gripsFor(storedSketch('A'), 'apex')).toBe(null);
	});

	it("n's shoulder (a Spline into a Line): the arrow only, no turning", () => {
		const grips = gripsFor(storedSketch('n'), 'shoulder');
		expect(grips.turns).toBe(false);
		expect(grips.out).toBe(null);
		expect(grips.diamond).toBe(null);
		expect(grips.back).toBeTruthy();
	});

	it('hitGrip names the grip under the pointer', () => {
		const grips = gripsFor(storedSketch('s'), 'middle');
		expect(hitGrip(grips, grips.out, 5)).toBe('circle');
		expect(hitGrip(grips, grips.back, 5)).toBe('arrow');
		expect(hitGrip(grips, grips.diamond, 5)).toBe('diamond');
		expect(hitGrip(grips, { x: -999, y: -999 }, 5)).toBe(null);
	});
});

describe('dragGrip', () => {
	it('the circle: direction and pull; once dragged the direction is locked (aim)', () => {
		const sketch = storedSketch('s');
		const grips = gripsFor(sketch, 'middle');
		const pointer = {
			x: grips.at.x + Math.cos(Math.PI / 4) * grips.normal.out * 1.2,
			y: grips.at.y - Math.sin(Math.PI / 4) * grips.normal.out * 1.2,
		};
		const next = dragGrip(sketch, grips, 'circle', pointer);
		expect(next.points.middle.aim.dir).toBeCloseTo(-45, 3);
		expect(next.points.middle.aim.tout).toBeCloseTo(gripTension(1.2), 3);
		expect(isAimed(next, 'middle')).toBe(true);
		expect(gripsFor(next, 'middle').locked).toBe(true);
		expect(sketch.points.middle.aim).toBeUndefined();
	});

	it('the diamond turns only; the arrow pulls only (the arriving side)', () => {
		const sketch = storedSketch('s');
		const grips = gripsFor(sketch, 'middle');
		const turned = dragGrip(sketch, grips, 'diamond', { x: grips.at.x + 100, y: grips.at.y });
		expect(turned.points.middle.aim).toMatchObject({ dir: 0, tin: 1, tout: 1 });
		const r = (grips.dir * Math.PI) / 180;
		const back = {
			x: grips.at.x - Math.cos(r) * grips.normal.back * 0.5,
			y: grips.at.y - Math.sin(r) * grips.normal.back * 0.5,
		};
		const pulled = dragGrip(sketch, grips, 'arrow', back);
		expect(pulled.points.middle.aim.dir).toBeCloseTo(grips.dir, 3);
		expect(pulled.points.middle.aim.tin).toBeCloseTo(gripTension(0.5), 3);
		expect(pulled.points.middle.aim.tout).toBe(1);
	});

	it('a pull past the range stops where the handle stops (gripPull(gripTension(pull)))', () => {
		expect(gripLength(100, 10)).toBeCloseTo(100 / 0.75, 6);
		expect(gripLength(100, 0.01)).toBeCloseTo(100 / 4, 6);
		expect(gripLength(100, 1.2)).toBeCloseTo(100 * gripPull(gripTension(1.2)), 6);
	});
});

describe('Let it flow', () => {
	it('clears the aim; nothing to do on a point never aimed', () => {
		const sketch = storedSketch('n');
		expect(isAimed(sketch, 'join')).toBe(true);
		const next = letItFlow(sketch, 'join');
		expect(next.points.join.aim).toBeUndefined();
		expect(letItFlow(next, 'join')).toBe(null);
	});
});
