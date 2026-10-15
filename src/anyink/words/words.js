// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: the one vocabulary file (UX-BEGINNER.md 2.1, 2.2). Every string on the Simple main path is
	a key here: screens, coach sentences, tips, toasts, dialogs, words drawn on the canvas and the
	File menu. Code asks for words by key and never writes such a label inline. Internal ids never
	change (D-001).

	This file only gathers. The words live in words/sets/*.js, one file per owner, so two tracks
	never edit the same file: core.js (the glossary and the house words, B4), history.js (the
	Undo titles, B4), toasts.js (the toast track), screens.js (the display-points track), and a
	set of its own for each later B (e.g. sets/coach.js). A new file in sets/ is picked up with
	no change here. A key that two sets both define stops the load.

	An entry: { text, hint, pro, feature, quote, like }
	  text     the house words; {name} is filled from vars, {count|one|other} picks by number
	           with # standing for the number ('moved {count|a shape|# shapes}')
	  hint     what it means, for a "?" hint or Help's glossary ('' for none)
	  pro      the pro word(s), comma-separated; shown only as small print inside a "?" hint
	           (.anyink-pro-word), never scanned for banned words
	  feature  the feature flag that ships it (features.js), or null for words live from B4;
	           Help shows only words whose feature has landed (principle 8)
	  quote    true for an exact label from Windows or Word, or a file name, shown in quotes
	           (.anyink-quote); its text is exempt from the banned-word scan
	  like     glossary only: the everyday comparison ('One stamp in a rubber-stamp set')

	  word(key, vars)          the text, placeholders filled; throws for a missing key or value
	  wordEntry(key)           the whole entry (frozen), or undefined
	  hasWord(key) / wordKeys()
	  proWord(key)             the pro word(s), '' for none
	  keyForProWord(term)      the key whose pro words include term, any case; '' for none
	  glossary(isOn)           2.1's entries in order, only those whose feature has landed
	  isLanded(key, isOn)      true for words live from B4 and words whose flag is on
	  labelCase(text)          'writing line' -> 'Writing line', for a label that starts a line;
	                           never for a sentence that starts with a letter name ('small a')
	  fillWord(text, vars)     the placeholder engine on its own
	  buildWords(modules)      the gathering, for tests: { path: module } -> frozen table
*/
import { isFeatureOn } from '../mode/features.js';
import { GLOSSARY } from './sets/core.js';

const FIELDS = Object.freeze(['text', 'hint', 'pro', 'feature', 'quote', 'like']);
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
const PLACEHOLDER = /\{([^{}]*)\}/g;
const PLACEHOLDER_BODY = /^[a-zA-Z][a-zA-Z0-9]*(\|[^|{}]*\|[^|{}]*)?$/;

/**
 * Gathers the key sets into one checked, frozen table.
 * @param {Object<String, {default: Object}>} modules - { './sets/core.js': module, ... }
 * @returns {Readonly<Object<String, Readonly<Object>>>}
 */
export function buildWords(modules) {
	const table = {};
	const from = {};
	Object.keys(modules)
		.sort()
		.forEach((path) => {
			const set = modules[path]?.default || {};
			Object.entries(set).forEach(([key, entry]) => {
				if (Object.hasOwn(table, key)) {
					throw new Error(`words: "${key}" is in both ${from[key]} and ${path}`);
				}
				table[key] = normalize(key, entry, path);
				from[key] = path;
			});
		});
	return Object.freeze(table);
}

/**
 * @param {String} key
 * @param {Object} entry
 * @param {String} path - the set file, for the error
 * @returns {Readonly<Object>}
 */
function normalize(key, entry, path) {
	const fail = (why) => {
		throw new Error(`words: "${key}" in ${path}: ${why}`);
	};
	if (!KEY_PATTERN.test(key)) fail('a key is dotted camelCase, like "line.baseline"');
	if (!entry || typeof entry !== 'object') fail('an entry is an object');
	Object.keys(entry).forEach((field) => {
		if (!FIELDS.includes(field)) fail(`unknown field "${field}"`);
	});
	const { text, hint = '', pro = '', feature = null, quote = false, like = '' } = entry;
	if (typeof text !== 'string' || !text.trim()) fail('text must be words');
	if (typeof hint !== 'string') fail('hint must be a string');
	if (typeof pro !== 'string') fail('pro must be a string');
	if (typeof like !== 'string') fail('like must be a string');
	if (feature !== null && (typeof feature !== 'string' || !feature)) {
		fail('feature must be a flag name or null');
	}
	if (typeof quote !== 'boolean') fail('quote must be true or false');
	[text, hint, like].forEach((value) => {
		if (!placeholdersOk(value)) fail(`broken placeholder in "${value}"`);
	});
	return Object.freeze({ text, hint, pro, feature, quote, like });
}

