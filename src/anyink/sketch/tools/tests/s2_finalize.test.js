// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 finalize: what the fix tracks left open in the sketch tools, each written to fail first.
	  1. the words they waited for: a dot's Undo title ("put a dot on small i"), the bend's words
	     at the cursor after the Arc's end click, the Arc tooltip's corner case, the Arc tip's
	     "that finishes the arc", the Line tip's right-click;
	  2. a stray click is never stored by leaving: one point, then another tool (Select, Brush)
	     or another letter (the Undo gate's endOpenPiece), lets go of it as Esc does; a dot stays
	     deliberate (Enter, a double-click); a piece of 2 points is still stored;
	  3. the pointer's Ctrl and Shift come from the mouse event alone: a held flag left over from
	     a shortcut never turns the snaps off (tool_route.js pointerEventOf);
	  4. while the bend waits, the cursor keeps the arc's radius beside the bend's words (found in
	     real Chrome: the words took the radius's place).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../../mode/features.js';
import { word, wordEntry } from '../../../words/words.js';
import { arcCubics } from '../../arc.js';
import { STORED_FONT } from '../../tests/fixtures/stored_sketches.js';
import { makeArcTool } from '../arc_tool.js';
import { sketchPicture } from '../draw_layer.js';
import { makeLineTool, stepKeyFor } from '../line.js';
import { makeSplineTool } from '../spline_tool.js';
import { pointerEventOf } from '../tool_route.js';
import { endOpenPiece, isPieceOpen, resetUndoGateForTests } from '../undo_gate.js';
import { makeCtx, pointer } from './fake_ctx.js';

beforeEach(() => {
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

describe('1. the words the tools waited for', () => {
	it("a dot's Undo title says a dot", () => {
		expect(word('sketch.step.dot', { letter: 'small i' })).toBe('put a dot on small i');
		const dot = { id: 'k1', parts: [{ type: 'spline', points: ['p1'] }] };
		expect(stepKeyFor('line', dot)).toBe('sketch.step.dot');
		expect(stepKeyFor('spline', dot)).toBe('sketch.step.dot');
	});

	it("after the Arc's end click, the cursor says what the next click does", () => {
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
		const live = arc.drawState();
		expect(live.readout?.key).toBe('sketch.tag.bend');
		expect(word('sketch.tag.bend')).toBe('click to set how far it bends');
	});

	// S3 fix (critic 15-arc-done.png): the bend click sets the arc and the piece stays open, so the
	// tip says how to finish, never that the third click finishes it
	it('the Arc tooltip covers the corner case; the Arc tip says how to finish after the bend', () => {
		const hint = wordEntry('sketch.tool.arc').hint;
		expect(hint).toMatch(/after a corner/);
		expect(hint).toMatch(/how far it bends/);
		expect(word('sketch.tip.arc')).not.toMatch(/finishes the arc/);
		expect(word('sketch.tip.arc')).toMatch(/how far it bends. Press Enter or double-click to finish./);
	});

	it('the Line tip names the right-click', () => {
		expect(word('sketch.tip.line')).toMatch(/right-click/);
	});
});

describe('2. a stray click is never stored by leaving', () => {
	const tools = { Line: makeLineTool, Arc: makeArcTool, Spline: makeSplineTool };
	for (const [name, make] of Object.entries(tools)) {
		it(`${name}: one click, then Select: nothing stored`, () => {
			const ctx = makeCtx();
			const tool = make(ctx);
			pointer(tool).click(300, 600);
			expect(tool.isOpen()).toBe(true);
			tool.toolOff({ to: 'resize' });
			expect(ctx.commits).toHaveLength(0);
			expect(tool.isOpen()).toBe(false);
			expect(isPieceOpen()).toBe(false);
		});

		it(`${name}: one click, then another letter (endOpenPiece): nothing stored`, () => {
			const ctx = makeCtx();
			const tool = make(ctx);
			pointer(tool).click(300, 600);
			expect(endOpenPiece()).toBe(true);
			expect(ctx.commits).toHaveLength(0);
			expect(tool.isOpen()).toBe(false);
		});
	}

	it('one click then the Brush: nothing stored', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		pointer(tool).click(300, 600);
		tool.toolOff({ to: 'nib' });
		expect(ctx.commits).toHaveLength(0);
	});

	it('guards: two clicks then Select store the line; Enter on one point stores a dot', () => {
		const ctx = makeCtx();
		const tool = makeLineTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(300, 900);
		tool.toolOff({ to: 'resize' });
		expect(ctx.commits).toHaveLength(1);
		expect(ctx.commits[0].stepKey).toBe('sketch.step.line');
		p.click(800, 1300);
		p.key('enter');
		expect(ctx.commits).toHaveLength(2);
		expect(ctx.commits[1].stepKey).toBe('sketch.step.dot');
	});

	it('guard: an Arc whose end is placed (the bend waiting) is kept on leaving', () => {
		const ctx = makeCtx();
		const tool = makeArcTool(ctx);
		const p = pointer(tool);
		p.click(300, 600);
		p.click(700, 600);
		expect(endOpenPiece()).toBe(true);
		expect(ctx.commits).toHaveLength(1);
	});
});

describe("3. the pointer's keys come from the mouse event alone", () => {
	it('a held Ctrl or Shift left over from a shortcut is not read', () => {
		const editor = { view: { dx: 0, dy: 0, dz: 1 }, selectedItem: null };
		const ev = pointerEventOf('down', { offsetX: 10, offsetY: 10 }, {
			editor,
			held: { isCtrlDown: true, isShiftDown: true, isAltDown: true },
			tool: 'sketchLine',
		});
		expect(ev).toMatchObject({ ctrl: false, snapsOff: false, shift: false, alt: false });
		const real = pointerEventOf('down', { offsetX: 10, offsetY: 10, ctrlKey: true, shiftKey: true }, {
			editor,
			tool: 'sketchLine',
		});
		expect(real).toMatchObject({ ctrl: true, snapsOff: true, shift: true });
	});
});

describe('4. the bend words keep the radius beside them', () => {
	it('"R 0.40 in, click to set how far it bends"', () => {
		const r = 1480 * 0.4;
		const picture = sketchPicture({}, { settings: { font: { ...STORED_FONT } } }, {
			tool: 'sketchArc',
			preview: { cubics: arcCubics([0, 0], [2 * r, 0], 1) },
			readout: { x: 10, y: 10, key: 'sketch.tag.bend' },
		});
		expect(picture.readout.text).toBe('R 0.40 in, click to set how far it bends');
	});

	it('guard: a Line keeps its own readout alone', () => {
		const picture = sketchPicture({}, { settings: { font: { ...STORED_FONT } } }, {
			tool: 'sketchLine',
			readout: { x: 10, y: 10, length: 1480 * 0.5, angle: 90 },
		});
		expect(picture.readout.text).toBe('0.50 in, 90°');
	});
});
