// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the Brush track's hand-offs, each where another file owns the moment.
	  - project_data/path.js keeps a shape's anyink data (the stroke's id) through save(), the
	    constructor, an Undo step and a whole-font copy, so a stroke is a stroke after every one;
	    a shape with no anyink data saves exactly as upstream does
	  - edit_canvas.js sXcX / sYcY: a whole-unit point on the canvas's left or top edge (canvas 0)
	    draws there, not at the view's origin (the Brush's spikes through the ink in Chrome)
	  - edit_canvas/cursors.js: the Brush points with a crosshair as soon as it is picked
	  - pages/about.js: the five libraries the Brush ships with are credited, and their license
	    texts ship beside the app (src/public/THIRD-PARTY-NOTICES.txt; the BSD licenses ask it of
	    a built app)
*/
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor } from '../../../app/main.js';
import { updateCursor } from '../../../edit_canvas/cursors.js';
import { sXcX, sYcY } from '../../../edit_canvas/edit_canvas.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { isBrushStroke } from '../../letter/auto_hole.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { strokeIdOf, tagStroke } from '../stroke_record.js';

const here = dirname(fileURLToPath(import.meta.url));

function square(x0, y0, size) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Brush stroke 1',
		pathPoints: [
			corner(x0, y0),
			corner(x0 + size, y0),
			corner(x0 + size, y0 + size),
			corner(x0, y0 + size),
		],
	});
}

afterEach(() => {
	document.body.innerHTML = '';
	document.body.style.cursor = '';
	eventHandlerData.isMouseOverCanvas = false;
});

describe("a stroke's tag goes with its shape (path.js)", () => {
	it('save() and the constructor keep anyink; a copy never shares it with the live shape', () => {
		const path = square(0, 0, 100);
		tagStroke(path, 7);
		const saved = path.save();
		expect(saved.anyink).toEqual({ strokeId: 7 });
		saved.anyink.strokeId = 9;
		expect(strokeIdOf(path)).toBe(7);
		const copy = new Path(path.save());
		expect(strokeIdOf(copy)).toBe(7);
		expect(isBrushStroke(copy)).toBe(true);
	});

	it('a shape with no anyink data is exactly what upstream saves', () => {
		const path = square(0, 0, 100);
		expect(Object.hasOwn(path, 'anyink')).toBe(false);
		expect('anyink' in path.save()).toBe(false);
		expect(new Path({ name: 'x', anyink: {} }).anyink).toBeUndefined();
	});

	it('a glyph saved and opened again, and an Undo step, keep every stroke tagged', () => {
		const editor = sampleEditor();
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x41';
		const item = editor.selectedGlyph;
		item.shapes = [];
		const stroke = item.addOneShape(square(0, 0, 200));
		tagStroke(stroke, 1);
		editor.history.addState('drew a stroke on Capital A');
		expect(new Glyph(item.save()).shapes.map(strokeIdOf)).toEqual([1]);
		item.addOneShape(square(300, 0, 200));
		editor.history.addState('drew a square');
		editor.history.restoreState();
		const back = getCurrentProjectEditor().project.getItem('glyph-0x41');
		expect(back.shapes).toHaveLength(1);
		expect(strokeIdOf(back.shapes[0])).toBe(1);
	});
});

describe("a point on the canvas's edge draws on the edge (edit_canvas.js)", () => {
	it('canvas x or y of exactly 0 is 0, not the view origin', () => {
		const view = { dx: 300, dy: 700, dz: 1 };
		expect(sXcX(-300, view)).toBe(0);
		expect(sYcY(700, view)).toBe(0);
		expect(sXcX(10, view)).toBe(310);
		expect(sYcY(10, view)).toBe(690);
	});

	it('a value that is not a number still falls back to the origin, as before', () => {
		const view = { dx: 300, dy: 700, dz: 1 };
		expect(sXcX(undefined, view)).toBe(300);
		expect(sYcY(Number.NaN, view)).toBe(700);
	});
});

describe('the Brush points with a crosshair (cursors.js)', () => {
	it('over the canvas, from the moment it is picked', () => {
		const editor = sampleEditor();
		editor.selectedTool = 'nib';
		eventHandlerData.isMouseOverCanvas = true;
		updateCursor();
		expect(document.body.style.cursor).toContain('crosshair');
		editor.selectedTool = 'resize';
		updateCursor();
		expect(document.body.style.cursor).not.toContain('crosshair');
	});
});

describe('credits for the Brush libraries (About, FACTCHECK_LOG)', () => {
	const NAMES = [
		['clipper2-ts', 'Angus Johnson', /Boost Software License/],
		['perfect-freehand', 'Steve Ruiz', /MIT License/],
		['1eurofilter', 'Casiez', /BSD 3-Clause|BSD License/],
		['fit-curve', 'Volker Poplawski', /MIT License/],
		['simplify-js', 'Vladimir Agafonkin', /Redistribution and use in source and binary forms/],
	];

	it('About > Credits names each one, its license and its copyright, in both modes', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const mode of ['all', 'simple']) {
			setModeForTests(mode);
			const editor = sampleEditor();
			document.body.innerHTML = '<div id="app__wrapper"></div>';
			editor.nav.page = 'About';
			editor.navigate();
			const credits = [...document.querySelectorAll('.tab-control__tab')].find(
				(tab) => tab.textContent === 'Credits'
			);
			credits?.click();
			const said = document.querySelector('.content-page__right-area').textContent;
			[
				'Angus Johnson',
				'Stephen Ruiz',
				'Casiez',
				'Volker Poplawski',
				'Vladimir Agafonkin',
				'Boost Software License',
				'BSD 3-Clause',
				'BSD 2-Clause',
				'THIRD-PARTY-NOTICES.txt',
			].forEach((text) => expect(said, `${mode}: ${text}`).toContain(text));
		}
		setModeForTests('all');
	});

	it('THIRD-PARTY-NOTICES.txt ships each license in full', () => {
		const notices = readFileSync(join(here, '../../../public/THIRD-PARTY-NOTICES.txt'), 'utf8');
		NAMES.forEach(([name, who, license]) => {
			expect(notices, name).toContain(name);
			expect(notices, name).toContain(who);
			expect(notices, name).toMatch(license);
		});
		expect(notices).not.toMatch(/\r/);
	});
});
