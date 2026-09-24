// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 scaffold: ProjectEditor.makeProjectFileText writes only the assets some
// trace uses once the trace model says pruning is ready. The model is mocked here so this
// tests the hook alone, whatever track A's real collectReferencedAssetIds returns.
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../trace_model.js', async (importOriginal) => {
	const real = await importOriginal();
	return {
		...real,
		ASSET_PRUNING_READY: true,
		collectReferencedAssetIds: vi.fn(() => new Set(['img-used0000'])),
	};
});

// vitest-setup.js loads the app (and so project_editor.js) before this file's mock is
// registered, so load fresh copies after a module reset; they get the mocked model.
let GlyphrStudioProject, ProjectEditor, collectReferencedAssetIds;
beforeAll(async () => {
	vi.resetModules();
	({ GlyphrStudioProject } = await import('../../../project_data/glyphr_studio_project.js'));
	({ ProjectEditor } = await import('../../../project_editor/project_editor.js'));
	({ collectReferencedAssetIds } = await import('../trace_model.js'));
});

// 1 x 1 transparent PNG
const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x64, 0x60, 0xf8, 0x5f,
	0x0f, 0x00, 0x02, 0x87, 0x01, 0x80, 0xeb, 0x47, 0xba, 0x92, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
	0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const png = () => new Blob([PNG_BYTES], { type: 'image/png' });

function makeEditor() {
	const project = new GlyphrStudioProject({
		settings: {
			project: { name: 'Trace Save', id: 'g2_TRACESAVE' },
			font: { family: 'Trace Save', upm: 1000, ascent: 800, descent: -200 },
		},
	});
	return new ProjectEditor({ project });
}

describe('makeProjectFileText with asset pruning ready', () => {
	it('asks the model which assets are used and writes only those', async () => {
		const editor = makeEditor();
		editor.assets.add(png(), { id: 'img-used0000' });
		editor.assets.add(png(), { id: 'img-unused00' });

		const saved = JSON.parse(await editor.makeProjectFileText());

		expect(collectReferencedAssetIds).toHaveBeenCalledWith(editor.project);
		expect(Object.keys(saved.assets)).toEqual(['img-used0000']);
		expect(saved.assets['img-used0000'].type).toBe('image/png');
		// The unused Blob stays on the editor for undo and crash snapshots
		expect(editor.assets.ids()).toEqual(['img-used0000', 'img-unused00']);
		expect(Object.keys(editor.assets.toBlobMap())).toEqual(['img-used0000', 'img-unused00']);
	});

	it('leaves the assets key out when no used asset is in the store', async () => {
		const editor = makeEditor();
		editor.assets.add(png(), { id: 'img-unused00' });
		const saved = JSON.parse(await editor.makeProjectFileText());
		expect(saved.assets).toBeUndefined();
	});
});
