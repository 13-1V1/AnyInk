// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 integration: the seams between the modules the five tracks built, each checked across
	two or more of them (UX-BEGINNER.md 2.2, 2.3, 4.0, 6.2, 7.6):
	  words -> features      every word's feature is a flag features.js knows
	  code -> words          every words key the code asks for by name exists (word() throws on a
	                         missing key, so a typo would break a screen only when it shows)
	  toasts -> words        every upstream rule's key exists, and Simple's words for every
	                         example say no banned word
	  history -> words       Undo titles written today by B1's Fix it, the guide lines (B4's
	                         labels) and B3's refit come out in plain words through historyText
	  mode -> keys -> words  every key Simple answers picks a tool Simple shows, which has a
	                         tool.* word, a tooltip and a "Switched to" toast with no banned word
*/
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { setFontMetric } from '../../metrics/font_metrics.js';
import { METRIC_LABELS } from '../../metrics/metrics_math.js';
import { FEATURE_NAMES, isKnownFeature } from '../../mode/features.js';
import { keysShown, toolSwitchToast } from '../../mode/keys.js';
import { setModeForTests } from '../../mode/mode.js';
import { toolTitle } from '../../mode/simple_labels.js';
import { isShown } from '../../mode/visibility.js';
import { edgeProjectJSON, openProject, square } from '../../fontcheck/tests/fixtures.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import { fixProblem } from '../../preview/fix_it.js';
import { mapUpstreamToast, TOAST_RULES } from '../../toast/upstream_map.js';
import { findBanned, scanTexts } from '../banned.js';
import { historyText, isHiddenHistoryTitle } from '../history_text.js';
import { hasWord, wordEntry, wordKeys, word } from '../words.js';
import { expectNoBanned } from './banned_scan.js';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '../../..');

/** Every .js file under src, tests left out. */
function sourceFiles(dir = src, found = []) {
	readdirSync(dir).forEach((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			if (name !== 'tests' && name !== 'node_modules') sourceFiles(path, found);
		} else if (name.endsWith('.js')) found.push(path);
	});
	return found;
}

describe('words -> features', () => {
	it("every word's feature is a flag features.js knows", () => {
		const unknown = wordKeys()
			.map((key) => [key, wordEntry(key).feature])
			.filter(([, feature]) => feature && !isKnownFeature(feature));
		expect(unknown).toEqual([]);
	});

	it('every flag a word waits for is one some B turns on', () => {
		const used = new Set(wordKeys().map((key) => wordEntry(key).feature).filter(Boolean));
		used.forEach((feature) => expect(FEATURE_NAMES).toContain(feature));
	});
});

describe('code -> words', () => {
	it('every key the code asks for by name exists', () => {
		const prefixes = new Set(wordKeys().map((key) => key.split('.')[0]));
		const call = /\b(?:word|toast|wordEntry|wordParts|hasWord|labelCase\(word)\(\s*'([a-z][\w]*\.[\w.]+)'/g;
		const field = /\b(?:key|textKey|buttonKey):\s*'([a-z][\w]*\.[\w.]+)'/g;
		const missing = [];
		let asked = 0;
		sourceFiles().forEach((path) => {
			const text = readFileSync(path, 'utf8');
			[call, field].forEach((pattern) => {
				for (const [, key] of text.matchAll(pattern)) {
					if (!prefixes.has(key.split('.')[0])) continue;
					asked++;
					if (!hasWord(key)) missing.push(`${relative(src, path)}: ${key}`);
				}
			});
		});
		expect(missing).toEqual([]);
		expect(asked).toBeGreaterThan(100);
	});
});

describe('toasts -> words', () => {
	it("every upstream rule's key is a word", () => {
		const missing = TOAST_RULES.filter((rule) => rule.key && !hasWord(rule.key)).map(
			(rule) => rule.key
		);
		expect(missing).toEqual([]);
	});

	it("Simple's words for every example say no banned word", () => {
		const shown = TOAST_RULES.map((rule) => mapUpstreamToast(rule.example, { mode: 'simple' }))
			.filter((decision) => decision.show && decision.text !== undefined)
			.map((decision) => decision.text);
		expect(shown.length).toBeGreaterThan(30);
		// file and folder names are quotes (exempt); the rest is house words
		const quoted = TOAST_RULES.map((rule) => mapUpstreamToast(rule.example, { mode: 'simple' }))
			.filter((decision) => decision.show && decision.text !== undefined)
			.map(({ key, vars, quotes = [] }) =>
				word(key, { ...vars, ...Object.fromEntries(quotes.map((name) => [name, '"…"'])) })
			);
		expectNoBanned(scanTexts(quoted, 'toast'));
	});
});

describe('history -> words', () => {
	it("B1's Fix it, a guide line moved (B4's labels) and B3's refit read in plain words", () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
		const editor = openProject(json);
		setCurrentProjectEditor(editor);
		setModeForTests('simple'); // Simple refits automatic letters inside each step (B3)
		const before = editor.history.queue.length;
		expect(fixProblem(editor, { itemId: 'glyph-0x61', problem: PROBLEM.inkNoWidth })).toBe(true);
		setFontMetric('xHeight', 620, { verb: 'Moved' });
		const titles = editor.history.queue
			.slice(0, editor.history.queue.length - before)
			.map((entry) => entry.title)
			.filter((title) => !isHiddenHistoryTitle(title));
		expect(titles).toEqual(
			expect.arrayContaining([`Moved ${METRIC_LABELS.xHeight} to 620`, 'gave small a a width'])
		);
		const shown = titles.map((title) => historyText(title, { chars: 'a' }));
		shown.forEach((text) => expect(text).not.toBe(historyText('a title nobody wrote')));
		expectNoBanned(scanTexts(shown, 'undo title'));
		setModeForTests('all');
	});
});

describe('mode -> keys -> words', () => {
	it.each(['all', 'simple'])('%s: every tool key picks a tool the mode shows, named in words', (mode) => {
		setModeForTests(mode);
		const rows = keysShown().filter((row) => row.tool);
		expect(rows.length).toBeGreaterThanOrEqual(5);
		rows.forEach(({ tool, keys }) => {
			expect(isShown('tool', tool), tool).toBe(true);
			expect(hasWord(`tool.${tool}`), tool).toBe(true);
			if (mode === 'simple') {
				const { key, vars } = toolSwitchToast(tool, keys[0]);
				expect(findBanned(word(key, vars))).toEqual([]);
				expect(findBanned(toolTitle(tool, 'upstream path'))).toEqual([]);
				expect(toolTitle(tool, 'upstream path')).toBe(`${word(`tool.${tool}`)} (${keys[0]})`);
			}
		});
		setModeForTests('all');
	});
});
