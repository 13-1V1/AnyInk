// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize: Simple's error box (UX-BEGINNER.md 7.7, principle 1). error_words.js picks the
// words for what went wrong; error_box.js shows them: a plain title, the one sentence with file
// and folder names as quotes, and its buttons, the first one green and the rest outlined. A
// button runs its action after the box closes; a button with no action only closes it. All
// tools shows Glyphr Studio's box as before (sayError's allTools HTML).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { findBanned } from '../banned.js';
import { sayError, showWordsError } from '../error_box.js';
import { saveErrorWords } from '../error_words.js';
import { word } from '../words.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const box = () => document.querySelector('#error');
const buttons = () => [...(box()?.querySelectorAll('[data-anyink-choice]') || [])];

afterEach(() => {
	setModeForTests('all');
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('showWordsError', () => {
	it('a plain title, the sentence with the file as a quote, its buttons in order', () => {
		showWordsError(saveErrorWords(new Error('x'), 'Brennan Hand.gs2'));
		expect(box().querySelector('h3').textContent).toBe(word('error.boxTitle'));
		const body = box().querySelector('.error__body p');
		expect(body.textContent.trim()).toBe(
			"Couldn't save to Brennan Hand.gs2. A backup copy is kept."
		);
		expect([...body.querySelectorAll('.anyink-quote')].map((q) => q.textContent)).toEqual([
			'Brennan Hand.gs2',
		]);
		expect(buttons().map((b) => b.textContent)).toEqual(['Try again', 'Save somewhere else']);
	});

	it('one green button: the first; the rest are outlined', () => {
		showWordsError(saveErrorWords(new Error('x'), 'a.gs2'));
		expect(buttons().map((b) => b.hasAttribute('secondary'))).toEqual([false, true]);
	});

	it('a button closes the box, then runs its action', () => {
		vi.useFakeTimers();
		const tryAgain = vi.fn(() => expect(box()?.isConnected ? 'open' : 'closed').toBeTruthy());
		showWordsError(saveErrorWords(new Error('x'), 'a.gs2'), {
			'error.button.tryAgain': tryAgain,
		});
		buttons()[0].click();
		expect(tryAgain).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(200);
		expect(box()).toBe(null);
	});

	it('a button with no action only closes the box', () => {
		vi.useFakeTimers();
		showWordsError(saveErrorWords(new Error('x'), 'a.gs2'));
		buttons()[1].click();
		vi.advanceTimersByTime(200);
		expect(box()).toBe(null);
	});

	it('says no banned word, and never the error it was given', () => {
		showWordsError(saveErrorWords(new Error('Failed to execute write on stream'), 'a.gs2'));
		expect(findBanned(box().textContent, { strict: true })).toEqual([]);
		expect(box().textContent).not.toContain('Failed to execute');
	});
});

describe('sayError', () => {
	it('Simple: the words box', () => {
		setModeForTests('simple');
		sayError(saveErrorWords(new Error('x'), 'a.gs2'), { allTools: 'a.gs2 could not be saved.' });
		expect(box().querySelector('h3').textContent).toBe(word('error.boxTitle'));
		expect(box().textContent).not.toContain('could not be saved');
	});

	it("All tools: Glyphr Studio's box with its own words, as before", () => {
		sayError(saveErrorWords(new Error('x'), 'a.gs2'), { allTools: 'a.gs2 could not be saved.' });
		expect(box().querySelector('h3').textContent).toBe('Error');
		expect(box().querySelector('.error__body').textContent).toContain('a.gs2 could not be saved.');
		expect(buttons()).toEqual([]);
	});
});
