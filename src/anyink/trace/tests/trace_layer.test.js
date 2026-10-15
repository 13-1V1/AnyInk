// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Track B (Milestone 7): the trace layer's mouse and keyboard handling, driven with
// synthetic events against a real ProjectEditor and its real undo history.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { handleMouseEvents } from '../../../edit_canvas/events_mouse.js';
import { Tool_NewPath } from '../../../edit_canvas/tools/new_path.js';
import { Tool_Resize } from '../../../edit_canvas/tools/resize.js';
import { getShapeAtLocation } from '../../../edit_canvas/tools/tools.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { handleGuidesLayerEvent } from '../../metrics/guides_layer.js';
import { guidesLayerState, resetGuidesLayerState } from '../../metrics/state.js';
import {
	handleTraceKeyUp,
	handleTraceLayerEvent,
	resetTraceLayerState,
	traceHandleHasPriority,
	traceLayerState,
	traceLayerTarget,
} from '../trace_layer.js';
import { setDecoderForTests } from '../bitmap_cache.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { TRACE_HANDLE_HIT_PX } from '../trace_draw.js';
import { importTraceImage } from '../trace_import.js';
import {
	collectReferencedAssetIds,
	getTrace,
	makeTrace,
	setTrace,
	traceBounds,
} from '../trace_model.js';

// A 200 x 100 px image at 2 font units per pixel: 400 x 200 font units,
// top-left corner at (50, 450), so it spans x 50..450 and y 250..450.
const TRACE = Object.freeze({
	asset: 'img-tracetst',
	width: 200,
	height: 100,
	x: 50,
	y: 450,
	scale: 2,
	opacity: 0.4,
	visible: true,
	locked: false,
	invert: false,
});
const CENTER = { x: 250, y: 350 };

/**
 * A real editor on glyph A with the Trace panel open and the Resize tool.
 * Glyph A's shapes are removed unless withShapes: a shape under the pointer wins over the
 * image body (fix track), and in jsdom (no real pixels) a shape covers its whole bounding
 * box, which would hide the image tests below behind the "Large outline" (0..530, 0..790).
 */
function makeEditor({ dz = 0.5, trace = TRACE, withShapes = false } = {}) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.selectedTool = 'resize';
	if (!withShapes) editor.selectedItem.shapes = [];
	editor.view = { dx: 100, dy: 500, dz };
	editor.published = [];
	const publish = editor.publish.bind(editor);
	editor.publish = (topic, data) => {
		editor.published.push(topic);
		publish(topic, data);
	};
	if (trace) {
		// What trace_import does: set the trace, then one history entry
		setTrace(editor.selectedItem, { ...trace });
		editor.history.addState('Added a trace image');
	}
	return editor;
}

/** Canvas pixels for a font-unit point in the editor's current view. */
function px(editor, fu) {
	const v = editor.view;
	return { x: v.dx + fu.x * v.dz, y: v.dy - fu.y * v.dz };
}

function mouse(type, p, extra = {}) {
	return {
		type,
		offsetX: p.x,
		offsetY: p.y,
		button: 0,
		buttons: type === 'mouseup' ? 0 : extra.down ? 1 : 0,
		shiftKey: !!extra.shift,
	};
}

function key(type, name, options = {}) {
	const event = new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true, ...options });
	document.body.dispatchEvent(event);
	return event;
}

const trace = (editor) => getTrace(editor.selectedItem);
const titles = (editor) => editor.history.queue.map((entry) => entry.title);
const count = (editor, topic) => editor.published.filter((t) => t === topic).length;

beforeEach(() => {
	resetTraceLayerState();
	resetGuidesLayerState();
	document.body.style.cursor = '';
});

// --------------------------------------------------------------
// Hover
// --------------------------------------------------------------

describe('hover', () => {
	it('shows the move cursor on the body and a resize cursor on each corner', () => {
		const editor = makeEditor();
		const zones = [
			['move', CENTER, 'move'],
			['nw', { x: 50, y: 450 }, 'nwse-resize'],
			['se', { x: 450, y: 250 }, 'nwse-resize'],
			['ne', { x: 450, y: 450 }, 'nesw-resize'],
			['sw', { x: 50, y: 250 }, 'nesw-resize'],
		];
		for (const [part, point, cursor] of zones) {
			expect(handleTraceLayerEvent(mouse('mousemove', px(editor, point))), part).toBe(true);
			expect(traceLayerState.hover).toBe(part);
			expect(document.body.style.cursor).toBe(cursor);
		}

		// Off the image: the event goes to the tool
		expect(handleTraceLayerEvent(mouse('mousemove', px(editor, { x: 600, y: 350 })))).toBe(false);
		expect(traceLayerState.hover).toBe(false);
	});

	it('keeps the corner handles 7 px wide on screen at any zoom', () => {
		expect(TRACE_HANDLE_HIT_PX).toBe(7);
		for (const dz of [0.25, 0.5, 1, 2]) {
			const editor = makeEditor({ dz });
			const corner = px(editor, { x: 450, y: 250 }); // se
			handleTraceLayerEvent(mouse('mousemove', { x: corner.x + 5, y: corner.y }));
			expect(traceLayerState.hover, `5 px at ${dz}`).toBe('se');
			handleTraceLayerEvent(mouse('mousemove', { x: corner.x + 10, y: corner.y }));
			expect(traceLayerState.hover, `10 px at ${dz}`).toBe(false);
		}
	});

	it('asks for a redraw only when the hovered part changes', () => {
		const editor = makeEditor();
		handleTraceLayerEvent(mouse('mousemove', px(editor, CENTER)));
		handleTraceLayerEvent(mouse('mousemove', px(editor, { x: 260, y: 340 })));
		expect(count(editor, 'editCanvasView')).toBe(1);
		expect(count(editor, 'traceLayer')).toBe(0);
		handleTraceLayerEvent(mouse('mousemove', px(editor, { x: 600, y: 340 })));
		expect(count(editor, 'editCanvasView')).toBe(2);
	});

	it('leaves a tool drag alone while the button is held', () => {
		const editor = makeEditor();
		expect(handleTraceLayerEvent(mouse('mousemove', px(editor, CENTER), { down: true }))).toBe(
			false
		);
		expect(traceLayerState.hover).toBe(false);
	});
});

