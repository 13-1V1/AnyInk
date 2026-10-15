// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 7.6, 6.2 "Keys", 4.10): the one key map, the same in both modes, as data plus
// the lookup events_keyboard.js asks. Tool keys: B Brush (N too), V Select (A too), E Edit points,
// P Point pen (H and W too), R Rectangle (M too), O Oval (Q too), U Add a point (More tools only).
// What changes from upstream: B and P no longer pick Edit points, E no longer picks Add a point.
// Simple turns off Ctrl+Space (hides the whole UI), Ctrl+G (SVG font file), Ctrl+R and B until the
// Brush (fix track); Ctrl+E makes the .otf, then opens Use in Word once that flag is on; Ctrl+O
// opens a saved font in both modes. In Simple a tool key says "Switched to Rectangle (R)" with the
// tooltip's key, and a key of a tool inside Fine-tune opens Fine-tune (once B7's letter card
// exists). keys_fixes.test.js holds the fix track's own regression tests.
import { afterEach, describe, expect, it } from 'vitest';
import {
	flagsOn,
	isKnownFeature,
	resetFeaturesForTests,
	setFeaturesForTests,
} from '../features.js';
import { setModeForTests } from '../mode.js';
import {
	KEY_RULES,
	PLACES,
	UPSTREAM_TOOL_KEYS,
	comboOf,
	displayCombo,
	keyAction,
	keyOn,
	keysShown,
	matchingRules,
	pressFromEvent,
	toolForKey,
	toolSwitchToast,
	whereFor,
} from '../keys.js';
import { word } from '../../words/words.js';
import { shownIds } from '../visibility.js';

afterEach(() => {
	setModeForTests('all');
	resetFeaturesForTests();
});

const NO_FLAGS = flagsOn();
const MODES = ['all', 'simple'];
const press = (key, mods = {}) => ({ key, ctrl: false, shift: false, alt: false, ...mods });
const act = (key, mods, options) =>
	keyAction(press(key, mods), { where: 'canvas', isOn: NO_FLAGS, ...options });
const actionOf = (key, mods, options) => act(key, mods, options)?.action ?? null;

describe('one tool-key map in both modes (7.6)', () => {
	MODES.forEach((mode) => {
		it(`${mode}: V/A Select, E Edit points, P/H/W Point pen, R/M Rectangle, O/Q Oval`, () => {
			const tools = Object.fromEntries(
				[...'vaephwrmoq'].map((key) => [key, toolForKey(key, { mode, isOn: NO_FLAGS })])
			);
			expect(tools).toEqual({
				v: 'resize',
				a: 'resize',
				e: 'pathEdit',
				p: 'newPath',
				h: 'newPath',
				w: 'newPath',
				r: 'newRectangle',
				m: 'newRectangle',
				o: 'newOval',
				q: 'newOval',
			});
		});
	});

	it('U picks Add a point in All tools only (More tools only)', () => {
		expect(toolForKey('u', { mode: 'all', isOn: NO_FLAGS })).toBe('pathAddPoint');
		expect(toolForKey('u', { mode: 'simple', isOn: NO_FLAGS })).toBe(null);
	});

	it('B and N pick the Brush once it lands (B8), in both modes', () => {
		const isOn = flagsOn('brush');
		MODES.forEach((mode) => {
			expect(toolForKey('b', { mode, isOn }), mode).toBe('nib');
			expect(toolForKey('n', { mode, isOn }), mode).toBe('nib');
		});
	});

	it("until then All tools' B keeps upstream's Edit points, Simple's B waits; N does nothing", () => {
		expect(toolForKey('b', { mode: 'all', isOn: NO_FLAGS })).toBe('pathEdit');
		expect(toolForKey('b', { mode: 'simple', isOn: NO_FLAGS })).toBe(null);
		MODES.forEach((mode) => {
			expect(toolForKey('n', { mode, isOn: NO_FLAGS }), mode).toBe(null);
		});
	});

	it('what changes from upstream: P and E now; B once the Brush lands; every other letter stays', () => {
		const changed = (isOn) =>
			Object.keys(UPSTREAM_TOOL_KEYS)
				.filter((key) => toolForKey(key, { mode: 'all', isOn }) !== UPSTREAM_TOOL_KEYS[key])
				.sort();
		expect(UPSTREAM_TOOL_KEYS).toEqual({
			v: 'resize',
			a: 'resize',
			b: 'pathEdit',
			p: 'pathEdit',
			m: 'newRectangle',
			r: 'newRectangle',
			o: 'newOval',
			q: 'newOval',
			h: 'newPath',
			w: 'newPath',
			u: 'pathAddPoint',
			e: 'pathAddPoint',
		});
		expect(changed(NO_FLAGS)).toEqual(['e', 'p']);
		expect(changed(flagsOn('brush'))).toEqual(['b', 'e', 'p']);
	});

	it("fire only on a letter's canvas and never with Ctrl; Shift or Alt doesn't matter (upstream lowercases)", () => {
		expect(act('r')).toMatchObject({ action: 'selectTool', tool: 'newRectangle' });
		expect(act('r', { shift: true })).toMatchObject({ tool: 'newRectangle' });
		expect(act('r', { alt: true })).toMatchObject({ tool: 'newRectangle' });
		expect(act('r', { ctrl: true })).toMatchObject({ action: 'round' });
		expect(act('r', {}, { where: 'kerning' })).toBe(null);
		expect(act('r', {}, { where: 'page' })).toBe(null);
	});
});

