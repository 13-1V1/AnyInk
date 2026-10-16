// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 Line tool (docs/SKETCH.md sections 2, 6, 7): click-click chaining, click-drag single line,
	finishing (Enter, double-click, Esc, the first point), the second Esc, pull-back into a
	tangent arc, the length / angle readout on the 1 in capitals scale, Shift and Ctrl, joins,
	the open piece's take-back, degenerate pieces, the edge rule at finish and one commit per
	finished piece. Synthetic pointer events in font units (tests/fake_ctx.js).
*/
import { describe, expect, it } from 'vitest';
import { arcDirs, tangentBulge } from '../../arc.js';
import { endDirection, pieceSkeleton } from '../../curves.js';
import { inkLines } from '../../edge_rule.js';
import { addPiece, addPoint, newSketch, validateSketch } from '../../model.js';
import { makeArcTool } from '../arc_tool.js';
import { makeLineTool, lineReadout } from '../line.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const r = THICKNESS / 2;
const apart = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

function onlyPiece(ctx) {
	expect(ctx.commits).toHaveLength(1);
	const { sketch, piece } = ctx.commits[0];
	expect(validateSketch(sketch).problems).toEqual([]);
	return { sketch, piece, pts: sketch.points };
}

describe('Line: click, click', () => {
	it('chains straight parts with corners and finishes on Enter as one step', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(300, 900);
		p.click(600, 900);
		expect(tool.isOpen()).toBe(true);
		expect(ctx.commits).toHaveLength(0);
		expect(p.key('enter')).toBe(true);
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.line');
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'line']);
		expect(piece.closed).toBe(false);
		expect(piece.use).toBe('center');
		const ids = [piece.parts[0].from, piece.parts[0].to, piece.parts[1].to];
		expect(piece.parts[1].from).toBe(ids[1]);
		expect(ids.map((id) => [pts[id].x, pts[id].y])).toEqual([
			[300, 600],
			[300, 900],
			[600, 900],
		]);
		expect(ids.map((id) => pts[id].kind)).toEqual(['corner', 'corner', 'corner']);
		expect(sketch.thickness).toBe(THICKNESS);
		expect(tool.isOpen()).toBe(false);
	});

	it('never moves a clicked end that is not pinned to a line', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(123, 457);
		p.click(611, 803);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect([pts[piece.parts[0].from].x, pts[piece.parts[0].from].y]).toEqual([123, 457]);
		expect([pts[piece.parts[0].to].x, pts[piece.parts[0].to].y]).toEqual([611, 803]);
	});

	it('click-drag draws one line and ends', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		pointer(tool).drag([200, 300], [200, 800]);
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts).toHaveLength(1);
		expect(pts[piece.parts[0].to].y).toBe(800);
		expect(tool.isOpen()).toBe(false);
	});

	it('Esc finishes an open piece; a second Esc goes back to Select', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(500, 600);
		expect(p.key('escape')).toBe(true);
		expect(ctx.commits).toHaveLength(1);
		expect(p.key('escape')).toBe(false);
		expect(p.key('enter')).toBe(false);
		expect(ctx.commits).toHaveLength(1);
	});

	it('a double-click finishes and the last click is not doubled', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(300, 800);
		p.doubleClick(500, 800);
		const { piece } = onlyPiece(ctx);
		expect(piece.parts).toHaveLength(2);
		expect(Object.keys(ctx.commits[0].sketch.points)).toHaveLength(3);
	});

	it('clicking the first point closes the loop and finishes', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		p.move(500, 800);
		expect(tool.view().overFirst).toBe(false);
		p.click(500, 900);
		p.move(305, 603);
		expect(tool.view().overFirst).toBe(true);
		p.click(305, 603);
		const { piece } = onlyPiece(ctx);
		expect(piece.closed).toBe(true);
		expect(piece.use).toBe('outline');
		expect(piece.parts).toHaveLength(3);
		expect(piece.parts[2].to).toBe(piece.parts[0].from);
	});
});

