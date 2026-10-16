// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S1 step 7 (docs/SKETCH.md 6 "The edge rule", D-047 point 3): a Centerline point
	snapped to a line puts the edge of the ink on that line; round tops and bottoms overshoot.
	Templates o, n, v and A are placed by placeEdgePoints at thickness 60, 99 and 200, their
	centerlines swept with the Brush's own round nib (nib/sweep.js), and the ink measured: every
	pinned edge on its line within 1 unit, plus the overshoot on round tops and bottoms only.
*/
import { describe, expect, it } from 'vitest';
import { MAX_SHARE } from '../../nib/brush_size.js';
import { sweepRoundNib } from '../../nib/sweep.js';
import { guideLines } from '../../placement/classes.js';
import {
	INK_SIDE,
	edgeThickness,
	edgeY,
	inkLines,
	overshootOf,
	openEnds,
	placeEdgePoints,
	roundPoints,
} from '../edge_rule.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const LINES = guideLines(FONT);
const O = LINES.overshoot; // 30.72
const THICKNESSES = [60, 99, 200];

// ---- templates (points stored where a first drawing left them: anywhere near the line) ----

const pin = (x, y, on, extra = {}) => ({ x, y, kind: 'corner', on, inset: 'edge', ...extra });
const free = (x, y, extra = {}) => ({ x, y, kind: 'smooth', on: null, inset: null, ...extra });
const round = (x, y, on) => pin(x, y, on, { kind: 'smooth', lock: 'level' });
const sketchOf = (points, pieces, thickness) => ({
	v: 1,
	way: 'center',
	thickness,
	points,
	pieces,
});
const spline = (ids, closed = false) => ({
	use: 'center',
	closed,
	parts: [{ type: 'spline', points: ids }],
});
const lines = (ids) => ({
	use: 'center',
	closed: false,
	parts: ids.slice(1).map((to, i) => ({ type: 'line', from: ids[i], to })),
});

function templateO(thickness) {
	return sketchOf(
		{
			top: round(300, 1100, 'small'),
			left: free(60, 550, { lock: 'plumb' }),
			bottom: round(300, 0, 'writing'),
			right: free(540, 550, { lock: 'plumb' }),
		},
		[{ id: 1, key: 'pc_o', ...spline(['top', 'left', 'bottom', 'right'], true) }],
		thickness
	);
}

function templateN(thickness) {
	return sketchOf(
		{
			foot: pin(80, 0, 'writing'),
			stemTop: pin(80, 1100, 'small'),
			join: free(80, 700, { kind: 'corner' }),
			arch: round(320, 1100, 'small'),
			right: pin(560, 0, 'writing'),
		},
		[
			{ id: 1, key: 'pc_stem', ...lines(['foot', 'stemTop']) },
			{ id: 2, key: 'pc_arch', ...spline(['join', 'arch', 'right']) },
		],
		thickness
	);
}

function templateV(thickness) {
	return sketchOf(
		{
			left: pin(40, 1100, 'small'),
			point: pin(300, 0, 'writing'),
			right: pin(560, 1100, 'small'),
		},
		[{ id: 1, key: 'pc_v', ...lines(['left', 'point', 'right']) }],
		thickness
	);
}

function templateA(thickness) {
	return sketchOf(
		{
			leftFoot: pin(40, 0, 'writing'),
			apex: pin(500, 1480, 'capitals'),
			rightFoot: pin(960, 0, 'writing'),
			barLeft: free(190, 480, { kind: 'corner' }),
			barRight: free(810, 480, { kind: 'corner' }),
		},
		[
			{ id: 1, key: 'pc_a', ...lines(['leftFoot', 'apex', 'rightFoot']) },
			{ id: 2, key: 'pc_bar', ...lines(['barLeft', 'barRight']) },
		],
		thickness
	);
}

// ---- centerlines from the placed points (a stand-in for sketch/curves.js, test only) ----

