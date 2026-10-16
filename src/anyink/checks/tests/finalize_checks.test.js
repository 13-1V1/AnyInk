// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize, through the app's checks cache and the real fixes (UX-BEGINNER.md 4.2,
// 7.2; principle 6: a fix button never does nothing, and the fixes offered never turn a letter
// into a broken one marked Ready). The cases the hostile pass left open, each pressed through
// every green button offered until the letter is Ready. Written to fail on the code before the
// finalize:
//   - a lifted y: Sit on the line seated a half-width row half way up its V and sank it; a y
//     written as a u with a tail moved the wrong way, then could not move;
//   - a Brush p (a stem and a bump) and a Brush q (a c and a stem) lifted: never "floats";
//   - a j lifted 250: Ready; a g, p or y written low: Ready (tails never sank);
//   - Match size on a lifted, too-big g left it floating;
//   - a comma written as a slash all under the line: Ready;
//   - a double tap, or two taps one over the other, beside n: Ready; a default-nib tap beside
//     a fine pen's n: Ready;
//   - a Capital I and a 1 of one stroke: "too narrow", and [Fit spacing] did nothing.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { brushSize, resetBrushForTests } from '../../nib/brush_size.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { checksSource, getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { CHECK, LINE_SHARE, measureLetter } from '../checks.js';
import { useNeedsALook } from '../fix_step.js';
import { runFixAction } from '../fixes.js';
import {
	AUTO,
	FONT,
	STROKE,
	brushInto,
	checksFont,
	letter,
	moved,
	penArc,
	penLine,
	plain,
	rect,
	scaled,
	shapesFor,
	slashComma,
	uTailY,
} from './letters.js';

let quiet = [];
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	resetBrushForTests();
	useNeedsALook(checksSource);
});
afterEach(() => {
	useNeedsALook(null);
	resetChecksCacheForTests();
	resetToastsForTests();
	quiet.forEach((spy) => spy.mockRestore());
	setModeForTests('all');
});

const TOLERANCE = LINE_SHARE * FONT.upm;
const LIFT = Math.round(0.1 * FONT.upm);
const X = FONT.xHeight;

function editorOn(project) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = project;
	editor.nav.page = 'Overview';
	return editor;
}

const look = (editor, char) => checksSource(letter(editor.project, char), { editor });
const ready = (editor, char) =>
	getChecksCache().state(editor, letter(editor.project, char)).ready;
const measures = (editor, char) => measureLetter(letter(editor.project, char), FONT);

/** Presses every fix offered, as rule 7 passes it, until Ready; each press must change it */
function pressUntilReady(editor, char, most = 4) {
	const presses = [];
	while (look(editor, char) && presses.length < most) {
		const first = look(editor, char);
		presses.push(`${first.id}:${first.fix}`);
		expect([char, presses.length, first.fix]).not.toEqual([char, presses.length, null]);
		const done = runFixAction({ char, check: first.id, ...first.args }, { editor });
		expect([char, presses.at(-1), done]).toEqual([char, presses.at(-1), true]);
	}
	expect([char, look(editor, char)]).toEqual([char, null]);
	return presses;
}

/** A font with one letter drawn with the Brush (pen paths), the rest plain, spaced by B3 */
function brushEditor(char, strokes, { others = 'Hnoae', size } = {}) {
	const font = checksFont({ ...plain(others), [char]: { shapes: [], anyink: { ...AUTO } } });
	const item = letter(font, char);
	const nib = size ?? brushSize(font);
	strokes.forEach((points) => brushInto(item, points, nib));
	fitAllAutomatic(font);
	return editorOn(font);
}