describe('Line: snaps and the edge rule', () => {
	it('a Centerline point snapped to the writing line is an edge point: its center r above the line', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 8);
		p.click(300, 1090);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		const foot = pts[piece.parts[0].from];
		const top = pts[piece.parts[0].to];
		expect(foot).toMatchObject({ on: 'writing', inset: 'edge', x: 300 });
		expect(top).toMatchObject({ on: 'small', inset: 'edge', x: 300 });
		const ink = inkLines(FONT, THICKNESS);
		expect(foot.y).toBe(Math.round(ink.writing));
		expect(top.y).toBe(Math.round(ink.small));
		expect(Math.abs(foot.y - r)).toBeLessThanOrEqual(0.5);
	});

	it('an Outline point snapped to a line sits on the line itself', () => {
		const ctx = makeCtx({ use: 'outline' });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 8);
		p.click(300, 1090);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(pts[piece.parts[0].from]).toMatchObject({ on: 'writing', y: 0 });
		expect(pts[piece.parts[0].from].inset).toBeUndefined();
		expect(pts[piece.parts[0].to]).toMatchObject({ on: 'small', y: 1100 });
	});

	it('shows where the press will land and its tag; Ctrl turns snapping off for that click', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.move(300, 5);
		const state = tool.drawState();
		expect(state.snap).toMatchObject({ x: 300, y: 50, text: 'writing line' });
		expect(state.points[0]).toMatchObject({ x: 300, y: 50, stuck: true });
		p.click(300, 5, { ctrl: true });
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(pts[piece.parts[0].to]).toMatchObject({ y: 5 });
		expect(pts[piece.parts[0].to].on).toBeUndefined();
	});

	it('Shift locks the next part to level, plumb or 45 degrees from the open end', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(712, 641, { shift: true });
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(pts[piece.parts[0].to].y).toBe(600);
	});

	it('clicking an existing point joins it (shared id); the stored pieces are kept', () => {
		const sketch = newSketch({ thickness: THICKNESS, key: 'sk_t' });
		const a = addPoint(sketch, { x: 300, y: 50, kind: 'corner' });
		const b = addPoint(sketch, { x: 300, y: 1050, kind: 'corner' });
		addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: a, to: b }] });
		const ctx = makeCtx({ sketch });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(304, 1046);
		p.click(700, 700);
		p.key('enter');
		const { sketch: out, piece } = onlyPiece(ctx);
		expect(out.pieces).toHaveLength(2);
		expect(out.key).toBe('sk_t');
		expect(piece.parts[0].from).toBe(b);
		expect(Object.keys(out.points)).toHaveLength(3);
	});

	it('keeps its own copy of a joined start point: gone by finish, it comes back', () => {
		const sketch = newSketch({ thickness: THICKNESS });
		const a = addPoint(sketch, { x: 300, y: 600, kind: 'corner' });
		const b = addPoint(sketch, { x: 300, y: 900, kind: 'corner' });
		addPiece(sketch, { use: 'center', parts: [{ type: 'line', from: a, to: b }] });
		const ctx = makeCtx({ sketch });
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 900);
		p.click(600, 900);
		ctx.stored = newSketch({ thickness: THICKNESS, key: ctx.stored.key });
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		const start = pts[piece.parts[0].from];
		expect([start.x, start.y]).toEqual([300, 900]);
	});
});

