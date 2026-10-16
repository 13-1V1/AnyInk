// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 (docs/SKETCH.md section 8 "Save / load"): every field of a sketch, its built shapes' tags
	and the font's thickness come back from the real .gs2 save path (ProjectEditor
	makeProjectFileText, then importGlyphrProjectFromText), and the hash still matches, so a
	reopened font is not set aside. Also the dead-end replay fixture: its hash, and that it opens.
*/
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { square } from '../../history/tests/two_letters.js';
import { brushSize, resetBrushForTests } from '../../nib/brush_size.js';
import { setSketchThickness, sketchOf, sketchThickness, validateSketch } from '../model.js';
import { builtMatches, hashBuilt, markBuilt, sketchIdOf, sketchKeyOf, sketchPartOf, tagBuilt } from '../sketch_record.js';
import { fullSketch, FULL_KEY } from './fixtures/full_sketch.js';

const N = 'glyph-0x6E';
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dead_end_a.gs2.json');
const FIXTURE_SHA256 = '972e30b39bc3dbe332178c7a118f9f34d7322eb199c5682aafb1a9f80e312666';

function sketchedFont({ thickness = 99 } = {}) {
	const project = new GlyphrStudioProject({
		settings: {
			project: { name: 'Sketch Round Trip', id: 'g2_SKETCHRT' },
			font: { family: 'Sketch Round Trip', upm: 1000, ascent: 800, descent: -200, xHeight: 500, capHeight: 700 },
		},
		glyphs: { [N]: { id: N, advanceWidth: 600, shapes: [] } },
	});
	const item = project.glyphs[N];
	item.anyink.sketch = fullSketch();
	item.anyink.nib = { strokes: [] };
	const ink = item.addOneShape(square(100, 300));
	const hole = item.addOneShape(square(150, 200));
	item.addOneShape(square(700, 100));
	tagBuilt(ink, { id: 3, key: FULL_KEY, part: 0 });
	tagBuilt(hole, { id: 3, key: FULL_KEY, part: 1 });
	hole.anyink.extra = 'kept';
	markBuilt(item);
	setSketchThickness(project, thickness);
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

async function saveAndOpen(editor) {
	const text = await editor.makeProjectFileText();
	const target = new ProjectEditor();
	setCurrentProjectEditor(target);
	return { text, project: importGlyphrProjectFromText(text) };
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	localStorage.clear();
	resetBrushForTests();
});

describe('save and open', () => {
	it('brings back every field of the sketch exactly', async () => {
		const editor = sketchedFont();
		const before = JSON.parse(JSON.stringify(sketchOf(editor.project.glyphs[N])));
		expect(before.builtHash).toMatch(/^c2:/);
		const { text, project } = await saveAndOpen(editor);
		expect(JSON.parse(text).glyphs[N].anyink.sketch).toEqual(before);
		const after = sketchOf(project.glyphs[N]);
		expect(after).toEqual(before);
		expect(validateSketch(after).ok).toBe(true);
		// the whole letter-level anyink object, not only the sketch
		expect(project.glyphs[N].anyink.nib).toEqual({ strokes: [] });
	});

	it("keeps the built shapes' tags, their other anyink data, and the hash", async () => {
		const editor = sketchedFont();
		const hash = hashBuilt(editor.project.glyphs[N]);
		const { project } = await saveAndOpen(editor);
		const item = project.glyphs[N];
		expect(item.shapes.map((shape) => [sketchIdOf(shape), sketchKeyOf(shape), sketchPartOf(shape)])).toEqual([
			[3, FULL_KEY, 0],
			[3, FULL_KEY, 1],
			[null, null, 0],
		]);
		expect(item.shapes[1].anyink.extra).toBe('kept');
		expect(hashBuilt(item)).toBe(hash);
		expect(builtMatches(item)).toBe(true);
	});

	it("keeps the font's thickness, and a cleared one reads as the Brush default again", async () => {
		const set = await saveAndOpen(sketchedFont({ thickness: 99 }));
		expect(set.project.settings.anyink.sketchThickness).toBe(99);
		expect(sketchThickness(set.project)).toBe(99);

		const cleared = await saveAndOpen(sketchedFont({ thickness: null }));
		expect(cleared.project.settings.anyink.sketchThickness ?? null).toBe(null);
		expect(sketchThickness(cleared.project)).toBe(brushSize(cleared.project));
	});

	it('keeps a set-aside sketch and one from a newer app as they were', async () => {
		const editor = sketchedFont();
		const item = editor.project.glyphs[N];
		item.anyink.sketch.setAside = true;
		const aside = await saveAndOpen(editor);
		expect(aside.project.glyphs[N].anyink.sketch).toEqual({ ...fullSketch(), builtHash: item.anyink.sketch.builtHash, setAside: true });

		const newer = sketchedFont();
		const future = { v: 4, key: 'sk_future', unknown: { deep: [1] } };
		newer.project.glyphs[N].anyink.sketch = future;
		const opened = await saveAndOpen(newer);
		expect(sketchOf(opened.project.glyphs[N])).toEqual(future);
	});
});

describe('the dead-end replay fixture', () => {
	it('is the file the design names (sha256)', () => {
		const hash = createHash('sha256').update(readFileSync(FIXTURE)).digest('hex');
		expect(hash).toBe(FIXTURE_SHA256);
	});

	it('opens, and its small a holds the two Brush strokes and no sketch', () => {
		setCurrentProjectEditor(new ProjectEditor());
		const project = importGlyphrProjectFromText(readFileSync(FIXTURE, 'utf8'));
		const a = project.glyphs['glyph-0x61'];
		expect(a.anyink.nib.strokes).toHaveLength(2);
		a.anyink.nib.strokes.forEach((stroke) => expect(stroke.skeleton.length).toBeGreaterThan(0));
		expect(sketchOf(a)).toBe(null);
		expect(builtMatches(a)).toBe(true);
	});
});
