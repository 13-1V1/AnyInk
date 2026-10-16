// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 snap.js (docs/SKETCH.md section 6): where a click lands. Writing lines through the edge
	rule, points and pieces of the sketch, a Line piece's middle, the letter's edges only while
	spacing is set by him, the half-way lines for centers, level / plumb hints from other points,
	Shift's level / plumb / 45, Ctrl turning snaps off, a radius in screen pixels, and the level /
	plumb locks of a drawn piece. Written to fail first (snap.js did not exist: every test failed).
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { HIT_ZONE_PX } from '../../../metrics/hit_test.js';
import { inkLines, placeEdgePoints } from '../../edge_rule.js';
import { pieceSkeleton } from '../../curves.js';
import { newSketch } from '../../model.js';
import {
	LINE_WORDS,
	TANGENT_REACH,
	forDrawLayer,
	inkLineHints,
	pinFields,
	relationsFor,
	settleLocks,
	snapPoint,
	snapRadius,
	tagText,
} from '../snap.js';

const font = {};
const lines = guideLines(font);
const view = { dx: 0, dy: 0, dz: 0.5 }; // radius 12 font units
const R = HIT_ZONE_PX / view.dz;

/** A sketch with a stem (p1 to p2) and a slanted line (p3 to p4) */
function stemSketch() {
	const sketch = newSketch({ thickness: 100 });
	sketch.points = {
		p1: { x: 200, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
		p2: { x: 200, y: 1050, kind: 'corner', on: 'small', inset: 'edge' },
		p3: { x: 600, y: 300, kind: 'corner' },
		p4: { x: 900, y: 600, kind: 'corner' },
	};
	sketch.pieces = [
		{
			id: 1,
			key: 'pc_1',
			use: 'center',
			closed: false,
			parts: [{ type: 'line', from: 'p1', to: 'p2' }],
		},
		{
			id: 2,
			key: 'pc_2',
			use: 'center',
			closed: false,
			parts: [{ type: 'line', from: 'p3', to: 'p4' }],
		},
	];
	return sketch;
}

const ctx = (extra = {}) => ({
	sketch: stemSketch(),
	font,
	view,
	thickness: 100,
	use: 'center',
	...extra,
});

describe('snap radius', () => {
	it('is the same number of screen pixels at every zoom', () => {
		expect(snapRadius({ dz: 1 })).toBe(HIT_ZONE_PX);
		expect(snapRadius({ dz: 0.5 })).toBe(HIT_ZONE_PX * 2);
		expect(snapRadius({ dz: 2 })).toBe(HIT_ZONE_PX / 2);
	});

	it('a pointer just outside the radius does not snap; just inside does', () => {
		const inside = snapPoint({ x: 1500, y: lines.small + R - 1 }, ctx({ use: 'outline' }));
		expect(inside.on).toBe('small');
		const outside = snapPoint({ x: 1500, y: lines.small + R + 1 }, ctx({ use: 'outline' }));
		expect(outside.on).toBe(null);
		// zoomed in four times, the same font distance is now outside
		const zoomed = snapPoint(
			{ x: 1500, y: lines.small + R - 1 },
			ctx({ use: 'outline', view: { dz: 2 } })
		);
		expect(zoomed.on).toBe(null);
	});
});

describe('the writing lines and the edge rule', () => {
	it('a Centerline point on the writing line puts the ink edge on the line (center r above)', () => {
		const ink = inkLines(font, 100);
		const hit = snapPoint({ x: 1500, y: 3 }, ctx());
		expect(hit.on).toBe('writing');
		expect(hit.inset).toBe('edge');
		expect(hit.y).toBe(Math.round(ink.writing));
		expect(hit.y).toBe(50);
		expect(hit.snapped).toBe(true);
		expect(pinFields(hit)).toEqual({ on: 'writing', inset: 'edge' });
	});

	it('only the real line pulls: the faint ink line is where the dot lands, not a target', () => {
		// fix track chain-snap: aiming at the ink line once snapped too (a band up to 17 px tall)
		expect(snapPoint({ x: 1500, y: 52 }, ctx()).on).toBe(null);
		const hit = snapPoint({ x: 1500, y: R - 1 }, ctx());
		expect(hit.on).toBe('writing');
		expect(hit.y).toBe(50);
	});

	// S3 finalize (build verifier): a stem's end clicked at y 28, inside where its ink would be
	// (thickness 99) but past the snap radius, was stored loose and never followed a thickness
	// change. The band between a line and its ink line pulls too; past the ink line nothing does
	it('a click between a line and its ink line pins the point to the line', () => {
		expect(28).toBeGreaterThan(R);
		const low = snapPoint({ x: 1500, y: 28 }, ctx());
		expect(low.on).toBe('writing');
		expect(low.y).toBe(50);
		const high = snapPoint({ x: 1500, y: lines.small - 40 }, ctx());
		expect(high.on).toBe('small');
		expect(high.y).toBe(lines.small - 50);
		// past the ink line: free
		expect(snapPoint({ x: 1500, y: lines.small - 60 }, ctx()).on).toBe(null);
		// an Outline point has no band: only the radius around the line
		expect(snapPoint({ x: 1500, y: 28 }, ctx({ use: 'outline' })).on).toBe(null);
	});

	it('below the small-letter, capitals and top lines; above the tail line', () => {
		const ink = inkLines(font, 100);
		for (const name of ['small', 'capitals', 'top', 'tail']) {
			const hit = snapPoint({ x: 1500, y: lines[name] + 2 }, ctx());
			expect(hit.on).toBe(name);
			expect(hit.y).toBe(Math.round(ink[name]));
		}
		expect(snapPoint({ x: 1500, y: lines.small }, ctx()).y).toBe(lines.small - 50);
		expect(snapPoint({ x: 1500, y: lines.tail }, ctx()).y).toBe(lines.tail + 50);
	});

	it('an Outline point sits on the line itself, no inset', () => {
		const hit = snapPoint({ x: 1500, y: 4 }, ctx({ use: 'outline' }));
		expect(hit.on).toBe('writing');
		expect(hit.inset).toBe(null);
		expect(hit.y).toBe(0);
		expect(pinFields(hit)).toEqual({ on: 'writing' });
	});

	it('the edge rule thickness is kept in range (a huge thickness never crosses the lines)', () => {
		const hit = snapPoint({ x: 1500, y: 2 }, ctx({ thickness: 5000 }));
		expect(hit.y).toBe(Math.round(inkLines(font, 5000).writing));
		expect(hit.y).toBeLessThan(lines.small / 2);
	});

	it('a point the stroke crosses its line at stays on the line itself once placed (D-048)', () => {
		// a diagonal from below the small-letter line to above it, its middle point snapped there
		const sketch = newSketch({ thickness: 100 });
		const mid = snapPoint({ x: 500, y: lines.small - 1 }, { ...ctx(), sketch });
		sketch.points = {
			a: { x: 300, y: 600, kind: 'corner' },
			b: { x: 500, y: mid.y, kind: 'corner', ...pinFields(mid) },
			c: { x: 700, y: 1400, kind: 'corner' },
		};
		sketch.pieces = [
			{
				id: 1,
				key: 'k',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'a', to: 'b' },
					{ type: 'line', from: 'b', to: 'c' },
				],
			},
		];
		expect(placeEdgePoints(sketch, font).points.b.y).toBe(lines.small);
	});

	it('the faint ink lines for the draw layer: Centerline only', () => {
		const hints = inkLineHints(font, 100, 'center');
		expect(hints).toContainEqual({ type: 'inkLine', on: 'writing', y: 50 });
		expect(hints).toContainEqual({ type: 'inkLine', on: 'small', y: lines.small - 50 });
		expect(hints).toHaveLength(5);
		expect(inkLineHints(font, 100, 'outline')).toEqual([]);
		expect(inkLineHints(font, 0, 'center')).toEqual([]);
	});

	it('names the line at the cursor in house words', () => {
		const hit = snapPoint({ x: 1500, y: lines.small + 1 }, ctx());
		expect(hit.tag).toEqual({ key: LINE_WORDS.small });
		expect(tagText(hit.tag)).toBe('small-letter line');
		expect(tagText(snapPoint({ x: 1500, y: 1 }, ctx()).tag)).toBe('writing line');
		expect(hit.hints).toContainEqual({ type: 'line', on: 'small', y: lines.small });
	});
});

