// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 fix pass, through the app's checks cache and the real fixes (UX-BEGINNER.md 4.2,
// 7.2; principle 6: a fix button never does nothing). What the board, the card and the Next
// line read (cache.js checksSource), and what one press of the offered fix leaves. Written to
// fail first against the checks as they were (scratchpad orig.config.mjs):
//   - a Brush n drawn to the line was amber ("sinks below the writing line");
//   - g p q lifted 10 % were Ready; the critic's g 700 units up got Match size and stayed
//     floating, Ready;
//   - a Brush tap beside n left it Ready;
//   - a small comma on the line "sank", and Sit on the line could not move it.
// The y's Sit on the line waits on the fixes track (fix_shapes.js bodyBottom reads its own
// half-width row for a y, which is half way up its V): see the checks track's report.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { brushSize, resetBrushForTests } from '../../nib/brush_size.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { fitAllAutomatic } from '../../spacing/auto_space.js';
import { resetToastsForTests } from '../../toast/toast.js';
import {
	checksSource,
	getChecksCache,
	letterStamp,
	resetChecksCacheForTests,
} from '../cache.js';
import { CHECK, LINE_SHARE, measureLetter } from '../checks.js';
import { useNeedsALook } from '../fix_step.js';
import { runFixAction } from '../fixes.js';
import {
	AUTO,
	FONT,
	bowlAndStem,
	brushInto,
	checksFont,
	comma,
	letter,
	moved,
	penArc,
	penLine,
	plain,
	shapesFor,
	slashComma,
	tinyComma,
} from './letters.js';

let quiet = [];
beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	quiet = [
		vi.spyOn(console, 'warn').mockImplementation(() => {}),
		vi.spyOn(console, 'log').mockImplementation(() => {}),
	];
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetToastsForTests();
	resetChecksCacheForTests();
	resetBrushForTests();
	useNeedsALook(checksSource);
});
afterEach(() => {
	useNeedsALook(null);
	resetChecksCacheForTests();
	resetToastsForTests();
	quiet.forEach((spy) => spy.mockRestore());
	setModeForTests('all');
});

const TOLERANCE = LINE_SHARE * FONT.upm;
const LIFT = Math.round(0.1 * FONT.upm);
const X = FONT.xHeight;

function editorOn(project) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = project;
	editor.nav.page = 'Overview';
	return editor;
}

const look = (editor, char) => checksSource(letter(editor.project, char), { editor });
const state = (editor, char) => getChecksCache().state(editor, letter(editor.project, char));

/** Presses the Next line's button for this letter, as rule 7 passes it */
function press(editor, char) {
	const first = look(editor, char);
	if (!first) return false;
	return runFixAction({ char, check: first.id, ...first.args }, { editor });
}

/** Presses the offered fix until the letter is Ready (at most `most` presses) */
function pressUntilReady(editor, char, most = 3) {
	const presses = [];
	while (look(editor, char) && presses.length < most) {
		presses.push(look(editor, char).id);
		expect(press(editor, char)).toBe(true);
	}
	return presses;
}

describe('Brush letters drawn to the line', () => {
	it('small n, its stems ending on the writing line: Ready on the board', () => {
		const font = checksFont({ ...plain('Hoae'), n: { shapes: [], anyink: { ...AUTO } } });
		const glyph = letter(font, 'n');
		const nib = brushSize(font);
		brushInto(glyph, penLine([200, X], [200, 0]), nib);
		brushInto(
			glyph,
			[...penArc(450, X - 250, 250, 180, 0), ...penLine([700, X - 250], [700, 0]).slice(1)],
			nib
		);
		fitAllAutomatic(font);
		const editor = editorOn(font);
		expect(look(editor, 'n')).toBeNull();
		expect(state(editor, 'n').ready).toBe(true);
	});
});

