// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration (found by tests/sketch_build.verify.mjs): small n as drawn in Chrome, its arch an
	Arc from the stem's top to a smooth point where the leg (a Line) leaves along it. When the
	thickness changes, the stem top moves (edge rule) and the arch no longer meets the leg's
	direction, so curves.js builds it as a curve that gives way to the Line; its top is then not
	the arc's. build.js placeArcTops works the bend out on the built curve, so the ink's top stays
	on the small-letter line (plus the overshoot) within 1 unit at any thickness, and a rebuild is
	idempotent.
	Written to fail first: at 147 the ink top was 1.9 units over, at 60 under.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../placement/classes.js';
import { buildSketch, clearBuildCache, placeArcTops } from '../build.js';
import { placeEdgePoints } from '../edge_rule.js';
import { flattenCubics } from '../outline_order.js';

/** The font the Chrome run used (a new font's lines) */
const FONT = Object.freeze({
	upm: 2048,
	ascent: 1550,
	descent: -440,
	capHeight: 1480,
	xHeight: 1100,
	overshoot: 30,
});

/** small n as sketched in tests/sketch_build.verify.mjs (stored at 99) */
function drawnN(thickness) {
	return {
		v: 1,
		build: 1,
		key: 'sk_drawn_n',
		way: 'center',
		thickness,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points: {
			p1: { x: 183, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			p2: { x: 183, y: 1051, kind: 'corner', on: 'small', inset: 'edge' },
			p3: { x: 665, y: 840, kind: 'smooth' },
			p4: { x: 954, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
		},
		pieces: [
			{
				id: 1,
				key: 'pc_n',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'p1', to: 'p2' },
					{ type: 'arc', from: 'p2', to: 'p3', bulge: -0.4098901311878014, top: { on: 'small' } },
					{ type: 'line', from: 'p3', to: 'p4' },
				],
			},
		],
		relations: [{ type: 'plumb', a: 'p1', b: 'p2' }],
		setAside: false,
		at: 0,
	};
}

const inkTop = (shapes) =>
	Math.max(...shapes.flatMap((shape) => flattenCubics(shape.curves).map((p) => p[1])));

describe("an arch that gives way to its leg keeps its top on the line", () => {
	const lines = guideLines(FONT);
	for (const thickness of [60, 99, 147, 200]) {
		it(`at ${thickness}: the ink top is on the small-letter line plus the overshoot`, () => {
			clearBuildCache();
			const { shapes } = buildSketch(drawnN(thickness), { font: FONT });
			expect(Math.abs(inkTop(shapes) - (lines.small + lines.overshoot))).toBeLessThanOrEqual(1);
		});
	}

	it('placing again what was placed changes nothing (idempotent)', () => {
		const once = placeArcTops(placeEdgePoints(drawnN(147), FONT), FONT);
		const twice = placeArcTops(once, FONT);
		expect(twice).toBe(once);
	});
});
