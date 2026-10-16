// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 Rectangle tool (R in Simple; docs/SKETCH.md section 2): click one corner, click the other
	(or drag): a closed loop of four Lines with corners, one step. Corners pinned to a writing
	line pass the line to the corners beside them (the edge rule on a Centerline); a corner on an
	existing point joins it; smaller than the snap radius makes nothing; Esc or an Undo lets go of
	the first corner. Run before rect_tool.js existed: every test failed.
*/
import { describe, expect, it } from 'vitest';
import { inkLines } from '../../edge_rule.js';
import { addPiece, addPoint, newSketch, validateSketch } from '../../model.js';
import { makeRectTool } from '../rect_tool.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

function onlyPiece(ctx) {
	expect(ctx.commits).toHaveLength(1);
	const { sketch, piece } = ctx.commits[0];
	expect(validateSketch(sketch).problems).toEqual([]);
	return { sketch, piece, pts: sketch.points };
}

/** The loop's corners in order */
function corners(piece, pts) {
	return piece.parts.map((part) => pts[part.from]);
}

describe('Rectangle', () => {
	it('click one corner, click the other: a closed loop of four Lines with corners', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeRectTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		expect(tool.isOpen()).toBe(true);
		p.move(700, 800);
		expect(tool.drawState().open.cubics).toHaveLength(4);
		p.click(700, 800);
		const { piece, pts } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.rectangle');
		expect(piece.closed).toBe(true);
		expect(piece.use).toBe('outline');
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'line', 'line', 'line']);
		expect(piece.parts[3].to).toBe(piece.parts[0].from);
		expect(corners(piece, pts).map((pt) => [pt.x, pt.y])).toEqual([
			[300, 300],
			[700, 300],
			[700, 800],
			[300, 800],
		]);
		expect(corners(piece, pts).every((pt) => pt.kind === 'corner')).toBe(true);
		expect(tool.isOpen()).toBe(false);
	});

	it('a drag works too', () => {
		const ctx = makeCtx();
		const tool = makeRectTool(ctx);
		pointer(tool).drag([300, 300], [700, 800]);
		const { piece, pts } = onlyPiece(ctx);
		expect(corners(piece, pts).map((pt) => [pt.x, pt.y])).toEqual([
			[300, 300],
			[700, 300],
			[700, 800],
			[300, 800],
		]);
	});

	it('a corner pinned to a writing line passes it to the corner beside it (edge rule on a Centerline)', () => {
		const ctx = makeCtx();
		const tool = makeRectTool(ctx);
		const p = pointer(tool);
		p.click(300, 3);
		p.click(700, 1097);
		const { piece, pts } = onlyPiece(ctx);
		const [a, b, c, d] = corners(piece, pts);
		const ink = inkLines(FONT, THICKNESS);
		expect(a).toMatchObject({ on: 'writing', inset: 'edge', y: Math.round(ink.writing) });
		expect(b).toMatchObject({ on: 'writing', inset: 'edge', y: Math.round(ink.writing), x: 700 });
		expect(c).toMatchObject({ on: 'small', inset: 'edge', y: Math.round(ink.small) });
		expect(d).toMatchObject({ on: 'small', inset: 'edge', y: Math.round(ink.small), x: 300 });
	});

	it('a corner on an existing point joins it', () => {
		const sketch = newSketch({ thickness: THICKNESS });
		const a = addPoint(sketch, { x: 300, y: 300, kind: 'corner' });
		const b = addPoint(sketch, { x: 300, y: 100, kind: 'corner' });
		addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: b, to: a }] });
		const ctx = makeCtx({ sketch });
		const tool = makeRectTool(ctx);
		const p = pointer(tool);
		p.click(303, 298);
		p.click(700, 800);
		const { piece, sketch: out } = onlyPiece(ctx);
		expect(piece.parts[0].from).toBe(a);
		expect(out.pieces).toHaveLength(2);
		expect(Object.keys(out.points)).toHaveLength(5);
	});

	it('smaller than the snap radius makes nothing', () => {
		const ctx = makeCtx();
		const tool = makeRectTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(310, 700);
		expect(ctx.commits).toHaveLength(0);
		expect(tool.isOpen()).toBe(false);
	});

	it('Esc or an Undo lets go of the first corner; Esc with nothing open is left to the tool column', () => {
		const ctx = makeCtx();
		const tool = makeRectTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		expect(tool.pointCount()).toBe(1);
		expect(p.key('escape')).toBe(true);
		expect(tool.isOpen()).toBe(false);
		expect(p.key('escape')).toBe(false);
		p.click(300, 300);
		expect(tool.takeBack()).toBe('cancelled');
		expect(tool.isOpen()).toBe(false);
		expect(ctx.commits).toHaveLength(0);
	});
});
