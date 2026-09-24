// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: adding, replacing, and removing the trace image (Milestone 7).
	Owner: TRACK C (import + panel).

	Callers: the Trace panel buttons, and src/edit_canvas/events_drag_drop_paste.js, which
	sends a dropped or pasted image here when isTraceImageFile says yes. isTraceImageFile
	gets a File from a drop or paste event, or a Blob with only a type (no name) from the
	async clipboard.

	- isTraceImageFile: any raster image (by MIME type, or by file name when the type is
	  missing), HEIC included so the import can say why it cannot be used. SVG is never a
	  trace image (dropping an .svg file imports its shapes instead).
	- importTraceImage (D-023): PNG / JPEG / WebP only, with a plain message for HEIC and
	  for anything else; a progress toast for big photos; decode through bitmap_cache
	  (EXIF rotation applied, long side capped at 2000 px, re-encoded once); the result
	  goes into editor.assets (a Blob beside the project, never inside it, D-012); the
	  glyph gets a trace with the default placement, or keeps its placement when the image
	  is replaced; one history entry ('Added a trace image' / 'Replaced the trace image');
	  'traceLayer' and 'currentItem' published; the Trace panel opened so the controls are
	  in view. The item is remembered by id: if the user opens something else while a big
	  photo decodes, nothing is added (the history entry would land on the wrong item).
	  Resolves false, never rejects, when nothing was added.
	- pickTraceImage: showOpenFilePicker (id 'anyink-trace', starts in Pictures the first
	  time) called synchronously inside the click, before any await (transient user
	  activation); a hidden file input when the picker is missing.
	- removeTrace: one history entry 'Removed the trace image'. The Blob stays in
	  editor.assets so undo can bring the image back; the .gs2 save leaves out assets that
	  no trace uses.

	Test seams: bitmap_cache's setDecoderForTests (jsdom has no createImageBitmap) and
	file_api.js's setFileApi (jsdom has no showOpenFilePicker). Nothing here touches a
	browser API at import time.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { refreshPanel } from '../../panels/panels.js';
import { isImageType, normalizeType } from '../assets/asset_store.js';
import { getFileApi, isAbortError } from '../files/file_api.js';
import { TRACE_MAX_SIDE, decodeImageFile } from './bitmap_cache.js';
import { NOT_TRACEABLE_HINT, isTraceableItem } from './paste_drop.js';
import { keepPlacementForNewImage } from './trace_fit.js';
import { getTrace, makeTrace, setTrace } from './trace_model.js';

// --------------------------------------------------------------
// Words the user sees
// --------------------------------------------------------------

export const HEIC_MESSAGE =
	'Chrome cannot open HEIC photos. Save the photo as JPEG or PNG and try again.';
export const WRONG_TYPE_MESSAGE =
	'That file is not an image ANY-INK can trace. Use PNG, JPEG, or WebP.';
export const DECODE_FAILED_MESSAGE =
	'ANY-INK could not open that image. The file may be damaged. Save it again as PNG or JPEG and try again.';
export const LOADING_MESSAGE = 'Loading the image. A big photo takes a few seconds.';
export const SWITCHED_MESSAGE =
	'You opened something else while the image was loading, so it was not added. Try again.';
export const ADDED_MESSAGE =
	'Added a trace image. It is only for reference: it is saved with the project but never exported in the font.';
export const REPLACED_MESSAGE = 'Replaced the trace image.';
export const REMOVED_MESSAGE = 'Removed the trace image. Undo brings it back.';
export const PICK_AGAIN_MESSAGE = 'Click "Choose an image..." again to pick a file.';
export const PICK_FAILED_MESSAGE =
	'ANY-INK could not open the file picker. Drop the image on the canvas instead.';

/** History titles, one entry per action. */
export const HISTORY_ADDED = 'Added a trace image';
export const HISTORY_REPLACED = 'Replaced the trace image';
export const HISTORY_REMOVED = 'Removed the trace image';

// --------------------------------------------------------------
// Settings
// --------------------------------------------------------------

/** Files bigger than this get a "Loading" toast while they decode (1 MB). */
export const BIG_IMAGE_BYTES = 1024 * 1024;

/** Picker id: Chrome remembers the last folder per id. */
export const TRACE_PICKER_ID = 'anyink-trace';

/** File types the picker offers (its "All files" choice stays, so HEIC gets its message). */
export const TRACE_PICKER_TYPES = Object.freeze([
	{
		description: 'Images (PNG, JPEG, WebP)',
		accept: {
			'image/png': ['.png'],
			'image/jpeg': ['.jpg', '.jpeg', '.jfif'],
			'image/webp': ['.webp'],
		},
	},
]);

/** bitmap_cache error codes whose own message is shown as is. */
const DECODE_ERROR_CODES = ['no-decoder', 'decode-failed', 'encode-failed'];

const INPUT_ID = 'anyink-trace-file-input';
const INPUT_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.jfif,.webp';

