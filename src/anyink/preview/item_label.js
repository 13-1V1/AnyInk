// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: a project item named in plain words for a preview notice, as it sits inside a sentence:
	"small a", "Capital A", "the question mark", "the joined letters ff" (letterPhrase, the house
	names from src/anyink/words/letter_name.js), and a gap setting by the letters on each of its
	sides that the font file holds, in the font check's own words (validate_kerning.js
	kernSubject): "the gap between Capital A or Capital B and Capital C". Never a code or a
	Unicode name.
*/
import { kernSubject } from '../fontcheck/validate_kerning.js';
import { letterPhrase } from '../words/letter_name.js';

const GLYPH_ID = /^glyph-0x([0-9a-f]+)$/i;
const HEX = /^0x([0-9a-f]+)$/i;

/**
 * @param {String} hex - '0x41'
 * @returns {String} 'Capital A', or '' when it isn't a letter code
 */
function phraseForHex(hex) {
	const match = HEX.exec(String(hex ?? ''));
	if (!match) return '';
	const code = parseInt(match[1], 16);
	if (!Number.isFinite(code) || code > 0x10ffff) return '';
	return letterPhrase(String.fromCodePoint(code));
}

/**
 * @param {Object} project - needs getItem(id) for joined letters; a whole project for gaps
 * @param {String|null} itemId - 'glyph-0x61', 'liga-...', 'kern-0'
 * @returns {{name: String, plural: Boolean}|null} null when it can't be named in plain words
 */
export function itemLabel(project, itemId) {
	if (typeof itemId !== 'string') return null;
	const glyph = GLYPH_ID.exec(itemId);
	if (glyph) {
		const name = phraseForHex(`0x${glyph[1]}`);
		return name ? { name, plural: false } : null;
	}
	if (itemId.startsWith('kern-')) {
		let name = '';
		try {
			name = kernSubject(project, itemId);
		} catch {
			// not a whole project (no settings to list its letters): nothing to name
		}
		return name ? { name, plural: false } : null;
	}
	if (itemId.startsWith('liga-')) {
		const chars = project?.getItem ? project.getItem(itemId)?.chars : '';
		const name = chars ? letterPhrase(chars) : '';
		return name ? { name, plural: [...chars].length > 1 } : null;
	}
	return null;
}
