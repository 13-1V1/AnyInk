// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: [Show me] opens what a preview notice names (a letter, joined letters, or the gap between
	two letters), the same way a double-click on a letter in the strip does.
	Opening never changes what it opens. Selecting a letter runs the Characters page's
	selection handler (characters.js -> new_path.js removeStopCreatingNewPathButton), which
	gave a one-shape letter with no width a width of its own with no Undo step (walkthrough p9).
	The B1 fix pass fixed that at its root (only the Done button of a path still does it), but a
	path left unfinished when a letter is opened still ends by picking a tool, which does it
	too. So when it is already open Show me never selects it again (it only fits it in view),
	and when it opens another letter it puts back a width that selection changed, before the
	page is drawn.
	A move to another item records upstream's "Navigated to ..." step, as the Overview, the
	letter chooser and Ctrl+Period do: upstream's undo reads the step under the newest one to
	find the item's earlier state, and without it the first Undo after an edit there only moves
	back and drops that edit ("Navigated without undo-ing"). B2 replaces this in Simple mode.
*/
import { navigationTargetForId } from './hit_test.js';

/**
 * @param {Object} editor - ProjectEditor (nav, selectedItemID, navigate)
 * @param {String|null} itemId - 'glyph-0x61', 'liga-...', 'kern-0'
 * @returns {Boolean} true when it is on screen (opened, or already open)
 */
export function showItem(editor, itemId) {
	const target = navigationTargetForId(itemId);
	if (!target || !editor || typeof editor.navigate !== 'function') return false;
	if (isOpen(editor, target)) {
		fitInView(editor);
		return true;
	}
	const item = editor.project?.getItem?.(target.id);
	const width = item ? item.advanceWidth : undefined;
	editor.nav.page = target.page;
	editor.selectedItemID = target.id;
	if (item && item.advanceWidth !== width) item.advanceWidth = width;
	editor.navigate();
	recordNavigation(editor, target.id);
	return true;
}

/** The step upstream's own navigators record after a move (overview.js, navigator.js). */
function recordNavigation(editor, id) {
	if (typeof editor.history?.addState !== 'function') return;
	if (typeof editor.project?.getItemName !== 'function') return;
	editor.history.addState(`Navigated to ${editor.project.getItemName(id, true)}`);
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String|null} itemId
 * @returns {Boolean} true when that item's page is showing with it selected
 */
export function isItemOpen(editor, itemId) {
	const target = navigationTargetForId(itemId);
	return !!target && !!editor && isOpen(editor, target);
}

function isOpen(editor, target) {
	return editor.nav?.page === target.page && editor.selectedItemID === target.id;
}

/** Fits the open item in the edit canvas, when there is one on screen. */
function fitInView(editor) {
	if (typeof editor.autoFitView !== 'function') return;
	if (typeof editor.getEditCanvasWrapperBounds === 'function') {
		if (!editor.getEditCanvasWrapperBounds()) return;
	}
	editor.autoFitView();
}
