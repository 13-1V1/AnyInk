// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the beginner's journey (UX-BEGINNER.md section 3) replayed on a fake font. Every "Next:"
// sentence in that table is what the rules in 4.0 say at that moment; this walks the table
// (journey_steps.js, shared with tests/coach.html) with a real coach (coach_state.js: its
// memory of changes, Try it and the font file) over a fake font, and checks each sentence and
// button. B16 replays it on the real screens.
import { beforeEach, describe, expect, it } from 'vitest';
import { FEATURE_NAMES, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { JOURNEY, TOMORROW, launch, makeWorld } from './journey_steps.js';

/**
 * @param {Object} coach
 * @param {Object} step
 */
function check(coach, step) {
	const line = coach.line();
	const label = `${step.clock} ${step.does}`;
	expect({ rule: line.rule, sentence: line.sentence, button: line.button }, label).toEqual({
		rule: step.expect.rule,
		sentence: step.expect.sentence,
		button: step.expect.button,
	});
	if (step.expect.primary !== undefined) expect(line.primary, label).toBe(step.expect.primary);
}

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setModeForTests('simple');
	// the whole journey: every feature it walks through is on (B16); 'sketch' stays as it ships
	// (off until S9: S3 integration gave rule 8 its sketch words)
	setFeaturesForTests(
		Object.fromEntries(FEATURE_NAMES.map((name) => [name, name !== 'sketch']))
	);
});

describe("the beginner's journey (section 3)", () => {
	it('from a new font to typing "Brennan Hand" in Word, one sentence per moment', () => {
		const world = makeWorld();
		const coach = launch(world);
		JOURNEY.forEach((step) => {
			step.run(world, coach);
			check(coach, step);
		});
		expect(JOURNEY.length).toBeGreaterThan(20);
	});

	it('the journey walks rules 1, 3, 4, 5, 11, 12, 13 and 15, in that table order', () => {
		const world = makeWorld();
		const coach = launch(world);
		const rules = [];
		JOURNEY.forEach((step) => {
			step.run(world, coach);
			const rule = coach.line().rule;
			if (rules.at(-1) !== rule) rules.push(rule);
		});
		expect([...new Set(rules)].sort((a, b) => a - b)).toEqual([0, 1, 3, 4, 5, 11, 12, 13, 15]);
	});

	// B6 + B7 fix pass (hostile probe1): the table changes each letter in one step; a letter he
	// draws himself takes many, and each one used up a Try-it letter's one turn
	it('a letter finished in many steps keeps the next Try-it letter waiting', () => {
		const world = makeWorld();
		const coach = launch(world);
		world.page = 'letter';
		world.current = 'B';
		world.ink.add('B');
		coach.note('letterChanged', { char: 'B', ink: true });
		expect(coach.line().sentence).toBe('Capital B looks done. Next: small r.');
		for (let step = 1; step <= 5; step++) {
			coach.note('letterChanged', { char: 'B', ink: true });
			expect(coach.line().sentence, `step ${step} on B`).toBe(
				'Capital B looks done. Next: small r.'
			);
		}
		// opening a third letter instead is doing something else: r drops back
		world.current = 'z';
		coach.note('letterOpened', 'z');
		expect(coach.line().sentence).toBe('small z is empty. Use a photo of it, or draw it with the brush.');
		world.current = 'B';
		coach.refresh();
		expect(coach.line().sentence).toBe('Capital B looks done. Next: small e.');
	});

	it('coming back tomorrow: rule 15 suggests the next empty letter, not Try it again', () => {
		const world = makeWorld();
		const today = launch(world);
		JOURNEY.forEach((step) => step.run(world, today));
		const tomorrow = launch(world);
		TOMORROW.forEach((step) => {
			step.run(world, tomorrow);
			check(tomorrow, step);
		});
	});
});
