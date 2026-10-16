// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 integration (FACTCHECK_LOG 8.20 and 8.12, the fact-check's NEEDS 1 and 2): Use in
// Word's font file has each letter's overlapping shapes made one outline, and its gap fixes
// listed under Latin ('latn') as well as the default script. Neither changes the work file, and
// a letter with nothing overlapping goes into the file exactly as before.
// Written to fail first: the exporter had no mergeOverlaps / kernForLatin options (an export
// with them held two outlines for an overlapped A, and only 'DFLT').
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOptionsObject, ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { testBuildNames } from '../build_names.js';
import { openProject, square } from '../../fontcheck/tests/fixtures.js';
import { hasOverlaps } from '../merge_overlaps.js';
import { scriptTags, tableChecksumsOk, withLatinKern } from '../kern_latin.js';
import { brennanHandJSON } from './install_fixture.js';

/** A clockwise square: a hole */
function hole(x, y, s) {
	return {
		name: 'Hole',
		pathPoints: [
			{ p: { coord: { x, y } } },
			{ p: { coord: { x, y: y + s } } },
			{ p: { coord: { x: x + s, y: y + s } } },
			{ p: { coord: { x: x + s, y } } },
		],
	};
}

function overlapFont() {
	const json = brennanHandJSON({ gapFix: true });
	// A: two brush-like bars that cross; a: ink with a hole in it (nothing overlaps)
	json.glyphs['glyph-0x41'].shapes = [square(100, 0, 600), square(400, 300, 600)];
	json.glyphs['glyph-0x61'].shapes = [square(100, 0, 700), hole(300, 200, 200)];
	return openProject(json);
}

const OPTIONS = { omitEmptyLetters: true, addSpaceIfMissing: true };
const glyphOf = (font, char) => font.glyphs.find((glyph) => glyph.unicode === char.charCodeAt(0));
const contoursOf = (font, char) => glyphOf(font, char)?.contours || [];

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('overlapping shapes, in the font file only', () => {
	it('two crossing shapes become one outline; the work file keeps both', async () => {
		const editor = overlapFont();
		const before = JSON.stringify(editor.project.save());
		const plain = FontFlux.open(await ioFont_exportFont('otf', true, OPTIONS));
		expect(contoursOf(plain, 'A')).toHaveLength(2);
		const merged = FontFlux.open(
			await ioFont_exportFont('otf', true, { ...OPTIONS, mergeOverlaps: true })
		);
		const outline = contoursOf(merged, 'A');
		expect(outline).toHaveLength(1);
		// the joined outline's corners: an L-like shape of 8 corners round both squares
		const ends = outline[0].filter((cmd) => cmd.type !== 'Z');
		const xs = ends.map((cmd) => cmd.x);
		const ys = ends.map((cmd) => cmd.y);
		expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
			100, 1000, 0, 900,
		]);
		expect(ends.every((cmd) => Number.isInteger(cmd.x) && Number.isInteger(cmd.y))).toBe(true);
		expect(ends.filter((cmd) => cmd.type === 'L')).toHaveLength(8);
		expect(JSON.stringify(editor.project.save())).toBe(before);
	});

	it('a letter with a hole and nothing overlapping goes in exactly as before', async () => {
		overlapFont();
		const plain = FontFlux.open(await ioFont_exportFont('otf', true, OPTIONS));
		const merged = FontFlux.open(
			await ioFont_exportFont('otf', true, { ...OPTIONS, mergeOverlaps: true })
		);
		expect(contoursOf(merged, 'a')).toEqual(contoursOf(plain, 'a'));
		expect(contoursOf(merged, 'a')).toHaveLength(2);
	});

	it('knows overlap from nesting: a hole in ink is fine, ink in ink of the same turn is not', () => {
		const editor = overlapFont();
		const shapes = (char) =>
			editor.project.getItem(`glyph-0x${char.charCodeAt(0).toString(16)}`).shapes;
		expect(hasOverlaps(shapes('A'))).toBe(true);
		expect(hasOverlaps(shapes('a'))).toBe(false);
	});
});

describe('gap fixes listed for Latin text', () => {
	it("the font file lists 'latn' beside 'DFLT', with sound checksums, and keeps its pairs", async () => {
		openProject(brennanHandJSON({ gapFix: true }));
		const plain = await ioFont_exportFont('otf', true, OPTIONS);
		expect(scriptTags(plain)).toEqual(['DFLT']);
		const latin = await ioFont_exportFont('otf', true, { ...OPTIONS, kernForLatin: true });
		expect(scriptTags(latin)).toEqual(['DFLT', 'latn']);
		expect(tableChecksumsOk(latin)).toBe(true);
		const font = FontFlux.open(latin);
		expect(font.listKerning().length).toBeGreaterThan(0);
		expect(glyphOf(font, 'A')).toBeTruthy();
	});

	it('a font with no gap fixes, or one that already has latn, comes back unchanged', async () => {
		openProject(brennanHandJSON({ gapFix: false }));
		const none = await ioFont_exportFont('otf', true, OPTIONS);
		expect(withLatinKern(none)).toBe(none);
		openProject(brennanHandJSON({ gapFix: true }));
		const once = withLatinKern(await ioFont_exportFont('otf', true, OPTIONS));
		expect(withLatinKern(once)).toBe(once);
		expect(scriptTags(once)).toEqual(['DFLT', 'latn']);
	});
});

// The fact-check's NEEDS 4: Windows' 31-character family name and a plain PostScript name
describe('the names in a test build', () => {
	it('the family fits 31 characters and the PostScript name is plain, with no spaces', () => {
		openProject(brennanHandJSON({ name: 'Brennan Meyer Everyday Handwriting (Ünïcode)' }));
		const names = testBuildNames('Brennan Meyer Everyday Handwriting (Ünïcode)', 12);
		expect(names.family.length).toBeLessThanOrEqual(31);
		expect(names.family.endsWith(' Test 12')).toBe(true);
		const options = createOptionsObject(undefined, { familyName: names.family });
		expect(options.familyName).toBe(names.family);
		expect(options.postScriptName).toMatch(/^[!-~]+$/);
		expect(options.postScriptName).not.toMatch(/[[\](){}<>/%\s]/);
		expect(options.postScriptName.length).toBeLessThanOrEqual(63);
	});
});
