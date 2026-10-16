// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { resetCoachForTests } from './src/anyink/coach/coach_state.js';
import { resetGuideLetterForTests } from './src/anyink/letter/guide_letter.js';
import { resetLetterCardForTests } from './src/anyink/letter/letter_card.js';
import { resetNeighborsForTests } from './src/anyink/letter/neighbors.js';
import { resetLetterViewForTests } from './src/anyink/letter/view_switches.js';
import { resetFeaturesForTests } from './src/anyink/mode/features.js';
import { setModeForTests } from './src/anyink/mode/mode.js';
import { log } from './src/app/main';
// B16: Simple is the launch default. A test that loads a fresh module graph (vi.resetModules)
// gets a fresh mode.js, which reads the address before any beforeEach: ?ui=all keeps that copy
// on All tools too, the way the pin below keeps this one.
window.history.replaceState(null, '', '?ui=all');
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
// B6 + B7 integration: the letter view's session state (Fine-tune, the switches, the guide-letter
// visit, the neighbors' first-time labels, Shape options) and the app's coach start fresh too.
beforeEach(() => {
	setModeForTests('all');
	resetFeaturesForTests();
	resetLetterViewForTests();
	resetLetterCardForTests();
	resetGuideLetterForTests();
	resetNeighborsForTests();
	resetCoachForTests();
});