describe('y lifted off the line: every fix offered puts its joint on the line', () => {
	it.each([
		['the fixture y (a V and a long arm)', () => shapesFor('y'), 205],
		['the fixture y, 440 up', () => shapesFor('y'), 440],
		['a y written as a u with a tail', () => uTailY(), 205],
		['a u-tailed y, 440 up', () => uTailY(), 440],
	])('%s', (_name, draw, lift) => {
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), y: { shapes: moved(draw(), 0, lift), anyink: { ...AUTO } } })
		);
		const presses = pressUntilReady(editor, 'y');
		expect(presses[0]).toBe(`${CHECK.offLine}:sitOnLine`);
		const { body, ink } = measures(editor, 'y');
		expect(Math.abs(body.bottom)).toBeLessThanOrEqual(TOLERANCE + STROKE);
		// its top on the small-letter line, not sunk under it, and its tail no deeper than a
		// tail is (the old fixes left one at -1,506)
		expect(Math.abs(ink.yMax - X)).toBeLessThanOrEqual(0.25 * X);
		expect(ink.yMin).toBeGreaterThan(1.25 * FONT.descent);
	});

	it('a Brush y drawn 205 high: one Sit on the line, the arms on the line, the top at the line', () => {
		const editor = brushEditor('y', [
			penLine([200, X + 205], [450, 205]),
			penLine([700, X + 205], [300, -400 + 205]),
		]);
		expect(look(editor, 'y')).toMatchObject({ id: CHECK.offLine, fix: 'sitOnLine' });
		pressUntilReady(editor, 'y');
		const { ink } = measures(editor, 'y');
		expect(Math.abs(ink.yMax - X)).toBeLessThanOrEqual(0.15 * X);
	});
});

describe('tail letters: bowls of two Brush strokes, a lifted j, letters written low', () => {
	const stemAndBump = (dy) => [
		penLine([200, X + dy], [200, -400 + dy]),
		[...penLine([200, X - 60 + dy], [450, X - 60 + dy]), ...penArc(450, X / 2 + dy, X / 2 - 60, 90, -90).slice(1), ...penLine([450, 60 + dy], [200, 60 + dy]).slice(1)],
	];
	const cAndStem = (dy) => [
		penArc(500, X / 2 + dy, X / 2 - 60, 60, 300),
		penLine([800, X + dy], [800, -400 + dy]),
	];

	it.each([
		['a Brush p, a stem and a bump, 250 up', 'p', stemAndBump(250)],
		['a Brush q, a c and a stem, 205 up', 'q', cAndStem(205)],
	])('%s: floats, and Sit on the line puts the bowl on the line', (_name, char, strokes) => {
		const editor = brushEditor(char, strokes);
		expect(look(editor, char)).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		pressUntilReady(editor, char);
		expect(Math.abs(measures(editor, char).body.bottom)).toBeLessThanOrEqual(
			TOLERANCE + STROKE
		);
	});

	// B10 + B11 finalize, second pass (verifier: "a g, p or q whose bowl doesn't quite close
	// falls back to the ink bottom: the floating is missed and Match size leaves it floating").
	// Written to fail first: the bump stops short of the stem, no hole is found, the p read "too
	// tall" and Match size left its bowl about 200 units up
	const openBump = (dy, gap) => [
		penLine([200, X + dy], [200, -400 + dy]),
		[
			...penLine([200, X - 60 + dy], [450, X - 60 + dy]),
			...penArc(450, X / 2 + dy, X / 2 - 60, 90, -90).slice(1),
			...penLine([450, 60 + dy], [250 + gap + 50, 60 + dy]).slice(1),
		],
	];
	const openC = (dy, gap) => [
		penArc(500, X / 2 + dy, X / 2 - 60, 60, 300),
		penLine([800 + gap + 60, X + dy], [800 + gap + 60, -400 + dy]),
	];

	it.each([
		['a Brush p whose bump stops 8 short of the stem, 250 up', 'p', openBump(250, 8)],
		['a Brush p whose bump stops 30 short of the stem, 250 up', 'p', openBump(250, 30)],
		['a Brush q whose c stops short of the stem, 250 up', 'q', openC(250, 15)],
	])('%s: floats, and the fixes put the bowl on the line', (_name, char, strokes) => {
		const editor = brushEditor(char, strokes);
		expect(look(editor, char)).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		pressUntilReady(editor, char);
		expect(Math.abs(measures(editor, char).body.bottom)).toBeLessThanOrEqual(
			TOLERANCE + STROKE
		);
	});

	it('the open p and q on the line: no check', () => {
		expect(look(brushEditor('p', openBump(0, 8)), 'p')).toBeNull();
		expect(look(brushEditor('q', openC(0, 15)), 'q')).toBeNull();
	});

	it('the same p and q on the line: no check', () => {
		expect(look(brushEditor('p', stemAndBump(0)), 'p')).toBeNull();
		expect(look(brushEditor('q', cAndStem(0)), 'q')).toBeNull();
	});

	it.each([250, 350])('a j lifted %i: floats; Sit on the line puts its stem top on the line', (lift) => {
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), j: { shapes: moved(shapesFor('j'), 0, lift), anyink: { ...AUTO } } })
		);
		expect(look(editor, 'j')).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		pressUntilReady(editor, 'j');
		expect(Math.abs(measures(editor, 'j').body.top - X)).toBeLessThanOrEqual(TOLERANCE + STROKE);
	});

	it('a j as written, its hook down past the line: no check', () => {
		const editor = editorOn(checksFont(plain('Hnoaej')));
		expect(look(editor, 'j')).toBeNull();
	});

	it.each([
		['g', 205],
		['g', 300],
		['y', 205],
	])('%s written %i low sinks; the fixes put it back on the line', (char, drop) => {
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), [char]: { shapes: moved(shapesFor(char), 0, -drop), anyink: { ...AUTO } } })
		);
		expect(look(editor, char)).toMatchObject({ id: CHECK.offLine, args: { way: 'below' } });
		pressUntilReady(editor, char);
		expect(Math.abs(measures(editor, char).body.bottom)).toBeLessThanOrEqual(TOLERANCE + STROKE);
	});

	it('Match size seats a tail letter too: a g 1.5 times too big and lifted ends on the line', () => {
		const g = scaled(shapesFor('g'), 1.5, 100, 0);
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), g: { shapes: moved(g, 0, 60), anyink: { ...AUTO } } })
		);
		pressUntilReady(editor, 'g');
		const { body, size } = measures(editor, 'g');
		expect(Math.abs(body.bottom)).toBeLessThanOrEqual(TOLERANCE + STROKE);
		expect(size).toBeGreaterThan(0.75);
		expect(size).toBeLessThan(1.25);
	});
});

