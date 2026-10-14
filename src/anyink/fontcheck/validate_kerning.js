// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The font check's kerning rule (B1 fix). After the letters, every kern pair the font file
	will hold is judged the way export_kerning.js writes it: the value must be a whole number
	from -32,768 to 32,767 after rounding. A bigger value is written pulled into range (and
	one that isn't a number is left out), so the pair wouldn't do what the Kerning page
	shows, and the check names it in house words: kerning is a gap fix, so a pair is "the gap
	between Capital A and Capital V" (UX-BEGINNER 2.4 B; the preview's item_label.js says
	the same).
	A pair counts only when the font file holds it, as upstream's writeGposKernDataToFont
	decides: kerning is exported, the value isn't 0, and both sides keep at least one letter
	that is in the font file.

	  validateKerning(project, letters)       -> [{ itemId: 'kern-0', problem, message }]
	  kernSubject(project, kernId, [letters]) -> 'the gap between Capital A and Capital V',
	                                             or '' when the id isn't a kern pair
	letters: the exporter's letter ids ('0x41', from export_list.js getExportList); they
	default to the File menu export's list.
*/
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { kernFits } from './export_kerning.js';
import { getExportList } from './export_list.js';

export const KERN_PROBLEM = 'kern-range';
const MAX_NAMED = 3;

/**
 * @param {Object} project
 * @param {Array<String>} [letters] - letter ids in the font file ('0x41')
 * @returns {Array<{itemId: String, problem: String, message: String}>}
 */
export function validateKerning(project, letters = fileLetters(project)) {
	if (!project?.settings?.app?.exportKerning) return [];
	const inFont = codeSet(letters);
	const problems = [];
	Object.entries(project.kerning || {}).forEach(([id, group]) => {
		const value = group?.value;
		// upstream writes no pair for these (0, and NaN, which a KernGroup never holds)
		if (typeof value !== 'number' || !value) return;
		const pair = pairInFont(group, inFont);
		if (!pair || kernFits(value)) return;
		problems.push({
			itemId: id,
			problem: KERN_PROBLEM,
			message: `${sentenceStart(gapPhrase(pair))} is moved further than the font file can hold.`,
		});
	});
	return problems;
}

/**
 * A kern pair's name inside a sentence, from the letters the font file holds.
 * @param {Object} project
 * @param {String} kernId - 'kern-0'
 * @param {Array<String>} [letters] - letter ids in the font file
 * @returns {String} 'the gap between Capital A and Capital V', or ''
 */
export function kernSubject(project, kernId, letters) {
	if (typeof kernId !== 'string' || !kernId.startsWith('kern-')) return '';
	const group = project?.kerning?.[kernId];
	if (!group) return '';
	const pair = pairInFont(group, codeSet(letters ?? fileLetters(project)));
	return pair ? gapPhrase(pair) : '';
}

/**
 * @param {Object} project
 * @returns {Array<String>} the File menu export's letter ids
 */
function fileLetters(project) {
	return getExportList(project).glyphs.map(({ xc }) => xc);
}

/**
 * @param {Array<String | Number>} letters
 * @returns {Set<Number>} code points
 */
function codeSet(letters) {
	return new Set((letters || []).map(Number).filter(Number.isInteger));
}

/**
 * Both sides of a kern group, keeping only letters the font file holds.
 * @param {Object} group - KernGroup
 * @param {Set<Number>} inFont
 * @returns {{left: Array<Number>, right: Array<Number>} | null} null when a side is empty
 */
function pairInFont(group, inFont) {
	if (!Array.isArray(group?.leftGroup) || !Array.isArray(group?.rightGroup)) return null;
	const keep = (hexes) => [...new Set(hexes.map(Number))].filter((code) => inFont.has(code));
	const left = keep(group.leftGroup);
	const right = keep(group.rightGroup);
	return left.length && right.length ? { left, right } : null;
}

/**
 * @param {{left: Array<Number>, right: Array<Number>}} pair
 * @returns {String} 'the gap between Capital A or Capital B and Capital V'
 */
function gapPhrase({ left, right }) {
	return `the gap between ${nameList(left)} and ${nameList(right)}`;
}

/**
 * @param {Array<Number>} codes
 * @returns {String} 'Capital A', 'Capital A or small b', 'A, B, C or 2 more'
 */
function nameList(codes) {
	const names = codes.map((code) => letterPhrase(code) || 'a letter');
	if (names.length > MAX_NAMED) {
		return `${names.slice(0, MAX_NAMED).join(', ')} or ${names.length - MAX_NAMED} more`;
	}
	return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`;
}