describe('the rest of the map, in both modes', () => {
	const both = (key, mods, expected, where = 'canvas') =>
		MODES.forEach((mode) =>
			expect(actionOf(key, mods, { mode, where }), `${mode} ${key}`).toBe(expected)
		);

	it('Ctrl+S / Ctrl+Shift+S / Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z work on every page', () => {
		PLACES.filter((where) => where !== 'board').forEach((where) => {
			both('s', { ctrl: true }, 'save', where);
			both('s', { ctrl: true, shift: true }, 'saveAs', where);
			both('z', { ctrl: true }, 'undo', where);
			both('y', { ctrl: true }, 'redo', where);
			both('z', { ctrl: true, shift: true }, 'redo', where);
		});
	});

	it('Ctrl+O opens a saved font in both modes (DESIGN_DOC 6), not a new window', () => {
		both('o', { ctrl: true }, 'openFont');
		both('o', { ctrl: true }, 'openFont', 'page');
	});

	it('Ctrl+C / Ctrl+V, Delete and Backspace, Space, Esc, zoom, arrows, the next letter', () => {
		both('c', { ctrl: true }, 'copy');
		both('v', { ctrl: true }, 'paste');
		both('Delete', {}, 'delete');
		both('Backspace', {}, 'delete');
		both('Space', {}, 'pan');
		both('Escape', {}, 'closeDialogs');
		both('Plus', { ctrl: true }, 'zoomIn');
		both('Minus', { ctrl: true }, 'zoomOut');
		both('0', { ctrl: true }, 'fitView');
		both('ArrowLeft', {}, 'nudge');
		both('ArrowUp', { shift: true }, 'nudge');
		both('ArrowLeft', { ctrl: true }, 'previousPoint');
		both('ArrowRight', { ctrl: true }, 'nextPoint');
		both('.', { ctrl: true }, 'nextItem');
		both(',', { ctrl: true }, 'previousItem');
		both('a', { ctrl: true }, 'selectAll');
		both('a', { ctrl: true, shift: true }, 'deselectAll');
		both(']', {}, 'nextShape');
		both('[', {}, 'previousShape');
	});

	it('the arrows say which way, as upstream nudges (Shift x10 is the handler’s)', () => {
		expect(act('ArrowLeft').arg).toEqual({ dx: -1, dy: 0 });
		expect(act('ArrowRight').arg).toEqual({ dx: 1, dy: 0 });
		expect(act('ArrowUp').arg).toEqual({ dx: 0, dy: 1 });
		expect(act('ArrowDown').arg).toEqual({ dx: 0, dy: -1 });
	});

	it('canvas keys stay on the canvas: Delete on the Overview page does nothing', () => {
		expect(actionOf('Delete', {}, { where: 'page' })).toBe(null);
		expect(actionOf('Escape', {}, { where: 'kerning' })).toBe('closeDialogs');
		expect(actionOf('Delete', {}, { where: 'kerning' })).toBe(null);
	});
});

