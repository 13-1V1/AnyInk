// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize, written to fail first:
//  - an outline that crosses itself (a figure 8 drawn in one go) is an overlap of its own: Use in
//    Word's font file holds it as plain outlines that don't cross (mergeOverlaps only joined
//    pairs, and a crossing outline with no area of its own was left out once anything else in
//    the letter overlapped);
//  - a font name with no plain (ASCII) letters still gets a PostScript name of its own: every
//    such name became "Test10-Regular" (or "Font-Regular").
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOptionsObject, ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { openProject, square } from '../../fontcheck/tests/fixtures.js';
import { crossesItself, hasOverlaps } from '../merge_overlaps.js';
import { brennanHandJSON } from './install_fixture.js';

/** A closed outline through these corners */
function loop(points, name = 'Loop') {
	return { name, pathPoints: points.map(([x, y]) => ({ p: { coord: { x, y } } })) };
}

/** A figure 8 (bow tie): its two halves turn opposite ways; lopsided, so it has an area */
const figure8 = () =>
	loop([
		[100, 0],
		[900, 600],
		[900, 0],
		[100, 300],
	]);
/** The same, even, so its two halves cancel out (no area as a whole) */
const evenFigure8 = () =>
	loop([
		[100, 0],
		[700, 600],
		[700, 0],
		[100, 600],
	]);

const OPTIONS = { omitEmptyLetters: true, addSpaceIfMissing: true };
const contoursOf = (font, char) =>
	font.glyphs.find((glyph) => glyph.unicode === char.charCodeAt(0))?.contours || [];

/** The corners of a FontFlux contour */
const cornersOf = (contour) => contour.filter((c) => 'x' in c).map((c) => [c.x, c.y]);

function openWith(shapesA) {
	const json = brennanHandJSON();
	json.glyphs['glyph-0x41'].shapes = shapesA;
	return openProject(json);
}

async function exported(options) {
	return FontFlux.open(await ioFont_exportFont('otf', true, { ...OPTIONS, ...options }));
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('an outline that crosses itself', () => {
	it('is told apart from one that does not', () => {
		expect(crossesItself([[100, 0], [900, 600], [900, 0], [100, 300]])).toBe(true);
		expect(crossesItself([[0, 0], [10, 0], [10, 10], [0, 10]])).toBe(false);
	});

	it('a figure 8 alone becomes two outlines that do not cross', async () => {
		openWith([figure8()]);
		const plain = await exported({});
		expect(contoursOf(plain, 'A')).toHaveLength(1);
		const merged = await exported({ mergeOverlaps: true });
		const outlines = contoursOf(merged, 'A');
		expect(outlines).toHaveLength(2);
		outlines.forEach((contour) => expect(crossesItself(cornersOf(contour))).toBe(false));
	});

	it('an even figure 8 next to two crossing squares is kept, not dropped', async () => {
		expect(hasOverlaps(openWith([evenFigure8()]).project.getItem('glyph-0x41').shapes)).toBe(
			true
		);
		openWith([evenFigure8(), square(1000, 0, 300), square(1150, 150, 300)]);
		const merged = await exported({ mergeOverlaps: true });
		const outlines = contoursOf(merged, 'A');
		// the two squares as one, and the figure 8's two halves
		expect(outlines).toHaveLength(3);
		const left = outlines.filter((contour) => cornersOf(contour).every(([x]) => x <= 700));
		expect(left).toHaveLength(2);
	});
});

describe('a font name with no plain letters', () => {
	it('still gets a PostScript name of its own', () => {
		openProject(brennanHandJSON());
		const a = createOptionsObject(undefined, { familyName: '手書き Test 10' }).postScriptName;
		const b = createOptionsObject(undefined, { familyName: '日本語の字 Test 10' }).postScriptName;
		const c = createOptionsObject(undefined, { familyName: '😀'.repeat(20) }).postScriptName;
		[a, b, c].forEach((name) => {
			expect(name).toMatch(/^[!-~]+$/);
			expect(name).not.toMatch(/[[\](){}<>/%\s]/);
			expect(name.length).toBeLessThanOrEqual(63);
		});
		expect(new Set([a, b, c]).size).toBe(3);
		// the same name always gets the same PostScript name
		expect(createOptionsObject(undefined, { familyName: '手書き Test 10' }).postScriptName).toBe(a);
		// a plain name is as before
		expect(createOptionsObject(undefined, { familyName: 'Brennan Hand Test 1' }).postScriptName).toBe(
			'BrennanHandTest1-Regular'
		);
	});
});
