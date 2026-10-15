// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: a photo in the font's photo list keeps its image in the work file, even
	before any letter is traced from it (trace_model.js collectReferencedAssetIds). Found at the
	seam between the photo registry (settings.anyink.photos) and the .gs2 save, which kept only
	images a trace uses (D-028): a whole-alphabet photo he added, skipped through or marked "Done
	with this photo" came back tomorrow as a record with no picture, so "Use the same photo" and
	rule 12 offered a photo that could not open. Images nothing uses (a trace removed, a photo
	taken out) still stay out.
*/
import { describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { addPhoto, getPhoto, removePhoto } from '../../photo/photo_registry.js';
import { ROW } from '../../photo/tests/photo_dialog_fixture.js';
import { collectReferencedAssetIds } from '../trace_model.js';

function editorWithPhoto() {
	const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	const asset = editor.assets.add(new Blob([new Uint8Array(32)], { type: 'image/webp' }), {
		type: 'image/webp',
	});
	const spare = editor.assets.add(new Blob([new Uint8Array(8)], { type: 'image/png' }), {
		type: 'image/png',
	});
	addPhoto(editor.project, { asset, width: 1500, height: 520, parts: ROW, paper: 'photo' });
	return { editor, asset, spare };
}

describe("the photo list's images stay in the work file", () => {
	it('a photo no letter uses yet is kept; an image nothing uses is not', async () => {
		const { editor, asset, spare } = editorWithPhoto();
		expect([...collectReferencedAssetIds(editor.project)]).toEqual([asset]);
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(Object.keys(saved.assets)).toEqual([asset]);
		expect(saved.settings.anyink.photos[asset].parts).toHaveLength(7);
		expect(Object.keys(saved.assets)).not.toContain(spare);

		const target = new ProjectEditor();
		setCurrentProjectEditor(target);
		const reopened = importGlyphrProjectFromText(JSON.stringify(saved));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(target.assets.has(asset)).toBe(true);
		expect(getPhoto(reopened, asset)?.parts).toHaveLength(7);
	});

	it('a photo taken out of the list leaves the next save without its image', async () => {
		const { editor, asset } = editorWithPhoto();
		removePhoto(editor.project, asset);
		expect(collectReferencedAssetIds(editor.project).size).toBe(0);
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(saved.assets).toBeUndefined();
	});

	it('reads a saved file (plain data) the same way', () => {
		const project = { settings: { anyink: { photos: { 'img-x': { asset: 'img-x' } } } } };
		expect([...collectReferencedAssetIds(project)]).toEqual(['img-x']);
		expect(collectReferencedAssetIds({ settings: { anyink: { photos: [] } } }).size).toBe(0);
	});
});
