// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 fix pass, the checks on their own (UX-BEGINNER.md 4.2 "Needs a look", 7.2 "results
// that can't come out broken", section 10 B11). The critic's findings, each a test written to
// fail first against the checks as they were (scratchpad orig.config.mjs runs these against that
// copy):
//   1. A Brush stem drawn down to the writing line "sinks": the round nib's end hangs half the
//      nib (49.5 units at the default 99) past the 2 % limit (41 units). Every flat-footed
//      Brush letter came out amber.
//   2. A tail letter (g p q y) lifted off the line was Ready: tails were never judged.
//   3. A Brush tap beside small n was never a speck (it is as wide as the nib).
//   4. A small comma sitting on the line "sank", and Sit on the line could not move it.
// The guards beside them pass on both (tails on the line and written low, a pen that stops well
// under the line, letters with dots of their own) and keep the new rules from turning good
// letters amber; the rest fail first.
import { beforeEach, describe, expect, it } from 'vitest';
import { brushSize, MAX_SHARE, resetBrushForTests } from '../../nib/brush_size.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import { shearShapes } from '../../spacing/tests/fixtures.js';
import { applyPlan } from '../fix_shapes.js';
import { CHECK, FIX, LINE_SHARE, checkLetter, measureLetter, speckPieces } from '../checks.js';
import {
	FONT,
	bowlAndStem,
	brushInto,
	checksFont,
	comma,
	letter,
	moved,
	penArc,
	penLine,
	shapesFor,
	slashComma,
	tinyComma,
	uTailY,
} from './letters.js';

beforeEach(() => resetBrushForTests());

const BOX = FONT.upm;
const LIFT = Math.round(0.1 * BOX);
const X = FONT.xHeight;

/** The checks on one letter, as { id, way, fix } */
function checksOf(project, char) {
	return checkLetter(letter(project, char), { font: project.settings.font }).map((check) => ({
		id: check.id,
		way: check.args?.way,
		fix: check.fix,
	}));
}

const offLineOf = (project, char) =>
	checksOf(project, char).find((check) => check.id === CHECK.offLine) || null;

/** A font with one letter drawn with the Brush, each stroke a pen path, then spaced by B3 */
function brushFont(char, strokes, size) {
	const project = checksFont({ [char]: [] }, { fit: false });
	const item = letter(project, char);
	const nib = size ?? brushSize(project);
	strokes.forEach((points) => brushInto(item, points, nib));
	fitAllAutomatic(project);
	return project;
}

describe('1. a Brush letter drawn to the writing line is on it', () => {
	it('the default nib is 99 units: its round end puts ink 49.5 under the line, past 2 %', () => {
		const project = brushFont('l', [penLine([300, FONT.ascent], [300, 0])]);
		expect(brushSize(project)).toBe(99);
		const measures = measureLetter(letter(project, 'l'), project.settings.font);
		expect(measures.ink.yMin).toBeLessThan(-LINE_SHARE * BOX);
		expect(measures.penBottom).toBeGreaterThan(-1);
		expect(offLineOf(project, 'l')).toBeNull();
	});

	it.each([
		['l', [penLine([300, FONT.ascent], [300, 0])]],
		['I', [penLine([300, FONT.capHeight], [300, 0])]],
		['1', [penLine([300, FONT.capHeight], [300, 0]), penLine([300, FONT.capHeight], [150, 1300])]],
		[
			'n',
			[
				penLine([200, X], [200, 0]),
				[...penArc(450, X - 250, 250, 180, 0), ...penLine([700, X - 250], [700, 0]).slice(1)],
			],
		],
		['b', [penLine([200, FONT.ascent], [200, -12]), penArc(450, X / 2, X / 2 - 50, 0, 360)]],
	])('%s drawn with the default Brush, its stems ending on the line: no check', (char, strokes) => {
		const project = brushFont(char, strokes);
		expect(offLineOf(project, char)).toBeNull();
	});

	it('the thickest nib too (264 units: its end hangs 132 under the line)', () => {
		const project = checksFont({ l: [] }, { fit: false });
		const thick = Math.round(MAX_SHARE * X);
		brushInto(letter(project, 'l'), penLine([300, FONT.ascent], [300, 0]), thick);
		fitAllAutomatic(project);
		expect(offLineOf(project, 'l')).toBeNull();
	});

	it('a pen that stops well under the line still sinks (judged at the pen, not the ink)', () => {
		const project = brushFont('l', [penLine([300, FONT.ascent], [300, -60])]);
		expect(offLineOf(project, 'l')).toMatchObject({ way: 'below', fix: FIX.sitOnLine });
		// and a pen that stops well over it floats
		const high = brushFont('l', [penLine([300, FONT.ascent], [300, 100])]);
		expect(offLineOf(high, 'l')).toMatchObject({ way: 'above' });
	});
});

