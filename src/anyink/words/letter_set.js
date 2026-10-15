// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	A letter set's name in house words (UX-BEGINNER.md 2.1 "letter set", 2.4 E: a character range
	or Unicode block becomes a letter set, and its block name and codes are never shown in Simple).
	B4 + B5 fix pass, for the range switch on the Overview and the letter chooser
	(panels/item_chooser.js) until B10's board names its own sections.

	  letterSetName(range)   'Letters, numbers and punctuation' for Basic Latin, 'Accented
	                         letters', 'More accented letters', 'Punctuation'; any other range
	                         is named by its first three letters: 'Letters like Α Β Γ'
	A range is { begin, end } (project.settings.project.characterRanges); it is known by where
	it starts, so a range that leaves out its control codes (0x21 to 0x7E) is still Basic Latin.
*/
import { word } from './words.js';

/** Known ranges by the block they start in: [first code, last code, words key]. */
const KNOWN = [
	[0x0000, 0x007f, 'set.basic'],
	[0x0080, 0x00ff, 'set.accented'],
	[0x0100, 0x024f, 'set.moreAccented'],
	[0x2000, 0x206f, 'set.punctuation'],
];

/** How many of its letters name a range with no house name. */
const SAMPLE_SIZE = 3;

/**
 * @param {{begin?: Number | String, end?: Number | String}} range
 * @returns {String}
 */
export function letterSetName(range) {
	const begin = Number(range?.begin);
	const end = Number(range?.end);
	if (!Number.isFinite(begin)) return word('set.letters');
	const known = KNOWN.find(([first, last]) => begin >= first && begin <= last);
	if (known) return word(known[2]);
	const sample = sampleOf(begin, Number.isFinite(end) ? end : begin);
	return sample ? word('set.like', { sample }) : word('set.letters');
}

/**
 * The first few letters of a range that show as something (no control codes, no blanks).
 * @param {Number} begin
 * @param {Number} end
 * @returns {String} 'Α Β Γ', or '' for none
 */
function sampleOf(begin, end) {
	const found = [];
	for (let code = begin; code <= end && found.length < SAMPLE_SIZE; code++) {
		let char = '';
		try {
			char = String.fromCodePoint(code);
		} catch {
			continue;
		}
		if (/^[\p{L}\p{N}\p{P}\p{S}]$/u.test(char)) found.push(char);
	}
	return found.join(' ');
}
