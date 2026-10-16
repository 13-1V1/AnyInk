// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 fix pass: a Menu row that opens a dialog (Make my font file..., Font details..., the
// Help rows) takes the Menu away at once, with no fade. Upstream's context menu fades out over
// 120 ms; a dialog that opened in that time (Use in Word with a broken letter answers at once)
// showed the faded Menu rows behind it, over the board.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { USE_IN_WORD_EVENT } from '../../mode/doors.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { FONT_DETAILS_EVENT, HELP_EVENT } from '../doors.js';
import { setInstallEventForTests } from '../install_offer.js';
import { openSimpleMenu } from '../simple_menu.js';

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	localStorage.clear();
	resetPrefsCache();
	resetToastsForTests();
	setInstallEventForTests(null);
	document.body.innerHTML = '';
	setModeForTests('simple');
	setFeaturesForTests({ coach: true });
});
afterEach(() => {
	resetToastsForTests();
	setInstallEventForTests(null);
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

/** @returns {{ button: HTMLButtonElement, menu: HTMLElement }} the Menu, open */
function openMenu() {
	const editor = twoLetterEditor();
	const button = document.createElement('button');
	document.body.appendChild(button);
	const menu = openSimpleMenu(button, editor);
	return { button, menu };
}

/** @param {HTMLElement} menu @param {String} id @returns {HTMLElement} the row's clickable box */
const rowBox = (menu, id) => menu.querySelector(`[data-anyink-row="${id}"]`).closest('.context-menu-row');

describe('a row that opens a dialog closes the Menu at once', () => {
	it.each([
		['make-font-file', USE_IN_WORD_EVENT],
		['font-details', FONT_DETAILS_EVENT],
		['help-how', HELP_EVENT],
		['help-words', HELP_EVENT],
	])('%s: the Menu is gone in the click, before the dialog opens', async (id, event) => {
		const { button, menu } = openMenu();
		let menuWhenOpened = 'not opened';
		const door = () => {
			menuWhenOpened = document.querySelector('#context-menu');
		};
		window.addEventListener(event, door);
		rowBox(menu, id).click();
		window.removeEventListener(event, door);
		expect(menuWhenOpened).toBeNull();
		expect(menu.isConnected).toBe(false);
		expect(document.querySelector('#context-menu')).toBeNull();
		await Promise.resolve();
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('a press on a group heading does not take the Menu away at once', () => {
		const { menu } = openMenu();
		menu.querySelector('h2').closest('.context-menu-row, .spanAll').click();
		expect(menu.isConnected).toBe(true);
	});
});
