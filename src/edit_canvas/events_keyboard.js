// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { runFileCommand } from '../anyink/files/run_command.js';
import { exportWithFontCheck } from '../anyink/fontcheck/export_toast.js';
import { openFontCommand } from '../anyink/files/open_font.js';
import { isTextEntryElement } from '../anyink/history/undo_shortcut.js';
import { notifyKernPairsChanged } from '../anyink/kerning/kern_lookup.js';
import { withLandingCause } from '../anyink/mode/band.js';
import { openFineTune, openUseInWord } from '../anyink/mode/doors.js';
import { keyAction, keyOn, pressFromEvent, whereFor } from '../anyink/mode/keys.js';
import { isSimpleMode } from '../anyink/mode/mode.js';
import { toast } from '../anyink/toast/toast.js';
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../app/main.js';
import { makeElement } from '../common/dom.js';
import { closeEveryTypeOfDialog, showToast } from '../controls/dialogs/dialogs.js';
import { DisplayCanvas } from '../display_canvas/display_canvas.js';
import { TextBlockOptions } from '../display_canvas/text_block_options.js';
import { ioFont_exportDefaultFormat, ioFont_exportOTF } from '../formats_io/otf/font_export.js';
import { ioSVG_exportSVGfont } from '../formats_io/svg_font/svg_font_export.js';
import { getAdjacentItem } from '../panels/card_glyph.js';
import {
	clipboardCopy,
	currentItemFindSelectableShapeAt,
	deleteSelectedPaths,
	deleteSelectedPoints,
	moveLayer,
	selectNextPathPoint,
	selectPreviousPathPoint,
} from '../project_editor/actions.js';

import { getItemStringAdvanceWidth } from './context_characters.js';
import {
	cancelDefaultEventActions,
	eventHandlerData,
	togglePanOff,
	togglePanOn,
} from './events.js';
import { handlePasteShortcut } from './events_drag_drop_paste.js';
import { selectTool } from './tools/tools.js';

// --------------------------------------------------------------
// Key Down
// --------------------------------------------------------------

/**
 * Handles key presses
 * ANY-INK (B5, UX-BEGINNER 7.6): every key asks the one key map (src/anyink/mode/keys.js), in
 * both modes, which says what the press means here: keyAction(press, { where }). A key the
 * map has off in this mode (Simple: Ctrl+Space, Ctrl+G, Ctrl+R, U, B until the Brush, the layer
 * order keys) does nothing here, so the browser keeps it (Ctrl+R reloads, as in Chrome).
 * What changes from upstream in both modes: P picks the Point pen, E picks Edit points (B keeps
 * Edit points until the Brush lands), and Ctrl+O opens a saved font instead of a new window.
 * Holding Space or Ctrl stays a state (pan, the Ctrl redraw), as upstream reads it.
 * @param {KeyboardEvent} event - key press event
 * @returns nothing
 */
