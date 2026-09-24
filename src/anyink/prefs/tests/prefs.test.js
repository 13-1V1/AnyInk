// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { deletePref, getAllPrefs, getPref, resetPrefsCache, setPref } from '../prefs.js';

describe('prefs', () => {
	beforeEach(() => {
		localStorage.clear();
		resetPrefsCache();
	});

	it('returns the fallback for an unset pref', () => {
		expect(getPref('nothing', 'fallback')).toBe('fallback');
		expect(getPref('nothing')).toBeUndefined();
	});

	it('round-trips through localStorage', () => {
		setPref('canvasTheme', 'dark');
		setPref('previewPt', 48);
		resetPrefsCache();
		expect(getPref('canvasTheme')).toBe('dark');
		expect(getPref('previewPt')).toBe(48);
		expect(JSON.parse(localStorage.getItem('anyink-prefs'))).toEqual({ canvasTheme: 'dark', previewPt: 48 });
	});

	it('deletes and lists', () => {
		setPref('a', 1);
		setPref('b', 2);
		deletePref('a');
		expect(getAllPrefs()).toEqual({ b: 2 });
	});

	it('survives corrupt storage', () => {
		localStorage.setItem('anyink-prefs', '{not json');
		expect(getPref('anything', 'ok')).toBe('ok');
		setPref('x', true);
		expect(getPref('x')).toBe(true);
	});
});
