// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B8 + B9 finalize: the Next line after the second hostile pass (UX-BEGINNER.md 4.0), as the
// shipping flags are now (coach, letterView, brush, photo on; board, tryIt, useInWord off).
// - Once every letter was ready the line went blank: no sentence and no button.
// - After one brush stroke on a letter that needs several, the line said "small b looks done.
//   Next: small i." with a green [Go to i].
// - The Brush tip repeated the line's own sentence.
// Written to fail on the rules and words before the pass.
import { describe, expect, it } from 'vitest';
import { word } from '../../words/words.js';
import { pickLine } from '../rules.js';
import { fakeState, flags } from './fake_state.js';
import { lettersInSet } from '../letter_order.js';

const SHIPPING = flags('letterView', 'brush', 'photo');
const EVERY = lettersInSet('quick').join('');

describe('every letter ready', () => {
	it('says so, with no button, while Try it, the board and Use in Word are still to come', () => {
		const line = pickLine(
			fakeState({ ready: EVERY, flags: SHIPPING, page: 'letter', current: '-' })
		);
		expect(line.sentence).toBe(`All ${EVERY.length} letters are ready.`);
		expect(line.button).toBe('');
		expect(line.primary).toBe(false);
	});

	it('rule 16 or 17 still comes first once its own flag is on', () => {
		const line = pickLine(fakeState({ ready: EVERY, flags: flags('letterView', 'tryIt') }));
		expect(line.rule).toBe(17);
	});
});

describe('the Brush picked on a letter with ink', () => {
	it('no "looks done": a calm sentence and an outlined button while he may still be drawing', () => {
		const line = pickLine(
			fakeState({ ready: 'b', flags: SHIPPING, page: 'letter', current: 'b', tool: 'nib' })
		);
		expect(line.rule).toBe(15);
		expect(line.sentence).toBe('When small b looks right, go to small a.');
		expect(line.sentence).not.toContain('looks done');
		expect(line.button).toBe(word('action.goTo', { letter: 'a' }));
		expect(line.primary).toBe(false);
		// with another tool picked it is the usual line, green
		const usual = pickLine(
			fakeState({ ready: 'b', flags: SHIPPING, page: 'letter', current: 'b' })
		);
		expect(usual.sentence).toBe('small b looks done. Next: small a.');
		expect(usual.primary).toBe(true);
	});
});

describe("the Brush tip doesn't repeat the line", () => {
	it('names only what the line leaves out: Undo', () => {
		expect(word('coach.tip.brush')).toBe('Undo removes the last stroke.');
		expect(word('brush.next.drag')).not.toContain('Undo');
	});
});