describe('a comma written as a slash, all of it under the line', () => {
	it.each([-150, -300])('top at %i: sinks, and Sit on the line puts its top over the line', (top) => {
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), ',': { shapes: slashComma(100, top), anyink: { ...AUTO } } })
		);
		expect(look(editor, ',')).toMatchObject({ id: CHECK.offLine, args: { way: 'below' } });
		pressUntilReady(editor, ',');
		const { ink } = measures(editor, ',');
		expect(ink.yMax).toBeGreaterThan(0);
		expect(ink.yMin).toBeLessThan(0);
	});
});

describe('dots of the pen beside n (Brush taps)', () => {
	const n = [
		penLine([200, X], [200, 0]),
		[...penArc(450, X - 250, 250, 180, 0), ...penLine([700, X - 250], [700, 0]).slice(1)],
	];
	const tap = (x, y) => [
		[x, y],
		[x + 1, y + 1],
	];

	it('a double tap (two dots that touch): Remove 2 specks, then Ready', () => {
		const editor = brushEditor('n', [...n, tap(960, 40), tap(1015, 70)]);
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.specks, args: { count: 2 } });
		pressUntilReady(editor, 'n');
		expect(letter(editor.project, 'n').shapes).toHaveLength(2);
	});

	it('two taps one over the other beside the foot: both are specks', () => {
		const editor = brushEditor('n', [...n, tap(960, 40), tap(960, 400)]);
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.specks, args: { count: 2 } });
	});

	it("a default-nib tap beside an n written with a fine pen (40 units) is a speck", () => {
		const fine = editorOn(checksFont({ ...plain('Hoae'), n: { shapes: [], anyink: { ...AUTO } } }));
		const item = letter(fine.project, 'n');
		n.forEach((points) => brushInto(item, points, 40));
		brushInto(item, tap(960, 40), brushSize(fine.project));
		fitAllAutomatic(fine.project);
		resetChecksCacheForTests();
		expect(look(fine, 'n')).toMatchObject({ id: CHECK.specks, args: { count: 1 } });
	});

	it('a tap straight over the n (B11: over or under the letter is no speck) stays', () => {
		const editor = brushEditor('n', [...n, tap(450, X + 250)]);
		expect(look(editor, 'n')).toBeNull();
	});
});

