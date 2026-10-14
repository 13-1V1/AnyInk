// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement: rows, the row writing line, the body bottom and the tail guess
// (UX-BEGINNER 4.4 "One writing line per row", "Rows with 1 or 2 parts").
import { describe, expect, it } from 'vitest';
import { lineTargets } from '../classes.js';
import {
	bodyBottom,
	counterBottom,
	groupRows,
	guessTail,
	halfWidthBottom,
	levelBottom,
	lineAt,
	partGeometry,
	rowExtents,
	rowPartnerLine,
	rowWritingLine,
	seatTraceY,
	writingLines,
} from '../seat.js';
import { boxPart, drawPart } from './raster.js';
import { drawLetter, photoOf, turner } from './letters.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
// drawLetter: 2 px per cap unit, a 12 px pen, the writing line at y = 300 px. A stroke drawn
// along the writing line has its lower ink edge at 306.
const BASE_EDGE = 306;

describe('partGeometry and rowExtents', () => {
	it('a part with a mask gets its tight box from the ink', () => {
		const part = drawPart(
			[
				[
					[10, 10],
					[30, 10],
				],
			],
			4,
			{ width: 50, height: 50 }
		);
		const loose = {
			...part,
			left: part.left - 3,
			top: part.top - 2,
			right: part.right + 5,
			bottom: part.bottom + 1,
		};
		loose.mask = new Uint8Array((loose.right - loose.left) * (loose.bottom - loose.top));
		const w = part.right - part.left;
		for (let y = 0; y < part.bottom - part.top; y++) {
			for (let x = 0; x < w; x++) {
				loose.mask[(y + 2) * (loose.right - loose.left) + x + 3] = part.mask[y * w + x];
			}
		}
		const g = partGeometry(loose);
		expect([g.left, g.top, g.right, g.bottom]).toEqual([
			part.left,
			part.top,
			part.right,
			part.bottom,
		]);
	});

	it('a part without a mask is its box', () => {
		expect(partGeometry(boxPart('x', 5, 6, 25, 46))).toMatchObject({
			left: 5,
			top: 6,
			width: 20,
			height: 40,
			mask: null,
		});
		expect(rowExtents(boxPart('x', 5, 6, 25, 46))).toBe(null);
	});

	it('row extents measure leftmost to rightmost ink in each row', () => {
		const part = drawLetter('H');
		const ext = rowExtents(part);
		const g = partGeometry(part);
		expect(ext.length).toBe(g.height);
		expect(Math.max(...ext)).toBe(g.width);
		// The middle of H's crossbar row spans the whole letter
		expect(ext[Math.round(g.height / 2)]).toBe(g.width);
	});

	it('a part whose box changes is measured again', () => {
		const part = boxPart('x', 5, 6, 25, 46);
		expect(partGeometry(part).height).toBe(40);
		part.bottom = 66;
		expect(partGeometry(part).height).toBe(60);
	});

	it('broken input is not a part', () => {
		expect(partGeometry(null)).toBe(null);
		expect(partGeometry({ left: 5, top: 5, right: 5, bottom: 9 })).toBe(null);
	});
});

describe('groupRows', () => {
	it('sorts parts into rows by vertical overlap: rows top to bottom, parts left to right', () => {
		const parts = [
			boxPart('n', 300, 60, 340, 100),
			boxPart('B', 100, 0, 160, 100),
			boxPart('second-a', 120, 200, 160, 240),
			boxPart('r', 200, 58, 230, 101),
			boxPart('second-b', 40, 160, 80, 241),
		];
		const rows = groupRows(parts).map((row) => row.map((part) => part.id));
		expect(rows).toEqual([
			['B', 'r', 'n'],
			['second-b', 'second-a'],
		]);
	});

	it('a period and an apostrophe join the row through the letters they overlap', () => {
		const parts = [
			boxPart('H', 0, 0, 60, 100),
			boxPart("'", 80, 0, 86, 22),
			boxPart('.', 100, 88, 110, 100),
		];
		expect(groupRows(parts).map((row) => row.length)).toEqual([3]);
	});

	it("a g's tail reaching into the next row does not join the rows", () => {
		const parts = [
			boxPart('a', 0, 40, 40, 100),
			boxPart('g', 60, 40, 100, 150),
			boxPart('n', 120, 40, 160, 100),
			boxPart('H', 0, 140, 60, 240),
			boxPart('I', 80, 140, 90, 240),
		];
		expect(groupRows(parts).map((row) => row.map((p) => p.id))).toEqual([
			['a', 'g', 'n'],
			['H', 'I'],
		]);
	});

	it('uses the row numbers the photo already has', () => {
		const parts = [
			boxPart('a', 0, 0, 10, 10, { row: 1 }),
			boxPart('b', 50, 500, 60, 510, { row: 0 }),
		];
		expect(groupRows(parts).map((row) => row.map((p) => p.id))).toEqual([['b'], ['a']]);
	});
});

