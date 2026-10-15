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
	  in view. A new image (M8 fix) also scrolls the panel back to its top, where the Trace
	  image card holds 'Start auto-trace', and the toast says to press it. The item is
	  remembered by id: if the user opens something else while a big photo decodes,
	  nothing is added (the history entry would land on the wrong item).
	  Resolves false, never rejects, when nothing was added.
	- pickTraceImage: showOpenFilePicker (id 'anyink-trace', starts in Pictures the first
	  time) called synchronously inside the click, before any await (transient user
	  activation); a hidden file input when the picker is missing.
	- removeTrace: one history entry 'Removed the trace image'. The Blob stays in
	  editor.assets so undo can bring the image back; the .gs2 save leaves out assets that
	  no trace uses.

	Toasts (B4) go through the one toast voice (src/anyink/toast/toast.js) by words key
	(words/sets/toasts.js), in house words in both modes. Two keep their All tools words, where
	All tools has its own controls: the added toast points at the Trace panel's Start
	auto-trace (Simple says where the photo went; B9's photo card replaces it), and "pick
	again" names the panel's "Choose an image..." button. The photo toasts share the drop
	group (toast/upstream_map.js DROP_GROUP): the drag-over hint gives way to them at once.

	Simple, until B9's photo card turns feature 'photo' on (fix track, 10/14/2026): Simple has
	no Trace panel, auto-trace, fade, hide or remove, so a photo on a letter would be a dead
	end (UX-BEGINNER principle 8, no doors to unbuilt rooms). importTraceImage and
	pickTraceImage add nothing and say "ANY-INK can't use photos yet. Draw the letter with the
	Rectangle, Oval or Point pen for now." All tools is unchanged.

	Test seams: bitmap_cache's setDecoderForTests (jsdom has no createImageBitmap) and
	file_api.js's setFileApi (jsdom has no showOpenFilePicker). Nothing here touches a
	browser API at import time.
*/
import { photosClosed } from './photo_gate.js';
import { getCurrentProjectEditor } from '../../app/main.js';
import { refreshPanel } from '../../panels/panels.js';
import { isImageType, normalizeType } from '../assets/asset_store.js';
import { getFileApi, isAbortError } from '../files/file_api.js';
import { toast } from '../toast/toast.js';
import { DROP_GROUP } from '../toast/upstream_map.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { TRACE_MAX_SIDE, decodeImageFile } from './bitmap_cache.js';
import { NOT_TRACEABLE_HINT, isTraceableItem } from './paste_drop.js';
import { keepPlacementForNewImage } from './trace_fit.js';
import { getTrace, makeTrace, setTrace } from './trace_model.js';

// --------------------------------------------------------------
// Words the user sees (B4: words.js keys; the constants are their text, for the tests)
// --------------------------------------------------------------

export const HEIC_MESSAGE = word('toast.photoHeic');
export const WRONG_TYPE_MESSAGE = word('toast.photoWrongType');
export const DECODE_FAILED_MESSAGE = word('toast.photoDamaged');
export const LOADING_MESSAGE = word('toast.photoLoading');
export const SWITCHED_MESSAGE = word('toast.photoSwitched');
export const REPLACED_MESSAGE = word('toast.photoReplaced');
export const REMOVED_MESSAGE = word('toast.photoRemoved');
export const PICK_FAILED_MESSAGE = word('toast.photoPickerFailed');
/** All tools' own words for the added toast (Simple: 'toast.photoAdded'). */
export const ADDED_MESSAGE =
	'Added a trace image. Press Start auto-trace to turn it into outlines. The image itself is only for reference: it is saved with the project but never exported in the font.';
/** The added toast says two things, so it stays up longer than the default 3 s, in ms. */
export const ADDED_TOAST_MS = 6000;
/** All tools' own words for "pick again" (Simple: 'toast.photoPickAgain'). */
export const PICK_AGAIN_MESSAGE = 'Click "Choose an image..." again to pick a file.';
/** The loading toast stays until the photo is in (or not), in ms. */
const LOADING_TOAST_MS = 60000;
/** The photo toasts replace each other instead of queueing ("Loading" then "Added"), and the
 * drag-over hint before them (one group with the drop toasts). */
const PHOTO = Object.freeze({ group: DROP_GROUP });

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

/** bitmap_cache error codes, and the words each one shows (words/sets/toasts.js). */
const DECODE_ERROR_KEYS = Object.freeze({
	heic: 'toast.photoHeic',
	unsupported: 'toast.photoWrongType',
	'not-a-file': 'toast.photoWrongType',
	'no-decoder': 'toast.photoNoDecoder',
	'decode-failed': 'toast.photoDamaged',
	'encode-failed': 'toast.photoTooBig',
});

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

// B4 + B5 finalize: the gate lives in photo_gate.js, so the drawing (trace_draw.js) shares it
export { photosClosed };

/** Simple before the photo card: no photo comes in; the toast says what to do instead. */
function turnPhotoAway() {
	toast('toast.photoNotYet', {}, PHOTO);
	return false;
}

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
		toast('toast.photoDamaged', {}, PHOTO);
		return false;
	}
}

