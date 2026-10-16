// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 extremes.js: where a piece reaches furthest left, right, up and down (on the curve, not only
	at its points), and which smooth points lock level or plumb.
*/
import { describe, expect, it } from 'vitest';
import { cubicExtremes, cubicPoint, lockAll, lockFor, pieceExtremes, skeletonExtremes } from '../extremes.js';
import { pieceSkeleton } from '../curves.js';

/** Dense sampling: the reference the solved extremes must agree with */
function sampled(cubics) {
	const out = { left: Infinity, right: -Infinity, top: -Infinity, bottom: Infinity };
	for (const cubic of cubics) {
		for (let i = 0; i <= 4000; i++) {
			const [x, y] = cubicPoint(cubic, i / 4000);
			out.left = Math.min(out.left, x);
			out.right = Math.max(out.right, x);
			out.top = Math.max(out.top, y);
			out.bottom = Math.min(out.bottom, y);
		}
	}
	return out;
}

function seeded(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

const circlePiece = {
	closed: true,
	circle: { cx: 300, cy: 250, rx: 150, ry: 150 },
	parts: [{ type: 'spline', points: ['c1', 'c2', 'c3', 'c4'] }],
};
const circlePoints = {
	c1: { x: 300, y: 100, kind: 'smooth' },
	c2: { x: 450, y: 250, kind: 'smooth' },
	c3: { x: 300, y: 400, kind: 'smooth' },
	c4: { x: 150, y: 250, kind: 'smooth' },
};

const archPiece = {
	closed: false,
	parts: [
		{ type: 'line', from: 'f1', to: 't1' },
		{ type: 'curve', from: 't1', to: 't2' },
		{ type: 'line', from: 't2', to: 'f2' },
	],
};
const archPoints = {
	f1: { x: 0, y: 0, kind: 'corner' },
	t1: { x: 0, y: 400, kind: 'smooth' },
	t2: { x: 100, y: 400, kind: 'smooth' },
	f2: { x: 100, y: 0, kind: 'corner' },
};

// a small s: top right end, top, left of the upper bowl, the spine, right of the lower bowl,
// bottom, bottom left end
const sPiece = {
	closed: false,
	parts: [{ type: 'spline', points: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] }],
};
const sPoints = {
	s1: { x: 380, y: 420, kind: 'smooth' },
	s2: { x: 240, y: 480, kind: 'smooth' },
	s3: { x: 100, y: 370, kind: 'smooth' },
	s4: { x: 240, y: 250, kind: 'smooth' },
	s5: { x: 390, y: 130, kind: 'smooth' },
	s6: { x: 240, y: 10, kind: 'smooth' },
	s7: { x: 90, y: 70, kind: 'smooth' },
};

