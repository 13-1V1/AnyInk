// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 integration: an arc whose top was snapped to a writing line stores the line on its part
	(part.top = { on }), from the 3-point Arc's bend click and from a tangent end (the Line's
	pull-back arc). With the tag, build.js placeArcTops (3-point) and thickness.js
	slideTangentTops (tangent) put the top back where the edge rule says when the thickness
	changes. A bend with Ctrl (no snap) or one only shown stores nothing.
	Written to fail first: before chain.js appendPart took `top`, no part carried it.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { placeArcTops } from '../../build.js';
import { slideTangentTops } from '../../thickness.js';
import { arcExtreme, extremeTargets } from '../arc_snap.js';
import { makeArcTool } from '../arc_tool.js';
import { makeLineTool } from '../line.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';
import { edgeThickness } from '../../edge_rule.js';

const lines = guideLines(FONT);
const r = edgeThickness(FONT, THICKNESS) / 2;
const xy = (pt) => [pt.x, pt.y];
const topOf = (part, pts) => arcExtreme(xy(pts[part.from]), xy(pts[part.to]), part.bulge, 'top');
const targetY = (thickness) =>
	extremeTargets(FONT, thickness, 'center').find((entry) => entry.on === 'small').y;

describe('arc tops snapped to a line are tagged', () => {
	it('3-point Arc: the bend near the small-letter line tags the part; a thicker sketch keeps the top on its ink line', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		p.click(500, lines.small + 6);
		p.key('enter');
		const { sketch } = ctx.commits[0];
		const part = sketch.pieces[0].parts[0];
		expect(part.top).toEqual({ on: 'small' });
		for (const thickness of [60, 200]) {
			const placed = placeArcTops({ ...sketch, thickness }, FONT);
			const moved = placed.pieces[0].parts[0];
			expect(topOf(moved, placed.points).y).toBeCloseTo(targetY(thickness), 3);
		}
	});

	it('Ctrl (no snap): no tag', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		p.click(500, lines.small + 6, { ctrl: true });
		p.key('enter');
		expect(ctx.commits[0].sketch.pieces[0].parts[0].top).toBeUndefined();
	});

	it("the Line's pull-back arc snapped to the small-letter line is tagged; slideTangentTops re-places it", () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 100);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
		]);
		const R = lines.small - 700;
		p.click(300 + 2 * R + 8, 690);
		p.key('enter');
		const { sketch } = ctx.commits[0];
		const arc = sketch.pieces[0].parts[1];
		expect(arc).toMatchObject({ type: 'arc', tangent: true, top: { on: 'small' } });
		expect(Math.abs(topOf(arc, sketch.points).y - (lines.small - r + lines.overshoot))).toBeLessThan(1);
		const thick = slideTangentTops({ ...sketch, thickness: 200 }, FONT);
		const moved = thick.pieces[0].parts[1];
		expect(Math.abs(topOf(moved, thick.points).y - targetY(200))).toBeLessThan(1);
	});

	it('a plain Line part never gets a tag', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 100);
		p.click(300, 700);
		p.key('enter');
		expect(ctx.commits[0].sketch.pieces[0].parts[0].top).toBeUndefined();
	});
});