describe('writing lines: one per row, sloped as the photo is', () => {
	// Bottoms 100, 103, 98, 101 and a g tail at 140
	const row = [
		boxPart('B', 0, 0, 60, 100),
		boxPart('r', 80, 43, 110, 103),
		boxPart('e', 130, 38, 170, 98),
		boxPart('g', 190, 40, 230, 140),
		boxPart('n', 250, 41, 290, 101),
	];
	/** The line is near y under the middle of every part of the row. */
	const near = (line, y, slack = 1, parts = row) => {
		for (const part of parts) {
			const x = (part.left + part.right) / 2;
			expect(Math.abs(lineAt(line, x) - y), part.id).toBeLessThanOrEqual(slack);
		}
	};

	it('runs through the middle of the bottoms; an unnamed tail is left out of the fit', () => {
		const line = rowWritingLine(row, {});
		expect(line.count).toBe(4);
		near(line, 100.5);
	});

	it('leaves out named letters whose bottom is not on the line: tails, apostrophes, hyphens', () => {
		expect(rowWritingLine(row, { g: { char: 'g' } }).count).toBe(4);
		const marks = [
			...row.slice(0, 3),
			boxPart('apostrophe', 300, 0, 306, 20),
			boxPart('hyphen', 320, 60, 350, 66),
		];
		const line = rowWritingLine(marks, { apostrophe: { char: "'" }, hyphen: { char: '-' } });
		expect(line.count).toBe(3);
		near(line, 100, 2.5, marks.slice(0, 3));
	});

	it('Q J f count only once [No tail] is known; [No tail] on a g puts it back', () => {
		const withF = [...row.slice(0, 3), boxPart('f', 300, 0, 330, 140)];
		expect(rowWritingLine(withF, { f: { char: 'f' } }).count).toBe(3);
		expect(rowWritingLine(withF, { f: { char: 'f', tail: true } }).count).toBe(3);
		expect(rowWritingLine(withF, { f: { char: 'f', tail: false } }).count).toBe(4);
		// A g he says has no tail counts with the letters on the line
		const short = [...row.slice(0, 3), boxPart('g', 190, 40, 230, 102), row[4]];
		expect(rowWritingLine(short, { g: { char: 'g' } }).count).toBe(4);
		expect(rowWritingLine(short, { g: { char: 'g', tail: false } }).count).toBe(5);
	});

	it('a row line needs 3 bottoms on the line: 1 or 2 make none', () => {
		expect(rowWritingLine(row.slice(0, 2), {})).toBe(null);
		expect(rowWritingLine([], {})).toBe(null);
		// A Q Y: the Q waits for its tail, so only A and Y count
		const capitals = [
			boxPart('A', 0, 0, 60, 100),
			boxPart('Q', 80, 0, 150, 120),
			boxPart('Y', 170, 0, 230, 96),
		];
		expect(rowWritingLine(capitals, { A: { char: 'A' }, Q: { char: 'Q' }, Y: { char: 'Y' } })).toBe(
			null
		);
	});

	it('a row with nothing that sits on the line has no row line', () => {
		const tails = [
			boxPart('g', 0, 40, 40, 140),
			boxPart('y', 60, 40, 100, 140),
			boxPart('p', 120, 40, 160, 140),
		];
		expect(rowWritingLine(tails, { g: { char: 'g' }, y: { char: 'y' }, p: { char: 'p' } })).toBe(
			null
		);
	});

	it('a photo turned 1.5 degrees: one slope for every row, each line on its pen line', () => {
		const W = 1600;
		const H = 700;
		const photo = photoOf(
			[
				{ char: 'B', x0: 60, base: 260 },
				{ char: 'a', x0: 260, base: 260 },
				{ char: 'n', x0: 420, base: 260 },
				{ char: 'g', x0: 560, base: 260, named: false },
				{ char: 'H', x0: 760, base: 260 },
				{ char: 'o', x0: 120, base: 560 },
				{ char: 'e', x0: 520, base: 560 },
				{ char: 'l', x0: 1100, base: 560 },
			],
			{ width: W, height: H, tilt: 1.5 }
		);
		const rows = groupRows(photo.parts);
		expect(rows.length).toBe(2);
		const fitted = writingLines(rows, photo.uses);
		expect(Math.abs((Math.atan(fitted.slope) * 180) / Math.PI - 1.5)).toBeLessThanOrEqual(0.1);
		const turn = turner(1.5, W, H);
		rows.forEach((row, r) => {
			const base = [260, 560][r] + 6;
			const [ax, ay] = turn([0, base]);
			const [bx, by] = turn([W, base]);
			for (const part of row) {
				const g = partGeometry(part);
				const middle = (g.left + g.right) / 2;
				const truth = ay + ((middle - ax) * (by - ay)) / (bx - ax);
				expect(Math.abs(lineAt(fitted.lines[r], middle) - truth), part.id).toBeLessThanOrEqual(1);
			}
		});
	});

	it('one letter in four written a little low cannot tilt the line', () => {
		// A level photo; the n sits 6 px low (not a tail: under a quarter of its height)
		const four = [
			boxPart('B', 0, 0, 60, 100),
			boxPart('r', 80, 40, 110, 100),
			boxPart('e', 130, 40, 170, 100),
			boxPart('n', 250, 46, 290, 106),
		];
		const fitted = writingLines([four], {});
		expect(Math.abs(fitted.slope)).toBeLessThanOrEqual(1e-9);
		near(fitted.lines[0], 100, 0.5, four.slice(0, 3));
	});

	it('three bottoms are too few to tell a tilt from a letter written high: the line stays level', () => {
		// a, B and a period written 6 px high (the photo "a g B Q f .")
		const three = [
			boxPart('a', 10, 40, 70, 100),
			boxPart('B', 170, 0, 230, 100),
			boxPart('period', 395, 84, 405, 94),
		];
		const uses = { a: { char: 'a' }, B: { char: 'B' }, period: { char: '.' } };
		const fitted = writingLines([three], uses);
		expect(fitted.slope).toBe(0);
		expect(fitted.lines[0].count).toBe(3);
		// Where a dropping f further along the row finds its body
		expect(lineAt(fitted.lines[0], 600)).toBe(100);
	});

	it('a period written a little high still counts toward its row line; a floating mark does not', () => {
		const level = ['B', 'r', 'e', 'n', 'o', 'u'].map((id, i) =>
			boxPart(id, 60 * i, i ? 40 : 0, 60 * i + 40, 100)
		);
		const dot = boxPart('period', 380, 86, 388, 94);
		const line = rowWritingLine([...level, dot], {});
		expect(line.count).toBe(7);
		near(line, 100, 1e-9, level);
		const floating = [
			...row.slice(0, 3),
			row[4],
			boxPart('apostrophe', 300, 0, 306, 20),
			boxPart('hyphen', 320, 60, 350, 66),
		];
		expect(rowWritingLine(floating, {}).count).toBe(4);
	});

	it('a partner line: 1 or 2 named letters on the line, at the slope given', () => {
		const pair = [boxPart('a', 0, 40, 40, 100), boxPart('f', 60, 0, 90, 140)];
		const line = rowPartnerLine(pair, { a: { char: 'a' }, f: { char: 'f' } }, 'f', 0.1);
		expect(line.count).toBe(1);
		expect(lineAt(line, 20)).toBeCloseTo(100, 9);
		expect(lineAt(line, 75)).toBeCloseTo(105.5, 9);
		expect(rowPartnerLine(pair, { f: { char: 'f' } }, 'f')).toBe(null);
		expect(rowPartnerLine(pair, { a: { char: 'g' }, f: { char: 'f' } }, 'f')).toBe(null);
	});
});

