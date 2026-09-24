// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track B: an auto-traced glyph goes through the real upstream OTF export
// (ioFont_exportFont testing flag) with the right number of contours, and its holes are still
// holes in the font file under the nonzero rule CFF outlines are filled with.
// The traced shapes come from real potrace output (tests/fixtures) and go in through
// applyAutoTrace, the same way the Auto-trace card's Replace outlines puts them in.
import { FontFlux } from 'font-flux-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { makeTrace, setTrace } from '../../trace/trace_model.js';
import { applyAutoTrace } from '../apply.js';
import { potraceSvgToShapes } from '../svg_to_shapes.js';
import { flattenContour, nonzeroInk, signedArea } from './geometry_helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', `${name}.svg`), 'utf8');

let font;
let placed;

/**
 * Puts a fixture on a glyph's trace image (as tall as ascent to descent, like a new trace),
 * traces it into the glyph with Replace, and remembers where its pixels landed.
 */
function traceInto(editor, glyphID, name, size) {
	editor.selectedGlyphID = glyphID;
	const glyph = editor.selectedItem;
	const trace = makeTrace(
		{ asset: `img-${name}`, width: size, height: size },
		editor.project.settings.font
	);
	setTrace(glyph, trace);
	const shapes = potraceSvgToShapes(fixture(name), { x: trace.x, y: trace.y, scale: trace.scale });
	expect(applyAutoTrace({ editor, item: glyph, shapes, mode: 'replace' })).toBe(true);
	glyph.advanceWidth = size * trace.scale;
	placed[glyphID] = (px, py) => ({ x: trace.x + px * trace.scale, y: trace.y - py * trace.scale });
}

/** The exported glyph's contours as polygons. */
function exported(unicode) {
	const glyph = font.glyphs.find((g) => g.unicode === unicode);
	expect(glyph, `glyph U+${unicode.toString(16)}`).toBeTruthy();
	return glyph.contours.map((contour) => flattenContour(contour));
}

beforeAll(async () => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	placed = {};
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	traceInto(editor, 'glyph-0x41', 'letter_o', 200); // A gets a traced O
	traceInto(editor, 'glyph-0x42', 'bullseye', 120); // B gets ring + hole + island
	traceInto(editor, 'glyph-0x43', 'letter_a', 300); // C gets a traced A (with its counter)

	const buffer = await ioFont_exportFont('otf', true);
	expect(buffer.byteLength).toBeGreaterThan(500);
	font = FontFlux.open(buffer);
}, 60000);

describe('an auto-traced glyph in the exported OTF', () => {
	it('the traced O has 2 contours, opposite directions, and its counter is empty', () => {
		const polys = exported(0x41);
		expect(polys).toHaveLength(2);
		expect(Math.sign(signedArea(polys[0]))).toBe(1);
		expect(Math.sign(signedArea(polys[1]))).toBe(-1);
		const at = placed['glyph-0x41'];
		expect(nonzeroInk(polys, at(100, 100))).toBe(false); // the counter
		expect(nonzeroInk(polys, at(35, 100))).toBe(true); // the left side of the ring
		expect(nonzeroInk(polys, at(100, 165))).toBe(true); // the bottom of the ring
		expect(nonzeroInk(polys, at(5, 5))).toBe(false); // paper
	});

	it('the bullseye keeps its hole and the island inside it (3 contours)', () => {
		const polys = exported(0x42);
		expect(polys).toHaveLength(3);
		const at = placed['glyph-0x42'];
		expect(nonzeroInk(polys, at(60, 60))).toBe(true); // island
		expect(nonzeroInk(polys, at(60 + 27, 60))).toBe(false); // hole
		expect(nonzeroInk(polys, at(60 + 42, 60))).toBe(true); // ring
		expect(nonzeroInk(polys, at(60 + 56, 60))).toBe(false); // paper
	});

	it('the traced A has its outline and its counter (2 contours), the counter empty', () => {
		const polys = exported(0x43);
		expect(polys).toHaveLength(2);
		expect(Math.sign(signedArea(polys[0]))).toBe(-Math.sign(signedArea(polys[1])));
		// A point inside the counter's own contour is paper for the whole glyph
		const counter = polys[1];
		const xs = counter.map((p) => p.x);
		const ys = counter.map((p) => p.y);
		const inside = {
			x: (Math.min(...xs) + Math.max(...xs)) / 2,
			y: Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.3,
		};
		expect(nonzeroInk([counter], inside)).toBe(true);
		expect(nonzeroInk(polys, inside)).toBe(false);
	});

	it('every character is still in the font (space, A, B, C)', () => {
		for (const unicode of [0x20, 0x41, 0x42, 0x43]) {
			expect(font.glyphs.some((g) => g.unicode === unicode)).toBe(true);
		}
		expect(font.glyphs.find((g) => g.name === '.notdef')).toBeTruthy();
	});
});