describe('Simple key gates (6.2 "Keys", 7.6)', () => {
	it('Ctrl+Space (hide the whole UI) is off in Simple', () => {
		expect(actionOf('Space', { ctrl: true }, { mode: 'all' })).toBe('hideUI');
		expect(actionOf('Space', { ctrl: true }, { mode: 'simple' })).toBe(null);
	});

	it('Ctrl+G (SVG font file) is off in Simple, on every page', () => {
		expect(actionOf('g', { ctrl: true }, { mode: 'all', where: 'page' })).toBe('exportSvgFont');
		expect(actionOf('g', { ctrl: true }, { mode: 'simple', where: 'page' })).toBe(null);
		expect(actionOf('g', { ctrl: true }, { mode: 'simple' })).toBe(null);
	});

	it('Ctrl+E makes the font file (Simple: the .otf) until Use in Word lands; then Simple opens Use in Word', () => {
		expect(actionOf('e', { ctrl: true }, { mode: 'all' })).toBe('exportFont');
		expect(actionOf('e', { ctrl: true }, { mode: 'simple' })).toBe('exportOtf');
		const isOn = flagsOn('useInWord');
		expect(actionOf('e', { ctrl: true }, { mode: 'simple', isOn })).toBe('useInWord');
		expect(actionOf('e', { ctrl: true }, { mode: 'all', isOn })).toBe('exportFont');
	});

	it('layer order keys are off in Simple, like the layer order arrows', () => {
		[
			[']', { ctrl: true }, 'layerUp'],
			['}', { ctrl: true, shift: true }, 'layerTop'],
			['[', { ctrl: true }, 'layerDown'],
			['{', { ctrl: true, shift: true }, 'layerBottom'],
		].forEach(([key, mods, action]) => {
			expect(actionOf(key, mods, { mode: 'all' }), key).toBe(action);
			expect(actionOf(key, mods, { mode: 'simple' }), key).toBe(null);
		});
	});

	it('keyOn answers for a whole key, for the handler blocks that stay as they are', () => {
		expect(keyOn('svgFontFile', { mode: 'all', isOn: NO_FLAGS })).toBe(true);
		expect(keyOn('svgFontFile', { mode: 'simple', isOn: NO_FLAGS })).toBe(false);
		expect(keyOn('hideUI', { mode: 'simple', isOn: NO_FLAGS })).toBe(false);
		expect(keyOn('save', { mode: 'simple', isOn: NO_FLAGS })).toBe(true);
		expect(() => keyOn('nope')).toThrow(/nope/);
	});

	it('read the real mode and flags by default', () => {
		expect(keyAction(press('g', { ctrl: true }), { where: 'page' }).action).toBe('exportSvgFont');
		setModeForTests('simple');
		expect(keyAction(press('g', { ctrl: true }), { where: 'page' })).toBe(null);
		expect(keyAction(press('e', { ctrl: true }), { where: 'page' }).action).toBe('exportOtf');
		setFeaturesForTests({ useInWord: true });
		expect(keyAction(press('e', { ctrl: true }), { where: 'page' }).action).toBe('useInWord');
	});
});

describe('Simple: a tool key says what it picked', () => {
	it('"Switched to Rectangle (R)", in Simple only', () => {
		const simple = act('r', {}, { mode: 'simple' });
		expect(simple.toast).toEqual({
			key: 'mode.toolSwitched',
			vars: { tool: 'Rectangle', key: 'R' },
			options: { group: 'toolSwitch' },
		});
		expect(word(simple.toast.key, simple.toast.vars)).toBe('Switched to Rectangle (R)');
		expect(act('r', {}, { mode: 'all' }).toast).toBeUndefined();
	});

	it("names the tooltip's key whichever key was pressed, and every tool in house words", () => {
		expect(act('m', {}, { mode: 'simple' }).toast.vars).toEqual({ tool: 'Rectangle', key: 'R' });
		const simple = { mode: 'simple', isOn: NO_FLAGS };
		expect(toolSwitchToast('newPath', simple).vars).toEqual({ tool: 'Point pen', key: 'P' });
		expect(toolSwitchToast('pathEdit', simple).vars.tool).toBe('Edit points');
		expect(toolSwitchToast('resize', simple).vars.tool).toBe('Select');
		expect(toolSwitchToast('newOval', simple).vars.tool).toBe('Oval');
		expect(toolSwitchToast('nib', { mode: 'simple', isOn: flagsOn('brush') }).vars).toEqual({
			tool: 'Brush',
			key: 'B',
		});
		expect(toolSwitchToast('pathAddPoint', { mode: 'all', isOn: NO_FLAGS }).vars).toEqual({
			tool: 'Add a point',
			key: 'U',
		});
	});

	it('a Fine-tune tool opens Fine-tune once the letter card exists (B7), in Simple only', () => {
		const isOn = flagsOn('letterView');
		['e', 'p', 'r', 'o'].forEach((key) => {
			expect(act(key, {}, { mode: 'simple', isOn }).opensFineTune, key).toBe(true);
			expect(act(key, {}, { mode: 'simple' }).opensFineTune, key).toBe(false);
			expect(act(key, {}, { mode: 'all', isOn }).opensFineTune, key).toBe(false);
		});
		expect(act('v', {}, { mode: 'simple', isOn }).opensFineTune).toBe(false);
		expect(
			act('b', {}, { mode: 'simple', isOn: flagsOn('letterView', 'brush') }).opensFineTune
		).toBe(false);
	});
});

