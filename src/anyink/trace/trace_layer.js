// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: move and resize the trace image with the mouse and the arrow keys
	(Milestone 7). Owner: TRACK B. Modeled on src/anyink/metrics/guides_layer.js.

	Hook: src/edit_canvas/events_mouse.js calls handleTraceLayerEvent right AFTER
	handleGuidesLayerEvent (metric lines keep priority), for left-button mousedown /
	mousemove / mouseup, before the active tool. Return true to swallow the event.

	Active only when all of these hold (see traceLayerTarget):
	- an edit canvas page, editor.nav.panel === 'Trace', the item is a Glyph (glyph,
	  ligature or component) with a trace that is visible and unlocked;
	- the Resize tool (the arrow) is selected. Integration (D-028): every other tool is
	  for drawing or editing over the image, so it always gets the pointer and the keys,
	  even on the Trace panel. (First build: any tool but a mid-path pen, which swallowed
	  the first click of New path, New rectangle and New oval, and the Add point click.)
	Shapes win over the image body (fix track, D-028 revisit): a press on a shape, or on a
	selected shape's resize handle, goes to the Resize tool, so shapes drawn over the image
	can still be selected with the arrow. The image body takes presses on empty paper only;
	its corner handles win over shapes. Pressing on the image drops the shape selection:
	the image is now what the Resize tool holds, so no leftover shape handles and no arrow
	keys point at something else.

	Pointer: drag the body to move (Shift moves in steps of 10 font units), drag a corner
	to resize with the aspect ratio kept and the opposite corner fixed (Shift resizes from
	the center). Escape during a drag puts the image back; the rest of that gesture is
	swallowed so the tool never sees half a click. Each tick is computed from the trace as
	it was at mousedown (no drift), writes only the placement (x, y, scale) into
	item.anyink.trace, and publishes 'traceLayer'. One history entry on release, only when
	the placement changed. If something else swaps the image mid-drag (a Replace whose
	decode finishes while the button is down), that change made its own history entry, so
	the drag carries on from the new image as it is now; nothing puts the old image back.

	Keys: while the layer is active and no shape or point is selected, the arrow keys nudge
	the image 1 font unit (Shift 10); a selection keeps upstream's nudge. A burst of presses (held key included) makes one history
	entry when the last arrow key comes up. Keys are read in the capture phase on document,
	like the guides layer, so upstream's nudge of the selected shapes never runs as well.
	A focused field, a slider, or a hovered metric line keeps its arrow keys.

	History always matches the glyph (fix track): any other key (not an arrow, not a lone
	Shift / Ctrl / Alt / Meta) and any press anywhere on the page first write the pending
	nudge entry, and any other key during a mouse drag first ends the drag with its entry,
	while the item it changed is still the one on the canvas. Ctrl+. or the item dropdown
	can then switch items safely. If the item changed anyway before an entry could be
	written, the placement goes back to what history last recorded.
*/
import { photosClosed } from './photo_gate.js';
import { getCurrentProjectEditor } from '../../app/main.js';
import { setCursor, updateCursor } from '../../edit_canvas/cursors.js';
import { cXsX, cYsY } from '../../edit_canvas/edit_canvas.js';
import { getShapeAtLocation } from '../../edit_canvas/tools/tools.js';
import { isTextEntryElement } from '../history/undo_shortcut.js';
import { guidesLayerState } from '../metrics/state.js';
import { traceHandleRadiusFU } from './trace_draw.js';
import {
	getTrace,
	hitTestTrace,
	moveTrace,
	scaleTraceFromCorner,
	setTrace,
	traceCorner,
} from './trace_model.js';

/** History titles, in plain words. */
export const TRACE_HISTORY_TITLES = Object.freeze({
	move: 'Moved the trace image',
	resize: 'Resized the trace image',
});

/** Cursor for each part of the trace under the pointer. */
export const TRACE_CURSORS = Object.freeze({
	move: 'move',
	nw: 'nwse-resize',
	se: 'nwse-resize',
	ne: 'nesw-resize',
	sw: 'nesw-resize',
});

/** The one tool that moves and resizes the trace image (the toolbar calls it "Resize"). */
export const TRACE_LAYER_TOOL = 'resize';

