// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track (UX-BEGINNER.md 6.2 "Keys", 7.6, 2.4 C, 4.10), the key map as data:
//   - Ctrl+R (round every point) is off in Simple: tidy points is automatic (2.4 C) and Ctrl+R is
//     not one of Simple's keys (6.2), so Chrome's own reload key reaches Chrome; All tools keeps it
//   - B picks nothing in Simple until the Brush lands (a key that later changes tool would teach
//     him the wrong thing); All tools keeps upstream's Edit points
//   - a tool key's "Switched to ..." toast names the key the tooltip shows (P for H and W, R for
//     M), so one tool never seems to have two keys
//   - Ctrl+E in Simple makes the .otf, the one font file row Simple's File menu shows, whatever
//     format the font was imported from; All tools keeps the imported format
import { afterEach, describe, expect, it } from 'vitest';
import { flagsOn, resetFeaturesForTests } from '../features.js';
import { fontFileKeyFormat, keyAction, keysShown, toolKey, toolSwitchToast } from '../keys.js';
import { setModeForTests } from '../mode.js';
import { toolTitle } from '../simple_labels.js';
import { word } from '../../words/words.js';

afterEach(() => {
	setModeForTests('all');
	resetFeaturesForTests();
});

const NO_FLAGS = flagsOn();
const press = (key, mods = {}) => ({ key, ctrl: false, shift: false, alt: false, ...mods });
const act = (key, mods, options) =>
	keyAction(press(key, mods), { where: 'canvas', isOn: NO_FLAGS, ...options });

describe('Ctrl+R (round every point)', () => {
	it('Simple: off, so the press is not taken from the browser', () => {
		expect(act('r', { ctrl: true }, { mode: 'simple' })).toBe(null);
		expect(keysShown({ mode: 'simple', isOn: NO_FLAGS }).map((k) => k.id)).not.toContain('round');
	});

	it('All tools: rounds, as today', () => {
		expect(act('r', { ctrl: true }, { mode: 'all' })).toMatchObject({ action: 'round' });
	});
});

describe('B before the Brush lands', () => {
	it('Simple: B picks nothing (it becomes the Brush in B8)', () => {
		expect(act('b', {}, { mode: 'simple' })).toBe(null);
		expect(act('b', {}, { mode: 'simple', isOn: flagsOn('brush') })).toMatchObject({
			tool: 'nib',
		});
	});

	it("All tools: B keeps upstream's Edit points", () => {
		expect(act('b', {}, { mode: 'all' })).toMatchObject({ tool: 'pathEdit' });
	});

	it("Simple: Edit points' tooltip and Help list only E", () => {
		const row = keysShown({ mode: 'simple', isOn: NO_FLAGS }).find(
			(k) => k.id === 'tool.pathEdit'
		);
		expect(row.keys).toEqual(['E']);
	});
});

describe("a tool key's toast names the tooltip's key", () => {
	it.each([
		['h', 'newPath', 'P'],
		['w', 'newPath', 'P'],
		['m', 'newRectangle', 'R'],
		['q', 'newOval', 'O'],
		['a', 'resize', 'V'],
		['p', 'newPath', 'P'],
	])('%s: "Switched to ... (%s)" says the key the tooltip shows', (key, tool, shown) => {
		const result = act(key, {}, { mode: 'simple' });
		expect(result.tool).toBe(tool);
		expect(result.toast.vars).toEqual({ tool: word(`tool.${tool}`), key: shown });
	});

	it('the toast and the tooltip agree for every tool Simple shows', () => {
		setModeForTests('simple');
		['resize', 'pathEdit', 'newPath', 'newRectangle', 'newOval'].forEach((tool) => {
			const toast = toolSwitchToast(tool);
			expect(toolTitle(tool, 'upstream'), tool).toBe(`${toast.vars.tool} (${toast.vars.key})`);
		});
	});

	it('toolKey: the first key the mode gives a tool, or null', () => {
		expect(toolKey('newPath', { mode: 'simple', isOn: NO_FLAGS })).toBe('P');
		expect(toolKey('pathEdit', { mode: 'all', isOn: NO_FLAGS })).toBe('E');
		expect(toolKey('nib', { mode: 'simple', isOn: NO_FLAGS })).toBe(null);
		expect(toolKey('nib', { mode: 'simple', isOn: flagsOn('brush') })).toBe('B');
		expect(toolKey('pathAddPoint', { mode: 'simple', isOn: NO_FLAGS })).toBe(null);
	});
});

describe('Ctrl+E and the font file format', () => {
	it('Simple, before Use in Word: makes the .otf (the only font file row Simple shows)', () => {
		expect(act('e', { ctrl: true }, { mode: 'simple' })).toMatchObject({
			id: 'makeFontFile',
			action: 'exportOtf',
		});
		expect(act('e', { ctrl: true }, { mode: 'simple', where: 'page' })).toMatchObject({
			action: 'exportOtf',
		});
	});

	it('fontFileKeyFormat: the format Ctrl+E makes, for the File menu', () => {
		expect(fontFileKeyFormat('woff', { mode: 'simple', isOn: NO_FLAGS })).toBe('otf');
		expect(fontFileKeyFormat('woff', { mode: 'all', isOn: NO_FLAGS })).toBe('woff');
		expect(fontFileKeyFormat('otf', { mode: 'all', isOn: NO_FLAGS })).toBe('otf');
		// Use in Word makes no file straight from the key
		expect(fontFileKeyFormat('woff', { mode: 'simple', isOn: flagsOn('useInWord') })).toBe(null);
	});

	it('All tools: the imported format, as today', () => {
		expect(act('e', { ctrl: true }, { mode: 'all' })).toMatchObject({ action: 'exportFont' });
	});
});