describe('extremes on the curve', () => {
	it('a circle: its four sides exactly', () => {
		const e = pieceExtremes(circlePiece, circlePoints);
		expect(e.left.x).toBeCloseTo(150, 6);
		expect(e.left.y).toBeCloseTo(250, 6);
		expect(e.right.x).toBeCloseTo(450, 6);
		expect(e.top.y).toBeCloseTo(400, 6);
		expect(e.top.x).toBeCloseTo(300, 6);
		expect(e.bottom.y).toBeCloseTo(100, 6);
	});

	it('the n arch: top in the middle at 450, feet on the line, stems at the sides', () => {
		const e = pieceExtremes(archPiece, archPoints);
		expect(e.top.x).toBeCloseTo(50, 6);
		expect(e.top.y).toBeCloseTo(450, 6);
		expect(e.top.cubic).toBe(1);
		expect(e.bottom.y).toBe(0);
		expect(e.left.x).toBeCloseTo(0, 9);
		expect(e.right.x).toBeCloseTo(100, 9);
	});

	it('an s: the curve’s own extremes, past its points where it bulges, as sampling finds them', () => {
		const cubics = pieceSkeleton(sPiece, sPoints);
		const e = skeletonExtremes(cubics);
		const ref = sampled(cubics);
		expect(e.left.x).toBeCloseTo(ref.left, 3);
		expect(e.right.x).toBeCloseTo(ref.right, 3);
		expect(e.top.y).toBeCloseTo(ref.top, 3);
		expect(e.bottom.y).toBeCloseTo(ref.bottom, 3);
		// the curve swings a little past the top point and the bowls' sides
		expect(e.top.y).toBeGreaterThanOrEqual(480);
		expect(e.left.x).toBeLessThanOrEqual(90);
		expect(e.right.x).toBeGreaterThanOrEqual(390);
	});

	it('with its points locked level and plumb, the s reaches its extremes at those points', () => {
		const locked = {};
		for (const [id, p] of Object.entries(sPoints)) locked[id] = { ...p };
		locked.s2.lock = 'level';
		locked.s6.lock = 'level';
		locked.s3.lock = 'plumb';
		locked.s5.lock = 'plumb';
		const e = pieceExtremes(sPiece, locked);
		expect(e.top.y).toBeCloseTo(480, 6);
		expect(e.top.x).toBeCloseTo(240, 6);
		expect(e.bottom.y).toBeCloseTo(10, 6);
		expect(e.right.x).toBeCloseTo(390, 6);
	});

	it('any cubic: the solved extremes match dense sampling', () => {
		const rnd = seeded(3);
		for (let trial = 0; trial < 50; trial++) {
			const cubic = Array.from({ length: 4 }, () => [rnd() * 1000 - 500, rnd() * 1000 - 500]);
			const e = skeletonExtremes([cubic]);
			const ref = sampled([cubic]);
			expect(e.left.x).toBeCloseTo(ref.left, 2);
			expect(e.right.x).toBeCloseTo(ref.right, 2);
			expect(e.top.y).toBeCloseTo(ref.top, 2);
			expect(e.bottom.y).toBeCloseTo(ref.bottom, 2);
		}
	});

	it('a straight cubic and a point: just their ends', () => {
		expect(cubicExtremes([[0, 0], [10, 0], [20, 0], [30, 0]]).map((p) => p.t)).toEqual([0, 1]);
		const dot = skeletonExtremes([[[5, 6], [5, 6], [5, 6], [5, 6]]]);
		expect(dot.top).toMatchObject({ x: 5, y: 6 });
		expect(skeletonExtremes([])).toEqual({ left: null, right: null, top: null, bottom: null });
	});
});

describe('the level / plumb lock rule', () => {
	it('a circle: top and bottom level, the sides plumb', () => {
		expect(lockAll(circlePiece, circlePoints)).toEqual({
			c1: 'level',
			c2: 'plumb',
			c3: 'level',
			c4: 'plumb',
		});
	});

	it('an s: top and bottom level, the bowls’ sides plumb, the spine and the ends free', () => {
		expect(lockAll(sPiece, sPoints)).toEqual({
			s2: 'level',
			s3: 'plumb',
			s5: 'plumb',
			s6: 'level',
		});
	});

	it('snapped to a level line it touches: level; to an edge it touches: plumb', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 100, y: 200, kind: 'smooth', on: 'small' },
			c: { x: 300, y: 100, kind: 'smooth', on: 'writing' },
			d: { x: 450, y: 300, kind: 'smooth', on: 'right' },
			e: { x: 400, y: 500 },
		};
		const piece = { closed: false, parts: [{ type: 'spline', points: ['a', 'b', 'c', 'd', 'e'] }] };
		expect(lockFor('b', piece, points)).toBe('level');
		expect(lockFor('c', piece, points)).toBe('level');
		expect(lockFor('d', piece, points)).toBe('plumb');
		// a top that sits on an edge line is not on the edge's side: the edge gives it no lock
		points.e = { x: 400, y: 150 };
		points.d.x = 420;
		expect(lockFor('d', piece, points)).toBe(null);
	});

	it('on the Mirror line: level, the way a mirrored curve crosses it (the top of an O)', () => {
		const points = {
			a: { x: 340, y: 100, kind: 'smooth' },
			top: { x: 540, y: 380, kind: 'smooth' },
			b: { x: 740, y: 100, kind: 'smooth' },
			bottom: { x: 540, y: -180, kind: 'smooth' },
		};
		const piece = { closed: true, parts: [{ type: 'spline', points: ['a', 'bottom', 'b', 'top'] }] };
		points.top.y = 100; // level with both neighbors: only the Mirror line locks it
		points.top.x = 540;
		expect(lockFor('top', piece, { points, mirror: { x: 540 } })).toBe('level');
		expect(lockFor('top', piece, { points, mirror: null })).toBe(null);
		points.top.on = 'mirror';
		expect(lockFor('top', piece, points)).toBe('level');
	});

	it('a flat run of points at one height is not a top', () => {
		const points = {
			a: { x: 0, y: 0 },
			b: { x: 100, y: 200, kind: 'smooth' },
			c: { x: 200, y: 200, kind: 'smooth' },
			d: { x: 300, y: 200, kind: 'smooth' },
			e: { x: 400, y: 0 },
		};
		const piece = { closed: false, parts: [{ type: 'spline', points: ['a', 'b', 'c', 'd', 'e'] }] };
		expect(lockFor('c', piece, points)).toBe(null);
		expect(lockFor('b', piece, points)).toBe('level');
	});

	it('never an open end, never a corner, never a plain join', () => {
		const points = {
			a: { x: 0, y: 500 },
			b: { x: 100, y: 150, kind: 'corner' },
			c: { x: 200, y: 0 },
			d: { x: 300, y: 30, kind: 'corner' },
			e: { x: 400, y: 20 },
		};
		const piece = {
			closed: false,
			parts: [
				{ type: 'spline', points: ['a', 'b', 'c'] },
				{ type: 'line', from: 'c', to: 'd' },
				{ type: 'spline', points: ['d', 'e'] },
			],
		};
		expect(lockFor('a', piece, points)).toBe(null);
		expect(lockFor('b', piece, points)).toBe(null);
		// c is the lowest point but a plain join between parts (not smooth)
		expect(lockFor('c', piece, points)).toBe(null);
		points.c.kind = 'smooth';
		expect(lockFor('c', piece, points)).toBe('level');
		expect(lockFor('zz', piece, points)).toBe(null);
	});
});