describe('the board (B10)', () => {
	it('typing a letter opens its tile (Shift for capitals); arrows move; Enter opens', () => {
		const isOn = flagsOn('board');
		const board = (key, mods) => act(key, mods, { mode: 'simple', isOn, where: 'board' });
		expect(board('g')).toMatchObject({ action: 'openLetter', char: 'g' });
		expect(board('g', { shift: true })).toMatchObject({ action: 'openLetter', char: 'G' });
		expect(board('7')).toMatchObject({ action: 'openLetter', char: '7' });
		expect(board('ArrowRight')).toMatchObject({ action: 'moveOnBoard', arg: { dx: 1, dy: 0 } });
		expect(board('ArrowUp')).toMatchObject({ action: 'moveOnBoard', arg: { dx: 0, dy: -1 } });
		expect(board('Enter')).toMatchObject({ action: 'openTile' });
		expect(board('s', { ctrl: true })).toMatchObject({ action: 'save' });
		expect(board('g', { ctrl: true })).toBe(null);
	});

	it('not before the board lands, and not in All tools', () => {
		expect(act('g', {}, { mode: 'simple', where: 'board' })).toBe(null);
		expect(act('g', {}, { mode: 'all', isOn: flagsOn('board'), where: 'board' })).toBe(null);
	});
});

describe('keysShown (Help > Keyboard keys, 4.10)', () => {
	it('lists the keys that work in the mode, once each, with their keys to press', () => {
		const simple = keysShown({ mode: 'simple', isOn: NO_FLAGS });
		const ids = simple.map((k) => k.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).not.toContain('svgFontFile');
		expect(ids).not.toContain('hideUI');
		expect(ids).not.toContain('tool.pathAddPoint');
		expect(ids).toContain('tool.newRectangle');
		expect(simple.find((k) => k.id === 'save').keys).toEqual(['Ctrl+S']);
		expect(simple.find((k) => k.id === 'tool.newPath').keys).toEqual(['P', 'H', 'W']);
		const all = keysShown({ mode: 'all', isOn: NO_FLAGS }).map((k) => k.id);
		expect(all).toContain('svgFontFile');
		expect(all).toContain('tool.pathAddPoint');
	});

	it('the Brush shows only once it lands', () => {
		expect(keysShown({ mode: 'simple', isOn: NO_FLAGS }).map((k) => k.id)).not.toContain(
			'tool.nib'
		);
		const withBrush = keysShown({ mode: 'simple', isOn: flagsOn('brush') });
		expect(withBrush.find((k) => k.id === 'tool.nib').keys).toEqual(['B', 'N']);
	});
});

