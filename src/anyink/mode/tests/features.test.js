// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md principle 8, section 10 "Feature flags"): one flag per feature, each turned on
// by the B that builds it, all off until then, so no screen shows a door to a later B. The flag
// names are the ones words.js entries carry, so Help's glossary (B4) and the visibility tables
// (visibility.js, keys.js) agree on what has landed.
import { describe, expect, it } from 'vitest';
import {
	FEATURE_LIST,
	FEATURE_NAMES,
	FEATURES,
	flagsOn,
	isFeatureOn,
	isKnownFeature,
	resetFeaturesForTests,
	setFeaturesForTests,
} from '../features.js';
import { wordEntry, wordKeys } from '../../words/words.js';

/** UX-BEGINNER section 10 lists these, then M11 to M13 (words.js uses all three). */
const SPEC_FLAGS = [
	'coach',
	'letterView',
	'brush',
	'photo',
	'board',
	'checks',
	'tryIt',
	'startScreen',
	'useInWord',
	'fontDetails',
	'help',
	'alternates',
	'weight',
	'roughen',
];

/**
 * The flags the Bs that have landed turned on (B6 + B7 integration; B8 brush, B9 photo; B10 + B11
 * integration: board, checks).
 */
const LANDED = ['coach', 'letterView', 'brush', 'photo', 'board', 'checks'];

describe('feature flags', () => {
	it("are the spec's flags, in its order", () => {
		expect(FEATURE_NAMES).toEqual(SPEC_FLAGS);
		expect(Object.keys(FEATURES)).toEqual(SPEC_FLAGS);
		expect(Object.isFrozen(FEATURES)).toBe(true);
		expect(Object.isFrozen(FEATURE_NAMES)).toBe(true);
	});

	// B6 + B7 integration: each B turned on only its own flag; every later one is still off
	it('are on for the Bs that have landed (B6 to B11) and off for the rest', () => {
		SPEC_FLAGS.forEach((name) => {
			const on = LANDED.includes(name);
			expect(FEATURES[name], name).toBe(on);
			expect(isFeatureOn(name), name).toBe(on);
		});
	});

	it('each names the B (or milestone) that turns it on and what it shows', () => {
		const by = Object.fromEntries(FEATURE_LIST.map((f) => [f.name, f.by]));
		expect(by).toEqual({
			coach: 'B6',
			letterView: 'B7',
			brush: 'B8',
			photo: 'B9',
			board: 'B10',
			checks: 'B11',
			tryIt: 'B12',
			startScreen: 'B13',
			useInWord: 'B14',
			fontDetails: 'B15',
			help: 'B15',
			alternates: 'M11',
			weight: 'M12',
			roughen: 'M13',
		});
		FEATURE_LIST.forEach((f) => expect(f.what, f.name).toMatch(/\w/));
	});

	it('an unknown name is never on, and is not known', () => {
		expect(isFeatureOn('bord')).toBe(false);
		expect(isFeatureOn(undefined)).toBe(false);
		expect(isFeatureOn('toString')).toBe(false);
		expect(isKnownFeature('board')).toBe(true);
		expect(isKnownFeature('bord')).toBe(false);
		expect(isKnownFeature('hasOwnProperty')).toBe(false);
	});

	it('every feature a words.js entry names is a flag here', () => {
		const unknown = wordKeys()
			.map((key) => [key, wordEntry(key).feature])
			.filter(([, feature]) => feature !== null && !isKnownFeature(feature));
		expect(unknown).toEqual([]);
	});
});

describe('test overrides', () => {
	it('turn a flag on for isFeatureOn until reset, and hand back what they replaced', () => {
		// B10 + B11 integration: tryIt and startScreen are flags that haven't landed (board and
		// checks have)
		expect(setFeaturesForTests({ tryIt: true })).toEqual({});
		expect(isFeatureOn('tryIt')).toBe(true);
		expect(isFeatureOn('startScreen')).toBe(false);
		expect(setFeaturesForTests({ startScreen: true })).toEqual({ tryIt: true });
		expect(isFeatureOn('tryIt')).toBe(true);
		expect(isFeatureOn('startScreen')).toBe(true);
		resetFeaturesForTests();
		expect(isFeatureOn('tryIt')).toBe(false);
		expect(isFeatureOn('startScreen')).toBe(false);
	});

	it('turn a landed flag off for isFeatureOn until reset (a "before this B" guard)', () => {
		expect(setFeaturesForTests({ coach: false, letterView: false })).toEqual({});
		expect(isFeatureOn('coach')).toBe(false);
		expect(isFeatureOn('letterView')).toBe(false);
		resetFeaturesForTests();
		expect(isFeatureOn('coach')).toBe(true);
		expect(isFeatureOn('letterView')).toBe(true);
	});

	it('refuse a flag that does not exist, so a typo shows up', () => {
		expect(() => setFeaturesForTests({ bord: true })).toThrow(/bord/);
		expect(isFeatureOn('bord')).toBe(false);
	});

	it('never change FEATURES itself', () => {
		setFeaturesForTests({ tryIt: true, coach: false });
		expect(FEATURES.tryIt).toBe(false);
		expect(FEATURES.coach).toBe(true);
		resetFeaturesForTests();
	});
});

describe('flagsOn', () => {
	it('makes an isOn check for just the flags named (for the pure queries)', () => {
		const isOn = flagsOn('brush', 'board');
		expect(isOn('brush')).toBe(true);
		expect(isOn('board')).toBe(true);
		expect(isOn('coach')).toBe(false);
		expect(flagsOn()('brush')).toBe(false);
		expect(() => flagsOn('bord')).toThrow(/bord/);
	});
});
