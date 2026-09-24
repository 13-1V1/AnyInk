// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { resetPrefsCache, setPref } from '../../prefs/prefs.js';
import {
	PREF_KEYS,
	STRIP_HEIGHT_VAR,
	currentGlyphInfo,
	escapeHTML,
	readStripPrefs,
	setStripHeight,
} from '../preview_strip.js';
import { DEFAULT_SAMPLE_TEXT } from '../sample_presets.js';
import { DEFAULT_PT } from '../units.js';

describe('readStripPrefs', () => {
	beforeEach(() => {
		localStorage.clear();
		resetPrefsCache();
	});

	it('starts from the documented defaults', () => {
		expect(readStripPrefs()).toEqual({
			text: DEFAULT_SAMPLE_TEXT,
			pt: DEFAULT_PT,
			realFont: false,
			metrics: false,
		});
	});

	it('reads back remembered values and clamps the size', () => {
		setPref(PREF_KEYS.text, 'HHAV');
		setPref(PREF_KEYS.pt, 999);
		setPref(PREF_KEYS.realFont, true);
		setPref(PREF_KEYS.metrics, 1);
		expect(readStripPrefs()).toEqual({ text: 'HHAV', pt: 200, realFont: true, metrics: true });
	});

	it('uses the agreed pref keys', () => {
		expect(PREF_KEYS).toEqual({
			text: 'previewText',
			pt: 'previewPt',
			realFont: 'previewRealFont',
			metrics: 'previewMetrics',
		});
	});
});

describe('setStripHeight', () => {
	it('writes the custom property the layout reads', () => {
		setStripHeight(150);
		expect(document.documentElement.style.getPropertyValue(STRIP_HEIGHT_VAR)).toBe('150px');
		setStripHeight(0);
		expect(document.documentElement.style.getPropertyValue(STRIP_HEIGHT_VAR)).toBe('0px');
	});
});

describe('currentGlyphInfo', () => {
	const project = (items) => ({ getItem: (id) => items[id] || false });

	it('reads the glyph char and its stored context without creating anything', () => {
		const editor = {
			selectedGlyphID: 'glyph-0x61',
			project: project({ 'glyph-0x61': { char: 'a', contextCharacters: 'nano' } }),
		};
		expect(currentGlyphInfo(editor)).toEqual({ char: 'a', stored: 'nano' });
	});

	it('derives the char from the id when the glyph does not exist yet', () => {
		const editor = { selectedGlyphID: 'glyph-0x42', project: project({}) };
		expect(currentGlyphInfo(editor)).toEqual({ char: 'B', stored: '' });
	});

	it('gives nothing for missing editors or non-glyph ids', () => {
		expect(currentGlyphInfo(null)).toEqual({ char: '', stored: '' });
		expect(currentGlyphInfo({ selectedGlyphID: false })).toEqual({ char: '', stored: '' });
		expect(currentGlyphInfo({ selectedGlyphID: 'liga-fi', project: project({}) })).toEqual({
			char: '',
			stored: '',
		});
	});
});

describe('escapeHTML', () => {
	it('neutralizes markup in preset names', () => {
		expect(escapeHTML('Context for <')).toBe('Context for &lt;');
		expect(escapeHTML('a & "b"')).toBe('a &amp; &quot;b&quot;');
		expect(escapeHTML(undefined)).toBe('');
	});
});
