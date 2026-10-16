// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the Next line's 17 rules (UX-BEGINNER.md 4.0): each rule, their order (the first match
// wins), each rule skipped while its feature flag is off, the one-green rule, Something else,
// and rule 15's next-letter order with one turn per Try-it letter.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RULES, liveSkips, pickLine } from '../rules.js';
import { ALL_FLAGS, fakeState, flags } from './fake_state.js';
import { ALL_READY, EXPECTED, FLOATS, MORE_STATES, RULE_STATES, SEVEN } from './rule_states.js';

const floats = FLOATS;

/** The flags each rule names (4.0, section 10's flag list; B12 stub: rule 4 waits for B14). */
const RULE_FLAGS = {
	1: ['coach'],
	2: ['photo'],
	3: ['photo'],
	4: ['tryIt', 'useInWord'],
	5: ['tryIt'],
	6: ['coach'],
	7: ['letterView', 'checks'],
	8: ['letterView'],
	9: ['board', 'checks'],
	10: ['coach'],
	11: ['photo'],
	12: ['photo'],
	13: ['tryIt'],
	14: ['useInWord'],
	15: ['coach'],
	16: ['board'],
	17: ['tryIt'],
	// B8 + B9 finalize: every letter ready, before rules 13, 14, 16 and 17 can show
	18: ['coach'],
	// S3 (docs/SKETCH.md section 7): the sketch rules, each in its own place in pick() order
	19: ['coach', 'sketch'],
	20: ['letterView', 'sketch'],
	24: ['letterView', 'sketch'],
	25: ['letterView', 'sketch'],
};

