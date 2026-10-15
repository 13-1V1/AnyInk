// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 test helper: one fake font per rule of the Next line (UX-BEGINNER.md 4.0), in which that
	rule is the first to match with every flag on, and what the line must say there. Shared by
	rules.test.js and tests/coach.html.
	  RULE_STATES   { rule: () => state }
	  EXPECTED      { rule: { sentence, button, action } }
	  MORE_STATES   { name: { rule, state, expect } }: the fix pass's states of rules 8 and 10
	  SEVEN, ALL_READY, FLOATS
*/
import { fakeState } from './fake_state.js';

export const SEVEN = 'BrenaHd';
export const ALL_READY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'?!-";
export const FLOATS = {
	id: 'seat',
	reason: 'Capital B floats above the writing line.',
	fixLabel: 'Sit on the line',
	action: 'fixLetter',
};

/** One state per rule, in which that rule is the first to match (all flags on). */
export const RULE_STATES = {
	1: () => fakeState({ dialog: 'howCard', ready: SEVEN }),
	2: () => fakeState({ page: 'letter', current: 'r', photoCard: { step: 'pick', char: 'r' } }),
	3: () => fakeState({ page: 'letter', current: 'B', photoCard: { step: 'result', char: 'B' } }),
	4: () =>
		fakeState({ ready: SEVEN, tryItOpen: true, fontFileBehind: true, changedSinceTryIt: true }),
	5: () => fakeState({ ready: 'Br', tryItOpen: true }),
	6: () =>
		fakeState({
			ready: 'a',
			fontProblem: {
				itemId: 'glyph-0x61',
				problem: 'inkNoWidth',
				text: 'small a has ink but no width, so the next letter would sit on top of it.',
				fixable: true,
			},
		}),
	7: () => fakeState({ page: 'letter', current: 'B', needsLook: { B: FLOATS } }),
	8: () => fakeState({ page: 'letter', current: 'B' }),
	9: () => fakeState({ ready: 'a', needsLook: { B: FLOATS, e: { ...FLOATS, id: 'size' } } }),
	10: () => fakeState({ ready: 'a', save: 'not-saved' }),
	11: () => fakeState({}),
	12: () =>
		fakeState({
			ready: 'B',
			hasPhoto: true,
			photos: [{ id: 'photo-1', unused: 6, done: false }],
			tryItText: 'Brennan Hand',
			changedSinceTryIt: true,
		}),
	13: () => fakeState({ ready: SEVEN, tryItText: 'Brennan Hand', changedSinceTryIt: true }),
	14: () =>
		fakeState({
			ready: SEVEN,
			tryItText: 'Brennan Hand',
			fontFileBehind: true,
			lettersChangedSinceFontFile: 7,
		}),
	15: () => fakeState({ ready: SEVEN, tryItText: 'Brennan Hand' }),
	16: () => fakeState({ ready: ALL_READY }),
	17: () => fakeState({ ready: ALL_READY + '0123456789:;"()&@#$%/*', numbers: true }),
};

export const EXPECTED = {
	1: { sentence: '', button: '', action: '' },
	2: { sentence: 'Choose the photo that has your small r on it.', button: '', action: '' },
	3: {
		sentence: 'Look right? Press Use it. Wrong part? Press Draw a box.',
		button: '',
		action: '',
	},
	4: {
		sentence: 'Happy with how it looks? Make a font file for Word.',
		button: 'Use in Word',
		action: 'useInWord',
	},
	5: {
		sentence: "Type anything to try your letters. Press Done when you're finished.",
		button: '',
		action: '',
	},
	6: {
		sentence: 'small a has ink but no width, so the next letter would sit on top of it.',
		button: 'Fix it',
		action: 'fixFontProblem',
	},
	7: {
		sentence: 'Capital B floats above the writing line.',
		button: 'Sit on the line',
		action: 'fixLetter',
	},
	8: {
		sentence: 'Capital B is empty. Use a photo of it, or draw it with the brush.',
		button: '',
		action: '',
	},
	9: { sentence: '2 letters need a look.', button: 'Show me', action: 'showNeedsLook' },
	10: { sentence: "Your work isn't saved yet.", button: 'Save', action: 'save' },
	11: {
		sentence: 'First, write your letters on paper and take one photo of the page.',
		button: 'How',
		action: 'how',
	},
	12: { sentence: 'This photo has 6 more letters.', button: 'Do the next one', action: 'nextPart' },
	13: { sentence: 'Try your letters in a sentence.', button: 'Try it', action: 'tryIt' },
	14: {
		sentence: 'Make a font file and try your letters in Word.',
		button: 'Use in Word',
		action: 'useInWord',
	},
	15: { sentence: 'Next: small b.', button: 'Make b', action: 'goToLetter' },
	16: {
		sentence: 'All 58 letters are ready. Add numbers & symbols next?',
		button: 'Add numbers & symbols',
		action: 'addNumbers',
	},
	17: {
		sentence: 'Your font is up to date. Type something in Try it.',
		button: 'Try it',
		action: 'tryIt',
	},
};

/**
 * B6 + B7 fix pass: rule 8 with a drawing tool picked or a Point pen shape still open, and rule
 * 10 after a failed save. Shared by coach_words.test.js and tests/coach.html.
 * { name: { rule, state: () => state, expect: { sentence, button, action } } }
 */
export const MORE_STATES = {
	'8: Point pen picked': {
		rule: 8,
		state: () => fakeState({ page: 'letter', current: 'B', tool: 'newPath' }),
		expect: { sentence: 'Click on the paper to drop your first point.', button: '', action: '' },
	},
	'8: Rectangle picked': {
		rule: 8,
		state: () => fakeState({ page: 'letter', current: 'B', tool: 'newRectangle' }),
		expect: { sentence: 'Drag on the paper to draw a rectangle.', button: '', action: '' },
	},
	'8: Oval picked': {
		rule: 8,
		state: () => fakeState({ page: 'letter', current: 'B', tool: 'newOval' }),
		expect: { sentence: 'Drag on the paper to draw an oval.', button: '', action: '' },
	},
	'8: shape open, 1 point': {
		rule: 8,
		state: () => fakeState({ page: 'letter', current: 'B', tool: 'newPath', drawing: 1 }),
		expect: {
			sentence: 'Keep clicking to drop points, then press Finish the shape.',
			button: '',
			action: '',
		},
	},
	'8: shape open, 3 points': {
		rule: 8,
		state: () => fakeState({ page: 'letter', current: 'B', tool: 'newPath', drawing: 3 }),
		expect: {
			sentence: 'Click your first point, or press Finish the shape.',
			button: '',
			action: '',
		},
	},
	'10: save failed': {
		rule: 10,
		state: () => fakeState({ ready: 'a', save: 'failed' }),
		expect: { sentence: "Couldn't save your work.", button: 'Fix', action: 'fixSave' },
	},
};
