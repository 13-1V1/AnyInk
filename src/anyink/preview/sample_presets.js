// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sample-text presets for the preview strip: pangrams, spacing control strings,
	glyph sets, and a context string built around the glyph being edited.
	Pure data and functions; the strip turns the rows into a menu.
*/

export const DEFAULT_SAMPLE_TEXT = 'the five boxing wizards jump quickly';

export const PANGRAMS = [
	'the five boxing wizards jump quickly',
	'pack my box with five dozen liquor jugs',
	'the quick brown fox jumps over a lazy dog',
	'amazingly few discotheques provide jukeboxes',
	'sphinx of black quartz, judge my vow',
];

/** Classic straight / round / diagonal spacing strings. */
export const CONTROL_STRINGS = [
	{ name: 'HHAV', note: 'capitals', text: 'HHAVHHOOAVOO' },
	{ name: 'nnav', note: 'small letters', text: 'nnavnnooavoo' },
];

export const GLYPH_SETS = [
	{ name: 'a-z', text: 'abcdefghijklmnopqrstuvwxyz' },
	{ name: 'A-Z', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
	{ name: '0-9', text: '0123456789' },
];

/**
 * Text that shows one character between straight and round neighbors.
 * A stored per-glyph context string (upstream's contextCharacters) wins when set.
 * @param {String} char - the glyph's character(s); '' when unknown
 * @param {String} [storedContext] - Glyph.contextCharacters
 * @returns {String} '' when there is nothing to build from
 */
export function makeGlyphContextText(char, storedContext = '') {
	const c = String(char || '');
	if (!c) return '';
	const stored = String(storedContext || '');
	if (stored && stored !== c) return stored;
	return `HH${c}HHOO${c}OO nn${c}nnoo${c}oo`;
}

/**
 * Menu rows, grouped. Groups become separators in the menu.
 * @param {Object} [options]
 * @param {String} [options.currentChar] - character of the glyph being edited
 * @param {String} [options.storedContext] - that glyph's stored context string
 * @returns {Array<{group: String, name: String, note: String, text: String}>}
 */
export function makePresetRows({ currentChar = '', storedContext = '' } = {}) {
	const rows = [];
	const context = makeGlyphContextText(currentChar, storedContext);
	if (context) {
		rows.push({
			group: 'context',
			name: `Context for ${currentChar}`,
			note: 'this letter',
			text: context,
		});
	}
	PANGRAMS.forEach((text) => rows.push({ group: 'pangrams', name: text, note: '', text }));
	CONTROL_STRINGS.forEach((row) =>
		rows.push({ group: 'control', name: row.name, note: row.note, text: row.text })
	);
	GLYPH_SETS.forEach((row) =>
		rows.push({ group: 'sets', name: row.name, note: `${row.text.length} letters`, text: row.text })
	);
	return rows;
}