const P = (point) => [point.x, point.y];
const segment = (a, b) => [
	a,
	[a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
	[a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
	b,
];
const K = 0.5523;

/** An ellipse through the four placed extremes of an o, level at top and bottom */
function ringO({ top, left, bottom, right }) {
	const cx = (left.x + right.x) / 2;
	const cy = (top.y + bottom.y) / 2;
	const rx = (right.x - left.x) / 2;
	const ry = (top.y - bottom.y) / 2;
	const t = [cx, top.y];
	const l = [left.x, cy];
	const b = [cx, bottom.y];
	const r = [right.x, cy];
	return [
		[t, [cx - K * rx, top.y], [left.x, cy + K * ry], l],
		[l, [left.x, cy - K * ry], [cx - K * rx, bottom.y], b],
		[b, [cx + K * rx, bottom.y], [right.x, cy - K * ry], r],
		[r, [right.x, cy + K * ry], [cx + K * rx, top.y], t],
	];
}

/** n's arch: up from the stem, level over its top, down plumb into the right foot */
function archN({ join, arch, right }) {
	return [
		[P(join), [join.x, arch.y], [arch.x - 120, arch.y], P(arch)],
		[P(arch), [arch.x + 140, arch.y], [right.x, arch.y - 300], P(right)],
	];
}

function inkOf(skeletons, thickness) {
	return skeletons.flatMap((skeleton) => sweepRoundNib(skeleton, thickness)).flat();
}

/** The ink's highest or lowest y among outline points within `reach` of x */
function inkExtreme(ink, x, reach, which) {
	const ys = ink.filter(([px]) => Math.abs(px - x) <= reach).map(([, y]) => y);
	return which === 'top' ? Math.max(...ys) : Math.min(...ys);
}

// ---- the rule itself ----

describe('inkLines: each writing line moved half the thickness to its ink side', () => {
	it('the writing and tail lines carry ink above, the others below', () => {
		expect(INK_SIDE).toEqual({ top: -1, capitals: -1, small: -1, writing: 1, tail: 1 });
		const ink = inkLines(FONT, 99);
		expect(ink.writing).toBeCloseTo(49.5, 6);
		expect(ink.tail).toBeCloseTo(-440 + 49.5, 6);
		expect(ink.small).toBeCloseTo(1100 - 49.5, 6);
		expect(ink.capitals).toBeCloseTo(1480 - 49.5, 6);
		expect(ink.top).toBeCloseTo(1550 - 49.5, 6);
	});

	it('reads the lines from guideLines, with its defaults for a font missing them', () => {
		const ink = inkLines({ upm: 1000, xHeight: 500 }, 40);
		expect(ink.small).toBeCloseTo(480, 6);
		expect(ink.capitals).toBeCloseTo(guideLines({}).capitals - 20, 6);
	});
});

describe('overshoot: round tops and bottoms only', () => {
	it('a smooth level-locked point on the writing, small-letter or capitals line goes outward', () => {
		expect(overshootOf(round(0, 0, 'writing'), FONT)).toBeCloseTo(-O, 6);
		expect(overshootOf(round(0, 0, 'small'), FONT)).toBeCloseTo(O, 6);
		expect(overshootOf(round(0, 0, 'capitals'), FONT)).toBeCloseTo(O, 6);
	});

	it('never on the top or tail line, a corner, a plumb or unlocked point, or an end', () => {
		expect(overshootOf(round(0, 0, 'top'), FONT)).toBe(0);
		expect(overshootOf(round(0, 0, 'tail'), FONT)).toBe(0);
		expect(overshootOf(pin(0, 0, 'writing', { lock: 'level' }), FONT)).toBe(0);
		expect(overshootOf(pin(0, 0, 'writing', { kind: 'smooth', lock: 'plumb' }), FONT)).toBe(0);
		expect(overshootOf(pin(0, 0, 'writing', { kind: 'smooth' }), FONT)).toBe(0);
		expect(overshootOf(round(0, 0, 'writing'), FONT, { isEnd: true })).toBe(0);
	});

	it('is the share of the letter box guideLines gives (15 units on a 1,000 box)', () => {
		expect(overshootOf(round(0, 0, 'small'), { upm: 1000 })).toBeCloseTo(15, 6);
	});
});

describe('edgeY: where a pinned point goes', () => {
	it('inset edge: line plus or minus r; on the line itself otherwise (Outline points)', () => {
		expect(edgeY(pin(0, 7, 'writing'), FONT, 200)).toBe(100);
		expect(edgeY(pin(0, 7, 'small'), FONT, 200)).toBe(1000);
		expect(edgeY({ ...pin(0, 7, 'small'), inset: null }, FONT, 200)).toBe(1100);
		expect(edgeY({ ...round(0, 7, 'small'), inset: null }, FONT, 200)).toBe(1131);
	});

	it('whole numbers, and null for a point on no line or a line it does not know', () => {
		expect(Number.isInteger(edgeY(pin(0, 7, 'writing'), FONT, 99))).toBe(true);
		expect(edgeY(free(0, 7), FONT, 99)).toBe(null);
		expect(edgeY(pin(0, 7, 'halfway'), FONT, 99)).toBe(null);
	});
});

describe('openEnds: the ends of open pieces', () => {
	it('first and last point of each open piece, none for a closed one', () => {
		const n = templateN(99);
		expect([...openEnds(n)].sort()).toEqual(['foot', 'join', 'right', 'stemTop']);
		expect(openEnds(templateO(99)).size).toBe(0);
		const v = templateV(99);
		expect([...openEnds(v)].sort()).toEqual(['left', 'right']);
	});
});

describe('placeEdgePoints: pure, re-places every inset edge point', () => {
	it('leaves the input alone and free points where they were', () => {
		const sketch = templateN(99);
		const before = JSON.stringify(sketch);
		const placed = placeEdgePoints(sketch, FONT);
		expect(JSON.stringify(sketch)).toBe(before);
		expect(placed.points.join).toBe(sketch.points.join);
		expect(placed.points.foot.x).toBe(80);
		expect(placed.pieces).toBe(sketch.pieces);
	});

	it('a thickness change moves each edge point by the change in r, inside the same call', () => {
		const thin = placeEdgePoints(templateA(99), FONT);
		const thick = placeEdgePoints({ ...thin, thickness: 200 }, FONT);
		// r goes from 49.5 to 100; whole numbers, so each point moves 50 or 51
		const feet = thick.points.leftFoot.y - thin.points.leftFoot.y;
		const apex = thin.points.apex.y - thick.points.apex.y;
		expect(Math.abs(feet - 50.5)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(apex - 50.5)).toBeLessThanOrEqual(0.5);
	});

	it('a sketch with no thickness comes back as it was', () => {
		const sketch = { ...templateV(99), thickness: null };
		expect(placeEdgePoints(sketch, FONT)).toBe(sketch);
	});

	it('a point named by a line move (B15) follows the line', () => {
		const placed = placeEdgePoints(templateV(60), { ...FONT, xHeight: 1000 });
		expect(placed.points.left.y).toBe(970);
		expect(placed.points.point.y).toBe(30);
	});
});

describe('the ink edge sits on the line: o, n, v, A swept with the round nib', () => {
	it('without the rule, a point on the line leaves the ink hanging half the thickness over it', () => {
		const { points } = templateV(99);
		const skeleton = [
			segment(P(points.left), P(points.point)),
			segment(P(points.point), P(points.right)),
		];
		const ink = inkOf([skeleton], 99);
		expect(inkExtreme(ink, 300, 150, 'bottom')).toBeLessThan(-48);
	});

	for (const thickness of THICKNESSES) {
		const r = thickness / 2;

		it(`o at ${thickness}: top and bottom ink one overshoot past the lines`, () => {
			const { points } = placeEdgePoints(templateO(thickness), FONT);
			const ink = inkOf([ringO(points)], thickness);
			expect(Math.abs(inkExtreme(ink, 300, r, 'top') - (1100 + O))).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(ink, 300, r, 'bottom') - (0 - O))).toBeLessThanOrEqual(1);
		});

		it(`n at ${thickness}: feet and stem top on the lines, the arch top overshoots`, () => {
			const { points } = placeEdgePoints(templateN(thickness), FONT);
			const stem = segment(P(points.foot), P(points.stemTop));
			// each piece's ink on its own (the arch leaves the stem near its top)
			const stemInk = inkOf([[stem]], thickness);
			const archInk = inkOf([archN(points)], thickness);
			expect(Math.abs(inkExtreme(stemInk, 80, r, 'bottom'))).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(stemInk, 80, r, 'top') - 1100)).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(archInk, 560, r, 'bottom'))).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(archInk, 320, r, 'top') - (1100 + O))).toBeLessThanOrEqual(1);
			// only the round top overshoots: the arch rises O above the flat stem top
			const lift = inkExtreme(archInk, 320, r, 'top') - inkExtreme(stemInk, 80, r, 'top');
			expect(Math.abs(lift - O)).toBeLessThanOrEqual(1);
		});

		it(`v at ${thickness}: the point on the writing line, the arms on the small-letter line`, () => {
			const { points } = placeEdgePoints(templateV(thickness), FONT);
			const skeleton = [
				segment(P(points.left), P(points.point)),
				segment(P(points.point), P(points.right)),
			];
			const ink = inkOf([skeleton], thickness);
			expect(Math.abs(inkExtreme(ink, 300, 3 * r, 'bottom'))).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(ink, 40, 2 * r, 'top') - 1100)).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(ink, 560, 2 * r, 'top') - 1100)).toBeLessThanOrEqual(1);
		});

		it(`A at ${thickness}: the apex on the capitals line, the feet on the writing line`, () => {
			const { points } = placeEdgePoints(templateA(thickness), FONT);
			const skeleton = [
				segment(P(points.leftFoot), P(points.apex)),
				segment(P(points.apex), P(points.rightFoot)),
			];
			const bar = [segment(P(points.barLeft), P(points.barRight))];
			const ink = inkOf([skeleton, bar], thickness);
			expect(Math.abs(inkExtreme(ink, 500, 3 * r, 'top') - 1480)).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(ink, 40, 2 * r, 'bottom'))).toBeLessThanOrEqual(1);
			expect(Math.abs(inkExtreme(ink, 960, 2 * r, 'bottom'))).toBeLessThanOrEqual(1);
			// the crossbar is pinned to nothing and stays where it was drawn
			expect(points.barLeft.y).toBe(480);
		});
	}
});

