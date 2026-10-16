// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (build verifier): an Outline-way sketched letter has no Thickness control (its
	loops are its edges), yet B11's soft note told him "Note: thicker than your other letters."
	with nothing to press. The thicker / thinner note now skips a letter whose ink is all built
	from Outline pieces of its sketch (checks/sketch_top.js isOutlineSketched); the pokes note,
	and Centerline sketches, Brush and plain ink are as before.
*/
import { describe, expect, it } from 'vitest';
import { storedSketch } from '../../sketch/tests/fixtures/stored_sketches.js';
import { builtLetter, followEditor, FOLLOW_IDS } from '../../sketch/tests/follow_helpers.js';
import { isOutlineSketched } from '../sketch_top.js';
import { NOTE, softNotes } from '../soft_notes.js';

const ready = (id, stroke, extra = {}) => ({ id, char: id, stroke, ready: true, ...extra });

describe('the thicker / thinner note and Outline sketches', () => {
	it('softNotes leaves out the stroke note of a letter whose stroke is not a setting', () => {
		const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => ready(id, 100));
		rows.push(ready('o', 200, { fixedStroke: true, pokes: 'top' }));
		rows.push(ready('n', 200));
		const notes = softNotes(rows);
		expect((notes.get('o') || []).map((note) => note.id)).toEqual([NOTE.pokes]);
		expect(notes.get('n').map((note) => note.id)).toEqual([NOTE.thicker]);
	});

	it('isOutlineSketched: an o built from Outline loops, not a Centerline o', () => {
		const editor = followEditor();
		const outline = storedSketch('o');
		outline.way = 'outline';
		outline.pieces = outline.pieces.map((piece) => ({ ...piece, use: 'outline' }));
		const o = builtLetter(editor, FOLLOW_IDS.o, outline);
		expect(o.shapes.length).toBeGreaterThan(0);
		expect(isOutlineSketched(o)).toBe(true);
		const n = builtLetter(editor, FOLLOW_IDS.n, storedSketch('n'));
		expect(isOutlineSketched(n)).toBe(false);
		delete o.shapes[0].anyink;
		expect(isOutlineSketched(o)).toBe(false);
	});
});
