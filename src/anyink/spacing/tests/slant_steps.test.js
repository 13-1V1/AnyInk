// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (finding 1) in the editor: Simple finds the font's slant as he traces. The step whose
// ink moves it (the first letter with stems, or one that leans the font more than 1.5 degrees
// further) fits every automatic letter again with it, in that same Undo step: the letters traced
// before it are parts of the step (item entries under the open letter's, one step key), so they
// are measured the same way as the rest, and one press puts the whole font back, slant and all.
// Each letter keeps the slant it was fitted with (anyink.spacingSlant), so Undo needs no
// whole-font copy. All tools never refits, so it never moves the slant either.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { applyAutoTrace } from '../../autotrace/apply.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { sitsAtFit } from '../auto_space.js';
import { fittedSlant, fontSlant } from '../slant.js';
import {
	GRIDS,
	closestGap,
	glyphId,
	letterShapes,
	shearShapes,
	spacingProject,
} from './fixtures.js';

const GRID = 1000;
const FONT = GRIDS[GRID];
const G = FONT.xHeight * 0.08;

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	document.title = 'ANY-INK';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	setModeForTests('all');
});

/** An editor on a font whose letters l, n, o exist but are still empty */
function emptyFont(mode) {
	setModeForTests(mode);
	const project = spacingProject(GRID, {
		l: { shapes: [] },
		n: { shapes: [] },
		o: { shapes: [] },
	});
	const editor = new ProjectEditor();
	editor.project = project;
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	return editor;
}

/** Traces a fixture letter, leaning `degrees`, into that letter: one step, like Use it */
function trace(editor, char, degrees) {
	showItem(editor, glyphId(char));
	const shapes = shearShapes(letterShapes(char, FONT, 300), degrees, 0).map(
		(shape) => new Path({ name: 'Traced', ...shape })
	);
	expect(applyAutoTrace({ editor, item: editor.selectedItem, shapes, mode: 'replace' })).toBe(true);
	return editor.project.glyphs[glyphId(char)];
}

const glyph = (editor, char) => editor.project.glyphs[glyphId(char)];
const slantOf = (editor) => fontSlant(editor.project);

describe('Simple: the slant is found as he traces', () => {
	it('the first letter with stems sets it, in one step that also fits the letters before it', () => {
		const editor = emptyFont('simple');
		// o first: no stems, so no slant yet; it is fitted on its box
		const o = trace(editor, 'o', 20);
		expect(slantOf(editor)).toBe(0);
		expect(fittedSlant(o)).toBe(0);
		const oWidth = o.advanceWidth;
		const oSaved = JSON.stringify(o.save());
		const steps = editor.history.length;

		// l leans 20 degrees: the font's slant is 20, and o is fitted again with it
		const l = trace(editor, 'l', 20);
		expect(slantOf(editor)).toBe(20);
		expect(fittedSlant(l)).toBe(20);
		expect(fittedSlant(glyph(editor, 'o'))).toBe(20);
		// One step: l's entry on top, o's under it with the same step key
		expect(editor.history.length).toBe(steps + 1);
		const [top, part] = editor.history.queue;
		expect(top.title).toMatch(/^Auto-traced/);
		expect(top.itemID).toBe(glyphId('l'));
		expect(top.wholeProjectSave).toBeFalsy();
		expect(part.itemID).toBe(glyphId('o'));
		expect(part.step).toBeTruthy();
		expect(part.step).toBe(top.step);
		expect(l.anyink.spacing).toBe('auto');
		expect(sitsAtFit(l, editor.project)).toBe(true);
		expect(sitsAtFit(glyph(editor, 'o'), editor.project)).toBe(true);
		expect(glyph(editor, 'o').advanceWidth).not.toBe(oWidth);
		// Two slanted l's: the same gap as upright ones, 2 G
		expect(Math.abs(closestGap(l, l) - 2 * G)).toBeLessThanOrEqual(2);

		// One press puts the font back as it was before l, slant and all
		const undone = editor.history.restoreState();
		expect(undone.done).toBe(true);
		expect(glyph(editor, 'l').shapes).toHaveLength(0);
		expect(slantOf(editor)).toBe(0);
		expect(JSON.stringify(glyph(editor, 'o').save())).toBe(oSaved);

		editor.history.redoState();
		expect(slantOf(editor)).toBe(20);
		expect(glyph(editor, 'l').shapes.length).toBeGreaterThan(0);
		expect(fittedSlant(glyph(editor, 'o'))).toBe(20);
	});

	it('a letter that leans about the same as the font is an ordinary step', () => {
		const editor = emptyFont('simple');
		trace(editor, 'l', 20);
		expect(slantOf(editor)).toBe(20);
		const n = trace(editor, 'n', 21);
		expect(slantOf(editor)).toBe(20);
		expect(fittedSlant(n)).toBe(20);
		const [top, next] = editor.history.queue;
		expect(top.itemID).toBe(glyphId('n'));
		expect(top.step ?? null).toBeNull();
		expect(next.itemID).toBe(glyphId('l'));
		expect(sitsAtFit(n, editor.project)).toBe(true);
	});

	it('a letter that leans the font much further moves it, and every letter follows', () => {
		const editor = emptyFont('simple');
		trace(editor, 'l', 10);
		expect(slantOf(editor)).toBe(10);
		// n and o at 24: the stems now say 17 (the middle of 10 and 24), more than 1.5 off
		trace(editor, 'n', 24);
		expect(slantOf(editor)).toBe(17);
		['l', 'n'].forEach((char) => {
			expect(fittedSlant(glyph(editor, char)), char).toBe(17);
			expect(sitsAtFit(glyph(editor, char), editor.project), char).toBe(true);
		});
	});

	it('an upright hand never gets a slant, and its steps stay item steps of one letter', () => {
		const editor = emptyFont('simple');
		trace(editor, 'l', 0);
		trace(editor, 'n', 1);
		expect(slantOf(editor)).toBe(0);
		expect(glyph(editor, 'l').anyink).not.toHaveProperty('spacingSlant');
		expect(editor.history.queue[0].step ?? null).toBeNull();
		expect(editor.history.queue[0].wholeProjectSave).toBeFalsy();
	});
});

describe('All tools', () => {
	it('never finds a slant, and never refits', () => {
		const editor = emptyFont('all');
		const l = trace(editor, 'l', 20);
		expect(slantOf(editor)).toBe(0);
		expect(l.anyink?.spacing).toBeUndefined();
		expect(l.anyink).not.toHaveProperty('spacingSlant');
		expect(editor.history.queue[0].step ?? null).toBeNull();
	});
});
