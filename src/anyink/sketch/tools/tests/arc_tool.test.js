// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 Arc tool (A; docs/SKETCH.md sections 2 and 8): fresh, click start, click end, then move to
	set the bulge and click; from an open end left along the curve, one click sets the end and the
	arc leaves tangent; left at an angle, it starts at a corner and takes end and bulge clicks.
	Arcs are stored as ends plus bulge. A piece passed from the Line tool goes on as one piece and
	one step; take-back during the bulge click; closing on the first point; an arc that starts on
	another piece's open end leaves along it. Written before arc_tool.js existed (all failed).
*/
import { describe, expect, it } from 'vitest';
import { arcDirs, bulgeFromMiddle } from '../../arc.js';
import { addPiece, addPoint, newSketch, validateSketch } from '../../model.js';
import { makeArcTool } from '../arc_tool.js';
import { leaveDirection } from '../chain.js';
import { makeLineTool } from '../line.js';
import { THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function onlyPiece(ctx) {
	expect(ctx.commits).toHaveLength(1);
	const { sketch, piece } = ctx.commits[0];
	expect(validateSketch(sketch).problems).toEqual([]);
	return { sketch, piece, pts: sketch.points };
}

const xy = (pt) => [pt.x, pt.y];

/** A Line stem (300, 300) to (300, 700), handed to a fresh Arc tool */
function stemThenArc() {
	const ctx = makeCtx();
	const line = makeLineTool(ctx);
	const p = pointer(line);
	p.click(300, 300);
	p.click(300, 700);
	line.toolOff({ to: 'sketchArc' });
	const arc = makeArcTool(ctx);
	arc.toolOn({ from: 'sketchLine' });
	return { ctx, arc, p: pointer(arc) };
}

describe('Arc: fresh', () => {
	it('click start, click end, then move to set the bulge and click', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		expect(tool.view().pending).toBe(true);
		p.move(500, 500);
		const live = tool.drawState();
		expect(live.preview.cubics.length).toBeGreaterThan(1);
		p.click(500, 500);
		expect(tool.view().pending).toBe(false);
		expect(p.key('enter')).toBe(true);
		const { piece, pts } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.arc');
		expect(piece.parts).toHaveLength(1);
		const part = piece.parts[0];
		expect(part.type).toBe('arc');
		expect(part.tangent).toBeUndefined();
		expect(part.bulge).toBeCloseTo(bulgeFromMiddle([300, 300], [700, 300], [500, 500]), 9);
		expect(Math.abs(part.bulge)).toBeCloseTo(1, 9);
		expect(xy(pts[part.from])).toEqual([300, 300]);
		expect(xy(pts[part.to])).toEqual([700, 300]);
	});

	it('the bulge follows the pointer to either side', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.click(500, 200);
		p.key('enter');
		const { piece } = onlyPiece(ctx);
		expect(piece.parts[0].bulge).toBeCloseTo(bulgeFromMiddle([300, 300], [700, 300], [500, 200]), 9);
		expect(Math.abs(piece.parts[0].bulge)).toBeCloseTo(0.5, 9);
	});

	it('the open end goes on: over the end and out along the curve, one click sets the next arc', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.click(500, 500);
		const dir = leaveDirection(tool.piece, tool.sketch);
		const a = (dir * Math.PI) / 180;
		// fix track tools: the 3-point Arc is done at its bend click; going on from it is a move
		// over its end and out again
		p.move(700, 300);
		p.move(700 + 60 * Math.cos(a), 300 + 60 * Math.sin(a));
		expect(tool.view().leave).toBe('tangent');
		p.click(1100, 300);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['arc', 'arc']);
		expect(piece.parts[1].tangent).toBe(true);
		expect(pts[piece.parts[1].from].kind).toBe('smooth');
		const second = arcDirs(xy(pts[piece.parts[1].from]), xy(pts[piece.parts[1].to]), piece.parts[1].bulge);
		expect(apart(second.start, dir)).toBeLessThan(0.01);
	});

	it('clicking the first point closes the loop', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.click(500, 500);
		const dir = leaveDirection(tool.piece, tool.sketch);
		const a = (dir * Math.PI) / 180;
		p.move(700 + 60 * Math.cos(a), 300 + 60 * Math.sin(a));
		p.move(305, 302);
		expect(tool.view().overFirst).toBe(true);
		p.click(305, 302);
		const { piece } = onlyPiece(ctx);
		expect(piece.closed).toBe(true);
		expect(piece.parts).toHaveLength(2);
		expect(piece.parts[1].to).toBe(piece.parts[0].from);
	});
});

