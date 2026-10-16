// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { isTextEntryElement } from '../anyink/history/undo_shortcut.js';
import { attachNib, Tool_Nib } from '../anyink/nib/nib_tool.js';
import { installSketchTools } from '../anyink/sketch/tools/install.js';
import { watchSketchMode } from '../anyink/sketch/tools/mode_watch.js';
import { menuOrDialogOpen } from '../anyink/sketch/tools/menu_open.js';
import {
	activeSketchTool,
	followSketchTools,
	sketchKey,
	sketchPointerOut,
} from '../anyink/sketch/tools/tool_route.js';
import { DROP_HINT } from '../anyink/trace/paste_drop.js';
import { getCurrentProjectEditor } from '../app/main.js';
import { showToast } from '../controls/dialogs/dialogs.js';
import { setCursor, updateCursor } from './cursors.js';
import { handleDropSVGonEditCanvas, handlePasteOnPage } from './events_drag_drop_paste.js';
import { handleKeyPress, handleKeyUp } from './events_keyboard.js';
import { handleCanvasDoubleClick, handleMouseEvents, handleMouseWheel } from './events_mouse.js';
import { Tool_Kern } from './tools/kern.js';
import { Tool_NewBasicPath } from './tools/new_basic_path.js';
import { Tool_NewPath } from './tools/new_path.js';
import { Tool_Pan } from './tools/pan.js';
import { Tool_PathAddPoint } from './tools/path_add_point.js';
import { Tool_PathEdit } from './tools/path_edit.js';
import { Tool_Resize } from './tools/resize.js';
import { selectTool } from './tools/tools.js';

// --------------------------------------------------------------
// Events - shared between Mouse and Keyboard
// --------------------------------------------------------------

export let eventHandlerData = {
	currentToolHandler: {},
	newBasicPathMaxes: {},
	newBasicPath: {},
	selecting: false,
	mousePosition: {},
	/** @type {Object | Boolean} */
	initialPoint: false,
	handle: '',
	rotationStartCenter: {},
	rotationStartMaxesTopY: -100,
	rotateHandleHeight: 40,
	isMouseOverCanvas: false,
	corner: false,
	toolHandoff: false,
	lastX: -100,
	lastY: -100,
	firstX: -100,
	firstY: -100,
	undoQueueHasChanged: false,
	lastTool: false,
	isSpaceDown: false,
	isPanning: false,
	isShiftDown: false,
	isCtrlDown: false,
	isAltDown: false,
	hoverPoint: {},
	multi: false,
	canvasHotspots: [],
};

/**
 * Sets up the event listeners for a given edit canvas,
 * and creates tools for each type of event handler.
 * @param {Element} canvas
 */