describe('a round bottom that also starts another piece still overshoots', () => {
	// Fix track (measures): joined points share ids (model.js isJoined), so the level round
	// bottom of a closed bowl can also be where a stem or tail starts (a, d, g, q, Q). It is
	// decided per point: a level smooth point inside any closed piece, or between the ends of an
	// open one, is a round top or bottom, even when it also ends another piece.
	function bowlWithStem(thickness, withStem = true) {
		return sketchOf(
			{
				top: round(300, 1100, 'small'),
				left: free(60, 550, { lock: 'plumb' }),
				bottom: round(300, 0, 'writing'),
				right: free(540, 550, { lock: 'plumb' }),
				tail: pin(300, -440, 'tail'),
			},
			[
				{ id: 1, key: 'pc_bowl', ...spline(['top', 'left', 'bottom', 'right'], true) },
				...(withStem ? [{ id: 2, key: 'pc_tail', ...lines(['bottom', 'tail']) }] : []),
			],
			thickness
		);
	}

	it('the shared bottom sits where the bowl alone puts it (49.5 - 30.72 at 99)', () => {
		const alone = placeEdgePoints(bowlWithStem(99, false), FONT).points.bottom.y;
		const joined = placeEdgePoints(bowlWithStem(99), FONT).points.bottom.y;
		expect(alone).toBe(Math.round(49.5 - O));
		expect(joined).toBe(alone);
	});

	it('inside an open piece too: a level round point between the ends of one piece', () => {
		const sketch = sketchOf(
			{
				a: pin(0, 600, 'small', { kind: 'corner' }),
				low: round(200, 0, 'writing'),
				b: free(400, 600),
				c: free(200, -200),
			},
			[
				{ id: 1, key: 'pc_u', ...spline(['a', 'low', 'b']) },
				{ id: 2, key: 'pc_t', ...lines(['low', 'c']) },
			],
			99
		);
		expect(placeEdgePoints(sketch, FONT).points.low.y).toBe(Math.round(49.5 - O));
	});

	it('an end that is only an end still never overshoots', () => {
		const sketch = sketchOf(
			{ a: round(0, 0, 'writing'), b: free(0, 600) },
			[{ id: 1, key: 'pc_s', ...lines(['a', 'b']) }],
			99
		);
		expect(placeEdgePoints(sketch, FONT).points.a.y).toBe(50);
	});

	it('roundPoints: the ids inside a closed piece or between the ends of an open one', () => {
		expect([...roundPoints(bowlWithStem(99))].sort()).toEqual(['bottom', 'left', 'right', 'top']);
		expect([...roundPoints(templateV(99))]).toEqual(['point']);
	});
});

