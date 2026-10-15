// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK trace layer: drops that miss the canvas (Milestone 7 fix).

	Only the edit canvas (and upstream's open-project drop area) listened for file drops.
	A photo dropped on the Trace panel, just beside the canvas, or on the preview strip got
	Chrome's own file drop: Chrome opened the image in the tab, behind a "Leave site?"
	prompt. Two pieces here:

	- makeFileDropTarget(element, { onDrop, hoverClass }): an element that takes file drags.
	  It accepts dragover (so a drop can land), toggles hoverClass while a file is over it,
	  and hands the drop to onDrop. Drags that carry no files (text, links) are left alone.
	  The Trace panel uses it and sends the drop to the canvas's own handler
	  (handleDropSVGonEditCanvas), so a drop there does exactly what a drop on the canvas does.
	- installPageDropGuard(): one window-level listener pair, installed once (navigator.js
	  installs it on every page change; a second call does nothing). A file drop nothing else
	  handled is kept from leaving the app. On a Characters, Ligatures, or Components page it
	  goes to the canvas's handler too (image: trace it, SVG: import its shapes, else a hint);
	  on any other page the user gets a plain hint. Upstream's open-project page keeps its own
	  drop area. The canvas, the Trace panel, and the open-project page stop their drops
	  before they reach the window, so nothing is handled twice.

	Nothing touches the DOM at import time.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { handleDropSVGonEditCanvas } from '../../edit_canvas/events_drag_drop_paste.js';
import { isWorkFile, sayWorkFileDropped } from '../toast/drop_toasts.js';
import { DROP_HINT, NOT_TRACEABLE_HINT, classifyDroppedFile } from './paste_drop.js';
import { isTraceImageFile } from './trace_import.js';

/** Pages whose canvas item can take a trace image (the item is a Glyph). */
export const TRACE_PAGES = Object.freeze(['Characters', 'Ligatures', 'Components']);

/**
 * @param {DataTransfer | Object | null | undefined} dataTransfer
 * @returns {Boolean} true when the drag carries files (from Explorer, the desktop, a browser)
 */
export function hasFiles(dataTransfer) {
	const types = dataTransfer?.types;
	if (!types) return false;
	if (typeof types.includes === 'function') return types.includes('Files');
	if (typeof types.contains === 'function') return types.contains('Files');
	try {
		return Array.from(types).includes('Files');
	} catch {
		return false;
	}
}

/**
 * Makes an element take file drops.
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {Function} options.onDrop - (event) with the drop's default already cancelled
 * @param {String} [options.hoverClass] - class set on element while a file is over it
 */
export function makeFileDropTarget(element, { onDrop, hoverClass = '' } = {}) {
	let depth = 0;
	const light = (on) => {
		if (hoverClass) element.classList.toggle(hoverClass, on);
	};

	element.addEventListener('dragenter', (event) => {
		if (!hasFiles(event.dataTransfer)) return;
		depth += 1;
		light(true);
	});
	element.addEventListener('dragover', (event) => {
		if (!hasFiles(event.dataTransfer)) return;
		event.preventDefault();
		event.stopPropagation();
		setDropEffect(event.dataTransfer);
		light(true);
	});
	element.addEventListener('dragleave', (event) => {
		if (!hasFiles(event.dataTransfer)) return;
		depth = Math.max(0, depth - 1);
		if (!depth) light(false);
	});
	element.addEventListener('drop', (event) => {
		depth = 0;
		light(false);
		if (!hasFiles(event.dataTransfer)) return;
		event.preventDefault();
		event.stopPropagation();
		if (typeof onDrop === 'function') onDrop(event);
	});
}

// --------------------------------------------------------------
// Page-wide guard
// --------------------------------------------------------------

const guards = new WeakMap(); // target -> uninstall

/**
 * Keeps a file drop that nothing handled from leaving the app, and routes it (routeStrayDrop).
 * Installed once per target; later calls return the same uninstall function.
 * @param {Object} [options]
 * @param {EventTarget} [options.target] - default: window
 * @param {Function} [options.route] - (event) for a stray drop; default routeStrayDrop
 * @returns {Function} uninstall (tests)
 */
export function installPageDropGuard({ target, route = routeStrayDrop } = {}) {
	target = target || (typeof window !== 'undefined' ? window : null);
	if (!target || typeof target.addEventListener !== 'function') return () => {};
	if (guards.has(target)) return guards.get(target);

	const onDragOver = (event) => {
		if (event.defaultPrevented || !hasFiles(event.dataTransfer)) return;
		event.preventDefault();
		setDropEffect(event.dataTransfer);
	};
	const onDrop = (event) => {
		if (event.defaultPrevented || !hasFiles(event.dataTransfer)) return;
		event.preventDefault();
		try {
			route(event);
		} catch (error) {
			console.warn('ANY-INK trace: a dropped file could not be handled', error);
		}
	};
	target.addEventListener('dragover', onDragOver);
	target.addEventListener('drop', onDrop);

	const uninstall = () => {
		target.removeEventListener('dragover', onDragOver);
		target.removeEventListener('drop', onDrop);
		guards.delete(target);
	};
	guards.set(target, uninstall);
	return uninstall;
}

/**
 * Where a stray file drop goes.
 * @param {DragEvent} event
 * @param {Object} [options] - seams for tests
 * @param {Object} [options.editor] - default: the current ProjectEditor
 * @param {Function} [options.dropOnCanvas] - default: the canvas's handleDropSVGonEditCanvas
 */
export function routeStrayDrop(
	event,
	{ editor = getCurrentProjectEditor(), dropOnCanvas = handleDropSVGonEditCanvas } = {}
) {
	// Upstream's open-project page has its own drop area; a miss there just stays put
	if (event?.target?.closest?.('#open-project__page')) return;
	if (!editor?.project) return;
	if (TRACE_PAGES.includes(editor.nav?.page)) {
		dropOnCanvas(event);
		return;
	}
	const file = event?.dataTransfer?.files?.[0];
	// B4 + B5 finalize: his own work file says how to open it (Ctrl+O, 7.6), as on a letter;
	// All tools keeps its drop hint (sayWorkFileDropped)
	if (isWorkFile(file)) {
		sayWorkFileDropped();
		return;
	}
	const kind = classifyDroppedFile(file, isTraceImageFile);
	showToast(kind === 'other' ? DROP_HINT : NOT_TRACEABLE_HINT);
}

function setDropEffect(dataTransfer) {
	try {
		if (dataTransfer) dataTransfer.dropEffect = 'copy';
	} catch {
		// Read-only in some drags; the drop still lands
	}
}
