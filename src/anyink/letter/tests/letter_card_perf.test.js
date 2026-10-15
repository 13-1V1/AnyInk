// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix pass (letter-card track): with Fine-tune open, the letter card worked out every
	shape's solid or hole again on every drag tick (probe8: 35.8 ms a tick on 60 curved shapes,
	against 1.0 ms with Fine-tune closed). Telling solid from hole tests every pair of shapes, and a
	drag publishes 'currentItem' two or more times a tick. Now the card works them out when a step
	is recorded (the pointer let go, Undo, Redo) or the shapes themselves change, and shows the
	kinds it had until then; picking a shape asks only whether that one can be a hole.
	The work is counted (kindsWorkForTests), not timed, so the test never depends on the machine.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { word } from '../../words/words.js';
import { kindsWorkForTests, makeLetterCard, resetLetterCardForTests } from '../letter_card.js';
import { resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

/** A square at (x0, y0) */
function squareAt(x0, y0, size) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Square',
		pathPoints: [corner(x0, y0), corner(x0 + size, y0), corner(x0 + size, y0 + size), corner(x0, y0 + size)],
	});
}

/** Capital B in Simple, Fine-tune open: one big shape and `count` small ones inside it */
function openManyShapes(count = 30) {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true });
	const editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	const item = editor.selectedGlyph;
	item.addOneShape(squareAt(0, 0, 3000));
	for (let i = 0; i < count; i++) {
		item.addOneShape(squareAt(40 + (i % 10) * 290, 40 + Math.floor(i / 10) * 290, 200));
	}
	editor.history.addState('set up the test letter');
	setFineTuneOpen(true, editor);
	const card = makeLetterCard(editor);
	document.body.appendChild(card);
	return { editor, item, card };
}

/** One drag tick, as path_edit.js makes it: a point moves, 'currentItem' is told twice */
function dragTick(editor, point) {
	point.p.x += 1;
	point.parent?.changed?.();
	editor.publish('currentItem', editor.selectedItem);
	editor.publish('currentItem', editor.selectedItem);
}

beforeEach(() => {
	resetLetterViewForTests();
	resetLetterCardForTests();
});
afterEach(() => {
	document.body.innerHTML = '';
});

describe('the card during a drag (Fine-tune open)', () => {
	it('works out solid or hole once, not again on every drag tick', async () => {
		const { editor, item } = openManyShapes(30);
		expect(kindsWorkForTests()).toBeGreaterThan(0);
		// pick a shape, as a press on the canvas does
		editor.multiSelect.shapes.select(item.shapes[3]);
		editor.publish('whichShapeIsSelected', item.shapes[3]);
		const before = kindsWorkForTests();
		const point = item.shapes[3].pathPoints[0];
		for (let tick = 0; tick < 10; tick++) dragTick(editor, point);
		await Promise.resolve();
		expect(kindsWorkForTests()).toBe(before);
	});

	it('works them out again when the drag ends (the step), so the rows are right after it', () => {
		const { editor, item, card } = openManyShapes(10);
		const point = item.shapes[1].pathPoints[0];
		for (let tick = 0; tick < 5; tick++) dragTick(editor, point);
		const before = kindsWorkForTests();
		// the shape is turned round: a hole now, recorded as one step on release
		item.shapes[1].reverseWinding();
		editor.history.addState('Path edit: moved a point');
		editor.publish('currentItem', item);
		expect(kindsWorkForTests()).toBeGreaterThan(before);
		expect(card.querySelector('[data-anyink-shape-row="1"]').textContent).toContain(
			word('letterTools.role.hole')
		);
	});
});
