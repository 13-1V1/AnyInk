// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3: applyAutoTrace's options (UX-BEGINNER 4.4 "Use it", section 10 B3): { round: true } puts the
// traced shapes in with every point and handle on a whole font unit, and { title } names the
// Undo step ("traced r"). Without options it is exactly the auto-trace More tools has today.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { applyAutoTrace } from '../apply.js';

const here = dirname(fileURLToPath(import.meta.url));
let editor;
let glyph;

/** A curved piece with fractional points and handles, as potrace makes them. */
function fractionalShape(x = 100.4) {
	return new Path({
		name: 'Traced',
		pathPoints: [
			{ type: 'corner', p: { coord: { x, y: 0.6 } } },
			{
				type: 'flat',
				p: { coord: { x: x + 200.5, y: 0.2 } },
				h1: { coord: { x: x + 150.25, y: -20.7 } },
				h2: { coord: { x: x + 250.75, y: 20.3 } },
			},
			{ type: 'corner', p: { coord: { x: x + 199.49, y: 300.51 } } },
		],
	});
}

/** Every point and handle of the given shapes, as numbers. */
function coordinates(shapes) {
	const out = [];
	shapes.forEach((shape) =>
		shape.pathPoints.forEach((point) => {
			out.push(point.p.x, point.p.y, point.h1.x, point.h1.y, point.h2.x, point.h2.y);
		})
	);
	return out;
}

beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
	editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	glyph = editor.selectedItem;
	editor.history.addState('Opened A');
});

describe('applyAutoTrace options', () => {
	it('{ round: true } puts every point and handle on a whole unit', () => {
		const shape = fractionalShape();
		expect(coordinates([shape]).every(Number.isInteger)).toBe(false);
		expect(
			applyAutoTrace({ editor, item: glyph, shapes: [shape], mode: 'replace' }, { round: true })
		).toBe(true);
		expect(glyph.shapes).toHaveLength(1);
		const placed = coordinates(glyph.shapes);
		expect(placed.every(Number.isInteger)).toBe(true);
		// Rounded to the nearest unit, not moved
		expect(placed).toEqual(coordinates([shape]).map((value) => Math.round(value)));
		// The caller's shapes (the preview's) are not touched
		expect(coordinates([shape]).every(Number.isInteger)).toBe(false);
	});

	it('{ round: true } with "add" rounds only the shapes it adds', () => {
		glyph.shapes[0].pathPoints[0].p.x += 0.25;
		const count = glyph.shapes.length;
		const kept = coordinates(glyph.shapes);
		applyAutoTrace({ editor, item: glyph, shapes: [fractionalShape()], mode: 'add' }, { round: true });
		expect(glyph.shapes).toHaveLength(count + 1);
		expect(coordinates(glyph.shapes.slice(0, count))).toEqual(kept);
		expect(coordinates(glyph.shapes.slice(count)).every(Number.isInteger)).toBe(true);
	});

	it('{ title } names the Undo step', () => {
		applyAutoTrace(
			{ editor, item: glyph, shapes: [fractionalShape()], mode: 'replace' },
			{ round: true, title: 'traced A' }
		);
		expect(editor.history.queue[0].title).toBe('traced A');
		editor.history.restoreState();
		expect(editor.history.queue[0].title).toBe('Opened A');
	});

	it('{ title } names a whole-font step too (a letter with component instances)', () => {
		const text = readFileSync(join(here, '../../../samples/oblegg.gs2'), 'utf8');
		editor = new ProjectEditor({ project: importGlyphrProjectFromText(text) });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x3A'; // colon: two instances of comp-0
		const colon = editor.selectedItem;
		applyAutoTrace(
			{ editor, item: colon, shapes: [fractionalShape()], mode: 'replace' },
			{ round: true, title: 'traced the colon' }
		);
		expect(editor.history.queue[0].wholeProjectSave).toBe(true);
		expect(editor.history.queue[1].title).toBe('traced the colon');
		expect(coordinates(colon.shapes).every(Number.isInteger)).toBe(true);
	});

	it('with no options it is the auto-trace More tools has today: shapes as traced, the counting title', () => {
		const shape = fractionalShape();
		applyAutoTrace({ editor, item: glyph, shapes: [shape], mode: 'replace' });
		expect(coordinates(glyph.shapes)).toEqual(coordinates([shape]));
		expect(editor.history.queue[0].title).toBe('Auto-traced 1 shape (3 points)');
	});

	it('a blank title falls back to the counting title', () => {
		applyAutoTrace({ editor, item: glyph, shapes: [fractionalShape()], mode: 'replace' }, { title: '  ' });
		expect(editor.history.queue[0].title).toBe('Auto-traced 1 shape (3 points)');
	});
});
