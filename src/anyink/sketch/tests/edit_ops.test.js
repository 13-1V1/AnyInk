// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md section 5, "Editing"): the edits Select makes, each pure. Delete a piece
	(its ends stay when shared), delete a point (a Spline loses it, two parts it joins become one,
	an end shortens its piece, a piece left too short goes), add a point (a Line splits into two
	Lines at a corner, an Arc into two arcs of its circle, a Spline gets one more), Smooth /
	Corner, a group moved and scaled (thickness never scales), a circle resized, one end Round /
	Flat, a helper line. Every result is a sound v1 sketch (validateSketch).
*/
import { describe, expect, it } from 'vitest';
import { arcGeometry } from '../arc.js';
import {
	addPointOnPiece,
	deletePick,
	deletePiece,
	deletePoint,
	isOpenEnd,
	movePoints,
	resizeCircle,
	scalePoints,
	setPointEnd,
	setPointKind,
	toggleHelper,
	togglePointKind,
} from '../edit_ops.js';
import { getPiece, validateSketch } from '../model.js';
import { hitTest } from '../pick.js';
import { storedSketch } from './fixtures/stored_sketches.js';

const sound = (sketch) => expect(validateSketch(sketch).problems).toEqual([]);

describe('delete', () => {
	it("a piece goes; ends it shares stay (n's arch deleted, the stem and the join stay)", () => {
		const sketch = storedSketch('n');
		const next = deletePiece(sketch, 2);
		expect(next.pieces.map((p) => p.id)).toEqual([1]);
		expect(Object.keys(next.points).sort()).toEqual(['foot', 'stemTop']);
		expect(next.relations).toEqual([]);
		sound(next);
		expect(sketch.pieces).toHaveLength(2);
	});

	it("A's bar deleted: the legs and their points stay", () => {
		const next = deletePiece(storedSketch('A'), 2);
		expect(Object.keys(next.points).sort()).toEqual(['apex', 'leftFoot', 'rightFoot']);
		sound(next);
	});

	it('a point inside a Spline: the Spline goes on without it', () => {
		const { sketch, pieces } = deletePoint(storedSketch('s'), 'middle');
		expect(pieces).toBe(0);
		expect(sketch.pieces[0].parts[0].points).not.toContain('middle');
		expect(sketch.points.middle).toBeUndefined();
		sound(sketch);
	});

	it("A's apex (where two Lines meet): the legs become one Line", () => {
		const { sketch } = deletePoint(storedSketch('A'), 'apex');
		expect(getPiece(sketch, 1).parts).toEqual([
			{ type: 'line', from: 'leftFoot', to: 'rightFoot' },
		]);
		sound(sketch);
	});

	it("an open end: the Line there goes (n's foot: the stem piece goes, it had one Line)", () => {
		const { sketch, pieces } = deletePoint(storedSketch('n'), 'foot');
		expect(pieces).toBe(1);
		expect(sketch.pieces.map((p) => p.id)).toEqual([2]);
		sound(sketch);
	});

	it('a loop with too few points left goes; a circle loses its live circle', () => {
		const one = deletePoint(storedSketch('circle'), 'c1');
		expect(one.sketch.pieces[0].circle).toBeUndefined();
		expect(one.sketch.pieces[0].parts[0].points).toEqual(['c2', 'c3', 'c4']);
		sound(one.sketch);
		const two = deletePoint(one.sketch, 'c2');
		expect(two.pieces).toBe(1);
		expect(two.sketch.pieces).toEqual([]);
	});

	it('a pick: pieces first, then points; counts of each', () => {
		const out = deletePick(storedSketch('A'), { points: ['apex'], pieces: [2] });
		expect(out).toMatchObject({ pieces: 1, points: 1 });
		sound(out.sketch);
		expect(deletePick(storedSketch('A'), { points: [], pieces: [] })).toBe(null);
	});
});

