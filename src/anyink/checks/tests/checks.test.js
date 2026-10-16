// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 checks (UX-BEGINNER.md 4.2, 7.2, section 10 B11): every check on letters spaced by B3's own
// fitter, at the default grid (2,048 units, so 1 % of the letter box is 20.48 units). The letters
// a beginner's hand makes that must never be flagged (i, j, !, ., ', a dotted i, a felt-tip i
// dot, a long g tail, a Q tail, a comma, a colon), each problem on its own with its reason and
// fix, the thresholds on both sides of each limit, and the order the problems come in.
import { describe, expect, it } from 'vitest';
import { shearShapes } from '../../spacing/tests/fixtures.js';
import {
	CHECK,
	CHECK_ORDER,
	FIX,
	FONT_INK_NO_WIDTH,
	POKES_IS_NOTE,
	checkFont,
	checkLetter,
	findChecks,
	measureLetter,
	orderChecks,
} from '../checks.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import {
	FONT,
	STROKE,
	checksFont,
	comma,
	feltTipI,
	hookedJ,
	letter,
	longTailG,
	moved,
	plain,
	rect,
	scaled,
	shapesFor,
	speck,
	tailedQ,
} from './letters.js';

const BOX = FONT.upm;
const pct = (share) => Math.round(share * BOX);

/** The checks on one letter of a font, by id */
function idsOf(project, char, extra = {}) {
	const item = letter(project, char);
	return checkLetter(item, { font: project.settings.font, ...extra }).map((check) => check.id);
}

/** One letter alone in a font, spaced */
function one(char, shapes, options) {
	return checksFont({ [char]: shapes ?? shapesFor(char) }, options);
}

describe('letters a beginner writes that are never flagged', () => {
	it.each([
		['i', shapesFor('i')],
		['j', hookedJ()],
		['!', shapesFor('!')],
		['.', shapesFor('.')],
		["'", shapesFor("'")],
		[',', comma()],
		[':', shapesFor(':')],
		[';', shapesFor(';')],
		['?', shapesFor('?')],
	])('%s: no check at all (no specks, never too narrow)', (char, shapes) => {
		const project = one(char, shapes);
		expect(idsOf(project, char)).toEqual([]);
	});

	it('a dotted i whose dot drifted to the side, and a felt-tip i dot (wider, low, drifted)', () => {
		const project = checksFont({ i: feltTipI(100, 90) });
		expect(idsOf(project, 'i')).toEqual([]);
		const drifted = checksFont({ i: shapesFor('i').map((s, n) => (n ? moved([s], 150)[0] : s)) });
		expect(idsOf(drifted, 'i')).toEqual([]);
	});

	it('a tiny i dot (smaller than a speck) is still never a speck, nor a j dot', () => {
		const w = STROKE;
		const tinyDot = speck(100 + w / 2 - 15, FONT.xHeight + w * 1.5, 30);
		const i = [rect(100, 0, 100 + w, FONT.xHeight), tinyDot];
		const j = [...hookedJ().slice(0, 2), speck(100 + w + 60, FONT.xHeight + w * 1.5, 30)];
		const project = checksFont({ i, j });
		expect(idsOf(project, 'i')).toEqual([]);
		expect(idsOf(project, 'j')).toEqual([]);
	});

	it('a long g tail (down to the tail line, hooking left past the bowl) is not flagged', () => {
		const project = one('g', longTailG(100, 220));
		expect(idsOf(project, 'g')).toEqual([]);
		// even spaced by hand, so the hook hangs far past the left edge: tails may hang
		const item = letter(project, 'g');
		item.anyink.spacing = 'manual';
		item.advanceWidth = Math.round(item.advanceWidth * 0.6);
		expect(idsOf(project, 'g')).not.toContain(CHECK.hangs);
	});

	it.each([0.02, 0.04, 0.1, 0.2])(
		'a Q whose tail hangs %f of the letter box under the line sits on its bowl',
		(drop) => {
			const project = one('Q', tailedQ(100, drop));
			expect(idsOf(project, 'Q')).toEqual([]);
		}
	);

	it('a round letter dipping its 1.5 % under the writing line is on the line', () => {
		const project = checksFont(plain('oe'));
		expect(idsOf(project, 'o')).toEqual([]);
		expect(idsOf(project, 'e')).toEqual([]);
	});

	it('a plain set of letters spaced by B3 has no check', () => {
		const project = checksFont(plain('HnorvAtlfiy'));
		['H', 'n', 'o', 'r', 'v', 'A', 't', 'l', 'f', 'i', 'y'].forEach((char) =>
			expect([char, idsOf(project, char)]).toEqual([char, []])
		);
	});
});

