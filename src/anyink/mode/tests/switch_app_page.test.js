// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track (UX-BEGINNER.md 6.1, 2.2): a mode switch while the Open Project page shows
// (an app-level page: no editor page is drawn) draws that page again, so its words follow the
// mode: the Load tab's drop target and the Examples tab say Simple's words in Simple and Glyphr
// Studio's in All tools. Nothing listened for 'anyink-mode-change', so they kept the old mode's
// words. B6's More tools button and B13 switch from there.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGlyphrStudioApp } from '../../../app/main.js';
import { makePage_OpenProject } from '../../../app/open_project.js';
import { setModeForTests } from '../mode.js';
import { switchMode } from '../switch.js';
import { word } from '../../words/words.js';

const dropTarget = () =>
	(document.querySelector('#open-project__drop-target')?.textContent || '').replace(/\s+/g, ' ');

let warn;
beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	document.body.innerHTML = '<div id="app__wrapper"></div>';
});
afterEach(() => {
	warn.mockRestore();
	document.body.innerHTML = '';
	// leave the editor-page state for the next file
	window.dispatchEvent(
		new CustomEvent('anyink-page-change', { detail: { page: 'Overview', appLevel: false } })
	);
});

describe('a mode switch on the Open Project page', () => {
	it('All tools -> Simple: the page is drawn again with Simple words', () => {
		getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
		expect(dropTarget()).toContain('ANY-INK project');
		expect(switchMode('simple', { editor: null })).toBe(true);
		expect(document.querySelectorAll('#open-project__page')).toHaveLength(1);
		expect(dropTarget()).toContain(word('start.dropWorkFile'));
		expect(dropTarget()).not.toContain('ANY-INK project');
	});

	it('Simple -> All tools: back to Glyphr Studio words', () => {
		setModeForTests('simple');
		getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
		expect(dropTarget()).toContain(word('start.dropWorkFile'));
		switchMode('all', { editor: null });
		expect(dropTarget()).toContain('ANY-INK project');
	});

	it('another app-level page (Cross-project actions, one set of words) is left as it is', () => {
		getGlyphrStudioApp().appPageNavigate(() => {
			const page = document.createElement('div');
			page.id = 'app__page';
			page.textContent = 'Another app-level page';
			return page;
		});
		switchMode('simple', { editor: null });
		expect(document.querySelector('#app__page').textContent).toBe('Another app-level page');
	});
});

// B4 + B5 finalize (new problem "A mode switch on the Open Project page throws away the typed
// font name and the chosen tab"): the page is drawn again in the new mode's words, and keeps
// what he typed and the tab he was on.
describe('a mode switch on the Open Project page keeps what he did there', () => {
	it('the font name he typed and the tab he chose stay', () => {
		getGlyphrStudioApp().appPageNavigate(makePage_OpenProject);
		document.querySelector('#input__new-project-name').value = 'Keep Me';
		document.querySelector('#open-project__tab-examples').click();
		switchMode('simple', { editor: null });
		expect(document.querySelector('#input__new-project-name').value).toBe('Keep Me');
		expect(document.querySelector('#open-project__tab-examples').hasAttribute('selected')).toBe(
			true
		);
		expect(document.querySelector('#tab-content__examples').style.display).toBe('block');
		expect(document.querySelector('#tab-content__new').style.display).toBe('none');
	});
});
