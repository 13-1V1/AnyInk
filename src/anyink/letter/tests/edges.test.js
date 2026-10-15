// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B7 letter view, the edges (UX-BEGINNER.md 4.3 Canvas, 7.2): in Simple the left and right edges
// show only while Fine-tune is open: two purple edges at the letter's width with the spaces
// between ink and edge shaded light purple. Pointing at an edge outlines it in green and says
// "left space" with no number (principle 3: numbers only while dragging); dragging shows the
// readout, makes one Undo step and sets the spacing "set by you", which never snaps back. The
// drawing never jumps: a refit moves the shapes and the view together, so the ink stays still
// and the edges come to it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditCanvas } from '../../../edit_canvas/edit_canvas.js';
import { B, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { handleGuidesLayerEvent } from '../../metrics/guides_layer.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { fitSpacing } from '../../spacing/auto_space.js';
import { Glyph } from '../../../project_data/glyph.js';
import { word } from '../../words/words.js';
import { drawEdges, edgeLayout, edgesShown, hidesLayerOverlay } from '../edges.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

const VIEW = Object.freeze({ dx: 100, dy: 500, dz: 0.5 });
const WIDTH = 1200;
const HEIGHT = 1000;
const xOf = (em, view = VIEW) => view.dx + em * view.dz;

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	vi.stubGlobal('requestAnimationFrame', (callback) => callback()); // draw now, not next frame
	resetGuidesLayerState();
	resetLetterViewForTests();
});
afterEach(() => {
	warn.mockRestore();
	vi.unstubAllGlobals();
	resetGuidesLayerState();
	resetLetterViewForTests();
});

function simpleLetterView() {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
}

/** Edge lines on, a known view and Select, as on the letter's edit canvas. */
function onCanvas(editor) {
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	editor.editCanvas = { redraw() {} };
	return editor;
}

/** Simple, the letter view on, Capital B traced (automatic, fitted) and on screen. */
function tracedB() {
	simpleLetterView();
	const editor = onCanvas(twoLetterEditor());
	showItem(editor, B);
	onCanvas(editor);
	expect(traceInto(editor, 100)).toBe(true);
	editor.view = { ...VIEW };
	return editor;
}

function context() {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	return canvas.getContext('2d');
}

function redraw(editor) {
	const ctx = context();
	const host = { ctx, width: WIDTH, height: HEIGHT, editingItemID: editor.selectedItemID };
	EditCanvas.prototype.redraw.call(host, 'test');
	return ctx;
}

const events = (ctx, type) => ctx.__getEvents().filter((e) => e.type === type);
const texts = (ctx) => events(ctx, 'fillText').map((e) => e.props.text);
/** fillRects of an edge: 1 px or more wide, taller than the letter box, at that x */
const edgeRects = (ctx, x) =>
	events(ctx, 'fillRect').filter(
		(e) => Math.abs(e.props.x - Math.floor(x)) <= 1 && e.props.width <= 4 && e.props.height > 400
	);

function mouse(type, x, y, { down = false } = {}) {
	return { type, offsetX: x, offsetY: y, button: 0, buttons: type === 'mouseup' ? 0 : down ? 1 : 0 };
}

function dragSide(editor, side, dxPx) {
	const glyph = editor.selectedItem;
	const x = side === 'lsb' ? xOf(0, editor.view) : xOf(glyph.advanceWidth, editor.view);
	expect(handleGuidesLayerEvent(mouse('mousedown', x, 300))).toBe(true);
	expect(guidesLayerState.dragging).toBe(side);
	handleGuidesLayerEvent(mouse('mousemove', x + dxPx, 300, { down: true }));
	handleGuidesLayerEvent(mouse('mouseup', x + dxPx, 300));
}

/** What the fitter would make of a copy of the letter (the live letter is not touched). */
function isFitted(item, project) {
	const copy = new Glyph(item.save());
	copy.parent = project;
	fitSpacing(copy, project);
	return copy.leftSideBearing === item.leftSideBearing && copy.advanceWidth === item.advanceWidth;
}

// --------------------------------------------------------------
// Edges only with Fine-tune open
// --------------------------------------------------------------