describe('points and pieces of the sketch', () => {
	it('an existing point wins: the click joins it exactly', () => {
		const hit = snapPoint({ x: 205, y: 1047 }, ctx());
		expect(hit.join).toBe('p2');
		expect([hit.x, hit.y]).toEqual([200, 1050]);
		expect(hit.tag).toEqual({ key: 'sketch.tag.joins' });
		expect(tagText(hit.tag)).toBe('joins');
	});

	it('the moving point itself is skipped', () => {
		const hit = snapPoint({ x: 205, y: 1047 }, ctx({ exclude: ['p2'] }));
		expect(hit.join).toBe(null);
	});

	it("the open piece's first point closes the loop", () => {
		expect(snapPoint({ x: 598, y: 302 }, ctx({ first: 'p3' })).closes).toBe(true);
		expect(snapPoint({ x: 205, y: 1047 }, ctx({ first: 'p3' })).closes).toBe(false);
	});

	it("a Line piece's middle is stored as onPiece t = 0.5", () => {
		const hit = snapPoint({ x: 754, y: 448 }, ctx());
		expect(hit.onPiece).toEqual({ piece: 2, t: 0.5, middle: true });
		expect([hit.x, hit.y]).toEqual([750, 450]);
		expect(tagText(hit.tag)).toBe('middle');
		expect(relationsFor(hit, 'p9')).toEqual([{ type: 'onPiece', point: 'p9', piece: 2, t: 0.5 }]);
	});

	it('on a piece: the nearest place on it, with its share along the piece', () => {
		const hit = snapPoint({ x: 206, y: 300 }, ctx());
		expect(hit.onPiece.piece).toBe(1);
		expect(hit.x).toBe(200);
		expect(hit.y).toBe(300);
		expect(hit.onPiece.t).toBeCloseTo(0.25, 3);
		expect(tagText(hit.tag)).toBe('on the stem');
		// a straight piece steeper than 30 degrees off level is a stem, flatter a bar
		const slant = snapPoint({ x: 680, y: 390 }, ctx());
		expect(slant.onPiece.piece).toBe(2);
		expect(tagText(slant.tag)).toBe('on the stem');
		const sketch = stemSketch();
		sketch.points.p4 = { x: 1200, y: 400, kind: 'corner' };
		expect(tagText(snapPoint({ x: 1000, y: 372 }, ctx({ sketch })).tag)).toBe('on the bar');
	});

	it('a piece beats a writing line, a point beats a piece', () => {
		expect(snapPoint({ x: 203, y: 52 }, ctx()).join).toBe('p1');
		// 9 units off the stem, 10 off the small-letter ink line, 13.4 from the stem's top point
		const onStemNearLine = snapPoint({ x: 209, y: 1040 }, ctx());
		expect(onStemNearLine.onPiece?.piece).toBe(1);
	});
});

