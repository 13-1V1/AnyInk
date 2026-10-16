// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 tools track: the five drawing tools against the app's side of things, with the 'sketch'
	flag on. The open piece is registered with the Undo gate (undo_gate.js runUndo takes back a
	click, then cancels; Redo is refused; endOpenPiece finishes it), the default commit stores the
	sketch on the letter and makes ONE History step named in house words ("sketched a line on
	small n"), and switching to a tool that does not chain finishes the piece. Events are shaped
	as tool_route.js makes them (editor, item, view; no ctx). Written before the tools existed.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../../mode/features.js';
import { sketchOf, validateSketch } from '../../model.js';
import { makeArcTool } from '../arc_tool.js';
import { makeCircleTool } from '../circle_tool.js';
import { makeLineTool } from '../line.js';
import { makeRectTool } from '../rect_tool.js';
import { makeSplineTool } from '../spline_tool.js';
import { endOpenPiece, isPieceOpen, resetUndoGateForTests, runUndo } from '../undo_gate.js';
import { FONT, VIEW } from './fake_ctx.js';

/** A stand-in editor: one letter, a History that records titles */
function fakeEditor(chars = 'n') {
	const item = { id: 'glyph-0x6E', chars, anyink: {} };
	const titles = [];
	const published = [];
	return {
		item,
		titles,
		published,
		selectedItem: item,
		selectedItemID: item.id,
		view: VIEW,
		project: { settings: { font: { ...FONT }, anyink: { sketchThickness: 99 } } },
		history: { addState: (title) => titles.push(title) },
		publish: (topic) => published.push(topic),
	};
}

/** Events as tool_route.js gives them */
function events(tool, editor) {
	let time = 0;
	const ev = (x, y, extra = {}) => {
		time += 1000;
		return { x, y, time, detail: 1, buttons: 0, shift: false, ctrl: false, snapsOff: false, view: editor.view, editor, item: editor.selectedItem, ...extra };
	};
	return {
		click(x, y, extra) {
			tool.move(ev(x, y, extra));
			tool.down(ev(x, y, extra));
			tool.up(ev(x, y, extra));
		},
		move: (x, y, extra) => tool.move(ev(x, y, extra)),
		key: (key) => tool.key({ type: 'down', key, editor }),
	};
}

beforeEach(() => {
	setFeaturesForTests({ sketch: true });
	resetUndoGateForTests();
});

afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

describe('the default commit', () => {
	it('stores the sketch on the letter and makes one step named in house words', () => {
		const editor = fakeEditor('n');
		const tool = makeLineTool();
		const e = events(tool, editor);
		e.click(300, 3);
		e.click(300, 1097);
		e.click(500, 900);
		expect(editor.titles).toEqual([]);
		e.key('enter');
		expect(editor.titles).toEqual(['sketched a line on small n']);
		expect(editor.published).toContain('currentItem');
		const sketch = sketchOf(editor.item);
		expect(validateSketch(sketch).problems).toEqual([]);
		expect(sketch.thickness).toBe(99);
		expect(sketch.pieces).toHaveLength(1);
		expect(sketch.pieces[0].parts).toHaveLength(2);
	});

	it('each tool names its own step', () => {
		const editor = fakeEditor('o');
		const arc = makeArcTool();
		let e = events(arc, editor);
		e.click(300, 300);
		e.click(700, 300);
		e.click(500, 500);
		e.key('escape');
		const spline = makeSplineTool();
		e = events(spline, editor);
		e.click(200, 600);
		e.click(400, 800);
		e.click(600, 600);
		e.key('enter');
		const circle = makeCircleTool();
		e = events(circle, editor);
		e.click(500, 500);
		e.click(700, 500);
		const rect = makeRectTool();
		e = events(rect, editor);
		e.click(900, 300);
		e.click(1100, 700);
		expect(editor.titles).toEqual([
			'sketched an arc on small o',
			'sketched a spline on small o',
			'sketched a circle on small o',
			'sketched a rectangle on small o',
		]);
		const sketch = sketchOf(editor.item);
		expect(sketch.pieces).toHaveLength(4);
		expect(validateSketch(sketch).problems).toEqual([]);
	});
});

describe('the Undo gate', () => {
	it('an open piece is registered: Undo takes back the last click, then cancels; Redo is refused', () => {
		const editor = fakeEditor();
		const tool = makeLineTool();
		const e = events(tool, editor);
		expect(isPieceOpen()).toBe(false);
		e.click(300, 300);
		e.click(300, 700);
		e.click(600, 700);
		expect(isPieceOpen()).toBe(true);
		expect(runUndo('redo')).toMatchObject({ gated: true, refused: true });
		expect(runUndo('undo')).toMatchObject({ gated: true, tookBack: true, cancelled: false });
		expect(tool.view().points).toHaveLength(2);
		expect(runUndo('undo')).toMatchObject({ tookBack: true, cancelled: false });
		expect(runUndo('undo')).toMatchObject({ tookBack: true, cancelled: true });
		expect(tool.isOpen()).toBe(false);
		expect(isPieceOpen()).toBe(false);
		expect(runUndo('undo')).toBe(null);
		expect(editor.titles).toEqual([]);
	});

	it('Backspace goes through the gate', () => {
		const editor = fakeEditor();
		const tool = makeSplineTool();
		const e = events(tool, editor);
		e.click(200, 300);
		e.click(400, 600);
		e.click(700, 400);
		expect(e.key('backspace')).toBe(true);
		expect(tool.view().points).toHaveLength(2);
		expect(tool.key({ type: 'down', key: 'backspace' })).toBe(true);
		expect(tool.view().points).toHaveLength(1);
	});

	it('endOpenPiece finishes the piece as its own step (leaving the letter, a whole-font Undo)', () => {
		const editor = fakeEditor();
		const tool = makeLineTool();
		const e = events(tool, editor);
		e.click(300, 300);
		e.click(300, 700);
		expect(endOpenPiece()).toBe(true);
		expect(editor.titles).toEqual(['sketched a line on small n']);
		expect(tool.isOpen()).toBe(false);
		expect(isPieceOpen()).toBe(false);
	});

	it("the Arc's end click before its bulge counts as a point the gate takes back", () => {
		const editor = fakeEditor();
		const tool = makeArcTool();
		const e = events(tool, editor);
		e.click(300, 300);
		e.click(700, 300);
		expect(runUndo('undo')).toMatchObject({ tookBack: true, cancelled: false });
		expect(tool.view().pending).toBe(false);
		expect(tool.isOpen()).toBe(true);
		expect(runUndo('undo')).toMatchObject({ cancelled: true });
	});

	it("a Circle's center and a Rectangle's first corner are open until the shape is made", () => {
		const editor = fakeEditor();
		const circle = makeCircleTool();
		let e = events(circle, editor);
		e.click(500, 500);
		expect(isPieceOpen()).toBe(true);
		expect(runUndo('undo')).toMatchObject({ cancelled: true });
		expect(circle.isOpen()).toBe(false);
		const rect = makeRectTool();
		e = events(rect, editor);
		e.click(300, 300);
		expect(isPieceOpen()).toBe(true);
		e.click(600, 600);
		expect(isPieceOpen()).toBe(false);
		expect(editor.titles).toEqual(['sketched a rectangle on small n']);
	});
});

describe('switching tools', () => {
	it('to Circle, Rectangle or a non-sketch tool, the open piece is finished first', () => {
		const editor = fakeEditor();
		const tool = makeLineTool();
		const e = events(tool, editor);
		e.click(300, 300);
		e.click(300, 700);
		tool.toolOff({ to: 'sketchCircle' });
		expect(editor.titles).toEqual(['sketched a line on small n']);
		e.click(500, 300);
		e.click(500, 700);
		tool.toolOff({ to: 'pathEdit' });
		expect(editor.titles).toHaveLength(2);
		expect(isPieceOpen()).toBe(false);
	});

	it('Line to Arc to Spline: one piece, one step, the gate follows the tool that has it', () => {
		const editor = fakeEditor();
		const line = makeLineTool();
		let e = events(line, editor);
		e.click(300, 50);
		e.click(300, 700);
		line.toolOff({ to: 'sketchArc' });
		const arc = makeArcTool();
		arc.toolOn({ from: 'sketchLine' });
		expect(isPieceOpen()).toBe(true);
		e = events(arc, editor);
		e.move(300, 760);
		e.click(500, 700);
		arc.toolOff({ to: 'sketchSpline' });
		const spline = makeSplineTool();
		spline.toolOn({ from: 'sketchArc' });
		e = events(spline, editor);
		e.click(600, 900);
		e.click(800, 700);
		expect(runUndo('undo')).toMatchObject({ tookBack: true, cancelled: false });
		e.key('enter');
		expect(editor.titles).toEqual(['sketched a line on small n']);
		const piece = sketchOf(editor.item).pieces[0];
		expect(piece.parts.map((part) => part.type)).toEqual(['line', 'arc', 'spline']);
		expect(piece.parts[1].tangent).toBe(true);
	});
});
