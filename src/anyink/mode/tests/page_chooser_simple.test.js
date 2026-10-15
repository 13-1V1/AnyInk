// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track (UX-BEGINNER.md principle 7 "always a way home", 7.1 dead ends, 6.2 "Kept in
// Simple: Overview, Characters, Help, About"; D-035 keeps each upstream control until the B that
// replaces it lands): Simple keeps the page chooser until B6's rail and "<- All letters" replace
// it, so Help and About are never a dead end and the Overview is one click from a letter. In Simple
// it lists only Simple's four pages, in house words, with no Glyphr Studio headings; picking one
// is looking around, never an Undo step. Once B6's top bar ('coach') lands it goes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toggleNavDropdown } from '../../../project_editor/navigator.js';
import { setFeaturesForTests } from '../features.js';
import { noFlags } from './no_flags.js';
import { getMode, setModeForTests } from '../mode.js';
import { findBanned } from '../../words/banned.js';
import { word } from '../../words/words.js';
import { isVisible, sampleEditor } from './controls_probe.js';

let editor;
let warn;

function openPage(page) {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.navigate();
	editor.editCanvas = { redraw() {} };
}
const pageButton = () => document.querySelector('#nav-button-l1');
const shown = (element) => !!element && isVisible(element) && !element.hasAttribute('data-anyink-hidden');
const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
function openChooser() {
	toggleNavDropdown(pageButton());
	return document.querySelector('#nav-dropdown-page');
}
const rows = (dropdown) =>
	[...dropdown.querySelectorAll('h3, .nav-dropdown__button')].map((row) =>
		row.tagName === 'H3' ? `# ${text(row)}` : text(row)
	);

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = sampleEditor();
	editor.selectedGlyphID = 'glyph-0x41';
});
afterEach(() => {
	warn.mockRestore();
	document.body.innerHTML = '';
});

describe('Simple with no flag: the page chooser stays, in house words', () => {
	beforeEach(() => {
		setModeForTests('simple');
		noFlags(); // B6 + B7 turned their flags on in the app; this pins B5's stub
	});

	it.each([
		['Help', 'Help'],
		['About', 'About ANY-INK'],
		['Overview', 'All letters'],
		['Characters', 'One letter'],
	])('on %s the page button shows, named "%s"', (page, name) => {
		openPage(page);
		expect(shown(pageButton()), page).toBe(true);
		expect(text(pageButton().querySelector('.nav-button__super-title'))).toBe(word('nav.page'));
		expect(text(pageButton().querySelector('.nav-button__title'))).toBe(name);
		expect(pageButton().getAttribute('title')).toBe(name);
	});

	it("lists Simple's four pages, no headings, no banned word", () => {
		openPage('About');
		const dropdown = openChooser();
		expect(rows(dropdown)).toEqual(['All letters', 'One letter', 'Help', 'About ANY-INK']);
		const said = [text(dropdown), ...[...dropdown.querySelectorAll('[title]')].map((e) => e.title)];
		expect(said.flatMap((line) => findBanned(line))).toEqual([]);
	});

	it('About -> All letters: back on the Overview, still Simple, no Undo step', () => {
		openPage('About');
		const before = editor.history.queue.length;
		const dropdown = openChooser();
		[...dropdown.querySelectorAll('.nav-dropdown__button')]
			.find((row) => text(row) === 'All letters')
			.click();
		expect(editor.nav.page).toBe('Overview');
		expect(getMode()).toBe('simple');
		expect(editor.history.queue).toHaveLength(before);
		expect(shown(pageButton())).toBe(true);
	});

	it('a letter -> All letters: the Overview is one click from the letter page', () => {
		openPage('Characters');
		const dropdown = openChooser();
		[...dropdown.querySelectorAll('.nav-dropdown__button')]
			.find((row) => text(row) === 'All letters')
			.click();
		expect(editor.nav.page).toBe('Overview');
	});

	it("goes once B6's top bar (the rail) lands", () => {
		setFeaturesForTests({ coach: true });
		openPage('Help');
		expect(shown(pageButton())).toBe(false);
	});
});

describe('All tools: the page chooser as today', () => {
	it('Glyphr Studio names and headings', () => {
		openPage('About');
		expect(text(pageButton().querySelector('.nav-button__super-title'))).toBe('PAGE');
		expect(text(pageButton().querySelector('.nav-button__title'))).toBe('About');
		expect(rows(openChooser())).toEqual([
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
	});
});
