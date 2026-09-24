// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { isTextEntryElement } from '../anyink/history/undo_shortcut.js';
import {
	hasCopiedShapes,
	noteWindowBlur,
	systemClipboardMayBeNewer,
} from '../anyink/trace/clipboard_note.js';
import {
	classifyDroppedFile,
	CLIPBOARD_BLOCKED_HINT,
	clipboardReadState,
	DROP_HINT,
	isTraceableItem,
	makePasteGate,
	NOT_TRACEABLE_HINT,
	PASTE_FILE_HINT,
	PASTE_TEXT_HINT,
	readClipboardImage,
	summarizePaste,
} from '../anyink/trace/paste_drop.js';
import { importTraceImage, isTraceImageFile } from '../anyink/trace/trace_import.js';
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';
import { showToast } from '../controls/dialogs/dialogs.js';
import { ioSVG_convertSVGTagsToGlyph } from '../formats_io/svg_outlines/svg_outline_import.js';
import { clipboardPaste, copyShapesFromTo } from '../project_editor/actions.js';
import { cancelDefaultEventActions } from './events.js';

/**
 * Given some SVG code, parse it into Glyphr Studio shapes, and
 * add it to the currently selected item.
 * @param {String} svgData - code imported from dropped file
 * @param {String} sourceText - title for the stuff that was imported
 */
export function importSVGtoCurrentItem(svgData, sourceText = 'SVG') {
	// log(`importSVGtoCurrentItem`, 'start');

	const tempGlyph = ioSVG_convertSVGTagsToGlyph(svgData);

	if (tempGlyph && tempGlyph.shapes.length) {
		// Flip
		tempGlyph.flipNS();
		tempGlyph.reverseWinding();

		// Add new Glyph Shapes
		const editor = getCurrentProjectEditor();
		const newShapes = copyShapesFromTo(tempGlyph, editor.selectedItem);
		// log('tempGlyph');
		// log(tempGlyph);

		// log(`updated item glyph`);
		// log(editor.selectedItem);

		editor.history.addState('Imported SVG to glyph ' + editor.selectedItem.name);
		const msShapes = editor.multiSelect.shapes;
		msShapes.clear();
		newShapes.forEach((shape) => msShapes.add(shape));

		const appSettings = getCurrentProject().settings.app;
		if (appSettings.autoSideBearingsOnSVGDragDrop > -1) {
			const sbValue = appSettings.autoSideBearingsOnSVGDragDrop;
			msShapes.setShapePosition(sbValue);
			editor.selectedItem.advanceWidth = msShapes.maxes.width + sbValue * 2;
		} else if (getCurrentProject().settings.app.moveShapesOnSVGDragDrop) {
			msShapes.setShapePosition(0, msShapes.maxes.height);
		}

		editor.publish('currentItem', editor.selectedItem);
		showToast(`Imported ${tempGlyph.shapes.length} shapes from ${sourceText}`);
	} else {
		// showToast('Could not import pasted SVG code.');
	}
	// log(`importSVGtoCurrentItem`, 'end');
}

// ANY-INK (M7): one gate for the whole page; see src/anyink/trace/paste_drop.js.
const pasteGate = makePasteGate();

// --------------------------------------------------------------
// ANY-INK (M7 fix track, finalize): which clipboard a Ctrl+V means
// --------------------------------------------------------------
// The rule and its state live in src/anyink/trace/clipboard_note.js: copied shapes win
// until the window loses focus after a copy whose note reached the system clipboard; then
// an image there is newer and becomes the trace image.
export { noteShapeCopy, SHAPES_ON_CLIPBOARD_TEXT } from '../anyink/trace/clipboard_note.js';

try {
	if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
		window.addEventListener('blur', () => {
			try {
				noteWindowBlur(getCurrentProjectEditor());
			} catch {
				noteWindowBlur(null);
			}
		});
	}
} catch (error) {
	console.warn('ANY-INK paste: focus listener not installed', error);
}

/**
 * Ctrl+V on the edit canvas (events_keyboard.js). Copied shapes paste right away when
 * nothing newer can be on the system clipboard; otherwise the paste waits for the
 * browser's paste event (or reads the clipboard) and pasteDecision picks.
 * @param {KeyboardEvent} event - the Ctrl+V keydown
 */
export function handlePasteShortcut(event) {
	const editor = getCurrentProjectEditor();
	if (hasCopiedShapes(editor) && !systemClipboardMayBeNewer(editor)) {
		cancelDefaultEventActions(event);
		clipboardPaste();
		return;
	}
	handlePasteSVGonEditCanvas(event);
}

/**
 * What a paste does, given the system clipboard.
 * @param {Object} editor - ProjectEditor
 * @param {{image: File | Blob | null, text: Boolean, files?: Number, denied?: Boolean}} pasted
 * @returns {'image' | 'shapes' | 'denied' | 'files' | 'text' | 'nothing'}
 */
export function pasteDecision(editor, pasted) {
	const shapes = hasCopiedShapes(editor);
	if (pasted?.image && (!shapes || systemClipboardMayBeNewer(editor))) return 'image';
	if (shapes) return 'shapes';
	if (pasted?.denied) return 'denied';
	if (pasted?.files) return 'files';
	if (pasted?.text) return 'text';
	return 'nothing';
}

