// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 fix (hostile probe, finding 6): a letter made from an empty letter. The component's box
// came from the empty letter's {0, 0, 0, 0}, wherever the component was moved, so it counted as
// ink at x = 0: an automatic letter made from it moved right by G on every step and never sat
// at its fit, and a letter made only from an empty letter was made automatic and given a width
// with no ink to show. Ink is now read from the shapes that hold it (outline.js inkPaths, the
// same list the side measurement and the font check's outlines use), and the hook asks the same
// question when it looks for a letter's first ink.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentInstance } from '../../../project_data/component_instance.js';
import { insertComponentInstance } from '../../../project_editor/cross_item_actions.js';
import { B, R, square, traceInto, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setModeForTests } from '../../mode/mode.js';
import { showItem } from '../../preview/show_item.js';
import { fitSpacing, sitsAtFit } from '../auto_space.js';
import { inkBounds } from '../measure.js';
import { letter, rect, spacingProject } from './fixtures.js';

const AUTO = { spacing: 'auto' };

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

/** r made from B (a component moved right) plus its own dot; B as given */
function rFromB(bShapes) {
	const project = spacingProject(1000, {
		B: { shapes: bShapes },
		r: { shapes: [rect(500, 0, 550, 50)], anyink: AUTO },
	});
	const b = letter(project, 'B');
	const r = letter(project, 'r');
	r.shapes.push(new ComponentInstance({ link: b.id, parent: r, translateX: 300 }));
	r.changed();
	return { project, b, r };
}

describe('a letter made from an empty letter (engine)', () => {
	it('has no ink from that letter: only its own shapes count', () => {
		const { r } = rFromB([]);
		expect(inkBounds(r)).toEqual({ xMin: 500, xMax: 550, yMin: 0, yMax: 50 });
		const { r: only } = rFromB([]);
		only.shapes.shift();
		only.changed();
		expect(inkBounds(only)).toBeNull();
	});

	it('refitting it three times moves nothing after the first fit', () => {
		const { project, r } = rFromB([]);
		fitSpacing(r, project);
		const fitted = JSON.stringify(r.save());
		for (let k = 0; k < 3; k++) {
			expect(fitSpacing(r, project).dx).toBe(0);
			expect(sitsAtFit(r, project)).toBe(true);
		}
		expect(JSON.stringify(r.save())).toBe(fitted);
		// The dot sits G from the left edge (r: straight left side)
		expect(inkBounds(r).xMin).toBe(40);
	});

	it('a letter made only from an empty letter is left alone, with no width', () => {
		const { project, r } = rFromB([]);
		r.shapes.shift();
		r.changed();
		r.advanceWidth = 0;
		expect(fitSpacing(r, project)).toMatchObject({ changed: false, dx: 0 });
		expect(r.advanceWidth).toBe(0);
	});

	it('once the letter it is made from has ink, that ink counts again', () => {
		const { r, b } = rFromB([]);
		b.shapes = [rect(0, 0, 100, 700)];
		r.shapes.forEach((shape) => (shape.cache = {}));
		r.cache = {};
		expect(inkBounds(r).xMin).toBe(300);
	});
});

describe('Simple: a letter made from an empty letter (the hook)', () => {
	it('a letter made only from an empty letter is not made automatic and gets no width', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, R);
		expect(insertComponentInstance(B, R)).toBe(true);
		editor.history.addState('Inserted Capital B into small r');
		const r = editor.project.glyphs[R];
		expect(r.anyink?.spacing).toBeUndefined();
		expect(r.advanceWidth).toBe(0);
	});

	it('B cleared under an automatic r (B plus a dot): steps on r never walk it to the right', () => {
		setModeForTests('simple');
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor, 100);
		showItem(editor, R);
		insertComponentInstance(B, R);
		editor.project.glyphs[R].addOneShape(square(500, 50).save());
		editor.history.addState('r: B plus a dot');
		showItem(editor, B);
		editor.selectedItem.shapes = [];
		editor.history.addState('Cleared B');
		showItem(editor, R);
		const r = editor.selectedItem;
		const where = () => ({
			component: r.shapes[0].translateX,
			dot: r.shapes[1].maxes.xMin,
			width: r.advanceWidth,
		});
		// The first step on r fits it on what is left (the dot); after that nothing moves
		r.shapes[1].updateShapePosition(0, 1);
		editor.history.addState('Nudged the dot up');
		const settled = where();
		expect(sitsAtFit(r, editor.project)).toBe(true);
		for (let k = 0; k < 3; k++) {
			r.shapes[1].updateShapePosition(0, 1);
			editor.history.addState('Nudged the dot up');
			expect(where()).toEqual(settled);
			expect(sitsAtFit(r, editor.project)).toBe(true);
		}
		expect(settled.dot).toBe(40);
	});

	it("a letter with no owner made from a letter with ink is not taken over (its recorded copy's ink is seen)", () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		traceInto(editor, 100);
		showItem(editor, R);
		insertComponentInstance(B, R);
		editor.history.addState('Inserted Capital B into small r');
		// Made in All tools: no owner, so "set by you"
		const r = editor.project.glyphs[R];
		expect(r.anyink?.spacing).toBeUndefined();
		const width = r.advanceWidth;
		setModeForTests('simple');
		r.shapes[0].name = 'Capital B, renamed';
		editor.history.addState('Renamed a shape');
		expect(r.anyink?.spacing).toBeUndefined();
		expect(r.advanceWidth).toBe(width);
	});
});
