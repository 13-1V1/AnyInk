// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 fix: two ANY-INK windows share one localStorage key. Each write re-reads it first, so a
	window that loaded earlier never writes back its stale copy over a pref another window set
	(the install offer's "Not now", the offline notice shown once).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPref, resetPrefsCache, setPref, deletePref } from '../prefs.js';

const KEY = 'anyink-prefs';
const stored = () => JSON.parse(localStorage.getItem(KEY) || '{}');
/** Another window writes its prefs (it read them, changed one, and wrote them all back). */
const otherWindowSets = (name, value) =>
	localStorage.setItem(KEY, JSON.stringify({ ...stored(), [name]: value }));

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
});
afterEach(() => {
	localStorage.clear();
	resetPrefsCache();
});

describe('two windows', () => {
	it("a write here keeps a pref the other window set after this one loaded", () => {
		setPref('previewText', 'hello'); // this window has loaded its copy
		otherWindowSets('pwaInstallNotNow', true); // window A: Not now
		setPref('previewText', 'hello there'); // window B types in the strip
		expect(stored()).toEqual({ previewText: 'hello there', pwaInstallNotNow: true });
	});

	it('a delete here keeps the other window\'s prefs too', () => {
		setPref('previewText', 'hello');
		otherWindowSets('pwaOfflineReadyShown', true);
		deletePref('previewText');
		expect(stored()).toEqual({ pwaOfflineReadyShown: true });
	});

	it("this window reads what the other window wrote", () => {
		expect(getPref('pwaInstallNotNow', false)).toBe(false);
		otherWindowSets('pwaInstallNotNow', true);
		window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
		expect(getPref('pwaInstallNotNow', false)).toBe(true);
	});

	it('with storage blocked, prefs still work in memory', () => {
		const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new Error('blocked');
			},
		});
		try {
			resetPrefsCache();
			setPref('previewText', 'in memory');
			expect(getPref('previewText')).toBe('in memory');
		} finally {
			Object.defineProperty(globalThis, 'localStorage', original);
		}
	});
});
