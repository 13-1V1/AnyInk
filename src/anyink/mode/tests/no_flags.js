// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 integration: the tests that pin Simple "with no flag" (B5's stub: today's screens minus
	what Simple hides) keep checking that path now that B6 and B7 have turned 'coach' and
	'letterView' on in the app. They turn every flag off for themselves; the vitest setup puts the
	real flags back before the next test.

	  NO_FLAGS     { name: false } for every flag
	  noFlags()    setFeaturesForTests(NO_FLAGS)
*/
import { FEATURE_NAMES, setFeaturesForTests } from '../features.js';

/** @type {Readonly<Object<String, Boolean>>} */
export const NO_FLAGS = Object.freeze(Object.fromEntries(FEATURE_NAMES.map((name) => [name, false])));

/** Every flag off until the next reset (the vitest setup runs one before every test). */
export function noFlags() {
	setFeaturesForTests(NO_FLAGS);
}