describe('the thickness never pushes the ink lines past each other', () => {
	// Fix track (measures): sketch.thickness is only checked as a whole number, and the
	// small-letter line can move (B15). At 1200 with the small-letter line at 1100 the ink lines
	// crossed (small 500, writing 600) and an o's top went under its bottom.
	const max = Math.round(MAX_SHARE * FONT.xHeight); // the slider's thick end, 264

	it('edgeThickness: the thickness the rule uses, never past the slider range', () => {
		expect(edgeThickness(FONT, 99)).toBe(99);
		expect(edgeThickness(FONT, 1200)).toBe(max);
		expect(edgeThickness({ ...FONT, xHeight: 300 }, 200)).toBe(Math.round(MAX_SHARE * 300));
		expect(edgeThickness(FONT, null)).toBe(0);
	});

	it('inkLines at 1200: the small-letter ink line stays above the writing one', () => {
		const ink = inkLines(FONT, 1200);
		expect(ink.small).toBeGreaterThan(ink.writing);
		expect(ink.writing).toBeCloseTo(max / 2, 6);
	});

	it('placeEdgePoints at 1200: the o keeps its top above its bottom', () => {
		const { points } = placeEdgePoints(templateO(1200), FONT);
		expect(points.top.y).toBeGreaterThan(points.bottom.y);
		expect(points.top.y).toBe(Math.round(1100 - max / 2 + O));
	});

	it('a small-letter line moved down under a thick letter (B15) keeps the order too', () => {
		const font = { ...FONT, xHeight: 120 };
		const ink = inkLines(font, 264);
		expect(ink.small).toBeGreaterThanOrEqual(ink.writing);
		const { points } = placeEdgePoints(templateO(264), font);
		expect(points.top.y).toBeGreaterThan(points.bottom.y);
	});
});