describe('2. a tail letter lifted off the line floats', () => {
	const tails = {
		g: () => shapesFor('g'),
		p: () => bowlAndStem('p'),
		q: () => bowlAndStem('q'),
		y: () => shapesFor('y'),
		'y written as a u with a tail': () => uTailY(),
	};

	it.each(Object.keys(tails))('%s lifted a tenth of the box: floats, Sit on the line', (n) => {
		const char = n[0];
		const project = checksFont({ [char]: moved(tails[n](), 0, LIFT) });
		expect(offLineOf(project, char)).toMatchObject({ way: 'above', fix: FIX.sitOnLine });
		expect(checksOf(project, char)[0].id).toBe(CHECK.offLine);
	});

	it.each(Object.keys(tails))('%s on the line: no check', (name) => {
		const char = name[0];
		expect(checksOf(checksFont({ [char]: tails[name]() }), char)).toEqual([]);
	});

	it.each(Object.keys(tails))(
		'%s lifted, then moved down by the body bottom it is judged by: no check',
		(name) => {
			const char = name[0];
			const project = checksFont({ [char]: moved(tails[name](), 0, LIFT) });
			const item = letter(project, char);
			const { body } = measureLetter(item, project.settings.font);
			expect(body.bottom).toBeGreaterThan(LIFT - 2 * LINE_SHARE * BOX);
			applyPlan(item, { k: 1, ox: 0, oy: 0, dx: 0, dy: -Math.round(body.bottom) });
			expect(checksOf(project, char)).toEqual([]);
		}
	);

	it("the critic's g, 700 up and too tall: floats first, so the bowl goes on the line", () => {
		const project = checksFont({ g: moved(shapesFor('g'), 0, 700) });
		expect(checksOf(project, 'g')[0]).toMatchObject({ id: CHECK.offLine, way: 'above' });
	});

	it('a tail is sized by its body from the bowl: a lifted g is the right size', () => {
		const project = checksFont({ g: moved(shapesFor('g'), 0, LIFT) });
		const ids = checksOf(project, 'g').map((check) => check.id);
		expect(ids).toEqual([CHECK.offLine]);
		expect(measureLetter(letter(project, 'g'), FONT).size).toBeCloseTo(1, 1);
	});

	// B10 + B11 finalize (the critic: "a tail letter written low is never judged"): the bowl or
	// the joint it is judged by sinks too
	it('written low a tenth of the box: g p q y sink, by their bowl or joint', () => {
		Object.keys(tails).forEach((name) => {
			const char = name[0];
			const project = checksFont({ [char]: moved(tails[name](), 0, -LIFT) });
			expect([name, offLineOf(project, char)?.way]).toEqual([name, 'below']);
		});
	});

	it('a slanted y and Brush-drawn y on the line: no check', () => {
		expect(checksOf(checksFont({ y: shearShapes(shapesFor('y'), 12, 0) }), 'y')).toEqual([]);
		expect(checksOf(checksFont({ y: shearShapes(uTailY(), 12, 0) }), 'y')).toEqual([]);
		// a V whose left arm ends on the line, the tail crossing it a little above
		const crossed = brushFont('y', [penLine([200, X], [450, 0]), penLine([700, X], [300, -400])]);
		expect(offLineOf(crossed, 'y')).toBeNull();
		const met = brushFont('y', [
			penLine([200, X], [450, 0]),
			penLine([700, X], [450, 0]),
			penLine([450, 0], [300, -400]),
		]);
		expect(offLineOf(met, 'y')).toBeNull();
		// and lifted 10 %, both float
		const lifted = brushFont('y', [
			penLine([200, X + LIFT], [450, LIFT]),
			penLine([700, X + LIFT], [300, -400 + LIFT]),
		]);
		expect(offLineOf(lifted, 'y')).toMatchObject({ way: 'above' });
	});

	it('a Brush g whose bowl rests on the line: no check; lifted: floats', () => {
		const bowl = (dy) => [
			penArc(500, X / 2 + dy, X / 2 - 50, 0, 360),
			penLine([950, X + dy], [950, -350 + dy]),
		];
		expect(offLineOf(brushFont('g', bowl(0)), 'g')).toBeNull();
		expect(offLineOf(brushFont('g', bowl(LIFT)), 'g')).toMatchObject({ way: 'above' });
	});

	it('j floats only when all of it is above the line (it has no bowl or joint to go by)', () => {
		expect(offLineOf(checksFont({ j: moved(shapesFor('j'), 0, LIFT) }), 'j')).toBeNull();
		expect(offLineOf(checksFont({ j: moved(shapesFor('j'), 0, 400) }), 'j')).toMatchObject({
			way: 'above',
		});
	});
});

