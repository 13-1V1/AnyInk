// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the beginner's journey (UX-BEGINNER.md section 3) as steps on a fake font, shared by
	journey.test.js and tests/coach.html. Each step changes the fake font and screen the way the
	real screens will (B9's photo dialog and card, B12's Try it, B14's Use in Word) and says what
	the Next line must say then.

	  makeWorld()        { page, current, ink, photo, save, fontName }
	  stateOf(world)     the rules' state for it (what font_facts.js reads from a real font)
	  launch(world)      a coach over it, with its own session memory (a new launch)
	  JOURNEY            [{ clock, sees, does, run(world, coach), expect: { rule, sentence,
	                     button, primary } }] in the table's order
	  TOMORROW           the "Coming back tomorrow" steps, on a new launch
*/
import { makeCoach } from '../coach_state.js';
import { lettersInSet } from '../letter_order.js';

/** @returns {Object} a new font called Brennan Hand, before Create my font */
export function makeWorld() {
	return {
		page: 'start',
		current: null,
		ink: new Set(),
		photo: null,
		save: 'saved',
		fontName: 'Brennan Hand',
	};
}

/**
 * @param {Object} world
 * @returns {Object} the rules' state
 */
export function stateOf(world) {
	const letters = lettersInSet('quick').map((char) => {
		const ink = world.ink.has(char);
		return { char, ink, ready: ink, needsLook: null };
	});
	return {
		page: world.page,
		letter: world.page === 'letter' ? letters.find((l) => l.char === world.current) : null,
		letters,
		numbersAdded: false,
		fontProblem: null,
		save: world.save,
		hasPhoto: !!world.photo,
		photos: world.photo
			? [{ id: 'photo-1', unused: world.photo.parts - world.photo.used, done: false }]
			: [],
		tryItText: world.fontName,
	};
}

/**
 * @param {Object} world
 * @param {Object} [options] - passed to makeCoach (probe, schedule, listen)
 * @returns {Object} a coach with a new session's memory
 */
export function launch(world, options = {}) {
	const font = { id: 'brennan-hand' };
	return makeCoach({
		getEditor: () => font,
		deriveState: () => stateOf(world),
		probe: () => ({ dialog: '', otherPrimary: false }),
		schedule: () => {},
		listen: false,
		...options,
	});
}

const RULE_3 = 'Look right? Press Use it. Wrong part? Press Draw a box.';
const EMPTY = { rule: 1, sentence: '', button: '' };

/** Trace it: the photo dialog closes on the letter view, step C (4.4) */
const traceIt = (char) => (world, coach) => {
	coach.setFact('dialog', null);
	world.page = 'letter';
	world.current = char;
	coach.setFact('photoCard', { step: 'result', char });
};

/** Use it: the letter is ready, the card shrinks, one part of the photo more is used */
const useIt = (char) => (world, coach) => {
	world.ink.add(char);
	world.photo.used++;
	coach.setFact('photoCard', null);
	coach.note('letterChanged', { char, ink: true });
};

const more = (n) => `This photo has ${n} more ${n === 1 ? 'letter' : 'letters'}.`;

/** One photo letter: Do the next one, Trace it, Use it */
function photoLetter(clock, char, left) {
	return [
		{
			clock,
			sees: 'The photo dialog boxes the next part',
			does: `Do the next one, types ${char}`,
			run: (world, coach) => coach.setFact('dialog', 'photoDialog'),
			expect: EMPTY,
		},
		{
			clock,
			sees: `The letter view for ${char}, step C`,
			does: 'Trace it',
			run: traceIt(char),
			expect: { rule: 3, sentence: RULE_3, button: '' },
		},
		{
			clock,
			sees: 'The card shrinks to Ready',
			does: 'Use it',
			run: useIt(char),
			expect: left
				? { rule: 12, sentence: more(left), button: 'Do the next one', primary: true }
				: { rule: 13, sentence: 'Try your letters in a sentence.', button: 'Try it' },
		},
	];
}

export const JOURNEY = Object.freeze([
	{
		clock: '0:00',
		sees: 'Start screen: "Make a new font"',
		does: 'Types Brennan Hand (no top bar, so no Next line yet)',
		run: () => {},
		expect: { rule: 0, sentence: '', button: '' },
	},
	{
		clock: '0:01',
		sees: 'The letter board, every tile faint, status Saved',
		does: 'Create my font, Save in the Windows dialog',
		run: (world, coach) => {
			world.page = 'board';
			coach.refresh();
		},
		expect: {
			rule: 11,
			sentence: 'First, write your letters on paper and take one photo of the page.',
			button: 'How',
			primary: true,
		},
	},
	{
		clock: '0:01',
		sees: 'The How card',
		does: 'Presses How',
		run: (world, coach) => coach.setFact('dialog', 'howCard'),
		expect: EMPTY,
	},
	{
		clock: '0:02',
		sees: 'The photo dialog: seven parts, the first in a green dashed box',
		does: 'I have my photo, picks it in Downloads',
		run: (world, coach) => {
			world.photo = { parts: 7, used: 0 };
			coach.setFact('dialog', 'photoDialog');
		},
		expect: EMPTY,
	},
	{
		clock: '0:03',
		sees: 'The letter view for Capital B, step C',
		does: 'Types B, Trace it',
		run: traceIt('B'),
		expect: { rule: 3, sentence: RULE_3, button: '' },
	},
	{
		clock: '0:03',
		sees: 'Capital B · Ready',
		does: 'Use it',
		run: useIt('B'),
		expect: { rule: 12, sentence: more(6), button: 'Do the next one', primary: true },
	},
	...photoLetter('0:04', 'r', 5),
	...photoLetter('0:05', 'e', 4),
	...photoLetter('0:06', 'n', 3),
	...photoLetter('0:06', 'a', 2),
	...photoLetter('0:07', 'H', 1),
	...photoLetter('0:08', 'd', 0),
	{
		clock: '0:08',
		sees: 'The big preview shows "Brennan Hand" in his letters',
		does: 'Presses Try it',
		run: (world, coach) => coach.setFact('tryItOpen', true),
		expect: {
			rule: 4,
			sentence: 'Happy with how it looks? Make a font file for Word.',
			button: 'Use in Word',
		},
	},
	{
		clock: '0:09',
		sees: 'The "en" gap looks wide',
		does: 'Drags the purple handle closer (a gap fix)',
		run: (world, coach) => coach.note('fontChanged'),
		expect: {
			rule: 4,
			sentence: 'Happy with how it looks? Make a font file for Word.',
			button: 'Use in Word',
		},
	},
	{
		clock: '0:10',
		sees: 'The Use in Word dialog',
		does: 'Presses Use in Word',
		run: (world, coach) => coach.setFact('dialog', 'useInWord'),
		expect: EMPTY,
	},
	{
		clock: '0:12',
		sees: '"Made BrennanHand-Test1.otf." and the four steps',
		does: 'Picks My Fonts, Allow, Make my font file',
		run: (world, coach) => coach.note('fontFileMade'),
		expect: EMPTY,
	},
	{
		clock: '0:18',
		sees: 'Try it, under the closed dialog',
		does: 'Done (then installs the font and types "Brennan Hand" in Word)',
		run: (world, coach) => coach.setFact('dialog', null),
		expect: {
			rule: 5,
			sentence: "Type anything to try your letters. Press Done when you're finished.",
			button: '',
		},
	},
	{
		clock: '0:18',
		sees: 'The letter board',
		does: 'Done in Try it',
		run: (world, coach) => {
			coach.setFact('tryItOpen', false);
			world.page = 'board';
			world.current = null;
			coach.refresh();
		},
		expect: { rule: 15, sentence: 'Next: small b.', button: 'Make b', primary: true },
	},
]);

/** "Coming back tomorrow": a new launch on the same font */
export const TOMORROW = Object.freeze([
	{
		clock: 'tomorrow',
		sees: 'Continue: back on the board where he left off',
		does: 'Continue',
		run: (world) => {
			world.page = 'board';
			world.current = null;
		},
		expect: { rule: 15, sentence: 'Next: small b.', button: 'Make b', primary: true },
	},
	{
		clock: 'tomorrow',
		sees: 'small d open',
		does: 'Clicks the d tile',
		run: (world, coach) => {
			world.page = 'letter';
			world.current = 'd';
			coach.refresh();
		},
		expect: { rule: 15, sentence: 'small d looks done. Next: small b.', button: 'Go to b' },
	},
]);