export function initEventHandlers(canvas) {
	// log('initEventHandlers', 'start');
	// log(canvas);
	const editor = getCurrentProjectEditor();

	editor.eventHandlers.tool_pan = new Tool_Pan();
	editor.eventHandlers.tool_addRectOval = new Tool_NewBasicPath();
	editor.eventHandlers.tool_resize = new Tool_Resize();
	editor.eventHandlers.tool_addPath = new Tool_NewPath();
	editor.eventHandlers.tool_pathEdit = new Tool_PathEdit();
	editor.eventHandlers.tool_pathAddPoint = new Tool_PathAddPoint();
	editor.eventHandlers.tool_kern = new Tool_Kern();
	// ANY-INK (B8, D-014): the Brush is the one pointer-event tool; its mouse side stays quiet
	editor.eventHandlers.tool_nib = new Tool_Nib();

	// Mouse Event Listeners
	canvas.addEventListener('mousedown', handleMouseEvents, false);
	canvas.addEventListener('mousemove', handleMouseEvents, false);
	canvas.addEventListener('mouseup', handleMouseEvents, false);
	canvas.addEventListener('mouseover', handleMouseOverCanvas);
	canvas.addEventListener('mouseout', handleMouseLeaveCanvas);
	canvas.addEventListener('wheel', handleMouseWheel, { passive: false, capture: false });
	canvas.addEventListener('drop', handleDropSVGonEditCanvas, false);
	canvas.addEventListener('dragenter', handleDragEnterCanvas, false);
	canvas.addEventListener('dragover', cancelDefaultEventActions, false);
	canvas.addEventListener('drag', cancelDefaultEventActions, false);
	// ANY-INK (B8, D-014): pointer listeners for the Brush only (src/anyink/nib/nib_tool.js); a
	// Brush press cancels its pointerdown, so the mouse events above never see it
	attachNib(canvas);
	// ANY-INK (S2, SKETCH.md 2): a double-click finishes a sketch piece (sketch/tools/tool_route.js;
	// nothing happens with no sketch tool picked)
	canvas.addEventListener('dblclick', handleCanvasDoubleClick, false);
	// ANY-INK (S2 fix track): a right press finishes a piece; the browser menu never shows over
	// the letter while a sketch tool is picked
	canvas.addEventListener('contextmenu', handleCanvasContextMenu, false);
	installSketchTools();
	followSketchTools(editor);
	// ANY-INK (S2 integration): a mode change finishes an open piece and leaves a sketch tool the
	// new mode doesn't show for Select (once a page)
	watchSketchMode({ editorOf: getCurrentProjectEditor, pick: selectTool });

	// Document Key Listeners
	// ANY-INK (S2): the picked sketch tool hears a key first (capture), so Escape, Enter and
	// Backspace reach an open piece before the key map's closeDialogs, Delete and Undo
	document.addEventListener('keydown', handleSketchKeyDown, true);
	document.addEventListener('keyup', handleSketchKeyUp, true);
	document.addEventListener('keydown', handleKeyPress, false);
	document.addEventListener('keyup', handleKeyUp, false);
	// ANY-INK (M7 finalize): Chrome sends a paste to the focused element, which is the page
	// body while editing, so the page listens too (text fields keep their own pastes)
	document.addEventListener('paste', handlePasteOnPage, false);
	// log(`initEventHandlers`, 'end');
}

/**
 * Stops default event stuff from happening,
 * so we can do custom stuff.
 * @param {Event} event - input event
 * @returns {false} - as per event spec
 */
export function cancelDefaultEventActions(event) {
	// log(`cancelDefaultEventActions`, 'start');
	// log(event);
	if (event.preventDefault) event.preventDefault();
	if (event.stopPropagation) event.stopPropagation();
	// log(`cancelDefaultEventActions`, 'end');
	return false;
}

/**
 * Do stuff when the mouse goes over the Edit Canvas
 */
function handleMouseOverCanvas() {
	// log('handleMouseOverCanvas', 'start');
	eventHandlerData.isMouseOverCanvas = true;
	updateCursor();
	// log('handleMouseOverCanvas', 'end');
}

/**
 * Do stuff when the mouse leaves the Edit Canvas
 */
function handleMouseLeaveCanvas() {
	// log('handleMouseLeaveCanvas', 'start');
	eventHandlerData.isMouseOverCanvas = false;
	// ANY-INK (S2): a sketch tool's hints go with the pointer
	sketchPointerOut(getCurrentProjectEditor());
	// Fixes a Chrome cursor problem
	document.onselectstart = function () {};
	updateCursor();
	// log('handleMouseLeaveCanvas', 'end');
}

/**
 * ANY-INK (S2, SKETCH.md 2): a key for the picked sketch tool, before the key map. A key the tool
 * uses stops here; an Escape it leaves (no piece open) also goes back to Select, then on to the
 * key map (closeDialogs). Typing in a field is never the tool's, and (S2 fix track) neither is a
 * key while a menu, dropdown or dialog is open: Esc closes the Menu, the piece stays open and
 * the tool stays picked.
 * @param {KeyboardEvent} event
 */
export function handleSketchKeyDown(event) {
	syncHeldKeys(event);
	routeSketchKey('down', event);
}

/**
 * ANY-INK (S2 fix track): upstream tracks Ctrl, Shift and Alt by their own key-down and key-up,
 * so a key-up a dialog ate (Ctrl+E, then Esc: photo_dialog.js blocks keys at window capture) left
 * Ctrl "held" for good: L read as Ctrl+L and every sketch click had snapping off. Every key and
 * mouse event carries the true state; each one sets the held flags right (the modifier's own
 * key-down still sets its flag as before).
 * @param {KeyboardEvent | MouseEvent} event
 */