describe('presses', () => {
	it('pressFromEvent reads a keydown the way getKeyFromEvent does', () => {
		const ev = (key, extra = {}) => ({
			key,
			ctrlKey: false,
			shiftKey: false,
			altKey: false,
			metaKey: false,
			...extra,
		});
		expect(pressFromEvent(ev('S', { ctrlKey: true, shiftKey: true }))).toEqual({
			key: 's',
			ctrl: true,
			shift: true,
			alt: false,
		});
		expect(pressFromEvent(ev(' '))).toMatchObject({ key: 'Space' });
		expect(pressFromEvent(ev('+'))).toMatchObject({ key: 'Plus' });
		expect(pressFromEvent(ev('-'))).toMatchObject({ key: 'Minus' });
		expect(pressFromEvent(ev('z', { metaKey: true }))).toMatchObject({ key: 'z', ctrl: true });
		expect(pressFromEvent(ev('Meta'))).toMatchObject({ key: 'Control' });
	});

	it('pressFromEvent honors keys held from earlier keydowns (eventHandlerData)', () => {
		const held = { isCtrlDown: true, isShiftDown: false, isAltDown: false, isSpaceDown: false };
		expect(pressFromEvent({ key: 'g' }, held)).toMatchObject({ key: 'g', ctrl: true });
		// Ctrl pressed while Space is held is Ctrl+Space, as upstream reads it
		expect(
			pressFromEvent({ key: 'Control' }, { isCtrlDown: true, isSpaceDown: true })
		).toMatchObject({
			key: 'Space',
			ctrl: true,
		});
	});

	it('comboOf and displayCombo', () => {
		expect(comboOf(press('s', { ctrl: true, shift: true }))).toBe('ctrl+shift+s');
		expect(comboOf(press('ArrowLeft', { alt: true }))).toBe('alt+arrowleft');
		expect(displayCombo('ctrl+shift+s')).toBe('Ctrl+Shift+S');
		expect(displayCombo('ctrl+space')).toBe('Ctrl+Space');
		expect(displayCombo('arrowleft')).toBe('Left arrow');
		expect(displayCombo('delete')).toBe('Delete');
		expect(displayCombo('ctrl+.')).toBe('Ctrl+.');
	});

	it('whereFor names the place from the page', () => {
		expect(whereFor('Characters')).toBe('canvas');
		expect(whereFor('Ligatures')).toBe('canvas');
		expect(whereFor('Components')).toBe('canvas');
		expect(whereFor('Kerning')).toBe('kerning');
		expect(whereFor('Overview')).toBe('page');
		expect(whereFor('Settings')).toBe('page');
	});
});

describe('keys and the tool buttons agree (visibility.js)', () => {
	it('a key never picks a tool the mode hides, and every shown tool has a key', () => {
		const flagSets = [NO_FLAGS, flagsOn('brush'), flagsOn('brush', 'letterView')];
		flagSets.forEach((isOn) =>
			MODES.forEach((mode) => {
				const picked = new Set(
					[...'abcdefghijklmnopqrstuvwxyz']
						.map((key) => toolForKey(key, { mode, isOn }))
						.filter(Boolean)
				);
				const shown = shownIds('tool', { mode, isOn }).filter((tool) => tool !== 'kern');
				expect([...picked].sort(), mode).toEqual([...shown].sort());
			})
		);
	});
});

describe('the rules', () => {
	it('are well formed: an id, combos, places, known flags, and an action', () => {
		KEY_RULES.forEach((rule) => {
			expect(rule.id, JSON.stringify(rule)).toMatch(/\w/);
			expect(Object.isFrozen(rule), rule.id).toBe(true);
			expect(rule.combos.length, rule.id).toBeGreaterThan(0);
			rule.where.forEach((where) => expect(PLACES, rule.id).toContain(where));
			rule.modes.forEach((mode) => expect(MODES, rule.id).toContain(mode));
			[rule.feature, rule.until]
				.filter(Boolean)
				.forEach((flag) => expect(isKnownFeature(flag), rule.id).toBe(true));
			expect(rule.action, rule.id).toMatch(/\w/);
			if (rule.action === 'selectTool') expect(rule.tool, rule.id).toMatch(/\w/);
		});
	});

	it('never give one press two meanings: the rules that match it share one id (first match wins)', () => {
		const flagSets = [NO_FLAGS, flagsOn('brush', 'useInWord', 'board', 'letterView')];
		const keys = [
			...'abcdefghijklmnopqrstuvwxyz0123456789.,[]{}',
			'Space',
			'Delete',
			'Backspace',
			'Escape',
			'Enter',
			'Plus',
			'Minus',
			'ArrowLeft',
			'ArrowRight',
			'ArrowUp',
			'ArrowDown',
		];
		const modsList = [
			{},
			{ ctrl: true },
			{ shift: true },
			{ ctrl: true, shift: true },
			{ alt: true },
		];
		let checked = 0;
		flagSets.forEach((isOn) =>
			MODES.forEach((mode) =>
				PLACES.forEach((where) =>
					keys.forEach((key) =>
						modsList.forEach((mods) => {
							const p = press(key, mods);
							const ids = new Set(matchingRules(p, { mode, isOn, where }).map((rule) => rule.id));
							expect(ids.size, `${mode} ${where} ${comboOf(p)}`).toBeLessThanOrEqual(1);
							checked++;
						})
					)
				)
			)
		);
		expect(checked).toBeGreaterThan(1000);
	});
});
