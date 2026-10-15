// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 finalize, the Help and About pages and the letter sets (verdicts: "Simple: Help and
	About have no way back to the letters", "Simple Help page: one tab named 'Overview' and only a
	pointer to a pro-word site", "Simple About: Version tab shows project ID and versions; Credits
	tab has 7 banned words", "'Basic Latin' on the Simple Overview and letter chooser", "All tools
	Help > Keyboard shortcuts is now wrong for P, E and Ctrl+O"):
	  - Simple Help and About each have [Back to my letters] (mode.band.backToLetters), which opens
	    the letter page with no Undo step
	  - Simple Help is one "Help" tab: how to pick a letter, the tools with the keys Simple has
	    (keys.js keysShown), Undo, Save and Open, the font file, and the full manual (pro words,
	    said so)
	  - Simple About keeps every credit (Peter Selinger, Thomas Steiner, Glyphr Studio) in house
	    words, the libraries' own names as quotes, and no "This project" card (name, ID, version)
	  - Simple names a letter set in house words (words/letter_set.js), never a block name
	  - All tools Help > Keyboard shortcuts lists the tool keys and Ctrl+O as keys.js has them
	    (UX-BEGINNER.md 7.6: P picks the Point pen and E Edit points in both modes; Ctrl+O opens a
	    saved font), in Glyphr Studio's own words
*/
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeKeyboardShortcutReference } from '../../../pages/help.js';
import { findBanned } from '../../words/banned.js';
import { letterSetName } from '../../words/letter_set.js';
import { word } from '../../words/words.js';
import { keysShown } from '../keys.js';
import { setModeForTests } from '../mode.js';
import { sampleEditor } from './controls_probe.js';

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
afterEach(() => {
	quiet?.forEach((spy) => spy.mockRestore());
	setModeForTests('all');
	document.body.innerHTML = '';
});
const hush = () =>
	(quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'error').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	]);

function open(page, mode) {
	hush();
	setModeForTests(mode);
	const editor = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.navigate();
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return editor;
}
const tabs = () => [...document.querySelectorAll('.tab-control__tab')].map((t) => t.textContent);
const back = () => document.querySelector('[data-anyink-choice="backToLetters"]');
const rightArea = () => document.querySelector('.content-page__right-area');
const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();

describe.each(['Help', 'About'])('Simple %s: a way back to the letters', (page) => {
	it('[Back to my letters] opens the letter page, with no Undo step', () => {
		const editor = open(page, 'simple');
		expect(back()?.textContent).toBe(word('mode.band.backToLetters'));
		const steps = editor.history.queue.length;
		back().click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.history.queue.length).toBe(steps);
	});

	it('All tools has no such button (as before)', () => {
		open(page, 'all');
		expect(back()).toBe(null);
	});
});

describe('Simple Help', () => {
	it('one "Help" tab', () => {
		open('Help', 'simple');
		expect(tabs()).toEqual([word('help.title')]);
	});

	it('says how: pick a letter, the tools with their keys, Undo, Save and Open, the font file', () => {
		open('Help', 'simple');
		const said = text(rightArea());
		expect(said).toContain(word('help.howPick'));
		expect(said).toContain(word('help.howUndo'));
		expect(said).toContain(word('help.howSave'));
		expect(said).toContain(word('help.howFontFile'));
		keysShown({ mode: 'simple' })
			.filter((key) => key.action === 'selectTool')
			.forEach((key) =>
				expect(said).toContain(
					word('help.toolKey', { tool: word(`tool.${key.tool}`), key: key.keys[0] })
				)
			);
		expect(said).toContain(word('help.fullManual'));
		expect(findBanned(said, { strict: true })).toEqual([]);
	});
});

describe('Simple About', () => {
	function everyTab() {
		const all = [];
		document.querySelectorAll('.tab-control__tab').forEach((tab) => {
			tab.click();
			all.push(text(rightArea()));
		});
		return all.join(' ');
	}

	it('every credit kept, in house words; no "This project" card', () => {
		open('About', 'simple');
		const said = everyTab();
		['Glyphr Studio', 'Matthew LaGrandeur', 'Peter Selinger', 'Thomas Steiner'].forEach((name) =>
			expect(said).toContain(name)
		);
		expect(said).not.toMatch(/project ID|Initially created/i);
		[...document.querySelectorAll('.tab-control__tab')].find((t) => t.textContent === 'Credits').click();
		const quotes = [...document.querySelectorAll('.content-page__right-area .anyink-quote')];
		expect(quotes.map((q) => q.textContent)).toContain('bezier-boolean');
	});

	it('All tools keeps its card and words', () => {
		open('About', 'all');
		expect(text(rightArea())).toContain('Unique project ID');
	});
});

describe('letter sets in Simple', () => {
	it('the Overview and the letter chooser name Basic Latin in house words', () => {
		open('Overview', 'simple');
		const chooser = document.querySelector('option-chooser');
		expect(chooser.getAttribute('selected-name')).toBe(
			letterSetName({ begin: 0x20, end: 0x7e })
		);
		[...chooser.querySelectorAll('option')].forEach((option) =>
			expect(findBanned(option.textContent, { strict: true })).toEqual([])
		);
	});

	it('All tools keeps the block name', () => {
		open('Overview', 'all');
		expect(document.querySelector('option-chooser').getAttribute('selected-name')).toBe(
			'Basic Latin'
		);
	});
});

describe('All tools Help > Keyboard shortcuts', () => {
	/** The rows as [keys joined, description]. */
	function rows() {
		hush();
		const table = makeKeyboardShortcutReference();
		return [...table.children]
			.filter((child) => child.tagName === 'SPAN')
			.map((span) => [
				[...span.querySelectorAll('code')].map((code) => code.textContent.trim()).join('+'),
				text(span.nextElementSibling),
			]);
	}

	it('each tool row has the keys keys.js gives it in All tools', () => {
		const shown = rows();
		keysShown({ mode: 'all' })
			.filter((key) => key.action === 'selectTool')
			.forEach((key) => {
				const row = shown.find(
					([keys]) =>
						!keys.includes('Ctrl') &&
						key.keys.every((k) => keys.split('+').includes(k.toUpperCase()))
				);
				expect(row, key.tool).toBeTruthy();
			});
		// P is the Point pen (New Path) and E is Edit points (Path Edit)
		const toolRow = (key) =>
			shown.find(([keys]) => !keys.includes('Ctrl') && keys.split('+').includes(key));
		expect(toolRow('P')[1]).toMatch(/New Path/);
		expect(toolRow('E')[1]).toMatch(/Path Edit/);
	});

	it('Ctrl+O opens a saved font, not a new tab', () => {
		const ctrlO = rows().find(([keys]) => keys === 'Ctrl+O');
		expect(ctrlO[1]).not.toMatch(/new tab/i);
		expect(ctrlO[1]).toMatch(/open/i);
	});
});