/** S3: the order pick() checks them in (19 right after 1, 20 before 7, 24 and 25 after 7) */
const RULE_ORDER = [1, 19, 2, 3, 4, 5, 6, 20, 7, 24, 25, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

describe('the 17 rules', () => {
	it('are 18, numbered 1 to 18 in order, each naming its feature flags (S3: and the sketch rules in their places)', () => {
		expect(RULES.map((rule) => rule.id)).toEqual(RULE_ORDER);
		RULES.forEach((rule) => expect(rule.flags, `rule ${rule.id}`).toEqual(RULE_FLAGS[rule.id]));
	});

	Object.keys(RULE_STATES).forEach((id) => {
		it(`rule ${id}: its sentence and button`, () => {
			const line = pickLine(RULE_STATES[id]());
			expect(line.rule).toBe(Number(id));
			expect({ sentence: line.sentence, button: line.button, action: line.action }).toEqual(
				EXPECTED[id]
			);
		});
	});

	Object.entries(MORE_STATES).forEach(([name, { rule, state, expect: want }]) => {
		it(`rule ${name}: its sentence and button (fix pass)`, () => {
			const line = pickLine(state());
			expect(line.rule).toBe(rule);
			expect({ sentence: line.sentence, button: line.button, action: line.action }).toEqual(want);
		});
	});

	it('rules 1, 2, 3, 5 and 8 have no button at all (the action is already on screen)', () => {
		[1, 2, 3, 5, 8].forEach((id) => {
			const line = pickLine(RULE_STATES[id]());
			expect(line.button, `rule ${id}`).toBe('');
			expect(line.primary, `rule ${id}`).toBe(false);
		});
	});

	it('the first match wins: each rule beats every later rule that also matches', () => {
		// rule 1 over the photo card, Try it, a problem, an unsaved font
		const dialogOverAll = fakeState({
			dialog: 'useInWord',
			page: 'letter',
			current: 'r',
			photoCard: { step: 'result', char: 'r' },
			tryItOpen: true,
			save: 'not-saved',
			ready: 'a',
		});
		expect(pickLine(dialogOverAll).rule).toBe(1);
		// rule 3 over rule 8 (the letter is still empty while step C shows)
		expect(pickLine(RULE_STATES[3]()).rule).toBe(3);
		// rule 4 over rule 5
		expect(pickLine(RULE_STATES[4]()).rule).toBe(4);
		// rule 6 over 7, 9 and 10
		const problem = RULE_STATES[6]();
		const problemAndMore = {
			...fakeState({ page: 'letter', current: 'B', needsLook: { B: floats }, save: 'failed' }),
			fontProblem: problem.fontProblem,
		};
		expect(pickLine(problemAndMore).rule).toBe(6);
		// rule 10 (unsaved) ranks below the photo steps but above rule 12's photo walk
		const unsavedWithPhoto = { ...RULE_STATES[12](), save: 'not-saved' };
		expect(pickLine(unsavedWithPhoto).rule).toBe(10);
		// rule 12 over rule 13 over rule 15, while the Try-it text has a letter not ready yet
		// (B16: with the whole text ready, Try it goes first once: b16_try_before_parts.test.js)
		const both = {
			...RULE_STATES[13](),
			tryItText: 'Brennan Hand!',
			photos: RULE_STATES[12]().photos,
			hasPhoto: true,
		};
		expect(pickLine(both).rule).toBe(12);
		const wholeText = { ...RULE_STATES[13](), photos: RULE_STATES[12]().photos, hasPhoto: true };
		expect(pickLine(wholeText).rule).toBe(13);
		expect(pickLine(RULE_STATES[13]()).rule).toBe(13);
		// rule 13 over rule 14
		expect(pickLine({ ...RULE_STATES[14](), changedSinceTryIt: true }).rule).toBe(13);
		// rule 16 over 17
		expect(pickLine(RULE_STATES[16]()).rule).toBe(16);
	});

	it('every rule is skipped while one of its flags is off', () => {
		Object.keys(RULE_STATES)
			.map(Number)
			.forEach((id) => {
				RULE_FLAGS[id]
					.filter((flag) => flag !== 'coach')
					.forEach((flag) => {
						const state = { ...RULE_STATES[id](), flags: { ...ALL_FLAGS, [flag]: false } };
						expect(pickLine(state).rule, `rule ${id} with ${flag} off`).not.toBe(id);
					});
			});
	});

	it("says nothing at all while the coach's own flag is off", () => {
		const line = pickLine({ ...RULE_STATES[10](), flags: { ...ALL_FLAGS, coach: false } });
		expect(line.rule).toBe(0);
		expect(line.sentence).toBe('');
		expect(line.button).toBe('');
	});

	it('says nothing on the start page (it has no top bar)', () => {
		const line = pickLine({ ...RULE_STATES[11](), page: 'start' });
		expect(line.rule).toBe(0);
		expect(line.sentence).toBe('');
	});

	it('B6 alone (only coach on): an unsaved font asks for Save, a new font names a letter', () => {
		expect(pickLine({ ...RULE_STATES[10](), flags: flags() }).rule).toBe(10);
		const fresh = pickLine(fakeState({ flags: flags(), tryItText: 'My Font' }));
		expect(fresh.rule).toBe(15);
		expect(fresh.sentence).toBe('Next: Capital M.');
		expect(fresh.button).toBe('Make M');
	});
});

describe('the one-green rule (principle 1)', () => {
	it("the line's button is green when nothing else on screen holds a green button", () => {
		const line = pickLine(RULE_STATES[12]());
		expect(line.button).toBe('Do the next one');
		expect(line.primary).toBe(true);
	});

	it('outlined whenever a card, overlay or dialog already shows a green button', () => {
		[4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17].forEach((id) => {
			const line = pickLine({ ...RULE_STATES[id](), otherPrimary: true });
			expect(line.button, `rule ${id}`).not.toBe('');
			expect(line.primary, `rule ${id}`).toBe(false);
		});
	});
});

describe('rule details', () => {
	it('rule 6 offers Show me when Fix it has no safe fix, and has words for a bare problem', () => {
		const state = RULE_STATES[6]();
		const showMe = pickLine({ ...state, fontProblem: { ...state.fontProblem, fixable: false } });
		expect(showMe.button).toBe('Show me');
		expect(showMe.action).toBe('showFontProblem');
		const bare = pickLine({ ...state, fontProblem: { ...state.fontProblem, text: '' } });
		expect(bare.sentence).toBe("small a has a problem the font file can't hold.");
	});

	it('rule 8 names only the ways to fill a letter that exist (principle 8)', () => {
		const empty = (on) => pickLine({ ...RULE_STATES[8](), flags: flags('letterView', ...on) });
		expect(empty(['brush', 'photo']).sentence).toBe(
			'Capital B is empty. Use a photo of it, or draw it with the brush.'
		);
		expect(empty(['photo']).sentence).toBe('Capital B is empty. Use a photo of it.');
		expect(empty(['brush']).sentence).toBe('Capital B is empty. Draw it with the brush.');
		expect(empty([]).sentence).toBe('Capital B is empty. Draw it with points.');
	});

	it('rule 9 says one letter in the singular', () => {
		const line = pickLine(fakeState({ needsLook: { e: floats } }));
		expect(line.sentence).toBe('1 letter needs a look.');
	});

	// B10 + B11 integration: once the board shows Needs a look, [Show me] would do nothing (the
	// tiles are on screen, each with its fixes, outlined). The line goes through them one at a
	// time in rule 7's words, its green button the first one's fix (principle 1: one green that
	// does something); Something else moves on to the next letter
	it("rule 9 on a board already showing Needs a look: the first letter's reason and fix", () => {
		const sinks = { ...floats, id: 'offLine', reason: 'small n sinks below the writing line.' };
		const state = fakeState({ needsLook: { B: floats, n: sinks }, boardFilter: 'needsLook' });
		const first = pickLine(state);
		expect(first).toMatchObject({
			rule: 9,
			sentence: 'Capital B floats above the writing line.',
			button: 'Sit on the line',
			action: 'fixLetter',
			skipKey: 'needsLook:B:seat',
			somethingElse: true,
		});
		expect(first.args).toMatchObject({ char: 'B', check: 'seat' });
		const next = pickLine({ ...state, skips: { [first.skipKey]: first.stamp } });
		expect(next).toMatchObject({ rule: 9, sentence: 'small n sinks below the writing line.' });
		expect(next.args).toMatchObject({ char: 'n', check: 'offLine' });
		// both skipped: never the count's [Show me] there (it would do nothing), and (B10 + B11
		// finalize) never a green way on to a letter not on screen: the count, with no button
		const done = pickLine({
			...state,
			skips: { [first.skipKey]: first.stamp, [next.skipKey]: next.stamp },
		});
		expect(done).toMatchObject({ rule: 9, sentence: '2 letters need a look.', button: '' });
		// on All, the count and [Show me], as before
		const all = pickLine(fakeState({ needsLook: { B: floats, n: sinks }, boardFilter: 'all' }));
		expect(all).toMatchObject({
			rule: 9,
			sentence: '2 letters need a look.',
			button: 'Show me',
			action: 'showNeedsLook',
		});
	});

	it('rule 10 waits while the work file is saving, and also asks when a save failed', () => {
		expect(pickLine(fakeState({ ready: 'a', save: 'saving' })).rule).not.toBe(10);
		expect(pickLine(fakeState({ ready: 'a', save: 'failed' })).rule).toBe(10);
		// no ink: nothing to lose yet
		expect(pickLine(fakeState({ save: 'not-saved' })).rule).not.toBe(10);
	});

	it('rule 11 stops once the font has a photo', () => {
		expect(pickLine(fakeState({ hasPhoto: true })).rule).not.toBe(11);
	});

	it('rule 12 stops at "Done with this photo" and says one letter in the singular', () => {
		const one = fakeState({ ready: 'B', hasPhoto: true, photos: [{ id: 'p', unused: 1 }] });
		expect(pickLine(one).sentence).toBe('This photo has 1 more letter.');
		const done = fakeState({
			ready: 'B',
			hasPhoto: true,
			photos: [{ id: 'p', unused: 4, done: true }],
		});
		expect(pickLine(done).rule).not.toBe(12);
		expect(pickLine(one).args).toEqual({ photoId: 'p' });
	});

	it('rule 13 needs 3 ready letters of the Try-it text, changed since Try it was opened', () => {
		const two = fakeState({ ready: 'Brxyz', tryItText: 'Brennan Hand', changedSinceTryIt: true });
		expect(pickLine(two).rule).not.toBe(13);
		const seen = fakeState({ ready: SEVEN, tryItText: 'Brennan Hand', changedSinceTryIt: false });
		expect(pickLine(seen).rule).not.toBe(13);
	});

	it('rule 14 needs Try it opened since the change, or 10 changed letters', () => {
		const notTried = { ...RULE_STATES[14](), tryItText: 'xyz', changedSinceTryIt: true };
		expect(pickLine(notTried).rule).not.toBe(14);
		expect(pickLine({ ...notTried, lettersChangedSinceFontFile: 10 }).rule).toBe(14);
		expect(pickLine({ ...RULE_STATES[14](), fontFileBehind: false }).rule).not.toBe(14);
	});

	it('rule 15 in the letter view: "<letter> looks done. Next: <letter>." with Go to', () => {
		const line = pickLine(
			fakeState({ page: 'letter', current: 'B', ready: SEVEN, tryItText: 'Brennan Hand' })
		);
		expect(line.sentence).toBe('Capital B looks done. Next: small b.');
		expect(line.button).toBe('Go to b');
		expect(line.args).toEqual({ char: 'b' });
		expect(line.label).toBe(false);
	});

	it('rule 15 names punctuation in words on its button', () => {
		const line = pickLine(fakeState({ ready: ALL_READY.replace('.', '') }));
		expect(line.sentence).toBe('Next: the period.');
		expect(line.button).toBe('Make the period');
	});

	it('rule 16 counts the set, and rule 17 needs every letter ready', () => {
		expect(pickLine(RULE_STATES[16]()).sentence).toContain('All 58 letters');
		const oneLook = fakeState({
			ready: ALL_READY.replace('z', '') + '0123456789:;"()&@#$%/*',
			needsLook: { z: floats },
			numbers: true,
			flags: flags('tryIt', 'board'),
		});
		expect(pickLine(oneLook).rule).not.toBe(17);
	});

	it('a letter that needs a look is never called up to date: rule 9 speaks in the letter view once no letter is empty', () => {
		const state = fakeState({
			page: 'letter',
			current: 'a',
			ready: ALL_READY.replace('z', ''),
			needsLook: { z: floats },
		});
		expect(pickLine(state).rule).toBe(9);
		// while letters are still empty, the letter view goes on to the next one
		const early = fakeState({ page: 'letter', current: 'a', ready: 'a', needsLook: { z: floats } });
		expect(pickLine(early).rule).toBe(15);
	});
});

describe('rule 15: the next empty letter', () => {
	// only the coach on: rule 11 (a photo first) would speak on a font with no ink
	const next = (options) => pickLine(fakeState({ flags: flags(), ...options })).args?.char;

	it('Try-it letters first, in the order typed', () => {
		expect(next({ tryItText: 'Brennan Hand' })).toBe('B');
		expect(next({ ready: 'B', tryItText: 'Brennan Hand' })).toBe('r');
		expect(next({ ready: 'Bren', tryItText: 'Brennan Hand' })).toBe('a');
		expect(next({ ready: 'BrenaH', tryItText: 'Brennan Hand' })).toBe('d');
	});

	it('then a to z, then A to Z, then punctuation, then numbers & symbols when added', () => {
		expect(next({ ready: 'abc' })).toBe('d');
		expect(next({ ready: 'abcdefghijklmnopqrstuvwxyz' })).toBe('A');
		expect(next({ ready: ALL_READY.slice(0, 52) })).toBe('.');
		expect(next({ ready: ALL_READY })).toBe(undefined);
		expect(next({ ready: ALL_READY, numbers: true })).toBe('0');
	});

	it('each Try-it letter gets one turn, then drops back into the normal order', () => {
		// H's turn was used: the coach goes on to a to z instead of chasing it
		expect(next({ ready: 'Brenad', tryItText: 'Brennan Hand', turnsUsed: ['H'] })).toBe('b');
		const line = pickLine(fakeState({ ready: 'Brenad', tryItText: 'Brennan Hand' }));
		expect(line.args.char).toBe('H');
		expect(line.fromTryIt).toBe(true);
	});

	it('never suggests the letter already open', () => {
		const line = pickLine(
			fakeState({ page: 'letter', current: 'a', flags: flags(), tryItText: 'ab' })
		);
		expect(line.args.char).toBe('b');
		expect(line.sentence).toBe('Next: small b.');
	});
});

describe('Something else (skips)', () => {
	it('moves to the next rule that matches, until the state behind the skip changes', () => {
		const state = RULE_STATES[10]();
		const first = pickLine(state);
		expect(first.rule).toBe(10);
		expect(first.somethingElse).toBe(true);
		const skipped = pickLine({ ...state, skips: { [first.skipKey]: first.stamp } });
		expect(skipped.rule).toBeGreaterThan(10);
		// the save failed now: a new state behind it, so the line asks again
		const changed = pickLine({ ...state, save: 'failed', skips: { [first.skipKey]: first.stamp } });
		expect(changed.rule).toBe(10);
	});

	it('per suggestion: skipping "next letter: b" suggests c', () => {
		const state = fakeState({ ready: 'a' });
		const first = pickLine(state);
		expect(first.args.char).toBe('b');
		expect(first.skipKey).toBe('next:b');
		const second = pickLine({ ...state, skips: { 'next:b': first.stamp } });
		expect(second.args.char).toBe('c');
	});

	it('per photo: skipping one photo goes on to the next photo with parts left', () => {
		const state = fakeState({
			ready: 'B',
			hasPhoto: true,
			photos: [
				{ id: 'one', unused: 3 },
				{ id: 'two', unused: 2 },
			],
		});
		const first = pickLine(state);
		expect(first.args).toEqual({ photoId: 'one' });
		const second = pickLine({ ...state, skips: { [first.skipKey]: first.stamp } });
		expect(second.args).toEqual({ photoId: 'two' });
		expect(second.sentence).toBe('This photo has 2 more letters.');
	});

	it('is offered only when something else would show, and never on an open dialog', () => {
		expect(pickLine(RULE_STATES[1]()).somethingElse).toBe(false);
		const last = fakeState({
			ready: ALL_READY + '0123456789:;"()&@#$%/*',
			numbers: true,
			flags: flags('tryIt'),
		});
		const line = pickLine(last);
		expect(line.rule).toBe(17);
		expect(line.somethingElse).toBe(false);
	});
});

// B6 + B7 fix pass (first-timer 05, 17, 23, 24): a Point pen shape still open was called done
describe('a shape still being drawn (the Point pen) is never called done', () => {
	const drawing = (points, rest = {}) =>
		fakeState({
			page: 'letter',
			current: 'b',
			drawing: points,
			tool: 'newPath',
			flags: flags('letterView'),
			...rest,
		});

	it('one or two points: keep clicking, and the sentence names Finish the shape', () => {
		[1, 2].forEach((points) => {
			const line = pickLine(drawing(points));
			expect(line.rule, `${points} points`).toBe(8);
			expect(line.sentence).toBe('Keep clicking to drop points, then press Finish the shape.');
			expect(line.button).toBe('');
			expect(line.primary).toBe(false);
			expect(line.somethingElse).toBe(false);
		});
	});

	it('three points or more: "Click your first point, or press Finish the shape."', () => {
		const line = pickLine(drawing(3, { save: 'saved' }));
		expect(line.rule).toBe(8);
		expect(line.sentence).toBe('Click your first point, or press Finish the shape.');
		expect(line.button).toBe('');
		expect(line.somethingElse).toBe(false);
	});

	it('Save (rule 10) and the next letter (rule 15) wait until the shape is finished', () => {
		// with no ink anywhere else and no work file: never "Your work isn't saved yet." [Save]
		expect(pickLine(drawing(1, { save: 'not-saved' })).rule).toBe(8);
		// even with the letter view's own rule off, nothing calls the letter done or asks to save
		const bare = pickLine(drawing(3, { save: 'not-saved', ready: 'a', flags: flags() }));
		expect([10, 15]).not.toContain(bare.rule);
		expect(bare.sentence).not.toMatch(/looks done/);
	});

	it('a letter being drawn never counts as ready, even if a source says it is', () => {
		const state = fakeState({
			page: 'board',
			ready: 'Bre',
			tryItText: 'Brennan Hand',
			changedSinceTryIt: true,
			flags: flags('letterView', 'tryIt'),
		});
		expect(pickLine(state).rule).toBe(13);
		// e is half drawn: B and r are the only ready Try-it letters, and rule 13 needs 3
		const e = state.letters.find((l) => l.char === 'e');
		e.drawing = { points: 2 };
		expect(pickLine(state).rule).not.toBe(13);
	});

	it('rule 7 never judges a shape still being drawn', () => {
		const state = fakeState({
			page: 'letter',
			current: 'B',
			needsLook: { B: floats },
			drawing: 2,
			tool: 'newPath',
		});
		expect(pickLine(state).rule).toBe(8);
	});

	it('once the shape is finished, the letter looks done again', () => {
		const line = pickLine(
			fakeState({ page: 'letter', current: 'b', ready: 'b', flags: flags('letterView') })
		);
		expect(line.sentence).toBe('small b looks done. Next: small a.');
	});
});

// B6 + B7 fix pass (first-timer 04): a drawing tool picked on an empty letter took the overlay's
// green button away, and the line still named it
describe('rule 8 with a drawing tool picked says what the tool does', () => {
	const empty = (tool, page = 'letter') =>
		pickLine(fakeState({ page, current: 'B', tool, flags: flags('letterView') }));

	it('Point pen, Rectangle and Oval each say what to do on the paper, with no button', () => {
		expect(empty('newPath').sentence).toBe('Click on the paper to drop your first point.');
		expect(empty('newRectangle').sentence).toBe('Drag on the paper to draw a rectangle.');
		expect(empty('newOval').sentence).toBe('Drag on the paper to draw an oval.');
		['newPath', 'newRectangle', 'newOval'].forEach((tool) => {
			expect(empty(tool).rule, tool).toBe(8);
			expect(empty(tool).button, tool).toBe('');
		});
	});

	it('Select and Edit points keep the plain sentence', () => {
		expect(empty('resize').sentence).toBe('Capital B is empty. Draw it with points.');
		expect(empty('pathEdit').sentence).toBe('Capital B is empty. Draw it with points.');
	});

	it('a picked tool means nothing on the board', () => {
		expect(empty('newPath', 'board').rule).not.toBe(8);
	});
});

// B6 + B7 fix pass (hostile probe_failed): the pill said "Couldn't save [Fix]", the line "not
// saved yet [Save]"
describe('rule 10 after a failed save', () => {
	it("says the pill's words and offers Fix, which opens the pill's own box", () => {
		const line = pickLine(fakeState({ ready: 'a', save: 'failed' }));
		expect(line).toMatchObject({
			rule: 10,
			sentence: "Couldn't save your work.",
			button: 'Fix',
			action: 'fixSave',
			primary: true,
		});
		const notYet = pickLine(fakeState({ ready: 'a', save: 'not-saved' }));
		expect(notYet).toMatchObject({ button: 'Save', action: 'save' });
	});
});

// B6 + B7 fix pass (hostile probe_coach): a skip lasts until the state behind it changes
describe('liveSkips: the suggestions the state holds now, for ending old skips', () => {
	it('names each suggestion by its skip key with its stamp, whatever page shows', () => {
		const live = liveSkips(
			fakeState({ ready: 'a', save: 'not-saved', page: 'letter', current: 'a' })
		);
		expect(live.get('save')).toBe('not-saved');
		expect(live.get('next:b')).toBe('empty');
		expect(live.get('next:c')).toBe('empty');
		expect(live.has('next:a')).toBe(false);
	});

	it('every key a line can be skipped by is live in that state, with the same stamp', () => {
		Object.keys(RULE_STATES).forEach((id) => {
			const state = RULE_STATES[id]();
			const line = pickLine(state);
			if (!line.skipKey) return;
			expect(liveSkips(state).get(line.skipKey), `rule ${id}`).toBe(line.stamp);
		});
	});

	it('a state that changed ends the skip: saved, then not saved again', () => {
		expect(liveSkips(fakeState({ ready: 'a', save: 'saved' })).has('save')).toBe(false);
		expect(liveSkips(fakeState({ ready: 'ac' })).has('next:c')).toBe(false);
	});

	it('a rule whose flag is off holds no suggestion', () => {
		const live = liveSkips(fakeState({ flags: flags() }));
		expect(live.has('firstPhoto')).toBe(false);
		expect(live.get('next:a')).toBe('empty');
	});
});

// B6 + B7 finalize (verdicts: "A skipped font problem comes back unasked", "mid-shape, another
// letter's problem takes the line", "a stray line is neither empty nor Ready")
describe('rule 6 holds every problem of the font check', () => {
	const problem = (char, kind, text) => ({
		itemId: `glyph-0x${char.codePointAt(0).toString(16)}`,
		problem: kind,
		text,
		fixable: true,
	});
	const rProblem = problem('r', 'ink-no-width', 'small r has ink but no width.');
	const bProblem = problem('B', 'shape-points', 'Capital B has a shape with only 1 point.');

	it("a skipped problem stays skipped while another letter's problem shows first, and after it is fixed", () => {
		const base = fakeState({ ready: 'Bre', page: 'board' });
		const first = pickLine({ ...base, fontProblems: [rProblem], fontProblem: rProblem });
		expect(first.rule).toBe(6);
		const skips = { [first.skipKey]: first.stamp };
		// B's problem shows first: both are live, so the skip of r's is kept
		const both = { ...base, fontProblems: [bProblem, rProblem], fontProblem: bProblem, skips };
		expect(liveSkips(both).get(first.skipKey)).toBe(first.stamp);
		expect(pickLine(both).sentence).toBe(bProblem.text);
		// B fixed: r's problem is still skipped, the line moves on
		const after = { ...base, fontProblems: [rProblem], fontProblem: rProblem, skips };
		expect(pickLine(after).rule).not.toBe(6);
	});

	it('the first problem skipped: the line says the next one, not nothing', () => {
		const base = fakeState({ ready: 'Bre', page: 'board' });
		const line = pickLine({ ...base, fontProblems: [rProblem, bProblem], fontProblem: rProblem });
		const skips = { [line.skipKey]: line.stamp };
		const next = pickLine({
			...base,
			fontProblems: [rProblem, bProblem],
			fontProblem: rProblem,
			skips,
		});
		expect(next).toMatchObject({ rule: 6, sentence: bProblem.text });
	});

	it("mid-shape the line keeps to the drawing: another letter's problem waits", () => {
		const state = fakeState({ ready: 'Bre', page: 'letter', current: 'c', drawing: 3 });
		const line = pickLine({ ...state, fontProblems: [bProblem], fontProblem: bProblem });
		expect(line).toMatchObject({ rule: 8, button: '' });
		// its skip is still held while it waits
		expect(
			liveSkips({ ...state, fontProblems: [bProblem] }).has(
				`fontProblem:${bProblem.itemId}:${bProblem.problem}`
			)
		).toBe(true);
	});
});

describe('rule 8: empty is no finished shape', () => {
	it('a letter whose only shape is a stray line is not empty: no "is empty" line', () => {
		const state = fakeState({ ready: 'Bre', page: 'letter', current: 'a' });
		const letters = state.letters.map((l) =>
			l.char === 'a' ? { ...l, ink: false, shapes: true } : l
		);
		const line = pickLine({ ...state, letters, letter: letters.find((l) => l.char === 'a') });
		expect(line.rule).not.toBe(8);
	});
});

describe('rules.js stays pure', () => {
	it('imports only words, letter names, the letter order, skips and character codes', () => {
		const here = dirname(fileURLToPath(import.meta.url));
		const source = readFileSync(join(here, '..', 'rules.js'), 'utf8');
		const imports = [...source.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
		expect(imports.sort()).toEqual([
			'../../common/character_ids.js',
			'../words/letter_name.js',
			'../words/words.js',
			'./letter_order.js',
			'./skips.js',
		]);
	});

	it('never changes the state it is given', () => {
		const state = RULE_STATES[12]();
		const before = JSON.stringify(state);
		pickLine(state);
		pickLine({ ...state, skips: { 'photo:photo-1': '6' } });
		expect(JSON.stringify(state)).toBe(before);
	});
});
