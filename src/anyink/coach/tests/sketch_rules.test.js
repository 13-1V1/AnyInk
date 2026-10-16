// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7, "Next line rules"): rules 19, 20, 24 and 25, each in its place in
	pick() order, each only with the 'sketch' flag on:
	  19 pieceOpen        a piece is open: "Finish the line: ..." [Done], ahead of everything but
	                      an open dialog
	  20 outlineGap       an Outline piece finished open: the sentence, [Close it] only once an
	                      action answers it (S7), ahead of rule 7
	  24 thickness        Centerline ink, the font's thickness never set: [Looks good]
	  25 thicknessForAll  the slider's offer stands (S3 integration), others differ: [Use on all] green
	                      (only once the thickness track answers it), quiet [Just this one]; a skip
	                      lasts until the thickness or the count changes
	and rule 8's sentence for a sketch tool picked on an empty letter. With the flag off none of
	them shows. Written to fail first (none of the rules existed).
*/
import { describe, expect, it } from 'vitest';
import { word } from '../../words/words.js';
import { liveSkips, pickLine, RULES } from '../rules.js';
import { ALL_FLAGS, fakeState, flags } from './fake_state.js';

/** The open letter's sketch facts (sketch_facts.js), with nothing to say */
const QUIET = Object.freeze({
	pieceOpen: false,
	gap: false,
	centerInk: false,
	thickness: 0,
	fontThickness: null,
	differ: 0,
	sketched: 0,
	canUseOnAll: false,
	canClose: false,
});

const NO_SKETCH = Object.freeze({ ...ALL_FLAGS, sketch: false });

/** small n open in the letter view, with ink (Ready) unless empty */
function onN(sketch, { empty = false, flagSet = ALL_FLAGS, ...rest } = {}) {
	return fakeState({
		page: 'letter',
		current: 'n',
		ready: empty ? '' : 'n',
		flags: flagSet,
		sketch: { ...QUIET, ...sketch },
		...rest,
	});
}

describe('their places in pick() order', () => {
	it('19 right after 1; 20 right before 7; 24 and 25 right after 7', () => {
		const ids = RULES.map((rule) => rule.id);
		expect(ids.indexOf(19)).toBe(ids.indexOf(1) + 1);
		expect(ids.indexOf(20)).toBe(ids.indexOf(7) - 1);
		expect(ids.slice(ids.indexOf(7) + 1, ids.indexOf(7) + 3)).toEqual([24, 25]);
	});
});

describe('19 pieceOpen', () => {
	it('a piece open: finish it, [Done] green; ahead of rule 6, 7 and 8', () => {
		const line = pickLine(
			onN(
				{ pieceOpen: true },
				{
					empty: true,
					fontProblems: [{ itemId: 'glyph-0x61', problem: 'x', text: 'A problem.', fixable: false }],
				}
			)
		);
		expect(line).toMatchObject({
			rule: 19,
			sentence: word('sketch.next.pieceOpen'),
			button: word('sketch.next.done'),
			action: 'sketchFinishPiece',
			primary: true,
		});
	});

	it('an open dialog still holds the screen (rule 1 first)', () => {
		expect(pickLine(onN({ pieceOpen: true }, { dialog: 'howCard' })).rule).toBe(1);
	});

	it('guard, the flag off: not said', () => {
		expect(pickLine(onN({ pieceOpen: true }, { flagSet: NO_SKETCH })).rule).not.toBe(19);
	});
});

describe('20 outlineGap', () => {
	it('the sentence alone while nothing closes it (no dead button)', () => {
		const line = pickLine(onN({ gap: true }, { empty: true }));
		expect(line).toMatchObject({
			rule: 20,
			sentence: word('sketch.next.outlineGap', { letter: 'small n' }),
			button: '',
			action: '',
		});
	});

	it('[Close it] once an action answers it, with the letter', () => {
		const line = pickLine(onN({ gap: true, canClose: true }));
		expect(line).toMatchObject({
			rule: 20,
			button: word('sketch.next.closeIt'),
			action: 'closeOutline',
			args: { char: 'n' },
		});
	});

	it('ahead of the letter\'s look (rule 7); not while a piece is open (19 says that)', () => {
		const look = { n: { id: 'line', reason: 'small n floats.', fixLabel: 'Sit on the line' } };
		expect(pickLine(onN({ gap: true }, { needsLook: look })).rule).toBe(20);
		expect(pickLine(onN({ gap: true, pieceOpen: true })).rule).toBe(19);
	});

	it('guard, the flag off: not said', () => {
		expect(pickLine(onN({ gap: true }, { flagSet: NO_SKETCH })).rule).not.toBe(20);
	});
});

