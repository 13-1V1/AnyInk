// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize (UX-BEGINNER.md 7.3 "destructive actions use an Undo toast, not a confirm:
	Clear letter, delete a shape ...", 7.6 "Delete acts only on a picked shape or point";
	verdict: "Deleting a shape has no Undo toast"):
	  - in Simple, Delete on a picked shape takes it away as one step and says so: "Deleted a
	    shape from small a." [Undo]; on picked points: "Deleted a point from small a." [Undo]
	  - the toast's [Undo] takes back exactly that step, and does nothing once a newer change is
	    made (the toast goes then too)
	  - a shape picked from the card's Shapes list is the one Delete takes, even with Edit points
	    picked (the row lets go of picked points)
	  - Clear letter's [Undo] follows the same rule
	  - All tools: no toast, as today
*/
import { describe, expect, it } from 'vitest';
import { handleKeyPress } from '../../../edit_canvas/events_keyboard.js';
import { removeStopCreatingNewPathButton } from '../../../edit_canvas/tools/new_path.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { setFineTuneOpen } from '../view_switches.js';
import {
	letterPage,
	penClick,
	q,
	settle,
	setUpScreenTests,
	showing,
	shownText,
	square,
} from './simple_screen.js';

setUpScreenTests();

function pressDelete() {
	const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
	handleKeyPress(event);
}

/** small a with two squares, as two steps */
function twoSquares(mode = 'simple') {
	const editor = letterPage({ mode });
	editor.selectedItem.addOneShape(square(0, 0, 300));
	editor.history.addState('drew a square');
	editor.selectedItem.addOneShape(square(400, 0, 300));
	editor.history.addState('drew a square');
	editor.publish('currentItem', editor.selectedItem);
	return editor;
}

describe('Simple: Delete says what it took, with [Undo]', () => {
	it('a picked shape: one step, "Deleted a shape from small a." [Undo], and Undo brings it back', () => {
		const editor = twoSquares();
		editor.selectedTool = 'resize';
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[1]);
		const steps = editor.history.queue.length;
		pressDelete();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(editor.history.queue.length).toBe(steps + 1);
		expect(shownText()).toBe(word('letter.toast.deletedShape', { count: 1, name: 'small a' }));
		expect(showing().querySelector('button').textContent).toBe(word('letter.toast.undo'));
		showing().querySelector('button').click();
		expect(editor.selectedItem.shapes).toHaveLength(2);
	});

	it('picked points: "Deleted a point from small a." [Undo]', () => {
		const editor = twoSquares();
		editor.selectedTool = 'pathEdit';
		const shape = editor.selectedItem.shapes[0];
		editor.multiSelect.shapes.select(shape);
		editor.multiSelect.points.select(shape.pathPoints[1]);
		pressDelete();
		expect(editor.selectedItem.shapes[0].pathPoints).toHaveLength(3);
		expect(shownText()).toBe(word('letter.toast.deletedPoint', { count: 1, name: 'small a' }));
	});

	it('a newer change: the toast goes, and its [Undo] would take back nothing', () => {
		const editor = twoSquares();
		editor.selectedTool = 'resize';
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[1]);
		pressDelete();
		const button = showing().querySelector('button');
		editor.selectedItem.addOneShape(square(0, 400, 100));
		editor.history.addState('drew a square');
		expect(showing()).toBeNull();
		button.click();
		expect(editor.selectedItem.shapes).toHaveLength(2);
	});
});

describe("Simple: the card's Shapes row picks the shape Delete takes", () => {
	it('with Edit points picked, a row lets go of the picked points; Delete takes that shape', async () => {
		const editor = twoSquares();
		setFineTuneOpen(true, editor);
		editor.selectedTool = 'pathEdit';
		const first = editor.selectedItem.shapes[0];
		editor.multiSelect.shapes.select(first);
		editor.multiSelect.points.select(first.pathPoints[0]);
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		q('[data-anyink-shape-row="1"]').click();
		expect(editor.multiSelect.points.length).toBe(0);
		pressDelete();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(editor.selectedItem.shapes[0]).toBe(first);
		expect(first.pathPoints).toHaveLength(4);
	});
});

describe('Clear letter: its [Undo] is good only while the clear is the newest change', () => {
	it('a newer change: the clear toast goes; its button takes back nothing', async () => {
		const editor = twoSquares();
		setFineTuneOpen(true, editor);
		editor.publish('currentItem', editor.selectedItem);
		await settle();
		q('[data-anyink-toggle="shapeOptions"]')?.click();
		await settle();
		q('[data-anyink-action="clear"]').click();
		expect(editor.selectedItem.shapes).toHaveLength(0);
		const button = showing().querySelector('button');
		editor.selectedItem.addOneShape(square(0, 400, 100));
		editor.history.addState('drew a square');
		expect(showing()).toBeNull();
		button.click();
		expect(editor.selectedItem.shapes).toHaveLength(1);
	});
});

describe('All tools: no toast, as today', () => {
	it('Delete on a picked shape takes it, and says nothing new', () => {
		const editor = twoSquares('all');
		editor.selectedTool = 'resize';
		editor.multiSelect.shapes.select(editor.selectedItem.shapes[1]);
		pressDelete();
		expect(editor.selectedItem.shapes).toHaveLength(1);
		expect(showing()).toBeNull();
	});
});

describe('the new toasts say no banned word (2.3)', () => {
	scanSimpleScreen(
		'Delete on a picked shape: the toast and the letter view',
		async () => {
			const editor = twoSquares();
			editor.selectedTool = 'resize';
			editor.multiSelect.shapes.select(editor.selectedItem.shapes[1]);
			pressDelete();
			await settle();
			return document.body;
		},
		{ strict: true }
	);

	scanSimpleScreen(
		'"Finish the shape" with 2 points: the shape taken away, the toast',
		async () => {
			const editor = letterPage();
			penClick(editor, [0, 0]);
			penClick(editor, [300, 0]);
			removeStopCreatingNewPathButton();
			await settle();
			return document.body;
		},
		{ strict: true }
	);
});