async function runImport(file, editor, item) {
	if (!editor?.project) return false;
	if (photosClosed()) return turnPhotoAway();

	const page = editor.nav?.page;
	const itemID = editor.selectedItemID;
	const target = item || (itemID ? editor.selectedItem : false);
	if (!itemID || !isTraceableItem(target) || editor.project.getItem(itemID) !== target) {
		toast('toast.openLetterFirst', {}, { allTools: NOT_TRACEABLE_HINT });
		return false;
	}

	const { kind, type } = traceFileKind(file);
	if (kind === 'heic') {
		toast('toast.photoHeic', {}, PHOTO);
		return false;
	}
	if (kind !== 'image') {
		toast('toast.photoWrongType', {}, PHOTO);
		return false;
	}

	if (file.size > BIG_IMAGE_BYTES) {
		toast('toast.photoLoading', {}, { ...PHOTO, ms: LOADING_TOAST_MS });
	}

	// A file that came without a type (some drops, some cameras) is decoded as its name says
	const source = normalizeType(file.type) === type ? file : new Blob([file], { type });
	let decoded;
	try {
		decoded = await decodeImageFile(source, { maxSide: TRACE_MAX_SIDE });
	} catch (error) {
		console.warn('ANY-INK trace: decode failed', error);
		toast(decodeErrorKey(error), {}, PHOTO);
		return false;
	}
	if (!decoded?.blob || !(decoded.width > 0) || !(decoded.height > 0)) {
		toast('toast.photoDamaged', {}, PHOTO);
		return false;
	}

	// The history entry records the item on the canvas, so it must still be this one
	const live = editor.project.getItem(itemID);
	if (editor.nav?.page !== page || editor.selectedItemID !== itemID || !isTraceableItem(live)) {
		toast('toast.photoSwitched', {}, PHOTO);
		return false;
	}

	let asset;
	try {
		asset = editor.assets.add(decoded.blob, { type: decoded.type || decoded.blob.type });
	} catch (error) {
		console.warn('ANY-INK trace: the decoded image was refused by the asset store', error);
		toast('toast.photoWrongType', {}, PHOTO);
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
		toast('toast.photoDamaged', {}, PHOTO);
		return false;
	}

	editor.history.addState(previous ? HISTORY_REPLACED : HISTORY_ADDED);
	editor.publish('traceLayer', live);
	editor.publish('currentItem', live);
	showTracePanel(editor);
	if (previous) toast('toast.photoReplaced', {}, PHOTO);
	else {
		showPanelTop();
		const letter = letterPhrase(live.chars) || word('history.thisLetter');
		toast(
			'toast.photoAdded',
			{ letter },
			{ ...PHOTO, allTools: ADDED_MESSAGE, ms: ADDED_TOAST_MS }
		);
	}
	return true;
}

/**
 * bitmap_cache rejects with a code; each code has its house words (B4).
 * @param {*} error
 * @returns {String} a words.js key
 */
function decodeErrorKey(error) {
	return DECODE_ERROR_KEYS[error?.code] || 'toast.photoDamaged';
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

/**
 * A new image: the panel shows its top, the Trace image card with 'Start auto-trace' (the
 * Auto-trace card itself is below the fold on most windows).
 */
function showPanelTop() {
	if (typeof document === 'undefined') return;
	const area = document.querySelector('#editor-page__panel');
	if (area?.scrollTop) area.scrollTop = 0;
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
	if (photosClosed()) return Promise.resolve(turnPhotoAway());
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
		toast('toast.photoPickAgain', {}, { allTools: PICK_AGAIN_MESSAGE });
		return false;
	}
	console.warn('ANY-INK trace: the file picker failed', error);
	toast('toast.photoPickerFailed');
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
	toast('toast.photoRemoved', {}, PHOTO);
	return true;
}
