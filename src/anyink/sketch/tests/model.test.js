// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 (docs/SKETCH.md section 8, S1 step 2): the sketch format, its checks, migration of a
// hand-made format 0, a newer format kept untouched, and the font's thickness.
import { beforeEach, describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { brushSize, resetBrushForTests } from '../../nib/brush_size.js';
import {
	SKETCH_V,
	addPiece,
	addPoint,
	getPiece,
	getPoint,
	isDot,
	isCyclicSpline,
	isJoined,
	isNewerSketch,
	isSketchActive,
	migrateSketch,
	newSketch,
	nextPieceId,
	nextPointId,
	pieceEnds,
	piecePointIds,
	piecesAt,
	setSketch,
	setSketchThickness,
	sketchOf,
	sketchThickness,
	sketchWay,
	thicknessRange,
	validateSketch,
} from '../model.js';
import { fullSketch, v0Sketch } from './fixtures/full_sketch.js';

const project = (anyink = {}) =>
	new GlyphrStudioProject({
		settings: { font: { upm: 1000, xHeight: 500, capHeight: 700 }, anyink },
	});

beforeEach(() => {
	localStorage.clear();
	resetBrushForTests();
});

describe('newSketch', () => {
	it('is an empty v1 sketch with every field', () => {
		const sketch = newSketch({ way: 'outline', thickness: 98.6, key: 'sk_a', at: 5 });
		expect(sketch).toEqual({
			v: 1,
			build: 1,
			key: 'sk_a',
			way: 'outline',
			thickness: 99,
			ends: 'round',
			mirror: null,
			builtHash: null,
			points: {},
			pieces: [],
			relations: [],
			setAside: false,
			at: 5,
		});
		expect(validateSketch(sketch).ok).toBe(true);
	});

	it('gives every sketch its own key, and a way it knows', () => {
		const keys = new Set(Array.from({ length: 50 }, () => newSketch().key));
		expect(keys.size).toBe(50);
		[...keys].forEach((key) => expect(key).toMatch(/^sk_/));
		expect(newSketch({ way: 'zigzag' }).way).toBe('center');
		expect(sketchWay({ way: 'outline' })).toBe('outline');
		expect(sketchWay(null)).toBe('center');
	});
});

describe('validateSketch', () => {
	it('passes the fixture that uses every field', () => {
		expect(validateSketch(fullSketch())).toEqual({ ok: true, problems: [], newer: false });
	});

	const broken = [
		['a part names a point that is gone', (s) => delete s.points.p6, /point p6 missing/],
		[
			'parts that do not chain',
			(s) => (s.pieces[1].parts[1].from = 'p5'),
			/part 1 does not start where part 0 ends/,
		],
		[
			'a closed loop that does not end where it starts',
			(s) => (s.pieces[4].parts[3].to = 'o2'),
			/closed loop does not end where it starts/,
		],
		['two pieces with one id', (s) => (s.pieces[1].id = 1), /id used twice/],
		['a point off the whole-unit grid', (s) => (s.points.p1.x = 1.5), /not whole/],
		['an unknown line', (s) => (s.points.p1.on = 'baseline'), /on "baseline"/],
		['an edge inset with no line', (s) => delete s.points.p2.on, /inset with no line/],
		['an aim tension out of range', (s) => (s.points.p9.aim.tout = 5), /aim tension/],
		['an inside loop of an open piece', (s) => (s.pieces[3].insideOf = 1), /no loop/],
		['a relation to a missing piece', (s) => (s.relations[1].piece = 99), /piece 99/],
		['a mirror twin that is gone', (s) => (s.points.p4.mirrorOf = 'p77'), /mirror of p77/],
		['a one-point spline that is no dot', (s) => s.pieces[1].parts.push({ type: 'spline', points: ['p4'] }), /one point/],
		['a loop of two points', (s) => s.pieces[2].parts[0].points.splice(2), /needs 3 points/],
		['a circle that is not closed', (s) => (s.pieces[2].closed = false), /circle is a closed loop/],
	];
	it.each(broken)('finds %s', (_name, breakIt, problem) => {
		const sketch = fullSketch();
		breakIt(sketch);
		const result = validateSketch(sketch);
		expect(result.ok).toBe(false);
		expect(result.problems.join('\n')).toMatch(problem);
	});

	it('leaves a newer format alone', () => {
		expect(validateSketch({ v: 9, anything: true })).toEqual({ ok: true, problems: [], newer: true });
		expect(validateSketch(null).ok).toBe(false);
	});
});

describe('points and pieces', () => {
	it('add with the next ids, whole numbers and a known kind', () => {
		const sketch = newSketch({ key: 'sk_b' });
		const a = addPoint(sketch, { x: 10.4, y: 20.6, kind: 'wobbly' });
		const b = addPoint(sketch, { x: 10, y: 500, kind: 'smooth', on: 'small', inset: 'edge' });
		expect([a, b]).toEqual(['p1', 'p2']);
		expect(getPoint(sketch, 'p1')).toEqual({ x: 10, y: 21, kind: 'corner' });
		expect(nextPointId(sketch)).toBe('p3');
		const piece = addPiece(sketch, { parts: [{ type: 'line', from: a, to: b }] });
		expect(piece).toMatchObject({ id: 1, use: 'center', closed: false });
		expect(piece.key).toMatch(/^pc_/);
		expect(nextPieceId(sketch)).toBe(2);
		expect(getPiece(sketch, 1)).toBe(piece);
		expect(getPiece(sketch, 2)).toBe(null);
		expect(validateSketch(sketch).ok).toBe(true);
	});

	it('know their ends, their points, joins, dots and loops', () => {
		const sketch = fullSketch();
		const [, two, circle, , frame, , dot] = sketch.pieces;
		expect(pieceEnds(two)).toEqual(['p5', 'p4']);
		expect(piecePointIds(two)).toEqual(['p5', 'p6', 'p7', 'p8', 'p9', 'p4']);
		expect(pieceEnds(frame)).toEqual(['o1', 'o1']);
		expect(piecesAt(sketch, 'p2').map((piece) => piece.id)).toEqual([1, 6]);
		expect(isJoined(sketch, 'p2')).toBe(true);
		expect(isJoined(sketch, 'p5')).toBe(true); // on the middle of piece 1
		expect(isJoined(sketch, 'p9')).toBe(false);
		expect(isDot(dot)).toBe(true);
		expect(isDot(two)).toBe(false);
		expect(isCyclicSpline(circle)).toBe(true);
		expect(isCyclicSpline(frame)).toBe(false);
	});
});

describe('migrateSketch', () => {
	it('upgrades a hand-made format 0 to a valid v1', () => {
		const sketch = migrateSketch(v0Sketch());
		expect(validateSketch(sketch)).toEqual({ ok: true, problems: [], newer: false });
		expect(sketch).toMatchObject({ v: SKETCH_V, build: 1, way: 'center', thickness: 89, mirror: { x: 400 } });
		expect(sketch.points).toEqual({
			1: { x: 100, y: 0, kind: 'corner', on: 'writing', inset: 'edge' },
			2: { x: 100, y: 500, kind: 'corner', on: 'small', inset: 'edge' },
			3: { x: 300, y: 521, kind: 'smooth' },
			4: { x: 500, y: 0, kind: 'corner', on: 'writing', inset: 'edge' },
		});
		expect(sketch.pieces.map(({ id, use, closed, parts }) => ({ id, use, closed, parts }))).toEqual([
			{ id: 1, use: 'center', closed: false, parts: [{ type: 'line', from: '1', to: '2' }] },
			{ id: 2, use: 'center', closed: false, parts: [{ type: 'spline', points: ['2', '3', '4'] }] },
		]);
		expect(new Set(sketch.pieces.map((piece) => piece.key)).size).toBe(2);
		expect(sketch.key).toMatch(/^sk_/);
		expect(sketch).toMatchObject({ builtHash: null, setAside: false, relations: [] });
	});

	it('puts no edge inset on an outline sketch (its points are the edge already)', () => {
		const sketch = migrateSketch({ ...v0Sketch(), way: 'outline' });
		expect(sketch.points['1']).toEqual({ x: 100, y: 0, kind: 'corner', on: 'writing' });
		expect(sketch.pieces[0].use).toBe('outline');
	});

	it('keeps a sketch from a newer app untouched, and never builds from it', () => {
		const raw = { v: 7, key: 'sk_future', strange: { nested: [1, 2] } };
		const before = JSON.stringify(raw);
		expect(migrateSketch(raw)).toBe(raw);
		expect(JSON.stringify(raw)).toBe(before);
		expect(isNewerSketch(raw)).toBe(true);
		expect(isSketchActive(raw)).toBe(false);
		const item = { anyink: { sketch: raw } };
		expect(sketchOf(item)).toBe(raw);
		expect(JSON.stringify(item.anyink.sketch)).toBe(before);
	});

	it('fills a v1 sketch that lacks optional fields, and refuses what is no sketch', () => {
		const sketch = migrateSketch({ v: 1, key: 'sk_c', way: 'center', thickness: 60, points: {}, pieces: [] });
		expect(sketch).toMatchObject({ mirror: null, relations: [], setAside: false, builtHash: null, ends: 'round' });
		expect(migrateSketch(null)).toBe(null);
		expect(migrateSketch([])).toBe(null);
		// a v this app can't read is kept untouched, like a newer one (fix track, D-047's promise)
		const unreadable = { v: -3 };
		expect(migrateSketch(unreadable)).toBe(unreadable);
	});

	it('sketchOf upgrades a stored format 0 in place, once', () => {
		const item = { anyink: { sketch: v0Sketch() } };
		const first = sketchOf(item);
		expect(first.v).toBe(1);
		expect(item.anyink.sketch).toBe(first);
		expect(sketchOf(item)).toBe(first);
		expect(sketchOf({ anyink: {} })).toBe(null);
		expect(sketchOf(null)).toBe(null);
	});

	it('setSketch stores and removes', () => {
		const item = {};
		const sketch = newSketch();
		setSketch(item, sketch);
		expect(item.anyink.sketch).toBe(sketch);
		setSketch(item, null);
		expect(item.anyink).toEqual({});
	});

	it('isSketchActive is false once set aside', () => {
		expect(isSketchActive({ ...newSketch(), setAside: true })).toBe(false);
		expect(isSketchActive(newSketch())).toBe(true);
		expect(isSketchActive(null)).toBe(false);
	});
});

describe("the font's thickness", () => {
	it('falls back to the Brush default until it is set', () => {
		const font = project();
		expect(font.settings.anyink.sketchThickness).toBeUndefined();
		expect(sketchThickness(font)).toBe(brushSize(font));
		expect(sketchThickness(font)).toBe(45); // 9 % of 500
		font.settings.anyink.sketchThickness = null;
		expect(sketchThickness(font)).toBe(45);
	});

	it('wins over the Brush once set, whole and inside the Brush range', () => {
		const font = project();
		expect(thicknessRange(font)).toEqual({ min: 15, max: 120 });
		expect(setSketchThickness(font, 99.4)).toBe(99);
		expect(font.settings.anyink.sketchThickness).toBe(99);
		expect(sketchThickness(font)).toBe(99);
		expect(setSketchThickness(font, 4)).toBe(15);
		expect(setSketchThickness(font, 900)).toBe(120);
		expect(setSketchThickness(font, null)).toBe(null);
		expect(font.settings.anyink.sketchThickness).toBe(null);
		expect(sketchThickness(font)).toBe(45);
		expect(setSketchThickness(font, 'thick')).toBe(null);
	});

	it('reads a value stored by the file even with no Brush pref', () => {
		expect(sketchThickness(project({ sketchThickness: 72 }))).toBe(72);
		expect(sketchThickness(project({ sketchThickness: -5 }))).toBe(45);
	});
});