// --------------------------------------------------------------
// Moving
// --------------------------------------------------------------

describe('body drag', () => {
	it.each([0.25, 1])('moves by the pointer delta in font units at zoom %s', (dz) => {
		const editor = makeEditor({ dz });
		const start = px(editor, CENTER);
		const before = editor.history.queue.length;

		expect(handleTraceLayerEvent(mouse('mousedown', start))).toBe(true);
		expect(traceLayerState.dragging).toBe('move');
		expect(traceLayerState.start).toEqual(CENTER);
		expect(traceLayerState.original).toEqual(TRACE);

		// 10 px right and 8 px down on screen = right and down in font units
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 4, y: start.y + 4 }, { down: true }));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 10, y: start.y + 8 }, { down: true }));
		expect(trace(editor).x).toBe(50 + 10 / dz);
		expect(trace(editor).y).toBe(450 - 8 / dz);
		expect(trace(editor).scale).toBe(2);
		expect(traceLayerState.changed).toBe(true);
		expect(count(editor, 'traceLayer')).toBe(2);
		expect(editor.history.queue.length).toBe(before);

		expect(handleTraceLayerEvent(mouse('mouseup', { x: start.x + 10, y: start.y + 8 }))).toBe(true);
		expect(traceLayerState.dragging).toBe(false);
		expect(editor.history.queue.length).toBe(before + 1);
		expect(titles(editor)[0]).toBe('Moved the trace image');
		expect(traceLayerState.hover).toBe('move');
	});

	it('moves in steps of 10 font units with Shift', () => {
		const editor = makeEditor({ dz: 1 });
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(
			mouse('mousemove', { x: start.x + 13, y: start.y - 26 }, { down: true, shift: true })
		);
		expect(trace(editor).x).toBe(60);
		expect(trace(editor).y).toBe(480);
		handleTraceLayerEvent(mouse('mouseup', { x: start.x + 13, y: start.y - 26 }));
	});

	it('undo puts the image back where it was', () => {
		const editor = makeEditor();
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 30, y: start.y + 20 }, { down: true }));
		handleTraceLayerEvent(mouse('mouseup', { x: start.x + 30, y: start.y + 20 }));
		expect(trace(editor).x).toBe(110);

		editor.history.restoreState();
		expect(trace(editor)).toMatchObject({ x: 50, y: 450, scale: 2, asset: 'img-tracetst' });
		expect(titles(editor)[0]).toBe('Added a trace image');
	});

	it('adds no history entry for a click, or a drag that ends where it started', () => {
		const editor = makeEditor();
		const start = px(editor, CENTER);
		const before = editor.history.queue.length;
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mouseup', start));
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 20, y: start.y }, { down: true }));
		handleTraceLayerEvent(mouse('mousemove', start, { down: true }));
		handleTraceLayerEvent(mouse('mouseup', start));
		expect(editor.history.queue.length).toBe(before);
		expect(trace(editor)).toMatchObject({ x: 50, y: 450 });
	});

	it('ends the drag on a release outside the canvas', () => {
		const editor = makeEditor();
		const start = px(editor, CENTER);
		const before = editor.history.queue.length;
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x - 20, y: start.y }, { down: true }));
		window.dispatchEvent(new MouseEvent('mouseup'));
		expect(traceLayerState.dragging).toBe(false);
		expect(editor.history.queue.length).toBe(before + 1);
		expect(trace(editor).x).toBe(10);
	});

	it('ends the drag when a move arrives with the button already up', () => {
		const editor = makeEditor();
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 20, y: start.y }, { down: true }));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 40, y: start.y }));
		expect(traceLayerState.dragging).toBe(false);
		expect(trace(editor).x).toBe(90);
		expect(titles(editor)[0]).toBe('Moved the trace image');
	});
});

// --------------------------------------------------------------
// Resizing
// --------------------------------------------------------------