describe('level and plumb hints', () => {
	it('level with another point: y taken from it and a dotted line from it', () => {
		const hit = snapPoint({ x: 1200, y: 305 }, ctx());
		expect(hit.y).toBe(300);
		expect(hit.x).toBe(1200);
		expect(hit.pair).toEqual({ type: 'level', with: 'p3' });
		expect(hit.hints).toContainEqual({
			type: 'level',
			pointId: 'p3',
			from: { x: 600, y: 300 },
			to: { x: 1200, y: 300 },
		});
		expect(relationsFor(hit, 'p9')).toEqual([{ type: 'level', a: 'p3', b: 'p9' }]);
	});

	it('plumb with another point', () => {
		const hit = snapPoint({ x: 896, y: 1300 }, ctx());
		expect(hit.x).toBe(900);
		expect(hit.pair).toEqual({ type: 'plumb', with: 'p4' });
		expect(tagText(hit.tag)).toBe('plumb');
	});

	it('a writing line and a plumb hint at once', () => {
		const hit = snapPoint({ x: 897, y: 4 }, ctx());
		expect(hit.on).toBe('writing');
		expect(hit.y).toBe(50);
		expect(hit.x).toBe(900);
		expect(hit.pair).toEqual({ type: 'plumb', with: 'p4' });
	});
});

