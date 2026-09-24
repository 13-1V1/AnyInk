// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track A: "The image is reference only and never exported." Trace images
// are saved in the .gs2 (only the ones a trace still uses) and never reach the font.
// Runs the real upstream OTF export (ioFont_exportFont testing flag) and the real save.
import { FontFlux } from 'font-flux-js';
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { collectReferencedAssetIds, getTrace, makeTrace, setTrace } from '../trace_model.js';

const OBLEGG = fs.readFileSync(path.resolve(__dirname, '../../../samples/oblegg.gs2'), 'utf8');

const USED = 'img-trace001';
const UNUSED = 'img-unused01';

// A PNG signature followed by 16 KB of patterned bytes: big enough that a font carrying
// it would visibly grow, and easy to search for.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function fakePNG() {
	const bytes = new Uint8Array(PNG_SIGNATURE.length + 16384);
	bytes.set(PNG_SIGNATURE, 0);
	for (let i = PNG_SIGNATURE.length; i < bytes.length; i++) bytes[i] = (i * 31) & 0xff;
	return new Blob([bytes], { type: 'image/png' });
}

/** Opens oblegg.gs2 in a fresh editor, the way a user opens a project. */
function openOblegg() {
	setCurrentProjectEditor(new ProjectEditor());
	const project = importGlyphrProjectFromText(OBLEGG);
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

/** Puts a trace on a glyph, a ligature, and a component. */
function addTraces(editor) {
	const { project } = editor;
	editor.assets.add(fakePNG(), { id: USED });
	editor.assets.add(fakePNG(), { id: UNUSED });
	const trace = makeTrace({ asset: USED, width: 1500, height: 2000 }, project.settings.font);
	const items = [
		project.glyphs['glyph-0x41'],
		project.ligatures['liga-f-i'],
		project.components['comp-0'],
	];
	for (const item of items)
		expect(setTrace(item, { ...trace, opacity: 0.6, invert: true })).toBe(true);
	return items;
}

function containsBytes(haystack, needle) {
	outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
		return true;
	}
	return false;
}

const ascii = (text) => Array.from(text, (c) => c.charCodeAt(0));

function glyphSummary(font) {
	return font.glyphs.map((g) =>
		JSON.stringify({
			name: g.name,
			unicode: g.unicode,
			advanceWidth: g.advanceWidth,
			contours: g.contours,
		})
	);
}

describe('the exported font ignores trace images', () => {
	it('OTF export with traces on a glyph, a ligature, and a component is the same font', async () => {
		const plainEditor = openOblegg();
		const plain = new Uint8Array(await ioFont_exportFont('otf', true));

		const tracedEditor = openOblegg();
		const traced = addTraces(tracedEditor);
		const withTraces = new Uint8Array(await ioFont_exportFont('otf', true));

		// Nothing grew
		expect(withTraces.byteLength).toBe(plain.byteLength);
		// No image bytes, no asset id, no ANY-INK data
		expect(containsBytes(withTraces, PNG_SIGNATURE)).toBe(false);
		expect(containsBytes(withTraces, ascii(USED))).toBe(false);
		expect(containsBytes(withTraces, ascii('anyink'))).toBe(false);
		expect(containsBytes(withTraces, ascii('WEBP'))).toBe(false);
		// Same glyphs, same outlines
		const a = FontFlux.open(plain.buffer);
		const b = FontFlux.open(withTraces.buffer);
		expect(b.glyphs.length).toBe(a.glyphs.length);
		expect(glyphSummary(b)).toEqual(glyphSummary(a));
		// ...and the comparison is not vacuous: a real font with real outlines, including A
		expect(plain.byteLength).toBeGreaterThan(2000);
		const glyphA = b.glyphs.find((g) => g.unicode === 0x41);
		expect(glyphA?.contours?.length).toBeGreaterThan(0);
		expect(b.glyphs.length).toBeGreaterThan(50);

		// Exporting did not touch the traces or the stored images
		for (const item of traced) expect(getTrace(item)).toMatchObject({ asset: USED, invert: true });
		expect(tracedEditor.assets.ids()).toEqual([USED, UNUSED]);
		expect(plainEditor.assets.ids()).toEqual([]);
	}, 60000);
});

describe('the .gs2 keeps traces and only the images they use', () => {
	it('saves every trace and the used image, drops the unused one, and reopens the same', async () => {
		const editor = openOblegg();
		const items = addTraces(editor);
		const before = items.map((item) => getTrace(item));

		const text = await editor.makeProjectFileText();
		const saved = JSON.parse(text);
		expect(Object.keys(saved.assets)).toEqual([USED]);
		expect(saved.assets[USED].type).toBe('image/png');
		expect(saved.glyphs['glyph-0x41'].anyink.trace).toEqual(before[0]);
		expect(saved.ligatures['liga-f-i'].anyink.trace).toEqual(before[1]);
		expect(saved.components['comp-0'].anyink.trace).toEqual(before[2]);
		// The unused Blob stays on the editor (undo may bring its trace back)
		expect(editor.assets.has(UNUSED)).toBe(true);

		// Reopen into a new editor
		const target = new ProjectEditor();
		setCurrentProjectEditor(target);
		const reopened = importGlyphrProjectFromText(text);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(target.assets.ids()).toEqual([USED]);
		expect(target.assets.get(USED).blob.size).toBe(fakePNG().size);
		expect(getTrace(reopened.glyphs['glyph-0x41'])).toEqual(before[0]);
		expect(getTrace(reopened.ligatures['liga-f-i'])).toEqual(before[1]);
		expect(getTrace(reopened.components['comp-0'])).toEqual(before[2]);
		expect([...collectReferencedAssetIds(reopened)]).toEqual([USED]);
	});

	it('removing the last trace leaves the image out of the next save', async () => {
		const editor = openOblegg();
		const items = addTraces(editor);
		for (const item of items) setTrace(item, null);
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(saved.assets).toBeUndefined();
		expect(saved.glyphs['glyph-0x41'].anyink).toBeUndefined();
		expect(editor.assets.ids()).toEqual([USED, UNUSED]);
	});

	it('an older project file with no traces opens, reads as traceless, and saves no images', async () => {
		const editor = openOblegg();
		const { project } = editor;
		for (const key of ['glyphs', 'ligatures', 'components']) {
			for (const item of Object.values(project[key])) expect(getTrace(item)).toBeNull();
		}
		expect(collectReferencedAssetIds(project).size).toBe(0);
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(saved.assets).toBeUndefined();
		expect(Object.values(saved.glyphs).some((g) => 'anyink' in g)).toBe(false);
	});

	it('a trace whose image is missing from the file still opens (nothing to draw, box still there)', async () => {
		const editor = openOblegg();
		addTraces(editor);
		const saved = JSON.parse(await editor.makeProjectFileText());
		delete saved.assets; // e.g. a file edited by hand, or an older build that lost it

		const target = new ProjectEditor();
		setCurrentProjectEditor(target);
		const reopened = importGlyphrProjectFromText(JSON.stringify(saved));
		expect(getTrace(reopened.glyphs['glyph-0x41'])).toMatchObject({ asset: USED });
		expect(target.assets.has(USED)).toBe(false);
	});
});
