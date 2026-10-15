// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 integration: the seams between the five tracks (top bar, coach, letter card, letter
	canvas, letter tools), each checked on one Simple screen as the app draws it, with the flags as
	the app has them ('coach' and 'letterView' on):
	  frame        the real Navigator draws the Simple top bar with the Next line under it, the
	               letter header, the letter card and, on an empty letter, the overlay
	  one green    exactly one shown green button (.anyink-primary) on every state: the overlay's
	               on an empty letter (the Next line's rule 8 has none), the Next line's on a
	               letter with ink (the card has none) (UX-BEGINNER.md principle 1, 9.4)
	  words        the whole screen says no banned word (2.3), strict
	  undo toasts  a hole's "Made shape 2 a hole" toast gives way to the undo toast at once (4.0
	               Toasts: undo outranks automatic), and the bar's Undo and Ctrl+Z say it once
	  pill / leave the status pill's state and the B1 leave warning agree (4.11)
	  letter set   the rail, the Next line and the letter header count the same letters
	  All tools    the same page in All tools has none of it
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasInkNotInItsFile } from '../../../app/app.js';
import { Path } from '../../../project_data/path.js';
import { QUICK_SET, NUMBERS_SET } from '../../board/letter_set.js';
import { CoachElement } from '../../coach/coach_element.js';
import { resetCoachForTests } from '../../coach/coach_state.js';
import { NUMBER_LETTERS, QUICK_LETTERS } from '../../coach/letter_order.js';
import { getSaveStatus, setSaveStatus, simpleStatusPill } from '../../files/save_status.js';
import { SaveStatusElement } from '../../files/save_status_element.js';
import { isFeatureOn } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { NUMBERS_SET as RAIL_NUMBERS, QUICK_SET as RAIL_QUICK } from '../../topbar/ready_count.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { autoHoleNewShape, sayMadeHole, shapeRole } from '../auto_hole.js';
import { NUMBERS_AND_SYMBOLS, QUICK_FONT } from '../letter_header.js';
import { setFineTuneOpen } from '../view_switches.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

/** The stylesheets that decide what shows (vitest skips CSS imports). */
function addStyles() {
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

/** A square path from (x0, y0), size font units; reversed: the other way round */
function square(x0, y0, size, { reversed = false } = {}) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	const points = [
		corner(x0, y0),
		corner(x0 + size, y0),
		corner(x0 + size, y0 + size),
		corner(x0, y0 + size),
	];
	return new Path({ name: 'Square', pathPoints: reversed ? points.reverse() : points });
}

/** The letter page on one letter, drawn by the real Navigator (small a: empty in the sample) */
function letterPage({ mode = 'simple', id = 'glyph-0x61' } = {}) {
	setModeForTests(mode);
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = id;
	editor.selectedGlyph;
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}

/** Lets the Next line draw (the coach batches its changes to the next frame) */
async function settle() {
	for (let i = 0; i < 4; i++) await new Promise((resolve) => setTimeout(resolve, 0));
	document.querySelector('anyink-coach')?.render?.();
	document.querySelector('anyink-coach')?.checkScreen?.();
	await new Promise((resolve) => setTimeout(resolve, 0));
}

const q = (selector) => document.querySelector(selector);
const shownEl = (element) => {
	for (let el = element; el && el.nodeType === 1; el = el.parentElement) {
		if (el.hidden || el.hasAttribute('data-anyink-hidden')) return false;
		if (getComputedStyle(el).display === 'none') return false;
	}
	return !!element;
};
const greens = () => [...document.querySelectorAll('.anyink-primary')].filter(shownEl);
const nextLine = () => q('anyink-coach');
const nextSentence = () => nextLine()?.querySelector('.anyink-coach__sentence')?.textContent || '';
const nextButton = () => {
	const button = nextLine()?.querySelector('.anyink-coach__button');
	return shownEl(button) ? button : null;
};

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
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

describe('the flags as the app has them', () => {
	it('B6 and B7 are on', () => {
		expect(isFeatureOn('coach')).toBe(true);
		expect(isFeatureOn('letterView')).toBe(true);
	});
});

describe('one Simple letter screen: the frame', () => {
	it('top bar with the Next line, letter header, letter card and the empty overlay', async () => {
		letterPage();
		await settle();
		expect(q('#app__top-bar').dataset.anyinkTopbar).toBe('simple');
		expect(q('#app__top-bar anyink-coach')).not.toBeNull();
		expect(document.querySelectorAll('anyink-coach')).toHaveLength(1);
		expect(q('.anyink-letter-header')).not.toBeNull();
		expect(q('.anyink-letter-card')).not.toBeNull();
		expect(shownEl(q('[data-anyink-overlay]'))).toBe(true);
		// no page chooser, no File or Help menu: the rail, the header and the Menu replace them
		expect(q('.top-bar__menus')).toBeNull();
		expect(shownEl(q('#nav-button-l1'))).toBe(false);
	});

	it('the Next line says the letter is empty, in plain words, with no button of its own', async () => {
		letterPage();
		await settle();
		expect(nextSentence()).toMatch(/^small a is empty\./);
		expect(nextButton()).toBeNull();
	});
});

describe('one green button (principle 1)', () => {
	it("an empty letter: the overlay's, and nothing else", async () => {
		letterPage();
		await settle();
		const shown = greens();
		expect(shown).toHaveLength(1);
		expect(shown[0].closest('[data-anyink-overlay]')).not.toBeNull();
	});

	it("a letter with ink, not saved: the Next line's [Save]; the card has none", async () => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('drew a square');
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		expect(shownEl(q('[data-anyink-overlay]'))).toBe(false);
		const shown = greens();
		expect(shown).toHaveLength(1);
		expect(shown[0].closest('anyink-coach')).not.toBeNull();
		expect(nextSentence()).toBe("Your work isn't saved yet.");
		expect(q('.anyink-letter-card .anyink-primary')).toBeNull();
	});

	it('Fine-tune open changes nothing about it', async () => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('drew a square');
		setFineTuneOpen(true, editor);
		await settle();
		expect(greens()).toHaveLength(1);
	});
});

