// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Feature flags for the Simple screens (UX-BEGINNER.md principle 8 and section 10): one flag per
	feature. Every button, menu row, coach rule, tip, key and Help entry names its flag and stays
	hidden while the flag is off, so no B shows a door to a later B. Each B turns on only its own
	flag when it lands, by changing its own line in FEATURES from false to true. B5 lists them all,
	all off; the names are the ones words.js entries, visibility.js and keys.js use.

	  FEATURE_LIST          { name, by, what } in the spec's order: the B (or milestone) that
	                        turns each one on and what it shows
	  FEATURE_NAMES         the names, in that order
	  FEATURES              { name: Boolean }: what is on in the app
	  isFeatureOn(name)     true only for a known flag that is on (or turned on by a test)
	  isKnownFeature(name)
	  flagsOn(...names)     an isOn check for just those flags, for the pure queries in
	                        visibility.js and keys.js ({ isOn: flagsOn('letterView') })
	  setFeaturesForTests({ name: Boolean })   overrides isFeatureOn; returns the overrides it
	                        replaced; a name that isn't a flag throws
	  resetFeaturesForTests()   back to FEATURES (the vitest setup runs it before every test)
*/

/** @type {ReadonlyArray<Readonly<{name: String, by: String, what: String}>>} */
export const FEATURE_LIST = Object.freeze(
	[
		{
			name: 'coach',
			by: 'B6',
			what: 'the Simple top bar and Menu, the Next line, tips, undo toasts, the save pill',
		},
		{ name: 'letterView', by: 'B7', what: 'the letter view and its letter card, with Fine-tune' },
		{ name: 'brush', by: 'B8', what: 'the Brush tool' },
		{ name: 'photo', by: 'B9', what: 'the How card, the photo dialog and the photo card' },
		{ name: 'board', by: 'B10', what: 'the letter board, home in Simple' },
		{ name: 'checks', by: 'B11', what: '"Needs a look" and its one-click fixes' },
		{ name: 'tryIt', by: 'B12', what: 'Try it and gap fixes' },
		{ name: 'startScreen', by: 'B13', what: 'the start screen and its crash card' },
		{ name: 'useInWord', by: 'B14', what: 'Use in Word: the font file and the install steps' },
		{ name: 'fontDetails', by: 'B15', what: 'Font details and Move the guide lines' },
		{ name: 'help', by: 'B15', what: 'the Simple Help page' },
		{ name: 'alternates', by: 'M11', what: 'versions of a letter' },
		{ name: 'weight', by: 'M12', what: 'boldness' },
		{ name: 'roughen', by: 'M13', what: 'ink texture' },
	].map((feature) => Object.freeze(feature))
);

/** @type {ReadonlyArray<String>} */
export const FEATURE_NAMES = Object.freeze(FEATURE_LIST.map((feature) => feature.name));

/** What is on in the app. Each B changes only its own line. */
export const FEATURES = Object.freeze({
	coach: true,
	letterView: true,
	brush: true,
	photo: true,
	board: true,
	checks: true,
	tryIt: false,
	startScreen: false,
	useInWord: false,
	fontDetails: false,
	help: false,
	alternates: false,
	weight: false,
	roughen: false,
});

/** Test overrides: { name: Boolean } */
let overrides = {};

/**
 * @param {String} name
 * @returns {Boolean}
 */
export function isKnownFeature(name) {
	return typeof name === 'string' && FEATURE_NAMES.includes(name);
}

/**
 * @param {String} name - a flag name, e.g. 'board'
 * @returns {Boolean} true only for a flag that exists and is on
 */
export function isFeatureOn(name) {
	if (!isKnownFeature(name)) return false;
	if (Object.hasOwn(overrides, name)) return overrides[name] === true;
	return FEATURES[name] === true;
}

/**
 * @param {Array<String>} names
 * @returns {void} throws for a name that isn't a flag
 */
function checkNames(names) {
	names.forEach((name) => {
		if (!isKnownFeature(name)) throw new Error(`features: "${name}" is not a feature flag`);
	});
}

/**
 * @param {...String} names
 * @returns {(name: String) => Boolean} on for exactly these flags
 */
export function flagsOn(...names) {
	checkNames(names);
	const on = new Set(names);
	return (name) => on.has(name);
}

/**
 * @param {Object<String, Boolean>} flags
 * @returns {Object<String, Boolean>} the overrides it replaced (a copy)
 */
export function setFeaturesForTests(flags = {}) {
	checkNames(Object.keys(flags));
	const previous = { ...overrides };
	overrides = { ...overrides, ...flags };
	return previous;
}

/** Back to FEATURES. */
export function resetFeaturesForTests() {
	overrides = {};
}
