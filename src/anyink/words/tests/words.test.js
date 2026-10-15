// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: the one vocabulary file (UX-BEGINNER.md 2.1, 2.2). words.js only gathers the key sets in
// words/sets/*.js, so each track owns its own set file; a key defined twice, a misspelled field
// or a broken {placeholder} stops the load. Code asks for words by key and never inline.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '../sets/core.js';
import screens from '../sets/screens.js';
import toasts from '../sets/toasts.js';
import {
	buildWords,
	fillWord,
	glossary,
	hasWord,
	isLanded,
	keyForProWord,
	labelCase,
	proWord,
	word,
	wordEntry,
	wordKeys,
} from '../words.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../..');

/** The feature flags of UX-BEGINNER section 10, and the later milestones' (M11 to M13). */
const FEATURE_NAMES = [
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

describe('word', () => {
	it('gives the house word for a key', () => {
		expect(word('line.baseline')).toBe('writing line');
		expect(word('line.xHeight')).toBe('small-letter line');
		expect(word('term.letter')).toBe('letter');
	});

	it('fills {placeholders}', () => {
		expect(word('history.traced', { letter: 'Capital B' })).toBe('traced Capital B');
	});

	it('picks one or many with {count|one|other}, # standing for the number', () => {
		expect(word('history.shapesMoved', { count: 1 })).toBe('moved a shape');
		expect(word('history.shapesMoved', { count: 3 })).toBe('moved 3 shapes');
		expect(fillWord('{n|# point|# points}', { n: 1204 })).toBe('1,204 points');
		expect(fillWord('{n|# point|# points}', { n: '1' })).toBe('1 point');
	});

	it('throws for a key that does not exist, so a typo shows up in the tests', () => {
		expect(() => word('line.basline')).toThrow(/no word "line.basline"/);
	});

	it('throws when a placeholder has no value', () => {
		expect(() => word('history.traced')).toThrow(/\{letter\}/);
		expect(() => fillWord('{count|a|b}', {})).toThrow(/\{count\}/);
	});
});

describe('entries', () => {
	it('every key is dotted camelCase', () => {
		wordKeys().forEach((key) => expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/));
	});

	it('every entry has text and the five fields (plus like for the glossary)', () => {
		wordKeys().forEach((key) => {
			const entry = wordEntry(key);
			expect(Object.keys(entry).sort(), key).toEqual(
				['feature', 'hint', 'like', 'pro', 'quote', 'text'].sort()
			);
			expect(entry.text.trim(), key).not.toBe('');
			expect(typeof entry.hint).toBe('string');
			expect(typeof entry.pro).toBe('string');
			expect(typeof entry.like).toBe('string');
			expect(typeof entry.quote).toBe('boolean');
			expect(Object.isFrozen(entry)).toBe(true);
		});
	});

	it('every feature is a known flag, or null for words live from B4', () => {
		wordKeys().forEach((key) => {
			const { feature } = wordEntry(key);
			if (feature !== null) expect(FEATURE_NAMES, key).toContain(feature);
		});
	});

	it('wordEntry and hasWord answer for missing keys without throwing', () => {
		expect(hasWord('line.baseline')).toBe(true);
		expect(hasWord('line.nope')).toBe(false);
		expect(wordEntry('line.nope')).toBeUndefined();
	});

	it('the toasts and screens sets start empty, for their tracks to fill', () => {
		expect(toasts).toBeTypeOf('object');
		expect(screens).toBeTypeOf('object');
		const header = (file) => readFileSync(join(here, '../sets', file), 'utf8').slice(0, 1200);
		expect(header('toasts.js')).toMatch(/Owner: /);
		expect(header('screens.js')).toMatch(/Owner: /);
	});
});