const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
const HEIC_EXTENSIONS = ['heic', 'heif', 'hif'];
/** Extensions that decode in Chrome, and the type to give a file that arrived without one. */
const TYPE_BY_EXTENSION = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	jpe: 'image/jpeg',
	jfif: 'image/jpeg',
	pjpeg: 'image/jpeg',
	pjp: 'image/jpeg',
	webp: 'image/webp',
};
/** Other raster extensions: accepted by isTraceImageFile so the import can explain. */
const OTHER_IMAGE_EXTENSIONS = ['gif', 'bmp', 'tif', 'tiff', 'avif', 'ico', 'jxl'];

// --------------------------------------------------------------
// What kind of file is this
// --------------------------------------------------------------

function isBlobLike(value) {
	return !!value && typeof value === 'object' && typeof value.size === 'number';
}

function extensionOf(file) {
	const match = /\.([a-z0-9]+)$/i.exec(String(file?.name || ''));
	return match ? match[1].toLowerCase() : '';
}

/**
 * @param {File | Blob} file
 * @returns {{kind: 'image' | 'heic' | 'other', type: String}} kind, and for 'image' the
 *   MIME type to decode it as (from the file, or from its name when the type is missing)
 */
export function traceFileKind(file) {
	if (!isBlobLike(file)) return { kind: 'other', type: '' };
	const type = normalizeType(file.type);
	const ext = extensionOf(file);
	if (HEIC_TYPES.includes(type) || HEIC_EXTENSIONS.includes(ext)) return { kind: 'heic', type };
	if (isImageType(type)) return { kind: 'image', type };
	const untyped = !type || type === 'application/octet-stream';
	if (untyped && TYPE_BY_EXTENSION[ext]) return { kind: 'image', type: TYPE_BY_EXTENSION[ext] };
	return { kind: 'other', type };
}

/**
 * @param {File | Blob} file
 * @returns {Boolean} true when this looks like an image to trace over (a raster image,
 *   HEIC included so the import can say why it cannot be used; never SVG)
 */
export function isTraceImageFile(file) {
	if (!isBlobLike(file)) return false;
	const type = normalizeType(file.type);
	const ext = extensionOf(file);
	if (type === 'image/svg+xml' || ext === 'svg' || ext === 'svgz') return false;
	if (type.startsWith('image/')) return true;
	if (type && type !== 'application/octet-stream') return false;
	return (
		!!TYPE_BY_EXTENSION[ext] ||
		HEIC_EXTENSIONS.includes(ext) ||
		OTHER_IMAGE_EXTENSIONS.includes(ext)
	);
}

// --------------------------------------------------------------
// Import
// --------------------------------------------------------------

/**
 * @param {File | Blob} fileOrBlob
 * @param {{editor?: Object, item?: Object}} [options] - default: current editor, the item
 *   on the canvas. The item must be the one being edited (history records that one).
 * @returns {Promise<Boolean>} true when a trace image was added or replaced
 */
export async function importTraceImage(fileOrBlob, { editor, item } = {}) {
	try {
		return await runImport(fileOrBlob, editor || getCurrentProjectEditor(), item);
	} catch (error) {
		console.warn('ANY-INK trace: the image could not be added', error);
		showToast(DECODE_FAILED_MESSAGE);
		return false;
	}
}

async function runImport(file, editor, item) {
	if (!editor?.project) return false;

	const page = editor.nav?.page;
	const itemID = editor.selectedItemID;
	const target = item || (itemID ? editor.selectedItem : false);
	if (!itemID || !isTraceableItem(target) || editor.project.getItem(itemID) !== target) {
		showToast(NOT_TRACEABLE_HINT);
		return false;
	}

	const { kind, type } = traceFileKind(file);
	if (kind === 'heic') {
		showToast(HEIC_MESSAGE);
		return false;
	}
	if (kind !== 'image') {
		showToast(WRONG_TYPE_MESSAGE);
		return false;
	}

	if (file.size > BIG_IMAGE_BYTES) showToast(LOADING_MESSAGE, 60000);

	// A file that came without a type (some drops, some cameras) is decoded as its name says
	const source = normalizeType(file.type) === type ? file : new Blob([file], { type });
	let decoded;
	try {
		decoded = await decodeImageFile(source, { maxSide: TRACE_MAX_SIDE });
	} catch (error) {
		console.warn('ANY-INK trace: decode failed', error);
		showToast(decodeErrorMessage(error));
		return false;
	}
	if (!decoded?.blob || !(decoded.width > 0) || !(decoded.height > 0)) {
		showToast(DECODE_FAILED_MESSAGE);
		return false;
	}

	// The history entry records the item on the canvas, so it must still be this one
	const live = editor.project.getItem(itemID);
	if (editor.nav?.page !== page || editor.selectedItemID !== itemID || !isTraceableItem(live)) {
		showToast(SWITCHED_MESSAGE);
		return false;
	}

	let asset;
	try {
		asset = editor.assets.add(decoded.blob, { type: decoded.type || decoded.blob.type });
	} catch (error) {
		console.warn('ANY-INK trace: the decoded image was refused by the asset store', error);
		showToast(WRONG_TYPE_MESSAGE);
		return false;
	}

	const image = { asset, width: decoded.width, height: decoded.height };
	const previous = getTrace(live);
	const next = previous
		? keepPlacementForNewImage(previous, image)
		: makeTrace(image, editor.project.settings.font);
	// setTrace refuses a trace it cannot draw (and then leaves the item as it was)
	if (!next || !setTrace(live, next)) {
		editor.assets.delete(asset);
		showToast(DECODE_FAILED_MESSAGE);
		return false;
	}

	editor.history.addState(previous ? HISTORY_REPLACED : HISTORY_ADDED);
	editor.publish('traceLayer', live);
	editor.publish('currentItem', live);
	showTracePanel(editor);
	showToast(previous ? REPLACED_MESSAGE : ADDED_MESSAGE);
	return true;
}