const TOPIC = 'traceLayer';
const PANEL = 'Trace';
const ARROW_STEPS = Object.freeze({
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, 1],
	ArrowDown: [0, -1],
});
/** Keys that only change what the next key or drag means; they never end a nudge burst. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock']);

export const traceLayerState = {
	/** @type {'nw' | 'ne' | 'sw' | 'se' | 'move' | false} part under the pointer */
	hover: false,
	/** @type {'nw' | 'ne' | 'sw' | 'se' | 'move' | false} part being dragged */
	dragging: false,
	/** @type {{x: Number, y: Number} | null} font-unit point where the drag started */
	start: null,
	/** @type {Object | null} the trace as it was when the drag started (Escape restores it) */
	original: null,
	/** @type {Boolean} the placement now differs from the original */
	changed: false,
};

/** The glyph whose trace is being dragged (the drag never follows a selection change). */
let dragItem = null;
/** Font-unit pointer position at the last drag tick (where the placement was last written). */
let lastDragPoint = null;
/** After Escape the button is still down: swallow the rest of the gesture. */
let swallowUntilUp = false;
/** Keyboard nudge burst: one history entry when the last arrow key comes up. */
const nudgeBurst = { item: null, original: null, keys: new Set() };

let listenersInstalled = false;
const watchedCanvases = new WeakSet();

// --------------------------------------------------------------
// Who is active
// --------------------------------------------------------------

/**
 * The item and trace the layer works on right now, or null when the layer is off.
 * @param {Object} [editor] - ProjectEditor
 * @returns {{item: Object, trace: Object} | null}
 */
