// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Help > Keyboard keys (UX-BEGINNER.md 4.10 section 4, 7.6): the rows Help lists, in 4.10's
	order, each with the key keys.js gives it in Simple (its first key: the one its tooltip and
	"Switched to" toast name) and what it does in house words. A row shows only while keys.js has
	its key on in Simple, so a key whose flag is off (the Brush before 'brush', the letters'
	typing before 'board') is never listed (principle 8). Pure: no DOM.

	  HELP_KEYS                      [{ id, label, keys? }] in order: id is keys.js's rule id,
	                                 label a words key, keys a words key for a key name keys.js
	                                 has none for ('A to Z')
	  helpKeyRows({ isOn })          [{ id, keys: 'Ctrl+Z', label: 'Undo your last change' }]
	S4 (the 'sketch' flag on): the sketch tools are listed after the Brush in the tool column's
	order (Line L, Arc A, Spline S, Circle C, Rectangle R), named by their own words
	(tools/tool_names.js toolWordKey); with the flag off keys.js shows none of them.
*/
import { isFeatureOn } from '../mode/features.js';
import { keysShown } from '../mode/keys.js';
import { toolWordKey } from '../sketch/tools/tool_names.js';
import { word } from '../words/words.js';

/** The tools, in 4.10's order: B Brush, (S4: the sketch tools), V Select, E Edit points, P
 * Point pen, R, O */
const TOOLS = [
	'nib',
	'sketchLine',
	'sketchArc',
	'sketchSpline',
	'sketchCircle',
	'sketchRectangle',
	'resize',
	'pathEdit',
	'newPath',
	'newRectangle',
	'newOval',
];

/** @type {ReadonlyArray<Readonly<{id: String, label?: String, keys?: String}>>} */
export const HELP_KEYS = Object.freeze(
	[
		{ id: 'undo', label: 'helpPage.keys.undo' },
		{ id: 'redo', label: 'helpPage.keys.redo' },
		{ id: 'save', label: 'helpPage.keys.save' },
		{ id: 'open', label: 'helpPage.keys.open' },
		{ id: 'makeFontFile', label: 'helpPage.keys.makeFontFile' },
		{ id: 'copy', label: 'helpPage.keys.copy' },
		{ id: 'paste', label: 'helpPage.keys.paste' },
		...TOOLS.map((tool) => ({ id: `tool.${tool}`, tool })),
		{ id: 'board.openLetter', label: 'helpPage.keys.openLetter', keys: 'helpPage.keys.anyLetter' },
		{ id: 'delete', label: 'helpPage.keys.delete' },
		{ id: 'pan', label: 'helpPage.keys.pan' },
		{ id: 'escape', label: 'helpPage.keys.escape' },
	].map((row) => Object.freeze(row))
);

/**
 * @param {{isOn?: (name: String) => Boolean}} [options]
 * @returns {Array<{id: String, keys: String, label: String}>}
 */
export function helpKeyRows({ isOn = isFeatureOn } = {}) {
	const shown = new Map(keysShown({ mode: 'simple', isOn }).map((row) => [row.id, row]));
	return HELP_KEYS.filter((row) => shown.get(row.id)?.keys?.length).map((row) => ({
		id: row.id,
		keys: row.keys ? word(row.keys) : shown.get(row.id).keys[0],
		label: row.tool
			? word('helpPage.keys.tool', { tool: word(toolWordKey(row.tool)) })
			: word(row.label),
	}));
}