export function handleKeyPress(event) {
	// log('handleKeyPress', 'start');
	if (isFocusedOnInput()) return;
	// ANY-INK (B6 + B7 finalize): in Simple, Space on a focused button or link (the top bar's
	// "1 Letters", the logo, Undo, the letter view's "<- All letters") presses it, as on every
	// other page; it is no "hold to pan" there. All tools keeps upstream's Space.
	if (isSpaceForAControl(event)) return;

	const editor = getCurrentProjectEditor();
	const key = getKeyFromEvent(event);
	// log(`KEY ${key} from ${event.which}`);
	// log(event);

	handleSpecialKeys(key, 'down');
	const ehd = eventHandlerData;
	// log(`ehd.isCtrlDown: ${ehd.isCtrlDown}`);
	const press = pressFromEvent(event, ehd);
	const action = keyAction(press, { where: whereFor(editor?.nav?.page) });
	const id = action?.id;

	// Ctrl+S - Save / Ctrl+Shift+S - Save as
	if (id === 'save' || id === 'saveAs') {
		cancelDefaultEventActions(event);
		// ANY-INK (M6): a failed save shows in the error box, never as an unhandled rejection.
		runFileCommand(() => getCurrentProjectEditor().saveProjectFile(id === 'saveAs'));
	}

	// Ctrl+G - the SVG font file (All tools only)
	if (id === 'svgFontFile') {
		cancelDefaultEventActions(event);
		setTimeout(ioSVG_exportSVGfont, 10);
	}

	// Ctrl+E - the font file; in Simple the .otf (its File menu's one font file row), then Use
	// in Word once it has landed
	if (id === 'makeFontFile') {
		cancelDefaultEventActions(event);
		if (action.action === 'useInWord') {
			openUseInWord('key');
		} else {
			// ANY-INK (M6, DESIGN_DOC 8): no delay. The export settles its folder permission
			// or picker first, inside this keydown, then shows 'Exporting...' and builds.
			// ANY-INK (B1): then names any letters the font file can't hold, as the File menu does.
			// ANY-INK (B5 fix track): All tools makes the font's preferred format (the one it
			// was imported from); Simple always the .otf, never a format it hides (6.2 Menus).
			const otf = action.action === 'exportOtf';
			runFileCommand(exportWithFontCheck, otf ? ioFont_exportOTF : ioFont_exportDefaultFormat);
		}
	}

	// Ctrl+O - open a saved font (the work file picker)
	if (id === 'open') {
		cancelDefaultEventActions(event);
		openFontCommand({ editor });
	}

	// q
	// for dev mode clear console
	if (key === 'q' && getGlyphrStudioApp().settings.dev.mode) {
		if (ehd.isCtrlDown || ehd.isAltDown) {
			cancelDefaultEventActions(event);
			console.clear();
		}
	}

	// Ctrl+Z - Undo / Ctrl+Y or Ctrl+Shift+Z - Redo
	// ANY-INK: works on every page (settings entries can be undone from
	// the Settings page), as long as focus is not in a text field.
	// B5: an undo that lands on a page Simple hides says Undo took him there (band.js), and a
	// redo says Redo did (fix track).
	if (id === 'redo') {
		cancelDefaultEventActions(event);
		withLandingCause('redo', () => editor.history.redoState());
	} else if (id === 'undo') {
		cancelDefaultEventActions(event);
		withLandingCause('undo', () => editor.history.restoreState());
	}

	// --------------------------------------------------------------
	// Only the following stuff on Edit Canvas pages
	// --------------------------------------------------------------

	if (!editor.nav.isOnEditCanvasPage) return;
	let editMode = getEditMode();
	// log(`editMode: ${editMode}`);

	// Ctrl
	if (ehd.isCtrlDown) {
		// Show multi-selectable stuff on the canvas
		editor.editCanvas.redraw('keyboard:ctrlDown');
	}

	// Space
	if (ehd.isCtrlDown && ehd.isSpaceDown) {
		// Ctrl+Space - Hide UI (All tools only)
		if (keyOn('hideUI')) addHideUIOverlay();
	} else if (ehd.isSpaceDown) {
		// Space - Pan
		cancelDefaultEventActions(event);
		if (!ehd.isPanning) togglePanOn(event);
	}

	if (id === 'escape') {
		closeEveryTypeOfDialog();
	}

	// Ctrl+Plus - Zoom in
	if (id === 'zoomIn') {
		cancelDefaultEventActions(event);
		editor.updateViewZoom(1.1);
	}

	// Ctrl+Minus - Zoom out
	if (id === 'zoomOut') {
		cancelDefaultEventActions(event);
		editor.updateViewZoom(0.9);
	}

	// Ctrl+0 - Auto fit
	if (id === 'fitView') {
		cancelDefaultEventActions(event);
		editor.autoFitView();
	}

	// Arrows: Nudge (Shift: by 10); Ctrl+Left / Ctrl+Right - the previous / next path point.
	// The page never scrolls on an arrow here, whatever the arrow does.
	if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
		cancelDefaultEventActions(event);
	}
	if (id === 'nudge') nudge(action.arg.dx, action.arg.dy);
	if (id === 'previousPoint') selectPreviousPathPoint();
	if (id === 'nextPoint') selectNextPathPoint();

	// Ctrl+Period - Navigate to Next Item
	// Ctrl+Comma - Navigate to Previous Item
	if (id === 'nextItem' || id === 'previousItem') {
		// log(`Detected Next / Previous Item`);
		cancelDefaultEventActions(event);
		const item = getAdjacentItem(editor.selectedItem, id === 'nextItem' ? 1 : -1);
		const itemName = editor.project.getItemName(item.id, true);
		editor.selectedItemID = item.id;
		editor.history.addState(`Navigated to ${itemName}`);
	}

	if (editor.nav.page === 'Kerning') return;
	// --------------------------------------------------------------
	// Only stuff on Edit Canvas / Non Kerning pages
	// Characters, Ligatures, and Components
	// --------------------------------------------------------------

	// Tool selection: the map's tool keys (keys.js, 7.6)
	if (action?.action === 'selectTool') selectToolByKey(editor, action);

	// Del, Backspace - delete selected items
	// ANY-INK (B5 fix track, UX-BEGINNER 7.6 "Delete acts only on a picked shape or point"): with
	// nothing picked there is nothing to delete, so no Undo step ("Deleted path: undefined",
	// which a later Undo press would spend on nothing), in both modes, like an empty nudge
	if (id === 'delete') {
		cancelDefaultEventActions(event);

		if (editMode === 'pen') {
			if (editor.multiSelect.points.length) deleteSelectedPoints();
			// ANY-INK (B6 + B7 finalize): in Simple a shape picked with no point picked (the letter
			// card's Shapes list, with Edit points picked) is the one Delete takes
			else if (isSimpleMode() && editor.multiSelect.shapes.length) deleteSelectedPaths();
		} else if (editMode === 'arrow') {
			if (editor.multiSelect.shapes.length) deleteSelectedPaths();
		}
	}

	// Ctrl+A - Select / Ctrl+Shift+A - Deselect All
	if (id === 'selectAll' || id === 'deselectAll') {
		if (id === 'deselectAll') {
			// Clear all selections
			cancelDefaultEventActions(event);
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();
		} else if (editMode === 'arrow') {
			// Select all shapes
			cancelDefaultEventActions(event);
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();
			editor.multiSelect.shapes.selectAll();
		} else if (editMode === 'pen') {
			// Select all path points
			cancelDefaultEventActions(event);
			editor.multiSelect.points.clear();
			editor.multiSelect.shapes.clear();
			editor.multiSelect.points.selectAll();
			// }
		}

		// log('handleKeyPress', 'end');
		return;
	}

	// Shape Layer / Selection Actions
	// (the layer order keys are All tools only)
	const msShapes = editor.multiSelect.shapes;
	const selectedItem = editor.selectedItem;
	if (id === 'layerTop') {
		// Ctrl+Shift+] (Same as Ctrl+}) - move shape layer to the top
		// log(`DETECTED: Ctrl+Shift+] - move shape layer to the top`);
		moveLayer('top');
		editor.history.addState(`Moved layer to the top`);
		editor.publish('currentItem', editor.selectedItem);
	} else if (id === 'layerUp') {
		// Ctrl+] - move shape layer up
		// log(`DETECTED: Ctrl+] - move shape layer up`);
		moveLayer('up');
		editor.history.addState(`Moved layer up`);
		editor.publish('currentItem', editor.selectedItem);
	} else if (id === 'nextShape') {
		// ] - select next shape
		// log(`DETECTED: ] - select next shape`);
		editor.multiSelect.points.clear();
		if (msShapes.length === 0) {
			const selShape = currentItemFindSelectableShapeAt(0, false);
			if (selShape) {
				editor.multiSelect.shapes.select(selShape);
			}
		} else {
			let msShapes = editor.multiSelect.shapes.members;
			const itemShapes = selectedItem.shapes;
			msShapes.sort();
			const currentIndex = itemShapes.indexOf(msShapes.at(-1));
			const newIndex = (currentIndex + 1) % itemShapes.length;

			// Select or add to selection
			if (key === '}') editor.multiSelect.shapes.add(itemShapes[newIndex]);
			else editor.multiSelect.shapes.select(itemShapes[newIndex]);
		}
	}

	if (id === 'layerBottom') {
		// Ctrl+Shift+[ (same as Ctrl+{)- move shape layer to the bottom
		// log(`DETECTED: Ctrl+Shift+[ - move shape layer to the bottom`);
		moveLayer('bottom');
		editor.history.addState(`Moved layer to the bottom`);
		editor.publish('currentItem', editor.selectedItem);
	} else if (id === 'layerDown') {
		// Ctrl+[ - move shape layer down
		// log(`DETECTED: Ctrl+[ - move shape layer down`);
		moveLayer('down');
		editor.history.addState(`Moved layer down`);
		editor.publish('currentItem', editor.selectedItem);
	} else if (id === 'previousShape') {
		// [ - select previous shape
		// log(`DETECTED: [ - select previous shape`);
		editor.multiSelect.points.clear();
		if (msShapes.length === 0) {
			const selShape = currentItemFindSelectableShapeAt(-1, false);
			if (selShape) {
				editor.multiSelect.shapes.select(selShape);
			}
		} else {
			let msShapes = editor.multiSelect.shapes.members;
			const itemShapes = selectedItem.shapes;
			msShapes.sort();
			const currentIndex = itemShapes.indexOf(msShapes[0]);
			let newIndex = currentIndex - 1;
			if (newIndex < 0) newIndex = itemShapes.length - 1;

			// Select or add to selection
			if (key === '{') editor.multiSelect.shapes.add(itemShapes[newIndex]);
			else editor.multiSelect.shapes.select(itemShapes[newIndex]);
		}
	}

	// Ctrl+C - copy
	// ANY-INK (M7): clipboardCopy also leaves a note on the system clipboard, so a photo
	// copied later wins a Ctrl+V and one copied earlier never does (clipboard_note.js)
	if (id === 'copy') {
		cancelDefaultEventActions(event);
		clipboardCopy();
	}

	// Ctrl+V - paste
	// ANY-INK (M7 fix track): copied shapes paste unless an image was copied after them
	// (events_drag_drop_paste.js handlePasteShortcut); otherwise the image becomes the trace.
	if (id === 'paste') {
		handlePasteShortcut(event);
	}

	// Ctrl+R - round
	if (id === 'round') {
		cancelDefaultEventActions(event);
		if (editMode === 'pen') {
			// log(`Rounding all points`);
			editor.multiSelect.points.roundAll(0);
			editor.history.addState(
				`Rounded path point and handle position values for ${editor.multiSelect.points.length} path point(s)`
			);
			editor.publish('currentItem', editor.selectedItem);
			// refreshPanel();
			showToast('Values were rounded for the selected path points.');
		}

		if (editMode === 'arrow') {
			// log(`Rounding all shapes`);
			editor.multiSelect.shapes.roundAll(0);
			editor.history.addState(
				`Rounded path point and handle position values for ${editor.multiSelect.shapes.length} shape(s)`
			);
			editor.publish('currentItem', editor.selectedItem);
			// refreshPanel();
			showToast('Values were rounded for the selected shapes.');
		}
	}
	// log('handleKeyPress', 'end');
}

