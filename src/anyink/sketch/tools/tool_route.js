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

	S4 (docs/SKETCH.md section 5): Select on a sketch. In Simple with the flag on, Select ('resize',
	V and E) on a letter whose sketch is live (sketched.js hasSketchPieces: not set aside, with a
	piece) is Select on the sketch: activeSketchTool answers { tool: SELECT_TOOL, handler } with
	the handler select_tool.js registers, so keys (Delete, the arrows, Esc) reach it first, and
	upstream's Select never touches the built shapes (which would set the sketch aside). With no
	live sketch, in All tools, or with the flag off, Select is upstream's as before.
	  SELECT_TOOL                         'sketchSelect': the name Select on a sketch goes by here
	  registerSketchSelect(handler)       returns the undo of the registration
	  sketchSelectHandler()
	  sketchSelectApplies(editor, { isOn, simple })   true while Select is on a live sketch
	  sketchSelectPointer(type, event, { editor, at, guides, cursor, isOn, simple })   true when
	      Select on the sketch took the mouse event. A left press on nothing of the sketch goes
	      to the guides layer first (guides: its handler; Move the guide lines and the letter's
	      edges keep working), then starts a window; moves and the release follow whoever took
	      the press; a right or middle press is never taken. cursor(name) sets the pointer's look.
*/
import { isFeatureOn } from '../../mode/features.js';
import { pressFromEvent } from '../../mode/keys.js';
import { isSimpleMode } from '../../mode/mode.js';
import { hasSketchPieces } from '../sketched.js';
import { isSketchTool, SKETCH_TOOLS } from './tool_names.js';

/** S4: Select on a sketch, as this file names it */
export const SELECT_TOOL = 'sketchSelect';

/** S4: Select on a sketch's handler (select_tool.js) */
let selectHandler = null;

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
export function activeSketchTool(editor, { isOn = isFeatureOn, simple } = {}) {
	if (!isOn('sketch')) return null;
	const tool = editor?.selectedTool;
	if (tool === 'resize') {
		return sketchSelectApplies(editor, { isOn, simple })
			? { tool: SELECT_TOOL, handler: selectHandler }
			: null;
	}
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
	// S4: Select on a sketch takes its presses through sketchSelectPointer; only the double-click
	if (active.tool === SELECT_TOOL && type !== 'double') return false;
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
			const before = from === 'resize' ? selectHandler : sketchToolHandler(from);
			if (typeof before?.toolOff === 'function') before.toolOff({ to: tool });
			const after = tool === 'resize' ? selectHandler : sketchToolHandler(tool);
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
	selectHandler = null;
}

// --------------------------------------------------------------
// S4: Select on a sketch
// --------------------------------------------------------------

/**
 * @param {Object} handler - select_tool.js's
 * @returns {Function} undoes this registration (only while it is still the one registered)
 */
export function registerSketchSelect(handler) {
	if (!handler || typeof handler !== 'object') {
		throw new Error('sketch tools: the Select handler must be an object');
	}
	selectHandler = handler;
	return () => {
		if (selectHandler === handler) selectHandler = null;
	};
}

/** @returns {Object | null} */
export function sketchSelectHandler() {
	return selectHandler;
}

/**
 * @param {Object} editor
 * @param {{isOn?: Function, simple?: Boolean}} [options]
 * @returns {Boolean}
 */
export function sketchSelectApplies(editor, { isOn = isFeatureOn, simple } = {}) {
	if (!selectHandler || !isOn('sketch')) return false;
	if ((simple ?? isSimpleMode()) !== true) return false;
	if (editor?.selectedTool !== 'resize' || !onLetterCanvas(editor)) return false;
	let item = null;
	try {
		item = editor.selectedItem;
	} catch {
		return false;
	}
	return hasSketchPieces(item, { isOn });
}

/**
 * @param {'down' | 'move' | 'up'} type
 * @param {MouseEvent} event
 * @param {Object} options
 * @returns {Boolean} true when Select on the sketch took the event
 */
export function sketchSelectPointer(
	type,
	event,
	{ editor, at, guides, cursor, isOn = isFeatureOn, simple } = {}
) {
	if (!METHODS[type] || type === 'double') return false;
	if (!sketchSelectApplies(editor, { isOn, simple })) return false;
	if (type === 'down' && typeof event?.button === 'number' && event.button !== 0) return false;
	const handler = selectHandler;
	const ev = pointerEventOf(type, event, { editor, at, tool: SELECT_TOOL });
	if (!ev) return true;
	const toGuides = () => (typeof guides === 'function' ? !!guides(event) : false);
	const busy = typeof handler.busy === 'function' && handler.busy();
	const hits = () => typeof handler.hits === 'function' && handler.hits(ev);
	if (type === 'down') {
		if (hits() || !toGuides()) handler.down?.(ev);
	} else if (type === 'move') {
		if (busy || hits()) handler.move?.(ev);
		else if (toGuides()) handler.pointerOut?.();
		else handler.move?.(ev);
	} else if (busy || !toGuides()) {
		handler.up?.(ev);
	}
	if (typeof cursor === 'function' && typeof handler.cursor === 'function') {
		const look = handler.cursor();
		if (look) cursor(look);
	}
	redraw(editor);
	return true;
}