export function syncHeldKeys(event) {
	if (!event || typeof event.ctrlKey !== 'boolean') return;
	const key = event.key;
	if (key !== 'Control' && key !== 'Meta') {
		eventHandlerData.isCtrlDown = !!(event.ctrlKey || event.metaKey);
	}
	if (key !== 'Shift') eventHandlerData.isShiftDown = !!event.shiftKey;
	if (key !== 'Alt') eventHandlerData.isAltDown = !!event.altKey;
}

/**
 * Key-up, before the key map. S2 fix track: Space let go after a Space-pan gives the tool back
 * even when the pan's mouse-up came first (releaseSpacePan).
 * @param {KeyboardEvent} event
 */
export function handleSketchKeyUp(event) {
	syncHeldKeys(event);
	releaseSpacePan(event);
	routeSketchKey('up', event);
}

/**
 * ANY-INK (S2 fix track): upstream's Tool_Pan.mouseup clears isPanning, and Simple's Space
 * key-up gave the tool back only while isPanning was set, so a pan whose mouse was let go first
 * left the tool on 'pan' (no tool picked; a sketch piece stranded). Space up with Space-pan's
 * tool still waiting gives it back. Upstream's own key-up then finds nothing left to do
 * (togglePanOff's guard).
 * @param {KeyboardEvent} event
 */
export function releaseSpacePan(event) {
	const isSpace = event?.code === 'Space' || event?.key === ' ' || event?.key === 'Spacebar';
	if (!isSpace || isTextEntryElement(document.activeElement)) return;
	const editor = getCurrentProjectEditor();
	if (!eventHandlerData.lastTool || eventHandlerData.isPanning) return;
	if (editor?.selectedTool !== 'pan') return;
	togglePanOff(event);
}

/**
 * ANY-INK (S2 fix track): the browser's menu stays away from the letter while a sketch tool is
 * picked (a right press finishes the open piece, events_mouse.js).
 * @param {MouseEvent} event
 */
export function handleCanvasContextMenu(event) {
	if (activeSketchTool(getCurrentProjectEditor())) event.preventDefault();
}

/**
 * @param {'down' | 'up'} type
 * @param {KeyboardEvent} event
 */
function routeSketchKey(type, event) {
	if (isTextEntryElement(document.activeElement)) return;
	if (menuOrDialogOpen(document)) return;
	const used = sketchKey(type, event, {
		editor: getCurrentProjectEditor(),
		held: eventHandlerData,
		onEscape: () => selectTool('resize'),
	});
	if (used) {
		event.preventDefault();
		event.stopPropagation();
	}
}

/**
 * Do stuff when the user drags a file over the Edit Canvas
 * ANY-INK (M7 fix track): photos are welcome too; the hint says what each kind of file does.
 * @param {DragEvent} event - drag event
 */
function handleDragEnterCanvas(event) {
	event.preventDefault();
	event.stopPropagation();
	showToast(DROP_HINT);
}

/**
 * Switch the Edit Canvas to pan mode
 * @param {Event} event - mouse event
 */
export function togglePanOn(event) {
	const editor = getCurrentProjectEditor();
	editor.eventHandlers.tool_pan.mousedown(event);
	// ANY-INK (S2 fix track): a held Space repeats its key-down after the pan's mouse-up cleared
	// isPanning; the tool to give back stays the one picked before the pan, never 'pan' itself
	if (editor.selectedTool !== 'pan' || !eventHandlerData.lastTool) {
		eventHandlerData.lastTool = editor.selectedTool;
	}
	editor.selectedTool = 'pan';
	eventHandlerData.isPanning = true;
	editor.publish('whichToolIsSelected', editor.selectedTool);
	setCursor('move');
}

/**
 * Switch the Edit Canvas out of pan mode
 * @param {Event} event - mouse event
 */
export function togglePanOff(event) {
	const editor = getCurrentProjectEditor();
	// ANY-INK (S2 fix track): already given back (releaseSpacePan): never leave "no tool" picked
	if (!eventHandlerData.lastTool && editor.selectedTool !== 'pan' && editor.nav.page !== 'Kerning') {
		eventHandlerData.isPanning = false;
		return;
	}
	editor.eventHandlers.tool_pan.mouseup(event);
	editor.selectedTool = editor.nav.page === 'Kerning' ? 'kern' : eventHandlerData.lastTool;
	eventHandlerData.lastTool = false;
	eventHandlerData.isPanning = false;
	updateCursor();
	editor.publish('whichToolIsSelected', editor.selectedTool);
}
