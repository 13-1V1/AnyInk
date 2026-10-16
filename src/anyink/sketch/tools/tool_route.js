// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 (docs/SKETCH.md sections 2 and 6): the edit canvas hands its presses and keys to the sketch
	tool that is picked. events_mouse.js asks here before the guides layer, the trace layer and
	upstream's tools; events.js listens for keys before the key map does (a capture listener), so
	Escape, Enter and Backspace reach an open piece before closeDialogs, Delete or Undo. Nothing
	routes while the 'sketch' flag is off, so both modes behave exactly as before.

	A tool registers a handler (each method optional; the tools' own shape, tools/line.js):
	  down(ev) / move(ev) / up(ev) / doubleClick(ev) (or dblclick)   ev, in font units, y up:
	      { type: 'down' | 'move' | 'up' | 'double', tool, x, y, time, cx, cy, button, buttons,
	        detail, shift, ctrl, alt, snapsOff, view, editor, item, raw }
	      snapsOff: Ctrl held (SKETCH.md 2: "Hold Ctrl to turn snapping off for that click");
	      detail: the browser's click count (2 on a double-click's second press); time: ms
	  key(press) -> truthy when used   press: { type: 'down' | 'up', key, name, shift, ctrl,
	      alt, repeat, tool, editor, raw }: key as keys.js names it ('enter', 'escape',
	      'backspace', 'control', 'l'), name as the browser does ('Enter'). Key-up presses come
	      too. A key the tool used is seen by nothing else (modifier keys always go on, so Shift
	      and Ctrl stay tracked)
	  toolOn({ from }) / toolOff({ to })   the tool was picked / left (Space-pan's 'pan' is
	      neither: a pan in the middle of a piece is no tool change)
	  pointerOut()            the pointer left the canvas (hints go)
	  drawState(item)         what the draw layer paints over the letter (draw_layer.js)

	  registerSketchTool(tool, handler)   returns the undo of the registration; a name that is no
	                                      sketch tool (tool_names.js) throws
	  sketchToolHandler(tool)             the handler, or null
	  activeSketchTool(editor, { isOn })  { tool, handler } while a sketch tool is picked on a
	                                      letter's canvas with the flag on, else null (handler
	                                      may be null: a sketch tool with nothing registered
	                                      still keeps the press from Select's handler)
	  sketchPointer(type, event, { editor, at, isOn })   true when the press was the tool's
	      (type: 'down', 'move', 'up', 'double'); at: { x, y } canvas pixels (events_mouse.js
	      getMousePositionData). Ctrl, Shift and Alt come from the mouse event alone (S2
	      finalize). A middle or right press is never routed.
	  sketchKey(type, event, { editor, held, isOn, onEscape })   true when the tool used the key;
	      an Escape the tool does not use calls onEscape (a second Esc goes back to Select)
	  sketchPointerOut(editor, { isOn })
	  followSketchTools(editor)           tells handlers when their tool is picked or left
*/
import { isFeatureOn } from '../../mode/features.js';
import { pressFromEvent } from '../../mode/keys.js';
import { isSketchTool, SKETCH_TOOLS } from './tool_names.js';

/** tool name -> handler */
const handlers = new Map();

/** Keys never kept from the rest of the app: their held state is tracked there */
const MODIFIERS = Object.freeze(['shift', 'control', 'alt', 'meta']);

/** The browser's event types for the pointer methods */
const METHODS = Object.freeze({
	down: ['down'],
	move: ['move'],
	up: ['up'],
	double: ['doubleClick', 'dblclick'],
});

/** Space-pan's stand-in tool: never a tool change */
const PAN = 'pan';

/** Pub/sub id (never a substring of another) */
const SUBSCRIBER = 'anyink.sketchRoute.toolChange';

/**
 * @param {String} tool - one of SKETCH_TOOLS
 * @param {Object} handler
 * @returns {Function} undoes this registration (only while it is still the one registered)
 */
export function registerSketchTool(tool, handler) {
	if (!isSketchTool(tool)) {
		throw new Error(`sketch tools: "${tool}" is not a sketch tool (${SKETCH_TOOLS.join(', ')})`);
	}
	if (!handler || typeof handler !== 'object') {
		throw new Error(`sketch tools: the handler for "${tool}" must be an object`);
	}
	handlers.set(tool, handler);
	return () => {
		if (handlers.get(tool) === handler) handlers.delete(tool);
	};
}

/**
 * @param {String} tool
 * @returns {Object | null}
 */
export function sketchToolHandler(tool) {
	return handlers.get(tool) || null;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn]
 * @returns {{tool: String, handler: Object | null} | null}
 */
export function activeSketchTool(editor, { isOn = isFeatureOn } = {}) {
	if (!isOn('sketch')) return null;
	const tool = editor?.selectedTool;
	if (!isSketchTool(tool)) return null;
	if (!onLetterCanvas(editor)) return null;
	return { tool, handler: sketchToolHandler(tool) };
}

/**
 * @param {Object} editor
 * @returns {Boolean} a letter's (or ligature's, component's) edit canvas, never Kerning's
 */
function onLetterCanvas(editor) {
	const page = editor?.nav?.page;
	return page === 'Characters' || page === 'Ligatures' || page === 'Components';
}