describe('levelBottom: the ink bottom as the photo would have it held square', () => {
	it('a level photo: the ink bottom', () => {
		const H = drawLetter('H');
		expect(levelBottom(H, 0)).toBe(partGeometry(H).bottom);
		expect(levelBottom(boxPart('x', 0, 0, 10, 10), 0.05)).toBe(10);
	});

	it('an H turned 1.5 degrees: both feet, at the middle of the letter', () => {
		const W = 400;
		const turn = turner(1.5, W, W);
		const H = drawLetter('H', { tilt: 1.5 });
		const g = partGeometry(H);
		const middle = (g.left + g.right) / 2;
		const [ax, ay] = turn([0, BASE_EDGE]);
		const [bx, by] = turn([W, BASE_EDGE]);
		const truth = ay + ((middle - ax) * (by - ay)) / (bx - ax);
		expect(Math.abs(levelBottom(H, Math.tan((1.5 * Math.PI) / 180)) - truth)).toBeLessThanOrEqual(
			0.6
		);
		// The plain ink bottom is the lower foot, more than a pixel off
		expect(g.bottom - truth).toBeGreaterThan(1);
	});
});

describe('the body bottom of a letter with a tail', () => {
	it('halfWidthBottom is the literal rule: the lowest row where the ink spans half the width', () => {
		// p: the stem hangs below a bowl as wide as the letter, so the rule finds the bowl
		const p = drawLetter('p');
		expect(halfWidthBottom(p)).toBeGreaterThanOrEqual(BASE_EDGE - 2);
		expect(halfWidthBottom(p)).toBeLessThanOrEqual(BASE_EDGE + 1);
		// A g whose tail hooks back as wide as its bowl fools it: it lands on the hook
		const g = drawLetter('g');
		expect(halfWidthBottom(g)).toBeGreaterThan(BASE_EDGE + 60);
		// A round Q bowl narrows before its bottom: the rule stops 7 % of the bowl too high
		const Q = drawLetter('Q');
		expect(BASE_EDGE - halfWidthBottom(Q)).toBeGreaterThan(10);
		expect(halfWidthBottom(boxPart('x', 0, 0, 10, 10))).toBe(null);
	});

	it('counterBottom finds the bowl from its hole: g, p, Q land on the writing line', () => {
		for (const char of ['g', 'p', 'Q']) {
			const bottom = counterBottom(drawLetter(char));
			expect(Math.abs(bottom - BASE_EDGE), char).toBeLessThanOrEqual(1);
		}
	});

	it('counterBottom ignores letters with no bowl near the top', () => {
		expect(counterBottom(drawLetter('f', { tail: true }))).toBe(null);
		expect(counterBottom(drawLetter('j'))).toBe(null);
		expect(counterBottom(drawLetter('y'))).toBe(null);
		expect(counterBottom(drawLetter(','))).toBe(null);
		expect(counterBottom(boxPart('x', 0, 0, 10, 10))).toBe(null);
	});

	it('a bowl hole is used whoever named the scale', () => {
		const g = drawLetter('g');
		const targets = lineTargets('g', FONT);
		expect(bodyBottom(g, targets, { scale: 9, fromOthers: true })).toMatchObject({
			from: 'counter',
		});
		expect(bodyBottom(g, targets, {})).toMatchObject({ from: 'counter' });
		expect(Math.abs(bodyBottom(g, targets, {}).px - BASE_EDGE)).toBeLessThanOrEqual(1);
	});

	it('alone in its photo, a letter with no bowl splits at the tail line share of its height', () => {
		const f = drawLetter('f', { tail: true });
		const geo = partGeometry(f);
		const targets = lineTargets('f', FONT, { tail: true });
		const result = bodyBottom(f, targets, {});
		const share = targets.top / (targets.top - targets.tailBottom);
		expect(result.from).toBe('span');
		expect(result.px).toBeCloseTo(geo.top + geo.height * share, 6);
	});

	it('with a scale from other letters, a letter with no bowl uses that scale from its top', () => {
		const f = drawLetter('f', { tail: true });
		const geo = partGeometry(f);
		const targets = lineTargets('f', FONT, { tail: true });
		// Scale set so the f's real body (top to the writing line, 300 px) is 1550 units
		const scale = 1550 / (300 - geo.top);
		const result = bodyBottom(f, targets, { scale, fromOthers: true });
		expect(result.from).toBe('scale');
		expect(result.px).toBeCloseTo(300, 6);
	});

	it("the literal rule's answer is kept when it agrees with the scale, dropped when not", () => {
		const comma = drawLetter(',');
		const geo = partGeometry(comma);
		const targets = lineTargets(',', FONT);
		const hw = halfWidthBottom(comma);
		const scale = targets.top / (hw - geo.top);
		expect(bodyBottom(comma, targets, { scale: scale * 1.05, fromOthers: true })).toEqual({
			px: hw,
			from: 'width',
		});
		expect(bodyBottom(comma, targets, { scale: scale * 2, fromOthers: true }).from).toBe('scale');
	});

	it("in a row, a letter with no bowl takes its body bottom from the row's line", () => {
		const f = drawLetter('f', { tail: true });
		const targets = lineTargets('f', FONT, { tail: true });
		expect(bodyBottom(f, targets, { linePx: 300, scale: 9, fromOthers: true })).toEqual({
			px: 300,
			from: 'row',
		});
		// A bowl that agrees with the line still wins; one further off than 4 % of the body
		// gives way to it (B3 finalize: a handwritten bowl often closes above the line); a line
		// outside the letter is no use
		expect(bodyBottom(drawLetter('g'), lineTargets('g', FONT), { linePx: 302 }).from).toBe(
			'counter'
		);
		expect(bodyBottom(drawLetter('g'), lineTargets('g', FONT), { linePx: 290 })).toEqual({
			px: 290,
			from: 'row',
		});
		expect(bodyBottom(f, targets, { linePx: 20 }).from).toBe('span');
	});

	it('a letter without its tail on sits on its ink bottom, held square at the slope given', () => {
		const a = drawLetter('a');
		expect(bodyBottom(a, lineTargets('a', FONT), { slope: 0.02 })).toEqual({
			px: levelBottom(a, 0.02),
			from: 'ink',
		});
	});

	it('a letter without its tail on sits on its ink bottom', () => {
		const a = drawLetter('a');
		expect(bodyBottom(a, lineTargets('a', FONT), {})).toEqual({
			px: partGeometry(a).bottom,
			from: 'ink',
		});
		const g = drawLetter('g');
		expect(bodyBottom(g, lineTargets('g', FONT, { tail: false }), {}).px).toBe(
			partGeometry(g).bottom
		);
	});
});