/**
 * ANY-INK (B5, UX-BEGINNER 7.6): a tool key. Picks the tool as upstream did (on every press, so
 * pressing the current tool's key still clears what upstream clears). In Simple it says which
 * tool, when the tool changed ("Switched to Rectangle (R)"); once the letter view lands, a tool
 * that lives inside Fine-tune opens Fine-tune too (doors.js).
 * @param {Object} editor - ProjectEditor
 * @param {Object} action - keyAction's result: { tool, toast, opensFineTune }
 */
function selectToolByKey(editor, action) {
	const before = editor.selectedTool;
	selectTool(action.tool);
	if (action.opensFineTune) openFineTune(action.tool);
	const changed = before !== action.tool && editor.selectedTool === action.tool;
	if (action.toast && changed) toast(action.toast.key, action.toast.vars, action.toast.options);
}

/**
 * Converts Key press IDs to actual characters
 * @param {KeyboardEvent} event - key press event
 * @returns {String} - character equivalent for the key ID
 */
export function getKeyFromEvent(event) {
	// log(`getKeyFromEvent`, 'start');
	// log(event);
	// log(`event.key: ${event.key}`);

	/*
		Keys used above. Names should conform to lowercase versions of event.key values:
		https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
		'Meta' keys on Mac (Option or Command) are converted to windows 'Control'
		'Space', 'Plus' and 'Minus' keywords are added for convenience.
	*/

	let result = event.key;
	if (result.length === 1) result = result.toLocaleLowerCase();
	if (result === 'Meta') result = 'Control';
	if (result === '-') result = 'Minus';
	if (result === '+') result = 'Plus';
	if (result === ' ') result = 'Space';

	// log(`result: ${result}`);
	// log(`getKeyFromEvent`, 'end');
	return result;
}