/**
 * @param {String} type - 'down' | 'move' | 'up' | 'double'
 * @param {MouseEvent} event
 * @param {Object} options
 * @param {Object} options.editor
 * @param {{x: Number, y: Number}} [options.at] - canvas pixels; default the event's offset
 * @param {(name: String) => Boolean} [options.isOn]
 * @returns {Boolean} true when the press was the sketch tool's
 */
export function sketchPointer(type, event, { editor, at, isOn = isFeatureOn } = {}) {
	const active = activeSketchTool(editor, { isOn });
	if (!active || !METHODS[type]) return false;
	// a middle press pans and a right press is the browser's: only the left button draws
	if (type !== 'move' && typeof event?.button === 'number' && event.button !== 0) return false;
	const ev = pointerEventOf(type, event, { editor, at, tool: active.tool });
	if (!ev) return true;
	const name = METHODS[type].find((each) => typeof active.handler?.[each] === 'function');
	if (name) active.handler[name](ev);
	redraw(editor);
	return true;
}

/**
 * @param {String} type
 * @param {MouseEvent} event
 * @param {Object} options
 * @returns {Object | null} the tool's event, or null with no usable view
 */
export function pointerEventOf(type, event, { editor, at, tool }) {
	const view = editor?.view;
	if (!(view?.dz > 0)) return null;
	const cx = Number.isFinite(at?.x) ? at.x : Number(event?.offsetX) || 0;
	const cy = Number.isFinite(at?.y) ? at.y : Number(event?.offsetY) || 0;
	// S2 finalize: Ctrl, Shift and Alt come from the mouse event alone; a held flag left over from
	// a shortcut (Ctrl+E, then Esc) never turns the snaps off
	const ctrl = !!(event?.ctrlKey || event?.metaKey);
	return {
		type,
		tool,
		x: (cx - view.dx) / view.dz,
		y: (view.dy - cy) / view.dz,
		time: Number.isFinite(event?.timeStamp) ? event.timeStamp : Date.now(),
		cx,
		cy,
		button: typeof event?.button === 'number' ? event.button : 0,
		buttons: typeof event?.buttons === 'number' ? event.buttons : 0,
		detail: typeof event?.detail === 'number' ? event.detail : 0,
		shift: !!event?.shiftKey,
		ctrl,
		alt: !!event?.altKey,
		snapsOff: ctrl,
		view,
		editor,
		item: editor.selectedItem || null,
		raw: event,
	};
}

/**
 * @param {'down' | 'up'} type
 * @param {KeyboardEvent} event
 * @param {Object} options
 * @param {Object} options.editor
 * @param {Object} [options.held] - eventHandlerData
 * @param {(name: String) => Boolean} [options.isOn]
 * @param {Function} [options.onEscape] - an Escape the tool left alone (no piece open)
 * @returns {Boolean} true when the tool used the key (the caller stops it there)
 */
export function sketchKey(type, event, { editor, held = {}, isOn = isFeatureOn, onEscape } = {}) {
	const active = activeSketchTool(editor, { isOn });
	if (!active) return false;
	const read = pressFromEvent(event, held);
	const key = String(read.key).toLowerCase();
	const press = {
		type,
		key,
		name: String(event?.key ?? ''),
		shift: read.shift,
		ctrl: read.ctrl,
		alt: read.alt,
		repeat: !!event?.repeat,
		tool: active.tool,
		editor,
		raw: event,
	};
	const method = active.handler?.key;
	const used =
		typeof method === 'function' ? !!method.call(active.handler, press) : false;
	if (MODIFIERS.includes(key)) {
		// Ctrl turns the snaps off and Shift locks the angle: the picture changes, the key goes on
		redraw(editor);
		return false;
	}
	if (used) {
		redraw(editor);
		return true;
	}
	if (type === 'down' && key === 'escape' && !press.ctrl && typeof onEscape === 'function') {
		onEscape();
	}
	return false;
}

/**
 * @param {Object} editor
 * @param {Object} [options]
 * @param {(name: String) => Boolean} [options.isOn]
 * @returns {Boolean} true when a sketch tool heard it
 */
export function sketchPointerOut(editor, { isOn = isFeatureOn } = {}) {
	const active = activeSketchTool(editor, { isOn });
	if (!active) return false;
	if (typeof active.handler?.pointerOut === 'function') active.handler.pointerOut();
	redraw(editor);
	return true;
}

/**
 * Tells handlers when their tool is picked or left. Space-pan ('pan') is skipped both ways, so a
 * pan in the middle of a piece leaves the piece open.
 * @param {Object} editor
 */
export function followSketchTools(editor) {
	if (typeof editor?.subscribe !== 'function') return;
	let last = editor.selectedTool;
	editor.subscribe({
		topic: 'whichToolIsSelected',
		subscriberID: SUBSCRIBER,
		callback: (tool) => {
			if (tool === PAN || tool === last) return;
			const from = last;
			last = tool;
			const before = sketchToolHandler(from);
			if (typeof before?.toolOff === 'function') before.toolOff({ to: tool });
			const after = sketchToolHandler(tool);
			if (typeof after?.toolOn === 'function') after.toolOn({ from });
		},
	});
}

/** @param {Object} editor */
function redraw(editor) {
	editor?.editCanvas?.redraw?.('sketchTool');
}

/** Tests: forget every handler */
export function clearSketchToolsForTests() {
	handlers.clear();
}