describe('guessTail for Q, J and f', () => {
	it('letters that always or never have a tail are not guessed', () => {
		expect(guessTail(drawLetter('g'), 'g', FONT, {})).toBe(true);
		expect(guessTail(drawLetter('a'), 'a', FONT, {})).toBe(false);
	});

	it('a Q whose tail dips under its bowl has one; a Q with its tail inside does not', () => {
		expect(guessTail(drawLetter('Q', { tail: true }), 'Q', FONT, {})).toBe(true);
		expect(guessTail(drawLetter('Q', { tail: false }), 'Q', FONT, {})).toBe(false);
	});

	it('an f that drops below the row line has a tail; one standing on it does not', () => {
		const dropping = drawLetter('f', { tail: true });
		const standing = drawLetter('f', { tail: false });
		expect(guessTail(dropping, 'f', FONT, { linePx: 300 })).toBe(true);
		expect(guessTail(standing, 'f', FONT, { linePx: partGeometry(standing).bottom })).toBe(false);
	});

	it('with a scale from other letters, a dropping f has a tail and a standing f has none', () => {
		const standing = drawLetter('f', { tail: false });
		const scale = 1550 / partGeometry(standing).height;
		expect(guessTail(standing, 'f', FONT, { scale })).toBe(false);
		expect(guessTail(drawLetter('f', { tail: true }), 'f', FONT, { scale })).toBe(true);
	});

	it('an f alone, with nothing to compare, has no tail until he says so', () => {
		expect(guessTail(drawLetter('f', { tail: true }), 'f', FONT, {})).toBe(false);
	});
});

describe('seatTraceY: where the photo top goes so the part lands on its lines', () => {
	const part = boxPart('x', 10, 100, 50, 200);
	const s = 5;

	it('bottom seat: the body bottom goes on the class bottom (round letters 1.5 % under)', () => {
		expect(seatTraceY(part, lineTargets('a', FONT), { bodyBottomPx: 200, scale: s })).toEqual({
			y: 1000,
			seat: 'bottom',
		});
		expect(seatTraceY(part, lineTargets('o', FONT), { bodyBottomPx: 200, scale: s }).y).toBeCloseTo(
			1000 - 30.72,
			6
		);
	});

	it('top seat: the apostrophe hangs from the capitals line', () => {
		expect(seatTraceY(part, lineTargets("'", FONT), { scale: s })).toEqual({
			y: 1480 + 500,
			seat: 'top',
		});
	});

	it('center seat: the hyphen is centered on half the small-letter height', () => {
		expect(seatTraceY(part, lineTargets('-', FONT), { scale: s })).toEqual({
			y: 550 + 750,
			seat: 'center',
		});
	});
});
