// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 soft notes (UX-BEGINNER.md 4.2, section 10 B11): a stroke estimate more than 35 % off the
// median of 5 or more ready letters gets a quiet note; punctuation is left out of both; a note
// never takes Ready away (the cache tests check Ready with a note on).
import { describe, expect, it } from 'vitest';
import { strokeEstimate } from '../../spacing/measure.js';
import { MIN_READY, NOTE, NOTE_SHARE, softNotes, strokeMedian } from '../soft_notes.js';
import { checksFont, letter, plain } from './letters.js';

const row = (id, char, stroke, ready = true) => ({ id, char, stroke, ready });

describe('soft notes', () => {
	const five = [
		row('a', 'a', 100),
		row('b', 'b', 104),
		row('c', 'c', 96),
		row('d', 'd', 100),
		row('e', 'e', 102),
	];

	it('a stroke more than 35 % thicker or thinner than the median gets a note', () => {
		const notes = softNotes([...five, row('f', 'f', 140), row('g', 'g', 64), row('h', 'h', 134)]);
		expect(notes.get('f')).toEqual([
			{ id: NOTE.thicker, text: 'Note: thicker than your other letters.' },
		]);
		expect(notes.get('g')).toEqual([
			{ id: NOTE.thinner, text: 'Note: thinner than your other letters.' },
		]);
		expect(notes.has('h')).toBe(false);
		expect(NOTE_SHARE).toBe(0.35);
	});

	it('needs 5 or more ready letters for the median', () => {
		expect(MIN_READY).toBe(5);
		const four = five.slice(0, 4);
		expect(strokeMedian([...four, row('x', 'x', 300, false)])).toBeNull();
		expect(softNotes([...four, row('x', 'x', 300, false)]).size).toBe(0);
		expect(strokeMedian(five)).toBe(100);
	});

	it('letters that are not ready get notes but never move the median', () => {
		const notes = softNotes([...five, row('m', 'm', 300, false), row('n', 'n', 310, false)]);
		expect(strokeMedian([...five, row('m', 'm', 300, false)])).toBe(100);
		expect(notes.get('m')[0].id).toBe(NOTE.thicker);
	});

	it('punctuation is left out of the median and never gets a note', () => {
		const dots = [row('p', '.', 400), row('q', ',', 400), row('r', '!', 400), row('s', "'", 10)];
		expect(strokeMedian([...five.slice(0, 4), ...dots])).toBeNull();
		const notes = softNotes([...five, ...dots]);
		['p', 'q', 'r', 's'].forEach((id) => expect(notes.has(id)).toBe(false));
	});

	it('ink past the top or tail line is a note (POKES_IS_NOTE), punctuation too', () => {
		const notes = softNotes([
			...five,
			{ ...row('k', 'k', 100), pokes: 'top' },
			{ ...row('q', '?', 100), pokes: 'top' },
		]);
		expect(notes.get('k')).toEqual([
			{
				id: NOTE.pokes,
				text: 'Note: reaches far above the top line, so lines of text will sit further apart.',
			},
		]);
		expect(notes.get('q')?.[0].id).toBe(NOTE.pokes);
		expect(softNotes([{ ...row('k', 'k', 100), pokes: null }]).size).toBe(0);
	});

	// B10 + B11 fix pass (the critic: small h's card said "the top line or the tail line", and a
	// first-timer can't tell which). Written to fail first: one sentence named both lines.
	it('the note names the line the ink reaches past: the top line, the tail line, or both', () => {
		const notes = softNotes([
			{ ...row('h', 'h', 100), pokes: 'top' },
			{ ...row('g', 'g', 100), pokes: 'tail' },
			{ ...row('f', 'f', 100), pokes: 'both' },
		]);
		expect(notes.get('h')[0].text).toBe(
			'Note: reaches far above the top line, so lines of text will sit further apart.'
		);
		expect(notes.get('g')[0].text).toBe(
			'Note: reaches far below the tail line, so lines of text will sit further apart.'
		);
		expect(notes.get('f')[0].text).toBe(
			'Note: reaches far above the top line and far below the tail line, so lines of text will sit further apart.'
		);
		[...notes.values()].flat().forEach((note) => expect(note.text).not.toMatch(/ or the /));
	});

	it('on real letters: a heavy n among a light hand', () => {
		const project = checksFont(plain('Hnorvat'));
		const letters = ['H', 'n', 'o', 'r', 'v', 'a', 't'].map((char) => {
			const item = letter(project, char);
			return { id: item.id, char, stroke: strokeEstimate(item), ready: true };
		});
		expect(softNotes(letters).size).toBe(0);
		letters[1].stroke *= 1.5;
		expect(softNotes(letters).get(letters[1].id)?.[0].id).toBe(NOTE.thicker);
	});
});
