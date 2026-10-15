// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the banned-word scan (UX-BEGINNER.md 2.3, principle 2) on the Simple top bar's screens, with
// its helper (words/tests/banned_scan.js, strict: 2.4 E and G too): the bar on a new font and on a
// font with ink, the Menu (with only B6 landed, and with every later row on), the status pill in
// its four states and the Fix box, and the undo and redo toasts in a letter and on the board.
// Visible text, title, aria-label and sentence case (the bar's own CSS is on the page).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, vi } from 'vitest';
import { makeAppTopBar } from '../../../app/menu.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { setSaveStatus } from '../../files/save_status.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { showItem } from '../../preview/show_item.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { setInstallEventForTests } from '../install_offer.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');
const EVERY_LATER_B = {
	letterView: true,
	photo: true,
	board: true,
	tryIt: true,
	startScreen: true,
	useInWord: true,
	fontDetails: true,
	help: true,
};

/** The stylesheets the sentence-case check needs (vitest skips CSS imports). */
function addStyles(...paths) {
	paths.forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = css(path);
		document.head.appendChild(style);
	});
}

beforeAll(() => {
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
});
let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	localStorage.clear();
	resetPrefsCache();
	resetToastsForTests();
	document.body.innerHTML = '';
	addStyles(
		'anyink/theme/tokens.css',
		'app/app.css',
		'controls/dialogs/dialogs.css',
		'anyink/topbar/simple_top_bar.css',
		'anyink/toast/toast.css'
	);
});
afterEach(() => {
	resetToastsForTests();
	setInstallEventForTests(null);
	warn.mockRestore();
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

/** The Simple top bar on the page, a two-letter font open on Capital B. */
function barOn({ flags = {}, page = 'Characters' } = {}) {
	setFeaturesForTests({ coach: true, ...flags });
	const editor = twoLetterEditor({ page });
	showItem(editor, B);
	editor.nav.page = page;
	editor.navigate = vi.fn();
	const wrapper = document.createElement('div');
	wrapper.id = 'app__wrapper';
	wrapper.appendChild(makeAppTopBar());
	document.body.appendChild(wrapper);
	return { editor, bar: wrapper.firstElementChild };
}

describe('the Simple top bar says no banned word', () => {
	scanSimpleScreen(
		'a new font: the bar, its tooltips and the greyed Undo / Redo',
		() => barOn().bar
	);

	scanSimpleScreen(
		'every later B landed: Try it, Use in Word, Font details',
		() => barOn({ flags: EVERY_LATER_B }).bar
	);

	scanSimpleScreen('a traced letter: the count, "Undo: traced Capital B"', () => {
		const { editor, bar } = barOn();
		traceInto(editor);
		return bar;
	});

	scanSimpleScreen('the newest change on another letter: "Undo: added a rectangle on small r"', () => {
		const { editor, bar } = barOn();
		showItem(editor, R);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		editor.selectedItem.addOneShape(square(300, 100));
		editor.history.addState('Added path: Rectangle 2');
		editor.history.restoreState(); // Undo names one rectangle, Redo the other
		editor.selectedGlyphID = B;
		['undo', 'redo'].forEach((control) =>
			bar.querySelector(`[data-anyink-control="${control}"]`).dispatchEvent(new Event('focus'))
		);
		return bar;
	});

	scanSimpleScreen('the Menu with only the top bar landed', () => {
		const { bar } = barOn();
		bar.querySelector('[data-anyink-control="menu"]').click();
		return document.body;
	});

	scanSimpleScreen('the Menu with every later row on, Install offered', () => {
		setInstallEventForTests({ prompt() {}, userChoice: Promise.resolve({}) });
		const { bar } = barOn({ flags: EVERY_LATER_B });
		bar.querySelector('[data-anyink-control="menu"]').click();
		return document.body;
	});

	scanSimpleScreen('the status pill in its four states, and the Fix box', () => {
		const { editor, bar } = barOn();
		const pill = bar.querySelector('[data-anyink-control="status"]');
		const seen = [];
		['saving', 'saved', 'pending', 'failed'].forEach((file) => {
			setSaveStatus(editor, { file, error: 'The disk is full' });
			seen.push(pill.textContent, pill.querySelector('anyink-save-status').title);
			pill.querySelectorAll('button').forEach((button) => seen.push(button.title));
		});
		pill.querySelector('[data-anyink-control="statusButton"]').click();
		return { root: document.body, texts: { 'status pill': seen } };
	});
});

describe('the undo and redo toasts say no banned word', () => {
	scanSimpleScreen('in a letter: Undid, then Redid', () => {
		const { editor, bar } = barOn();
		traceInto(editor);
		bar.querySelector('[data-anyink-control="undo"]').click();
		bar.querySelector('[data-anyink-control="redo"]').click();
		return document.body;
	});

	scanSimpleScreen('on the board: Undid with Show me; a shape on another letter', () => {
		const { editor, bar } = barOn();
		traceInto(editor);
		showItem(editor, R);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		editor.nav.page = 'Overview';
		bar.querySelector('[data-anyink-control="undo"]').click();
		bar.querySelector('[data-anyink-control="undo"]').click();
		return document.body;
	});

	scanSimpleScreen('upstream titles: an auto-trace, a moved guide line, a whole-font step', () => {
		const { editor, bar } = barOn();
		editor.history.addState('Auto-traced 3 shapes (120 points)');
		bar.querySelector('[data-anyink-control="undo"]').click();
		editor.history.addState('Moved baseline');
		bar.querySelector('[data-anyink-control="undo"]').click();
		return document.body;
	});
});
