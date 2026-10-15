// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper (B6 + B7 finalize): one Simple screen as the app draws it in jsdom, with the flags
	as the app has them, and a real Point pen on it. Shared by the finalize seam tests.

	  addStyles()             the stylesheets that decide what shows (vitest skips CSS imports)
	  letterPage({ mode, id }) the letter page on one letter, drawn by the real Navigator, with a
	                          real Point pen and Edit points tool and a fixed view
	  settle()                lets the Next line draw (the coach batches to the next frame)
	  q(selector), shownEl(el), greens(), nextSentence(), nextButton(), railText(), showing(),
	  shownText()
	  penClick(editor, [x, y])   a plain click with the Point pen at font units (x, y)
	  square(x0, y0, size, { reversed })   a square Path
	  setUpScreenTests()      the beforeAll / beforeEach / afterEach a screen test needs
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Tool_NewPath } from '../../../edit_canvas/tools/new_path.js';
import { Tool_PathEdit } from '../../../edit_canvas/tools/path_edit.js';
import { Path } from '../../../project_data/path.js';
import { CoachElement } from '../../coach/coach_element.js';
import { resetCoachForTests } from '../../coach/coach_state.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { resetToastsForTests } from '../../toast/toast.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

export function addStyles() {
	[
		'project_editor/nav.css',
		'anyink/mode/hide.css',
		'anyink/mode/simple_labels.css',
		'anyink/letter/letter.css',
		'anyink/topbar/simple_top_bar.css',
		'anyink/coach/coach.css',
	].forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = css(path);
		document.head.appendChild(style);
	});
}

/** The view the pen's clicks are measured through: 1 font unit = 1 px, the writing line low */
export const VIEW = Object.freeze({ dx: 300, dy: 700, dz: 1 });

/**
 * @param {{mode?: String, id?: String, page?: String}} [options]
 * @returns {Object} the editor
 */
export function letterPage({ mode = 'simple', id = 'glyph-0x61', page = 'Characters' } = {}) {
	setModeForTests(mode);
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = id;
	void editor.selectedGlyph; // makes the record, as opening a letter does
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	editor.view = { ...VIEW };
	editor.eventHandlers.tool_addPath = new Tool_NewPath();
	editor.eventHandlers.tool_pathEdit = new Tool_PathEdit();
	eventHandlerData.isShiftDown = false;
	eventHandlerData.undoQueueHasChanged = false;
	eventHandlerData.toolHandoff = false;
	return editor;
}

/** Font units to canvas pixels through the view as it is now (it pans with each refit) */
export function canvasAt(editor, x, y) {
	const { dx, dy, dz } = editor.view;
	return { x: dx + x * dz, y: dy - y * dz };
}

/** A plain click with the Point pen: press and release, the pointer still */
export function penClick(editor, [x, y]) {
	editor.selectedTool = 'newPath';
	eventHandlerData.mousePosition = canvasAt(editor, x, y);
	const pen = editor.eventHandlers.tool_addPath;
	pen.mousedown();
	if (editor.selectedTool === 'newPath') pen.mouseup();
	else editor.eventHandlers.tool_pathEdit.mouseup();
}

export async function settle() {
	for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0));
	document.querySelector('anyink-coach')?.render?.();
	document.querySelector('anyink-coach')?.checkScreen?.();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

export const q = (selector) => document.querySelector(selector);
export const shownEl = (element) => {
	for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
		if (el.hidden || el.hasAttribute('data-anyink-hidden')) return false;
		if (getComputedStyle(el).display === 'none') return false;
	}
	return !!element;
};
export const greens = () => [...document.querySelectorAll('.anyink-primary')].filter(shownEl);
export const nextSentence = () =>
	q('anyink-coach')?.querySelector('.anyink-coach__sentence')?.textContent || '';
export const nextButton = () => {
	const button = q('anyink-coach')?.querySelector('.anyink-coach__button');
	return shownEl(button) ? button : null;
};
export const railText = () =>
	q('#app__top-bar [data-anyink-step="letters"]')?.textContent.replace(/\s+/g, ' ').trim() || '';
export const showing = () => q('#toast[data-anyink-toast="simple"]:not([data-leaving])');
export const shownText = () => showing()?.querySelector('.anyink-toast__text')?.textContent ?? null;

/** A square path from (x0, y0), size font units; reversed: the other way round */
export function square(x0, y0, size, { reversed = false } = {}) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	const points = [
		corner(x0, y0),
		corner(x0 + size, y0),
		corner(x0 + size, y0 + size),
		corner(x0, y0 + size),
	];
	return new Path({ name: 'Square', pathPoints: reversed ? points.reverse() : points });
}

/** The hooks every screen test needs */
export function setUpScreenTests() {
	let quiet;
	beforeAll(() => {
		if (!Element.prototype.animate)
			Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
		if (!customElements.get('anyink-coach')) customElements.define('anyink-coach', CoachElement);
		if (!customElements.get('anyink-save-status')) {
			customElements.define('anyink-save-status', SaveStatusElement);
		}
	});
	beforeEach(() => {
		localStorage.clear();
		resetToastsForTests();
		vi.stubGlobal('requestAnimationFrame', (fn) => setTimeout(fn, 0));
		quiet = [
			vi.spyOn(console, 'warn').mockImplementation(() => {}),
			vi.spyOn(console, 'error').mockImplementation(() => {}),
		];
	});
	afterEach(() => {
		quiet.forEach((spy) => spy.mockRestore());
		vi.unstubAllGlobals();
		resetCoachForTests();
		resetToastsForTests();
		eventHandlerData.toolHandoff = false;
		eventHandlerData.undoQueueHasChanged = false;
		document.body.innerHTML = '';
		document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
		setModeForTests('all');
	});
}
