// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 fix track chain-snap (snap.js), found in real Chrome by the critic:
	  1. a click on the line where the loop started lands on the first point and closes it (the
	     snapped place is checked against the sketch's points again), never a duplicate point;
	  2. "on the stem" and the level / plumb inference together: the point goes where the
	     inference crosses the piece and both relations are stored (A's bar level and on both
	     legs); under Shift's ray a piece the ray crosses still catches the point;
	  3. a writing line pulls only within the snap radius of the real line; the faint ink line is
	     where the dot lands, not a second target (S3 finalize: the band between the line and its
	     ink line pulls too, nothing past it).
	Written to fail first: every test here failed on snap.js before the fix.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { HIT_ZONE_PX } from '../../../metrics/hit_test.js';
import { newSketch, validateSketch } from '../../model.js';
import { makeLineTool } from '../line.js';
import { relationsFor, snapPoint, tagText } from '../snap.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const lines = guideLines(FONT);
const r = THICKNESS / 2;

/** A's two legs as one stored piece */
function legs() {
	const sketch = newSketch({ thickness: THICKNESS });
	sketch.points = {
		a1: { x: 100, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
		a2: { x: 500, y: 1400, kind: 'corner' },
		a3: { x: 900, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
	};
	sketch.pieces = [
		{
			id: 1,
			key: 'pc_legs',
			use: 'center',
			closed: false,
			parts: [
				{ type: 'line', from: 'a1', to: 'a2' },
				{ type: 'line', from: 'a2', to: 'a3' },
			],
		},
	];
	return sketch;
}

/** x on the left (a1 to a2) or right (a2 to a3) leg at height y */
const leftX = (y) => 100 + ((y - 50) / 1350) * 400;
const rightX = (y) => 500 + ((1400 - y) / 1350) * 400;

describe('1. clicking the line where the loop started closes it', () => {
	it('snapPoint: the line under the first point joins it and closes', () => {
		const sketch = newSketch({ thickness: THICKNESS });
		// the first dot sat r below the small-letter line (the edge rule)
		sketch.points = {
			p1: { x: 100, y: Math.round(lines.small - r), kind: 'corner', on: 'small', inset: 'edge' },
			p2: { x: 500, y: Math.round(lines.small - r), kind: 'corner', on: 'small', inset: 'edge' },
			p3: { x: 300, y: Math.round(r), kind: 'corner', on: 'writing', inset: 'edge' },
		};
		const hit = snapPoint(
			{ x: 100, y: lines.small },
			{ sketch, font: FONT, view: { dz: HIT_ZONE_PX / 20 }, thickness: THICKNESS, first: 'p1' }
		);
		expect(hit.join).toBe('p1');
		expect(hit.closes).toBe(true);
		expect(tagText(hit.tag)).toBe('joins');
	});

	it("Line: small v closed by clicking the small-letter line at the first click's spot", () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(100, lines.small);
		p.click(500, lines.small);
		p.click(300, lines.writing);
		p.click(100, lines.small);
		// the closing click finishes the piece; Enter after it changes nothing more
		p.key('enter');
		expect(ctx.commits).toHaveLength(1);
		const { sketch, piece } = ctx.commits[0];
		expect(validateSketch(sketch).problems).toEqual([]);
		expect(piece.closed).toBe(true);
		expect(piece.parts).toHaveLength(3);
		expect(piece.parts[2].to).toBe(piece.parts[0].from);
		expect(Object.keys(sketch.points)).toHaveLength(3);
	});
});

describe("2. on a piece and level / plumb with another point at once (A's bar)", () => {
	it('Line: the bar end is level with its start and on the right leg', () => {
		const ctx = makeCtx({ sketch: legs() });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		const y = 500;
		p.click(leftX(y) + 2, y);
		// 6 units above level, 3 units off the right leg
		p.click(rightX(y + 6) - 3, y + 6);
		p.key('enter');
		expect(ctx.commits).toHaveLength(1);
		const { sketch, piece } = ctx.commits.at(-1);
		expect(validateSketch(sketch).problems).toEqual([]);
		const bar = piece.parts.at(-1);
		const start = sketch.points[bar.from];
		const end = sketch.points[bar.to];
		expect(end.y).toBe(start.y);
		expect(Math.abs(end.x - rightX(end.y))).toBeLessThanOrEqual(1);
		const rel = sketch.relations;
		expect(rel).toContainEqual(expect.objectContaining({ type: 'onPiece', point: bar.from, piece: 1 }));
		expect(rel).toContainEqual(expect.objectContaining({ type: 'onPiece', point: bar.to, piece: 1 }));
		expect(rel).toContainEqual({ type: 'level', a: bar.from, b: bar.to });
	});

	it('snapPoint: the crossing, its share along the piece, and a dotted level line', () => {
		const sketch = legs();
		sketch.points.s = { x: Math.round(leftX(500)), y: 500, kind: 'corner' };
		const hit = snapPoint(
			{ x: rightX(506) - 3, y: 506 },
			{ sketch, font: FONT, view: { dz: HIT_ZONE_PX / 20 }, thickness: THICKNESS }
		);
		expect(hit.y).toBe(500);
		expect(hit.x).toBe(Math.round(rightX(500)));
		expect(hit.onPiece?.piece).toBe(1);
		// the right leg is the second half of the piece's length
		expect(hit.onPiece.t).toBeGreaterThan(0.5);
		expect(hit.pair).toEqual({ type: 'level', with: 's' });
		expect(tagText(hit.tag)).toBe('on the stem');
		expect(hit.hints).toContainEqual(expect.objectContaining({ type: 'level', pointId: 's' }));
		const relations = relationsFor(hit, 'e');
		expect(relations).toContainEqual(expect.objectContaining({ type: 'onPiece', point: 'e', piece: 1 }));
		expect(relations).toContainEqual({ type: 'level', a: 's', b: 'e' });
	});

	it("Shift's level ray still lands on the leg it crosses", () => {
		const ctx = makeCtx({ sketch: legs() });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		const y = 500;
		p.click(leftX(y) + 2, y);
		p.click(rightX(y) - 8, y + 9, { shift: true });
		p.key('enter');
		const { sketch, piece } = ctx.commits.at(-1);
		const bar = piece.parts.at(-1);
		const end = sketch.points[bar.to];
		expect(end.y).toBe(sketch.points[bar.from].y);
		expect(Math.abs(end.x - rightX(end.y))).toBeLessThanOrEqual(1);
		expect(sketch.relations).toContainEqual(
			expect.objectContaining({ type: 'onPiece', point: bar.to, piece: 1 })
		);
	});
});

describe('3. a writing line pulls only within the snap radius of the real line', () => {
	// the default zoom where it was found: 21.8%, the radius 6 px
	const view = { dz: 0.218 };
	const px = (n) => n / view.dz;
	const at = (n) =>
		snapPoint({ x: 1500, y: lines.writing + px(n) }, { font: FONT, view, thickness: 100, use: 'center' });

	// S3 finalize: between the line and its ink line (here 50 units, 10.9 px) a free center would
	// put the ink across the line, so that band pins too; past the ink line and below the line
	// only the radius counts (17 px above, 8 px below: free)
	it('2 to 10 px above the writing line snap (inside its ink); 17 px above and 8 px below do not', () => {
		for (const n of [2, 4, 6, 8, 10]) expect(at(n).on).toBe('writing');
		for (const n of [12, 17, -8]) expect(at(n).on).toBe(null);
	});

	it('the dot still lands on the faint ink line (r above the writing line)', () => {
		expect(at(3).y).toBe(50);
	});
});
