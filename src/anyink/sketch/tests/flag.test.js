// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 (docs/SKETCH.md section 11 step 13): the 'sketch' flag exists, names S1. S4 turned it on
// (10/16/2026, ahead of S9) for Gate 2b; a test can still turn it off. Written to fail first
// (before features.js had the flag: 3 failed).
import { describe, expect, it } from 'vitest';
import {
	FEATURE_LIST,
	FEATURES,
	isFeatureOn,
	isKnownFeature,
	resetFeaturesForTests,
	setFeaturesForTests,
} from '../../mode/features.js';

describe("the 'sketch' flag", () => {
	it('is a known flag, made by S1, for sketched letters', () => {
		expect(isKnownFeature('sketch')).toBe(true);
		expect(FEATURE_LIST.find((feature) => feature.name === 'sketch')).toEqual({
			name: 'sketch',
			by: 'S1',
			what: 'sketched letters',
		});
	});

	it('is on as shipped since S4', () => {
		expect(FEATURES.sketch).toBe(true);
		expect(isFeatureOn('sketch')).toBe(true);
	});

	it('a test can turn it off, and the reset turns it on again', () => {
		setFeaturesForTests({ sketch: false });
		expect(isFeatureOn('sketch')).toBe(false);
		resetFeaturesForTests();
		expect(isFeatureOn('sketch')).toBe(true);
	});
});
