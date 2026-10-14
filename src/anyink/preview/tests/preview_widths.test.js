// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 6 (UX-BEGINNER.md 7.2): the real-font preview builds every width the way the font file
// export does. An existing letter keeps its own width, rounded like the exporter's sanitizeInt,
// even when it is 0 ("eee" piles up in the preview exactly as in the font). Only a letter that
// doesn't exist falls back to the default width.
import { FontFlux } from 'font-flux-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { FontPreviewBuilder } from '../../../controls/font-preview/font_preview.js';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
});

/** A fresh copy of the sample: space, A (530), B (405), C (420), the AB joined letters (655). */
function sampleProject(mutate) {
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	if (mutate) mutate(project);
	return project;
}

/** Builds the preview font for text and reads it back the way a font file is read. */
function buildAndOpen(project, text, options = {}) {
	const builder = new FontPreviewBuilder(project, options);
	return FontFlux.open(builder.buildFontBuffer(text));
}

function widthOf(font, name) {
	const glyph = font.getGlyph(name);
	expect(glyph, `glyph ${name}`).toBeTruthy();
	return glyph.advanceWidth;
}

describe('FontPreviewBuilder widths', () => {
	it('builds a fractional width as a whole number (654.338 -> 654)', () => {
		const project = sampleProject((p) => {
			p.getItem('glyph-0x41').advanceWidth = 654.338;
		});
		expect(widthOf(buildAndOpen(project, 'AAA'), 'uni0041')).toBe(654);
	});

	it('keeps a width of 0 at 0, ink and all, so "AAA" piles up as in the font file', () => {
		const project = sampleProject((p) => {
			p.getItem('glyph-0x41').advanceWidth = 0;
		});
		expect(project.defaultAdvanceWidth).toBeGreaterThan(0);
		const font = buildAndOpen(project, 'AAA');
		expect(widthOf(font, 'uni0041')).toBe(0);
		expect(font.getGlyphContours('uni0041').length).toBeGreaterThan(0);
	});

	it('gives a missing letter the default width, rounded like the exporter', () => {
		const project = sampleProject((p) => {
			p.settings.font.upm = 1001; // default width 500.5
		});
		expect(project.getItem('glyph-0x7a')).toBeFalsy();
		expect(project.defaultAdvanceWidth).toBe(500.5);
		expect(widthOf(buildAndOpen(project, 'z'), 'uni007A')).toBe(501);
	});

	it('rounds the joined letters width too', () => {
		const project = sampleProject((p) => {
			Object.values(p.ligatures)[0].advanceWidth = 655.5;
		});
		const font = buildAndOpen(project, 'AB', { includeLigatures: true });
		expect(widthOf(font, 'lig.0041.0042')).toBe(656);
	});

	it('rounds the missing-letter box (.notdef) width too', () => {
		const project = sampleProject((p) => {
			p.addItemByType(new Glyph({ advanceWidth: 432.6 }), 'Glyph', 'glyph-0x0');
		});
		expect(widthOf(buildAndOpen(project, 'A'), '.notdef')).toBe(433);
	});

	it('draws the missing-letter box (.notdef) exactly as the font file does', async () => {
		// Also keeps a font with no ink yet loadable: Chrome refuses a font with no outlines at all.
		const project = sampleProject();
		expect(project.getItem('glyph-0x0')).toBeFalsy();
		const previous = getCurrentProjectEditor();
		setCurrentProjectEditor(new ProjectEditor({ project }));
		try {
			const exported = FontFlux.open(await ioFont_exportFont('otf', true));
			const preview = buildAndOpen(project, 'A');
			expect(preview.getGlyphContours('.notdef').length).toBe(2); // outer and inner box
			expect(preview.getGlyphContours('.notdef')).toEqual(exported.getGlyphContours('.notdef'));
			expect(widthOf(preview, '.notdef')).toBe(widthOf(exported, '.notdef'));
		} finally {
			setCurrentProjectEditor(previous);
		}
	});

	it('writes whole-number points', () => {
		const project = sampleProject((p) => {
			p.getItem('glyph-0x41').shapes[0].pathPoints[0].p.x += 0.4;
		});
		const font = buildAndOpen(project, 'A');
		const coords = font
			.getGlyphContours('uni0041')
			.flat()
			.flatMap((point) => [point.x, point.y]);
		expect(coords.length).toBeGreaterThan(0);
		coords.forEach((value) => expect(Number.isInteger(value)).toBe(true));
	});
});
