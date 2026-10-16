// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 finalize: the last problems the S1 tracks left open, each pinned by a test written to fail
	before its fix.
	  1. A point pinned to a writing line where the stroke crosses the line (its neighbors on
	     both sides) sits on the line itself: no half-thickness inset, no overshoot, no lock.
	  2. curves.js / extremes.js never read a whole sketch as its points map.
	  3. validateSketch flags a thickness outside the Brush's range when it is given the project.
	  4. The model names every place a point can be pinned (`on`), and extremes.js reads only those.
*/
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { guideLines } from '../../placement/classes.js';
import { pieceSkeleton } from '../curves.js';
import { CROSS_LINES, PLUMB_LINES, lockFor } from '../extremes.js';
import { crossingPoints, edgeY, inkLines, openEnds, placeEdgePoints } from '../edge_rule.js';
import { LINES, ON_PLACES, thicknessRange, validateSketch } from '../model.js';
import { fullSketch } from './fixtures/full_sketch.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const G = guideLines(FONT);

const pt = (x, y, extra = {}) => ({ x, y, kind: 'smooth', ...extra });
const sketchWith = (points, pieces, thickness = 99) => ({ v: 1, way: 'center', thickness, points, pieces });
const spline = (ids, closed = false) => ({ id: 1, use: 'center', closed, parts: [{ type: 'spline', points: ids }] });

describe('1. a point where the stroke crosses a writing line sits on the line', () => {
	// the curves track's probe: a diagonal stroke through the small-letter line
	const diagonal = () =>
		sketchWith(
			{ a: pt(0, 0), m: pt(300, 1051, { on: 'small', inset: 'edge' }), b: pt(600, 2000) },
			[spline(['a', 'm', 'b'])]
		);

	it('is found as a crossing point', () => {
		expect([...crossingPoints(diagonal(), FONT)]).toEqual(['m']);
	});

	it('is placed on the small-letter line, not r below it', () => {
		expect(placeEdgePoints(diagonal(), FONT).points.m.y).toBe(G.small);
	});

	it('gets no overshoot even when stored smooth and level-locked on the writing line', () => {
		const sketch = sketchWith(
			{
				a: pt(0, 400),
				m: pt(200, 30, { on: 'writing', inset: 'edge', lock: 'level' }),
				b: pt(400, -300),
			},
			[spline(['a', 'm', 'b'])]
		);
		expect(placeEdgePoints(sketch, FONT).points.m.y).toBe(G.writing);
		expect(edgeY(sketch.points.m, FONT, 99, { crosses: true })).toBe(G.writing);
	});

	it('works round a closed loop', () => {
		// a loop whose left side runs down through the writing line
		const sketch = sketchWith(
			{
				t: pt(300, 600),
				l: pt(0, 50, { on: 'writing', inset: 'edge' }),
				b: pt(300, -300),
				r: pt(600, 150),
			},
			[spline(['t', 'l', 'b', 'r'], true)]
		);
		expect(crossingPoints(sketch, FONT).has('l')).toBe(true);
		expect(placeEdgePoints(sketch, FONT).points.l.y).toBe(G.writing);
	});

	it('gets no lock from extremes.js either (the two rules agree)', () => {
		const sketch = placeEdgePoints(diagonal(), FONT);
		expect(lockFor('m', sketch.pieces[0], sketch)).toBe(null);
	});

	it('still insets a point that touches the line: the bottom of a v, a foot, a bowl top', () => {
		const ink = inkLines(FONT, 99);
		const v = sketchWith(
			{
				l: pt(0, 1100, { kind: 'corner', on: 'small', inset: 'edge' }),
				p: pt(250, 0, { kind: 'corner', on: 'writing', inset: 'edge' }),
				r: pt(500, 1100, { kind: 'corner', on: 'small', inset: 'edge' }),
			},
			[{ id: 1, use: 'center', closed: false, parts: [
				{ type: 'line', from: 'l', to: 'p' },
				{ type: 'line', from: 'p', to: 'r' },
			] }]
		);
		expect(crossingPoints(v, FONT).size).toBe(0);
		const placed = placeEdgePoints(v, FONT).points;
		expect(placed.p.y).toBe(Math.round(ink.writing));
		expect(placed.l.y).toBe(Math.round(ink.small));
		// a neighbor that sits on the line is on neither side: no crossing
		const flat = sketchWith(
			{ a: pt(0, 0, { on: 'writing', inset: 'edge' }), m: pt(200, 0, { on: 'writing', inset: 'edge' }), b: pt(400, 500) },
			[spline(['a', 'm', 'b'])]
		);
		expect(crossingPoints(flat, FONT).size).toBe(0);
	});

	it('openEnds names the ends of open pieces (the old edge_rule pieceEnds)', () => {
		expect([...openEnds(diagonal())].sort()).toEqual(['a', 'b']);
	});
});

describe('2. a sketch with no points map is never read as its own points', () => {
	const noPoints = { v: 1, key: 'sk_x', way: 'center', thickness: 99, pieces: [] };
	const piece = spline(['v', 'key', 'thickness']);

	it('pieceSkeleton gives no curve', () => {
		expect(pieceSkeleton(piece, noPoints)).toEqual([]);
		expect(pieceSkeleton(piece, { ...noPoints, points: ['oops'] })).toEqual([]);
	});

	it('lockFor gives no lock', () => {
		expect(lockFor('key', piece, noPoints)).toBe(null);
	});

	it('a plain points map is still read as one', () => {
		const map = { v: pt(0, 0), key: pt(100, 100), thickness: pt(200, 0) };
		expect(pieceSkeleton(piece, map).length).toBeGreaterThan(0);
	});
});

describe('3. validateSketch with the project flags a thickness out of range', () => {
	const project = new GlyphrStudioProject({ settings: { font: { upm: 1000, xHeight: 500, capHeight: 700 } } });

	it('flags too thick and too thin, passes the range and 0 (an outline letter)', () => {
		const { min, max } = thicknessRange(project);
		const at = (thickness) => validateSketch({ ...fullSketch(), thickness }, { project });
		expect(at(max + 1).problems.join()).toMatch(/thickness out of range/);
		expect(at(min - 1).problems.join()).toMatch(/thickness out of range/);
		expect(at(max).ok).toBe(true);
		expect(at(min).ok).toBe(true);
		expect(at(0).ok).toBe(true);
	});

	it('without the project it only checks the number is whole', () => {
		expect(validateSketch({ ...fullSketch(), thickness: 5000 }).ok).toBe(true);
	});
});

describe('4. every place a point can be pinned has one stored name', () => {
	it('ON_PLACES holds the writing lines, the half-way lines, the edges, the middle and the Mirror line', () => {
		expect(ON_PLACES).toEqual([
			...LINES,
			'halfSmall',
			'halfCapitals',
			'left',
			'right',
			'middle',
			'mirror',
		]);
	});

	it('extremes.js reads only stored names', () => {
		for (const name of [...PLUMB_LINES, ...CROSS_LINES]) expect(ON_PLACES).toContain(name);
	});

	it.each(['halfSmall', 'halfCapitals', 'left', 'right', 'middle', 'mirror'])(
		'validateSketch accepts on "%s"',
		(on) => {
			const sketch = fullSketch();
			sketch.points.p9.on = on;
			expect(validateSketch(sketch)).toEqual({ ok: true, problems: [], newer: false });
		}
	);

	it('an edge inset is still only for the five writing lines', () => {
		const sketch = fullSketch();
		sketch.points.p2.on = 'halfSmall';
		expect(validateSketch(sketch).problems.join()).toMatch(/inset with no line/);
	});
});