/**
 * Moves the selected thing a small amount, depending
 * on if the shift key is down or not.
 * @param {Number} dx - x value to nudge
 * @param {Number} dy - y value to nudge
 * @returns nothing
 */
function nudge(dx, dy) {
	// log(`events_keyboard Nudge`, 'start');
	// log(`dx: ${dx}`);
	// log(`dy: ${dy}`);

	const editor = getCurrentProjectEditor();
	const ehd = eventHandlerData;
	if (ehd.isCtrlDown) return;

	let multiplier = ehd.isShiftDown ? 10 : 1;

	let mx = dx * multiplier;
	let my = dy * multiplier;
	let editMode = getEditMode();
	// log(`editMode: ${editMode}`);

	if (editMode === 'kern') {
		let delta = mx || my;
		editor.selectedKernGroup.value += delta;
		editor.history.addState(`Nudged kern group ${editor.selectedKernGroupID} by ${delta}`);
		editor.publish('currentKernGroup', editor.selectedKernGroup);
		// ANY-INK: the preview strip and pair view re-flow from the kerning lookup
		notifyKernPairsChanged(editor, {
			groupID: editor.selectedKernGroupID,
			value: editor.selectedKernGroup.value,
		});
		editor.editCanvas.redraw('keyboard:nudge');
	} else if (editMode === 'arrow') {
		const msShapes = editor.multiSelect.shapes;
		// ANY-INK: nothing selected means nothing to nudge (and no history entry)
		if (!msShapes.length) return;
		msShapes.updateShapePosition(mx, my);
		editor.history.addState(`Nudged shape(s) by ${mx}, ${my}`);
		editor.publish('currentItem', editor.selectedItem);
		editor.editCanvas.redraw('keyboard:nudge');
	} else if (editMode === 'pen') {
		const msPoints = editor.multiSelect.points;
		msPoints.members.forEach((point) => point.updatePathPointPosition('p', mx, my));
		if (msPoints.members.length > 1) {
			editor.history.addState(`Nudged path points by ${mx}, ${my}`);
			editor.publish('currentItem', editor.selectedItem);
		} else if (msPoints.singleton) {
			editor.history.addState(`Nudged path point by ${mx}, ${my}`);
			editor.publish('currentPathPoint', msPoints.singleton);
		}
		editor.editCanvas.redraw('keyboard:nudge');
	}
	// log(`events_keyboard Nudge`, 'end');
}

