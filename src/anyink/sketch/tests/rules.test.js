// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 6, "Relations kept after you let go"): the drag rules, each one and
	their fixed order (mirror, on a line, on a piece and joined, level / plumb, tangent), once
	each, and "can't keep both": when a later rule moves a point an earlier one held, the later
	wins, the point lets go and the conflict is listed. Never changes the sketch passed in.
*/
import { describe, expect, it } from 'vitest';
import { pieceSkeleton } from '../curves.js';
import { nearestOnCubics } from '../pick.js';
import { applyDrag, LET_GO } from '../rules.js';
import { storedSketch } from './fixtures/stored_sketches.js';

const RADIUS = 20;
const drag = (sketch, targets, options = {}) =>
	applyDrag(sketch, targets, { radius: RADIUS, ...options });
const to = (x, y, raw = { x, y }) => ({ x, y, raw });

/** A with its bar ends on the legs and level with each other, as S2 stores A's bar */
function barA() {
	const sketch = storedSketch('A');
	sketch.relations = [
		{ type: 'onPiece', point: 'barLeft', piece: 1, t: 0.1557 },
		{ type: 'onPiece', point: 'barRight', piece: 1, t: 0.8443 },
		{ type: 'level', a: 'barLeft', b: 'barRight' },
	];
	return sketch;
}

/** distance from a point to a piece */
function offPiece(sketch, id, pieceId) {
	const piece = sketch.pieces.find((p) => p.id === pieceId);
	return nearestOnCubics(sketch.points[id], pieceSkeleton(piece, sketch)).distance;
}

describe('on a line', () => {
	it(`slides along its line while pulled less than ${LET_GO} snap radii off`, () => {
		const sketch = storedSketch('A');
		const before = JSON.stringify(sketch);
		const { sketch: next, letGo } = drag(sketch, { leftFoot: to(100, 50, { x: 100, y: 105 }) });
		expect(next.points.leftFoot).toMatchObject({ x: 100, y: 50, on: 'writing', inset: 'edge' });
		expect(letGo).toEqual([]);
		expect(JSON.stringify(sketch)).toBe(before);
	});

	it('lets go of the line when pulled further, and is free (no on, no inset)', () => {
		const { sketch: next, letGo } = drag(storedSketch('A'), { leftFoot: to(100, 200) });
		expect(next.points.leftFoot.y).toBe(200);
		expect(next.points.leftFoot.on).toBeUndefined();
		expect(next.points.leftFoot.inset).toBeUndefined();
		expect(letGo).toEqual([{ point: 'leftFoot', on: 'writing' }]);
	});

	it('a free point dragged onto a line by a snap is pinned there', () => {
		const sketch = storedSketch('A');
		const { sketch: next } = drag(sketch, {
			barLeft: { x: 203, y: 50, raw: { x: 203, y: 60 }, pin: { on: 'writing', inset: 'edge' } },
		});
		expect(next.points.barLeft).toMatchObject({ x: 203, y: 50, on: 'writing', inset: 'edge' });
	});
});

describe('on a piece and joined', () => {
	it("n's join keeps its share of the stem when the stem's top moves", () => {
		const sketch = storedSketch('n');
		const { sketch: next, moved } = drag(sketch, { stemTop: to(220, 1051) });
		expect(moved).toContain('join');
		expect(offPiece(next, 'join', 1)).toBeLessThan(1);
		// 77 % of the way up the stem, now leaning right
		expect(next.points.join.x).toBeGreaterThan(180);
	});

	it('a dragged point on a piece slides along it, its share updated', () => {
		const sketch = storedSketch('n');
		const { sketch: next } = drag(sketch, { join: to(150, 600) });
		expect(next.points.join.x).toBe(120);
		expect(next.points.join.y).toBe(600);
		const tie = next.relations.find((r) => r.type === 'onPiece');
		expect(tie.t).toBeCloseTo((600 - 50) / (1051 - 50), 2);
	});

	it('pulled LET_GO radii off its piece it lets go of the piece', () => {
		const { sketch: next, letGo } = drag(storedSketch('n'), { join: to(300, 600) });
		expect(next.relations.some((r) => r.type === 'onPiece')).toBe(false);
		expect(letGo).toEqual([{ point: 'join', piece: 1 }]);
		expect(next.points.join).toMatchObject({ x: 300, y: 600 });
	});

	it('joined points share an id, so both pieces move with it', () => {
		const sketch = storedSketch('A');
		const { sketch: next } = drag(sketch, { apex: to(560, 1431) });
		const legs = pieceSkeleton(next.pieces[0], next);
		expect(legs[0][3]).toEqual([560, 1431]);
		expect(legs[1][0]).toEqual([560, 1431]);
	});
});