describe('3. a dot of the pen beside a plain letter is a speck', () => {
	const n = () => [
		penLine([200, X], [200, 0]),
		[...penArc(450, X - 250, 250, 180, 0), ...penLine([700, X - 250], [700, 0]).slice(1)],
	];

	it('a Brush tap beside small n: Remove 1 speck, and it is the tap', () => {
		const project = brushFont('n', [...n(), [[860, 40], [861, 41]]]);
		const checks = checksOf(project, 'n');
		expect(checks[0]).toMatchObject({ id: CHECK.specks, fix: FIX.removeSpecks });
		const item = letter(project, 'n');
		const specks = speckPieces(item);
		expect(specks).toHaveLength(1);
		// beside the n's foot (spacing slid the letter: measured from its own ink)
		expect(specks[0].xMin).toBeGreaterThan(measureLetter(item, FONT).ink.xMax);
		expect(specks[0].xMax - specks[0].xMin).toBeLessThan(120);
	});

	it('a tap two nibs wide too; never a dash, or a stroke that touches the letter', () => {
		expect(checksOf(brushFont('n', [...n(), penLine([900, 300], [990, 300])]), 'n')[0].id).toBe(
			CHECK.specks
		);
		// a t's bar and an r's flag drawn as their own short strokes, touching the stem
		const t = brushFont('t', [penLine([300, 1300], [300, 0]), penLine([240, X], [400, X])]);
		expect(checksOf(t, 't').map((check) => check.id)).not.toContain(CHECK.specks);
		const r = brushFont('r', [penLine([200, X], [200, 0]), penLine([200, X - 100], [330, X])]);
		expect(checksOf(r, 'r').map((check) => check.id)).not.toContain(CHECK.specks);
		// a dash three nibs long beside the n is not a dot of the pen
		const dash = brushFont('n', [...n(), penLine([900, 300], [1100, 300])]);
		expect(checksOf(dash, 'n').map((check) => check.id)).not.toContain(CHECK.specks);
	});

	it('letters with dots of their own keep them: i j ! ? : ; and an accented letter', () => {
		const i = brushFont('i', [penLine([300, X], [300, 0]), [[300, X + 250], [301, X + 251]]]);
		expect(checksOf(i, 'i').map((check) => check.id)).not.toContain(CHECK.specks);
		const j = brushFont('j', [penLine([300, X], [300, -350]), [[420, X + 250], [421, X + 251]]]);
		expect(checksOf(j, 'j').map((check) => check.id)).not.toContain(CHECK.specks);
		const bang = brushFont('!', [
			penLine([300, FONT.capHeight], [300, 300]),
			[
				[420, 40],
				[421, 41],
			],
		]);
		expect(checksOf(bang, '!').map((check) => check.id)).not.toContain(CHECK.specks);
		const umlaut = brushFont('ä', [
			penArc(450, X / 2, X / 2 - 50, 0, 360),
			[[250, X + 200], [251, X + 201]],
			[[700, X + 200], [701, X + 201]],
		]);
		expect(checksOf(umlaut, 'ä').map((check) => check.id)).not.toContain(CHECK.specks);
	});
});

describe('4. a comma: what the check says, Sit on the line can fix', () => {
	it("the critic's small comma, its head on the line and its top at 50: no check", () => {
		const project = checksFont({ ',': tinyComma(100, 50) });
		const { ink } = measureLetter(letter(project, ','), FONT);
		expect(Math.round(ink.yMax)).toBe(50);
		expect(checksOf(project, ',')).toEqual([]);
	});

	it('a comma written as a short slash of the pen, from the line down: no check', () => {
		[40, 0, -30].forEach((top) => {
			expect(checksOf(checksFont({ ',': slashComma(100, top) }), ',')).toEqual([]);
		});
	});

	it('a comma whose head sinks or floats is off the line by its head', () => {
		expect(offLineOf(checksFont({ ',': comma(100, -200) }), ',')).toMatchObject({
			way: 'below',
		});
		expect(offLineOf(checksFont({ ',': comma(100, 200) }), ',')).toMatchObject({ way: 'above' });
		expect(offLineOf(checksFont({ ',': moved(tinyComma(100, 50), 0, -200) }), ',')).toMatchObject(
			{ way: 'below' }
		);
		expect(checksOf(checksFont({ ',': comma(100, 0) }), ',')).toEqual([]);
	});
});
