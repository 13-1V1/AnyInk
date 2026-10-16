// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: soft notes (UX-BEGINNER.md 4.2 "Soft notes", 4.3 the card's quiet line, section 10 B11).
	A soft note never takes Ready away and never turns a tile amber: it is a quiet line on the
	letter card ("Note: thicker than your other letters."). Pure.

	  Thicker / thinner: a letter's stroke estimate (2 x area / perimeter of its biggest piece,
	  spacing/measure.js) more than NOTE_SHARE (35 %) off the median of the ready letters' stroke
	  estimates, once MIN_READY (5) or more letters are ready. Punctuation is left out of both:
	  it is never part of the median and never gets a note (a period's stroke is its whole dot).
	  Pokes (checks.js POKES_IS_NOTE, on: the font file's clipping lines are its real highest and
	  lowest ink, so nothing is cut off): ink more than 5 % past the top or tail line, as a note
	  instead of a check, naming the line it reaches past (B10 + B11 fix pass: "the top line or
	  the tail line" left him to guess which; the words follow B9's step C note): "Note: reaches
	  far above the top line, so lines of text will sit further apart.", "... far below the
	  tail line ...", or both. Punctuation gets this one too.

	  softNotes(letters)       letters: [{ id, char, stroke, ready, pokes?, fixedStroke? }]
	                           (pokes: checks.js measureLetter's pokes, 'top' | 'tail' | 'both' |
	                           null; fixedStroke: S3 finalize, a letter sketched with Outline
	                           loops has no Thickness to set, so no thicker / thinner note; its
	                           stroke still counts in the median)
	                           -> Map id -> [{ id, text }] (letters with no note left out)
	  strokeMedian(letters)    the median over ready letters (punctuation left out), or null
	                           with fewer than MIN_READY
	  NOTE                     the note ids
*/
import { POKES_IS_NOTE } from './checks.js';
import { isPunctuation } from '../spacing/letter_classes.js';
import { median } from '../spacing/measure.js';
import { word } from '../words/words.js';

/** A stroke this share off the median gets a note. */
export const NOTE_SHARE = 0.35;
/** The median needs at least this many ready letters. */
export const MIN_READY = 5;

/** The note ids. */
export const NOTE = Object.freeze({ thicker: 'thicker', thinner: 'thinner', pokes: 'pokes' });
/** The words for each way ink pokes past the lines. */
const POKES_WORDS = Object.freeze({
	top: 'checks.note.pokesTop',
	tail: 'checks.note.pokesTail',
	both: 'checks.note.pokesBoth',
});

/**
 * @param {Array<{char: String, stroke: Number | null, ready: Boolean}>} letters
 * @returns {Number | null}
 */
export function strokeMedian(letters) {
	const strokes = (letters || [])
		.filter((letter) => letter?.ready && counts(letter))
		.map((letter) => letter.stroke);
	return strokes.length >= MIN_READY ? median(strokes) : null;
}

/**
 * @param {Array<{id: String, char: String, stroke: Number | null, ready: Boolean,
 *   pokes?: 'top' | 'tail' | 'both' | null}>} letters - every letter with ink; pokes: which
 *   line checks.js says its ink reaches past
 * @returns {Map<String, Array<{id: String, text: String}>>}
 */
export function softNotes(letters) {
	const middle = strokeMedian(letters);
	const notes = new Map();
	const add = (id, note) => {
		if (!notes.has(id)) notes.set(id, []);
		notes.get(id).push(note);
	};
	(letters || []).forEach((letter) => {
		if (!letter?.id) return;
		if (middle !== null && middle > 0 && counts(letter) && !letter.fixedStroke) {
			const off = (letter.stroke - middle) / middle;
			if (off > NOTE_SHARE) add(letter.id, note(NOTE.thicker, 'checks.note.thicker'));
			else if (off < -NOTE_SHARE) add(letter.id, note(NOTE.thinner, 'checks.note.thinner'));
		}
		const pokes = POKES_WORDS[letter.pokes];
		if (POKES_IS_NOTE && pokes) add(letter.id, note(NOTE.pokes, pokes));
	});
	return notes;
}

/** @returns {Boolean} true for a letter whose stroke counts (not punctuation, a real stroke) */
function counts(letter) {
	const chars = [...(typeof letter?.char === 'string' ? letter.char : '')];
	if (!chars.length || chars.every(isPunctuation)) return false;
	return Number.isFinite(letter.stroke) && letter.stroke > 0;
}

function note(id, key) {
	return { id, text: word(key) };
}