describe('the letter edges and the half-way lines', () => {
	const edges = { left: 0, right: 1000 };

	it('left / right / middle only while spacing is set by him', () => {
		expect(snapPoint({ x: 4, y: 700 }, ctx({ edges })).on).toBe(null);
		const left = snapPoint({ x: 4, y: 700 }, ctx({ edges, manual: true }));
		expect(left.on).toBe('left');
		expect(left.x).toBe(0);
		expect(tagText(left.tag)).toBe('left edge');
		expect(snapPoint({ x: 995, y: 700 }, ctx({ edges, manual: true })).on).toBe('right');
		const middle = snapPoint({ x: 497, y: 1250 }, ctx({ edges, manual: true }));
		expect(middle.on).toBe('middle');
		expect(middle.x).toBe(500);
	});

	it("while spacing is automatic the ink's middle is a hint only, never pinned", () => {
		const hit = snapPoint({ x: 497, y: 1250 }, ctx({ edges, inkMiddle: 500 }));
		expect(hit.x).toBe(500);
		expect(hit.on).toBe(null);
		expect(pinFields(hit)).toEqual({});
		expect(hit.hints).toContainEqual({ type: 'middle', x: 500 });
	});

	it('the half-way lines are center snaps only', () => {
		const half = (lines.writing + lines.small) / 2;
		expect(snapPoint({ x: 1500, y: half + 3 }, ctx()).on).toBe(null);
		const center = snapPoint({ x: 1500, y: half + 3 }, ctx({ halfway: true }));
		expect(center.on).toBe('halfSmall');
		expect(center.y).toBe(Math.round(half));
		expect(center.inset).toBe(null);
		expect(tagText(center.tag)).toBe('half-way line');
		const caps = snapPoint({ x: 1500, y: lines.capitals / 2 - 2 }, ctx({ halfway: true }));
		expect(caps.on).toBe('halfCapitals');
	});

	it('the Mirror line', () => {
		const sketch = stemSketch();
		sketch.mirror = { x: 1400 };
		const hit = snapPoint({ x: 1404, y: 700 }, ctx({ sketch }));
		expect(hit.on).toBe('mirror');
		expect(hit.x).toBe(1400);
		expect(tagText(hit.tag)).toBe('mirror line');
	});
});