// Fix track (critic findings, 10/16/2026): each test below failed before its fix.
describe('fix: a lock is added only where the curve already runs nearly level or plumb', () => {
	it('a narrow peak stays free (no balloon); an o top and an n arch top still lock', () => {
		const peak = { closed: false, parts: [{ type: 'spline', points: ['l', 't', 'r'] }] };
		const narrow = {
			l: { x: 200, y: 0 },
			t: { x: 210, y: 500, kind: 'smooth' },
			r: { x: 220, y: 0 },
		};
		expect(lockFor('t', peak, narrow)).toBe(null);
		const arch = {
			l: { x: 0, y: 0 },
			t: { x: 250, y: 500, kind: 'smooth' },
			r: { x: 500, y: 0 },
		};
		expect(lockFor('t', peak, arch)).toBe('level');
		expect(lockAll(circlePiece, circlePoints)).toMatchObject({ c1: 'level', c3: 'level' });
	});

	it('a narrow tip pinned to a line stays free too (on-a-line still slides, no lock)', () => {
		const peak = { closed: false, parts: [{ type: 'spline', points: ['l', 't', 'r'] }] };
		const points = {
			l: { x: 200, y: 0 },
			t: { x: 210, y: 1100, kind: 'smooth', on: 'small' },
			r: { x: 220, y: 0 },
		};
		expect(lockFor('t', peak, points)).toBe(null);
	});

	it('a point where the stroke crosses a writing line gets no level lock; one that touches it does', () => {
		const piece = { closed: false, parts: [{ type: 'spline', points: ['a', 'm', 'b'] }] };
		const crossing = {
			a: { x: 0, y: 0 },
			m: { x: 300, y: 1100, kind: 'smooth', on: 'small', inset: 'edge' },
			b: { x: 600, y: 2000 },
		};
		expect(lockFor('m', piece, crossing)).toBe(null);
		const touching = {
			a: { x: 0, y: 600 },
			m: { x: 300, y: 1100, kind: 'smooth', on: 'small', inset: 'edge' },
			b: { x: 600, y: 600 },
		};
		expect(lockFor('m', piece, touching)).toBe('level');
		// the same for a letter edge: crossing it is no plumb lock
		const edge = {
			a: { x: 0, y: 0 },
			m: { x: 300, y: 300, kind: 'smooth', on: 'right' },
			b: { x: 600, y: 600 },
		};
		expect(lockFor('m', piece, edge)).toBe(null);
	});
});
