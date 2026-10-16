// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 integration: the banned-word scan (UX-BEGINNER.md 2.3) on the letter page as Simple
	shows it today, before B7's letter view replaces it: the real Characters page drawn by the
	real Navigator in Simple with no flag (B5 hides the choosers, panels and the Add a point
	tool). Its visible text, tooltips and sentence case say no banned word: the tools say "Rectangle
	(R)" (tool.* words), the view switches "Fit letter", "Dark paper", "Outline only", and the
	letter button "Letter" over "Capital A" (2.2: letterName, never the Unicode name, never in
	capitals). All tools keeps Glyphr Studio's own words on the same page.
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetFileApi } from '../../files/file_api.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { sampleEditor } from './controls_probe.js';
import { noFlags } from './no_flags.js';
import { setFeaturesForTests } from '../features.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = (path) => readFileSync(join(here, '../../..', path), 'utf8');

/** The stylesheets that decide what shows and its case (vitest skips CSS imports). */
function addStyles() {
	['project_editor/nav.css', 'anyink/mode/hide.css', 'anyink/mode/simple_labels.css'].forEach(
		(path) => {
			const style = document.createElement('style');
			style.dataset.scan = path;
			style.textContent = css(path);
			document.head.appendChild(style);
		}
	);
}

/** Today's letter page, Capital A open, drawn by the real Navigator. */
function letterPage() {
	noFlags(); // B5's page: B6 + B7 (on in the app) are scanned in letter/tests/letter_page.test.js
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Attributes';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.navigate();
	// jsdom has no <edit-canvas> element; picking a letter redraws it
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}

const button = () => document.querySelector('#nav-button-l2');
const small = () => button().querySelector('.nav-button__super-title').textContent.trim();
const name = () => button().querySelector('.nav-button__title').textContent.trim();
const titles = (selector) =>
	[...document.querySelectorAll(selector)].map((element) => element.getAttribute('title'));

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
afterEach(() => {
	resetFileApi();
	quiet?.forEach((spy) => spy.mockRestore());
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});
const hush = () =>
	(quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
	]);

describe("Simple: today's letter page says no banned word", () => {
	scanSimpleScreen('the letter page, Capital A open (before B7)', () => {
		hush();
		letterPage();
		expect(small()).toBe('Letter');
		expect(name()).toBe('Capital A');
		expect(button().getAttribute('title')).toBe('Capital A');
		expect(titles('.editor-page__tools-area button')).toEqual([
			'Rectangle (R)',
			'Oval (O)',
			'Point pen (P)',
			'Edit points (E)',
			'Select (V)',
		]);
		return document.querySelector('#app__wrapper');
	});

	scanSimpleScreen('the letter button after picking another letter', () => {
		hush();
		const editor = letterPage();
		editor.selectedGlyphID = 'glyph-0x61';
		expect(name()).toBe('small a');
		return button();
	});
});

/** One of the pages Simple shows today, drawn by the real Navigator. */
function simplePage(page) {
	addStyles();
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}

describe('Simple: the other pages it shows today say no banned word', () => {
	scanSimpleScreen('the Overview: the welcome and the letter tiles (before B10)', () => {
		hush();
		// B10 + B11 integration: B5's Overview, with the board off (the board's own scan is
		// board/tests/board_words.test.js)
		setFeaturesForTests({ board: false });
		simplePage('Overview');
		const tiles = [...document.querySelectorAll('glyph-tile')];
		expect(tiles.length).toBeGreaterThan(50);
		expect(document.querySelector('glyph-tile[displayed-item-id="glyph-0x61"]').title).toMatch(
			/^small a/
		);
		expect(document.querySelector('#content-page__panel').textContent).not.toMatch(/UPM|Project info/);
		return document.querySelector('#app__wrapper');
	});

	scanSimpleScreen('the letter chooser, open on the letter page (before B7 and B10)', () => {
		hush();
		letterPage();
		document.querySelector('#nav-button-l2').click();
		const chooser = document.querySelector('#nav-dropdown-chooser');
		expect(chooser).not.toBeNull();
		expect(chooser.querySelectorAll('glyph-tile').length).toBeGreaterThan(50);
		return chooser;
	});

	scanSimpleScreen('Help: one tab, in house words (before B15)', () => {
		hush();
		simplePage('Help');
		const page = document.querySelector('#app__wrapper');
		// B4 + B5 finalize: the full manual is a link that says it uses pro words
		expect(page.querySelector('a[href="https://www.glyphrstudio.com/help"]')).toBeTruthy();
		expect(page.textContent).not.toMatch(/Keyboard shortcuts/);
		return page;
	});

	// B12 + B13 integration: the start page's tabs and the Recover tab, scanned here before B13,
	// are retired in Simple: the start screen is scanned in start/tests/start_page.test.js, and
	// the tabs show only under the More tools band, in Glyphr Studio's words

	scanSimpleScreen('About', () => {
		hush();
		simplePage('About');
		return document.querySelector('#app__wrapper');
	});
});

describe("All tools: the same page keeps Glyphr Studio's words", () => {
	it('the Overview keeps its project card, Help its key table, tiles their names and ids', () => {
		hush();
		simplePage('Overview');
		expect(document.querySelector('#content-page__panel').textContent).toMatch(/UPM/);
		expect(document.querySelector('glyph-tile[displayed-item-id="glyph-0x61"]').title).toMatch(
			/^Latin Small Letter A\sglyph-0x61/
		);
		simplePage('Help');
		expect(document.querySelector('#app__wrapper').textContent).toMatch(/Keyboard shortcuts/);
	});

	it('EDITING over the Unicode name, and the upstream tooltips', () => {
		hush();
		letterPage();
		expect(small()).toBe('EDITING');
		expect(name()).toBe('Latin Capital Letter A');
		expect(titles('.editor-page__tools-area button')).toEqual([
			'New rectangle',
			'New oval',
			'New path',
			'Add path point',
			'Path edit',
			'Resize',
		]);
		expect(titles('.editor-page__zoom-area button')).toContain('Zoom to fit a full Em');
	});
});
