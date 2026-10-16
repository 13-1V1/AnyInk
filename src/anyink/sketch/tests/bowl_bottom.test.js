// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix pass (found in Chrome: capital B at 264 dipped 2.2 units under the writing line and rose
	2.1 over the capitals line). B as sketched there: a stem, then each bowl a Line, a give-way
	curve and a Line, the lower bowl's smooth point p6 pinned to the writing line. Its built
	centerline is right (its lowest point is p6, r over the line); the extra came from the refit of
	the swept outline (nib/refit.js), whose curves bulge past the outline they fit where a tight
	turn meets a straight edge. build_center.js keeps every refit curve inside its outline's box,
	so a pinned edge stays on its line at any thickness.
	Written to fail first: at 264 the ink went -2.25 .. 1482.13.
*/
import { describe, expect, it } from 'vitest';
import { buildSketch, clearBuildCache } from '../build.js';
import { centerContours, centerOutlines } from '../build_center.js';
import { cubicExtremes } from '../extremes.js';
import { HAIR } from '../keep_in_box.js';

/** The font the Chrome run used (a new font's lines) */
const FONT = Object.freeze({
	upm: 2048,
	ascent: 1550,
	descent: -440,
	capHeight: 1480,
	xHeight: 1100,
	overshoot: 30,
});

/** capital B as sketched in the Chrome run (stored at 99) */
function sketchedB(thickness, { p4y = 771, p6x = 434, p3x = 400 } = {}) {
	return {
		v: 1,
		build: 1,
		key: 'sk_bowl_b',
		way: 'center',
		thickness,
		ends: 'round',
		mirror: null,
		builtHash: null,
		points: {
			p1: { x: 139, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			p2: { x: 139, y: 1431, kind: 'corner', on: 'capitals', inset: 'edge' },
			p3: { x: p3x, y: 1431, kind: 'smooth', on: 'capitals', inset: 'edge' },
			p4: { x: p3x, y: p4y, kind: 'smooth' },
			p5: { x: 139, y: p4y, kind: 'corner' },
			p6: { x: p6x, y: 50, kind: 'smooth', on: 'writing', inset: 'edge' },
		},
		pieces: [
			{ id: 1, key: 'pc_1', use: 'center', closed: false, parts: [{ type: 'line', from: 'p1', to: 'p2' }] },
			{
				id: 2,
				key: 'pc_2',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'p2', to: 'p3' },
					{ type: 'curve', from: 'p3', to: 'p4' },
					{ type: 'line', from: 'p4', to: 'p5' },
				],
			},
			{
				id: 3,
				key: 'pc_3',
				use: 'center',
				closed: false,
				parts: [
					{ type: 'line', from: 'p5', to: 'p4' },
					{ type: 'curve', from: 'p4', to: 'p6' },
					{ type: 'line', from: 'p6', to: 'p1' },
				],
			},
		],
		relations: [
			{ type: 'plumb', a: 'p1', b: 'p2' },
			{ type: 'plumb', a: 'p3', b: 'p4' },
			{ type: 'onPiece', point: 'p5', piece: 1, t: (p4y - 50) / 1381 },
			{ type: 'level', a: 'p4', b: 'p5' },
		],
		setAside: false,
		at: 0,
	};
}

/** exact: every curve's ends and turning points */
const ys = (curves) => curves.flatMap((cubic) => cubicExtremes(cubic).map((e) => e.y));
const xs = (curves) => curves.flatMap((cubic) => cubicExtremes(cubic).map((e) => e.x));

describe("a bowl's give-way curve keeps its ink on its lines", () => {
	// the round nib's outline itself stands 0.6 past each line at every thickness and the refit
	// rounds its ends to whole units (at 99 the top is 1481.0 exactly): 1 unit plus a tenth
	for (const thickness of [60, 99, 160, 200, 264]) {
		it(`at ${thickness}: B's ink is between the writing and capitals lines (1 unit)`, () => {
			clearBuildCache();
			const { shapes } = buildSketch(sketchedB(thickness), { font: FONT });
			const all = shapes.flatMap((shape) => ys(shape.curves));
			expect(Math.min(...all)).toBeGreaterThanOrEqual(-1.1);
			expect(Math.max(...all)).toBeLessThanOrEqual(FONT.capHeight + 1.1);
		});
	}

	it('every refit curve stays inside the box of the outline it fits', () => {
		clearBuildCache();
		const { placed, width } = buildSketch(sketchedB(264), { font: FONT });
		placed.pieces.forEach((piece) => {
			const outlines = centerOutlines(piece, placed, { font: FONT, width });
			const contours = centerContours(piece, placed, { font: FONT, width });
			contours.forEach((contour, i) => {
				const ox = outlines[i].map((p) => p[0]);
				const oy = outlines[i].map((p) => p[1]);
				expect(Math.min(...ys(contour.curves))).toBeGreaterThanOrEqual(Math.min(...oy) - 0.75);
				expect(Math.max(...ys(contour.curves))).toBeLessThanOrEqual(Math.max(...oy) + 0.75);
				expect(Math.min(...xs(contour.curves))).toBeGreaterThanOrEqual(Math.min(...ox) - 0.75);
				expect(Math.max(...xs(contour.curves))).toBeLessThanOrEqual(Math.max(...ox) + 0.75);
			});
		});
	});

	// S3 finalize (build verifier): other B's of the same build went -1.25 under the writing line
	// at 264 and 1481.16 over the capitals line at 99. A curve may now pass the outline's box only
	// as far as its own whole-unit ends do plus HAIR (at least SLACK): 1 unit and a hair
	const VARIANTS = [
		{ p4y: 700, p6x: 520, p3x: 380 },
		{ p4y: 850, p6x: 600, p3x: 450 },
		{ p4y: 771, p6x: 300, p3x: 420 },
		{ p4y: 771, p6x: 434, p3x: 400 },
	];
	for (const variant of VARIANTS) {
		it(`B ${JSON.stringify(variant)}: within 1 unit of both lines from 40 to 264`, () => {
			for (const thickness of [40, 80, 99, 130, 180, 220, 264]) {
				clearBuildCache();
				const { shapes } = buildSketch(sketchedB(thickness, variant), { font: FONT });
				const all = shapes.flatMap((shape) => ys(shape.curves));
				expect(Math.min(...all)).toBeGreaterThanOrEqual(-(1 + HAIR));
				expect(Math.max(...all)).toBeLessThanOrEqual(FONT.capHeight + 1 + HAIR);
			}
		});
	}
});