describe('add a point (double-click a piece)', () => {
	it('on a Line: two Lines meeting at a new corner', () => {
		const sketch = storedSketch('A');
		const hit = hitTest(sketch, { x: 520, y: 480 }, 20);
		const { sketch: next, id } = addPointOnPiece(sketch, hit);
		expect(next.points[id]).toMatchObject({ x: 520, y: 480, kind: 'corner' });
		expect(getPiece(next, 2).parts).toEqual([
			{ type: 'line', from: 'barLeft', to: id },
			{ type: 'line', from: id, to: 'barRight' },
		]);
		sound(next);
	});

	it('on an Arc: two arcs of the same circle, meeting smooth', () => {
		const sketch = {
			...storedSketch('A'),
			points: { a: { x: 0, y: 0, kind: 'corner' }, b: { x: 400, y: 0, kind: 'corner' } },
			pieces: [
				{
					id: 1,
					key: 'pc_1',
					use: 'center',
					closed: false,
					parts: [{ type: 'arc', from: 'a', to: 'b', bulge: -0.5 }],
				},
			],
			relations: [],
		};
		const radius = arcGeometry([0, 0], [400, 0], -0.5).radius;
		const hit = hitTest(sketch, { x: 200, y: 100 }, 20);
		const { sketch: next, id } = addPointOnPiece(sketch, hit);
		const [first, second] = next.pieces[0].parts;
		const p = next.points[id];
		expect(p.kind).toBe('smooth');
		expect(arcGeometry([0, 0], [p.x, p.y], first.bulge).radius).toBeCloseTo(radius, -1);
		expect(arcGeometry([p.x, p.y], [400, 0], second.bulge).radius).toBeCloseTo(radius, -1);
		sound(next);
	});

	it('on a Spline: one more point between the two it fell between', () => {
		const sketch = storedSketch('n');
		const hit = hitTest(sketch, { x: 200, y: 1020 }, 60);
		const { sketch: next, id } = addPointOnPiece(sketch, hit);
		expect(getPiece(next, 2).parts[0].points).toEqual(['join', id, 'archTop', 'shoulder']);
		sound(next);
	});
});

describe('Smooth / Corner, ends, helper', () => {
	it('toggles a point; a corner on a live circle ends the circle', () => {
		const circle = storedSketch('circle');
		const next = setPointKind(circle, 'c1', 'corner');
		expect(next.points.c1.kind).toBe('corner');
		expect(next.pieces[0].circle).toBeUndefined();
		expect(setPointKind(next, 'c1', 'corner')).toBe(null);
		expect(togglePointKind(next, 'c1').points.c1.kind).toBe('smooth');
	});

	it('This end: Round / Flat on an open end only', () => {
		const sketch = storedSketch('n');
		expect(isOpenEnd(sketch, 'foot')).toBe(true);
		expect(isOpenEnd(sketch, 'archTop')).toBe(false);
		expect(setPointEnd(sketch, 'foot', 'flat').points.foot.end).toBe('flat');
		expect(setPointEnd(sketch, 'foot', 'round')).toBe(null);
		expect(setPointEnd(sketch, 'archTop', 'flat')).toBe(null);
	});

	it('a helper line and back', () => {
		const made = toggleHelper(storedSketch('A'), 2);
		expect(made.helper).toBe(true);
		expect(getPiece(made.sketch, 2)).toMatchObject({ use: 'helper', was: 'center' });
		sound(made.sketch);
		const inked = toggleHelper(made.sketch, 2);
		expect(inked.helper).toBe(false);
		expect(getPiece(inked.sketch, 2).use).toBe('center');
		expect(getPiece(inked.sketch, 2).was).toBeUndefined();
	});
});

describe('groups and circles', () => {
	it("a group moved: n's stem slid right, its pinned ends stay on their lines, the join follows", () => {
		const sketch = storedSketch('n');
		const { sketch: next } = movePoints(sketch, ['foot', 'stemTop'], { x: 40, y: 0 });
		expect(next.points.foot).toMatchObject({ x: 160, y: 50, on: 'writing' });
		expect(next.points.stemTop).toMatchObject({ x: 160, y: 1051, on: 'small' });
		expect(next.points.join.x).toBe(160);
		expect(next.thickness).toBe(99);
	});

	it('a group scaled about a corner: the circle in it scales; thickness never does', () => {
		const sketch = storedSketch('circle');
		const ids = Object.keys(sketch.points);
		const { sketch: next } = scalePoints(sketch, ids, { anchor: { x: 150, y: 550 }, sx: 2, sy: 2 });
		expect(next.pieces[0].circle).toEqual({ cx: 450, cy: 850, rx: 300, ry: 300 });
		expect(next.points.c4).toMatchObject({ x: 750, y: 850 });
		expect(next.thickness).toBe(99);
	});

	it('a circle resized by its edge about its center; Shift makes it an oval', () => {
		const sketch = storedSketch('circle');
		const { sketch: next } = resizeCircle(sketch, 1, { x: 500, y: 700 });
		expect(next.pieces[0].circle).toEqual({ cx: 300, cy: 700, rx: 200, ry: 200 });
		expect(next.points.c1).toMatchObject({ x: 300, y: 900 });
		const oval = resizeCircle(sketch, 1, { x: 500, y: 760 }, { shift: true }).sketch;
		expect(oval.pieces[0].circle).toEqual({ cx: 300, cy: 700, rx: 200, ry: 60 });
	});
});
