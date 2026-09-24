// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8, track B: putting auto-traced shapes into a glyph (apply.js) against a real
// ProjectEditor and the real history: replace vs add, one history entry each, undo gives back
// exactly the old outlines, the trace image is never touched.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { getTrace, makeTrace, setTrace } from '../../trace/trace_model.js';
import { applyAutoTrace, autoTraceHistoryTitle } from '../apply.js';
import { countPoints, potraceSvgToShapes } from '../svg_to_shapes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', `${name}.svg`), 'utf8');

let editor;
let glyph;
let heard;

/** The traced O, placed on glyph A's trace image the way the facade would place it. */
function tracedO(trace = getTrace(glyph)) {
	return potraceSvgToShapes(fixture('letter_o'), {
		x: trace.x,
		y: trace.y,
		scale: (trace.scale * trace.width) / 200,
	});
}

const shapesJSON = (item) => JSON.stringify(item.shapes.map((s) => s.save()));

beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
	glyph = editor.selectedItem;
	setTrace(glyph, {
		...makeTrace({ asset: 'img-apply001', width: 400, height: 400 }, project.settings.font),
		opacity: 0.35,
		invert: true,
		locked: true,
	});
	// As trace_import.js records it, so undo has an entry to go back to
	editor.history.addState('Added a trace image');
	heard = [];
	const publish = editor.publish.bind(editor);
	editor.publish = (topic, data) => {
		if (topic === 'currentItem') heard.push(data);
		return publish(topic, data);
	};
});

describe('autoTraceHistoryTitle', () => {
	it('says how many shapes and points, in plain words', () => {
		expect(autoTraceHistoryTitle(3, 412)).toBe('Auto-traced 3 shapes (412 points)');
		expect(autoTraceHistoryTitle(1, 1)).toBe('Auto-traced 1 shape (1 point)');
		expect(autoTraceHistoryTitle(12, 1204)).toBe('Auto-traced 12 shapes (1,204 points)');
		expect(autoTraceHistoryTitle(0, 0)).toBe('Auto-traced 0 shapes (0 points)');
	});
});

describe("applyAutoTrace 'replace'", () => {
	it('swaps the outlines for the traced ones, one history entry, publishes currentItem', () => {
		const shapes = tracedO();
		const before = editor.history.length;
		expect(glyph.shapes).toHaveLength(2);

		expect(applyAutoTrace({ editor, item: glyph, shapes, mode: 'replace' })).toBe(true);

		expect(glyph.shapes).toHaveLength(2);
		expect(glyph.shapes.map((s) => s.name)).toEqual(['Auto-trace 1', 'Auto-trace 2']);
		expect(shapesJSON(glyph)).toBe(JSON.stringify(shapes.map((s) => s.save())));
		expect(editor.history.length).toBe(before + 1);
		expect(editor.history.queue[0].title).toBe(
			`Auto-traced 2 shapes (${countPoints(shapes)} points)`
		);
		expect(heard).toEqual([glyph]);
	});

	it('undo gives back exactly the old outlines; redo brings the traced ones back', () => {
		const original = shapesJSON(glyph);
		const shapes = tracedO();
		applyAutoTrace({ editor, item: glyph, shapes, mode: 'replace' });
		const traced = shapesJSON(editor.selectedItem);

		editor.history.restoreState();
		expect(shapesJSON(editor.selectedItem)).toBe(original);

		editor.history.redoState();
		expect(shapesJSON(editor.selectedItem)).toBe(traced);
	});

	it('never touches the trace image, and undo keeps it too', () => {
		const trace = glyph.anyink.trace;
		const snapshot = structuredClone(trace);
		applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode: 'replace' });
		expect(glyph.anyink.trace).toBe(trace);
		expect(glyph.anyink.trace).toEqual(snapshot);
		editor.history.restoreState();
		expect(getTrace(editor.selectedItem)).toEqual(snapshot);
	});

	it('clears the point and shape selection (the old shapes are gone)', () => {
		editor.multiSelect.shapes.select(glyph.shapes[0]);
		editor.multiSelect.points.select(glyph.shapes[0].pathPoints[0]);
		expect(editor.multiSelect.shapes.count).toBe(1);
		applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode: 'replace' });
		expect(editor.multiSelect.shapes.count).toBe(0);
		expect(editor.multiSelect.points.count).toBe(0);
	});

	it('the glyph gets its own copies; the preview shapes stay as they were', () => {
		const shapes = tracedO();
		const before = JSON.stringify(shapes.map((s) => s.save()));
		applyAutoTrace({ editor, item: glyph, shapes, mode: 'replace' });
		for (const shape of glyph.shapes) {
			expect(shapes).not.toContain(shape);
			expect(shape.parent).toBe(glyph);
		}
		for (const shape of shapes) expect(shape.parent).toBe(false);
		// Editing the glyph does not move the preview
		glyph.shapes[0].pathPoints[0].p.coord.x += 50;
		expect(JSON.stringify(shapes.map((s) => s.save()))).toBe(before);
	});

	it('a glyph with component instances: one step, and undo brings back the "used in" lists', () => {
		const text = readFileSync(join(here, '../../../samples/oblegg.gs2'), 'utf8');
		const project = importGlyphrProjectFromText(text);
		editor = new ProjectEditor({ project });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x3A'; // colon: two instances of comp-0
		const colon = editor.selectedItem;
		const original = shapesJSON(colon);
		const usedInBefore = [...project.getItem('comp-0').usedIn];
		expect(usedInBefore.filter((id) => id === 'glyph-0x3A')).toHaveLength(2);
		const before = editor.history.length;

		const shapes = potraceSvgToShapes(fixture('square_hole'), { x: 0, y: 700, scale: 10 });
		expect(applyAutoTrace({ editor, item: colon, shapes, mode: 'replace' })).toBe(true);
		expect(colon.shapes.every((s) => s.objType === 'Path')).toBe(true);
		expect(editor.project.getItem('comp-0').usedIn).not.toContain('glyph-0x3A');
		expect(editor.history.length).toBe(before + 1);
		expect(editor.history.queue[1].title).toBe('Auto-traced 2 shapes (8 points)');

		editor.history.restoreState();
		const restored = editor.project.getItem('glyph-0x3A');
		expect(shapesJSON(restored)).toBe(original);
		expect(editor.project.getItem('comp-0').usedIn).toEqual(usedInBefore);
	});
});

