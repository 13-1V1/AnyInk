// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject, isNonEmptyObject } from '../glyphr_studio_project.js';

/** The block DESIGN_DOC section 4 specifies for a new project */
const ANYINK_DEFAULTS = {
	formatVersion: 1,
	canvasTheme: 'light',
	previewText: '',
	previewPt: 48,
	nibDefaults: { shape: 'flat', width: 60, thickness: 0.35, angle: 30, pressure: 0.5 },
	roughenDefaults: { size: 12, detail: 6, spread: 4, seed: 1 },
	sheet: { templateVersion: 1, pages: [] },
};

/** A minimal upstream-shaped file: no settings.anyink at all */
function upstreamFile(extraSettings = {}) {
	return {
		settings: {
			project: { name: 'Plain', latestVersion: '2.10.5' },
			app: {},
			font: { family: 'Plain' },
			...extraSettings,
		},
		glyphs: {},
		ligatures: {},
		components: {},
		kerning: {},
	};
}

describe('settings.anyink template', () => {
	it('a new project carries the DESIGN_DOC defaults', () => {
		const project = new GlyphrStudioProject();
		expect(project.settings.anyink).toEqual(ANYINK_DEFAULTS);
	});

	it('an upstream file without settings.anyink gets the defaults', () => {
		const project = new GlyphrStudioProject(upstreamFile());
		expect(project.settings.anyink).toEqual(ANYINK_DEFAULTS);
	});

	it('saved values win over the defaults, key by key', () => {
		const project = new GlyphrStudioProject(
			upstreamFile({
				anyink: {
					canvasTheme: 'dark',
					previewText: 'Hamburgefonstiv',
					previewPt: 72,
					nibDefaults: { width: 90 },
					roughenDefaults: { seed: 7 },
				},
			})
		);
		const a = project.settings.anyink;
		expect(a.canvasTheme).toBe('dark');
		expect(a.previewText).toBe('Hamburgefonstiv');
		expect(a.previewPt).toBe(72);
		// partial nested objects keep the other defaults
		expect(a.nibDefaults).toEqual({ ...ANYINK_DEFAULTS.nibDefaults, width: 90 });
		expect(a.roughenDefaults).toEqual({ ...ANYINK_DEFAULTS.roughenDefaults, seed: 7 });
		expect(a.formatVersion).toBe(1);
		expect(a.sheet).toEqual({ templateVersion: 1, pages: [] });
	});

	it('sheet.pages is copied as a whole array, not aliased', () => {
		const pages = [
			{ id: 'p1', homography: [1, 0, 0, 0, 1, 0, 0, 0, 1], threshold: 128, speck: 4, overrides: {} },
			{ id: 'p2', homography: [1, 0, 0, 0, 1, 0, 0, 0, 1], threshold: 100, speck: 2, overrides: { a: 1 } },
		];
		const file = upstreamFile({ anyink: { sheet: { templateVersion: 2, pages } } });
		const project = new GlyphrStudioProject(file);
		expect(project.settings.anyink.sheet.templateVersion).toBe(2);
		expect(project.settings.anyink.sheet.pages).toEqual(pages);
		expect(project.settings.anyink.sheet.pages).not.toBe(pages);
		pages[0].threshold = 1;
		expect(project.settings.anyink.sheet.pages[0].threshold).toBe(128);
	});

	it('upstream booleans that differ from the default survive construction', () => {
		// formatSaveFile defaults to false; the sample project saves true
		const project = new GlyphrStudioProject(
			upstreamFile({ app: { formatSaveFile: true, guides: { systemShowLabels: true } } })
		);
		expect(project.settings.app.formatSaveFile).toBe(true);
		expect(project.settings.app.guides.systemShowLabels).toBe(true);
		const other = new GlyphrStudioProject(upstreamFile({ app: { stopPageNavigation: false } }));
		expect(other.settings.app.stopPageNavigation).toBe(false);
	});
});

