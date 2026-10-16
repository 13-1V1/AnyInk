// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: files dropped on the letter board (UX-BEGINNER.md 4.2 Drops and Tiles, 4.5; section 10 B10
	board_drop.js). Simple with 'board' on, on the board (the Overview page):
	  a photo on a tile          that letter: the photo screens (photo/photo_app.js takePhoto with
	                             the letter), which open the photo dialog when the photo has more
	                             than one part, else step C on the letter
	  a photo on blank space     the photo dialog with the letter unknown (B9's hand-off: takePhoto
	                             with no letter), "Which letter is in the green box?"
	  a work file (.gs2)         opens it (B10 + B11 integration: files/open_font.js
	                             openDroppedFont, with Ctrl+O's unsaved check first). Its file
	                             handle is taken during the drop (getAsFileSystemHandle works only
	                             then), so Save writes back to the file he dropped
	  anything else              one sentence: "ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK
	                             work files (.gs2)."
	A photo counts by trace/trace_import.js isTraceImageFile (HEIC too, so the photo screens can
	say why it can't be used, 7.7); a drawing (.svg) is "anything else" here (it goes on a letter).
	While a photo is held over a tile, that tile is marked (attribute drop-target, green in
	tile_state.css), so he sees which letter it goes to.
	The page's drop guard (trace/trace_drop.js installPageDropGuard, installed on every page) sends
	every file drop and drag-over on the board here, so the board page wires nothing.

	  classifyBoardDrop(file)              'photo' | 'workFile' | 'other'
	  boardDropChar(event)                 the letter of the tile under the drop, '' for blank space
	  routeBoardDrop(event, { editor, takePhoto, openWorkFile })   Promise<'photoOnLetter' |
	                                       'photo' | 'workFile' | 'other' | 'none'>; takePhoto(file,
	                                       { editor, char, itemId }) default: photo_app.js's;
	                                       openWorkFile({ editor, file, handle }) default:
	                                       open_font.js openDroppedFont
	  markBoardDropTarget(event, { editor })   dragover: marks the tile under the pointer; a drop,
	                                       or a drag that left the window, clears it
	  clearBoardDropTarget(root)
*/
import { charToHex } from '../../common/character_ids.js';
import { isWorkFile } from '../toast/drop_toasts.js';
import { toast } from '../toast/toast.js';
import { DROP_GROUP } from '../toast/upstream_map.js';
import { isTraceImageFile } from '../trace/trace_import.js';
import { isBoardShowing, TILE_SELECTOR } from './board_keys.js';

export const DROP_TARGET_ATTRIBUTE = 'drop-target';

/**
 * @param {File | Blob | null} file
 * @returns {'photo' | 'workFile' | 'other'}
 */
export function classifyBoardDrop(file) {
	if (!file) return 'other';
	if (isWorkFile(file)) return 'workFile';
	return isTraceImageFile(file) ? 'photo' : 'other';
}

/**
 * @param {Event} event - a drag event
 * @returns {Element | null} the board tile it is over
 */
function tileUnder(event) {
	const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
	const fromPath = path.find((node) => typeof node?.matches === 'function' && node.matches(TILE_SELECTOR));
	if (fromPath) return fromPath;
	const target = event?.target;
	return typeof target?.closest === 'function' ? target.closest(TILE_SELECTOR) : null;
}

/**
 * @param {Event} event - a drop
 * @returns {String} the letter of the tile under it, '' for blank board space
 */
export function boardDropChar(event) {
	return tileUnder(event)?.getAttribute('data-anyink-char') || '';
}

/** photo/photo_app.js, loaded when a photo is dropped (it is the app's, started at boot) */
function appTakePhoto(file, context) {
	return import('../photo/photo_app.js').then((app) => app.takePhoto(file, context));
}

/** files/open_font.js, loaded when a work file is dropped (it reaches far into the app) */
function appOpenWorkFile(options) {
	return import('../files/open_font.js').then((files) => files.openDroppedFont(options));
}

/**
 * The dropped file's handle, asked for during the drop itself (the only time the browser gives
 * it), so a work file that opens can be saved back in place.
 * @param {DragEvent} event
 * @returns {Promise<FileSystemHandle | null> | null}
 */
function droppedHandle(event) {
	const item = [...(event?.dataTransfer?.items || [])].find((entry) => entry?.kind === 'file');
	if (typeof item?.getAsFileSystemHandle !== 'function') return null;
	try {
		return item.getAsFileSystemHandle();
	} catch {
		return null;
	}
}

/**
 * @param {DragEvent} event - a drop on the board (its default already cancelled)
 * @param {{editor: Object, takePhoto?: Function, openWorkFile?: Function}} options
 * @returns {Promise<String>} what it did
 */
export async function routeBoardDrop(
	event,
	{ editor, takePhoto = appTakePhoto, openWorkFile = appOpenWorkFile } = {}
) {
	clearBoardDropTarget(event?.target?.ownerDocument || globalThis.document);
	const file = event?.dataTransfer?.files?.[0] || null;
	if (!file || !editor) return 'none';
	const kind = classifyBoardDrop(file);
	if (kind === 'workFile') {
		// B10 + B11 integration (4.2: "A .gs2 opens it"): the handle now, before any await
		const handle = droppedHandle(event);
		try {
			await openWorkFile({ editor, file, handle });
		} catch (error) {
			console.warn('ANY-INK board: a dropped work file could not be opened', error);
		}
		return 'workFile';
	}
	if (kind === 'other') {
		toast('boardDrop.other', {}, { group: DROP_GROUP, allTools: false });
		return 'other';
	}
	const char = boardDropChar(event);
	const context = char ? { editor, char, itemId: `glyph-${charToHex(char)}` } : { editor, char: '', itemId: '' };
	try {
		await takePhoto(file, context);
	} catch (error) {
		console.warn('ANY-INK board: a dropped photo could not be taken', error);
	}
	return char ? 'photoOnLetter' : 'photo';
}

/**
 * Marks the tile a photo is held over (dragover), and clears the mark when the drag leaves the
 * window. Nothing off the board.
 * @param {DragEvent} event - dragover or dragleave
 * @param {{editor: Object}} options
 */
export function markBoardDropTarget(event, { editor } = {}) {
	const doc = event?.target?.ownerDocument || globalThis.document;
	if (!isBoardShowing(editor)) {
		clearBoardDropTarget(doc);
		return;
	}
	if (event?.type === 'dragleave') {
		// the drag left the window (no element it went into)
		if (!event.relatedTarget) clearBoardDropTarget(doc);
		return;
	}
	const tile = tileUnder(event);
	const over = tile && classifyBoardDrop(firstFileType(event)) === 'photo' ? tile : null;
	doc?.querySelectorAll?.(`[${DROP_TARGET_ATTRIBUTE}]`).forEach((marked) => {
		if (marked !== over) marked.removeAttribute(DROP_TARGET_ATTRIBUTE);
	});
	if (over && !over.hasAttribute(DROP_TARGET_ATTRIBUTE)) over.setAttribute(DROP_TARGET_ATTRIBUTE, '');
}

/**
 * What is being dragged, as far as a dragover can tell: Chrome hides the files until the drop,
 * but lists their types (items[i].type). A type it doesn't say (a work file, a HEIC photo on
 * Windows) marks no tile; the drop still says what happens.
 * @param {DragEvent} event
 * @returns {{type: String, name: String}}
 */
function firstFileType(event) {
	const transfer = event?.dataTransfer;
	const file = transfer?.files?.[0];
	if (file) return file;
	const item = [...(transfer?.items || [])].find((entry) => entry?.kind === 'file');
	return { type: item?.type || '', name: '', size: 0 };
}

/**
 * @param {ParentNode} [root]
 */
export function clearBoardDropTarget(root = globalThis.document) {
	root?.querySelectorAll?.(`[${DROP_TARGET_ATTRIBUTE}]`).forEach((marked) =>
		marked.removeAttribute(DROP_TARGET_ATTRIBUTE)
	);
}
