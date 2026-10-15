// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 6.1): changing the mode mirrors it to html[data-ui-mode] and calls
// navigate(), so the page is drawn again with the other mode's controls. A page the new mode
// hides is left for Simple's home (the letter view now, the board once B10 lands). Nothing is
// redrawn while an app-level page (the start page) is showing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn } from '../features.js';
import { MODE_EVENT, getMode, getVisit, setMode, setModeForTests } from '../mode.js';
import { PAGE_EVENT, editorPageShowing, pageAfterSwitch, switchMode } from '../switch.js';

/** A stand-in editor: the page it is on, and a navigate() that counts. */
function fakeEditor(page = 'Characters') {
	return { nav: { page }, navigate: vi.fn() };
}
const announce = (appLevel) =>
	window.dispatchEvent(
		new CustomEvent(PAGE_EVENT, {
			detail: { page: appLevel ? 'app-level' : 'Characters', appLevel },
		})
	);

beforeEach(() => announce(false));
afterEach(() => setModeForTests('all'));

describe('switchMode', () => {
	it('sets the mode, mirrors it and navigates once', () => {
		const editor = fakeEditor();
		expect(switchMode('simple', { editor })).toBe(true);
		expect(getMode()).toBe('simple');
		expect(document.documentElement.getAttribute('data-ui-mode')).toBe('simple');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
		expect(editor.nav.page).toBe('Characters');
	});

	it('announces the change once', () => {
		const seen = [];
		const listen = (event) => seen.push(event.detail.mode);
		window.addEventListener(MODE_EVENT, listen);
		switchMode('simple', { editor: fakeEditor() });
		switchMode('simple', { editor: fakeEditor() });
		window.removeEventListener(MODE_EVENT, listen);
		expect(seen).toEqual(['simple']);
	});

	it('does nothing for the mode already on, or a mode that does not exist', () => {
		const editor = fakeEditor();
		expect(switchMode('all', { editor })).toBe(false);
		expect(switchMode('expert', { editor })).toBe(false);
		expect(getMode()).toBe('all');
		expect(editor.navigate).not.toHaveBeenCalled();
	});

	it('to Simple from a page Simple hides: goes to Simple’s home first', () => {
		const editor = fakeEditor('Kerning');
		switchMode('simple', { editor, isOn: flagsOn() });
		expect(editor.nav.page).toBe('Characters');
		const later = fakeEditor('Settings');
		setModeForTests('all');
		switchMode('simple', { editor: later, isOn: flagsOn('board') });
		expect(later.nav.page).toBe('Overview');
	});

	it('to All tools: stays on the page (All tools shows every page)', () => {
		setModeForTests('simple');
		const editor = fakeEditor('Help');
		switchMode('all', { editor });
		expect(editor.nav.page).toBe('Help');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('takes the page to go to', () => {
		setModeForTests('simple');
		const editor = fakeEditor('Characters');
		switchMode('all', { editor, page: 'Kerning' });
		expect(editor.nav.page).toBe('Kerning');
	});

	it('an explicit switch ends a visit (it is now his choice), and counts as a change', () => {
		setMode('simple');
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		const editor = fakeEditor('Kerning');
		expect(switchMode('all', { editor })).toBe(true);
		expect(getVisit()).toBe(null);
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('redraws nothing while an app-level page (the start page) is showing', () => {
		announce(true);
		expect(editorPageShowing()).toBe(false);
		const editor = fakeEditor();
		expect(switchMode('simple', { editor })).toBe(true);
		expect(getMode()).toBe('simple');
		expect(editor.navigate).not.toHaveBeenCalled();
		announce(false);
		expect(editorPageShowing()).toBe(true);
	});

	it('uses the current editor when none is passed', async () => {
		const { setCurrentProjectEditor, getCurrentProjectEditor } = await import(
			'../../../app/main.js'
		);
		const before = getCurrentProjectEditor();
		const editor = fakeEditor();
		setCurrentProjectEditor(editor);
		try {
			switchMode('simple');
			expect(editor.navigate).toHaveBeenCalledTimes(1);
		} finally {
			setCurrentProjectEditor(before);
		}
	});
});

describe('pageAfterSwitch', () => {
	it('keeps a page the mode shows and sends the rest to Simple’s home', () => {
		const none = flagsOn();
		expect(pageAfterSwitch('Characters', 'simple', none)).toBe('Characters');
		expect(pageAfterSwitch('Help', 'simple', none)).toBe('Help');
		expect(pageAfterSwitch('Ligatures', 'simple', none)).toBe('Characters');
		expect(pageAfterSwitch('Ligatures', 'all', none)).toBe('Ligatures');
		expect(pageAfterSwitch('Global actions', 'simple', flagsOn('board'))).toBe('Overview');
	});
});