describe('Ctrl and Shift', () => {
	it('Ctrl turns every snap off for that click', () => {
		const hit = snapPoint({ x: 205.4, y: 1047.6 }, ctx({ ctrl: true }));
		expect(hit.snapped).toBe(false);
		expect(hit.join).toBe(null);
		expect(hit.on).toBe(null);
		expect([hit.x, hit.y]).toEqual([205, 1048]);
		expect(hit.hints).toEqual([]);
		expect(hit.tag).toBe(null);
		expect(snapPoint({ x: 1500, y: 2 }, ctx({ ctrl: true })).on).toBe(null);
	});

	it('Shift locks the next part level, plumb or 45 degrees from the last end', () => {
		const from = { x: 1200, y: 500 };
		const level = snapPoint({ x: 1500, y: 530 }, ctx({ shift: true, from }));
		expect([level.x, level.y]).toEqual([1500, 500]);
		const plumb = snapPoint({ x: 1220, y: 800 }, ctx({ shift: true, from }));
		expect(plumb.x).toBe(1200);
		const diagonal = snapPoint({ x: 1410, y: 690 }, ctx({ shift: true, from }));
		expect(diagonal.x - from.x).toBe(diagonal.y - from.y);
	});

	it('Shift plumb still lands on a writing line; Ctrl+Shift does not', () => {
		const from = { x: 1200, y: 500 };
		const hit = snapPoint({ x: 1210, y: lines.small + 2 }, ctx({ shift: true, from }));
		expect(hit.x).toBe(1200);
		expect(hit.on).toBe('small');
		expect(hit.y).toBe(lines.small - 50);
		const free = snapPoint({ x: 1210, y: lines.small + 2 }, ctx({ shift: true, ctrl: true, from }));
		expect(free.x).toBe(1200);
		expect(free.on).toBe(null);
	});
});

describe('a sketch with nothing in it, or none at all', () => {
	it('still snaps to the writing lines', () => {
		expect(snapPoint({ x: 10, y: 3 }, { font, view, thickness: 100, use: 'center' }).on).toBe(
			'writing'
		);
		expect(snapPoint({ x: 10, y: 3 }, { sketch: null, font, view, thickness: 100 }).y).toBe(50);
	});

	it('a free click comes back whole and unsnapped', () => {
		const hit = snapPoint({ x: 1333.4, y: 777.7 }, ctx());
		expect(hit).toMatchObject({
			x: 1333,
			y: 778,
			snapped: false,
			on: null,
			join: null,
			onPiece: null,
		});
	});
});

describe('level / plumb locks of a drawn piece (extremes.js)', () => {
	it("an o's top and bottom lock level, its sides plumb; free points stay free", () => {
		const sketch = newSketch({ thickness: 100 });
		sketch.points = {
			a: { x: 500, y: 1050, kind: 'smooth', on: 'small', inset: 'edge' },
			b: { x: 150, y: 550, kind: 'smooth' },
			c: { x: 500, y: 50, kind: 'smooth', on: 'writing', inset: 'edge' },
			d: { x: 850, y: 550, kind: 'smooth' },
		};
		const piece = {
			id: 1,
			key: 'o',
			use: 'center',
			closed: true,
			parts: [{ type: 'spline', points: ['a', 'b', 'c', 'd'] }],
		};
		sketch.pieces = [piece];
		const out = settleLocks(sketch, piece);
		expect(out).not.toBe(sketch);
		expect(out.points.a.lock).toBe('level');
		expect(out.points.c.lock).toBe('level');
		expect(out.points.b.lock).toBe('plumb');
		expect(out.points.d.lock).toBe('plumb');
		expect(sketch.points.a.lock).toBeUndefined();
	});

	it('an end or a corner gets no lock, and a stale lock is cleared', () => {
		const sketch = stemSketch();
		sketch.points.p2.lock = 'level';
		const out = settleLocks(sketch, sketch.pieces[0]);
		expect(out.points.p2.lock ?? null).toBe(null);
	});

	it("a point shared with another piece keeps that piece's lock", () => {
		const sketch = stemSketch();
		sketch.points.p2 = { ...sketch.points.p2, kind: 'smooth', lock: 'level' };
		sketch.pieces.push({
			id: 3,
			key: 'x',
			use: 'center',
			closed: false,
			parts: [{ type: 'line', from: 'p2', to: 'p3' }],
		});
		const out = settleLocks(sketch, sketch.pieces[2]);
		expect(out.points.p2.lock).toBe('level');
	});
});

