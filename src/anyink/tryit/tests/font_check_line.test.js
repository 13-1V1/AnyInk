// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 (UX-BEGINNER.md 4.6 Font check line): B1's check as one line in Try it: "Your font builds
	OK." or the first problem, naming the letter, with [Fix it] when it has a safe fix (else [Show
	me] and what to do). It never falls back silently: before the first check it says it is
	checking.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { twoLetterProject } from '../../history/tests/two_letters.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import { word } from '../../words/words.js';
import { fontCheckLineState, makeFontCheckLine } from '../font_check_line.js';

afterEach(() => {
	document.body.innerHTML = '';
});

const widthProblem = {
	itemId: 'glyph-0x72',
	problem: PROBLEM.width,
	message: "small r has a width the font file can't hold.",
};
const pointProblem = {
	itemId: 'glyph-0x42',
	problem: PROBLEM.point,
	message: "Capital B has a point the font file can't hold.",
};

describe('what the line says', () => {
	it('before the first check: checking, never blank', () => {
		const state = fontCheckLineState(null, { project: twoLetterProject() });
		expect(state.kind).toBe('checking');
		expect(state.text).toBe(word('tryit.checking'));
	});

	it('no problem: "Your font builds OK."', () => {
		const state = fontCheckLineState({ problems: [] }, { project: twoLetterProject() });
		expect(state.kind).toBe('ok');
		expect(state.text).toBe('Your font builds OK.');
	});

	it('a problem: names the letter, with Fix it when it has a safe fix', () => {
		const state = fontCheckLineState(
			{ problems: [widthProblem] },
			{ project: twoLetterProject() }
		);
		expect(state.kind).toBe('problem');
		expect(state.text).toBe(widthProblem.message);
		expect(state.fixable).toBe(true);
		expect(state.itemId).toBe('glyph-0x72');
	});

	it('a problem Fix it cannot fix: Show me and what to do', () => {
		const state = fontCheckLineState(
			{ problems: [pointProblem, widthProblem] },
			{ project: twoLetterProject() }
		);
		expect(state.fixable).toBe(false);
		expect(state.hint).not.toBe('');
		expect(state.more).toBe(word('check.needFixingToo', {
			list: word('check.moreLetters', { count: 1 }),
			count: 1,
		}));
	});
});

describe('the line on screen', () => {
	it('shows the words and the one button that fits', () => {
		const onFixIt = vi.fn();
		const onShowMe = vi.fn();
		const line = makeFontCheckLine({ onFixIt, onShowMe });
		document.body.appendChild(line.element);
		const project = twoLetterProject();

		line.update(fontCheckLineState({ problems: [] }, { project }));
		expect(line.element.textContent).toContain('Your font builds OK.');
		expect(line.element.querySelectorAll('button:not([hidden])').length).toBe(0);
		expect(line.element.dataset.kind).toBe('ok');

		line.update(fontCheckLineState({ problems: [widthProblem] }, { project }));
		const shown = [...line.element.querySelectorAll('button:not([hidden])')];
		expect(shown.map((b) => b.textContent)).toEqual([word('check.fixIt')]);
		shown[0].click();
		expect(onFixIt).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'glyph-0x72' }));

		line.update(fontCheckLineState({ problems: [pointProblem] }, { project }));
		const showMe = [...line.element.querySelectorAll('button:not([hidden])')];
		expect(showMe.map((b) => b.textContent)).toEqual([word('check.showMe')]);
		showMe[0].click();
		expect(onShowMe).toHaveBeenCalledWith('glyph-0x42');
	});

	it('never a green button: Done is the screen\'s one green', () => {
		const line = makeFontCheckLine({ onFixIt: () => {}, onShowMe: () => {} });
		line.update(fontCheckLineState({ problems: [widthProblem] }, { project: twoLetterProject() }));
		line.element.querySelectorAll('button').forEach((b) => {
			expect(b.classList.contains('anyink-primary')).toBe(false);
		});
	});
});