describe('edges only with Fine-tune open', () => {
	it('Simple with the letter view: shown only while Fine-tune is open, on a letter with ink', () => {
		const editor = tracedB();
		const item = editor.selectedItem;
		expect(edgesShown(item)).toBe(false);
		setFineTuneOpen(true);
		expect(edgesShown(item)).toBe(true);
		expect(edgesShown({ ...item, objType: 'Glyph', shapes: [] })).toBe(false); // empty letter
		expect(edgesShown({ objType: 'Component', shapes: item.shapes })).toBe(false);
		setFineTuneOpen(false);
		expect(edgesShown(item)).toBe(false);
	});

	it('not a Simple screen otherwise: All tools and Simple before the letter view lands', () => {
		const editor = tracedB();
		setFineTuneOpen(true);
		setFeaturesForTests({ letterView: false });
		expect(edgesShown(editor.selectedItem)).toBe(false);
		setModeForTests('all');
		setFeaturesForTests({ letterView: true });
		expect(edgesShown(editor.selectedItem)).toBe(false);
	});

	it('drawEdges draws nothing with Fine-tune closed', () => {
		const editor = tracedB();
		const ctx = context();
		expect(drawEdges(ctx, editor.view, editor.selectedItem, editor.project)).toBe(false);
		expect(ctx.__getEvents()).toHaveLength(0);
	});

	it('Fine-tune open: two purple edges at the letter width, the spaces shaded, no words', () => {
		const editor = tracedB();
		const item = editor.selectedItem;
		setFineTuneOpen(true);
		const ctx = context();
		expect(drawEdges(ctx, editor.view, item, editor.project)).toBe(true);
		expect(edgeRects(ctx, xOf(0))).toHaveLength(1);
		expect(edgeRects(ctx, xOf(item.advanceWidth))).toHaveLength(1);
		const layout = edgeLayout(item, editor.view, editor.project.settings.font);
		expect(layout.spaces.map((s) => s.side)).toEqual(['lsb', 'rsb']);
		const [left, right] = layout.spaces;
		expect(left.x0).toBeCloseTo(xOf(0), 6);
		expect(left.x1).toBeCloseTo(xOf(item.maxes.xMin), 6);
		expect(right.x0).toBeCloseTo(xOf(item.maxes.xMax), 6);
		expect(right.x1).toBeCloseTo(xOf(item.advanceWidth), 6);
		// each space is one shaded box from the top line to the tail line
		const font = editor.project.settings.font;
		[left, right].forEach((space) => {
			const box = events(ctx, 'fillRect').find(
				(e) =>
					Math.abs(e.props.x - space.x0) < 0.01 &&
					Math.abs(e.props.width - (space.x1 - space.x0)) < 0.01
			);
			expect(box, space.side).toBeTruthy();
			expect(box.props.y).toBeCloseTo(VIEW.dy - font.ascent * VIEW.dz, 6);
			expect(box.props.y + box.props.height).toBeCloseTo(VIEW.dy - font.descent * VIEW.dz, 6);
		});
		expect(texts(ctx)).toEqual([]);
	});

	it('a space the ink reaches past is not shaded', () => {
		const editor = tracedB();
		const item = editor.selectedItem;
		item.anyink.spacing = 'manual';
		item.rightSideBearing = -20;
		setFineTuneOpen(true);
		const layout = edgeLayout(item, editor.view, editor.project.settings.font);
		expect(layout.spaces.map((s) => s.side)).toEqual(['lsb']);
	});

	it('pointing at an edge: a green outline and "left space", no number; dragging: the readout', () => {
		const editor = tracedB();
		const item = editor.selectedItem;
		setFineTuneOpen(true);
		Object.assign(guidesLayerState, {
			hover: 'lsb',
			line: { id: 'lsb', kind: 'sideBearing', side: 'lsb', orientation: 'v', value: 0 },
			pointer: { x: xOf(0), y: 300 },
		});
		expect(hidesLayerOverlay(item)).toBe(true);
		const ctx = context();
		drawEdges(ctx, editor.view, item, editor.project);
		expect(texts(ctx)).toEqual([word('space.lsb')]);
		// the pointed-at edge is outlined: wider than the other one
		const [hovered] = edgeRects(ctx, xOf(0));
		const [other] = edgeRects(ctx, xOf(item.advanceWidth));
		expect(hovered.props.width).toBeGreaterThan(other.props.width);
		// The redraw: the guides-layer readout (with its number) is not drawn while pointing
		const page = redraw(editor);
		expect(texts(page).filter((text) => /\d/.test(text))).toEqual([]);
		expect(texts(page)).toContain(word('space.lsb'));

		guidesLayerState.dragging = 'lsb';
		expect(hidesLayerOverlay(item)).toBe(false);
		const dragging = redraw(editor);
		expect(texts(dragging)).toContain(
			word('canvas.readout', { label: word('space.lsb'), value: String(item.leftSideBearing) })
		);
	});

	it('Fine-tune closed: nothing about an edge shows, even when the pointer finds one', () => {
		const editor = tracedB();
		Object.assign(guidesLayerState, {
			hover: 'rsb',
			line: { id: 'rsb', kind: 'sideBearing', side: 'rsb', orientation: 'v', value: 0 },
			pointer: { x: xOf(editor.selectedItem.advanceWidth), y: 300 },
		});
		expect(hidesLayerOverlay(editor.selectedItem)).toBe(true);
		const ctx = redraw(editor);
		expect(edgeRects(ctx, xOf(0))).toHaveLength(0);
		expect(edgeRects(ctx, xOf(editor.selectedItem.advanceWidth))).toHaveLength(0);
		expect(texts(ctx).some((text) => text.includes(word('space.rsb')))).toBe(false);
	});

	it('All tools: the overlay is never held back here', () => {
		const editor = tracedB();
		setModeForTests('all');
		guidesLayerState.hover = 'lsb';
		guidesLayerState.line = { id: 'lsb', kind: 'sideBearing', side: 'lsb' };
		expect(hidesLayerOverlay(editor.selectedItem)).toBe(false);
	});
});