describe('ink with no width', () => {
	it('flags ink whose width rounds to 0, with Fit spacing, said once with the font check', () => {
		const project = one('n', null, { fit: false });
		const item = letter(project, 'n');
		const problems = [
			{ itemId: item.id, problem: FONT_INK_NO_WIDTH, message: 'small n has ink but no width' },
		];
		const checks = checkLetter(item, { font: project.settings.font, fontProblems: problems });
		expect(checks.map((c) => c.id)).toEqual([CHECK.inkNoWidth]);
		expect(checks[0].fix).toBe(FIX.fitSpacing);
		expect(checks[0].reason).toMatch(/^small n has ink but no width/);
		expect(FONT_INK_NO_WIDTH).toBe(PROBLEM.inkNoWidth);
	});
});

describe('the font file (B1)', () => {
	it("names the font check's problem with its own sentence and Fix it", () => {
		const project = checksFont(plain('n'));
		const item = letter(project, 'n');
		const problems = [
			{ itemId: 'glyph-0x41', problem: 'shape-points', message: 'Capital A has a shape...' },
			{
				itemId: item.id,
				problem: 'width-range',
				message: 'small n is wider than the font file can hold.',
			},
		];
		const checks = checkLetter(item, { font: project.settings.font, fontProblems: problems });
		expect(checks).toHaveLength(1);
		expect(checks[0]).toMatchObject({
			id: CHECK.fontFile,
			fix: FIX.fixIt,
			reason: 'small n is wider than the font file can hold.',
			action: 'fixLetter',
		});
		expect(checks[0].fixLabel).toBeTruthy();
	});
});

describe('specks', () => {
	it('flags pieces smaller than a quarter of the stroke squared beside the letter', () => {
		const shapes = [...shapesFor('n'), speck(1400, 500, 20), speck(-300, 200, 25)];
		const project = one('n', shapes);
		const checks = checkLetter(letter(project, 'n'), { font: FONT });
		expect(checks[0]).toMatchObject({ id: CHECK.specks, fix: FIX.removeSpecks });
		expect(checks[0].args.count).toBe(2);
		expect(checks[0].reason).toBe('small n has 2 specks of stray ink.');
	});

	it('a piece just over the limit is not a speck; just under is', () => {
		// a dash three times as long as it is tall: no dot of the pen (that rule is below)
		const stroke = measureLetter(letter(one('n'), 'n'), FONT).stroke;
		const limit = 0.25 * stroke * stroke;
		const tall = Math.sqrt(limit / 3);
		const dash = (h) => rect(1400, 500, 1400 + 3 * h, 500 + h);
		const over = one('n', [...shapesFor('n'), dash(tall + 1)]);
		const under = one('n', [...shapesFor('n'), dash(tall - 1)]);
		expect(idsOf(over, 'n')).not.toContain(CHECK.specks);
		expect(idsOf(under, 'n')).toContain(CHECK.specks);
	});

	it('a small piece directly above or below another piece is not a speck (an accent, a dot)', () => {
		const n = shapesFor('n');
		const project = one('n', [...n, speck(300, FONT.xHeight + 200, 25)]);
		expect(idsOf(project, 'n')).not.toContain(CHECK.specks);
	});

	it('a speck inside a hole is a speck (beside the ink around it, not above it)', () => {
		const project = one('o', [...shapesFor('o'), speck(560, 540, 20)]);
		expect(idsOf(project, 'o')).toContain(CHECK.specks);
	});

	it('specks do not move the body: a speck under the letter is a speck, not a sinking letter', () => {
		const project = one('n', [...shapesFor('n'), speck(1500, -300, 20)]);
		expect(idsOf(project, 'n')).toEqual([CHECK.specks]);
	});
});