describe('Arc: from an open end', () => {
	it('left along the curve: one click sets the end and the arc leaves tangent', () => {
		const { ctx, arc, p } = stemThenArc();
		p.move(300, 760);
		expect(arc.view().leave).toBe('tangent');
		p.click(500, 700);
		expect(arc.view().pending).toBe(false);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.line');
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc']);
		expect(piece.parts[1].tangent).toBe(true);
		expect(pts[piece.parts[1].from].kind).toBe('smooth');
		const dirs = arcDirs(xy(pts[piece.parts[1].from]), xy(pts[piece.parts[1].to]), piece.parts[1].bulge);
		expect(apart(dirs.start, 90)).toBeLessThan(0.01);
	});

	it('left at an angle: a corner, then end and bulge clicks', () => {
		const { ctx, arc, p } = stemThenArc();
		p.move(360, 700);
		expect(arc.view().leave).toBe('corner');
		p.click(600, 700);
		expect(arc.view().pending).toBe(true);
		p.click(450, 820);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc']);
		expect(piece.parts[1].tangent).toBeUndefined();
		expect(pts[piece.parts[1].from].kind).toBe('corner');
		expect(piece.parts[1].bulge).toBeCloseTo(bulgeFromMiddle([300, 700], [600, 700], [450, 820]), 9);
	});

	it('an arc started on the open end of another piece leaves along that piece', () => {
		const sketch = newSketch({ thickness: THICKNESS });
		const a = addPoint(sketch, { x: 300, y: 300, kind: 'corner' });
		const b = addPoint(sketch, { x: 300, y: 700, kind: 'corner' });
		addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: a, to: b }] });
		const ctx = makeCtx({ sketch });
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(302, 698);
		p.move(300, 760);
		expect(tool.view().leave).toBe('tangent');
		p.click(500, 700);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts[0].from).toBe(b);
		const dirs = arcDirs(xy(pts[piece.parts[0].from]), xy(pts[piece.parts[0].to]), piece.parts[0].bulge);
		expect(apart(dirs.start, 90)).toBeLessThan(0.01);
	});
});

describe('Arc: take back and finishing', () => {
	it('takes back the end click before the bulge, then the clicks before it', () => {
		const { ctx, arc, p } = stemThenArc();
		p.move(360, 700);
		p.click(600, 700);
		expect(arc.pointCount()).toBe(2);
		expect(arc.view().pending).toBe(true);
		expect(arc.takeBack()).toBe('taken');
		expect(arc.view().pending).toBe(false);
		expect(arc.view().points).toHaveLength(2);
		expect(arc.takeBack()).toBe('taken');
		expect(arc.view().points).toHaveLength(1);
		expect(arc.takeBack()).toBe('cancelled');
		expect(ctx.commits).toHaveLength(0);
	});

	it('finishing while the bend is not set keeps the end: no bend moved, a straight line', () => {
		// fix track tools: the end click was dropped without a word; now it is kept
		const { ctx, arc, p } = stemThenArc();
		p.move(360, 700);
		p.click(600, 700);
		expect(p.key('escape')).toBe(true);
		const { piece, sketch } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'line']);
		expect(Object.keys(sketch.points)).toHaveLength(3);
		expect(arc.isOpen()).toBe(false);
	});

	it('a double-click finishes; the last click is not doubled', () => {
		const { ctx, p } = stemThenArc();
		p.move(300, 760);
		p.doubleClick(500, 700);
		const { piece, sketch } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc']);
		expect(Object.keys(sketch.points)).toHaveLength(3);
	});

	it('Esc with nothing open is left to the tool column (back to Select)', () => {
		const tool = makeArcTool(makeCtx());
		expect(pointer(tool).key('escape')).toBe(false);
	});
});