export function traceLayerTarget(editor = getCurrentProjectEditor()) {
	// B4 + B5 finalize: Simple draws no photo until B9 (photo_gate.js), so none can be grabbed
	if (photosClosed()) return null;
	if (!editor?.nav?.isOnEditCanvasPage) return null;
	if (editor.nav.panel !== PANEL) return null;
	if (!isTraceLayerTool(editor)) return null;
	const item = editor.selectedItem;
	if (!item || item.objType === 'KernGroup') return null;
	const trace = getTrace(item);
	if (!trace || trace.visible === false || trace.locked === true) return null;
	return { item, trace };
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true when the selected tool is the one that moves the trace image
 */
export function isTraceLayerTool(editor) {
	return editor?.selectedTool === TRACE_LAYER_TOOL;
}

// --------------------------------------------------------------
// Pointer events
// --------------------------------------------------------------

/**
 * @param {MouseEvent} event - left-button mousedown / mousemove / mouseup from the canvas
 * @returns {Boolean} true when the layer consumed the event
 */
export function handleTraceLayerEvent(event) {
	if (!event) return false;
	installTraceLayerListeners();
	watchCanvas(event.currentTarget || event.target);

	const editor = getCurrentProjectEditor();
	if (!editor) return false;
	const pos = pointerPosition(event);

	switch (event.type) {
		case 'mousedown':
			return onMouseDown(editor, event, pos);
		case 'mousemove':
			return onMouseMove(editor, event, pos);
		case 'mouseup':
			return onMouseUp(editor, event, pos);
		default:
			return false;
	}
}

function onMouseDown(editor, event, pos) {
	const state = traceLayerState;
	if (state.dragging) return true;
	// A new press means the swallowed gesture is over, even if its release went unheard.
	if (swallowUntilUp) endGesture();
	commitNudge(editor);

	const target = traceLayerTarget(editor);
	const part = target ? partAt(editor, target, pos) : false;
	if (!part || shapeWinsAt(editor, part, pos)) {
		if (state.hover) clearHover(editor);
		return false;
	}

	state.dragging = part;
	state.hover = part;
	state.start = toFontUnits(pos, editor.view);
	lastDragPoint = state.start;
	state.original = { ...target.trace };
	state.changed = false;
	dragItem = target.item;
	clearShapeSelection(editor);
	setCursor(TRACE_CURSORS[part]);
	window.addEventListener('mouseup', onWindowMouseUp);
	editor.publish('editCanvasView', editor.view);
	return true;
}

function onMouseMove(editor, event, pos) {
	const state = traceLayerState;
	const buttonHeld = !!(event.buttons & 1);

	if (state.dragging) {
		// The button came up somewhere we never heard about: finish, then treat as a hover.
		if (typeof event.buttons === 'number' && !buttonHeld) {
			finishDrag(editor);
		} else {
			dragTick(editor, event, pos);
			return true;
		}
	}

	if (swallowUntilUp) {
		if (buttonHeld) return true;
		endGesture();
	}

	// Left button held and we are not dragging: a tool owns this drag.
	if (buttonHeld) {
		if (state.hover) clearHover(editor);
		return false;
	}

	const target = traceLayerTarget(editor);
	let part = target ? partAt(editor, target, pos) : false;
	// A shape over the image is the Resize tool's to hover (and its cursor)
	if (part && shapeWinsAt(editor, part, pos)) part = false;
	if (part !== state.hover) {
		state.hover = part;
		editor.publish('editCanvasView', editor.view);
		if (!part) updateCursor();
	}
	if (part) {
		setCursor(TRACE_CURSORS[part]);
		return true;
	}
	return false;
}

function onMouseUp(editor, event, pos) {
	const state = traceLayerState;
	if (swallowUntilUp) {
		endGesture();
		refreshHover(editor, pos);
		return true;
	}
	if (!state.dragging) return false;

	finishDrag(editor);
	refreshHover(editor, pos);
	return true;
}

/** A release outside the canvas still ends the drag (or the swallowed gesture). */
function onWindowMouseUp() {
	const state = traceLayerState;
	const editor = getCurrentProjectEditor();
	if (state.dragging) finishDrag(editor);
	endGesture();
	state.hover = false;
	if (editor) editor.publish('editCanvasView', editor.view);
}

// --------------------------------------------------------------
// Drag
// --------------------------------------------------------------

function dragTick(editor, event, pos) {
	const state = traceLayerState;
	const item = dragItem;
	if (!item || !state.original || !state.start) return;

	const point = toFontUnits(pos, editor.view);
	const current = getTrace(item);
	if (!current) {
		// The trace went away under the drag (undo of the add): nothing left to drag
		abandonDrag(editor);
		return;
	}
	if (!sameImage(current, state.original)) {
		// A Replace finished decoding mid-drag. It wrote its own history entry with the
		// placement as it was at the last tick, so carry on from the new image as it is
		// now, measured from that tick's pointer: no jump, no old image coming back.
		state.original = { ...current };
		state.start = lastDragPoint || point;
		state.changed = false;
	}
	lastDragPoint = point;
	const original = state.original;
	const dx = point.x - state.start.x;
	const dy = point.y - state.start.y;
	const shift = !!event.shiftKey;

	let next;
	if (state.dragging === 'move') {
		next = moveTrace(original, roundStep(dx, shift), roundStep(dy, shift));
	} else {
		// The grabbed corner follows the pointer by the same delta, so grabbing a few
		// pixels inside the handle never makes the image jump.
		const corner = traceCorner(original, state.dragging);
		if (!corner) return;
		next = scaleTraceFromCorner(
			original,
			state.dragging,
			{ x: corner.x + dx, y: corner.y + dy },
			{ fromCenter: shift }
		);
	}
	if (!next) return;

	if (samePlacement(current, next)) return;
	// The drag owns the placement only: opacity, visibility, invert and the image stay as
	// they are now
	setTrace(item, withPlacement(current, next));
	state.changed = !samePlacement(next, original);
	editor.publish(TOPIC, item);
}

/**
 * Ends the drag. Commits one history entry when the placement changed, or puts the
 * original back when cancelled.
 * @param {Object} editor - ProjectEditor
 * @param {{cancel?: Boolean}} [options]
 */
function finishDrag(editor, { cancel = false } = {}) {
	const state = traceLayerState;
	const part = state.dragging;
	const item = dragItem;
	const original = state.original;

	state.dragging = false;
	state.start = null;
	state.original = null;
	state.changed = false;
	dragItem = null;
	lastDragPoint = null;
	window.removeEventListener('mouseup', onWindowMouseUp);
	if (!item || !original || !editor) return;

	const final = getTrace(item);
	// The image was swapped since the last tick: that change's own history entry already
	// holds this placement, so there is nothing to record and nothing to put back.
	if (!final || !sameImage(final, original)) return;
	if (samePlacement(final, original)) return;

	if (cancel) {
		setTrace(item, withPlacement(final, original));
		editor.publish(TOPIC, item);
		return;
	}
	recordPlacement(
		editor,
		item,
		original,
		part === 'move' ? TRACE_HISTORY_TITLES.move : TRACE_HISTORY_TITLES.resize
	);
	editor.publish(TOPIC, item);
}

/**
 * One history entry for a placement change on item. History snapshots the selected
 * item, so when the canvas has already moved on to another item (the keys and presses
 * that switch items commit first, so this is a fallback), the placement goes back to
 * what history last recorded instead of staying changed with no entry to undo.
 * @param {Object} editor - ProjectEditor
 * @param {Object} item - the glyph whose trace moved
 * @param {Object} original - the trace as history last recorded it
 * @param {String} title - history title
 */
function recordPlacement(editor, item, original, title) {
	if (editor.selectedItem === item) {
		editor.history.addState(title);
		return;
	}
	const current = getTrace(item);
	if (current) setTrace(item, withPlacement(current, original));
}

/** The trace went away mid-drag: forget the drag and swallow the rest of the gesture. */
function abandonDrag(editor) {
	traceLayerState.dragging = false;
	traceLayerState.start = null;
	traceLayerState.original = null;
	traceLayerState.changed = false;
	dragItem = null;
	lastDragPoint = null;
	swallowRestOfGesture(editor);
}

/**
 * Any other key while a drag runs (Ctrl+., Ctrl+Z, Space...): the drag ends here with
 * its history entry, while its item is still the one on the canvas, and the rest of the
 * gesture (the button is still down) belongs to nobody.
 * @param {Object} editor - ProjectEditor
 */
function commitDragBeforeKey(editor) {
	if (!traceLayerState.dragging) return;
	finishDrag(editor);
	swallowRestOfGesture(editor);
}

/** The button is still down after the drag ended early: nobody gets the rest of it. */
function swallowRestOfGesture(editor) {
	swallowUntilUp = true;
	window.addEventListener('mouseup', onWindowMouseUp);
	traceLayerState.hover = false;
	updateCursor();
	if (editor) editor.publish('editCanvasView', editor.view);
}

/**
 * Escape during a drag: the image goes back where it was, no history entry, and the
 * rest of the gesture (the button is still down) belongs to nobody.
 * @param {Object} [editor] - ProjectEditor
 * @returns {Boolean} true when a drag was cancelled
 */
export function cancelTraceDrag(editor = getCurrentProjectEditor()) {
	if (!traceLayerState.dragging) return false;
	finishDrag(editor, { cancel: true });
	swallowRestOfGesture(editor);
	return true;
}

function endGesture() {
	swallowUntilUp = false;
	window.removeEventListener('mouseup', onWindowMouseUp);
}

// --------------------------------------------------------------
// Keyboard
// --------------------------------------------------------------

/**
 * Escape cancels a drag; arrow keys nudge the trace (1 font unit, Shift 10).
 * Installed in the capture phase on document (installTraceLayerListeners).
 * @param {KeyboardEvent} event
 * @returns {Boolean} true when the layer used the key (default prevented, propagation stopped)
 */
export function handleTraceKeyDown(event) {
	if (!event) return false;
	const editor = getCurrentProjectEditor();
	if (!editor) return false;

	if (event.key === 'Escape') {
		if (!cancelTraceDrag(editor)) return false;
		consume(event);
		return true;
	}

	const step = ARROW_STEPS[event.key];
	const withCommand = event.ctrlKey || event.metaKey || event.altKey;
	if (!step || withCommand) {
		// Anything else may switch items (Ctrl+., Ctrl+Z...): record first, on this item
		if (!MODIFIER_KEYS.has(event.key)) {
			commitNudge(editor);
			commitDragBeforeKey(editor);
		}
		return false;
	}
	if (event.defaultPrevented) return false;
	if (keyboardBelongsToField(document.activeElement)) return false;
	// A mouse drag owns the image; keep the arrows away from the shapes too.
	if (traceLayerState.dragging) {
		consume(event);
		return true;
	}
	// A hovered metric line owns the arrow keys (guides layer, D-008).
	if (guidesLayerState.hover && guidesLayerState.line) return false;
	// Selected shapes or points keep upstream's nudge: the keys move what is selected.
	if (hasShapeSelection(editor)) return false;

	const target = traceLayerTarget(editor);
	if (!target) return false;

	if (nudgeBurst.item && nudgeBurst.item !== target.item) commitNudge(editor);
	if (nudgeBurst.item && !sameImage(nudgeBurst.original, target.trace)) {
		// A Replace landed mid-burst with its own history entry: count from there
		nudgeBurst.original = { ...target.trace };
	}
	if (!nudgeBurst.item) {
		nudgeBurst.item = target.item;
		nudgeBurst.original = { ...target.trace };
	}
	nudgeBurst.keys.add(event.key);

	const size = event.shiftKey ? 10 : 1;
	const next = moveTrace(target.trace, step[0] * size, step[1] * size);
	if (next) {
		setTrace(target.item, withPlacement(target.trace, next));
		editor.publish(TOPIC, target.item);
	}
	consume(event);
	return true;
}

/**
 * The end of a nudge burst: when the last arrow key comes up, one history entry.
 * @param {KeyboardEvent} event
 * @returns {Boolean} true when this key-up ended or continued a nudge burst
 */
export function handleTraceKeyUp(event) {
	if (!event || !ARROW_STEPS[event.key]) return false;
	if (!nudgeBurst.item) return false;
	nudgeBurst.keys.delete(event.key);
	if (!nudgeBurst.keys.size) commitNudge(getCurrentProjectEditor());
	return true;
}

/**
 * Writes the history entry for a pending nudge burst (key-up, blur, mousedown, page change).
 * @param {Object} [editor] - ProjectEditor
 */
export function commitNudge(editor = getCurrentProjectEditor()) {
	const { item, original } = nudgeBurst;
	nudgeBurst.item = null;
	nudgeBurst.original = null;
	nudgeBurst.keys.clear();
	if (!item || !original || !editor) return;
	const final = getTrace(item);
	// Swapped since the last nudge: the Replace entry already holds this placement
	if (!final || !sameImage(final, original)) return;
	if (samePlacement(final, original)) return;
	recordPlacement(editor, item, original, TRACE_HISTORY_TITLES.move);
	editor.publish(TOPIC, item);
}

function consume(event) {
	if (typeof event.preventDefault === 'function') event.preventDefault();
	if (typeof event.stopPropagation === 'function') event.stopPropagation();
}

/** Text fields, number fields, sliders and dropdowns keep their own keys. */
function keyboardBelongsToField(element) {
	if (!element || typeof element.tagName !== 'string') return false;
	if (isTextEntryElement(element)) return true;
	const tag = element.tagName.toLowerCase();
	return tag === 'input' || tag === 'select';
}

// --------------------------------------------------------------
// Hit testing against the live editor
// --------------------------------------------------------------

/**
 * The part of the trace under a canvas pixel, or false.
 * @param {Object} editor - ProjectEditor
 * @param {{item: Object, trace: Object}} target - from traceLayerTarget
 * @param {{x: Number, y: Number}} pos - canvas pixels
 * @returns {'nw' | 'ne' | 'sw' | 'se' | 'move' | false}
 */
function partAt(editor, target, pos) {
	const view = editor.view;
	const point = toFontUnits(pos, view);
	// The same 7 px (in x and y) the drawn handles use, divided by the zoom
	return hitTestTrace(target.trace, point, traceHandleRadiusFU(view)) || false;
}

/**
 * True when the pointer is on one of the trace's corner handles while the layer is active.
 * Meant for the guides layer (findLineAt), the way penHasPriority works there: a drawn
 * handle should win over a metric line running through it. The default placement puts
 * every corner on a line (ascent, descent, left side), so without this a new trace can
 * be moved but never resized while those lines are shown. Edges and body still defer.
 * @param {Object} editor - ProjectEditor
 * @param {{x: Number, y: Number}} pos - canvas pixels
 * @returns {Boolean}
 */
export function traceHandleHasPriority(editor, pos) {
	if (!pos) return false;
	const target = traceLayerTarget(editor);
	if (!target) return false;
	const part = partAt(editor, target, pos);
	return !!part && part !== 'move';
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/** Whole font units; Shift moves in steps of 10 (DESIGN_DOC 6). */
function roundStep(delta, shift) {
	const rounded = shift ? Math.round(delta / 10) * 10 : Math.round(delta);
	return rounded || 0;
}

/** Shapes or points are selected (upstream's multi-select). */
function hasShapeSelection(editor) {
	return !!(editor?.multiSelect?.shapes?.length || editor?.multiSelect?.points?.length);
}

/** The image is now what the Resize tool holds: drop the shape and point selection. */
function clearShapeSelection(editor) {
	if (editor?.multiSelect?.points?.length) editor.multiSelect.points.clear();
	if (editor?.multiSelect?.shapes?.length) editor.multiSelect.shapes.clear();
}

function samePlacement(a, b) {
	return a.x === b.x && a.y === b.y && a.scale === b.scale;
}

/** Same stored image (a Replace changes the asset, and usually its pixel size). */
function sameImage(a, b) {
	return !!a && !!b && a.asset === b.asset && a.width === b.width && a.height === b.height;
}

/** trace with the placement (x, y, scale) of from; every other field stays. */
function withPlacement(trace, from) {
	return { ...trace, x: from.x, y: from.y, scale: from.scale };
}

/**
 * A shape drawn over the image, or a selected shape's resize handle, is under the
 * pointer, so the Resize tool gets it rather than the image body. The image's corner
 * handles still win (they are drawn on top and are the only way to resize it).
 * @param {Object} editor - ProjectEditor
 * @param {'nw' | 'ne' | 'sw' | 'se' | 'move' | false} part - from partAt
 * @param {{x: Number, y: Number}} pos - canvas pixels
 * @returns {Boolean}
 */
function shapeWinsAt(editor, part, pos) {
	if (part !== 'move') return false;
	try {
		if (editor.multiSelect?.shapes?.isOverBoundingBoxHandle?.(pos.x, pos.y)) return true;
		return !!getShapeAtLocation(pos.x, pos.y);
	} catch (error) {
		console.warn('ANY-INK trace layer: shape hit test failed', error);
		return false;
	}
}

function toFontUnits(pos, view) {
	return { x: cXsX(pos.x, view), y: cYsY(pos.y, view) };
}

function refreshHover(editor, pos) {
	const target = traceLayerTarget(editor);
	const part = target ? partAt(editor, target, pos) : false;
	traceLayerState.hover = part;
	if (part) setCursor(TRACE_CURSORS[part]);
	else updateCursor();
	editor.publish('editCanvasView', editor.view);
}

function clearHover(editor) {
	traceLayerState.hover = false;
	editor.publish('editCanvasView', editor.view);
}

function pointerPosition(event) {
	if (event.offsetX || event.offsetY) return { x: event.offsetX, y: event.offsetY };
	if (event.layerX || event.layerY) return { x: event.layerX, y: event.layerY };
	return { x: event.offsetX || 0, y: event.offsetY || 0 };
}

/** Forget hover, drag and nudge state without touching the trace (tests, page change). */
export function resetTraceLayerState() {
	traceLayerState.hover = false;
	traceLayerState.dragging = false;
	traceLayerState.start = null;
	traceLayerState.original = null;
	traceLayerState.changed = false;
	dragItem = null;
	lastDragPoint = null;
	nudgeBurst.item = null;
	nudgeBurst.original = null;
	nudgeBurst.keys.clear();
	endGesture();
}

/**
 * Document / window listeners, installed once. Runs at import (guarded) so the arrow
 * keys work before the pointer has ever crossed the canvas; safe to call again.
 */
export function installTraceLayerListeners() {
	if (listenersInstalled) return;
	if (typeof document === 'undefined' || typeof window === 'undefined') return;
	listenersInstalled = true;
	// Capture phase runs before upstream's bubble-phase key handler (events_keyboard.js),
	// so a nudged image does not also nudge the selected shapes.
	document.addEventListener('keydown', handleTraceKeyDown, true);
	document.addEventListener('keyup', handleTraceKeyUp, true);
	// A press anywhere (the item dropdown, the history panel...) may switch items: record
	// a pending nudge first. Capture phase, so it runs before the control's own handler.
	document.addEventListener('mousedown', () => commitNudge(), true);
	window.addEventListener('blur', () => commitNudge());
	window.addEventListener('anyink-page-change', () => {
		const editor = getCurrentProjectEditor();
		if (traceLayerState.dragging) cancelTraceDrag(editor);
		commitNudge(editor);
		resetTraceLayerState();
	});
}

/** Leaving the canvas clears the hover so the highlight does not stick. */
function watchCanvas(canvas) {
	if (!canvas || typeof canvas.addEventListener !== 'function') return;
	if (watchedCanvases.has(canvas)) return;
	watchedCanvases.add(canvas);
	canvas.addEventListener('mouseleave', () => {
		if (traceLayerState.dragging || !traceLayerState.hover) return;
		const editor = getCurrentProjectEditor();
		if (editor) clearHover(editor);
	});
}

try {
	installTraceLayerListeners();
} catch (error) {
	console.warn('ANY-INK trace layer: keyboard listeners not installed', error);
}