describe('the writing line', () => {
	const tolerance = pct(0.02);

	it.each([
		['floats', tolerance + 4, 'above', 'floats above the writing line'],
		['sinks', -tolerance - 4, 'below', 'sinks below the writing line'],
	])('a letter that %s more than 2 %% gets Sit on the line', (_name, dy, way, short) => {
		const project = one('n', moved(shapesFor('n'), 0, dy));
		const checks = checkLetter(letter(project, 'n'), { font: FONT });
		expect(checks.map((c) => c.id)).toEqual([CHECK.offLine]);
		expect(checks[0]).toMatchObject({ fix: FIX.sitOnLine, short, args: { way } });
		expect(checks[0].reason).toBe(`small n ${short}.`);
	});

	it('within 2 % either way is on the line', () => {
		[tolerance - 4, -(tolerance - 4)].forEach((dy) => {
			const project = one('n', moved(shapesFor('n'), 0, dy));
			expect(idsOf(project, 'n')).toEqual([]);
		});
	});

	it('a round letter may dip its 1.5 % plus 2 % under the line, but not float 2 %', () => {
		const dip = -(pct(0.015) + tolerance) + 3;
		expect(idsOf(one('o', moved(shapesFor('o'), 0, dip)), 'o')).toEqual([]);
		expect(idsOf(one('o', moved(shapesFor('o'), 0, dip - 8)), 'o')).toContain(CHECK.offLine);
		expect(idsOf(one('o', moved(shapesFor('o'), 0, tolerance + 4)), 'o')).toContain(CHECK.offLine);
	});

	it('tails hang by design: j, and J f once their tail hangs, never sink', () => {
		// (B10 + B11 fix pass: they float; B10 + B11 finalize: a g p q y, judged by its bowl or
		// its joint, sinks when written low: fixpass_checks.test.js and finalize_checks.test.js)
		const j = one('j', moved(hookedJ(), 0, -200));
		expect(idsOf(j, 'j')).not.toContain(CHECK.offLine);
		const f = one('f', [...shapesFor('f'), rect(100, -400, 100 + STROKE, 0)]);
		expect(idsOf(f, 'f')).not.toContain(CHECK.offLine);
	});

	it('an f with no tail is still checked', () => {
		const f = one('f', moved(shapesFor('f'), 0, 120));
		expect(idsOf(f, 'f')).toContain(CHECK.offLine);
	});

	it('a J or f whose short hook dips under the line (less than 5 %) never sinks', () => {
		const hook = (dip) => [
			rect(500, 0, 500 + STROKE, FONT.capHeight),
			rect(100, -dip, 500 + STROKE, -dip + STROKE),
		];
		[pct(0.03), pct(0.045)].forEach((dip) => {
			expect(idsOf(one('J', hook(dip)), 'J')).not.toContain(CHECK.offLine);
		});
		// floating is still floating
		expect(idsOf(one('J', moved(hook(pct(0.03)), 0, 200)), 'J')).toContain(CHECK.offLine);
		// the same dip on a letter with no tail: it sinks
		expect(idsOf(one('L', hook(pct(0.045))), 'L')).toContain(CHECK.offLine);
	});

	it('punctuation: only . and , (a floating apostrophe is where it belongs)', () => {
		expect(idsOf(one('.', moved(shapesFor('.'), 0, 200)), '.')).toContain(CHECK.offLine);
		expect(idsOf(one('!', moved(shapesFor('!'), 0, 200)), '!')).not.toContain(CHECK.offLine);
		expect(idsOf(one('-', moved(shapesFor('-'), 0, 200)), '-')).not.toContain(CHECK.offLine);
	});

	it('a comma floats when all of it is above the line, sinks when its head is under it', () => {
		expect(idsOf(one(',', comma(100, 0)), ',')).toEqual([]);
		const up = checkLetter(letter(one(',', comma(100, 400)), ','), { font: FONT });
		expect(up[0]).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		expect(up[0].reason).toBe('The comma floats above the writing line.');
		const down = checkLetter(letter(one(',', comma(100, -200)), ','), { font: FONT });
		expect(down[0]).toMatchObject({ id: CHECK.offLine, args: { way: 'below' } });
	});

	it('numbers sit on the line too', () => {
		const project = one('7', moved([rect(100, 0, 700, FONT.capHeight)], 0, 200));
		expect(idsOf(project, '7')).toContain(CHECK.offLine);
	});
});

