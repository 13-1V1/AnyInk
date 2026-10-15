// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.0 "Top bar", 4.11): in Simple, once the 'coach' flag is on, makeAppTopBar
// draws the Simple top bar: the logo (goes to the letters), the font name, the rail "1 Letters
// 0/58" (2 Try it and 3 Use in Word only once their Bs land), Undo and Redo (named, and saying why
// when they can't act), the status pill with its four states, More tools and Menu, with the Next
// line (<anyink-coach>) as its second row. All tools, and Simple with the flag off, keep today's
// top bar exactly.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makeAppTopBar } from '../../../app/menu.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { setSaveStatus } from '../../files/save_status.js';
import { getCoach, resetCoachForTests } from '../../coach/coach_state.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { USE_IN_WORD_EVENT } from '../../mode/doors.js';
import { getMode, setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { FONT_DETAILS_EVENT, TRY_IT_EVENT } from '../doors.js';
import { makeSimpleTopBar, refreshSimpleTopBar, useSimpleTopBar } from '../simple_top_bar.js';

const $ = (bar, control) => bar.querySelector(`[data-anyink-control="${control}"]`);
const toastText = () =>
	document.querySelector(
		'#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text'
	)?.textContent ?? null;

beforeAll(() => {
	if (!customElements.get('anyink-save-status')) {
		customElements.define('anyink-save-status', SaveStatusElement);
	}
});
let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	resetToastsForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	resetToastsForTests();
	resetCoachForTests();
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

/** Simple with the top bar on, a two-letter font open on Capital B, the bar on the page. */
function simpleBar({ page = 'Characters', flags = {} } = {}) {
	setModeForTests('simple');
	setFeaturesForTests({ coach: true, ...flags });
	const editor = twoLetterEditor({ page });
	showItem(editor, B);
	editor.nav.page = page;
	editor.navigate = vi.fn();
	const bar = makeAppTopBar();
	document.body.appendChild(bar);
	return { editor, bar };
}

describe('which top bar', () => {
	it('Simple with the coach flag on: the Simple top bar', () => {
		setModeForTests('simple');
		expect(useSimpleTopBar()).toBe(true); // B6 has landed: the flag is on in the app
		setFeaturesForTests({ coach: false });
		expect(useSimpleTopBar()).toBe(false);
		setFeaturesForTests({ coach: true });
		expect(useSimpleTopBar()).toBe(true);
		setModeForTests('all');
		expect(useSimpleTopBar()).toBe(false);
	});

	it("All tools (even with the flag on) and Simple with it off: today's top bar, unchanged", () => {
		twoLetterEditor();
		setFeaturesForTests({ coach: true });
		const all = makeAppTopBar();
		expect(all.classList.contains('anyink-topbar')).toBe(false);
		expect(all.querySelector('.top-bar__menus')).not.toBeNull();
		setModeForTests('simple');
		setFeaturesForTests({ coach: false });
		const simpleOff = makeAppTopBar();
		expect(simpleOff.classList.contains('anyink-topbar')).toBe(false);
		expect(simpleOff.querySelector('.top-bar__menus')).not.toBeNull();
	});

	it('the frame of 4.0: logo, font name, rail, Undo, Redo, status, More tools, Menu; the Next line under it', () => {
		const { bar } = simpleBar();
		expect(bar.id).toBe('app__top-bar');
		expect(bar.dataset.anyinkTopbar).toBe('simple');
		const order = [...bar.querySelectorAll('.anyink-topbar__row > [data-anyink-control]')].map(
			(el) => el.dataset.anyinkControl
		);
		expect(order).toEqual([
			'logo',
			'fontName',
			'rail',
			'undo',
			'redo',
			'status',
			'moreTools',
			'menu',
		]);
		const next = bar.querySelector('anyink-coach');
		expect(next).not.toBeNull();
		expect(next.previousElementSibling.classList.contains('anyink-topbar__row')).toBe(true);
		// the save status the notices and the leave check read is still there
		expect(bar.querySelector('anyink-save-status')).not.toBeNull();
	});
});

describe('logo and font name', () => {
	it('the logo goes to the letters: where "<- All letters" goes (Overview), the board once B10 lands', () => {
		const { editor, bar } = simpleBar({ page: 'Help' });
		$(bar, 'logo').click();
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
		setFeaturesForTests({ board: true });
		editor.nav.page = 'Help';
		$(bar, 'logo').click();
		expect(editor.nav.page).toBe('Overview');
		// with the letter view (B7) off too: still the letters, never the letter view itself
		setFeaturesForTests({ board: false, letterView: false });
		editor.nav.page = 'Characters';
		$(bar, 'logo').click();
		expect(editor.nav.page).toBe('Overview');
	});

	// B6 fix (first-timer 45a / 45b): in the letter view the logo did nothing at all
	it('the logo leaves the letter view (it went to the page he was already on)', () => {
		const { editor, bar } = simpleBar({ page: 'Characters' });
		$(bar, 'logo').click();
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('the font name is words only until Font details (B15) lands; then it opens it', () => {
		const { bar } = simpleBar();
		const name = $(bar, 'fontName');
		expect(name.textContent).toBe('Two Letters');
		expect(name.tagName).not.toBe('BUTTON');
		document.body.innerHTML = '';
		const later = simpleBar({ flags: { fontDetails: true } }).bar;
		const opened = vi.fn();
		window.addEventListener(FONT_DETAILS_EVENT, opened);
		$(later, 'fontName').click();
		window.removeEventListener(FONT_DETAILS_EVENT, opened);
		expect($(later, 'fontName').tagName).toBe('BUTTON');
		expect(opened).toHaveBeenCalledTimes(1);
	});

	it('a new font name shows at once (a settings step), and its Undo puts the old one back', () => {
		const { editor, bar } = simpleBar();
		editor.project.settings.project.name = 'Brennan Hand';
		editor.history.addSettingsState('named the font Brennan Hand');
		expect($(bar, 'fontName').textContent).toBe('Brennan Hand');
		$(bar, 'undo').click();
		expect($(bar, 'fontName').textContent).toBe('Two Letters');
	});
});

describe('the rail', () => {
	const step = (bar, id) => bar.querySelector(`[data-anyink-step="${id}"]`);

	it('"1 Letters 0/58", outlined green (current) on a letter; its tooltip says the count', () => {
		const { bar } = simpleBar();
		const letters = step(bar, 'letters');
		expect(letters.querySelector('.anyink-topbar__step-number').textContent).toBe('1');
		expect(letters.querySelector('.anyink-topbar__step-name').textContent).toBe('Letters');
		expect(letters.querySelector('.anyink-topbar__step-count').textContent).toBe('0/58');
		expect(letters.getAttribute('aria-current')).toBe('step');
		expect(letters.title).toBe(word('topbar.step.lettersTip', { ready: 0, total: 58 }));
	});

	it('the count follows the font: a traced letter makes it 1/58 (on the save status event)', () => {
		const { editor, bar } = simpleBar();
		traceInto(editor);
		expect(step(bar, 'letters').querySelector('.anyink-topbar__step-count').textContent).toBe(
			'1/58'
		);
	});

	it('not current on Help or About; the board is current too', () => {
		expect(step(simpleBar({ page: 'Help' }).bar, 'letters').hasAttribute('aria-current')).toBe(
			false
		);
		document.body.innerHTML = '';
		expect(step(simpleBar({ page: 'Overview' }).bar, 'letters').getAttribute('aria-current')).toBe(
			'step'
		);
	});

	it('Letters goes to the letters', () => {
		const { editor, bar } = simpleBar({ page: 'Help' });
		step(bar, 'letters').click();
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalled();
	});

	// B6 fix (first-timer 45a / 45b): "1 Letters 4/58" in small b did nothing; it goes where the
	// letter view's own "<- All letters" goes
	it('Letters leaves the letter view, to where "<- All letters" goes', () => {
		const { editor, bar } = simpleBar({ page: 'Characters' });
		step(bar, 'letters').click();
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('no doors to unbuilt rooms: Try it and Use in Word show only once their Bs land', () => {
		const { bar } = simpleBar();
		expect(step(bar, 'tryIt')).toBeNull();
		expect(step(bar, 'useInWord')).toBeNull();
		document.body.innerHTML = '';
		const later = simpleBar({ flags: { tryIt: true, useInWord: true } }).bar;
		expect(
			[...later.querySelectorAll('[data-anyink-step]')].map((el) => el.dataset.anyinkStep)
		).toEqual(['letters', 'tryIt', 'useInWord']);
		expect(step(later, 'tryIt').textContent).toBe('2Try it');
		expect(step(later, 'useInWord').textContent).toBe('3Use in Word');
		const tryIt = vi.fn();
		const useInWord = vi.fn();
		window.addEventListener(TRY_IT_EVENT, tryIt);
		window.addEventListener(USE_IN_WORD_EVENT, useInWord);
		step(later, 'tryIt').click();
		step(later, 'useInWord').click();
		window.removeEventListener(TRY_IT_EVENT, tryIt);
		window.removeEventListener(USE_IN_WORD_EVENT, useInWord);
		expect(tryIt).toHaveBeenCalledTimes(1);
		expect(useInWord.mock.calls[0][0].detail).toEqual({ cause: 'rail' });
	});

	it("the rail ends with the Next line's chip, hidden while the line shows; x hides the line, the chip brings it back", () => {
		const { bar } = simpleBar();
		const slot = bar.querySelector('[data-anyink-slot="next-chip"]');
		expect(slot.parentElement.dataset.anyinkControl).toBe('rail');
		const chip = slot.querySelector('.anyink-coach-chip');
		expect(chip).not.toBeNull();
		expect(chip.hidden).toBe(true);
		getCoach().hide();
		expect(chip.hidden).toBe(false);
		chip.click();
		expect(getCoach().isHidden()).toBe(false);
		expect(chip.hidden).toBe(true);
	});
});

describe('Undo and Redo buttons', () => {
	it('a new font: both greyed, each saying why in its tooltip; a press does nothing', () => {
		const { editor, bar } = simpleBar();
		const undo = $(bar, 'undo');
		const redo = $(bar, 'redo');
		expect(undo.getAttribute('aria-disabled')).toBe('true');
		expect(undo.title).toBe('Nothing to undo yet');
		expect(redo.getAttribute('aria-disabled')).toBe('true');
		expect(redo.title).toBe('Nothing to redo');
		const restore = vi.spyOn(editor.history, 'restoreState');
		undo.click();
		expect(restore).not.toHaveBeenCalled();
		expect(undo.textContent).toBe('Undo');
		expect(redo.textContent).toBe('Redo');
	});

	it('after a trace: Undo is live and named; pressing it undoes, toasts, and Redo comes alive', () => {
		const { editor, bar } = simpleBar();
		traceInto(editor);
		const undo = $(bar, 'undo');
		expect(undo.getAttribute('aria-disabled')).toBe('false');
		expect(undo.title).toBe('Undo: traced Capital B');
		undo.click();
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
		expect(toastText()).toBe('Undid: traced Capital B');
		expect(undo.getAttribute('aria-disabled')).toBe('true');
		const redo = $(bar, 'redo');
		expect(redo.getAttribute('aria-disabled')).toBe('false');
		expect(redo.title).toBe('Redo: traced Capital B');
		redo.click();
		expect(editor.project.glyphs[B].shapes).toHaveLength(1);
		expect(toastText()).toBe('Redid: traced Capital B');
		expect(redo.getAttribute('aria-disabled')).toBe('true');
	});

	// B6 fix (first-timer 48 / 49): the newest change is on small r and small B is open: the
	// tooltip warns that Undo goes to r, in the toast's words
	it('the newest change on another letter: "Undo: added a rectangle on small r"', () => {
		const { editor, bar } = simpleBar();
		showItem(editor, R);
		editor.selectedItem.addOneShape(square());
		editor.history.addState('Added path: Rectangle 1');
		expect($(bar, 'undo').title).toBe('Undo: added a rectangle');
		// the letter view's own "< A" / "C >" open a letter with no navigate and no save status
		// event: the tooltip is brought up to date as the pointer comes over it, or on focus
		editor.selectedGlyphID = B;
		$(bar, 'undo').dispatchEvent(new Event('pointerenter'));
		expect($(bar, 'undo').title).toBe('Undo: added a rectangle on small r');
		editor.selectedGlyphID = R;
		$(bar, 'undo').dispatchEvent(new Event('focus'));
		expect($(bar, 'undo').title).toBe('Undo: added a rectangle');
		// on the board no letter is open: named
		editor.nav.page = 'Overview';
		refreshSimpleTopBar(document);
		expect($(bar, 'undo').title).toBe('Undo: added a rectangle on small r');
		// the press says the same letter
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = B;
		$(bar, 'undo').click();
		expect(toastText()).toBe('Undid: added a rectangle on small r');
		expect($(bar, 'redo').title).toBe('Redo: added a rectangle');
		editor.selectedGlyphID = B;
		$(bar, 'redo').dispatchEvent(new Event('pointerenter'));
		expect($(bar, 'redo').title).toBe('Redo: added a rectangle on small r');
	});

	it('refreshSimpleTopBar brings a bar up to date by hand (the test page, a rebuilt bar)', () => {
		const { editor, bar } = simpleBar();
		showItem(editor, R);
		editor.history.queue.unshift({ title: 'Added path: Oval 1', itemID: R });
		refreshSimpleTopBar(document);
		expect($(bar, 'undo').title).toBe('Undo: added an oval');
	});
});

describe('the status pill (4.11)', () => {
	const pill = (bar) => $(bar, 'status');
	const button = (bar) => pill(bar).querySelector('[data-anyink-control="statusButton"]');

	it('a font with no work file: "Not saved yet [Save]"; Save saves', () => {
		const { editor, bar } = simpleBar();
		const save = vi.spyOn(editor, 'saveProjectFile').mockResolvedValue(true);
		expect(pill(bar).dataset.status).toBe('not-saved');
		expect(pill(bar).querySelector('anyink-save-status').textContent).toBe('Not saved yet');
		expect(button(bar).hidden).toBe(false);
		expect(button(bar).textContent).toBe('Save');
		button(bar).click();
		expect(save).toHaveBeenCalledWith();
	});

	it('Saving... and Saved: no button', () => {
		const { editor, bar } = simpleBar();
		setSaveStatus(editor, { file: 'saving' });
		expect(pill(bar).dataset.status).toBe('saving');
		expect(button(bar).hidden).toBe(true);
		setSaveStatus(editor, { file: 'saved' });
		expect(pill(bar).dataset.status).toBe('saved');
		expect(pill(bar).querySelector('anyink-save-status').textContent).toBe('Saved');
		expect(button(bar).hidden).toBe(true);
	});

	it('"Couldn\'t save [Fix]": Fix says it plainly, with [Try again] and [Save somewhere else]', () => {
		const { editor, bar } = simpleBar();
		editor.loadedFileHandle = {
			kind: 'file',
			name: 'Two Letters.gs2',
			getFile() {},
			createWritable() {},
			queryPermission() {},
			requestPermission() {},
		};
		const save = vi.spyOn(editor, 'saveProjectFile').mockResolvedValue(true);
		setSaveStatus(editor, { file: 'failed', error: 'The disk is full' });
		expect(pill(bar).dataset.status).toBe('failed');
		expect(button(bar).textContent).toBe('Fix');
		button(bar).click();
		const box = document.querySelector('#error[data-anyink-error="error.saveFailed"]');
		expect(box).not.toBeNull();
		expect(box.textContent).toContain("Couldn't save to");
		expect(box.textContent).toContain('A backup copy is kept.');
		expect(box.textContent).not.toContain('disk is full');
		const choices = [...box.querySelectorAll('[data-anyink-choice]')].map(
			(el) => el.dataset.anyinkChoice
		);
		expect(choices).toEqual(['error.button.tryAgain', 'error.button.saveElsewhere']);
		box.querySelector('[data-anyink-choice="error.button.tryAgain"]').click();
		expect(save).toHaveBeenLastCalledWith();
		button(bar).click();
		document.querySelector('#error [data-anyink-choice="error.button.saveElsewhere"]').click();
		expect(save).toHaveBeenLastCalledWith(true);
	});
});

describe('More tools and Menu', () => {
	it('More tools turns on All tools, on the same page', () => {
		const { editor, bar } = simpleBar();
		$(bar, 'moreTools').click();
		expect(getMode()).toBe('all');
		expect(editor.nav.page).toBe('Characters');
		expect(editor.navigate).toHaveBeenCalled();
	});

	it('Menu opens the menu under it, and says so to a screen reader', () => {
		const { bar } = simpleBar();
		const menu = $(bar, 'menu');
		expect(menu.getAttribute('aria-haspopup')).toBe('menu');
		menu.click();
		expect(document.querySelector('#context-menu[data-anyink-menu="simple"]')).not.toBeNull();
	});
});