/** Every { has its }, and each holds a name or name|one|other. */
function placeholdersOk(value) {
	const outside = value.replace(PLACEHOLDER, '');
	if (outside.includes('{') || outside.includes('}')) return false;
	return [...value.matchAll(PLACEHOLDER)].every((m) => PLACEHOLDER_BODY.test(m[1]));
}

// Every set file in sets/, gathered at load (Vite and Vitest both read this).
const WORDS = buildWords(import.meta.glob('./sets/*.js', { eager: true }));

/**
 * @param {String} text - house words with {placeholders}
 * @param {Object} [vars]
 * @param {String} [key] - for the error
 * @returns {String}
 */
export function fillWord(text, vars = {}, key = '') {
	return String(text).replace(PLACEHOLDER, (_all, body) => {
		const [name, one, other] = body.split('|');
		if (!vars || !Object.hasOwn(vars, name) || vars[name] === undefined || vars[name] === null) {
			throw new Error(`words: ${key ? `"${key}" ` : ''}needs a value for {${name}}`);
		}
		const value = vars[name];
		if (one === undefined) return String(value);
		const number = Number(value);
		const shown = Number.isFinite(number) ? number.toLocaleString('en-US') : String(value);
		return (number === 1 ? one : other).replaceAll('#', shown);
	});
}

/**
 * The house words for a key.
 * @param {String} key - e.g. 'line.baseline'
 * @param {Object} [vars] - values for the {placeholders}
 * @returns {String}
 */
export function word(key, vars) {
	const entry = WORDS[key];
	if (!entry) throw new Error(`words: no word "${key}"`);
	return fillWord(entry.text, vars, key);
}

/**
 * @param {String} key
 * @returns {Readonly<{text: String, hint: String, pro: String, feature: String | null,
 *   quote: Boolean, like: String}> | undefined}
 */
export function wordEntry(key) {
	return Object.hasOwn(WORDS, key) ? WORDS[key] : undefined;
}

/**
 * @param {String} key
 * @returns {Boolean}
 */
export function hasWord(key) {
	return Object.hasOwn(WORDS, key);
}

/** @returns {Array<String>} every key, sorted */
export function wordKeys() {
	return Object.keys(WORDS).sort();
}

/**
 * @param {String} key
 * @returns {String} the pro word(s) for a key, '' for none
 */
export function proWord(key) {
	return wordEntry(key)?.pro || '';
}

/**
 * The house word for a pro word.
 * @param {String} term - 'Baseline', 'x-height', 'kerning'
 * @returns {String} the key whose pro words include it (any case), '' for none
 */
export function keyForProWord(term) {
	const wanted = String(term ?? '')
		.trim()
		.toLowerCase();
	if (!wanted) return '';
	const key = wordKeys().find((k) =>
		WORDS[k].pro
			.split(',')
			.map((p) => p.trim().toLowerCase())
			.includes(wanted)
	);
	return key || '';
}

/**
 * @param {String | Object} keyOrEntry - a key, or an entry
 * @param {(flag: String) => Boolean} [isOn] - default: features.js
 * @returns {Boolean} true when the word may be shown: live from B4, or its feature's flag is on
 */
export function isLanded(keyOrEntry, isOn = isFeatureOn) {
	const entry = typeof keyOrEntry === 'string' ? wordEntry(keyOrEntry) : keyOrEntry;
	if (!entry) return false;
	return entry.feature === null || isOn(entry.feature) === true;
}

/**
 * Help's "What these words mean" (4.10): the 2.1 table in order, landed features only.
 * @param {(flag: String) => Boolean} [isOn] - default: features.js
 * @returns {Array<Object>} [{ key, text, hint, pro, feature, quote, like }]
 */
export function glossary(isOn = isFeatureOn) {
	return GLOSSARY.filter((key) => isLanded(key, isOn)).map((key) => ({ key, ...WORDS[key] }));
}

/**
 * @param {String} text
 * @returns {String} the text with its first letter capitalized
 */
export function labelCase(text) {
	const value = String(text ?? '');
	return value ? value[0].toUpperCase() + value.slice(1) : '';
}
