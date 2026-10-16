// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 specks (UX-BEGINNER.md section 10 B11): "a piece smaller than a quarter of (stroke
// estimate) squared that doesn't sit directly above or below another piece ... Dots of i, j, !,
// ?, : and ; are never specks." The check's count is the number on the fixes track's [Remove N
// specks] button; that track takes out exactly speckPieces (fix_shapes.js speckShapeGroups).
import { describe, expect, it } from 'vitest';
import { speckPieces } from '../checks.js';
import {
	FONT,
	STROKE,
	checksFont,
	feltTipI,
	hookedJ,
	letter,
	moved,
	rect,
	shapesFor,
	speck,
} from './letters.js';

const SAMPLES = {
	n: [...shapesFor('n'), speck(1400, 500, 20), speck(-300, 200, 25), speck(1500, -200, 18)],
	o: [...shapesFor('o'), speck(560, 540, 20)],
	i: [rect(100, 0, 100 + STROKE, FONT.xHeight), speck(260, FONT.xHeight + 200, 30)],
	j: [...hookedJ().slice(0, 2), speck(100 + STROKE + 80, FONT.xHeight + 200, 30)],
	'!': [rect(100, 444, 100 + STROKE, FONT.capHeight), speck(240, 0, 30)],
	':': [...shapesFor(':'), speck(900, 600, 15)],
	H: [...shapesFor('H'), speck(300, FONT.capHeight + 150, 25), speck(-400, 700, 25)],
	e: [...shapesFor('e'), ...moved([speck(1500, 300, 22), speck(1500, 360, 22)])],
};

describe('specks', () => {
	it.each([
		['n', 3],
		['o', 1],
		['i', 0],
		['j', 0],
		['!', 0],
		[':', 1],
		['H', 1],
		['e', 2],
	])('%s: %i specks', (char, count) => {
		const project = checksFont({ [char]: SAMPLES[char] });
		expect(speckPieces(letter(project, char))).toHaveLength(count);
	});

	it('finds the stray dots beside a letter, biggest first, and never the letter itself', () => {
		const project = checksFont({ n: SAMPLES.n });
		const specks = speckPieces(letter(project, 'n'));
		expect(specks).toHaveLength(3);
		expect(specks.map((piece) => Math.round(piece.area))).toEqual([625, 400, 324]);
	});

	it('dots of i j ! ? : ; are never specks, drifted to the side included', () => {
		['i', 'j', '!', ':'].forEach((char) => {
			const project = checksFont({ [char]: SAMPLES[char].slice(0, char === ':' ? 2 : undefined) });
			expect([char, speckPieces(letter(project, char))]).toEqual([char, []]);
		});
		const felt = checksFont({ i: feltTipI(100, 200) });
		expect(speckPieces(letter(felt, 'i'))).toEqual([]);
	});

	it("the same dot beside another letter's stem is a speck", () => {
		const project = checksFont({
			l: [rect(100, 0, 100 + STROKE, FONT.ascent), speck(500, 700, 30)],
		});
		expect(speckPieces(letter(project, 'l'))).toHaveLength(1);
	});

	// B10 + B11 finalize: the critic's two taps one over the other beside n stayed Ready (each
	// "sat over" the other); only a piece of the letter itself keeps a speck over or under it
	it('two specks one over the other beside a letter: both are specks (neither is the letter)', () => {
		const project = checksFont({ e: SAMPLES.e });
		expect(speckPieces(letter(project, 'e'))).toHaveLength(2);
	});
});
