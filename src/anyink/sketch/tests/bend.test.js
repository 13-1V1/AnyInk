// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md sections 5 and 8): Bend. An Arc keeps its ends and its bulge changes; n's
	arch (a curve, tangent at both ends, between stems of different heights) stays smooth at both
	joins and only gets fuller or flatter; a Spline stretch is aimed; a Line moves whole with its
	pinned ends sliding on their lines; an arc top on a line keeps the line until pulled LET_GO
	radii off. Never changes the sketch passed in.
*/
import { describe, expect, it } from 'vitest';
import { arcGeometry } from '../arc.js';
import { bendPart } from '../bend.js';
import { endDirection, pieceSkeleton, startDirection } from '../curves.js';
import { hitTest, nearestOnCubics, pieceCubics, pointOnCubics } from '../pick.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

const RADIUS = 20;

function sketchOf(points, parts) {
	return {
		v: 1,
		build: 1,
		key: 'sk_bend',
		way: 'center',
		thickness: 99,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points,
		pieces: [{ id: 1, key: 'pc_1', use: 'center', closed: false, parts }],
		relations: [],
		setAside: false,
		at: 1,
	};
}

/** n's arch between stems of different heights: Line + curve + Line */
function unequalArch() {
	return sketchOf(
		{
			f1: { x: 0, y: 0, kind: 'corner' },
			t1: { x: 0, y: 400, kind: 'smooth' },
			t2: { x: 300, y: 300, kind: 'smooth' },
			f2: { x: 300, y: 0, kind: 'corner' },
		},
		[
			{ type: 'line', from: 'f1', to: 't1' },
			{ type: 'curve', from: 't1', to: 't2' },
			{ type: 'line', from: 't2', to: 'f2' },
		]
	);
}

const apart = (a, b) => {
	const d = ((((a - b) % 360) + 540) % 360) - 180;
	return Math.abs(d);
};

/** The turn at every join of a piece's cubics (degrees) */
function turns(cubics) {
	const out = [];
	for (let i = 1; i < cubics.length; i++) {
		out.push(apart(endDirection(cubics[i - 1]), startDirection(cubics[i])));
	}
	return out;
}

/** a hit on the middle of part `part` */
function hitOn(sketch, part) {
	const cubics = pieceSkeleton(sketch.pieces[0], sketch);
	const at = pointOnCubics(cubics, 0.5);
	const hit = hitTest(sketch, at, RADIUS);
	expect(hit).toMatchObject({ type: 'piece', part });
	return hit;
}

describe("n's arch with unequal stems (a curve between two Lines)", () => {
	it('bent up: fuller, both joins still smooth, the stems never move', () => {
		const sketch = unequalArch();
		const hit = hitOn(sketch, 1);
		const pull = { x: hit.x, y: hit.y + 60 };
		const result = bendPart(sketch, hit, pull, { radius: RADIUS, font: STORED_FONT });
		expect(result.kind).toBe('bent');
		const next = result.sketch;
		['f1', 't1', 't2', 'f2'].forEach((id) => {
			expect(next.points[id].x).toBe(sketch.points[id].x);
			expect(next.points[id].y).toBe(sketch.points[id].y);
		});
		const after = pieceSkeleton(next.pieces[0], next);
		turns(after).forEach((turn) => expect(turn).toBeLessThan(1e-6));
		const before = pieceSkeleton(sketch.pieces[0], sketch);
		const wanted = { x: hit.x, y: hit.y + 60 };
		expect(nearestOnCubics(wanted, after).distance).toBeLessThan(
			nearestOnCubics(wanted, before).distance
		);
		// the arch's top went up
		const top = (cubics) => Math.max(...cubics.flatMap((c) => c.map((p) => p[1])));
		expect(top(after)).toBeGreaterThan(top(before));
		// the sketch passed in is untouched
		expect(sketch.points.t1.aim).toBeUndefined();
	});

	it('bent down: flatter, still smooth at both stems', () => {
		const sketch = unequalArch();
		const hit = hitOn(sketch, 1);
		const next = bendPart(sketch, hit, { x: hit.x, y: hit.y - 40 }, { radius: RADIUS }).sketch;
		const after = pieceSkeleton(next.pieces[0], next);
		turns(after).forEach((turn) => expect(turn).toBeLessThan(1e-6));
		const middle = (cubics) => pointOnCubics([cubics[1]], 0.5).y;
		expect(middle(after)).toBeLessThan(middle(pieceSkeleton(sketch.pieces[0], sketch)));
	});
});

