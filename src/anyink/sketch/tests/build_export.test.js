// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 export merge (docs/SKETCH.md section 3 "Overlaps in the font file", D-047 point 9): a
	sketched letter's built shapes overlap (one shape per piece, round ends at the joins), and the
	font file must not. Every export path merges a letter with sketch-built or Brush shapes: the
	File menu's export (ioFont_exportFont with no merge asked for) and Use in Word's
	(WORD_EXPORT_OPTIONS) both give n, o, A and a Centerline B outlines that never cross, never
	cross themselves, and turn the right way for how deep they sit (ink counterclockwise, holes
	clockwise), with o's 1 hole and B's 2. A letter with nothing tagged goes in as before.
	Checked to fail: with font_export.js merging only when asked (as before S3), the File menu
	test and the which-letters test fail; Use in Word's passes either way.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { glyphToContours, ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { WORD_EXPORT_OPTIONS } from '../../install/word_export.js';
import { hasKeptInk } from '../../install/merge_overlaps.js';
import { clearBuildCache, rebuildItem } from '../build.js';
import { crossesItself, loopsCross } from '../build_outline.js';
import { flattenCubics, outlineOrder, signedArea } from '../outline_order.js';
import { bCenter } from './fixtures/build_letters.js';
import { glyphIdOf, openSketchFont, sketchFontJSON } from './fixtures/sketch_font.js';
import { storedSketch } from './fixtures/stored_sketches.js';
import { openProject } from '../../fontcheck/tests/fixtures.js';

const OPTIONS = { omitEmptyLetters: true, addSpaceIfMissing: true };
const CHARS = ['n', 'o', 'A', 'B'];

/** FontFlux contour commands to a closed line of points */
function commandPoints(contour) {
	const points = [];
	let at = null;
	contour.forEach((cmd) => {
		if (cmd.type === 'M' || cmd.type === 'L') {
			at = [cmd.x, cmd.y];
			points.push(at);
		} else if (cmd.type === 'C') {
			points.push(
				...flattenCubics([[at, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y]]]).slice(1)
			);
			at = [cmd.x, cmd.y];
		}
	});
	const first = points[0];
	const last = points.at(-1);
	if (points.length > 1 && first[0] === last[0] && first[1] === last[1]) points.pop();
	return points;
}

/** What is wrong with a letter's outlines as a font file holds them ([] for nothing) */
function overlapProblems(contours) {
	const loops = contours.map(commandPoints).filter((points) => points.length >= 3);
	const problems = [];
	loops.forEach((loop, i) => {
		if (crossesItself(loop)) problems.push(`outline ${i} crosses itself`);
		for (let j = i + 1; j < loops.length; j++) {
			if (loopsCross(loop, loops[j])) problems.push(`outlines ${i} and ${j} cross`);
		}
	});
	outlineOrder(loops.map((points, id) => ({ id, points }))).forEach((entry) => {
		if (entry.reverse)
			problems.push(`outline ${entry.id} turns the wrong way at depth ${entry.depth}`);
	});
	return problems;
}

const holesOf = (contours) =>
	contours.map(commandPoints).filter((points) => signedArea(points) < 0).length;

function sketchedFont() {
	const editor = openSketchFont({
		n: storedSketch('n'),
		o: storedSketch('o'),
		A: storedSketch('A'),
		B: bCenter(),
	});
	CHARS.forEach((char) =>
		rebuildItem(editor.project.getItem(glyphIdOf(char)), { project: editor.project })
	);
	return editor;
}

const glyphOf = (font, char) => font.glyphs.find((glyph) => glyph.unicode === char.charCodeAt(0));

let warn;
beforeEach(() => {
	clearBuildCache();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('a sketched letter in the font file has no overlaps', () => {
	it('the File menu path (no merge asked for)', async () => {
		const editor = sketchedFont();
		const n = editor.project.getItem(glyphIdOf('n'));
		expect(n.shapes.length).toBeGreaterThanOrEqual(2);
		const font = FontFlux.open(await ioFont_exportFont('otf', true, OPTIONS));
		for (const char of CHARS) {
			const contours = glyphOf(font, char)?.contours || [];
			expect(contours.length, char).toBeGreaterThan(0);
			expect(overlapProblems(contours), char).toEqual([]);
		}
		expect(holesOf(glyphOf(font, 'o').contours)).toBe(1);
		expect(holesOf(glyphOf(font, 'B').contours)).toBe(2);
		expect(holesOf(glyphOf(font, 'n').contours)).toBe(0);
	});

	it('the Use in Word path', async () => {
		sketchedFont();
		const font = FontFlux.open(await ioFont_exportFont('otf', true, WORD_EXPORT_OPTIONS));
		for (const char of CHARS) {
			expect(overlapProblems(glyphOf(font, char)?.contours || []), char).toEqual([]);
		}
		expect(holesOf(glyphOf(font, 'B').contours)).toBe(2);
	});

	it('the work file keeps its shapes as built: only the file is merged', async () => {
		const editor = sketchedFont();
		const before = JSON.stringify(editor.project.save());
		await ioFont_exportFont('otf', true, OPTIONS);
		expect(JSON.stringify(editor.project.save())).toBe(before);
	});
});

describe('which letters merge', () => {
	it('a letter with sketch-built or Brush shapes merges; one with neither goes in as drawn', () => {
		const editor = sketchedFont();
		const n = editor.project.getItem(glyphIdOf('n'));
		expect(hasKeptInk(n.shapes)).toBe(true);
		expect(glyphToContours(n).length).toBeLessThan(n.shapes.length);
		// the same overlapping shapes untagged: as drawn, unless a merge is asked for
		const json = sketchFontJSON({});
		json.glyphs[glyphIdOf('n')] = {
			id: glyphIdOf('n'),
			advanceWidth: 700,
			shapes: n.shapes.map((shape) => {
				const saved = shape.save();
				delete saved.anyink;
				return saved;
			}),
		};
		const plainEditor = openProject(json);
		const plain = plainEditor.project.getItem(glyphIdOf('n'));
		expect(hasKeptInk(plain.shapes)).toBe(false);
		expect(glyphToContours(plain)).toHaveLength(plain.shapes.length);
		expect(glyphToContours(plain, { mergeOverlaps: true }).length).toBeLessThan(
			plain.shapes.length
		);
		// a Brush-tagged shape merges too
		plain.shapes[0].anyink = { strokeId: 1, strokeKey: 'st_x', strokePart: 0 };
		expect(hasKeptInk(plain.shapes)).toBe(true);
		expect(glyphToContours(plain).length).toBeLessThan(plain.shapes.length);
	});

	it('a merge is kept: the same letter twice gives equal contours, not the same objects', () => {
		const editor = sketchedFont();
		const o = editor.project.getItem(glyphIdOf('o'));
		const a = glyphToContours(o);
		const b = glyphToContours(o);
		expect(b).toEqual(a);
		expect(b).not.toBe(a);
	});
});
