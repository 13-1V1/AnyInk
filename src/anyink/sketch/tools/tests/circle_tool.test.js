// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 Circle tool (C, O, Q; docs/SKETCH.md sections 2, 6 and 8): click the center and drag the
	size (a live circle: the piece keeps { cx, cy, rx, ry }); click, move, click works too; Shift
	makes an oval; a circle smaller than the snap radius is a 1-point piece (a dot on a
	Centerline, nothing on an Outline); click on one writing line, then on another: a circle whose
	ink edges touch both lines (the edge rule and the overshoot); the center snaps to the half-way
	lines. Four smooth points, tops and bottoms locked level, sides plumb; one step. Run before
	circle_tool.js existed: every test failed.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { pieceSkeleton } from '../../curves.js';
import { validateSketch } from '../../model.js';
import { makeCircleTool } from '../circle_tool.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const lines = guideLines(FONT);
const r = THICKNESS / 2;

function onlyPiece(ctx) {
	expect(ctx.commits).toHaveLength(1);
	const { sketch, piece } = ctx.commits[0];
	expect(validateSketch(sketch).problems).toEqual([]);
	return { sketch, piece, pts: sketch.points };
}

/** The circle's four points: right, top, left, bottom */
function ring(piece, pts) {
	return piece.parts[0].points.map((id) => pts[id]);
}

describe('Circle: center and size', () => {
	it('click the center and drag the size: a live circle, one step', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.drag([500, 500], [700, 500]);
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.circle');
		expect(piece).toMatchObject({ closed: true, use: 'center', circle: { cx: 500, cy: 500, rx: 200, ry: 200 } });
		expect(piece.parts).toHaveLength(1);
		const [right, top, left, bottom] = ring(piece, pts);
		expect([right.x, right.y, top.x, top.y, left.x, left.y, bottom.x, bottom.y]).toEqual([
			700, 500, 500, 700, 300, 500, 500, 300,
		]);
		expect([right.lock, top.lock, left.lock, bottom.lock]).toEqual(['plumb', 'level', 'plumb', 'level']);
		expect([right, top, left, bottom].every((pt) => pt.kind === 'smooth')).toBe(true);
		const cubics = pieceSkeleton(piece, sketch);
		expect(cubics).toHaveLength(4);
		const mid = cubics[0];
		const t = 0.5;
		const x = (1 - t) ** 3 * mid[0][0] + 3 * (1 - t) ** 2 * t * mid[1][0] + 3 * (1 - t) * t * t * mid[2][0] + t ** 3 * mid[3][0];
		const y = (1 - t) ** 3 * mid[0][1] + 3 * (1 - t) ** 2 * t * mid[1][1] + 3 * (1 - t) * t * t * mid[2][1] + t ** 3 * mid[3][1];
		expect(Math.abs(Math.hypot(x - 500, y - 500) - 200)).toBeLessThan(0.1);
		expect(tool.isOpen()).toBe(false);
	});

	it('shows the live circle while dragging', () => {
		const tool = makeCircleTool(makeCtx());
		const p = pointer(tool);
		p.move(500, 500);
		p.down(500, 500, { buttons: 1 });
		p.move(650, 500, { buttons: 1 });
		const state = tool.drawState();
		expect(state.open.cubics).toHaveLength(4);
		expect(state.open.cubics[0][0]).toEqual([650, 500]);
	});

	it('click, move, click works too', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 500);
		expect(tool.isOpen()).toBe(true);
		p.move(650, 500);
		p.click(650, 500);
		const { piece } = onlyPiece(ctx);
		expect(piece.circle).toEqual({ cx: 500, cy: 500, rx: 150, ry: 150 });
	});

	it('Shift makes an oval', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		pointer(tool).drag([500, 500], [700, 650], { shift: true });
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.circle).toEqual({ cx: 500, cy: 500, rx: 200, ry: 150 });
		const [right, top] = ring(piece, pts);
		expect([right.x, top.y]).toEqual([700, 650]);
	});

	it('smaller than the snap radius: a dot on a Centerline, nothing on an Outline', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 500);
		p.click(510, 500);
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts).toEqual([{ type: 'spline', points: [expect.any(String)] }]);
		expect(piece.circle).toBeUndefined();
		const dot = pts[piece.parts[0].points[0]];
		expect([dot.x, dot.y]).toEqual([500, 500]);

		const outline = makeCtx({ use: 'outline' });
		const tool2 = makeCircleTool(outline);
		const p2 = pointer(tool2);
		p2.click(500, 500);
		p2.click(510, 500);
		expect(outline.commits).toHaveLength(0);
		expect(tool2.isOpen()).toBe(false);
	});
});

describe('Circle: snaps', () => {
	it('between two writing lines: the ink edges touch both, plus the overshoot', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 3);
		p.click(520, 1097);
		const { piece, pts } = onlyPiece(ctx);
		const [, top, , bottom] = ring(piece, pts);
		expect(top).toMatchObject({ on: 'small', inset: 'edge', lock: 'level', x: 500 });
		expect(bottom).toMatchObject({ on: 'writing', inset: 'edge', lock: 'level', x: 500 });
		expect(Math.abs(top.y + r - (lines.small + lines.overshoot))).toBeLessThanOrEqual(0.5);
		expect(Math.abs(bottom.y - r - (lines.writing - lines.overshoot))).toBeLessThanOrEqual(0.5);
		expect(piece.circle.cx).toBe(500);
		expect(piece.circle.cy).toBeCloseTo((top.y + bottom.y) / 2, 9);
		expect(piece.circle.rx).toBeCloseTo((top.y - bottom.y) / 2, 9);
	});

	it('between two lines on an Outline: the points are on the lines themselves, plus the overshoot', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 1097);
		p.click(480, 4);
		const { piece, pts } = onlyPiece(ctx);
		const [, top, , bottom] = ring(piece, pts);
		expect(top.y).toBe(Math.round(lines.small + lines.overshoot));
		expect(bottom.y).toBe(Math.round(lines.writing - lines.overshoot));
		expect(top.inset).toBeUndefined();
	});

	it('the center snaps to the half-way line', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.move(500, (lines.writing + lines.small) / 2 + 6);
		expect(tool.drawState().snap.text).toBe('half-way line');
		p.drag([500, (lines.writing + lines.small) / 2 + 6], [700, (lines.writing + lines.small) / 2 + 6]);
		const { piece } = onlyPiece(ctx);
		expect(piece.circle.cy).toBe((lines.writing + lines.small) / 2);
	});
});

describe('Circle: take back and keys', () => {
	it('an Undo after the center click takes the center back', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 500);
		expect(tool.pointCount()).toBe(1);
		expect(tool.takeBack()).toBe('cancelled');
		expect(tool.isOpen()).toBe(false);
		p.click(600, 600);
		p.click(700, 600);
		expect(onlyPiece(ctx).piece.circle).toEqual({ cx: 600, cy: 600, rx: 100, ry: 100 });
	});

	it('Esc lets go of a half-made circle; with nothing open it is left to the tool column', () => {
		const ctx = makeCtx();
		const tool = makeCircleTool(ctx);
		const p = pointer(tool);
		p.click(500, 500);
		expect(p.key('escape')).toBe(true);
		expect(tool.isOpen()).toBe(false);
		expect(ctx.commits).toHaveLength(0);
		expect(p.key('escape')).toBe(false);
	});
});