describe('corner drag', () => {
	it('keeps the aspect ratio with the opposite corner fixed', () => {
		const editor = makeEditor();
		const se = px(editor, { x: 450, y: 250 });
		expect(handleTraceLayerEvent(mouse('mousedown', se))).toBe(true);
		expect(traceLayerState.dragging).toBe('se');

		// +50, +25 px on screen = +100, -50 font units: along the diagonal, outward
		handleTraceLayerEvent(mouse('mousemove', { x: se.x + 50, y: se.y + 25 }, { down: true }));
		const t = trace(editor);
		expect(t.x).toBeCloseTo(50, 6);
		expect(t.y).toBeCloseTo(450, 6);
		expect(t.scale).toBeCloseTo(2.5, 6);
		const b = traceBounds(t);
		expect((b.xMax - b.xMin) / (b.yMax - b.yMin)).toBeCloseTo(2, 6);

		handleTraceLayerEvent(mouse('mouseup', { x: se.x + 50, y: se.y + 25 }));
		expect(titles(editor)[0]).toBe('Resized the trace image');
	});

	it('keeps the bottom-right corner fixed while the top-left one is dragged', () => {
		const editor = makeEditor();
		const nw = px(editor, { x: 50, y: 450 });
		handleTraceLayerEvent(mouse('mousedown', nw));
		expect(traceLayerState.dragging).toBe('nw');
		handleTraceLayerEvent(mouse('mousemove', { x: nw.x - 50, y: nw.y - 25 }, { down: true }));
		const b = traceBounds(trace(editor));
		expect(b.xMax).toBeCloseTo(450, 6);
		expect(b.yMin).toBeCloseTo(250, 6);
		expect(trace(editor).scale).toBeCloseTo(2.5, 6);
		handleTraceLayerEvent(mouse('mouseup', { x: nw.x - 50, y: nw.y - 25 }));
	});

	it('does not make the image jump when the handle is grabbed off its exact corner', () => {
		const editor = makeEditor();
		const se = px(editor, { x: 450, y: 250 });
		const grab = { x: se.x - 3, y: se.y - 3 };
		handleTraceLayerEvent(mouse('mousedown', grab));
		expect(traceLayerState.dragging).toBe('se');
		handleTraceLayerEvent(mouse('mousemove', grab, { down: true }));
		expect(trace(editor)).toMatchObject({ x: 50, y: 450, scale: 2 });
		handleTraceLayerEvent(mouse('mousemove', { x: grab.x + 50, y: grab.y + 25 }, { down: true }));
		expect(trace(editor).scale).toBeCloseTo(2.5, 6);
		handleTraceLayerEvent(mouse('mouseup', { x: grab.x + 50, y: grab.y + 25 }));
	});

	it('resizes from the center with Shift', () => {
		const editor = makeEditor();
		const se = px(editor, { x: 450, y: 250 });
		handleTraceLayerEvent(mouse('mousedown', se));
		handleTraceLayerEvent(
			mouse('mousemove', { x: se.x + 50, y: se.y + 25 }, { down: true, shift: true })
		);
		const b = traceBounds(trace(editor));
		expect((b.xMin + b.xMax) / 2).toBeCloseTo(250, 6);
		expect((b.yMin + b.yMax) / 2).toBeCloseTo(350, 6);
		expect(trace(editor).scale).toBeCloseTo(3, 6);
		handleTraceLayerEvent(mouse('mouseup', { x: se.x + 50, y: se.y + 25 }));
		expect(titles(editor)[0]).toBe('Resized the trace image');
	});
});

// --------------------------------------------------------------
// Escape
// --------------------------------------------------------------

describe('Escape during a drag', () => {
	it('puts the image back, adds no history, and swallows the rest of the gesture', () => {
		const editor = makeEditor();
		const se = px(editor, { x: 450, y: 250 });
		const before = editor.history.queue.length;
		handleTraceLayerEvent(mouse('mousedown', se));
		handleTraceLayerEvent(mouse('mousemove', { x: se.x + 40, y: se.y + 20 }, { down: true }));
		expect(trace(editor).scale).not.toBe(2);

		const escape = key('keydown', 'Escape');
		expect(escape.defaultPrevented).toBe(true);
		expect(traceLayerState.dragging).toBe(false);
		expect(trace(editor)).toEqual(TRACE);
		expect(count(editor, 'traceLayer')).toBe(2);

		// The button is still down: the tool never sees the rest of this gesture
		expect(
			handleTraceLayerEvent(mouse('mousemove', { x: se.x + 60, y: se.y }, { down: true }))
		).toBe(true);
		expect(handleTraceLayerEvent(mouse('mouseup', { x: se.x + 60, y: se.y }))).toBe(true);
		expect(trace(editor)).toEqual(TRACE);
		expect(editor.history.queue.length).toBe(before);

		// Back to normal afterwards
		expect(handleTraceLayerEvent(mouse('mousemove', px(editor, CENTER)))).toBe(true);
		expect(traceLayerState.hover).toBe('move');
	});

	it('leaves Escape alone when nothing is being dragged', () => {
		makeEditor();
		expect(key('keydown', 'Escape').defaultPrevented).toBe(false);
	});
});

// --------------------------------------------------------------
// When the layer stays out of the way
// --------------------------------------------------------------

