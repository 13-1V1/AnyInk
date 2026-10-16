// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// S1 (docs/SKETCH.md section 11 step 13): the 'sketch' flag exists, names S1, and is off until S9
// turns it on. Written to fail first (before features.js had the flag: 3 failed).
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

	it('is off by default', () => {
		expect(FEATURES.sketch).toBe(false);
		expect(isFeatureOn('sketch')).toBe(false);
	});

	it('a test can turn it on, and the reset turns it off again', () => {
		setFeaturesForTests({ sketch: true });
		expect(isFeatureOn('sketch')).toBe(true);
		resetFeaturesForTests();
		expect(isFeatureOn('sketch')).toBe(false);
	});
});