describe('size against its line', () => {
	it('more than 25 % taller or shorter than its line', () => {
		const tall = one('n', scaled(shapesFor('n'), 1.3));
		const short = one('n', scaled(shapesFor('n'), 0.7));
		const near = one('n', scaled(shapesFor('n'), 1.2));
		const tallChecks = checkLetter(letter(tall, 'n'), { font: FONT });
		expect(tallChecks[0]).toMatchObject({
			id: CHECK.size,
			fix: FIX.matchSize,
			args: { way: 'big', line: 'xHeight' },
		});
		expect(tallChecks[0].reason).toBe('small n is too tall for the small-letter line.');
		const shortChecks = checkLetter(letter(short, 'n'), { font: FONT });
		expect(shortChecks[0]).toMatchObject({ id: CHECK.size, args: { way: 'small' } });
		expect(shortChecks[0].reason).toBe('small n is too short for the small-letter line.');
		expect(idsOf(near, 'n')).toEqual([]);
	});

	it('the i and j dots are not part of the body', () => {
		const high = [rect(100, 0, 100 + STROKE, FONT.xHeight), speck(100, FONT.ascent - 140, 130)];
		expect(idsOf(one('i', high), 'i')).toEqual([]);
	});

	it('tall letters by the top line, t halfway, capitals and numbers by the capitals line', () => {
		const project = checksFont({
			l: scaled(shapesFor('l'), 1.3),
			t: scaled(shapesFor('t'), 0.7),
			B: scaled(shapesFor('B'), 1.3),
		});
		const reasons = ['l', 't', 'B'].map(
			(char) => checkLetter(letter(project, char), { font: FONT })[0]?.reason
		);
		expect(reasons).toEqual([
			'small l is too tall for the top line.',
			'small t is too short for its guide lines.',
			'Capital B is too tall for the capitals line.',
		]);
	});

	it('a tail letter is sized by its body, the tail left out', () => {
		expect(idsOf(one('g', longTailG()), 'g')).not.toContain(CHECK.size);
		expect(idsOf(one('y', shapesFor('y')), 'y')).not.toContain(CHECK.size);
	});

	it('two or more letters on one line off the same way: Move the line to fit your writing', () => {
		const project = checksFont({
			n: scaled(shapesFor('n'), 1.35),
			o: scaled(shapesFor('o'), 1.35),
			r: scaled(shapesFor('r'), 0.7),
			B: scaled(shapesFor('B'), 1.4),
		});
		const all = checkFont(project);
		const fixOf = (char) => all.get(letter(project, char).id).find((c) => c.id === CHECK.size)?.fix;
		expect(fixOf('n')).toBe(FIX.moveLine);
		expect(fixOf('o')).toBe(FIX.moveLine);
		expect(fixOf('r')).toBe(FIX.matchSize); // off the other way
		expect(fixOf('B')).toBe(FIX.matchSize); // alone on the capitals line
		const n = all.get(letter(project, 'n').id)[0];
		expect(n.args).toMatchObject({ fix: FIX.moveLine, line: 'xHeight', way: 'big' });
	});
});

describe('pokes past the top or tail line', () => {
	it('is a soft note, not a check: the font file makes room for it (POKES_IS_NOTE)', () => {
		expect(POKES_IS_NOTE).toBe(true);
		const reach = pct(0.05);
		const up = one('l', [rect(100, 0, 100 + STROKE, FONT.ascent + reach + 6)]);
		expect(idsOf(up, 'l')).toEqual([]);
		expect(measureLetter(letter(up, 'l'), FONT).pokes).toBe('top');
		const ok = one('l', [rect(100, 0, 100 + STROKE, FONT.ascent + reach - 6)]);
		expect(measureLetter(letter(ok, 'l'), FONT).pokes).toBeNull();
		const both = one('l', [
			rect(100, FONT.descent - reach - 9, 100 + STROKE, FONT.ascent + reach + 9),
		]);
		expect(measureLetter(letter(both, 'l'), FONT).pokes).toBe('both');
	});

	it('as a check: more than 5 % above the top line or below the tail line, Shrink to fit', () => {
		const reach = pct(0.05);
		const up = one('l', [rect(100, 0, 100 + STROKE, FONT.ascent + reach + 6)]);
		const ok = one('l', [rect(100, 0, 100 + STROKE, FONT.ascent + reach - 6)]);
		const asCheck = { pokesAsNote: false };
		const checks = checkLetter(letter(up, 'l'), { font: FONT, ...asCheck });
		expect(checks.map((c) => c.id)).toEqual([CHECK.pokes]);
		expect(checks[0]).toMatchObject({ fix: FIX.shrinkToFit, args: { way: 'top' } });
		expect(checks[0].reason).toBe('small l pokes above the top line.');
		expect(idsOf(ok, 'l', asCheck)).toEqual([]);
		const down = one('g', [...longTailG(), rect(900, FONT.descent - reach - 10, 900 + STROKE, 0)]);
		expect(checkLetter(letter(down, 'g'), { font: FONT, ...asCheck })[0]).toMatchObject({
			id: CHECK.pokes,
			args: { way: 'tail' },
		});
	});
});