describe('tail letters lifted off the line', () => {
	it.each([
		['g', () => shapesFor('g')],
		['p', () => bowlAndStem('p')],
		['q', () => bowlAndStem('q')],
	])('%s lifted a tenth of the box: one Sit on the line seats its bowl', (char, draw) => {
		const lifted = { shapes: moved(draw(), 0, LIFT), anyink: { ...AUTO } };
		const editor = editorOn(checksFont({ ...plain('Hoae'), [char]: lifted }));
		expect(look(editor, char)).toMatchObject({ id: CHECK.offLine, fix: 'sitOnLine' });
		expect(state(editor, char).ready).toBe(false);
		expect(press(editor, char)).toBe(true);
		expect(look(editor, char)).toBeNull();
		const { body } = measureLetter(letter(editor.project, char), FONT);
		expect(Math.abs(body.bottom)).toBeLessThanOrEqual(TOLERANCE);
	});

	it("the critic's g, 700 up and too tall: the fixes offered end with the bowl on the line", () => {
		const editor = editorOn(
			checksFont({
				...plain('Hoae'),
				g: { shapes: moved(shapesFor('g'), 0, 700), anyink: { ...AUTO } },
			})
		);
		const presses = pressUntilReady(editor, 'g');
		expect(presses[0]).toBe(CHECK.offLine);
		expect(state(editor, 'g').ready).toBe(true);
		const { body } = measureLetter(letter(editor.project, 'g'), FONT);
		expect(Math.abs(body.bottom)).toBeLessThanOrEqual(TOLERANCE);
	});
});

describe('a Brush tap beside small n', () => {
	it('needs a look with Remove 1 speck; the press takes the tap and leaves both strokes', () => {
		const font = checksFont({ ...plain('Hoae'), n: { shapes: [], anyink: { ...AUTO } } });
		const glyph = letter(font, 'n');
		const nib = brushSize(font);
		brushInto(glyph, penLine([200, X], [200, 0]), nib);
		brushInto(
			glyph,
			[...penArc(450, X - 250, 250, 180, 0), ...penLine([700, X - 250], [700, 0]).slice(1)],
			nib
		);
		brushInto(glyph, [[860, 40], [861, 41]], nib);
		fitAllAutomatic(font);
		const editor = editorOn(font);
		expect(look(editor, 'n')).toMatchObject({ id: CHECK.specks, fixLabel: 'Remove 1 speck' });
		const shapes = letter(editor.project, 'n').shapes.length;
		expect(press(editor, 'n')).toBe(true);
		expect(letter(editor.project, 'n').shapes.length).toBe(shapes - 1);
		expect(look(editor, 'n')).toBeNull();
	});
});

describe("a letter's kept answer follows its Brush strokes", () => {
	it("the stamp changes with a stroke's nib or its tag, not only its points", () => {
		const font = checksFont({ l: { shapes: [], anyink: { ...AUTO } } }, { fit: false });
		const glyph = letter(font, 'l');
		brushInto(glyph, penLine([300, FONT.ascent], [300, 0]), brushSize(font));
		const first = letterStamp(glyph);
		glyph.anyink.nib.strokes[0].size = 300;
		const second = letterStamp(glyph);
		expect(second).not.toBe(first);
		delete glyph.shapes[0].anyink.strokeId;
		expect(letterStamp(glyph)).not.toBe(second);
	});
});

describe('commas: every one the check calls off the line, Sit on the line puts back', () => {
	const kinds = {
		'a comma with a round head': (dy) => comma(100, dy),
		'a small comma': (dy) => moved(tinyComma(100, 50), 0, dy),
		'a slash of the pen': (dy) => moved(slashComma(100, 40), 0, dy),
	};
	it.each(Object.keys(kinds))('%s, written anywhere from 250 under to 250 over', (name) => {
		let offered = 0;
		for (let dy = -250; dy <= 250; dy += 50) {
			resetChecksCacheForTests();
			const editor = editorOn(
				checksFont({ ...plain('Hoae'), ',': { shapes: kinds[name](dy), anyink: { ...AUTO } } })
			);
			const first = look(editor, ',');
			if (!first) continue;
			offered++;
			expect([name, dy, first.id]).toEqual([name, dy, CHECK.offLine]);
			expect([name, dy, press(editor, ',')]).toEqual([name, dy, true]);
			expect([name, dy, look(editor, ',')]).toEqual([name, dy, null]);
		}
		// a comma with a head is called off the line when it is (a slash never sinks or floats
		// while any of it reaches the line)
		if (name !== 'a slash of the pen') expect(offered).toBeGreaterThan(4);
	});

	it("the critic's small comma on the line is Ready", () => {
		const editor = editorOn(
			checksFont({ ...plain('Hoae'), ',': { shapes: tinyComma(100, 50), anyink: { ...AUTO } } })
		);
		expect(look(editor, ',')).toBeNull();
		expect(state(editor, ',').ready).toBe(true);
	});
});
