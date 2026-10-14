// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { FontFlux } from 'font-flux-js';
import { describe, expect, it } from 'vitest';
import { FontPreviewBuilder } from '../../../controls/font-preview/font_preview.js';
import { getUniqueGlyphName } from '../../../formats_io/otf/font_export.js';
import { writeGposKernDataToFont } from '../../../formats_io/otf/tables/gpos.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { failingItemId, glyphIndexFromPath } from '../build_culprit.js';

const square = [
	[
		{ type: 'M', x: 100, y: 0 },
		{ type: 'L', x: 500, y: 0 },
		{ type: 'L', x: 500, y: 500 },
		{ type: 'L', x: 100, y: 500 },
	],
];

/** A font with .notdef, space (FontFlux adds both), small a and small b. */
function makeFont({ widthA = 600, widthB = 600 } = {}) {
	const font = FontFlux.create({ family: 'T', unitsPerEm: 1000, ascender: 800, descender: -200 });
	font.addGlyph({ name: 'uni0061', unicode: 0x61, advanceWidth: widthA, contours: square });
	font.addGlyph({ name: 'uni0062', unicode: 0x62, advanceWidth: widthB, contours: square });
	return font;
}

const ids = new Map([
	['uni0061', 'glyph-0x61'],
	['uni0062', 'glyph-0x62'],
]);

function exportError(font) {
	try {
		font.export({ format: 'sfnt' });
	} catch (error) {
		return error;
	}
	return null;
}

describe('glyphIndexFromPath', () => {
	it('reads the glyph index out of a FontFlux path or message', () => {
		expect(glyphIndexFromPath('$.glyphs[2].advanceWidth')).toBe(2);
		expect(
			glyphIndexFromPath('$.glyphs[13].advanceWidth must be an integer from 0 to 65535.')
		).toBe(13);
		expect(glyphIndexFromPath('Glyph count must be between 1 and 65535.')).toBe(-1);
		expect(glyphIndexFromPath(undefined)).toBe(-1);
	});
});

describe('failingItemId', () => {
	it('names the letter whose width the font file cannot hold', () => {
		const font = makeFont({ widthB: 654.338 });
		const error = exportError(font);
		expect(error?.message).toContain('advanceWidth must be an integer');
		expect(failingItemId(font, ids, error)).toBe('glyph-0x62');
	});

	it('falls back to the error message when validate() finds nothing', () => {
		const font = makeFont();
		const error = new Error('$.glyphs[2].advanceWidth must be an integer from 0 to 65535.');
		expect(font.glyphs[2].name).toBe('uni0061');
		expect(failingItemId(font, ids, error)).toBe('glyph-0x61');
	});

	it('gives null when no letter of the project can be named', () => {
		const font = makeFont();
		expect(failingItemId(font, ids, new Error('Glyph count must be between 1 and 65535.'))).toBe(
			null
		);
		// .notdef sits at index 0 and is not in the map
		expect(failingItemId(font, ids, new Error('$.glyphs[0].advanceWidth'))).toBe(null);
		expect(failingItemId(null, ids, new Error('x'))).toBe(null);
	});
});

// A safety net since the B1 fix pass: the preview now writes gaps the way the font file holds
// them (export_kerning.js), so no gap value breaks its build. These fonts write the gaps as
// typed, as the preview did before (and upstream's writer still would), to get FontFlux's real
// refusal.
describe('failingItemId for a gap', () => {
	/**
	 * The real preview font for text, from the sample with some gaps changed, its gaps written
	 * as typed. Its gaps: kern-0 A B C -> C, kern-1 Q R S -> S, kern-2 A..I Q R S -> S, all -100.
	 */
	function build(values, text) {
		const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		Object.entries(values).forEach(([id, value]) => (project.kerning[id].value = value));
		const builder = new FontPreviewBuilder(project, { flavor: 'otf' });
		builder.includeKerning = false;
		const font = builder.buildFontFlux(text);
		writeGposKernDataToFont(font, project);
		return { project, builder, font, error: exportError(font) };
	}
	const gaps = (project) => ({ kerning: project.kerning, glyphNameFor: getUniqueGlyphName });

	it('names the gap FontFlux refuses (12.5)', () => {
		const { project, builder, font, error } = build({ 'kern-0': 12.5 }, 'AC');
		expect(error?.message).toContain('$.kerningClasses[0].value must be an integer');
		expect(failingItemId(font, builder.itemIdsByGlyphName, error, gaps(project))).toBe('kern-0');
	});

	it('names the broken gap, not a fine one written before it', () => {
		const { project, builder, font, error } = build({ 'kern-2': 12.5 }, 'ACS');
		expect(error?.message).toContain('$.kerningClasses');
		expect(failingItemId(font, builder.itemIdsByGlyphName, error, gaps(project))).toBe('kern-2');
	});

	it('skips a broken gap whose letters are not in the font', () => {
		// kern-0 is broken but this text has no C; kern-2 (A and S) is the one written
		const { project, builder, font, error } = build({ 'kern-0': 12.5, 'kern-2': 40000 }, 'AS');
		expect(error?.message).toContain('$.kerningClasses');
		expect(failingItemId(font, builder.itemIdsByGlyphName, error, gaps(project))).toBe('kern-2');
	});

	it('gives null for a gap error when it was not told about the gaps', () => {
		const { builder, font, error } = build({ 'kern-0': 12.5 }, 'AC');
		expect(failingItemId(font, builder.itemIdsByGlyphName, error)).toBe(null);
	});
});
