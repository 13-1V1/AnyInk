// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix pass (door-coach, written to fail first): with 'sketch' on, a new font's first Next line
	offers sketching as well as the photo. Found in Chrome: the board said only "First, write your
	letters on paper and take one photo of the page." [How], so the very first instruction pointed
	away from sketching. Now the green button goes to the first letter to sketch, and [How] stays
	as the line's quiet button. With 'sketch' off the line is as before.
*/
import { describe, expect, it } from 'vitest';
import { letterPhrase } from '../../words/letter_name.js';
import { word } from '../../words/words.js';
import { pickLine } from '../rules.js';
import { ALL_FLAGS, fakeState, SHIPPED_FLAGS } from './fake_state.js';

describe("rule 11 with 'sketch' on", () => {
	it('a new font on the board: sketch the first letter (green), or [How] for the photo', () => {
		const line = pickLine(fakeState({ page: 'board', flags: ALL_FLAGS }));
		expect(line.rule).toBe(11);
		// the first letter of the suggestion order (rule 15's), with its button
		const next = pickLine(fakeState({ page: 'board', flags: { ...ALL_FLAGS, photo: false } }));
		expect(next.rule).toBe(15);
		expect(line.args).toEqual(next.args);
		expect(line.button).toBe(next.button);
		expect(line.sentence).toBe(
			word('sketch.next.firstLetter', { letter: letterPhrase(line.args.char) })
		);
		expect(line.action).toBe('goToLetter');
		expect(line.primary).toBe(true);
		expect(line.quiet).toEqual({ label: word('coach.button.how'), action: 'how', args: null });
	});

	it('the sentence names sketching first and still offers the photo', () => {
		const text = word('sketch.next.firstLetter', { letter: 'small n' });
		expect(text).toMatch(/^Start by sketching small n/);
		expect(text).toMatch(/photo/);
	});

	it('guard: the flag off, the photo line as before', () => {
		const line = pickLine(fakeState({ page: 'board', flags: SHIPPED_FLAGS }));
		expect(line).toMatchObject({
			rule: 11,
			sentence: word('coach.rule.firstPhoto'),
			action: 'how',
		});
		expect(line.quiet).toBeNull();
	});
});