describe("applyAutoTrace 'add'", () => {
	it('keeps the old outlines and adds the traced ones after them, one history entry', () => {
		const original = glyph.shapes.map((s) => JSON.stringify(s.save()));
		const shapes = tracedO();
		const before = editor.history.length;

		expect(applyAutoTrace({ editor, item: glyph, shapes, mode: 'add' })).toBe(true);

		expect(glyph.shapes).toHaveLength(4);
		expect(glyph.shapes.slice(0, 2).map((s) => JSON.stringify(s.save()))).toEqual(original);
		expect(glyph.shapes.slice(2).map((s) => s.name)).toEqual(['Auto-trace 1', 'Auto-trace 2']);
		expect(editor.history.length).toBe(before + 1);
		expect(editor.history.queue[0].title).toMatch(/^Auto-traced 2 shapes \(\d+ points\)$/);
		expect(heard).toEqual([glyph]);
	});

	it('undo gives back exactly the old outlines, and the trace stays', () => {
		const original = shapesJSON(glyph);
		const trace = getTrace(glyph);
		applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode: 'add' });
		editor.history.restoreState();
		expect(shapesJSON(editor.selectedItem)).toBe(original);
		expect(getTrace(editor.selectedItem)).toEqual(trace);
	});

	it('two applies in a row are two steps, each undone on its own', () => {
		const original = shapesJSON(glyph);
		applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode: 'add' });
		const afterFirst = shapesJSON(glyph);
		applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode: 'add' });
		expect(glyph.shapes).toHaveLength(6);
		editor.history.restoreState();
		expect(shapesJSON(editor.selectedItem)).toBe(afterFirst);
		editor.history.restoreState();
		expect(shapesJSON(editor.selectedItem)).toBe(original);
	});
});

describe('applyAutoTrace refuses, changing nothing and recording nothing', () => {
	function expectNothingChanged(result, original, before) {
		expect(result).toBe(false);
		expect(shapesJSON(glyph)).toBe(original);
		expect(editor.history.length).toBe(before);
		expect(heard).toEqual([]);
	}

	it('with no shapes, or only broken ones (a blank image never wipes a glyph)', () => {
		const original = shapesJSON(glyph);
		const before = editor.history.length;
		expectNothingChanged(
			applyAutoTrace({ editor, item: glyph, shapes: [], mode: 'replace' }),
			original,
			before
		);
		expectNothingChanged(
			applyAutoTrace({ editor, item: glyph, shapes: null, mode: 'replace' }),
			original,
			before
		);
		expectNothingChanged(
			applyAutoTrace({
				editor,
				item: glyph,
				shapes: [{ objType: 'Path', pathPoints: [] }],
				mode: 'add',
			}),
			original,
			before
		);
	});

	it('with a mode that is not replace or add', () => {
		const original = shapesJSON(glyph);
		const before = editor.history.length;
		for (const mode of [undefined, 'merge', 'REPLACE']) {
			expectNothingChanged(
				applyAutoTrace({ editor, item: glyph, shapes: tracedO(), mode }),
				original,
				before
			);
		}
	});

	it('for an item that is not the selected one (history would record the wrong glyph)', () => {
		const original = shapesJSON(glyph);
		const before = editor.history.length;
		const other = editor.project.getItem('glyph-0x42');
		const otherOriginal = shapesJSON(other);
		expect(applyAutoTrace({ editor, item: other, shapes: tracedO(), mode: 'replace' })).toBe(false);
		expect(shapesJSON(other)).toBe(otherOriginal);
		expectNothingChanged(false, original, before);
	});

	it('with no editor or no item', () => {
		expect(applyAutoTrace({ item: glyph, shapes: tracedO(), mode: 'add' })).toBe(false);
		expect(applyAutoTrace({ editor, shapes: tracedO(), mode: 'add' })).toBe(false);
		expect(applyAutoTrace()).toBe(false);
	});
});
