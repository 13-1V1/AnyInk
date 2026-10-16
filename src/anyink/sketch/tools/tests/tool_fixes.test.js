// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 fix track tools (line.js, arc_tool.js, spline_tool.js, arc_snap.js), found in real Chrome
	by the critics:
	  1. a fresh 3-point Arc ends on its bend click: a click away from it starts a new arc (its
	     own piece and step); going on from its end stays a deliberate move (over the end and out);
	  2. an arc's top goes on a writing line: the 3-point bend and the tangent arc's end (Arc and
	     the Line's pull-back) snap so the top sits where the edge rule puts a round top, the
	     line's name at the top, Ctrl turns it off; an n built with Arc has its ink top on the
	     small-letter line;
	  3. a stray click then Esc stores nothing; a dot is deliberate (Enter on one point or a
	     double-click in place) and named as a dot when the words have it;
	  4. after a corner the Arc's end click shows the bend at once, says what the next click
	     does, and the end is kept (as the bend shown, or a straight line) when he finishes or
	     switches tools;
	  5. the third press of a triple-click (any press with detail >= 2 and no piece open) adds
	     nothing.
	Written to fail first: every test here failed on the tools before the fix.
*/
import { describe, expect, it } from 'vitest';
import { guideLines } from '../../../placement/classes.js';
import { hasWord } from '../../../words/words.js';
import { arcGeometry } from '../../arc.js';
import { edgeThickness } from '../../edge_rule.js';
import { validateSketch } from '../../model.js';
import { makeArcTool } from '../arc_tool.js';
import { arcExtreme } from '../arc_snap.js';
import { makeLineTool } from '../line.js';
import { makeSplineTool } from '../spline_tool.js';
import { FONT, THICKNESS, makeCtx, pointer } from './fake_ctx.js';

const lines = guideLines(FONT);
const r = edgeThickness(FONT, THICKNESS) / 2;
/** where a round top's center goes on the small-letter line (edge rule plus overshoot) */
const SMALL_TOP = lines.small - r + lines.overshoot;
const xy = (pt) => [pt.x, pt.y];

/** @returns {{x, y} | null} the top of an arc part */
function topOf(part, pts) {
	return arcExtreme(xy(pts[part.from]), xy(pts[part.to]), part.bulge, 'top');
}

/** detail 1, 2 and 3 presses at one spot, as Chrome sends a triple-click */
function tripleClick(tool, x, y) {
	let time = 1e6;
	for (const detail of [1, 2, 3]) {
		tool.move({ x, y, time: (time += 60), detail: 0, buttons: 0 });
		tool.down({ x, y, time: (time += 60), detail, buttons: 1 });
		tool.up({ x, y, time: (time += 10), detail, buttons: 0 });
	}
}

describe('1. a fresh 3-point Arc ends on its bend click', () => {
	it('a click away from it starts a new arc: two pieces, two steps', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.click(500, 400);
		p.move(1100, 800);
		expect(tool.drawState().preview).toBeUndefined();
		p.click(1100, 800);
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].piece.parts.map((part) => part.type)).toEqual(['arc']);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.arc');
		expect(tool.view().points).toHaveLength(1);
		p.click(1500, 800);
		p.click(1300, 900);
		p.key('enter');
		expect(ctx.commits).toHaveLength(2);
		const { sketch } = ctx.commits[1];
		expect(validateSketch(sketch).problems).toEqual([]);
		expect(sketch.pieces).toHaveLength(2);
		expect(sketch.pieces.map((piece) => piece.parts.map((part) => part.type))).toEqual([['arc'], ['arc']]);
	});

	it('going on from its end is still one piece when he goes over the end and out', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.click(500, 400);
		p.path([
			[700, 300],
			[760, 300],
		]);
		p.click(900, 300);
		p.click(800, 200);
		p.key('enter');
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].piece.parts.map((part) => part.type)).toEqual(['arc', 'arc']);
	});
});