describe('Line: chaining (autotransition)', () => {
	it('pull back over the last end and away again: the next part is a tangent arc', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
		]);
		expect(tool.view().mode).toBe('arc');
		p.click(500, 700);
		expect(tool.view().mode).toBe('line');
		p.key('enter');
		const { piece, pts, sketch } = onlyPiece(ctx);
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc']);
		const arc = piece.parts[1];
		expect(arc.tangent).toBe(true);
		expect(pts[arc.from].kind).toBe('smooth');
		const p0 = [pts[arc.from].x, pts[arc.from].y];
		const p1 = [pts[arc.to].x, pts[arc.to].y];
		expect(arc.bulge).toBeCloseTo(tangentBulge(p0, p1, 90), 9);
		expect(arcDirs(p0, p1, arc.bulge).start).toBeCloseTo(90, 6);
		const cubics = pieceSkeleton(piece, sketch);
		expect(cubics.length).toBeGreaterThan(1);
	});

	it('pulling back twice goes back to a line', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
			[302, 701],
			[360, 700],
		]);
		expect(tool.view().mode).toBe('line');
	});

	it('the first point alone has nothing to pull back from', () => {
		const tool = makeLineTool(makeCtx());
		const p = pointer(tool);
		p.click(300, 300);
		p.path([
			[300, 360],
			[300, 302],
			[340, 360],
		]);
		expect(tool.view().mode).toBe('line');
	});

	it('judges how the pointer leaves the open end once it is 1.5x the snap radius away', () => {
		const tool = makeLineTool(makeCtx());
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.move(300, 725);
		expect(tool.view().leave).toBe('pending');
		p.move(300, 900);
		expect(tool.view().leave).toBe('tangent');
		expect(tool.view().tangent).toMatchObject({ x: 300, y: 700 });
		expect(tool.view().tangent.dir).toBeCloseTo(90, 6);
		const hint = tool.drawState().hints.find((h) => h.kind === 'tangent');
		expect(hint.from).toEqual({ x: 300, y: 700 });
		expect(hint.to.x).toBeCloseTo(300, 6);
		expect(hint.to.y).toBeGreaterThan(700);
		// decided once: swinging round keeps it
		p.move(600, 700);
		expect(tool.view().leave).toBe('tangent');
	});

	it('a line leaving a tangent arc along it makes the join smooth (the arc gives way)', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
		]);
		p.click(500, 700);
		// the arc ends heading down (270): leave along it
		const arcEnd = tool.view().tangent;
		expect(arcEnd).toBeNull();
		p.move(500, 640);
		p.move(500, 500);
		expect(tool.view().leave).toBe('tangent');
		p.click(500, 400);
		p.key('enter');
		const { piece, pts, sketch } = onlyPiece(ctx);
		const join = pts[piece.parts[2].from];
		expect(join.kind).toBe('smooth');
		const cubics = pieceSkeleton(piece, sketch);
		const arcCubics = cubics.slice(0, -1);
		expect(apart(endDirection(arcCubics.at(-1)), 270)).toBeLessThan(0.5);
		expect(piece.parts[1].type).toBe('curve');
	});

	it('a line leaving at an angle starts at a corner', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
		]);
		p.click(500, 700);
		p.move(560, 700);
		p.move(700, 700);
		expect(tool.view().leave).toBe('corner');
		p.click(800, 700);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(pts[piece.parts[2].from].kind).toBe('corner');
	});

});