describe('an Arc keeps its ends; its bulge changes', () => {
	const arc = () =>
		sketchOf({ a: { x: 0, y: 0, kind: 'corner' }, b: { x: 400, y: 0, kind: 'corner' } }, [
			{ type: 'arc', from: 'a', to: 'b', bulge: -0.3 },
		]);

	it('pulled further out: rounder, ends put', () => {
		const sketch = arc();
		const hit = hitOn(sketch, 0);
		const next = bendPart(sketch, hit, { x: hit.x, y: hit.y + 50 }, { radius: RADIUS }).sketch;
		const part = next.pieces[0].parts[0];
		expect(part.type).toBe('arc');
		expect(Math.abs(part.bulge)).toBeGreaterThan(0.3);
		expect(next.points).toEqual(sketch.points);
		// the arc's middle is where it was pulled to
		const middle = pointOnCubics(pieceCubics(next.pieces[0], next), 0.5);
		expect(middle.y).toBeCloseTo(hit.y + 50, 0);
	});

	it('a top on the small-letter line stays while near it, and lets go past LET_GO radii', () => {
		// the arch's top sits where the edge rule puts a round top on the small-letter line (1081)
		const sketch = sketchOf(
			{ a: { x: 100, y: 800, kind: 'corner' }, b: { x: 500, y: 800, kind: 'corner' } },
			[{ type: 'arc', from: 'a', to: 'b', bulge: -281 / 200, top: { on: 'small' } }]
		);
		const geo = arcGeometry([100, 800], [500, 800], -281 / 200);
		expect(geo.center[1] + geo.radius).toBeCloseTo(1081, 6);
		const hit = hitOn(sketch, 0);
		const options = { radius: RADIUS, font: STORED_FONT, thickness: 99 };
		const near = bendPart(sketch, hit, { x: hit.x, y: hit.y + 10 }, options);
		expect(near.sketch.pieces[0].parts[0].top).toEqual({ on: 'small' });
		expect(near.letGo).toEqual([]);
		const far = bendPart(sketch, hit, { x: hit.x, y: hit.y + 300 }, options);
		expect(far.sketch.pieces[0].parts[0].top).toBeUndefined();
		expect(far.letGo).toEqual([{ point: null, on: 'small' }]);
	});

	it('a tangent Arc after a Line bends as a curve, so the join never kinks', () => {
		const sketch = sketchOf(
			{
				a: { x: 0, y: 0, kind: 'corner' },
				j: { x: 0, y: 400, kind: 'corner' },
				e: { x: 300, y: 400, kind: 'corner' },
			},
			[
				{ type: 'line', from: 'a', to: 'j' },
				{ type: 'arc', from: 'j', to: 'e', bulge: 0, tangent: true },
			]
		);
		const hit = hitOn(sketch, 1);
		const next = bendPart(sketch, hit, { x: hit.x + 20, y: hit.y + 40 }, { radius: RADIUS }).sketch;
		expect(next.pieces[0].parts[1].type).toBe('curve');
		turns(pieceSkeleton(next.pieces[0], next)).forEach((turn) => expect(turn).toBeLessThan(1e-6));
	});
});

describe('a Spline stretch and a Line', () => {
	it("n's arch Spline: the stretch's two points are aimed, the curve bows toward the pointer", () => {
		const sketch = storedSketch('n');
		const hit = hitTest(sketch, { x: 200, y: 1020 }, 60);
		const pulled = { x: hit.x - 30, y: hit.y + 40 };
		const next = bendPart(sketch, hit, pulled, { radius: RADIUS }).sketch;
		expect(next.points.join.aim).toMatchObject({
			tin: expect.any(Number),
			tout: expect.any(Number),
		});
		expect(next.points.archTop.aim).toBeTruthy();
		const piece = (s) => s.pieces.find((p) => p.id === 2);
		expect(nearestOnCubics(pulled, pieceSkeleton(piece(next), next)).distance).toBeLessThan(
			nearestOnCubics(pulled, pieceSkeleton(piece(sketch), sketch)).distance
		);
	});

	it("a Line moves whole: A's left leg slides, its feet held on their lines", () => {
		const sketch = storedSketch('A');
		const hit = hitTest(sketch, { x: 290, y: 745 }, RADIUS);
		const result = bendPart(sketch, hit, { x: hit.x + 20, y: hit.y + 30 }, { radius: RADIUS });
		expect(result.kind).toBe('lineMoved');
		expect(result.sketch.points.leftFoot).toMatchObject({ x: 80, y: 50, on: 'writing' });
		expect(result.sketch.points.apex).toMatchObject({ x: 540, y: 1431, on: 'capitals' });
	});

	it('nothing to bend on a live circle (Select resizes it) or a dot', () => {
		const circle = storedSketch('circle');
		const hit = hitTest(circle, { x: 450, y: 700 }, RADIUS);
		expect(
			bendPart(circle, { ...hit, type: 'piece', id: 1, part: 0, a: null, b: null }, { x: 0, y: 0 })
		).toBe(null);
	});
});
