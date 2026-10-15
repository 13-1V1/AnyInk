// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 fix (UX-BEGINNER.md 4.0 Top bar, principles 6 and 7): the logo and the rail's "1 Letters"
// go to the letters: where the letter view's "<- All letters" goes (the Overview page, where B10
// mounts the board), never to the letter view he is already in, which did nothing at all.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_NAMES, resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { isShown } from '../../mode/visibility.js';
import { goToLetters, LETTERS_PAGE, lettersPage } from '../letters_page.js';

afterEach(() => resetFeaturesForTests());

describe('the page "the letters" means', () => {
	it('the Overview page, where "<- All letters" goes and B10 mounts the board', () => {
		expect(LETTERS_PAGE).toBe('Overview');
		expect(lettersPage()).toBe('Overview');
	});

	it('whatever the flags say: never the letter view, and always a page Simple shows', () => {
		const combos = [{}, { letterView: false }, { letterView: false, board: false }, { board: true }];
		combos.forEach((flags) => {
			setFeaturesForTests(flags);
			expect(lettersPage(), JSON.stringify(flags)).not.toBe('Characters');
			const on = (name) => FEATURE_NAMES.includes(name) && (flags[name] ?? true);
			expect(isShown('page', lettersPage(), { mode: 'simple', isOn: on })).toBe(true);
		});
	});
});

describe('goToLetters', () => {
	it('leaves the letter view: one navigate, to the letters', () => {
		const editor = { nav: { page: 'Characters' }, navigate: vi.fn() };
		goToLetters(editor);
		expect(editor.nav.page).toBe('Overview');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('no editor: nothing, and no error', () => {
		expect(() => goToLetters(null)).not.toThrow();
		expect(() => goToLetters({})).not.toThrow();
		expect(() => goToLetters({ nav: { page: 'Help' } })).not.toThrow();
	});
});