describe('level / plumb pairs', () => {
	it('the partner follows on y (level)', () => {
		const sketch = storedSketch('A');
		sketch.relations = [{ type: 'level', a: 'barLeft', b: 'barRight' }];
		const { sketch: next } = drag(sketch, { barLeft: to(203, 520) });
		expect(next.points.barRight).toMatchObject({ x: 837, y: 520 });
	});

	it("A's bar: the end dragged slides on its leg, the other follows level AND stays on its leg", () => {
		const { sketch: next, conflicts } = drag(barA(), { barLeft: to(260, 640) });
		expect(conflicts).toEqual([]);
		expect(offPiece(next, 'barLeft', 1)).toBeLessThan(1);
		expect(offPiece(next, 'barRight', 1)).toBeLessThan(1.5);
		expect(Math.abs(next.points.barRight.y - next.points.barLeft.y)).toBeLessThanOrEqual(1);
		// on the right leg, not the left
		expect(next.points.barRight.x).toBeGreaterThan(600);
		expect(next.relations).toHaveLength(3);
	});

	it("A's apex moved: both bar ends keep their shares of the legs, and stay level", () => {
		const { sketch: next, conflicts, letGo } = drag(barA(), { apex: to(520, 1300) });
		expect(conflicts).toEqual([]);
		expect(letGo).toEqual([{ point: 'apex', on: 'capitals' }]);
		expect(offPiece(next, 'barLeft', 1)).toBeLessThan(1);
		expect(offPiece(next, 'barRight', 1)).toBeLessThan(1);
	});
});

describe('the fixed order and "can\'t keep both"', () => {
	it('a level partner pinned to the writing line lets go of it (the later rule wins)', () => {
		const sketch = storedSketch('A');
		sketch.relations = [{ type: 'level', a: 'barLeft', b: 'rightFoot' }];
		const { sketch: next, conflicts } = drag(sketch, { barLeft: to(203, 300) });
		expect(next.points.rightFoot.y).toBe(300);
		expect(next.points.rightFoot.on).toBeUndefined();
		expect(conflicts).toEqual([{ point: 'rightFoot', on: 'writing' }]);
	});

	it('a point on a line and on a piece: the piece (rule 3) wins over the line (rule 2)', () => {
		const sketch = storedSketch('A');
		// the bar's left end pinned to the writing line, and on the left leg
		sketch.points.barLeft = { x: 76, y: 100, kind: 'corner', on: 'writing' };
		sketch.relations = [{ type: 'onPiece', point: 'barLeft', piece: 1, t: 0.02 }];
		const { sketch: next, conflicts } = drag(sketch, { leftFoot: to(60, 400, { x: 60, y: 400 }) });
		// the foot let go of its own line (pulled far); the bar end followed the leg off its line
		expect(conflicts).toEqual([{ point: 'barLeft', on: 'writing' }]);
		expect(next.points.barLeft.on).toBeUndefined();
	});

	it('a level partner on a piece that never reaches the level comes off its piece', () => {
		const sketch = storedSketch('A');
		sketch.relations = [
			{ type: 'onPiece', point: 'barRight', piece: 1, t: 0.8443 },
			{ type: 'level', a: 'barLeft', b: 'barRight' },
		];
		const { sketch: next, conflicts } = drag(sketch, { barLeft: to(203, 1500) });
		expect(conflicts).toEqual([{ point: 'barRight', piece: 1 }]);
		expect(next.points.barRight.y).toBe(1500);
		expect(next.relations.some((r) => r.type === 'onPiece')).toBe(false);
	});
});

describe('mirror, circles and locks', () => {
	it('a mirror twin moves in mirror image (rule 1)', () => {
		const sketch = storedSketch('A');
		sketch.mirror = { x: 520 };
		sketch.points.barRight.mirrorOf = 'barLeft';
		const { sketch: next } = drag(sketch, { barLeft: to(250, 500) });
		expect(next.points.barRight).toMatchObject({ x: 790, y: 500 });
	});

	it('a live circle whose points all move together stays one, moved', () => {
		const sketch = storedSketch('circle');
		const targets = {};
		Object.entries(sketch.points).forEach(([id, p]) => (targets[id] = to(p.x + 40, p.y - 10)));
		const { sketch: next } = drag(sketch, targets);
		expect(next.pieces[0].circle).toEqual({ cx: 340, cy: 690, rx: 150, ry: 150 });
	});

	it('a live circle with one point moved on its own is a Spline loop from then on', () => {
		const { sketch: next } = drag(storedSketch('circle'), { c1: to(300, 900) });
		expect(next.pieces[0].circle).toBeUndefined();
	});

	it("an o's top slid along its line keeps its level lock", () => {
		const { sketch: next } = drag(storedSketch('o'), { top: to(360, 1081) });
		expect(next.points.top).toMatchObject({ x: 360, y: 1081, lock: 'level', on: 'small' });
	});
});
