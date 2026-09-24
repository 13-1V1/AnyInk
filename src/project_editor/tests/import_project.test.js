// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../app/main.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../samples/simpleExampleProject.json';
import { handOffProjectAssets, importGlyphrProjectFromText } from '../import_project.js';
import { ProjectEditor } from '../project_editor.js';

/** Fresh copy of the plain upstream sample (the importer mutates its input) */
function sampleFile(patch = (file) => file) {
	return patch(structuredClone(simpleExampleProject));
}

/** A recording stand-in for the editor's AssetStore */
function fakeAssetStore(behavior = async () => {}) {
	return {
		calls: [],
		async loadSaveObject(obj) {
			this.calls.push(obj);
			return behavior(obj);
		},
	};
}

/** Lets the fire-and-forget hand-off promise settle */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const assets = { 'img-abcd1234': { type: 'image/png', data: 'iVBORw0KGgo=' } };

describe('importGlyphrProjectFromText (ANY-INK format)', () => {
	let editor;
	let warn;
	let log;
	let error;

	beforeEach(() => {
		editor = new ProjectEditor();
		editor.assets = fakeAssetStore();
		setCurrentProjectEditor(editor);
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		log = vi.spyOn(console, 'log').mockImplementation(() => {});
		error = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('a plain upstream file imports with the anyink defaults and logs nothing', async () => {
		const file = sampleFile();
		expect(file.settings.anyink).toBeUndefined();
		const project = importGlyphrProjectFromText(file);
		await flush();
		expect(project).toBeInstanceOf(GlyphrStudioProject);
		expect(project.settings.anyink).toEqual(new GlyphrStudioProject().settings.anyink);
		expect(project.settings.anyink.canvasTheme).toBe('light');
		expect(project.assetsSaveObject).toBe(false);
		expect(editor.assets.calls).toEqual([]);
		expect(warn).not.toHaveBeenCalled();
		expect(log).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
		// upstream content still there
		expect(project.settings.project.name).toBe('GS2 Test Font');
		expect(Object.keys(project.glyphs).length).toBe(Object.keys(simpleExampleProject.glyphs).length);
	});

	it('honors booleans saved in the upstream sample (merge fix)', () => {
		const project = importGlyphrProjectFromText(sampleFile());
		// the sample saves formatSaveFile: true over a default of false
		expect(simpleExampleProject.settings.app.formatSaveFile).toBe(true);
		expect(project.settings.app.formatSaveFile).toBe(true);
		expect(project.settings.app.guides.systemShowLabels).toBe(true);
	});

	it('keeps settings.anyink.canvasTheme dark and other saved values', () => {
		const project = importGlyphrProjectFromText(
			sampleFile((file) => {
				file.settings.anyink = {
					canvasTheme: 'dark',
					previewPt: 72,
					sheet: { pages: [{ id: 'p1', homography: [1], threshold: 1, speck: 1, overrides: {} }] },
				};
				return file;
			})
		);
		const a = project.settings.anyink;
		expect(a.canvasTheme).toBe('dark');
		expect(a.previewPt).toBe(72);
		expect(a.sheet.pages).toEqual([{ id: 'p1', homography: [1], threshold: 1, speck: 1, overrides: {} }]);
		expect(a.sheet.templateVersion).toBe(1);
		expect(a.nibDefaults).toEqual(new GlyphrStudioProject().settings.anyink.nibDefaults);
	});

	it('a re-saved file loads identically (removeDefaultValues-safe round trip)', () => {
		const first = importGlyphrProjectFromText(
			sampleFile((file) => {
				file.settings.anyink = { canvasTheme: 'dark', previewText: 'abc', roughenDefaults: { seed: 5 } };
				return file;
			})
		);
		// what saveProjectFile writes: save(), defaults stripped by ===, JSON text
		const defaults = new GlyphrStudioProject({});
		const saveData = first.save();
		Object.keys(saveData.settings).forEach((key) => {
			if (saveData.settings[key] === defaults.settings[key]) delete saveData.settings[key];
		});
		expect(saveData.settings.anyink).toBeDefined();
		const second = importGlyphrProjectFromText(JSON.parse(JSON.stringify(saveData)));
		expect(second.settings.anyink).toEqual(first.settings.anyink);
		expect(second.settings.anyink.canvasTheme).toBe('dark');
		expect(second.settings.anyink.roughenDefaults.seed).toBe(5);
	});

	it('hands a non-empty assets object to the editor AssetStore', async () => {
		const file = sampleFile((f) => ({ ...f, assets }));
		const project = importGlyphrProjectFromText(file);
		await flush();
		expect(editor.assets.calls.length).toBe(1);
		expect(editor.assets.calls[0]).toEqual(assets);
		expect('assets' in project.save()).toBe(false);
		expect(warn).not.toHaveBeenCalled();
	});

	// M7 finalize (M6 leak): the project kept the file's base64 for every image all session
	it('lets go of the base64 once the AssetStore has it', async () => {
		const project = importGlyphrProjectFromText(sampleFile((f) => ({ ...f, assets })));
		expect(project.assetsSaveObject).toBe(false);
		await flush();
		expect(editor.assets.calls[0]).toEqual(assets);
	});

	it('a failing asset load is a console.warn, not an import failure', async () => {
		editor.assets = fakeAssetStore(async () => {
			throw new Error('bad base64');
		});
		const project = importGlyphrProjectFromText(sampleFile((f) => ({ ...f, assets })));
		expect(project).toBeInstanceOf(GlyphrStudioProject);
		await flush();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('could not load project assets');
	});

	it('an editor without an AssetStore gets a warning and the project still opens', async () => {
		delete editor.assets;
		const project = importGlyphrProjectFromText(sampleFile((f) => ({ ...f, assets })));
		await flush();
		expect(project).toBeInstanceOf(GlyphrStudioProject);
		// Nothing took the images, so the project keeps them
		expect(project.assetsSaveObject).toEqual(assets);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('no AssetStore');
	});

	it('an empty assets object is ignored', async () => {
		const project = importGlyphrProjectFromText(sampleFile((f) => ({ ...f, assets: {} })));
		await flush();
		expect(project.assetsSaveObject).toBe(false);
		expect(editor.assets.calls).toEqual([]);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe('handOffProjectAssets', () => {
	it('returns false and touches nothing when there are no assets', () => {
		const store = fakeAssetStore();
		expect(handOffProjectAssets(false, { assets: store })).toBe(false);
		expect(handOffProjectAssets(undefined, { assets: store })).toBe(false);
		expect(store.calls).toEqual([]);
	});

	it('returns the pending load when there are assets', async () => {
		const store = fakeAssetStore();
		const pending = handOffProjectAssets(assets, { assets: store });
		expect(pending).toBeInstanceOf(Promise);
		await pending;
		expect(store.calls).toEqual([assets]);
	});

	it('swallows a synchronous throw from the store as a warning', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const store = {
			loadSaveObject() {
				throw new Error('sync boom');
			},
		};
		await handOffProjectAssets(assets, { assets: store });
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});
});
