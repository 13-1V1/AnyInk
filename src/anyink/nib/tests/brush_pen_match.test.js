// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16 fix (acceptance T4): the first Brush stroke on small o, after 7 letters were traced from
	a felt-tip photo, came out 45 % thinner than the traced letters ("Note: thinner than your
	other letters."). In a font with letters traced from a photo, the Brush starts at the pen
	those letters were written with: the median line thickness of the traced letters (the same
	2 x area / perimeter measure as the soft note). A size he picks with the slider while that
	pen is the font's pen stays his; a font with no traced letters keeps the saved size.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { twoLetterEditor, square } from '../../history/tests/two_letters.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { strokeEstimate } from '../../spacing/measure.js';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import {
	DEFAULT_SHARE,
	MAX_SHARE,
	brushShare,
	brushSize,
	penWeight,
	resetBrushForTests,
	setBrushShare,
} from '../brush_size.js';
import { makeBrushSize } from '../size_control.js';

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetBrushForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	localStorage.clear();
	resetPrefsCache();
});

/** A bar `thick` units wide and 400 tall, its stroke estimate close to `thick`. */
function bar(thick) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Traced',
		pathPoints: [
			corner(100, 0),
			corner(100 + thick, 0),
			corner(100 + thick, 400),
			corner(100, 400),
		],
	});
}

/** Adds letters traced from a photo (item.anyink.photoFit), one per thickness. */
function traceLetters(project, thicknesses, { photo = true } = {}) {
	thicknesses.forEach((thick, index) => {
		const id = `glyph-0x${(0x61 + index).toString(16)}`;
		const glyph = new Glyph({ id, shapes: [] });
		glyph.shapes.push(bar(thick));
		glyph.parent = project;
		if (photo) glyph.anyink = { photoFit: { asset: 'p1', part: `part-${index}`, ink: '' } };
		project.glyphs[id] = glyph;
	});
}

describe('the Brush starts at the pen of the traced letters', () => {
	it('penWeight is the median thickness of the letters traced from a photo', () => {
		const { project } = twoLetterEditor();
		expect(penWeight(project)).toBeNull();
		traceLetters(project, [80, 90, 100, 110, 300]);
		const expected = strokeEstimate(project.glyphs['glyph-0x63']);
		expect(penWeight(project)).toBeCloseTo(expected, 5);
	});

	it('letters drawn some other way (no photo) and too few traced letters leave it unknown', () => {
		const { project } = twoLetterEditor();
		traceLetters(project, [80, 90, 100], { photo: false });
		expect(penWeight(project)).toBeNull();
		const two = twoLetterEditor().project;
		traceLetters(two, [80, 90]);
		expect(penWeight(two)).toBeNull();
	});

	it('a font with traced letters starts the Brush at their pen, not at 9 %', () => {
		const { project } = twoLetterEditor();
		traceLetters(project, [80, 90, 100, 110, 120]);
		const pen = penWeight(project);
		expect(brushSize(project)).toBe(Math.round(pen));
		expect(brushShare(project)).toBeCloseTo(pen / 500, 5);
		// and a font with none keeps the default
		expect(brushShare(twoLetterEditor().project)).toBe(DEFAULT_SHARE);
	});

	it('the slider starts where the Brush will draw', () => {
		const editor = twoLetterEditor();
		traceLetters(editor.project, [80, 90, 100, 110, 120]);
		const control = makeBrushSize({ project: editor.project });
		const slider = control.querySelector('input[type="range"]');
		expect(Number(slider.value)).toBeCloseTo(penWeight(editor.project) / 500, 2);
	});

	it('a size he picks for this pen stays his', () => {
		const { project } = twoLetterEditor();
		traceLetters(project, [80, 90, 100, 110, 120]);
		setBrushShare(0.12, project);
		resetBrushForTests();
		expect(brushShare(project)).toBe(0.12);
		expect(brushSize(project)).toBe(60);
	});

	it("a size picked for another pen (or no pen) gives way to this font's pen", () => {
		const { project } = twoLetterEditor();
		setBrushShare(0.05, twoLetterEditor().project);
		traceLetters(project, [80, 90, 100, 110, 120]);
		expect(brushSize(project)).toBe(Math.round(penWeight(project)));
		expect(brushShare(twoLetterEditor().project)).toBe(0.05);
	});

	it('a very thick pen is kept inside thin and thick', () => {
		const { project } = twoLetterEditor();
		traceLetters(project, [380, 390, 400]);
		expect(brushShare(project)).toBe(MAX_SHARE);
	});

	it('a square traced letter counts like any other', () => {
		const { project } = twoLetterEditor();
		traceLetters(project, [80, 90]);
		const glyph = new Glyph({ id: 'glyph-0x7a', shapes: [] });
		glyph.shapes.push(square(100, 200));
		glyph.parent = project;
		glyph.anyink = { photoFit: { asset: 'p1', part: 'z', ink: '' } };
		project.glyphs['glyph-0x7a'] = glyph;
		expect(penWeight(project)).not.toBeNull();
	});
});