describe('hangs past its edges', () => {
	it('ink more than 5 % past an edge, set by hand; f, j and tails never', () => {
		const project = checksFont(plain('nfj'));
		['n', 'f', 'j'].forEach((char) => {
			const item = letter(project, char);
			item.anyink.spacing = 'manual';
			item.advanceWidth = Math.max(1, Math.round(item.advanceWidth * 0.4));
		});
		const n = checkLetter(letter(project, 'n'), { font: FONT });
		expect(n.map((c) => c.id)).toContain(CHECK.hangs);
		expect(n.find((c) => c.id === CHECK.hangs)).toMatchObject({
			fix: FIX.fitSpacing,
			args: { way: 'right' },
			reason: 'small n hangs past its edges, into the letters beside it.',
		});
		expect(idsOf(project, 'f')).not.toContain(CHECK.hangs);
		expect(idsOf(project, 'j')).not.toContain(CHECK.hangs);
	});

	it('a slanted hand, spaced in its slant, never hangs', () => {
		const lean = (char) => shearShapes(shapesFor(char), 14, FONT.xHeight / 2);
		const project = checksFont({ l: lean('l'), H: lean('H'), n: lean('n'), d: lean('d') });
		const all = checkFont(project);
		all.forEach((checks) => expect(checks.map((c) => c.id)).not.toContain(CHECK.hangs));
		// measured upright instead, the same l would reach past its right edge
		const l = letter(project, 'l');
		const upright = measureLetter(l, FONT, { slant: 0 });
		expect(upright.frame.xMax - l.advanceWidth).toBeGreaterThan(0.05 * BOX);
	});
});

describe('width outside the B3 limits', () => {
	it('too narrow (an n squeezed) and too wide; narrow letters never too narrow', () => {
		const thin = one('m', [rect(100, 0, 140, FONT.xHeight)]);
		expect(idsOf(thin, 'm')).toContain(CHECK.width);
		const thinChecks = checkLetter(letter(thin, 'm'), { font: FONT });
		expect(thinChecks.find((c) => c.id === CHECK.width)).toMatchObject({
			fix: FIX.fitSpacing,
			args: { way: 'narrow' },
			reason: 'small m is too narrow, so the letters beside it would crowd it.',
		});
		const l = one('l', [rect(100, 0, 110, FONT.ascent)]);
		expect(idsOf(l, 'l')).not.toContain(CHECK.width);
		const wide = one('w', [rect(100, 0, 100 + Math.round(BOX * 1.6), FONT.xHeight)]);
		expect(checkLetter(letter(wide, 'w'), { font: FONT }).map((c) => c.args.way)).toContain('wide');
	});
});

describe('order and shape of the results', () => {
	it('problems come in CHECK_ORDER, each { id, reason, short, fix, fixLabel, action, args }', () => {
		const shapes = moved(scaled([...shapesFor('n'), speck(1400, 500, 20)], 1.4), 0, 200);
		const project = one('n', shapes);
		const checks = checkLetter(letter(project, 'n'), { font: FONT });
		const ids = checks.map((c) => c.id);
		expect(ids).toEqual(CHECK_ORDER.filter((id) => ids.includes(id)));
		expect(ids.slice(0, 3)).toEqual([CHECK.specks, CHECK.offLine, CHECK.size]);
		checks.forEach((check) => {
			expect(Object.keys(check).sort()).toEqual(
				['action', 'args', 'fix', 'fixLabel', 'id', 'reason', 'short'].sort()
			);
			expect(check.args.fix).toBe(check.fix);
			expect(check.reason.startsWith('small n ')).toBe(true);
			expect(check.fixLabel).toBeTruthy();
		});
	});

	it('orderChecks sorts and keeps each id once', () => {
		const list = orderChecks([
			{ id: CHECK.width },
			{ id: CHECK.specks },
			{ id: CHECK.width },
			{ id: 'nope' },
		]);
		expect(list.map((c) => c.id)).toEqual([CHECK.specks, CHECK.width]);
	});

	it('a letter with no ink has no checks; findChecks needs measures', () => {
		const project = checksFont({ n: [] }, { fit: false });
		expect(checkLetter(letter(project, 'n'), { font: FONT })).toEqual([]);
		expect(findChecks(letter(project, 'n'), null, { font: FONT })).toEqual([]);
	});

	it('the checks change nothing in the letter', () => {
		const project = one('n', moved(scaled(shapesFor('n'), 1.4), 0, 200));
		const item = letter(project, 'n');
		const before = JSON.stringify(item.save());
		checkLetter(item, { font: FONT });
		checkFont(project);
		expect(JSON.stringify(item.save())).toBe(before);
	});

	it('checkFont gives every letter with ink, and leaves empty letters out', () => {
		const project = checksFont({ ...plain('no'), x: [] });
		const all = checkFont(project);
		const ids = [letter(project, 'n').id, letter(project, 'o').id];
		expect([...all.keys()].sort()).toEqual(ids.sort());
	});
});
