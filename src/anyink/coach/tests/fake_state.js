// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 test helper: a fake font for the coach's rules (UX-BEGINNER.md 4.0), written short.
	  fakeState({ ready: 'Bre', needsLook: { e: {...} }, page: 'letter', current: 'e', ... })
	builds the state rules.js reads: every letter of the set, which have ink, which are ready,
	which need a look, and the facts (dialog, photo card, Try it, save status, photos, changes).
	B6 + B7 fix pass: drawing (a number of points) puts a Point pen shape, still open, in the
	open letter (it has ink and is not ready); tool is the picked tool's internal name.
	  ALL_FLAGS                    every feature flag on
	  SHIPPED_FLAGS                every flag on but the ones still being built ('sketch' until
	                               S9): fakeState's default (S3 integration: the sketch words now
	                               exist, so the B-series rules are read as they ship)
	  flags(...names)              only these on (plus 'coach')
*/
import { FEATURE_NAMES } from '../../mode/features.js';
import { lettersInSet } from '../letter_order.js';

export const ALL_FLAGS = Object.freeze(Object.fromEntries(FEATURE_NAMES.map((n) => [n, true])));
export const SHIPPED_FLAGS = Object.freeze({ ...ALL_FLAGS, sketch: false });

/**
 * @param {...String} names
 * @returns {Object<String, Boolean>} 'coach' and these on, every other flag off
 */
export function flags(...names) {
	const on = new Set(['coach', ...names]);
	return Object.fromEntries(FEATURE_NAMES.map((n) => [n, on.has(n)]));
}

/**
 * @param {Object} [options]
 * @param {String} [options.ready] - letters with ink that are ready ('Bre')
 * @param {Object<String, Object>} [options.needsLook] - letters with ink that need a look:
 *   { e: { id, reason, fixLabel, action } }
 * @param {Boolean} [options.numbers] - "+ Numbers & symbols" is added
 * @param {String} [options.page] - 'board' | 'letter' | 'other' | 'start'
 * @param {String} [options.current] - the open letter (page 'letter')
 * @param {Number | null} [options.drawing] - the open letter has a Point pen shape still open,
 *   with this many points
 * @param {String} [options.tool] - the picked tool ('newPath', 'resize', ...)
 * @returns {Object} the state rules.js reads
 */
export function fakeState({
	ready = '',
	needsLook = {},
	numbers = false,
	page = 'board',
	current = null,
	drawing = null,
	tool = 'resize',
	flags: flagSet = SHIPPED_FLAGS,
	...rest
} = {}) {
	const set = lettersInSet(numbers ? 'quick+numbers' : 'quick');
	const readySet = new Set([...ready]);
	const letters = set.map((char) => {
		const look = needsLook[char] || null;
		const open = drawing !== null && char === current ? { points: drawing } : null;
		const ink = readySet.has(char) || !!look || !!open;
		return { char, ink, ready: ink && !look && !open, needsLook: look, drawing: open };
	});
	const letter = current ? letters.find((l) => l.char === current) || null : null;
	return {
		flags: flagSet,
		page,
		tool,
		dialog: null,
		photoCard: null,
		tryItOpen: false,
		otherPrimary: false,
		letter: page === 'letter' ? letter : null,
		letters,
		numbersAdded: numbers,
		fontProblem: null,
		save: 'saved',
		hasPhoto: false,
		photos: [],
		tryItText: '',
		changedSinceTryIt: false,
		fontFileBehind: false,
		lettersChangedSinceFontFile: 0,
		turnsUsed: [],
		skips: {},
		...rest,
	};
}