/**
 * Returns the tool name that corresponds to the selected tool
 * @returns {String} - name of the applicable tool
 */
function getEditMode() {
	const editor = getCurrentProjectEditor();
	if (editor.nav.page === 'Kerning') return 'kern';
	if (editor.selectedTool === 'resize') return 'arrow';
	if (editor.selectedTool === 'pathEdit') return 'pen';
}

function addHideUIOverlay() {
	const editor = getCurrentProjectEditor();
	if (editor.nav.page === 'Kerning') return;

	if (!document.getElementById('hideUI')) {
		//const scale = this.options.fontSize / this.project.totalVertical;
		const fontSize = editor.project.totalVertical * editor.view.dz;
		let text = editor.selectedItem.char;
		if (editor.project.settings.app.contextCharacters.showCharacters) {
			text = editor.selectedItem.contextCharacters;
		}
		const advance = getItemStringAdvanceWidth(text) + 100;
		const windowSize = document.body.getBoundingClientRect();
		const width = advance * editor.view.dz;
		const offsetTop = (windowSize.height - fontSize) * 0.5;
		const offsetLeft = (windowSize.width - width) * 0.5;

		const hideUI = makeElement({
			tag: 'div',
			id: 'hideUI',
			style: `
				display: block;
				position: absolute;
				z-index: 3000;
				background-color: var(--canvas-bg);
				top: 0;
				left: 0;
				width: 100vw;
				height: 100vh;
				overflow-x: hidden;
				overflow-y: hidden;
			`,
		});
		const hideUIOptions = new TextBlockOptions({
			fontSize: fontSize,
			text: text,
			pageWidth: width,
		});
		const hideUIDisplayCanvas = new DisplayCanvas(hideUIOptions);
		hideUIDisplayCanvas.style.backgroundColor = 'var(--canvas-bg)';
		hideUIDisplayCanvas.style.position = 'absolute';
		hideUIDisplayCanvas.style.top = offsetTop + 'px';
		hideUIDisplayCanvas.style.left = offsetLeft + 'px';
		hideUI.appendChild(hideUIDisplayCanvas);
		document.body.appendChild(hideUI);
	}
}

// --------------------------------------------------------------
// Key Up
// --------------------------------------------------------------

/**
 * Handles the key-up event
 * @param {KeyboardEvent} event - key up event
 * @returns nothing
 */
