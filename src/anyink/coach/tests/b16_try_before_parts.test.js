// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance (first-timer run, alphabet photo): after B r e n a H d were Ready the Next line
// kept saying "This photo has 45 more letters. [Do the next one]" and never offered Try it, so
// the green pointed away from T5. Once every letter of the Try-it text is Ready, rule 13 now
// comes before rule 12 once (until Try it is opened, or he presses Something else on it), then
// the photo's next part again. Written to fail on the rules before the fix.
import { describe, expect, it } from 'vitest';
import { pickLine } from '../rules.js';
import { fakeState } from './fake_state.js';

const photos = [{ id: 'img-alphabet', unused: 45, done: false }];

describe('rule 13 before rule 12 once the Try-it text is all Ready (B16)', () => {
	it('every letter of "Brennan Hand" Ready: Try it first', () => {
		const line = pickLine(
			fakeState({ ready: 'BrenaHd', tryItText: 'Brennan Hand', changedSinceTryIt: true, photos })
		);
		expect(line.name).toBe('tryLetters');
		expect(line.action).toBe('tryIt');
		expect(line.primary).toBe(true);
	});

	it('a letter of the text still missing: the photo comes first, as before', () => {
		const line = pickLine(
			fakeState({ ready: 'BrenaH', tryItText: 'Brennan Hand', changedSinceTryIt: true, photos })
		);
		expect(line.name).toBe('photoParts');
	});

	it('after Try it was opened (nothing changed since): back to Do the next one', () => {
		const line = pickLine(
			fakeState({ ready: 'BrenaHd', tryItText: 'Brennan Hand', changedSinceTryIt: false, photos })
		);
		expect(line.name).toBe('photoParts');
	});

	it('Something else on Try it: Do the next one', () => {
		const line = pickLine(
			fakeState({
				ready: 'BrenaHd',
				tryItText: 'Brennan Hand',
				changedSinceTryIt: true,
				photos,
				skips: { tryLetters: '' },
			})
		);
		expect(line.name).toBe('photoParts');
	});
});