describe('Fine-tune switches on screen (found in Chrome)', () => {
	it('the Neighbors switch is not on screen while his small n is not made; the others are', async () => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('drew a square');
		setFineTuneOpen(true, editor);
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		// by the stylesheet alone (a hidden attribute the CSS overrides still shows in Chrome)
		const shownSwitches = [...document.querySelectorAll('.anyink-letter-switch')]
			.filter((el) => getComputedStyle(el).display !== 'none')
			.map((el) => el.dataset.anyinkSwitch);
		expect(shownSwitches).toEqual(['darkPaper', 'outlineOnly', 'guideLetter']);
	});
});

describe('the whole screen says no banned word (2.3)', () => {
	scanSimpleScreen('an empty letter: top bar, Next line, header, card, overlay', async () => {
		letterPage();
		await settle();
		return q('#app__wrapper');
	});

	scanSimpleScreen('a letter with ink, Fine-tune open, a hole picked', async () => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(0, 0, 600));
		editor.selectedItem.addOneShape(square(200, 200, 200, { reversed: true }));
		editor.history.addState('drew two squares');
		editor.publish('currentItem', editor.selectedItem);
		q('[data-anyink-toggle="fineTune"]').click();
		q('[data-anyink-shape-row="1"]').click();
		await settle();
		expect(q('[data-anyink-kind-switch]')).not.toBeNull();
		return q('#app__wrapper');
	});
});

describe('undo toasts across the tracks', () => {
	it('"Made shape 2 a hole" gives way to the undo toast at once; one toast per press', () => {
		const editor = letterPage();
		const item = editor.selectedItem;
		item.addOneShape(square(0, 0, 600));
		editor.history.addState('Added path: Rectangle 1');
		const inner = item.addOneShape(square(200, 200, 200));
		const result = autoHoleNewShape(editor, inner);
		editor.history.addState('Added path: Rectangle 2');
		sayMadeHole(editor, inner, result);
		expect(shapeRole(item, inner)).toBe('hole');
		const showing = () => q('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		expect(showing().textContent).toContain('Made shape 2 a hole');
		resetToastsForTests();
		sayMadeHole(editor, inner, result);
		q('[data-anyink-control="undo"]').click();
		expect(showing().textContent).toContain('Undid: added a rectangle');
		expect(showing().textContent).not.toContain('Made shape 2 a hole');
		expect(toastLog().filter((record) => record.key?.startsWith('undo.'))).toHaveLength(1);
	});

	it('Ctrl+Z (History alone) does the same: the hole toast goes, the undo toast names the press', () => {
		const editor = letterPage();
		const item = editor.selectedItem;
		item.addOneShape(square(0, 0, 600));
		editor.history.addState('Added path: Rectangle 1');
		const inner = item.addOneShape(square(200, 200, 200));
		const result = autoHoleNewShape(editor, inner);
		editor.history.addState('Added path: Rectangle 2');
		sayMadeHole(editor, inner, result);
		const showing = () => q('#toast[data-anyink-toast="simple"]:not([data-leaving])');
		expect(showing().textContent).toContain('Made shape 2 a hole');
		editor.history.restoreState();
		expect(showing().textContent).toContain('Undid: added a rectangle');
		expect(editor.selectedItem.shapes).toHaveLength(1);
	});
});

describe('the status pill and the leave warning agree (4.11)', () => {
	it.each([
		['saved', 'saved', false],
		['saving', 'saving', true],
		['pending', 'not-saved', true],
		['failed', 'failed', true],
	])('file %s: the pill says %s; leaving warns: %s', (file, pill, warns) => {
		const editor = letterPage();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('drew a square');
		editor.loadedFileHandle = { kind: 'file', name: 'Brennan Hand.gs2' };
		setSaveStatus(editor, { file, queued: false });
		expect(simpleStatusPill(getSaveStatus(editor), { workFile: true }).status).toBe(pill);
		const leave = hasInkNotInItsFile(editor);
		expect(leave).toBe(warns);
	});
});

describe('one letter set for the rail, the Next line and the letter header', () => {
	it('the same 58 letters, then the same numbers and symbols', () => {
		[RAIL_QUICK, QUICK_LETTERS, QUICK_FONT].forEach((set) => expect(set).toBe(QUICK_SET));
		[RAIL_NUMBERS, NUMBER_LETTERS, NUMBERS_AND_SYMBOLS].forEach((set) =>
			expect(set).toBe(NUMBERS_SET)
		);
		expect(QUICK_SET).toHaveLength(58);
		expect(QUICK_SET.length + NUMBERS_SET.length).toBe(80);
	});
});

describe('All tools: the same page, unchanged', () => {
	it('no Simple bar, no Next line, no letter header, card or overlay', async () => {
		letterPage({ mode: 'all' });
		await settle();
		expect(q('#app__top-bar').dataset.anyinkTopbar).toBeUndefined();
		expect(q('.top-bar__menus')).not.toBeNull();
		expect(q('anyink-coach')).toBeNull();
		expect(q('.anyink-letter-header')).toBeNull();
		expect(q('.anyink-letter-card')).toBeNull();
		expect(q('[data-anyink-overlay]')).toBeNull();
		expect(greens()).toHaveLength(0);
	});
});