export function handleKeyUp(event) {
	// log(`handleKeyup`, 'start');
	if (isFocusedOnInput()) return;

	let key = getKeyFromEvent(event);
	// log(`KEY ${key} from ${event.which}`);
	// log(event);

	const editor = getCurrentProjectEditor();
	const ehd = eventHandlerData;
	const hideUI = document.getElementById('hideUI');
	// log('ehd.lastTool: ' + ehd.lastTool);

	handleSpecialKeys(key, 'up');
	if (!editor.nav.isOnEditCanvasPage) return;

	// Ctrl
	if (key === 'Control' && !ehd.isCtrlDown) {
		// updateCursor();
		editor.editCanvas.redraw('keyboard:CtrlUp');
		if (hideUI) document.body.removeChild(hideUI);
	}

	// Space
	// ANY-INK (B5): where Ctrl+Space is off (Simple), letting it go changes nothing either; All
	// tools keeps upstream's release as it was
	if (key === 'Space' && !ehd.isSpaceDown && (ehd.isPanning || keyOn('hideUI'))) {
		if (hideUI) document.body.removeChild(hideUI);
		// if (ehd.isMouseOverCanvas) togglePanOff(event);
		togglePanOff(event);
	}

	// log(`handleKeyup`, 'end');
}

// --------------------------------------------------------------
// Special Keys
// --------------------------------------------------------------

/**
 * Sets or removes the appropriate event handler settings, given some
 * special key (Ctrl, Space, Shift, Alt).
 * @param {String} key - name of the special key
 * @param {String} keyDirection - up or down
 */
function handleSpecialKeys(key, keyDirection) {
	// log(`handleSpecialKeys`, 'start');
	// log(`key: ${key}`);
	// log(`keyDirection: ${keyDirection}`);

	const ehd = eventHandlerData;

	// Maybe not strong equals here?
	if (keyDirection === 'down') {
		if (key === 'Control') {
			ehd.isCtrlDown = true;
			// log(`setting isCtrlDown to true`);
		}
		if (key === 'Space') {
			ehd.isSpaceDown = true;
			// log(`setting isSpaceDown to true`);
		}
		if (key === 'Shift') {
			ehd.isShiftDown = true;
			// log(`setting isShiftDown to true`);
		}
		if (key === 'Alt') {
			ehd.isAltDown = true;
			// log(`setting isAltDown to true`);
		}
	}

	if (keyDirection === 'up') {
		if (key === 'Control') {
			ehd.isCtrlDown = false;
			// log(`setting isCtrlDown to false`);
		}
		if (key === 'Space') {
			ehd.isSpaceDown = false;
			// log(`setting isSpaceDown to false`);
		}
		if (key === 'Shift') {
			ehd.isShiftDown = false;
			eventHandlerData.initialPoint = false;
			// log(`setting isShiftDown to false`);
		}
		if (key === 'Alt') {
			ehd.isAltDown = false;
			// log(`setting isAltDown to false`);
		}
	}

	// log(`handleSpecialKeys`, 'end');
}

/**
 * Ensures an input element doesn't have it's key inputs
 * stolen by the keyboard event handlers
 * (ANY-INK: also covers contenteditable regions, but not the edit canvas)
 * @returns {Boolean}
 */
function isFocusedOnInput() {
	return isTextEntryElement(document.activeElement);
}

/** What Space presses when it has the focus (UX-BEGINNER.md 4.0 Top bar, principle 7) */
const PRESSABLE =
	'button, a[href], summary, fancy-button, [role="button"], [role="link"], [role="menuitem"], [role="switch"], input[type="checkbox"], input[type="radio"]';

/**
 * ANY-INK (B6 + B7 finalize): Space with a button or a link focused from the keyboard, outside
 * the edit canvas, in Simple: the browser presses it. A button focused by a mouse click (Chrome
 * keeps the focus on it, with no focus ring) is left out, so Space-drag still pans right after
 * a click on Undo or a tool, and never presses that button a second time.
 * @param {KeyboardEvent} event
 * @returns {Boolean}
 */
function isSpaceForAControl(event) {
	if (!isSimpleMode() || getKeyFromEvent(event) !== 'Space') return false;
	const focused = document.activeElement;
	if (!focused || focused === document.body || typeof focused.closest !== 'function') return false;
	if (focused.closest('edit-canvas, #editor-page__edit-canvas')) return false;
	if (!focused.closest(PRESSABLE)) return false;
	return focusedByKeyboard(focused);
}

/**
 * @param {Element} element
 * @returns {Boolean} it shows the keyboard's focus ring (:focus-visible); true where the browser
 *   can't say (an older engine), so the press still reaches the button
 */
function focusedByKeyboard(element) {
	try {
		return element.matches(':focus-visible');
	} catch {
		return true;
	}
}