describe('settings.anyink save round trip', () => {
	const changed = {
		formatVersion: 1,
		canvasTheme: 'dark',
		previewText: 'quick brown fox',
		previewPt: 96,
		nibDefaults: { shape: 'round', width: 40, thickness: 0.5, angle: 45, pressure: 0.8 },
		roughenDefaults: { size: 20, detail: 3, spread: 2, seed: 99 },
		sheet: {
			templateVersion: 1,
			pages: [{ id: 'p1', homography: [1, 2, 3], threshold: 90, speck: 1, overrides: {} }],
		},
	};

	it('save() includes settings.anyink', () => {
		const project = new GlyphrStudioProject(upstreamFile({ anyink: changed }));
		expect(project.save().settings.anyink).toEqual(changed);
	});

	it('save -> new project from save -> deep-equal settings.anyink', () => {
		const first = new GlyphrStudioProject(upstreamFile({ anyink: changed }));
		const second = new GlyphrStudioProject(first.save());
		expect(second.settings.anyink).toEqual(first.settings.anyink);
		expect(second.settings.anyink).toEqual(changed);
	});

	it('survives the JSON text of the .gs2 file', () => {
		const first = new GlyphrStudioProject(upstreamFile({ anyink: changed }));
		const text = JSON.stringify(first.save());
		const second = new GlyphrStudioProject(JSON.parse(text));
		expect(second.settings.anyink).toEqual(changed);
		// the defaults round trip too
		const plain = new GlyphrStudioProject();
		const again = new GlyphrStudioProject(JSON.parse(JSON.stringify(plain.save())));
		expect(again.settings.anyink).toEqual(ANYINK_DEFAULTS);
	});

	it('does not alias the live settings', () => {
		const project = new GlyphrStudioProject(upstreamFile({ anyink: changed }));
		const saved = project.save();
		saved.settings.anyink.sheet.pages[0].threshold = 5;
		saved.settings.anyink.canvasTheme = 'light';
		expect(project.settings.anyink.sheet.pages[0].threshold).toBe(90);
		expect(project.settings.anyink.canvasTheme).toBe('dark');
	});
});

describe('project assets (D-011 / D-012)', () => {
	const assets = { 'img-abcd1234': { type: 'image/png', data: 'iVBORw0KGgo=' } };

	it('save() never emits an assets property', () => {
		expect('assets' in new GlyphrStudioProject().save()).toBe(false);
		const withAssets = new GlyphrStudioProject({ ...upstreamFile(), assets });
		expect('assets' in withAssets.save()).toBe(false);
	});

	it('keeps a non-empty assets object on assetsSaveObject by reference', () => {
		const project = new GlyphrStudioProject({ ...upstreamFile(), assets });
		expect(project.assetsSaveObject).toBe(assets);
	});

	it('assetsSaveObject is false when the file has no usable assets', () => {
		expect(new GlyphrStudioProject().assetsSaveObject).toBe(false);
		expect(new GlyphrStudioProject(upstreamFile()).assetsSaveObject).toBe(false);
		expect(new GlyphrStudioProject({ ...upstreamFile(), assets: {} }).assetsSaveObject).toBe(false);
		expect(new GlyphrStudioProject({ ...upstreamFile(), assets: null }).assetsSaveObject).toBe(false);
		expect(new GlyphrStudioProject({ ...upstreamFile(), assets: [] }).assetsSaveObject).toBe(false);
		expect(new GlyphrStudioProject({ ...upstreamFile(), assets: 'x' }).assetsSaveObject).toBe(false);
	});

	it('assets do not leak into the project through save()', () => {
		const project = new GlyphrStudioProject({ ...upstreamFile(), assets });
		const second = new GlyphrStudioProject(project.save());
		expect(second.assetsSaveObject).toBe(false);
	});

	it('isNonEmptyObject', () => {
		expect(isNonEmptyObject({ a: 1 })).toBe(true);
		expect(isNonEmptyObject({})).toBe(false);
		expect(isNonEmptyObject([1])).toBe(false);
		expect(isNonEmptyObject(null)).toBe(false);
		expect(isNonEmptyObject('a')).toBe(false);
		expect(isNonEmptyObject(undefined)).toBe(false);
	});
});