// --------------------------------------------------------------
// Edges set "manual" and do not snap back
// --------------------------------------------------------------

describe('an edge drag sets the spacing "set by you" and it never snaps back', () => {
	it('right edge: one step, "manual", the width he dragged to stays through later steps', () => {
		const editor = tracedB();
		setFineTuneOpen(true);
		const item = editor.selectedItem;
		expect(item.anyink.spacing).toBe('auto');
		const steps = editor.history.queue.length;
		const width = item.advanceWidth;

		dragSide(editor, 'rsb', 40); // 40 px at dz 0.5 = 80 units wider
		expect(item.advanceWidth).toBe(width + 80);
		expect(item.anyink.spacing).toBe('manual');
		expect(editor.history.queue).toHaveLength(steps + 1);
		expect(isFitted(item, editor.project)).toBe(false);

		// A later change to the letter is a step of its own; the refit leaves his width alone
		item.shapes[0].updateShapePosition(0, 30);
		editor.history.addState('Nudged shape(s) by 0, 30');
		expect(item.advanceWidth).toBe(width + 80);
		expect(item.anyink.spacing).toBe('manual');
	});

	it('left edge: "manual", and the ink stays put on screen while the edge moves', () => {
		const editor = tracedB();
		setFineTuneOpen(true);
		const item = editor.selectedItem;
		const inkOnScreen = xOf(item.maxes.xMin, editor.view);
		const lsb = item.leftSideBearing;
		dragSide(editor, 'lsb', -20); // 20 px left = 40 more units of left space
		expect(item.leftSideBearing).toBe(lsb + 40);
		expect(item.anyink.spacing).toBe('manual');
		expect(xOf(item.maxes.xMin, editor.view)).toBeCloseTo(inkOnScreen, 6);
		editor.history.addState('Another step');
		expect(item.leftSideBearing).toBe(lsb + 40);
	});
});

// --------------------------------------------------------------
// The view pans with a refit
// --------------------------------------------------------------

describe('the view pans with a refit: the ink stays still, the edges come to it', () => {
	it('moving his shape right: the refit moves it back and the view with it', () => {
		const editor = tracedB();
		setFineTuneOpen(true);
		const item = editor.selectedItem;
		const font = editor.project.settings.font;
		const before = edgeLayout(item, editor.view, font);
		const lsb = item.leftSideBearing;

		item.shapes[0].updateShapePosition(100, 0); // a Select drag of 100 units
		const dropped = edgeLayout(item, editor.view, font); // where he let go
		editor.history.addState('Moved shape(s)');

		const after = edgeLayout(item, editor.view, font);
		expect(item.leftSideBearing).toBe(lsb); // refit back to its fitted left space
		expect(editor.view.dx).toBeCloseTo(VIEW.dx + 100 * VIEW.dz, 6); // the view moved
		expect(after.ink.left).toBeCloseTo(dropped.ink.left, 6); // the ink did not jump
		expect(after.left).toBeCloseTo(before.left + 100 * VIEW.dz, 6); // the edges came to it
		expect(after.ink.left - after.left).toBeCloseTo(lsb * VIEW.dz, 6);
	});
});
