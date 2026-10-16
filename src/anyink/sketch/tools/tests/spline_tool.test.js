// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 Spline tool (S; docs/SKETCH.md sections 2, 6 and 9): click points and a Hobby curve runs
	through them; double-click or Enter finishes; click-and-drag on a point aims its direction; a
	2-point Spline is a Line; clicking the first point makes a loop through the points; a point
	snapped to a level line where the curve touches it locks level and its ink edge sits on the
	line (plus the overshoot); after a Line, the Spline leaves tangent or from a corner by the
	angle rule. Run before spline_tool.js existed: every test failed.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { endDirection, pieceSkeleton, startDirection } from '../../curves.js';
import { inkLines } from '../../edge_rule.js';
import { validateSketch } from '../../model.js';
import { makeLineTool } from '../line.js';
import { makeSplineTool } from '../spline_tool.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function onlyPiece(ctx) {
	expect(ctx.commits).toHaveLength(1);
	const { sketch, piece } = ctx.commits[0];
	expect(validateSketch(sketch).problems).toEqual([]);
	return { sketch, piece, pts: sketch.points };
}

describe('Spline: click points', () => {
	it('a smooth curve through every point, one step on Enter', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		const clicks = [
			[200, 300],
			[400, 600],
			[700, 650],
			[900, 400],
		];
		clicks.forEach(([x, y]) => p.click(x, y));
		expect(ctx.commits).toHaveLength(0);
		expect(p.key('enter')).toBe(true);
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.spline');
		expect(piece.parts).toHaveLength(1);
		expect(piece.parts[0].type).toBe('spline');
		const ids = piece.parts[0].points;
		expect(ids.map((id) => [pts[id].x, pts[id].y])).toEqual(clicks);
		expect(pts[ids[1]].kind).toBe('smooth');
		expect(pts[ids[2]].kind).toBe('smooth');
		const cubics = pieceSkeleton(piece, sketch);
		expect(cubics).toHaveLength(3);
		cubics.forEach((cubic, i) => {
			expect(cubic[0]).toEqual(clicks[i]);
			expect(cubic[3]).toEqual(clicks[i + 1]);
		});
		for (let i = 0; i < cubics.length - 1; i++) {
			expect(apart(endDirection(cubics[i]), startDirection(cubics[i + 1]))).toBeLessThan(0.01);
		}
	});

	it('a double-click finishes and the last click is not doubled', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(200, 300);
		p.click(400, 600);
		p.doubleClick(700, 400);
		const { piece } = onlyPiece(ctx);
		expect(piece.parts[0].points).toHaveLength(3);
	});

	it('a 2-point Spline is stored as a Line', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(200, 300);
		p.click(400, 600);
		p.key('enter');
		const { piece } = onlyPiece(ctx);
		expect(piece.parts).toEqual([{ type: 'line', from: expect.any(String), to: expect.any(String) }]);
	});

	it('click-and-drag on a point aims its direction', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(200, 300);
		p.drag([500, 600], [700, 600]);
		p.click(800, 300);
		p.key('enter');
		const { piece, pts, sketch } = onlyPiece(ctx);
		const mid = pts[piece.parts[0].points[1]];
		expect([mid.x, mid.y]).toEqual([500, 600]);
		expect(mid.kind).toBe('smooth');
		expect(mid.aim).toEqual({ dir: 0, tin: 1, tout: 1 });
		const cubics = pieceSkeleton(piece, sketch);
		expect(apart(startDirection(cubics[1]), 0)).toBeLessThan(0.01);
	});

	it('clicking the first point makes a loop through the points', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(500, 300);
		p.click(800, 600);
		p.click(500, 900);
		p.move(204, 602);
		p.click(200, 600);
		p.move(497, 303);
		expect(tool.view().overFirst).toBe(true);
		p.click(497, 303);
		const { piece } = onlyPiece(ctx);
		expect(piece.closed).toBe(true);
		expect(piece.parts).toHaveLength(1);
		expect(piece.parts[0].points).toHaveLength(4);
	});

	it('two points cannot close a loop: the click on the first point is ignored', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(500, 300);
		p.click(800, 600);
		p.move(502, 302);
		expect(tool.view().overFirst).toBe(false);
	});
});

describe('Spline: snaps and locks', () => {
	it('an arch top snapped to the small-letter line locks level; its ink edge is on the line plus the overshoot', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(200, 600);
		p.click(450, 1095);
		p.click(700, 600);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		const top = pts[piece.parts[0].points[1]];
		expect(top).toMatchObject({ on: 'small', inset: 'edge', lock: 'level', kind: 'smooth' });
		const lines = guideLines(FONT);
		expect(top.y).toBe(Math.round(inkLines(FONT, THICKNESS).small + lines.overshoot));
		expect(Math.abs(top.y + THICKNESS / 2 - (lines.small + lines.overshoot))).toBeLessThanOrEqual(0.5);
	});
});

describe('Spline: after a Line', () => {
	function stemThenSpline() {
		const ctx = makeCtx();
		const line = makeLineTool(ctx);
		const p = pointer(line);
		p.click(300, 300);
		p.click(300, 700);
		line.toolOff({ to: 'sketchSpline' });
		const spline = makeSplineTool(ctx);
		spline.toolOn({ from: 'sketchLine' });
		return { ctx, spline, p: pointer(spline) };
	}

	it('leaving along the line: the join is smooth and the spline starts in its direction', () => {
		const { ctx, spline, p } = stemThenSpline();
		p.move(300, 760);
		expect(spline.view().leave).toBe('tangent');
		p.click(420, 900);
		p.click(600, 800);
		p.key('enter');
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.line');
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'spline']);
		expect(pts[piece.parts[1].points[0]].kind).toBe('smooth');
		const cubics = pieceSkeleton(piece, sketch);
		expect(apart(startDirection(cubics[1]), 90)).toBeLessThan(0.01);
	});

	it('leaving at an angle: a corner', () => {
		const { ctx, spline, p } = stemThenSpline();
		p.move(360, 700);
		expect(spline.view().leave).toBe('corner');
		p.click(500, 750);
		p.click(700, 700);
		p.key('enter');
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(pts[piece.parts[1].points[0]].kind).toBe('corner');
		const cubics = pieceSkeleton(piece, sketch);
		expect(apart(startDirection(cubics[1]), 90)).toBeGreaterThan(20);
	});

	it('takes back a spline point, then the line end', () => {
		const { ctx, spline, p } = stemThenSpline();
		p.move(300, 760);
		p.click(420, 900);
		p.click(600, 800);
		expect(spline.takeBack()).toBe('taken');
		expect(spline.view().points).toHaveLength(3);
		expect(spline.takeBack()).toBe('taken');
		expect(spline.view().points).toHaveLength(2);
		p.key('enter');
		const { piece } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['line']);
	});
});
