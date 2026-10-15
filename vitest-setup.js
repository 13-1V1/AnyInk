// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { resetFeaturesForTests } from './src/anyink/mode/features.js';
import { setModeForTests } from './src/anyink/mode/mode.js';
import { log } from './src/app/main';
beforeAll(() => {
	global.log = log;
});
afterAll(() => {
	delete global.log;
});
// ANY-INK (B5, UX-BEGINNER.md 6.3 "Tests"): every test starts in All tools with no feature flag
// forced, so the suite keeps seeing upstream behavior; a Simple test opts in with
// setModeForTests('simple') (and setFeaturesForTests for a flag). 'all' is written out so the pin
// holds after B16 makes Simple the launch default.
beforeEach(() => {
	setModeForTests('all');
	resetFeaturesForTests();
});