describe('24 thickness', () => {
	const built = { centerInk: true, thickness: 99, sketched: 1 };

	it('Centerline ink and no font thickness yet: pull the slider, [Looks good]', () => {
		const line = pickLine(onN(built));
		expect(line).toMatchObject({
			rule: 24,
			sentence: word('sketch.next.thickness', { letter: 'small n' }),
			button: word('sketch.next.looksGood'),
			action: 'sketchThicknessOk',
			args: { char: 'n', thickness: 99 },
			primary: true,
		});
	});

	it('not once the font has a thickness, nor with no Centerline ink', () => {
		expect(pickLine(onN({ ...built, fontThickness: 99 })).rule).not.toBe(24);
		expect(pickLine(onN({ ...built, centerInk: false })).rule).not.toBe(24);
	});

	it("a letter's look (rule 7) comes first", () => {
		const look = { n: { id: 'line', reason: 'small n floats.', fixLabel: 'Sit on the line' } };
		expect(pickLine(onN(built, { needsLook: look })).rule).toBe(7);
	});

	it('Something else skips it until the thickness changes', () => {
		const state = onN(built);
		const skipped = { ...state, skips: { 'sketchThickness:n': '99' } };
		expect(pickLine(skipped).rule).not.toBe(24);
		expect(liveSkips(state).get('sketchThickness:n')).toBe('99');
		expect(liveSkips(onN({ ...built, thickness: 120 })).get('sketchThickness:n')).toBe('120');
	});

	it('guard, the flag off: not said', () => {
		expect(pickLine(onN(built, { flagSet: NO_SKETCH })).rule).not.toBe(24);
	});
});

describe('25 thicknessForAll', () => {
	const moved = {
		centerInk: true,
		thickness: 120,
		fontThickness: 120,
		differ: 4,
		sketched: 5,
		canUseOnAll: true,
		// S3 integration: the thickness track's offer (thickness_all.js thicknessOffer)
		offer: { count: 5, thickness: 120 },
	};

	it('the font took this thickness and 4 others differ: "on all 5", [Use on all] green, quiet [Just this one]', () => {
		const line = pickLine(onN(moved));
		expect(line).toMatchObject({
			rule: 25,
			sentence: word('sketch.next.thicknessForAll', { count: 5 }),
			button: word('sketch.thickness.useOnAll'),
			action: 'sketchUseOnAll',
			args: { thickness: 120 },
			primary: true,
			quiet: {
				label: word('sketch.thickness.justThisOne'),
				action: 'sketchJustThisOne',
				args: null,
			},
		});
	});

	it('not while nothing answers [Use on all], nor with no offer standing (no slider step newest, none differ)', () => {
		expect(pickLine(onN({ ...moved, canUseOnAll: false })).rule).not.toBe(25);
		expect(pickLine(onN({ ...moved, offer: null })).rule).not.toBe(25);
		expect(pickLine(onN({ ...moved, offer: { count: 1, thickness: 120 } })).rule).not.toBe(25);
	});

	it('[Just this one] (the skip) lasts until the thickness or the count changes', () => {
		const skips = { sketchForAll: '120:5' };
		expect(pickLine(onN(moved, { skips })).rule).not.toBe(25);
		expect(pickLine(onN({ ...moved, thickness: 130, fontThickness: 130 }, { skips })).rule).toBe(25);
		expect(pickLine(onN({ ...moved, offer: { count: 6, thickness: 120 } }, { skips })).rule).toBe(25);
	});

	it('guard, the flag off: not said; other lines carry no quiet button', () => {
		const off = pickLine(onN(moved, { flagSet: NO_SKETCH }));
		expect(off.rule).not.toBe(25);
		expect(off.quiet).toBeNull();
	});
});

describe('rule 8 with a sketch tool picked on an empty letter', () => {
	it.each([
		['sketchLine', 'coach.rule.drawFirstPoint'],
		['sketchArc', 'coach.rule.drawFirstPoint'],
		['sketchSpline', 'coach.rule.drawFirstPoint'],
		['sketchCircle', 'sketch.tip.circle'],
		['sketchRectangle', 'sketch.tip.rectangle'],
	])('%s: what a click on the paper does', (tool, key) => {
		const line = pickLine(onN({}, { empty: true, tool }));
		expect(line.rule).toBe(8);
		expect(line.sentence).toBe(word(key));
		expect(line.stamp).toBe(tool);
	});

	it('no sketch tool picked: the empty line names [Sketch it] (S3 integration: its words exist)', () => {
		const line = pickLine(onN({}, { empty: true, tool: '' }));
		expect(line.rule).toBe(8);
		expect(line.sentence).toBe(word('sketch.next.emptyPhoto', { letter: 'small n' }));
		expect(line.sentence).toBe('small n is empty. Sketch it, or use a photo of it.');
		const plain = pickLine(
			onN({}, { empty: true, tool: '', flagSet: flags('letterView', 'brush', 'sketch') })
		);
		expect(plain.sentence).toBe('small n is empty. Sketch it.');
	});

	it('guard, the flag off: a sketch tool name gets no sentence of its own', () => {
		const line = pickLine(
			onN({}, { empty: true, tool: 'sketchLine', flagSet: flags('letterView', 'brush', 'photo') })
		);
		expect(line.sentence).toBe(word('coach.rule.emptyPhotoBrush', { letter: 'small n' }));
	});
});