describe('passes the event through', () => {
	const tryBody = (editor) => {
		const p = px(editor, CENTER);
		return [
			handleTraceLayerEvent(mouse('mousemove', p)),
			handleTraceLayerEvent(mouse('mousedown', p)),
		];
	};

	it('when the trace is locked or hidden', () => {
		const editor = makeEditor({ trace: { ...TRACE, locked: true } });
		expect(tryBody(editor)).toEqual([false, false]);
		setTrace(editor.selectedItem, { ...TRACE, visible: false });
		expect(tryBody(editor)).toEqual([false, false]);
		expect(traceLayerState.dragging).toBe(false);
	});

	it('when another panel is open', () => {
		const editor = makeEditor();
		editor.nav.panel = 'Layers';
		expect(tryBody(editor)).toEqual([false, false]);
	});

	it('when the item has no trace', () => {
		const editor = makeEditor({ trace: null });
		expect(tryBody(editor)).toEqual([false, false]);
		expect(traceLayerTarget(editor)).toBe(null);
	});

	it('on the Kerning page', () => {
		const editor = makeEditor();
		editor.nav.page = 'Kerning';
		expect(tryBody(editor)).toEqual([false, false]);
	});

	it('to every tool but Resize, so drawing over the image always works (integration, D-028)', () => {
		const editor = makeEditor();
		for (const tool of ['newPath', 'newRectangle', 'newOval', 'pathEdit', 'pathAddPoint', 'pan']) {
			editor.selectedTool = tool;
			expect(tryBody(editor), tool).toEqual([false, false]);
			expect(traceLayerTarget(editor), tool).toBe(null);
			expect(traceLayerState.dragging).toBe(false);
		}
		editor.selectedTool = 'resize';
		expect(handleTraceLayerEvent(mouse('mousemove', px(editor, CENTER)))).toBe(true);
	});

	it('lets New path place its first point on top of the image (real mouse handler)', () => {
		const editor = makeEditor();
		editor.eventHandlers.tool_addPath = new Tool_NewPath();
		editor.selectedTool = 'newPath';
		const shapesBefore = editor.selectedItem.shapes.length;
		const before = trace(editor);
		const p = px(editor, CENTER);
		handleMouseEvents(mouse('mousedown', p, { down: true }));
		handleMouseEvents(mouse('mouseup', p));
		expect(editor.selectedItem.shapes.length).toBe(shapesBefore + 1);
		expect(editor.eventHandlers.tool_addPath.newPath).toBeTruthy();
		expect(trace(editor)).toEqual(before);
		expect(traceLayerState.dragging).toBe(false);
	});

	it('to a metric line running across the image (guides layer first)', () => {
		// The image spans y 500..700, across the x-height line at 580
		const editor = makeEditor({ trace: { ...TRACE, y: 700 } });
		editor.systemGuides.xHeight = true;
		const onLine = px(editor, { x: 250, y: 580 });
		handleMouseEvents(mouse('mousedown', onLine));
		expect(guidesLayerState.dragging).toBe('xHeight');
		expect(traceLayerState.dragging).toBe(false);
		handleMouseEvents(mouse('mouseup', onLine));
		expect(guidesLayerState.dragging).toBe(false);

		const offLine = px(editor, { x: 250, y: 650 });
		handleMouseEvents(mouse('mousedown', offLine));
		expect(guidesLayerState.dragging).toBe(false);
		expect(traceLayerState.dragging).toBe('move');
		handleMouseEvents(mouse('mouseup', offLine));
		expect(traceLayerState.dragging).toBe(false);
	});
});

describe('corner handles on metric lines', () => {
	it('reports a handle under the pointer so the guides layer can defer to it', () => {
		// Default placement: top edge on the ascent, bottom on the descent, left edge on x = 0,
		// so every corner sits on a metric line (and two on the left side bearing too).
		const editor = makeEditor({ trace: null });
		const placed = makeTrace(
			{ asset: 'img-tracetst', width: 300, height: 200 },
			editor.project.settings.font
		);
		setTrace(editor.selectedItem, placed);
		expect(placed).toMatchObject({ x: 0, y: 800, scale: 5 });

		const nw = px(editor, { x: 0, y: 800 });
		const se = px(editor, { x: 1500, y: -200 });
		expect(traceHandleHasPriority(editor, nw)).toBe(true);
		expect(traceHandleHasPriority(editor, { x: se.x - 4, y: se.y + 4 })).toBe(true);
		// The body and edges still let the lines win
		expect(traceHandleHasPriority(editor, px(editor, { x: 700, y: 800 }))).toBe(false);
		expect(traceHandleHasPriority(editor, px(editor, { x: 700, y: 300 }))).toBe(false);
		// Only while the layer is active
		editor.nav.panel = 'Layers';
		expect(traceHandleHasPriority(editor, nw)).toBe(false);
		editor.nav.panel = 'Trace';
		setTrace(editor.selectedItem, { ...placed, locked: true });
		expect(traceHandleHasPriority(editor, nw)).toBe(false);
	});

	it('lets a new trace be resized from a corner through the real mouse handler (integration)', () => {
		const editor = makeEditor({ trace: null });
		Object.assign(editor.systemGuides, { ascent: true, descent: true, leftSide: true });
		const font = editor.project.settings.font;
		const ascentBefore = font.ascent;
		const placed = makeTrace({ asset: 'img-tracetst', width: 300, height: 200 }, font);
		setTrace(editor.selectedItem, placed);
		editor.history.addState('Added a trace image');

		// Bottom-right corner sits on the descent line: the handle wins, the image grows
		const se = px(editor, { x: 1500, y: -200 });
		handleMouseEvents(mouse('mousedown', se, { down: true }));
		expect(guidesLayerState.dragging).toBe(false);
		expect(traceLayerState.dragging).toBe('se');
		const out = { x: se.x + 50, y: se.y + 50 };
		handleMouseEvents(mouse('mousemove', out, { down: true }));
		handleMouseEvents(mouse('mouseup', out));
		expect(traceLayerState.dragging).toBe(false);
		expect(trace(editor).scale).toBeGreaterThan(placed.scale);
		expect(trace(editor)).toMatchObject({ x: 0, y: 800 }); // top-left corner fixed
		expect(font.ascent).toBe(ascentBefore);
		expect(titles(editor)[0]).toBe('Resized the trace image');

		// The middle of the top edge is still the ascent line's
		const edge = px(editor, { x: 400, y: 800 });
		handleMouseEvents(mouse('mousedown', edge, { down: true }));
		expect(guidesLayerState.dragging).toBe('ascent');
		expect(traceLayerState.dragging).toBe(false);
		handleMouseEvents(mouse('mouseup', edge));
		expect(guidesLayerState.dragging).toBe(false);
	});
});

