// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: the one key map (UX-BEGINNER.md 7.6, 6.2 "Keys", 4.10), the same in both modes, as data
	plus the lookup events_keyboard.js asks.

	Tool keys: B Brush (N too), V Select (A too), E Edit points, P Point pen (H and W too),
	R Rectangle (M too), O Oval (Q too), U Add a point (More tools only). Upstream letters stay
	wherever they don't collide. What changes from upstream: P no longer picks Edit points and E no
	longer picks Add a point; B picks the Brush once B8 turns 'brush' on. Until then All tools keeps
	upstream's Edit points on B (with no Brush there is nothing for it to collide with) and Simple
	gives B nothing (fix track: Edit points would have two keys, and B would change tool later).
	Simple: Ctrl+Space (hide the whole UI), Ctrl+G (SVG font file), Ctrl+R (round every point:
	tidy points is automatic, 2.4 C, so Chrome keeps its reload key) and the layer order keys are
	off; Ctrl+E makes the .otf (the one font file row Simple's File menu shows, whatever format the
	font came from) and opens Use in Word once 'useInWord' is on. Ctrl+O opens a saved font in both
	modes. A tool key in Simple says "Switched to Rectangle (R)", always with the key the tooltip
	shows (H and W say P), and the key of a tool inside Fine-tune opens Fine-tune (once B7's
	'letterView' is on). On the board (B10): a letter opens its tile (Shift for
	capitals), arrows move, Enter opens. Guide line locks are locks.js. Upstream's dev-mode console
	clear (Ctrl+Q / Alt+Q) is not his key and stays in the handler as it is.

	A rule: { id, combos, action, where, modes, feature, until, tool, arg, ignore }
	  combos   'ctrl+shift+s': ctrl, alt, shift, then the key as getKeyFromEvent names it,
	           lowercased ('space', 'plus', 'arrowleft', 'delete'); '<letter>' is any one
	           character with no Ctrl or Alt
	  where    the places it fires: 'page' (a page with no edit canvas), 'kerning' (the Kerning
	           page's canvas), 'canvas' (a letter's edit canvas), 'board' (B10's letter board)
	  modes    ['all', 'simple'] unless it is one mode's only
	  feature  on only once this flag is on; until: on only while this flag is off
	  ignore   modifiers that don't matter (upstream lowercases a letter, so Shift+R is R)
	The first rule that matches wins; rules with one id are one key's variants.

	  keyAction(press, { mode, isOn, where })  { id, action, tool?, arg?, char?, toast?,
	                                           opensFineTune? } or null
	  matchingRules(press, options)            every rule that matches (tests)
	  toolForKey(key, { mode, isOn })          the tool a plain key picks on a letter canvas, or null
	  keyOn(id, { mode, isOn })                is this key on in the mode, for handler blocks kept
	                                           as they are ('svgFontFile', 'hideUI')
	  keysShown({ mode, isOn })                Help > Keyboard keys: [{ id, action, tool, keys }]
	  toolKey(tool, { mode, isOn })            the key a tool's tooltip and toast show ('P'), or null
	  toolSwitchToast(tool, { mode, isOn })    the Simple toast for a tool key, with toolKey
	  fontFileKeyFormat(preferred, opts)       the font file Ctrl+E makes ('otf'), or null when it
	                                           makes none (Use in Word), for the File menu
	  pressFromEvent(event, held)              { key, ctrl, shift, alt } from a keydown and
	                                           eventHandlerData (isCtrlDown...)
	  comboOf(press), displayCombo(combo), whereFor(page)
*/
import { isFeatureOn } from './features.js';
import { getMode } from './mode.js';
import { simplePlace } from './visibility.js';
import { word } from '../words/words.js';

/** Where a key can fire */
export const PLACES = Object.freeze(['page', 'kerning', 'canvas', 'board']);

const ANYWHERE = ['page', 'kerning', 'canvas', 'board'];
const EDIT_CANVAS = ['kerning', 'canvas'];
const LETTER_CANVAS = ['canvas'];
const BOTH = ['all', 'simple'];
const LOOSE = ['shift', 'alt'];
const ANY_MODIFIER = ['ctrl', 'shift', 'alt'];

/** Upstream's tool keys (events_keyboard.js before B5), for the record and the tests */
export const UPSTREAM_TOOL_KEYS = Object.freeze({
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

/**
 * @param {String} id
 * @param {Array<String>} combos
 * @param {String} action
 * @param {Object} [extra] - where, modes, feature, until, tool, arg, ignore
 * @returns {Object}
 */
const rule = (id, combos, action, extra = {}) => ({
	id,
	combos,
	action,
	where: ANYWHERE,
	modes: BOTH,
	feature: null,
	until: null,
	tool: null,
	arg: null,
	ignore: [],
	...extra,
});

/** A tool key: a letter canvas, no Ctrl, Shift and Alt don't matter */
const toolRule = (tool, keys, extra = {}) =>
	rule(`tool.${tool}`, keys, 'selectTool', { tool, where: LETTER_CANVAS, ignore: LOOSE, ...extra });

const ARROWS = {
	arrowleft: { dx: -1, dy: 0 },
	arrowright: { dx: 1, dy: 0 },
	arrowup: { dx: 0, dy: 1 },
	arrowdown: { dx: 0, dy: -1 },
};
/** On the board the rows run down the screen */
const BOARD_ARROWS = {
	arrowleft: { dx: -1, dy: 0 },
	arrowright: { dx: 1, dy: 0 },
	arrowup: { dx: 0, dy: -1 },
	arrowdown: { dx: 0, dy: 1 },
};

const RULES = [
	// Every page
	rule('save', ['ctrl+s'], 'save', { ignore: ['alt'] }),
	rule('saveAs', ['ctrl+shift+s'], 'saveAs', { ignore: ['alt'] }),
	rule('open', ['ctrl+o'], 'openFont', { ignore: LOOSE }),
	rule('makeFontFile', ['ctrl+e'], 'useInWord', {
		ignore: LOOSE,
		modes: ['simple'],
		feature: 'useInWord',
	}),
	// Simple shows one font file row, the .otf, so its key makes that one (6.2 Menus)
	rule('makeFontFile', ['ctrl+e'], 'exportOtf', { ignore: LOOSE, modes: ['simple'] }),
	rule('makeFontFile', ['ctrl+e'], 'exportFont', { ignore: LOOSE, modes: ['all'] }),
	rule('svgFontFile', ['ctrl+g'], 'exportSvgFont', { ignore: LOOSE, modes: ['all'] }),
	rule('undo', ['ctrl+z', 'undo'], 'undo', { ignore: ['alt'] }),
	rule('redo', ['ctrl+y', 'ctrl+shift+z', 'redo'], 'redo', { ignore: ['alt'] }),
	rule('redo', ['ctrl+shift+y'], 'redo', { ignore: ['alt'] }),

	// Any edit canvas (Kerning too)
	rule('hideUI', ['ctrl+space'], 'hideUI', { where: LETTER_CANVAS, modes: ['all'], ignore: LOOSE }),
	rule('pan', ['space'], 'pan', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('escape', ['escape'], 'closeDialogs', {
		where: [...EDIT_CANVAS, 'board'],
		ignore: ANY_MODIFIER,
	}),
	rule('zoomIn', ['ctrl+plus'], 'zoomIn', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('zoomOut', ['ctrl+minus'], 'zoomOut', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('fitView', ['ctrl+0'], 'fitView', { where: EDIT_CANVAS, ignore: LOOSE }),
	...Object.entries(ARROWS).map(([key, arg]) =>
		rule('nudge', [key], 'nudge', { where: EDIT_CANVAS, ignore: LOOSE, arg })
	),
	rule('previousPoint', ['ctrl+arrowleft'], 'previousPoint', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('nextPoint', ['ctrl+arrowright'], 'nextPoint', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('nextItem', ['ctrl+.'], 'nextItem', { where: EDIT_CANVAS, ignore: LOOSE }),
	rule('previousItem', ['ctrl+,'], 'previousItem', { where: EDIT_CANVAS, ignore: LOOSE }),

	// A letter's canvas (not Kerning): tools
	toolRule('nib', ['b', 'n'], { feature: 'brush' }),
	toolRule('resize', ['v', 'a']),
	toolRule('pathEdit', ['e']),
	// upstream's B, All tools only: in Simple B waits for the Brush
	toolRule('pathEdit', ['b'], { until: 'brush', modes: ['all'] }),
	toolRule('newPath', ['p', 'h', 'w']),
	toolRule('newRectangle', ['r', 'm']),
	toolRule('newOval', ['o', 'q']),
	toolRule('pathAddPoint', ['u'], { modes: ['all'] }),

	// A letter's canvas: shapes and points
	rule('delete', ['delete', 'backspace'], 'delete', { where: LETTER_CANVAS, ignore: ANY_MODIFIER }),
	rule('selectAll', ['ctrl+a'], 'selectAll', { where: LETTER_CANVAS, ignore: ['alt'] }),
	rule('deselectAll', ['ctrl+shift+a'], 'deselectAll', { where: LETTER_CANVAS, ignore: ['alt'] }),
	rule('nextShape', [']', '}'], 'nextShape', { where: LETTER_CANVAS, ignore: LOOSE }),
	rule('previousShape', ['[', '{'], 'previousShape', { where: LETTER_CANVAS, ignore: LOOSE }),
	rule('layerTop', ['ctrl+shift+}'], 'layerTop', {
		where: LETTER_CANVAS,
		modes: ['all'],
		ignore: ['alt'],
	}),
	rule('layerUp', ['ctrl+]', 'ctrl+shift+]', 'ctrl+}'], 'layerUp', {
		where: LETTER_CANVAS,
		modes: ['all'],
		ignore: ['alt'],
	}),
	rule('layerBottom', ['ctrl+shift+{'], 'layerBottom', {
		where: LETTER_CANVAS,
		modes: ['all'],
		ignore: ['alt'],
	}),
	rule('layerDown', ['ctrl+[', 'ctrl+shift+[', 'ctrl+{'], 'layerDown', {
		where: LETTER_CANVAS,
		modes: ['all'],
		ignore: ['alt'],
	}),
	rule('copy', ['ctrl+c'], 'copy', { where: LETTER_CANVAS, ignore: LOOSE }),
	rule('paste', ['ctrl+v'], 'paste', { where: LETTER_CANVAS, ignore: LOOSE }),
	// tidy points is automatic in Simple (2.4 C); Ctrl+R stays Chrome's reload there
	rule('round', ['ctrl+r'], 'round', { where: LETTER_CANVAS, ignore: LOOSE, modes: ['all'] }),

	// The letter board (B10, Simple)
	rule('board.openLetter', ['<letter>'], 'openLetter', {
		where: ['board'],
		modes: ['simple'],
		feature: 'board',
		ignore: ['shift'],
	}),
	...Object.entries(BOARD_ARROWS).map(([key, arg]) =>
		rule('board.move', [key], 'moveOnBoard', {
			where: ['board'],
			modes: ['simple'],
			feature: 'board',
			arg,
		})
	),
	rule('board.openTile', ['enter'], 'openTile', {
		where: ['board'],
		modes: ['simple'],
		feature: 'board',
	}),
];

/**
 * @param {String} combo - 'ctrl+shift+s'
 * @returns {{key: String, ctrl: Boolean, shift: Boolean, alt: Boolean}}
 */
function parseCombo(combo) {
	const parts = combo.split('+');
	const key = parts.pop();
	return {
		key,
		ctrl: parts.includes('ctrl'),
		shift: parts.includes('shift'),
		alt: parts.includes('alt'),
	};
}

/** @type {ReadonlyArray<Readonly<Object>>} */
export const KEY_RULES = Object.freeze(
	RULES.map((r) =>
		Object.freeze({
			...r,
			combos: Object.freeze([...r.combos]),
			where: Object.freeze([...r.where]),
			modes: Object.freeze([...r.modes]),
			ignore: Object.freeze([...r.ignore]),
			arg: r.arg ? Object.freeze({ ...r.arg }) : null,
		})
	)
);

const PARSED = new Map(KEY_RULES.map((r) => [r, r.combos.map(parseCombo)]));
const IDS = new Set(KEY_RULES.map((r) => r.id));

// --------------------------------------------------------------
// Presses
// --------------------------------------------------------------

/**
 * @param {{key: String, ctrl?: Boolean, shift?: Boolean, alt?: Boolean}} press
 * @param {ReadonlyArray<String>} [ignore] - modifiers left out
 * @returns {String} 'ctrl+shift+s'
 */
function canonical(press, ignore = []) {
	const parts = [];
	if (press.ctrl && !ignore.includes('ctrl')) parts.push('ctrl');
	if (press.alt && !ignore.includes('alt')) parts.push('alt');
	if (press.shift && !ignore.includes('shift')) parts.push('shift');
	parts.push(String(press.key ?? '').toLowerCase());
	return parts.join('+');
}

/**
 * @param {{key: String, ctrl?: Boolean, shift?: Boolean, alt?: Boolean}} press
 * @returns {String} the press as a combo: 'ctrl+shift+s'
 */
export function comboOf(press) {
	return canonical(press);
}

/**
 * A keydown as the map reads it, named the way getKeyFromEvent names keys.
 * @param {{key: String, ctrlKey?: Boolean, shiftKey?: Boolean, altKey?: Boolean, metaKey?: Boolean}} event
 * @param {{isCtrlDown?: Boolean, isShiftDown?: Boolean, isAltDown?: Boolean, isSpaceDown?: Boolean}} [held]
 *   - eventHandlerData: keys still held from earlier keydowns
 * @returns {{key: String, ctrl: Boolean, shift: Boolean, alt: Boolean}}
 */
export function pressFromEvent(event, held = {}) {
	let key = String(event?.key ?? '');
	if (key.length === 1) key = key.toLocaleLowerCase();
	if (key === 'Meta') key = 'Control';
	if (key === '-') key = 'Minus';
	if (key === '+') key = 'Plus';
	if (key === ' ') key = 'Space';
	// Ctrl pressed while Space is held is Ctrl+Space, as upstream reads it
	if (key === 'Control' && held.isSpaceDown) key = 'Space';
	return {
		key,
		ctrl: !!(held.isCtrlDown || event?.ctrlKey || event?.metaKey),
		shift: !!(held.isShiftDown || event?.shiftKey),
		alt: !!(held.isAltDown || event?.altKey),
	};
}

/** @returns {Boolean} one character, no Ctrl or Alt */
function isLetterPress(press) {
	const key = String(press.key ?? '');
	return [...key].length === 1 && key.trim() !== '' && !press.ctrl && !press.alt;
}

/**
 * @param {Readonly<Object>} r - a rule
 * @param {Object} press
 * @returns {Boolean}
 */
function ruleMatches(r, press) {
	return PARSED.get(r).some((combo) =>
		combo.key === '<letter>'
			? isLetterPress(press)
			: canonical(combo, r.ignore) === canonical(press, r.ignore)
	);
}

/**
 * @param {Readonly<Object>} r
 * @param {'all' | 'simple'} mode
 * @param {(name: String) => Boolean} isOn
 * @returns {Boolean}
 */
function ruleOn(r, mode, isOn) {
	if (!r.modes.includes(mode)) return false;
	if (r.feature && !isOn(r.feature)) return false;
	if (r.until && isOn(r.until)) return false;
	return true;
}

// --------------------------------------------------------------
// Lookups
// --------------------------------------------------------------

/**
 * @param {Object} press - { key, ctrl, shift, alt }
 * @param {Object} [options]
 * @param {'all' | 'simple'} [options.mode] - default: the current mode
 * @param {(name: String) => Boolean} [options.isOn] - default: the app's flags
 * @param {String} [options.where] - one of PLACES (default 'canvas')
 * @returns {Array<Readonly<Object>>} every rule that matches
 */
export function matchingRules(
	press,
	{ mode = getMode(), isOn = isFeatureOn, where = 'canvas' } = {}
) {
	return KEY_RULES.filter(
		(r) => r.where.includes(where) && ruleOn(r, mode, isOn) && ruleMatches(r, press)
	);
}

/**
 * What a key press does: the first rule that matches.
 * @param {Object} press - { key, ctrl, shift, alt } (pressFromEvent)
 * @param {Object} [options] - { mode, isOn, where }, as matchingRules
 * @returns {Object | null} { id, action, tool?, arg?, char?, toast?, opensFineTune? }
 */
export function keyAction(press, options = {}) {
	const { mode = getMode(), isOn = isFeatureOn } = options;
	const [first] = matchingRules(press, { ...options, mode, isOn });
	if (!first) return null;
	const result = { id: first.id, action: first.action };
	if (first.arg) result.arg = { ...first.arg };
	if (first.action === 'openLetter') {
		result.char = press.shift ? String(press.key).toLocaleUpperCase() : String(press.key);
	}
	if (first.action === 'selectTool') {
		result.tool = first.tool;
		result.opensFineTune =
			mode === 'simple' && isOn('letterView') && simplePlace('tool', first.tool) === 'fineTune';
		if (mode === 'simple') result.toast = toolSwitchToast(first.tool, { mode, isOn });
	}
	return result;
}

/**
 * @param {String} key - a plain key ('r')
 * @param {Object} [options] - { mode, isOn }
 * @returns {String | null} the tool it picks on a letter's canvas
 */
export function toolForKey(key, options = {}) {
	const result = keyAction(
		{ key, ctrl: false, shift: false, alt: false },
		{ ...options, where: 'canvas' }
	);
	return result?.action === 'selectTool' ? result.tool : null;
}

/**
 * @param {String} id - a rule id ('svgFontFile')
 * @param {Object} [options] - { mode, isOn }
 * @returns {Boolean} true when the key works in the mode (anywhere)
 */
export function keyOn(id, { mode = getMode(), isOn = isFeatureOn } = {}) {
	if (!IDS.has(id)) throw new Error(`keys: no key "${id}"`);
	return KEY_RULES.some((r) => r.id === id && ruleOn(r, mode, isOn));
}

/**
 * Help > Keyboard keys (4.10): the keys that work in the mode, one row per key.
 * @param {Object} [options] - { mode, isOn }
 * @returns {Array<{id: String, action: String, tool: String | null, keys: Array<String>}>}
 */
export function keysShown({ mode = getMode(), isOn = isFeatureOn } = {}) {
	const rows = new Map();
	KEY_RULES.filter((r) => ruleOn(r, mode, isOn)).forEach((r) => {
		if (!rows.has(r.id)) rows.set(r.id, { id: r.id, action: r.action, tool: r.tool, keys: [] });
		const row = rows.get(r.id);
		r.combos.map(displayCombo).forEach((shown) => {
			if (!row.keys.includes(shown)) row.keys.push(shown);
		});
	});
	return [...rows.values()];
}

/**
 * The key a tool's tooltip and its "Switched to" toast name: its first key in the mode, so a
 * tool never seems to have two keys (H and W are P's too, but both say P).
 * @param {String} tool - the tool's internal name ('newPath')
 * @param {Object} [options] - { mode, isOn }
 * @returns {String | null} 'P', or null when no key picks the tool in the mode
 */
export function toolKey(tool, options = {}) {
	const row = keysShown(options).find((key) => key.action === 'selectTool' && key.tool === tool);
	return row?.keys?.[0] ?? null;
}

/**
 * The toast a tool key shows in Simple (7.6): "Switched to Rectangle (R)", with the key the
 * tooltip shows whichever of the tool's keys was pressed.
 * @param {String} tool - the tool's internal name ('newRectangle')
 * @param {Object} [options] - { mode, isOn } (default: the current mode and flags)
 * @returns {{key: String, vars: {tool: String, key: String}, options: {group: String}}}
 */
export function toolSwitchToast(tool, options = {}) {
	return {
		key: 'mode.toolSwitched',
		vars: { tool: word(`tool.${tool}`), key: toolKey(tool, options) ?? '' },
		options: { group: 'toolSwitch' },
	};
}

/** The font file each Ctrl+E action makes ('exportFont': the font's own preferred format) */
const KEY_FORMATS = { exportOtf: 'otf' };

/**
 * The font file Ctrl+E makes, so the File menu names and marks the same one (its heading and its
 * Ctrl+E note): Simple's is always the .otf; All tools' is the font's preferred format (the one
 * it was imported from).
 * @param {String} preferred - getPreferredExportFormat() ('otf', 'woff', ...)
 * @param {Object} [options] - { mode, isOn }
 * @returns {String | null} null when Ctrl+E makes no file itself (Simple's Use in Word)
 */
export function fontFileKeyFormat(preferred, { mode = getMode(), isOn = isFeatureOn } = {}) {
	const result = keyAction(
		{ key: 'e', ctrl: true, shift: false, alt: false },
		{ mode, isOn, where: 'page' }
	);
	if (result?.action === 'exportFont') return preferred;
	return KEY_FORMATS[result?.action] ?? null;
}

const KEY_NAMES = {
	space: 'Space',
	plus: 'Plus',
	minus: 'Minus',
	arrowleft: 'Left arrow',
	arrowright: 'Right arrow',
	arrowup: 'Up arrow',
	arrowdown: 'Down arrow',
	delete: 'Delete',
	backspace: 'Backspace',
	escape: 'Esc',
	enter: 'Enter',
	undo: 'Undo',
	redo: 'Redo',
	'<letter>': 'Any letter',
};

/**
 * @param {String} combo - 'ctrl+shift+s'
 * @returns {String} 'Ctrl+Shift+S'
 */
export function displayCombo(combo) {
	const { key, ctrl, shift, alt } = parseCombo(combo);
	const name = KEY_NAMES[key] || key.toLocaleUpperCase();
	return [ctrl && 'Ctrl', alt && 'Alt', shift && 'Shift', name].filter(Boolean).join('+');
}

/**
 * @param {String} page - editor.nav.page
 * @returns {'page' | 'kerning' | 'canvas'} where its keys fire (the board passes 'board' itself)
 */
export function whereFor(page) {
	if (page === 'Kerning') return 'kerning';
	if (['Characters', 'Ligatures', 'Components'].includes(page)) return 'canvas';
	return 'page';
}