describe('narrow letters of one stroke', () => {
	it('a Capital I and a 1 drawn as one Brush stroke are Ready, never "too narrow"', () => {
		expect(look(brushEditor('I', [penLine([300, FONT.capHeight], [300, 0])]), 'I')).toBeNull();
		expect(look(brushEditor('1', [penLine([300, FONT.capHeight], [300, 0])]), '1')).toBeNull();
	});

	it('an automatic letter already at its fit never offers [Fit spacing] for its width', () => {
		// an h written as a lone stem: narrow for its line, and spacing can't make it wider
		const editor = editorOn(
			checksFont({ ...plain('Hnoae'), h: [rect(100, 0, 100 + STROKE, FONT.ascent)] })
		);
		expect(look(editor, 'h')).toBeNull();
		expect(ready(editor, 'h')).toBe(true);
	});

	it('a letter whose width he set narrow is offered [Fit spacing], and one press clears it', () => {
		const editor = editorOn(
			checksFont({
				...plain('Hnoae'),
				m: { shapes: shapesFor('n'), advanceWidth: 120, anyink: { spacing: 'manual' } },
			}, { fit: false })
		);
		fitAllAutomatic(editor.project);
		const ids = getChecksCache()
			.state(editor, letter(editor.project, 'm'))
			.checks.map((check) => check.id);
		expect(ids).toContain(CHECK.width);
		expect(look(editor, 'm')).toMatchObject({ fix: 'fitSpacing' });
		expect(pressUntilReady(editor, 'm')).toHaveLength(1);
	});
});

// B10 + B11 finalize, second pass (verifier's new problem "fixed Brush letters sit half a nib
// higher"): the fixes seat the line the pen drew, so a fixed Brush letter sits where one drawn
// to the line does. Written to fail first: Sit on the line and Match size put the ink's bottom
// on the line, half a nib above a letter drawn to it. The check stays: it floats by its ink
// (ink touching the line is on it), sinks by its pen line (D-043)
describe('Brush letters: the fixes seat the pen line', () => {
	const stemN = (dy) => [
		penLine([200, X + dy], [200, dy]),
		[...penLine([200, X - 150 + dy], [450, X + dy]), ...penLine([450, X + dy], [600, dy]).slice(1)],
	];
	const penBottomOf = (editor, char) => measures(editor, char).penBottom;

	it('a pen line 150 up floats; Sit on the line puts the pen line on the writing line', () => {
		const editor = brushEditor('n', stemN(150));
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.offLine, args: { way: 'above' } });
		pressUntilReady(editor, 'n');
		expect(Math.abs(penBottomOf(editor, 'n'))).toBeLessThanOrEqual(2);
	});

	it('a pen line 120 under sinks; the fix puts the pen line (not the ink) on the line', () => {
		const editor = brushEditor('n', stemN(-120));
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.offLine, args: { way: 'below' } });
		pressUntilReady(editor, 'n');
		expect(Math.abs(penBottomOf(editor, 'n'))).toBeLessThanOrEqual(2);
		expect(measures(editor, 'n').ink.yMin).toBeLessThan(-20);
	});

	it('Match size on a Brush n drawn 1.5 times too tall ends with its pen line on the line', () => {
		const tall = [
			penLine([200, 1.5 * X], [200, 0]),
			[...penLine([200, 1.5 * X - 200], [450, 1.5 * X]), ...penLine([450, 1.5 * X], [600, 0]).slice(1)],
		];
		const editor = brushEditor('n', tall);
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.size });
		pressUntilReady(editor, 'n');
		expect(Math.abs(penBottomOf(editor, 'n'))).toBeLessThanOrEqual(2);
	});

	it('drawn to the line: Ready; a pen line within 2 % of the box either way: Ready', () => {
		expect(look(brushEditor('n', stemN(0)), 'n')).toBeNull();
		expect(look(brushEditor('n', stemN(30)), 'n')).toBeNull();
		expect(look(brushEditor('n', stemN(-30)), 'n')).toBeNull();
		// its round end touching the line (the pen 60 up): on it
		expect(look(brushEditor('n', stemN(60)), 'n')).toBeNull();
	});
});