describe('buildWords', () => {
	const set = (entries) => ({ default: entries });

	it('gathers every set into one table', () => {
		const words = buildWords({
			'./sets/a.js': set({ 'a.one': { text: 'one' } }),
			'./sets/b.js': set({ 'b.two': { text: 'two', hint: 'a hint', pro: 'zwei', feature: 'board' } }),
		});
		expect(words['a.one']).toEqual({ text: 'one', hint: '', pro: '', feature: null, quote: false, like: '' });
		expect(words['b.two'].feature).toBe('board');
	});

	it('refuses a key two sets both define', () => {
		expect(() =>
			buildWords({
				'./sets/a.js': set({ 'x.same': { text: 'one' } }),
				'./sets/b.js': set({ 'x.same': { text: 'two' } }),
			})
		).toThrow(/"x.same" is in both .\/sets\/a.js and .\/sets\/b.js/);
	});

	it('refuses a misspelled field, empty text, a bad key or a broken placeholder', () => {
		const one = (entry, key = 'a.one') => () => buildWords({ './sets/a.js': set({ [key]: entry }) });
		expect(one({ text: 'x', hnit: 'typo' })).toThrow(/hnit/);
		expect(one({ text: '' })).toThrow(/text/);
		expect(one({ text: 'x', quote: 'yes' })).toThrow(/quote/);
		expect(one({ text: 'x', feature: '' })).toThrow(/feature/);
		expect(one({ text: 'x' }, 'Bad Key')).toThrow(/Bad Key/);
		expect(one({ text: 'x' }, 'nodot')).toThrow(/nodot/);
		expect(one({ text: 'moved {count' })).toThrow(/placeholder/);
		expect(one({ text: 'moved {count|a}' })).toThrow(/placeholder/);
	});

	it('takes a set file with nothing in it', () => {
		expect(buildWords({ './sets/empty.js': { default: {} } })).toEqual({});
	});
});

describe('pro words', () => {
	it('proWord gives the small-print word, or nothing', () => {
		expect(proWord('line.baseline')).toBe('baseline');
		expect(proWord('history.unknown')).toBe('');
	});

	it('keyForProWord finds the house word for any pro word, in any case', () => {
		expect(keyForProWord('Baseline')).toBe('line.baseline');
		expect(keyForProWord('x-height')).toBe('line.xHeight');
		expect(keyForProWord('descender')).toBe('line.descent');
		expect(keyForProWord('kerning')).toBe('term.gapFix');
		expect(keyForProWord('glyph')).toBe('term.letter');
		expect(keyForProWord('not a word')).toBe('');
	});
});

describe('glossary (2.1)', () => {
	it('lists the 2.1 table in its order', () => {
		// prettier-ignore
		expect(GLOSSARY.map((key) => word(key))).toEqual([
			'letter', 'letter set', 'shape', 'hole', 'point', 'curve handle', 'smooth', 'corner',
			'guide lines', 'writing line', 'small-letter line', 'capitals line', 'top line',
			'tail line', 'letter box', 'units', 'left space', 'right space', 'letter width',
			'letter spacing', 'gap fix', 'photo', 'ink cutoff', 'brush', 'versions', 'boldness',
			'ink texture', 'work file', 'Save', 'font file', 'backup copy', 'More tools',
		]);
	});

	it('every glossary word says what it means and has its pro word', () => {
		GLOSSARY.forEach((key) => {
			expect(wordEntry(key).hint, key).not.toBe('');
			expect(wordEntry(key).pro, key).not.toBe('');
		});
	});

	it('shows only the words whose feature has landed (principle 8)', () => {
		// prettier-ignore
		expect(glossary(() => false).map((e) => e.text)).toEqual([
			'letter', 'shape', 'guide lines', 'writing line', 'small-letter line', 'capitals line',
			'top line', 'tail line', 'letter box', 'units', 'work file', 'Save', 'More tools',
		]);
		expect(glossary(() => true)).toHaveLength(GLOSSARY.length);
		expect(glossary((flag) => flag === 'photo').map((e) => e.key)).toContain('term.inkCutoff');
		expect(glossary()[0]).toMatchObject({ key: 'term.letter', text: 'letter', pro: 'glyph, character' });
	});

	it('isLanded reads the feature flag', () => {
		expect(isLanded('line.baseline', () => false)).toBe(true);
		expect(isLanded('term.photo', () => false)).toBe(false);
		expect(isLanded('term.photo', (flag) => flag === 'photo')).toBe(true);
		expect(isLanded('line.nope', () => true)).toBe(false);
	});
});

describe('labelCase', () => {
	it('starts a label with a capital and leaves the rest alone', () => {
		expect(labelCase('writing line')).toBe('Writing line');
		expect(labelCase('More tools')).toBe('More tools');
		expect(labelCase('')).toBe('');
	});
});

describe('call sites', () => {
	/** Every .js file under src, tests folders and the vendored libraries left out. */
	function sourceFiles(dir) {
		return readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) {
				return ['tests', 'lib', 'node_modules'].includes(name) ? [] : sourceFiles(path);
			}
			return name.endsWith('.js') ? [path] : [];
		});
	}

	it("every word('key') in the app names a key that exists", () => {
		const missing = [];
		sourceFiles(SRC).forEach((file) => {
			const text = readFileSync(file, 'utf8');
			for (const m of text.matchAll(/\bword\(\s*(['"`])([^'"`$]+)\1/g)) {
				if (!hasWord(m[2])) missing.push(`${relative(SRC, file)}: ${m[2]}`);
			}
		});
		expect(missing).toEqual([]);
	});
});
