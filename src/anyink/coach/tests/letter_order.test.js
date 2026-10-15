// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the coach's letter set and rule 15's order (UX-BEGINNER.md 4.0, 4.2), and the skip memory
// behind "Something else" (skips.js).
import { describe, expect, it } from 'vitest';
import {
	NUMBER_LETTERS,
	QUICK_LETTERS,
	buttonLetter,
	lettersInSet,
	suggestionOrder,
	tryItLetters,
} from '../letter_order.js';
import { isSkippedIn, makeSkips } from '../skips.js';

describe('letter_order', () => {
	it('the Quick font is 58 letters; numbers & symbols add 22', () => {
		expect(QUICK_LETTERS).toHaveLength(58);
		expect(QUICK_LETTERS.join('')).toBe(
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'?!-"
		);
		expect(NUMBER_LETTERS.join('')).toBe('0123456789:;"()&@#$%/*');
		expect(lettersInSet('quick')).toHaveLength(58);
		expect(lettersInSet('quick+numbers')).toHaveLength(80);
		expect(lettersInSet(undefined)).toHaveLength(58);
	});

	it('the Try-it letters: distinct, in the set, as typed (the space is never one)', () => {
		expect(tryItLetters('Brennan Hand', QUICK_LETTERS).join('')).toBe('BrenaHd');
		expect(tryItLetters('Dear Mom, 1 cake!', QUICK_LETTERS).join('')).toBe('DearMom,ck!');
	});

	it('the order: Try-it letters, a to z, A to Z, punctuation, numbers & symbols', () => {
		const order = suggestionOrder({ tryItText: 'Hi', set: lettersInSet('quick+numbers') });
		const chars = order.map((o) => o.char).join('');
		expect(chars.slice(0, 2)).toBe('Hi');
		expect(chars.slice(2, 27)).toBe('abcdefghjklmnopqrstuvwxyz');
		expect(chars.slice(27, 52)).toBe('ABCDEFGIJKLMNOPQRSTUVWXYZ');
		expect(chars.slice(52, 58)).toBe(".,'?!-");
		expect(chars.slice(58)).toBe('0123456789:;"()&@#$%/*');
		expect(order.filter((o) => o.fromTryIt).map((o) => o.char)).toEqual(['H', 'i']);
		const used = suggestionOrder({ tryItText: 'Hi', set: QUICK_LETTERS, turnsUsed: ['H'] });
		expect(used[0]).toEqual({ char: 'i', fromTryIt: true });
		expect(used.find((o) => o.char === 'H').fromTryIt).toBe(false);
	});

	it('a button names letters and numbers as they are, anything else in words', () => {
		expect(buttonLetter('c')).toBe('c');
		expect(buttonLetter('B')).toBe('B');
		expect(buttonLetter('7')).toBe('7');
		expect(buttonLetter('.')).toBe('the period');
		expect(buttonLetter('&')).toBe('the ampersand');
	});
});

describe('skips', () => {
	it('a skip holds while its stamp is the same, and ends when the state behind it changes', () => {
		const skips = makeSkips();
		skips.skip('next:c', 'empty');
		expect(skips.isSkipped('next:c', 'empty')).toBe(true);
		expect(isSkippedIn(skips.toObject(), 'next:c', 'empty')).toBe(true);
		expect(skips.isSkipped('next:c', 'ink')).toBe(false);
		// over for good: the same stamp later doesn't bring the old skip back
		expect(skips.isSkipped('next:c', 'empty')).toBe(false);
		expect(skips.size()).toBe(0);
	});

	it('per suggestion, and cleared with the session', () => {
		const skips = makeSkips();
		skips.skip('photo:a', '4');
		skips.skip('save', 'not-saved');
		expect(skips.isSkipped('photo:b', '4')).toBe(false);
		expect(skips.toObject()).toEqual({ 'photo:a': '4', save: 'not-saved' });
		skips.forget('save');
		expect(skips.toObject()).toEqual({ 'photo:a': '4' });
		skips.clear();
		expect(skips.size()).toBe(0);
		expect(isSkippedIn(null, 'save', '')).toBe(false);
	});

	// B6 + B7 fix pass (hostile probe_coach): the app reads skips through toObject(), so only
	// prune() ever sees the state behind a skip change; a skip has to end there
	it('prune(live) ends every skip whose suggestion is gone or came back with a new stamp', () => {
		const skips = makeSkips();
		skips.skip('save', 'not-saved');
		skips.skip('next:c', 'empty');
		skips.skip('photo:a', '4');
		const ended = skips.prune(
			new Map([
				['next:c', 'empty'],
				['photo:a', '3'],
			])
		);
		expect(ended.sort()).toEqual(['photo:a', 'save']);
		expect(skips.toObject()).toEqual({ 'next:c': 'empty' });
		// the state changed back: the old skip stays over
		skips.prune(new Map([['save', 'not-saved']]));
		expect(skips.toObject()).toEqual({});
	});
});