function runPaste(pasted) {
	const decision = pasteDecision(getCurrentProjectEditor(), pasted);
	if (decision === 'image') sendImageToTrace(pasted.image);
	else if (decision === 'shapes') clipboardPaste();
	else if (decision === 'denied') showToast(CLIPBOARD_BLOCKED_HINT, 6000);
	else if (decision === 'files') showToast(PASTE_FILE_HINT);
	else if (decision === 'text') showToast(PASTE_TEXT_HINT);
}

/**
 * The async clipboard read, for a Ctrl+V that no paste event followed. With shapes copied
 * it reads only when Chrome already allows it: the shapes are the likely paste, and a
 * permission prompt between Ctrl+V and the shapes would be in the way.
 * @param {Object} editor - ProjectEditor
 * @returns {Promise<{image: Blob | null, text: Boolean, denied: Boolean}>}
 */
async function readSystemClipboard(editor) {
	if (hasCopiedShapes(editor)) {
		const state = await clipboardReadState(globalThis.navigator?.permissions);
		if (state === 'prompt' || state === 'denied')
			return { image: null, text: false, denied: false };
	}
	return readClipboardImage(globalThis.navigator?.clipboard, isTraceImageFile);
}

/**
 * ANY-INK (M7 finalize): a paste event anywhere on an edit canvas page. Chrome fires it at
 * the focused element, and while editing that is the page body (a press on the canvas
 * never focuses it), so the canvas's own listeners never saw it and every Ctrl+V fell back
 * to the async clipboard read and its permission prompt. initEventHandlers (events.js)
 * installs this on document. A paste into a text field (panel inputs, the preview strip)
 * stays in that field; one that started on the canvas was handled there already.
 * @param {ClipboardEvent} event
 */
export function handlePasteOnPage(event) {
	const editor = getCurrentProjectEditor();
	if (!editor?.nav?.isOnEditCanvasPage) return;
	const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
	if (isTextEntryElement(path[0] || event?.target)) return;
	handlePasteSVGonEditCanvas(event);
}

/**
 * Handle a paste on the Edit Canvas.
 * ANY-INK (M7, audit C8): an image on the clipboard becomes the trace image of the item
 * being edited. Pasted text no longer imports SVG code (purely visual editor); it gets a
 * hint instead. SVG shapes still come in by dropping an .svg file. Shapes copied with
 * Ctrl+C paste unless the image is newer (pasteDecision).
 * Called with a ClipboardEvent (paste on the canvas, its host element, or the page body
 * through handlePasteOnPage; one event can reach several, the gate handles it once) or
 * with the Ctrl+V KeyboardEvent from
 * handlePasteShortcut (no clipboardData: wait for the paste event, else read the async
 * clipboard).
 * @param {ClipboardEvent | KeyboardEvent} event - paste event or Ctrl+V keydown
 * @returns nothing
 */
export async function handlePasteSVGonEditCanvas(event) {
	// log(`handlePasteSVGonEditCanvas`, 'start');
	if (!pasteGate.firstSight(event)) return;

	// @ts-expect-error 'property does exist'
	const clipboardData = event?.clipboardData || window.clipboardData;
	if (clipboardData) {
		pasteGate.notePasteEvent();
		// The canvas is contenteditable (for paste events): never let text land in it
		cancelDefaultEventActions(event);
		runPaste(summarizePaste(clipboardData, isTraceImageFile));
		return;
	}

	// Ctrl+V keydown: wait for the paste event; with none, read the async clipboard
	pasteGate.afterKeyboardPaste(async () => {
		runPaste(await readSystemClipboard(getCurrentProjectEditor()));
	});
	// log(`handlePasteSVGonEditCanvas`, 'end');
}

/**
 * Handles dragging + dropping a file on the edit canvas.
 * ANY-INK (M7): an SVG file keeps upstream's shape import; a PNG, JPEG, or WebP image
 * becomes the trace image; anything else gets a hint in plain words.
 * @param {DragEvent} event - drag + drop event
 */
export function handleDropSVGonEditCanvas(event) {
	// log(`handleDropSVGonEditCanvas`, 'start');

	cancelDefaultEventActions(event);

	const file = event.dataTransfer?.files?.[0];
	const kind = classifyDroppedFile(file, isTraceImageFile);
	// log('\t kind: ' + kind);

	if (kind === 'svg') {
		const reader = new FileReader();
		reader.onload = function () {
			importSVGtoCurrentItem(reader.result.toString(), '<br>from the dropped SVG file');
		};
		reader.readAsText(file);
	} else if (kind === 'image') {
		sendImageToTrace(file);
	} else {
		showToast(DROP_HINT);
	}
	// log(`handleDropSVGonEditCanvas`, 'end');
}

/**
 * ANY-INK (M7): hands a dropped or pasted image to the trace layer for the item on the
 * canvas. importTraceImage shows its own toasts and never rejects.
 * @param {File | Blob} image
 */
function sendImageToTrace(image) {
	const editor = getCurrentProjectEditor();
	const item = editor?.selectedItem;
	if (!isTraceableItem(item)) {
		showToast(NOT_TRACEABLE_HINT);
		return;
	}
	importTraceImage(image, { editor, item });
}
