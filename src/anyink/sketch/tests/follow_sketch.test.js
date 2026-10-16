// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 follow plans, the pure parts: follow_matrix.js and follow_sketch.js (docs/SKETCH.md
	sections 7 and 8), and the Brush record taking the same plan (nib/stroke_record.js
	followStrokes).
*/
import { afterEach, describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { addStrokeRecord, strokeSkeleton, tagStroke } from '../../nib/stroke_record.js';
import { guideLines } from '../../placement/classes.js';
import {
	apply,
	flipLeftRight,
	flipUpsideDown,
	fromFixPlan,
	invert,
	isTranslation,
	mirrors,
	scaleAbout,
	translate,
	turnDir,
} from '../follow_matrix.js';
import { followSketch, pinTargets, placePins } from '../follow_sketch.js';
import { line, sketchOfPieces } from './fixtures/build_letters.js';
import { STORED_FONT, storedSketch } from './fixtures/stored_sketches.js';

const LINES = guideLines(STORED_FONT);

describe('follow_matrix.js', () => {
	it('builds, applies and inverts the follow moves', () => {
		expect(apply(translate(5, -3), [10, 10])).toEqual([15, 7]);
		expect(apply(scaleAbout(2, 2, 100, 0), [150, 10])).toEqual([200, 20]);
		expect(apply(flipLeftRight(300), [100, 7])).toEqual([500, 7]);
		expect(apply(flipUpsideDown(500), [3, 100])).toEqual([3, 900]);
		const m = fromFixPlan({ k: 1.2, ox: 70, oy: 0, dx: -4, dy: 6 });
		expect(apply(m, [170, 100])).toEqual([70 + 120 - 4, 126]);
		const back = apply(invert(m), apply(m, [33, 44]));
		expect(back[0]).toBeCloseTo(33, 9);
		expect(back[1]).toBeCloseTo(44, 9);
		expect(isTranslation(translate(3, 4))).toBe(true);
		expect(isTranslation(m)).toBe(false);
		expect(mirrors(flipLeftRight(0))).toBe(true);
		expect(mirrors(m)).toBe(false);
		expect(invert([0, 0, 0, 0, 1, 1])).toBeNull();
	});

	it('turns a direction: left-right 180 - dir, upside-down 360 - dir, a scale keeps it', () => {
		expect(turnDir(flipLeftRight(10), 70)).toBeCloseTo(110, 9);
		expect(turnDir(flipUpsideDown(10), 70)).toBeCloseTo(290, 9);
		expect(turnDir(scaleAbout(1.3), 70)).toBeCloseTo(70, 9);
		expect(turnDir(translate(9, 9), 0)).toBe(0);
	});
});

describe('followSketch', () => {
	it('never changes the sketch it is given; no matrix gives it back as is', () => {
		const n = storedSketch('n');
		const copy = JSON.stringify(n);
		followSketch(n, { matrix: flipLeftRight(400) }, STORED_FONT);
		expect(JSON.stringify(n)).toBe(copy);
		expect(followSketch(n, { matrix: null }, STORED_FONT)).toBe(n);
	});

	it('a move up takes the writing-line pins off, keeps the ones it still meets', () => {
		const n = storedSketch('n');
		const up = followSketch(n, { matrix: translate(0, 30) }, STORED_FONT);
		expect(up.points.foot.y).toBe(80);
		expect(up.points.foot.on).toBeUndefined();
		expect(up.points.foot.inset).toBeUndefined();
		expect(up.points.stemTop.on).toBeUndefined();
		// the same move with the lines 30 up too keeps every pin
		const font = { ...STORED_FONT, xHeight: STORED_FONT.xHeight + 30 };
		const both = followSketch(n, { matrix: translate(0, 30) }, font);
		expect(both.points.stemTop).toMatchObject({ on: 'small', inset: 'edge', y: 1081 });
	});

	it('a pin within 1 unit of its line is set exactly on it', () => {
		const n = storedSketch('n');
		const nudged = followSketch(n, { matrix: scaleAbout(1.0004, 1.0004, 0, 0) }, STORED_FONT);
		expect(nudged.points.stemTop).toMatchObject({ on: 'small', y: 1051 });
		expect(nudged.points.archTop).toMatchObject({ on: 'small', y: 1081 });
	});

	it('every point lands on a whole unit; a live circle moves and scales', () => {
		const circle = storedSketch('circle');
		const moved = followSketch(
			circle,
			{ matrix: fromFixPlan({ k: 1.1, ox: 3, oy: 0 }) },
			STORED_FONT
		);
		Object.values(moved.points).forEach((point) => {
			expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
		});
		const was = circle.pieces[0].circle;
		const now = moved.pieces[0].circle;
		expect(now.rx).toBeCloseTo(was.rx * 1.1, 9);
		expect(now.cx).toBeCloseTo(3 + (was.cx - 3) * 1.1, 9);
	});

	it('twins stay even about a whole-number Mirror line; left and right pins swap on a flip', () => {
		const sketch = sketchOfPieces(
			'sk_follow_twins',
			{
				a: { x: 101, y: 600, kind: 'corner', mirrorOf: 'b', on: 'left' },
				b: { x: 499, y: 600, kind: 'corner', mirrorOf: 'a', on: 'right' },
				m: { x: 300, y: 900, kind: 'corner', on: 'mirror' },
			},
			[{ use: 'center', closed: false, parts: [line('a', 'm'), line('m', 'b')] }]
		);
		sketch.mirror = { x: 300 };
		const scaled = followSketch(
			sketch,
			{ matrix: fromFixPlan({ k: 1.13, ox: 7, oy: 0 }) },
			STORED_FONT
		);
		const mx = scaled.mirror.x;
		expect(Number.isInteger(mx)).toBe(true);
		expect(scaled.points.a.x + scaled.points.b.x).toBe(2 * mx);
		expect(scaled.points.m.x).toBe(mx);
		// a scale moves the sides: their pins go
		expect(scaled.points.a.on).toBeUndefined();
		const flipped = followSketch(sketch, { matrix: flipLeftRight(300) }, STORED_FONT);
		expect(flipped.points.a).toMatchObject({ x: 499, on: 'right' });
		expect(flipped.points.b).toMatchObject({ x: 101, on: 'left' });
		expect(flipped.points.m).toMatchObject({ x: 300, on: 'mirror' });
	});

	it("an arc's snapped top keeps its pin only through a sideways move", () => {
		const sketch = sketchOfPieces(
			'sk_follow_top',
			{ a: { x: 100, y: 500, kind: 'corner' }, b: { x: 500, y: 500, kind: 'corner' } },
			[
				{
					use: 'center',
					closed: false,
					parts: [{ type: 'arc', from: 'a', to: 'b', bulge: 0.5, top: { on: 'small' } }],
				},
			]
		);
		const side = followSketch(sketch, { matrix: translate(40, 0) }, STORED_FONT);
		expect(side.pieces[0].parts[0].top).toEqual({ on: 'small' });
		const up = followSketch(sketch, { matrix: translate(0, 40) }, STORED_FONT);
		expect(up.pieces[0].parts[0].top).toBeUndefined();
	});

	it('Outline grow: a box loop moves exactly `grow` out on every side, its hole `grow` in', () => {
		const corner = (x, y) => ({ x, y, kind: 'corner' });
		const sketch = sketchOfPieces(
			'sk_follow_box',
			{
				a: corner(100, 0),
				b: corner(700, 0),
				c: corner(700, 1000),
				d: corner(100, 1000),
				e: corner(250, 200),
				f: corner(550, 200),
				g: corner(550, 800),
				h: corner(250, 800),
			},
			[
				{
					use: 'outline',
					closed: true,
					parts: [line('a', 'b'), line('b', 'c'), line('c', 'd'), line('d', 'a')],
				},
				{
					use: 'outline',
					closed: true,
					parts: [line('e', 'f'), line('f', 'g'), line('g', 'h'), line('h', 'e')],
				},
			],
			{ way: 'outline' }
		);
		const grown = followSketch(sketch, { matrix: translate(0, 0), grow: 12 }, STORED_FONT);
		const p = grown.points;
		expect([p.a.x, p.a.y, p.c.x, p.c.y]).toEqual([88, -12, 712, 1012]);
		expect([p.e.x, p.e.y, p.g.x, p.g.y]).toEqual([262, 212, 538, 788]);
	});

	it('Centerline pieces never take the grow and the thickness never scales', () => {
		const n = storedSketch('n');
		const grown = followSketch(n, { matrix: scaleAbout(1.2, 1.2, 0, 0), grow: -10 }, STORED_FONT);
		expect(grown.thickness).toBe(99);
		expect(grown.points.shoulder.x).toBe(Math.round(560 * 1.2));
	});
});

describe('placePins and pinTargets (B15 line moves)', () => {
	it('every pinned point goes where the lines are now; unpinned ones stay', () => {
		const n = storedSketch('n');
		expect(placePins(n, STORED_FONT)).toBe(n);
		const font = { ...STORED_FONT, xHeight: 1200 };
		const placed = placePins(n, font);
		expect(placed.points.stemTop.y).toBe(1151);
		expect(placed.points.archTop.y).toBe(1181);
		expect(placed.points.foot).toBe(n.points.foot);
		expect(placed.points.join).toBe(n.points.join);
	});

	it('Outline points sit on the line itself; half-way points halfway', () => {
		const sketch = sketchOfPieces(
			'sk_follow_half',
			{
				a: { x: 100, y: 3, kind: 'corner', on: 'writing' },
				b: { x: 500, y: 3, kind: 'corner', on: 'writing' },
				c: { x: 300, y: 500, kind: 'corner', on: 'halfSmall' },
			},
			[{ use: 'outline', closed: true, parts: [line('a', 'b'), line('b', 'c'), line('c', 'a')] }],
			{ way: 'outline' }
		);
		const targets = pinTargets(sketch, STORED_FONT);
		expect(targets.get('a')).toBe(0);
		expect(targets.get('c')).toBe(Math.round(LINES.small / 2));
	});
});

/** small l: one Brush stroke, its record with a skeleton */
function brushL() {
	const item = new Glyph({ id: 'glyph-0x6C', shapes: [] });
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	const path = item.addOneShape(
		new Path({
			name: 'Brush stroke 1',
			pathPoints: [corner(100, 0), corner(160, 0), corner(160, 1000), corner(100, 1000)],
		})
	);
	tagStroke(path, 1, { key: 'kk', part: 0 });
	addStrokeRecord(item, {
		id: 1,
		key: 'kk',
		size: 60,
		skeleton: [
			[
				[130, 30],
				[130, 300],
				[130, 700],
				[130, 970],
			],
		],
		shapes: [path],
	});
	return item;
}

describe('the Brush record takes the same plan (nib/stroke_record.js followStrokes)', () => {
	afterEach(() => resetFeaturesForTests());

	it('after a flip its skeleton is the flipped one, where the ink is', async () => {
		const { followShapes } = await import('../follow.js');
		setFeaturesForTests({ sketch: true });
		const item = brushL();
		item.flipNS(500);
		followShapes(item, { matrix: flipUpsideDown(500) });
		expect(strokeSkeleton(item, 1)).toEqual([
			[
				[130, 970],
				[130, 700],
				[130, 300],
				[130, 30],
			],
		]);
		// a plain move needs nothing: `at` follows it
		const before = JSON.stringify(item.anyink.nib);
		followShapes(item, { matrix: translate(20, 0) });
		expect(JSON.stringify(item.anyink.nib)).toBe(before);
	});

	it('with the sketch flag off the record is left as it was (no data change before S6)', async () => {
		// the critic: Match size, Shrink to fit and Flip on a Brush letter rewrote skeleton and
		// at through followShapes with the flag off; before S3 they were never touched
		const { followShapes } = await import('../follow.js');
		setFeaturesForTests({ sketch: false });
		const item = brushL();
		const before = JSON.stringify(item.anyink.nib);
		item.flipNS(500);
		expect(followShapes(item, { matrix: flipUpsideDown(500) })).toEqual({
			moved: false,
			rebuilt: false,
		});
		followShapes(item, { matrix: scaleAbout(0.8, 0.8, 100, 0), grow: 6 });
		expect(JSON.stringify(item.anyink.nib)).toBe(before);
	});
});