// --------------------------------------------------------------
// Arrow keys
// --------------------------------------------------------------

describe('arrow keys', () => {
	it('nudge the image 1 font unit, or 10 with Shift, with one history entry per burst', () => {
		const editor = makeEditor();
		const before = editor.history.queue.length;

		const right = key('keydown', 'ArrowRight');
		expect(right.defaultPrevented).toBe(true);
		expect(trace(editor).x).toBe(51);
		key('keydown', 'ArrowRight', { repeat: true });
		expect(trace(editor).x).toBe(52);
		key('keydown', 'ArrowUp', { shiftKey: true });
		expect(trace(editor).y).toBe(460);
		expect(count(editor, 'traceLayer')).toBe(3);

		key('keyup', 'ArrowRight');
		expect(editor.history.queue.length).toBe(before); // ArrowUp is still held
		key('keyup', 'ArrowUp');
		expect(editor.history.queue.length).toBe(before + 1);
		expect(titles(editor)[0]).toBe('Moved the trace image');

		key('keydown', 'ArrowDown');
		key('keydown', 'ArrowLeft');
		key('keyup', 'ArrowDown');
		key('keyup', 'ArrowLeft');
		expect(editor.history.queue.length).toBe(before + 2);
		expect(trace(editor)).toMatchObject({ x: 51, y: 459 });

		editor.history.restoreState();
		expect(trace(editor)).toMatchObject({ x: 52, y: 460 });
		editor.history.restoreState();
		expect(trace(editor)).toMatchObject({ x: 50, y: 450 });
	});

	it('write the pending entry when the window loses focus mid-burst', () => {
		const editor = makeEditor();
		const before = editor.history.queue.length;
		key('keydown', 'ArrowLeft');
		window.dispatchEvent(new Event('blur'));
		expect(editor.history.queue.length).toBe(before + 1);
		expect(handleTraceKeyUp(new KeyboardEvent('keyup', { key: 'ArrowLeft' }))).toBe(false);
	});

	it('stay with the shapes when the trace is locked or another panel is open', () => {
		const editor = makeEditor({ trace: { ...TRACE, locked: true } });
		expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(false);
		expect(trace(editor).x).toBe(50);

		setTrace(editor.selectedItem, { ...TRACE });
		editor.nav.panel = 'Layers';
		expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(false);
		expect(trace(editor).x).toBe(50);
	});

	it('stay with selected shapes; pressing the image drops that selection (integration, D-028)', () => {
		// The image sits right of glyph A's shapes (x 600..1000), on empty paper
		const editor = makeEditor({ withShapes: true, trace: { ...TRACE, x: 600 } });
		const shape = editor.selectedItem.shapes[0];
		editor.multiSelect.shapes.select(shape);
		expect(editor.multiSelect.shapes.length).toBe(1);
		expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(false);
		key('keyup', 'ArrowRight');
		expect(trace(editor).x).toBe(600);

		// Pressing the image makes it what the Resize tool holds
		const p = px(editor, { x: 800, y: 350 });
		handleTraceLayerEvent(mouse('mousedown', p, { down: true }));
		handleTraceLayerEvent(mouse('mouseup', p));
		expect(editor.multiSelect.shapes.length).toBe(0);
		expect(key('keydown', 'ArrowRight').defaultPrevented).toBe(true);
		key('keyup', 'ArrowRight');
		expect(trace(editor).x).toBe(601);
	});

	it('stay with the pen tools and the other drawing tools', () => {
		const editor = makeEditor();
		for (const tool of ['pathEdit', 'newPath', 'pathAddPoint']) {
			editor.selectedTool = tool;
			expect(key('keydown', 'ArrowLeft').defaultPrevented, tool).toBe(false);
		}
		expect(trace(editor).x).toBe(50);
	});

	it('stay with a focused field or slider, and ignore Ctrl', () => {
		const editor = makeEditor();
		for (const make of [
			() => document.createElement('input'),
			() => Object.assign(document.createElement('input'), { type: 'range' }),
			() => document.createElement('textarea'),
		]) {
			const field = make();
			document.body.appendChild(field);
			field.focus();
			const event = new KeyboardEvent('keydown', {
				key: 'ArrowUp',
				bubbles: true,
				cancelable: true,
			});
			field.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(false);
			field.remove();
		}
		expect(key('keydown', 'ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(false);
		expect(trace(editor)).toMatchObject({ x: 50, y: 450 });
	});

	it('stay with a hovered metric line', () => {
		const editor = makeEditor();
		editor.systemGuides.xHeight = true;
		handleGuidesLayerEvent(mouse('mousemove', px(editor, { x: 300, y: 580 })));
		expect(guidesLayerState.hover).toBe('xHeight');
		key('keydown', 'ArrowUp');
		expect(editor.project.settings.font.xHeight).toBe(581);
		expect(trace(editor)).toMatchObject({ x: 50, y: 450 });
	});
});

// --------------------------------------------------------------
// Fix track: findings from the M7 review
// --------------------------------------------------------------

function deferred() {
	let resolve;
	const promise = new Promise((r) => (resolve = r));
	return { promise, resolve };
}

/** A decoder that waits for `gate` (a slow photo) and then gives a w x h bitmap. */
function gatedDecoder(gate, { width = 100, height = 50 } = {}) {
	return {
		decode: async () => {
			await gate;
			return { width, height, close() {} };
		},
		encode: async (_bitmap, options) =>
			new Blob([`${options.width}x${options.height}`], { type: 'image/webp' }),
	};
}

const photo = () => new File([new Uint8Array(16)], 'new-photo.jpg', { type: 'image/jpeg' });

describe('a Replace that finishes during a drag (fix track)', () => {
	beforeEach(() => {
		// jsdom has no Element.animate; the import's toast timer calls it
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	});
	afterEach(() => setDecoderForTests(null));

	it('keeps the new image: the drag carries on with it, and the save keeps its asset', async () => {
		const editor = makeEditor();
		const gate = deferred();
		setDecoderForTests(gatedDecoder(gate.promise));

		// Grab the image, move it a little, and drop a big photo meanwhile
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 10, y: start.y }, { down: true }));
		const importing = importTraceImage(photo(), { editor, item: editor.selectedItem });
		gate.resolve();
		expect(await importing).toBe(true);
		const replaced = trace(editor);
		expect(replaced.asset).not.toBe(TRACE.asset);
		expect(replaced).toMatchObject({ x: 70, y: 450, width: 100, height: 50 });

		// The drag goes on from where the replacement left it, with the new image
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 30, y: start.y }, { down: true }));
		expect(trace(editor).asset).toBe(replaced.asset);
		expect(trace(editor)).toMatchObject({ x: 110, y: 450, scale: replaced.scale });
		handleTraceLayerEvent(mouse('mouseup', { x: start.x + 30, y: start.y }));

		expect(trace(editor).asset).toBe(replaced.asset);
		expect(titles(editor)).toEqual([
			'Moved the trace image',
			'Replaced the trace image',
			'Added a trace image',
		]);
		expect(collectReferencedAssetIds(editor.project).has(replaced.asset)).toBe(true);

		// Undo walks back through the same states the user saw
		editor.history.restoreState();
		expect(trace(editor)).toEqual(replaced);
		editor.history.restoreState();
		expect(trace(editor)).toEqual(TRACE);
	});

	it('Escape right after the Replace keeps the replaced image, matching its history entry', async () => {
		const editor = makeEditor();
		const gate = deferred();
		setDecoderForTests(gatedDecoder(gate.promise));
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 10, y: start.y }, { down: true }));
		const importing = importTraceImage(photo(), { editor, item: editor.selectedItem });
		gate.resolve();
		await importing;
		const replaced = trace(editor);

		key('keydown', 'Escape');
		expect(trace(editor)).toEqual(replaced);
		expect(titles(editor)[0]).toBe('Replaced the trace image');
		expect(getTrace(editor.history.queue[0].itemState)).toEqual(trace(editor));
		handleTraceLayerEvent(mouse('mouseup', start));
	});

	it('Escape after a tick with the new image goes back to the replacement, not the old image', async () => {
		const editor = makeEditor();
		const gate = deferred();
		setDecoderForTests(gatedDecoder(gate.promise));
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 10, y: start.y }, { down: true }));
		const importing = importTraceImage(photo(), { editor, item: editor.selectedItem });
		gate.resolve();
		await importing;
		const replaced = trace(editor);
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 40, y: start.y }, { down: true }));
		expect(trace(editor).x).not.toBe(replaced.x);

		key('keydown', 'Escape');
		expect(trace(editor)).toEqual(replaced);
		expect(getTrace(editor.history.queue[0].itemState)).toEqual(replaced);
		handleTraceLayerEvent(mouse('mouseup', start));
	});

	it('a held arrow key keeps nudging the new image and adds no duplicate entry', async () => {
		const editor = makeEditor();
		const gate = deferred();
		setDecoderForTests(gatedDecoder(gate.promise));
		key('keydown', 'ArrowRight');
		const importing = importTraceImage(photo(), { editor, item: editor.selectedItem });
		gate.resolve();
		await importing;
		const replaced = trace(editor);
		expect(replaced.x).toBe(51);

		key('keydown', 'ArrowRight', { repeat: true });
		expect(trace(editor)).toMatchObject({ asset: replaced.asset, x: 52 });
		key('keyup', 'ArrowRight');
		expect(titles(editor)).toEqual([
			'Moved the trace image',
			'Replaced the trace image',
			'Added a trace image',
		]);
		editor.history.restoreState();
		expect(trace(editor)).toEqual(replaced);
	});
});

