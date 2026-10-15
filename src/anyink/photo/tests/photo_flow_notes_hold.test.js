// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow fix pass: step C's quiet notes (photo_flow_notes.js) and the save hold that keeps
// step C's placement out of every saved copy of a letter (photo_flow_hold.js).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { word } from '../../words/words.js';
import { box } from './flow_fakes.js';
import { holdSavedTrace, isHeld, releaseSavedTrace } from '../photo_flow_hold.js';
import {
	REACH_SHARE,
	TWO_WIDE_ASPECT,
	TWO_WIDE_SHARE,
	reachPast,
	stepNotes,
	touchingLetters,
} from '../photo_flow_notes.js';

// The new-font lines: top 1550, tail -440, letter box 2048 (5 % of it is 102.4)
const FONT = new GlyphrStudioProject().settings.font;

describe('step C notes: two letters that touch', () => {
	// B r e (na) H d, as the first-timer wrote them: the "na" part is 236 x 166
	const record = {
		parts: [
			{ id: 'p1', left: 261, top: 176, right: 484, bottom: 396, row: 0 },
			{ id: 'p2', left: 594, top: 317, right: 668, bottom: 421, row: 0 },
			{ id: 'p3', left: 757, top: 277, right: 884, bottom: 428, row: 0 },
			{ id: 'p4', left: 986, top: 261, right: 1222, bottom: 427, row: 0 },
			{ id: 'p5', left: 1411, top: 160, right: 1644, bottom: 493, row: 0 },
			{ id: 'p6', left: 1753, top: 239, right: 1870, bottom: 445, row: 0 },
		],
		skipped: [],
	};

	it('the "na" part is wider than tall and much wider than the others; B and H are not', () => {
		expect([TWO_WIDE_SHARE, TWO_WIDE_ASPECT]).toEqual([1.6, 1.25]);
		expect(touchingLetters(record, 'p4')).toBe(true);
		expect(touchingLetters(record, 'p1')).toBe(false);
		expect(touchingLetters(record, 'p5')).toBe(false);
		expect(touchingLetters(record, 'nope')).toBe(false);
		expect(touchingLetters(null, 'p4')).toBe(false);
	});

	it('the note names the button that fixes it', () => {
		const notes = stepNotes({ record, partId: 'p4', shapes: [], font: FONT, char: 'n' });
		expect(notes).toEqual([{ key: 'photoFlow.note.twoLetters', vars: {} }]);
		expect(Object.isFrozen(notes)).toBe(true);
		expect(word(notes[0].key)).toMatch(/Draw a box/);
	});
});

describe('step C notes: ink far past the top or tail line', () => {
	it("more than 5 % of the letter box past the top line (the f's 2378); within it, nothing", () => {
		expect(REACH_SHARE).toBe(0.05);
		expect(reachPast([box(100, 0, 300, 2378)], FONT)).toBe('above');
		expect(reachPast([box(100, 0, 300, 1550 + 100)], FONT)).toBeNull();
		expect(reachPast([box(100, -440 - 110, 300, 1100)], FONT)).toBe('below');
		expect(reachPast([], FONT)).toBeNull();
	});

	it('the note says which letter, in its house name', () => {
		const notes = stepNotes({ shapes: [box(100, 0, 300, 2378)], font: FONT, char: 'f' });
		expect(notes).toEqual([{ key: 'photoFlow.note.reachesAbove', vars: { letter: 'small f' } }]);
		expect(word(notes[0].key, notes[0].vars)).toBe(
			'small f reaches far above the top line, so lines of text in your font will sit further apart.'
		);
		const below = stepNotes({ shapes: [box(0, -700, 300, 1100)], font: FONT, char: 'g' });
		expect(word(below[0].key, below[0].vars)).toMatch(/^small g reaches far below the tail line/);
	});
});

describe('the save hold', () => {
	const earlier = { asset: 'img-old00009', width: 10, height: 10, x: 1, y: 2, scale: 3 };
	const stepC = {
		asset: 'img-new00009',
		width: 10,
		height: 10,
		x: 50,
		y: 60,
		scale: 4,
		locked: true,
	};

	it("while live, the letter saves with the photo it had; it shows step C's", () => {
		const glyph = new Glyph({ id: 'glyph-0x42' });
		setTrace(glyph, earlier);
		setTrace(glyph, stepC);
		let live = true;
		holdSavedTrace(glyph, { before: earlier, isLive: () => live });
		expect(isHeld(glyph)).toBe(true);
		expect(getTrace(glyph).asset).toBe(stepC.asset);
		expect(glyph.save().anyink.trace).toMatchObject(earlier);
		// The hold is never part of the letter itself
		expect(Object.keys(glyph)).not.toContain('save');
		// Once the flow is over (or Use it is going in), the letter saves as it is
		live = false;
		expect(glyph.save().anyink.trace).toMatchObject({ asset: stepC.asset });
		releaseSavedTrace(glyph);
		expect(isHeld(glyph)).toBe(false);
		expect(Object.hasOwn(glyph, 'save')).toBe(false);
	});

	it('a letter with no photo before saves with none (and no empty ANY-INK block)', () => {
		const glyph = new Glyph({ id: 'glyph-0x43' });
		setTrace(glyph, stepC);
		holdSavedTrace(glyph, { before: null, isLive: () => true });
		expect(glyph.save().anyink).toBeUndefined();
		releaseSavedTrace(glyph);
		expect(glyph.save().anyink.trace).toMatchObject({ asset: stepC.asset });
	});

	it('a hold whose check throws saves the letter as it is; a second hold replaces the first', () => {
		const glyph = new Glyph({ id: 'glyph-0x44' });
		setTrace(glyph, stepC);
		holdSavedTrace(glyph, {
			before: earlier,
			isLive: () => {
				throw new Error('gone');
			},
		});
		expect(glyph.save().anyink.trace.asset).toBe(stepC.asset);
		holdSavedTrace(glyph, { before: earlier, isLive: () => true });
		expect(glyph.save().anyink.trace.asset).toBe(earlier.asset);
		releaseSavedTrace(glyph);
		expect(Object.hasOwn(glyph, 'save')).toBe(false);
	});
});