/**
 * bitmap_cache rejects with plain-words messages and a code; the two type checks already
 * happened above with this module's own wording, so only the decode-side ones pass through.
 * @param {*} error
 * @returns {String}
 */
function decodeErrorMessage(error) {
	if (error?.code === 'heic') return HEIC_MESSAGE;
	if (error?.code === 'unsupported' || error?.code === 'not-a-file') return WRONG_TYPE_MESSAGE;
	if (
		DECODE_ERROR_CODES.includes(error?.code) &&
		typeof error.message === 'string' &&
		error.message
	) {
		return error.message;
	}
	return DECODE_FAILED_MESSAGE;
}

/**
 * Opens the Trace panel (the user just added an image and needs its controls). In the app
 * the page is rebuilt like the panel chooser does; on a bare test page only the panel.
 * @param {Object} editor
 */
function showTracePanel(editor) {
	if (editor.nav.panel === 'Trace') return;
	editor.nav.panel = 'Trace';
	if (typeof document !== 'undefined' && document.querySelector('#app__wrapper')) {
		editor.showPageTransitions = false;
		editor.navigate();
		editor.showPageTransitions = true;
	} else {
		refreshPanel();
	}
}

// --------------------------------------------------------------
// Picker
// --------------------------------------------------------------

/**
 * Opens the image picker. Call directly from a click handler: the picker is requested
 * before anything is awaited.
 * @param {{editor?: Object, item?: Object}} [options]
 * @returns {Promise<Boolean>} true when an image was added or replaced
 */
export function pickTraceImage({ editor, item } = {}) {
	editor = editor || getCurrentProjectEditor();
	const options = { editor, item };
	const picker = getFileApi().showOpenFilePicker;
	if (typeof picker !== 'function') return pickWithInput(options);

	let request;
	try {
		request = picker({
			id: TRACE_PICKER_ID,
			startIn: 'pictures',
			multiple: false,
			types: TRACE_PICKER_TYPES,
		});
	} catch (error) {
		return Promise.resolve(pickerFailed(error));
	}
	return Promise.resolve(request)
		.then(async (handles) => {
			const handle = Array.isArray(handles) ? handles[0] : handles;
			if (!handle || typeof handle.getFile !== 'function') return false;
			const file = await handle.getFile();
			return importTraceImage(file, options);
		})
		.catch(pickerFailed);
}

function pickerFailed(error) {
	if (isAbortError(error)) return false;
	if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
		showToast(PICK_AGAIN_MESSAGE);
		return false;
	}
	console.warn('ANY-INK trace: the file picker failed', error);
	showToast(PICK_FAILED_MESSAGE);
	return false;
}

/**
 * Fallback for browsers without showOpenFilePicker: a hidden file input, clicked now.
 * @param {{editor?: Object, item?: Object}} options
 * @returns {Promise<Boolean>}
 */
function pickWithInput(options) {
	if (typeof document === 'undefined') return Promise.resolve(false);
	document.getElementById(INPUT_ID)?.remove();
	const input = document.createElement('input');
	input.type = 'file';
	input.id = INPUT_ID;
	input.accept = INPUT_ACCEPT;
	input.style.display = 'none';
	document.body.appendChild(input);
	return new Promise((resolve) => {
		const finish = (result) => {
			input.remove();
			resolve(result);
		};
		input.addEventListener(
			'change',
			() => {
				const file = input.files?.[0];
				if (!file) finish(false);
				else importTraceImage(file, options).then(finish);
			},
			{ once: true }
		);
		input.addEventListener('cancel', () => finish(false), { once: true });
		input.click();
	});
}

// --------------------------------------------------------------
// Remove
// --------------------------------------------------------------

/**
 * @param {{editor?: Object, item?: Object}} [options]
 * @returns {Boolean} true when a trace was removed
 */
export function removeTrace({ editor, item } = {}) {
	editor = editor || getCurrentProjectEditor();
	if (!editor?.project) return false;
	const itemID = editor.selectedItemID;
	const target = item || (itemID ? editor.project.getItem(itemID) : false);
	if (!isTraceableItem(target) || !getTrace(target)) return false;
	if (editor.project.getItem(itemID) !== target) return false;

	setTrace(target, null);
	editor.history.addState(HISTORY_REMOVED);
	editor.publish('traceLayer', target);
	editor.publish('currentItem', target);
	showToast(REMOVED_MESSAGE);
	return true;
}