describe('switching items in the middle of a nudge or a drag (fix track)', () => {
	afterEach(() => {
		document.removeEventListener('keydown', handleKeyPress);
		document.removeEventListener('keyup', handleKeyUp);
		eventHandlerData.isCtrlDown = false;
		eventHandlerData.isShiftDown = false;
	});

	/** Ctrl+. through upstream's real key handler: opens the next item, 'Navigated to' entry. */
	function pressCtrlPeriod(editor) {
		editor.editCanvas ||= { redraw() {} }; // no real canvas in jsdom
		document.addEventListener('keydown', handleKeyPress);
		document.addEventListener('keyup', handleKeyUp);
		key('keydown', 'Control', { ctrlKey: true });
		key('keydown', '.', { ctrlKey: true });
		key('keyup', 'Control');
		document.removeEventListener('keydown', handleKeyPress);
		document.removeEventListener('keyup', handleKeyUp);
	}

	it('an arrow burst still held when Ctrl+. opens the next glyph is recorded on its glyph', () => {
		const editor = makeEditor();
		const glyphA = editor.selectedItem;
		key('keydown', 'ArrowRight');
		key('keydown', 'ArrowRight', { repeat: true });
		expect(getTrace(glyphA).x).toBe(52);

		pressCtrlPeriod(editor);
		expect(editor.selectedItemID).not.toBe('glyph-0x41');
		key('keyup', 'ArrowRight');

		expect(titles(editor).slice(1)).toEqual(['Moved the trace image', 'Added a trace image']);
		const moved = editor.history.queue[1];
		expect(moved.itemID).toBe('glyph-0x41');
		expect(getTrace(moved.itemState).x).toBe(52);

		// Undo, undo, redo lands on the nudged image again
		editor.history.restoreState();
		editor.history.restoreState();
		editor.history.redoState();
		expect(getTrace(editor.project.getItem('glyph-0x41')).x).toBe(52);
	});

	it('a press anywhere on the page (the item dropdown) records the pending nudge first', () => {
		const editor = makeEditor();
		key('keydown', 'ArrowUp');
		document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		editor.selectedGlyphID = 'glyph-0x42';
		key('keyup', 'ArrowUp');
		expect(titles(editor)[0]).toBe('Moved the trace image');
		expect(getTrace(editor.history.queue[0].itemState).y).toBe(451);
	});

	it('Shift pressed during a burst does not split it', () => {
		const editor = makeEditor();
		const before = editor.history.queue.length;
		key('keydown', 'ArrowRight');
		key('keydown', 'Shift', { shiftKey: true });
		key('keydown', 'ArrowRight', { shiftKey: true, repeat: true });
		key('keyup', 'ArrowRight', { shiftKey: true });
		expect(editor.history.queue.length).toBe(before + 1);
		expect(trace(editor).x).toBe(61);
	});

	it('when the item changed with no key or press first, the unrecorded nudge is put back', () => {
		const editor = makeEditor();
		const glyphA = editor.selectedItem;
		const before = editor.history.queue.length;
		key('keydown', 'ArrowRight');
		editor.selectedGlyphID = 'glyph-0x42';
		key('keyup', 'ArrowRight');
		expect(editor.history.queue.length).toBe(before);
		expect(getTrace(glyphA)).toEqual(TRACE);
	});

	it('Ctrl+. during a mouse drag records the drag on its glyph, then swallows the rest', () => {
		const editor = makeEditor();
		const start = px(editor, CENTER);
		handleTraceLayerEvent(mouse('mousedown', start));
		handleTraceLayerEvent(mouse('mousemove', { x: start.x + 20, y: start.y }, { down: true }));

		pressCtrlPeriod(editor);
		expect(traceLayerState.dragging).toBe(false);
		const moved = editor.history.queue.find((e) => e.title === 'Moved the trace image');
		expect(moved?.itemID).toBe('glyph-0x41');
		expect(getTrace(moved.itemState).x).toBe(90);

		// The button is still down: the rest of the gesture goes to nobody
		expect(
			handleTraceLayerEvent(mouse('mousemove', { x: start.x + 60, y: start.y }, { down: true }))
		).toBe(true);
		expect(handleTraceLayerEvent(mouse('mouseup', { x: start.x + 60, y: start.y }))).toBe(true);
		expect(getTrace(editor.project.getItem('glyph-0x41')).x).toBe(90);
	});
});

