// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 6.3 "Tests"): the vitest setup file pins mode 'all' with no feature flag
// forced before every test, so the existing suite keeps seeing upstream behavior and a Simple
// test opts in with setModeForTests('simple'). These two tests run in order: the first leaves
// Simple and a flag on, the second must not see them. The pin is the explicit 'all', so it holds
// after B16 flips the launch default.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isFeatureOn, setFeaturesForTests } from '../features.js';
import { getMode, setModeForTests } from '../mode.js';

describe('the vitest setup pins All tools', () => {
	it('a test may switch to Simple and turn a flag on (and not clean up)', () => {
		setModeForTests('simple');
		setFeaturesForTests({ board: true });
		expect(getMode()).toBe('simple');
		expect(isFeatureOn('board')).toBe(true);
	});

	it('the next test starts in All tools with every flag off again', () => {
		expect(getMode()).toBe('all');
		expect(document.documentElement.getAttribute('data-ui-mode')).toBe('all');
		expect(isFeatureOn('board')).toBe(false);
	});

	it('the setup file says so', () => {
		const setup = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../../../../vitest-setup.js'),
			'utf8'
		);
		expect(setup).toMatch(/setModeForTests\('all'\)/);
		expect(setup).toMatch(/resetFeaturesForTests\(\)/);
	});
});