describe('2. an arc top on a writing line', () => {
	it('the 3-point bend near the small-letter line puts the top where the edge rule says', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		p.move(500, lines.small + 6);
		const live = tool.drawState();
		expect(live.snap.text.length).toBeGreaterThan(0);
		expect(live.snap.y).toBeCloseTo(SMALL_TOP, 6);
		expect(live.hints.some((hint) => hint.kind === 'level' && hint.from.y === live.snap.y)).toBe(true);
		p.click(500, lines.small + 6);
		p.key('enter');
		const { piece, sketch } = ctx.commits[0];
		expect(topOf(piece.parts[0], sketch.points).y).toBeCloseTo(SMALL_TOP, 3);
	});

	it('Ctrl turns the top snap off', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		p.click(500, lines.small + 6, { ctrl: true });
		p.key('enter');
		const { piece, sketch } = ctx.commits[0];
		expect(topOf(piece.parts[0], sketch.points).y).toBeCloseTo(lines.small + 6, 3);
	});

	it("the Line's pull-back arc: the end click snaps so the top lands on the line", () => {
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
		expect(tool.view().mode).toBe('arc');
		const R = lines.small - 700; // the free top on the real line
		p.move(300 + 2 * R + 8, 690);
		expect(tool.drawState().snap?.y).toBeCloseTo(SMALL_TOP, 6);
		p.click(300 + 2 * R + 8, 690);
		p.key('enter');
		const { piece, sketch } = ctx.commits[0];
		const arc = piece.parts[1];
		expect(arc.type).toBe('arc');
		// the end is rounded to whole units: the top within a unit
		expect(Math.abs(topOf(arc, sketch.points).y - SMALL_TOP)).toBeLessThan(1);
	});

	it('n with Arc: stem, the arch with its top on the small-letter line, the leg; ink top on the line', () => {
		const ctx = makeCtx();
		const line = makeLineTool(ctx);
		const pl = pointer(line);
		pl.click(300, lines.writing + 4);
		pl.click(300, 800);
		line.toolOff({ to: 'sketchArc' });
		const arc = makeArcTool(ctx);
		arc.toolOn({ from: 'sketchLine' });
		const pa = pointer(arc);
		pa.path([
			[300, 800],
			[200, 830],
		]);
		expect(arc.view().leave).toBe('corner');
		pa.click(800, 800);
		pa.click(550, lines.small - 5);
		arc.toolOff({ to: 'sketchLine' });
		const leg = makeLineTool(ctx);
		leg.toolOn({ from: 'sketchArc' });
		const pg = pointer(leg);
		pg.path([
			[800, 800],
			[900, 760],
		]);
		pg.click(800, lines.writing + 4);
		pg.key('enter');
		expect(ctx.commits).toHaveLength(1);
		const { piece, sketch } = ctx.commits[0];
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc', 'line']);
		const top = topOf(piece.parts[1], sketch.points);
		// the ink's top: the centerline's top plus half the thickness
		expect(top.y + r).toBeCloseTo(lines.small + lines.overshoot, 3);
	});
});

describe('3. a stray click then Esc stores nothing; a dot is deliberate', () => {
	for (const [name, make] of [
		['Line', makeLineTool],
		['Arc', makeArcTool],
		['Spline', makeSplineTool],
	]) {
		it(`${name}: one click then Esc`, () => {
			const ctx = makeCtx();
			const tool = make(ctx);
			const p = pointer(tool);
			p.click(300, 600);
			expect(p.key('escape')).toBe(true);
			expect(ctx.commits).toHaveLength(0);
			expect(tool.isOpen()).toBe(false);
			expect(p.key('escape')).toBe(false);
		});
	}

	it('Enter on one point stores a dot, named a dot when the words have one', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 1300);
		p.key('enter');
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].piece.parts).toEqual([{ type: 'spline', points: [expect.any(String)] }]);
		expect(ctx.commits[0].stepKey).toBe(hasWord('sketch.step.dot') ? 'sketch.step.dot' : 'sketch.step.line');
	});

	it('a double-click in place stores a dot', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		pointer(tool).doubleClick(300, 1300);
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].piece.parts[0].points).toHaveLength(1);
	});
});

