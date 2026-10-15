// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 6.1, 6.3, 4.11): the real Navigator.navigate runs the landing rule
// before it draws, and draws the purple band under the top bar (menu.js makeAppBand). On the
// real History: a More tools change on the Kerning page, then Simple's Undo from the keys lands
// there; the page draws with More tools' controls and the band says Undo took him there; Back to
// my letters is Simple on the letter page again. The choosers list only what the mode shows
// (Simple keeps the page chooser, with its four pages, until B6's rail: fix track).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { toggleNavDropdown } from '../../../project_editor/navigator.js';
import { turnOnMoreTools } from '../band.js';
import { setFeaturesForTests } from '../features.js';
import { getMode, getVisit, setModeForTests } from '../mode.js';
import { word } from '../../words/words.js';
import { sampleEditor } from './controls_probe.js';

let editor;
let warn;

const wrapper = () => document.querySelector('#app__wrapper');
const band = () => document.querySelector('#app__wrapper > .anyink-band');
const visible = (selector) => {
	const element = document.querySelector(selector);
	return !!element && !element.hasAttribute('data-anyink-hidden');
};

function openPage(page) {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.navigate();
	editor.editCanvas = { redraw() {} };
}
function ctrl(key) {
	const send = (type, name, options = {}) => {
		const event = new KeyboardEvent(type, {
			key: name,
			bubbles: true,
			cancelable: true,
			...options,
		});
		if (type === 'keydown') handleKeyPress(event);
		else handleKeyUp(event);
	};
	send('keydown', 'Control');
	send('keydown', key, { ctrlKey: true });
	send('keyup', key, { ctrlKey: true });
	send('keyup', 'Control');
}
function chooserRows(level) {
	toggleNavDropdown(document.querySelector(`#nav-button-${level}`));
	const dropdown = document.querySelector(`#nav-dropdown-${level === 'l1' ? 'page' : 'panel'}`);
	const rows = [...dropdown.querySelectorAll('h3, .nav-dropdown__button')].map((row) =>
		row.tagName === 'H3' ? `# ${row.textContent.trim()}` : row.textContent.trim()
	);
	dropdown.remove();
	return rows;
}

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = sampleEditor();
	editor.selectedGlyphID = 'glyph-0x41';
});
afterEach(() => {
	warn.mockRestore();
	eventHandlerData.isCtrlDown = false;
	document.body.innerHTML = '';
});

describe('the band under the top bar', () => {
	it('All tools as the launch default: no band, exactly as today', () => {
		openPage('Characters');
		expect(band()).toBeNull();
		expect([...wrapper().children].map((child) => child.id)).toEqual([
			'app__top-bar',
			'app__main-content',
		]);
	});

	it('More tools turned on from Simple: the band, between the top bar and the page', () => {
		setModeForTests('simple');
		openPage('Characters');
		expect(band()).toBeNull();
		turnOnMoreTools({ editor });
		expect(getMode()).toBe('all');
		expect(band().dataset.anyinkBand).toBe('moreTools');
		expect([...wrapper().children].map((child) => child.id || child.className)).toEqual([
			'app__top-bar',
			'anyink-band',
			'app__main-content',
		]);
		// every More tools control is back
		expect(visible('#nav-button-l1') && visible('#nav-button-l3')).toBe(true);
	});
});

describe("the landing rule on the real navigate (Simple's Undo to the Kerning page)", () => {
	it('lands on Kerning with More tools on; Back to my letters is Simple on the letter page', () => {
		openPage('Kerning');
		const group = Object.keys(editor.project.kerning)[0];
		editor.selectedKernGroupID = group;
		editor.selectedKernGroup.value += 10;
		editor.history.addState(`Nudged kern group ${group} by 10`);

		setModeForTests('simple');
		openPage('Characters');
		expect(visible('#nav-button-l3')).toBe(false);

		ctrl('z');
		expect(editor.nav.page).toBe('Kerning');
		expect(getVisit()).toEqual({ page: 'Kerning', cause: 'undo' });
		expect(band().dataset.anyinkBand).toBe('landed');
		expect(band().textContent).toContain(word('mode.band.landedUndo'));
		// drawn with More tools' controls: the page and panel choosers are there
		expect(visible('#nav-button-l1') && visible('#nav-button-l3')).toBe(true);

		band().querySelector('button').click();
		expect(getMode()).toBe('simple');
		expect(editor.nav.page).toBe('Characters');
		expect(band()).toBeNull();
		expect(visible('#nav-button-l3')).toBe(false);
	});
});

describe('the choosers list what the mode shows (6.3)', () => {
	it('All tools: every page under its heading, every panel', () => {
		openPage('Characters');
		expect(chooserRows('l1')).toEqual([
			'Overview',
			'# Design glyphs',
			'Characters',
			'Ligatures',
			'Components',
			'# Refine',
			'Kerning',
			'Live preview',
			'Global actions',
			'# Settings & more',
			'Settings',
			'Help',
			'About',
		]);
		expect(chooserRows('l3')).toHaveLength(9);
	});

	it("Simple: the page chooser lists only Simple's pages, in its words; the panel chooser is hidden and empty", () => {
		setModeForTests('simple');
		openPage('Characters');
		expect(visible('#nav-button-l1')).toBe(true);
		expect(visible('#nav-button-l2')).toBe(true);
		expect(visible('#nav-button-l3')).toBe(false);
		expect(chooserRows('l1')).toEqual(['All letters', 'One letter', 'Help', 'About ANY-INK']);
		expect(chooserRows('l3')).toEqual([]);
	});

	it('Simple with the letter view on: the letter button goes too (the letter header replaces it)', () => {
		setModeForTests('simple');
		setFeaturesForTests({ letterView: true });
		openPage('Characters');
		expect(visible('#nav-button-l2')).toBe(false);
	});

	it('Simple: the page draws with no panel in the panel area', () => {
		setModeForTests('simple');
		openPage('Characters');
		expect(document.querySelector('#editor-page__panel').textContent.trim()).toBe('');
	});
});
