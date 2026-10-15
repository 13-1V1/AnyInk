// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: which letters the coach knows, and the order it suggests empty ones in (UX-BEGINNER.md
	4.0 "Next empty letter (rule 15)", 4.2 "Letter set"). Pure.

	The board's set is the Quick font: A to Z, a to z and . , ' ? ! - (58 letters); "+ Numbers &
	symbols" (settings.anyink.letterSet 'quick+numbers') adds 0 to 9 and : ; " ( ) & @ # $ % / *.
	The space is made at export and is never a letter to make.

	Rule 15's order: the letters of the Try-it text (each gets one turn: once the coach has
	suggested it and he did something else, it drops back into the normal order); then a to z;
	then A to Z; then punctuation; then numbers & symbols when added.

	  QUICK_LETTERS, NUMBER_LETTERS   the sets, in board order (capitals, small letters,
	                                  punctuation; then numbers & symbols)
	  lettersInSet(letterSet)         the set's letters for 'quick' or 'quick+numbers'
	  tryItLetters(text, set)         the distinct letters of the Try-it text that are in the set,
	                                  in the order they are typed
	  suggestionOrder({ tryItText, set, turnsUsed })
	                                  [{ char, fromTryIt }] in rule 15's order, each letter once
	  buttonLetter(char)              how a button names it: 'c', 'B', '7'; 'the period'
*/
import { LETTER_SETS, lettersInSet, NUMBERS_SET, QUICK_SET } from '../board/letter_set.js';
import { letterPhrase } from '../words/letter_name.js';

/** Rule 15's groups, read from the board's set */
const CAPITALS = QUICK_SET.filter((char) => char >= 'A' && char <= 'Z');
const SMALL = QUICK_SET.filter((char) => char >= 'a' && char <= 'z');
const PUNCTUATION = QUICK_SET.filter((char) => !CAPITALS.includes(char) && !SMALL.includes(char));

/** 4.2: the Quick font, in board order (board/letter_set.js, one copy for the app) */
export const QUICK_LETTERS = QUICK_SET;

/** 4.2: "+ Numbers & symbols" */
export const NUMBER_LETTERS = NUMBERS_SET;

export { LETTER_SETS, lettersInSet };

/**
 * @param {String} text - the Try-it text
 * @param {Array<String>} set - the board's letters
 * @returns {Array<String>} its distinct letters that are in the set, as typed
 */
export function tryItLetters(text, set) {
	const inSet = new Set(set);
	const seen = new Set();
	const result = [];
	[...String(text ?? '')].forEach((char) => {
		if (!inSet.has(char) || seen.has(char)) return;
		seen.add(char);
		result.push(char);
	});
	return result;
}

/**
 * Rule 15's order (4.0): Try-it letters first, then a to z, A to Z, punctuation, numbers.
 * @param {Object} options
 * @param {String} [options.tryItText]
 * @param {Array<String>} options.set - the board's letters
 * @param {Iterable<String>} [options.turnsUsed] - Try-it letters whose one turn is used
 * @returns {Array<{char: String, fromTryIt: Boolean}>}
 */
export function suggestionOrder({ tryItText = '', set, turnsUsed = [] }) {
	const used = new Set(turnsUsed);
	const inSet = new Set(set);
	const placed = new Set();
	const order = [];
	const add = (char, fromTryIt) => {
		if (!inSet.has(char) || placed.has(char)) return;
		placed.add(char);
		order.push({ char, fromTryIt });
	};
	tryItLetters(tryItText, set)
		.filter((char) => !used.has(char))
		.forEach((char) => add(char, true));
	[...SMALL, ...CAPITALS, ...PUNCTUATION, ...NUMBER_LETTERS].forEach((char) => add(char, false));
	// anything else the set holds, in its own order
	set.forEach((char) => add(char, false));
	return order;
}

/**
 * The letter as a button names it (2.2: "Go to r"): letters and numbers as they are, anything
 * else by its name, so a button never reads "Go to ,".
 * @param {String} char
 * @returns {String}
 */
export function buttonLetter(char) {
	return /^[\p{L}\p{Nd}]$/u.test(char) ? char : letterPhrase(char);
}