describe("4. the Arc's end after a corner", () => {
	/** n's stem, then Arc leaving it at an angle and its end clicked */
	function stemCornerEnd() {
		const ctx = makeCtx();
		const line = makeLineTool(ctx);
		const pl = pointer(line);
		pl.click(300, 100);
		pl.click(300, 700);
		line.toolOff({ to: 'sketchArc' });
		const arc = makeArcTool(ctx);
		arc.toolOn({ from: 'sketchLine' });
		const p = pointer(arc);
		p.path([
			[300, 700],
			[200, 730],
		]);
		p.click(700, 700);
		return { ctx, arc, p };
	}

	it('shows the bend at once and says the next click sets it', () => {
		const { arc } = stemCornerEnd();
		expect(arc.view().pending).toBe(true);
		const live = arc.drawState();
		expect(live.preview?.cubics?.length).toBeGreaterThan(0);
		if (hasWord('sketch.tag.bend')) expect(live.readout?.key).toBe('sketch.tag.bend');
	});

	it('switching to Line keeps the end with the bend shown', () => {
		const { ctx, arc, p } = stemCornerEnd();
		p.move(500, 860);
		arc.toolOff({ to: 'sketchLine' });
		const leg = makeLineTool(ctx);
		leg.toolOn({ from: 'sketchArc' });
		const pg = pointer(leg);
		pg.click(700, 100);
		pg.key('enter');
		const { piece, sketch } = ctx.commits[0];
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc', 'line']);
		const geo = arcGeometry(xy(sketch.points[piece.parts[1].from]), xy(sketch.points[piece.parts[1].to]), piece.parts[1].bulge);
		expect(Math.abs(geo.sweep)).toBeGreaterThan(30);
	});

	it('Enter keeps the end; with no bend moved it is a straight line', () => {
		const { ctx, p } = stemCornerEnd();
		p.key('enter');
		const { piece, sketch } = ctx.commits[0];
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'line']);
		expect(xy(sketch.points[piece.parts[1].to])).toEqual([700, 700]);
	});

	it('a fresh Arc: start, end, Enter stores the line between them (not a dot)', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		p.key('enter');
		const { piece, sketch, stepKey } = ctx.commits[0];
		expect(piece.parts).toHaveLength(1);
		expect(piece.parts[0].type).toBe('line');
		expect(xy(sketch.points[piece.parts[0].to])).toEqual([700, 300]);
		expect(stepKey).toBe('sketch.step.line');
	});
});

describe('5. a triple-click adds nothing after the double-click finished', () => {
	it('Line: the third press starts no new piece', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		pointer(tool).click(300, 100);
		tripleClick(tool, 300, 700);
		expect(ctx.commits).toHaveLength(1);
		expect(tool.isOpen()).toBe(false);
		expect(pointer(tool).key('escape')).toBe(false);
		expect(ctx.commits).toHaveLength(1);
	});

	it('Spline: the same', () => {
		const ctx = makeCtx();
		const tool = makeSplineTool(ctx);
		const p = pointer(tool);
		p.click(300, 100);
		p.click(500, 400);
		tripleClick(tool, 300, 700);
		expect(ctx.commits).toHaveLength(1);
		expect(tool.isOpen()).toBe(false);
	});

	it('Arc: the bend triple-clicked stores one arc', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 300);
		p.click(700, 300);
		tripleClick(tool, 500, 400);
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].piece.parts.map((part) => part.type)).toEqual(['arc']);
		expect(tool.isOpen()).toBe(false);
	});
});