describe('shapes drawn over the image, with the arrow (fix track, D-028 revisit)', () => {
	// Default placement covers the whole glyph: x 0..1500, y -200..800
	function coveredEditor(keep = null) {
		const editor = makeEditor({ withShapes: true, trace: null });
		if (keep) editor.selectedItem.shapes = keep(editor.selectedItem.shapes);
		setTrace(
			editor.selectedItem,
			makeTrace({ asset: 'img-tracetst', width: 300, height: 200 }, editor.project.settings.font)
		);
		editor.history.addState('Added a trace image');
		editor.eventHandlers.tool_resize = new Tool_Resize();
		return editor;
	}

	it('a press on a shape selects the shape and never moves the image', () => {
		const editor = coveredEditor();
		const before = trace(editor);
		const outline = editor.selectedItem.shapes[0];
		const onShape = px(editor, { x: 100, y: 100 }); // inside "Large outline"

		expect(handleTraceLayerEvent(mouse('mousemove', onShape))).toBe(false);
		expect(traceLayerState.hover).toBe(false);
		expect(handleTraceLayerEvent(mouse('mousedown', onShape, { down: true }))).toBe(false);
		expect(traceLayerState.dragging).toBe(false);

		// Through the real mouse handler: the arrow tool gets it and drags the shape
		handleMouseEvents(mouse('mousedown', onShape, { down: true }));
		expect(editor.multiSelect.shapes.isSelected(outline)).toBe(true);
		handleMouseEvents(mouse('mousemove', { x: onShape.x + 20, y: onShape.y }, { down: true }));
		handleMouseEvents(mouse('mouseup', { x: onShape.x + 20, y: onShape.y }));
		expect(traceLayerState.dragging).toBe(false);
		expect(trace(editor)).toEqual(before);
		expect(editor.multiSelect.shapes.length).toBe(1);
	});

	it('a selected shape keeps its resize handles', () => {
		// Only the triangle, so its handles sit on empty paper inside the image
		const editor = coveredEditor((shapes) => [shapes[1]]);
		const ms = editor.multiSelect.shapes;
		ms.select(editor.selectedItem.shapes[0]);

		const corner = px(editor, { x: ms.maxes.xMax, y: ms.maxes.yMin });
		let handle = null;
		for (let dx = -6; dx <= 12 && !handle; dx++) {
			for (let dy = -6; dy <= 12 && !handle; dy++) {
				const p = { x: corner.x + dx, y: corner.y + dy };
				if (ms.isOverBoundingBoxHandle(p.x, p.y) === 'se' && !getShapeAtLocation(p.x, p.y)) {
					handle = p;
				}
			}
		}
		expect(handle).not.toBe(null);
		expect(handleTraceLayerEvent(mouse('mousemove', handle))).toBe(false);
		expect(handleTraceLayerEvent(mouse('mousedown', handle, { down: true }))).toBe(false);
		expect(ms.length).toBe(1);
	});

	it('empty paper inside the image still grabs the image, and its corners beat a shape', () => {
		const editor = coveredEditor();
		const paper = px(editor, { x: 900, y: 300 }); // right of every shape
		expect(handleTraceLayerEvent(mouse('mousedown', paper))).toBe(true);
		expect(traceLayerState.dragging).toBe('move');
		handleTraceLayerEvent(mouse('mouseup', paper));

		// Put the top-left corner on top of "Large outline"
		setTrace(editor.selectedItem, { ...trace(editor), x: 100, y: 500 });
		const nw = px(editor, { x: 100, y: 500 });
		expect(getShapeAtLocation(nw.x, nw.y)).toBeTruthy();
		expect(handleTraceLayerEvent(mouse('mousedown', nw))).toBe(true);
		expect(traceLayerState.dragging).toBe('nw');
		handleTraceLayerEvent(mouse('mouseup', nw));
	});
});

// B4 + B5 finalize (the dead-end photo variant): Simple draws no photo until B9's photo card
// (photo_gate.js), so it can't be grabbed either: an invisible photo's corner or body must never
// take a press. Once B9 turns 'photo' on, it can; All tools as before.
describe('the photo layer in Simple before the photo card (B9)', () => {
	afterEach(() => {
		setModeForTests('all');
		resetFeaturesForTests();
	});

	it('Simple, photo flag off: nothing to grab', () => {
		const editor = makeEditor();
		setModeForTests('simple');
		// B8 + B9 integration: 'photo' is on in the app now; this is Simple before B9
		setFeaturesForTests({ photo: false });
		expect(traceLayerTarget(editor)).toBe(null);
	});

	it("Simple, once B9 turns 'photo' on: the photo can be grabbed", () => {
		const editor = makeEditor();
		setModeForTests('simple');
		setFeaturesForTests({ photo: true });
		expect(traceLayerTarget(editor)).not.toBe(null);
	});

	it('All tools: as before', () => {
		expect(traceLayerTarget(makeEditor())).not.toBe(null);
	});
});