describe('Line: readout', () => {
	it('reads length and angle on the 1 in capitals scale', () => {
		expect(lineReadout({ x: 0, y: 0 }, { x: 0, y: 1480 }, FONT)).toEqual({ length: 1480, angle: 90, inches: 1 });
		expect(lineReadout({ x: 0, y: 0 }, { x: -740, y: 0 }, FONT)).toMatchObject({ angle: 180, inches: 0.5 });
		expect(lineReadout({ x: 0, y: 0 }, { x: 100, y: -100 }, FONT).angle).toBe(315);
		expect(lineReadout({ x: 0, y: 0 }, { x: 0, y: 918 }, FONT).inches).toBe(0.62);
	});

	it('shows while a Line part is drawn, not for an arc or with no piece open', () => {
		const tool = makeLineTool(makeCtx());
		const p = pointer(tool);
		p.move(300, 300);
		expect(tool.view().readout).toBeNull();
		p.click(300, 300);
		p.move(300, 1000);
		expect(tool.view().readout).toMatchObject({ x: 300, y: 1000, length: 700, angle: 90 });
		expect(tool.drawState().readout).toMatchObject({ length: 700, angle: 90 });
		p.path([
			[300, 302],
			[340, 360],
		]);
		expect(tool.view().readout).toMatchObject({ angle: 56 });
	});

	it('no readout while the next part is a pull-back arc', () => {
		const tool = makeLineTool(makeCtx());
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.path([
			[300, 760],
			[300, 702],
			[340, 760],
		]);
		expect(tool.view().mode).toBe('arc');
		expect(tool.view().readout).toBeNull();
	});

	it('S2 integration: no readout while the pointer sits on the open end ("0.00 in, 0°")', () => {
		const tool = makeLineTool(makeCtx());
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		expect(tool.view().readout).toBeNull();
		p.move(300, 900);
		expect(tool.view().readout).toMatchObject({ length: 200, angle: 90 });
	});

	it('S2 integration: Arc picked with the pointer far off, then L and along the arc: a Line, not a pull-back arc', () => {
		const ctx = makeCtx();
		const arc = makeArcTool(ctx);
		const a = pointer(arc);
		a.click(300, 300);
		a.click(700, 300);
		a.click(500, 500);
		const line = makeLineTool(ctx);
		arc.toolOff({ to: 'sketchLine' });
		line.toolOn({ from: 'sketchArc' });
		const p = pointer(line);
		const end = { x: 700, y: 300 };
		const dir = (line.dir * Math.PI) / 180;
		// the pointer comes from the bulge click, far off, over the end, and out along the arc
		p.path([
			[600, 400],
			[end.x + 1, end.y + 1],
			[end.x + 80 * Math.cos(dir), end.y + 80 * Math.sin(dir)],
		]);
		expect(line.view().leave).toBe('tangent');
		expect(line.view().mode).toBe('line');
	});
});

describe('Line: take back and degenerate pieces', () => {
	it('takes back the last click; with only the first point left it cancels the piece', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.click(600, 700);
		expect(tool.takeBack()).toBe('taken');
		expect(tool.view().points).toHaveLength(2);
		expect(tool.takeBack()).toBe('taken');
		expect(tool.view().points).toHaveLength(1);
		expect(tool.takeBack()).toBe('cancelled');
		expect(tool.isOpen()).toBe(false);
		expect(tool.takeBack()).toBe(null);
		expect(ctx.commits).toHaveLength(0);
	});

	it('take back, then go on: the piece is as if the click never was', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.click(900, 900);
		tool.takeBack();
		p.click(600, 700);
		p.key('enter');
		const { piece, pts } = onlyPiece(ctx);
		expect(piece.parts).toHaveLength(2);
		expect(pts[piece.parts[1].to].x).toBe(600);
		expect(Object.keys(pts)).toHaveLength(3);
	});

	it('a 1-point Centerline piece is a dot; a 1-point Outline piece is removed', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 1300);
		p.key('enter');
		const { piece } = onlyPiece(ctx);
		expect(piece.parts).toEqual([{ type: 'spline', points: [expect.any(String)] }]);

		const outline = makeCtx({ use: 'outline' });
		const tool2 = makeLineTool(outline);
		const p2 = pointer(tool2);
		p2.click(300, 1300);
		expect(p2.key('escape')).toBe(true);
		expect(outline.commits).toHaveLength(0);
		expect(tool2.isOpen()).toBe(false);
	});

	it('a click on the last end adds nothing', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		p.click(300, 700, { gap: 2000 });
		p.key('enter');
		expect(onlyPiece(ctx).piece.parts).toHaveLength(1);
	});

	it('hands its open piece over to another tool without finishing it', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(300, 700);
		tool.toolOff({ to: 'sketchLine' });
		expect(tool.isOpen()).toBe(false);
		expect(ctx.commits).toHaveLength(0);
		const again = makeLineTool(ctx);
		again.toolOn({ from: 'sketchLine' });
		expect(again.isOpen()).toBe(true);
		pointer(again).click(600, 700);
		again.key({ type: 'down', key: 'enter' });
		expect(onlyPiece(ctx).piece.parts).toHaveLength(2);
	});
});
