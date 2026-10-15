// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import {
	commitSettingsHistory,
	forEachProjectItem,
	moveBaseline,
	setCustomGuideLocation,
	setFontMetric,
	shiftItemPaths,
} from '../font_metrics.js';
import { METRIC_LABELS } from '../metrics_math.js';

/**
 * A ProjectEditor on the simple sample project, with history and publish replaced by
 * recorders so the tests can see what the module asked for.
 */
function makeEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.history = {
		titles: [],
		addSettingsState(title) {
			this.titles.push(title);
		},
		addState(title) {
			this.titles.push(title);
		},
		addWholeProjectChangePreState(title) {
			this.titles.push(`pre:${title}`);
		},
		addWholeProjectChangePostState() {
			this.titles.push('post');
		},
	};
	editor.published = [];
	editor.publish = (topic, data) => editor.published.push({ topic, data });
	return editor;
}

describe('setFontMetric', () => {
	let editor;
	beforeEach(() => {
		editor = makeEditor();
	});

	it('writes, clamps, publishes fontMetrics, and records one settings entry', () => {
		const font = editor.project.settings.font;
		expect(font.xHeight).toBe(580);
		const applied = setFontMetric('xHeight', 900);
		expect(applied).toBe(790); // clamped to capHeight
		expect(font.xHeight).toBe(790);
		expect(editor.published).toHaveLength(1);
		expect(editor.published[0].topic).toBe('fontMetrics');
		expect(editor.published[0].data.key).toBe('xHeight');
		expect(editor.published[0].data.value).toBe(790);
		expect(editor.published[0].data.font).toBe(font);
		expect(editor.history.titles).toEqual([`Set ${METRIC_LABELS.xHeight} to 790`]);
	});

	it('uses the verb for drags and skips history when asked', () => {
		setFontMetric('ascent', 850, { verb: 'Moved' });
		expect(editor.history.titles).toEqual([`Moved ${METRIC_LABELS.ascent} to 850`]);
		setFontMetric('ascent', 860, { history: false });
		expect(editor.history.titles).toHaveLength(1);
		expect(editor.published).toHaveLength(2);
	});

	it('does nothing when the value does not change', () => {
		setFontMetric('descent', -200);
		setFontMetric('descent', 5); // clamps to -1, changes
		expect(editor.published).toHaveLength(1);
		setFontMetric('descent', 0); // clamps to -1 again, no change
		expect(editor.published).toHaveLength(1);
		expect(editor.history.titles).toEqual([`Set ${METRIC_LABELS.descent} to -1`]);
	});

	it('rejects unknown keys and leaves upm alone otherwise', () => {
		expect(setFontMetric('weight', 700)).toBe(false);
		expect(editor.project.settings.font.upm).toBe(1000);
		setFontMetric('xHeight', 500);
		expect(editor.project.settings.font.upm).toBe(1000);
	});
});

describe('setCustomGuideLocation', () => {
	it('moves a guide, publishes guides, records history', () => {
		const editor = makeEditor();
		const guides = editor.project.settings.app.guides;
		expect(guides.custom[0].name).toBe('Test guide');
		expect(setCustomGuideLocation(0, 333.4)).toBe(333);
		expect(guides.custom[0].location).toBe(333);
		expect(editor.published[0].topic).toBe('guides');
		expect(editor.published[0].data.index).toBe(0);
		expect(editor.published[0].data.guide).toBe(guides.custom[0]);
		expect(editor.history.titles).toEqual(['Moved Test guide to 333']);
		// unchanged: nothing more
		setCustomGuideLocation(0, 333);
		expect(editor.published).toHaveLength(1);
		// missing guide
		expect(setCustomGuideLocation(7, 10)).toBe(false);
	});
});

describe('commitSettingsHistory', () => {
	it('calls History.addSettingsState when it exists', () => {
		const editor = makeEditor();
		expect(commitSettingsHistory('Moved X height to 5')).toBe(true);
		expect(editor.history.titles).toEqual(['Moved X height to 5']);
	});

	it('survives an editor whose history has no addSettingsState', () => {
		const editor = makeEditor();
		editor.history = {};
		expect(commitSettingsHistory('anything')).toBe(false);
	});
});

describe('moveBaseline (D-009)', () => {
	it('shifts every Path by -delta, shifts the metric lines, wraps one whole-project change', () => {
		const editor = makeEditor();
		const project = editor.project;
		const font = project.settings.font;
		const glyph = project.glyphs['glyph-0x41'];
		const liga = project.ligatures['liga-A-B'];
		const before = {
			pointY: glyph.shapes[0].pathPoints[0].p.y,
			ligaY: liga.shapes[0].pathPoints ? liga.shapes[0].pathPoints[0].p.y : null,
			maxesYMax: glyph.maxes.yMax,
		};

		expect(moveBaseline(50)).toBe(50);

		expect(glyph.shapes[0].pathPoints[0].p.y).toBe(before.pointY - 50);
		expect(glyph.maxes.yMax).toBe(before.maxesYMax - 50);
		if (before.ligaY !== null) expect(liga.shapes[0].pathPoints[0].p.y).toBe(before.ligaY - 50);
		expect(font.ascent).toBe(750);
		expect(font.capHeight).toBe(740);
		expect(font.xHeight).toBe(530);
		expect(font.descent).toBe(-250);
		expect(font.upm).toBe(1000);

		expect(editor.history.titles).toEqual(['pre:Moved baseline', 'post']);
		const topics = editor.published.map((p) => p.topic);
		expect(topics).toEqual(['fontMetrics', 'currentItem']);
		expect(editor.published[0].data).toMatchObject({ key: 'baseline', value: 50 });
	});

	it('clamps the delta and does nothing for zero', () => {
		const editor = makeEditor();
		expect(moveBaseline(0)).toBe(0);
		expect(editor.history.titles).toEqual([]);
		// xHeight 580 -> at most 579 up
		expect(moveBaseline(5000)).toBe(579);
		expect(editor.project.settings.font.xHeight).toBe(1);
	});

	it('does not move component instances twice', () => {
		const editor = makeEditor();
		const project = editor.project;
		// Build a glyph made of one Path and one ComponentInstance pointing at glyph A
		const host = project.glyphs['glyph-0x42'];
		const instance = { objType: 'ComponentInstance', translateY: 7, cache: { a: 1 }, updateShapePosition() { throw new Error('instance moved'); } };
		host.shapes.push(instance);
		let paths = 0;
		forEachProjectItem(project, (item) => {
			item.shapes.forEach((s) => {
				if (s.objType === 'Path') paths += 1;
			});
		});
		expect(paths).toBeGreaterThan(0);
		shiftItemPaths(host, -10);
		expect(instance.translateY).toBe(7);
		expect(instance.cache).toEqual({});
	});
});