describe('hints as data for the draw layer', () => {
	it('level / plumb dotted lines, the snap ring and its words', () => {
		const hit = snapPoint({ x: 897, y: 4 }, ctx());
		const out = forDrawLayer(hit, { font });
		expect(out.snap).toEqual({ x: 900, y: 50, text: 'writing line' });
		expect(out.hints).toContainEqual({
			kind: 'plumb',
			from: { x: 900, y: 600 },
			to: { x: 900, y: 50 },
		});
	});

	it('a half-way line across the letter, the middle top to tail, and the tangent line', () => {
		const half = snapPoint({ x: 300, y: 552 }, ctx({ halfway: true }));
		const out = forDrawLayer(half, { font, span: { left: 0, right: 1000 } });
		expect(out.hints).toContainEqual({
			kind: 'halfway',
			from: { x: 0, y: 550 },
			to: { x: 1000, y: 550 },
		});
		const middle = snapPoint({ x: 497, y: 1250 }, ctx({ inkMiddle: 500 }));
		expect(forDrawLayer(middle, { font }).hints).toContainEqual({
			kind: 'middle',
			from: { x: 500, y: lines.tail },
			to: { x: 500, y: lines.top },
		});
		const tangent = forDrawLayer(null, {
			tangent: { type: 'tangent', from: { x: 10, y: 20 }, dir: 90 },
		});
		expect(tangent.snap).toBe(null);
		expect(tangent.hints).toHaveLength(1);
		expect(tangent.hints[0].kind).toBe('tangent');
		expect(tangent.hints[0].to.x).toBeCloseTo(10, 9);
		expect(tangent.hints[0].to.y).toBeCloseTo(20 + TANGENT_REACH, 9);
	});

	it('Ctrl: no hints, no words', () => {
		const out = forDrawLayer(snapPoint({ x: 897, y: 4 }, ctx({ ctrl: true })), { font });
		expect(out).toEqual({ snap: { x: 897, y: 4, text: '' }, hints: [] });
	});
});

describe('S2 integration: a piece of several parts is named by the part under the pointer', () => {
	/** A's two legs as one piece, and n's stem and arch as one */
	function legsSketch() {
		const sketch = newSketch({ thickness: 100 });
		sketch.points = {
			a1: { x: 100, y: 50, kind: 'corner' },
			a2: { x: 500, y: 1400, kind: 'corner' },
			a3: { x: 900, y: 50, kind: 'corner' },
			n1: { x: 1200, y: 50, kind: 'corner' },
			n2: { x: 1200, y: 1050, kind: 'corner' },
			n3: { x: 1700, y: 800, kind: 'smooth' },
		};
		sketch.pieces = [
			{ id: 1, key: 'pc_a', use: 'center', closed: false, parts: [{ type: 'line', from: 'a1', to: 'a2' }, { type: 'line', from: 'a2', to: 'a3' }] },
			{ id: 2, key: 'pc_n', use: 'center', closed: false, parts: [{ type: 'line', from: 'n1', to: 'n2' }, { type: 'arc', from: 'n2', to: 'n3', bulge: 0.6 }] },
		];
		return sketch;
	}

	it("on A's leg: \"on the stem\", not \"on the curve\"", () => {
		const hit = snapPoint({ x: 300 + 3, y: 725 }, ctx({ sketch: legsSketch() }));
		expect(hit.onPiece?.piece).toBe(1);
		expect(tagText(hit.tag)).toBe('on the stem');
	});

	it("on n's stem, the stem; on its arch, the curve", () => {
		const stem = snapPoint({ x: 1203, y: 400 }, ctx({ sketch: legsSketch() }));
		expect(stem.onPiece?.piece).toBe(2);
		expect(tagText(stem.tag)).toBe('on the stem');
		const sketch = legsSketch();
		const arch = pieceSkeleton(sketch.pieces[1], sketch).at(-1);
		const mid = (i) => (arch[0][i] + 3 * arch[1][i] + 3 * arch[2][i] + arch[3][i]) / 8;
		const top = snapPoint({ x: mid(0) + 2, y: mid(1) }, ctx({ sketch }));
		expect(top.onPiece?.piece).toBe(2);
		expect(tagText(top.tag)).toBe('on the curve');
	});
});
