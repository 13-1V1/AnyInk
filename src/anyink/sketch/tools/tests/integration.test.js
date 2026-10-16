// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration: the five sketch tools as the edit canvas runs them (installSketchTools, events
	through tool_route.js sketchPointer / sketchKey) on the real letter page, with the 'sketch' flag
	on, and the app around them:
	  - a piece left open when another letter opens, or when the view leaves for the board, is
	    finished on its own letter as its own step (project_editor.js, navigator.js,
	    on_its_letter.js)
	  - an older step undone under the open piece (a destructive toast's [Undo]) writes a new
	    object for the letter; the piece is stored on the letter as the font holds it now
	  - a font swapped in finishes the piece in the font it was drawn in, never the new one
	  - All tools' Undo / Redo ask the gate too (history.js restoreState / redoState)
	  - a mode change finishes the piece and leaves a sketch tool All tools hides for Select
	  - the top bar's Undo / Redo tooltips follow the piece's clicks
	  - the letter's snap context (its edges while spacing is his) reaches the tools
	  - the empty-letter box steps aside and the guide lines lock for a sketch tool
	  - Arc right after the Line brings the Line tip back
	Written after the wiring, then checked red: with the wiring taken out for one run, 10 of the
	11 failed (the 11th, Simple keeping its sketch tool on a mode change, holds either way).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import simpleExampleProject from '../../../../samples/simpleExampleProject.json';
import { selectTool } from '../../../../edit_canvas/tools/tools.js';
import { importGlyphrProjectFromText } from '../../../../project_editor/import_project.js';
import { getCoach } from '../../../coach/coach_state.js';
import { isBuiltShape } from '../../sketch_record.js';
import { isOpeningTool, notePickedTool } from '../../../nib/default_tool.js';
import { undoOffer } from '../../../history/undo_toast.js';
import { overlayShows } from '../../../letter/empty_overlay.js';
import {
	letterPage,
	setUpScreenTests,
	settle,
	shownEl,
	square,
} from '../../../letter/tests/simple_screen.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../../mode/features.js';
import { isGuideLineLocked } from '../../../mode/locks.js';
import { setModeForTests } from '../../../mode/mode.js';
import { setSpacingOwner } from '../../../spacing/owner.js';
import { word } from '../../../words/words.js';
import { sketchOf } from '../../model.js';
import { installSketchTools } from '../install.js';
import { afterModeChange } from '../mode_watch.js';
import { sketchKey, sketchPointer } from '../tool_route.js';
import { SKETCH_TOOLS } from '../tool_names.js';
import { isPieceOpen, resetUndoGateForTests } from '../undo_gate.js';

setUpScreenTests();

const N = 'glyph-0x6E';
const O = 'glyph-0x6F';

beforeEach(() => {
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
	installSketchTools();
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

/** Canvas pixels of a place in font units */
const at = (editor, x, y) => ({
	x: editor.view.dx + x * editor.view.dz,
	y: editor.view.dy - y * editor.view.dz,
});

/** Presses and keys as the edit canvas hands them on */
function hands(editor) {
	let time = 0;
	const send = (type, x, y) => {
		time += 1000;
		return sketchPointer(
			type,
			{ button: 0, buttons: type === 'up' ? 0 : 1, detail: 1, timeStamp: time },
			{ editor, at: at(editor, x, y) }
		);
	};
	return {
		click(x, y) {
			send('move', x, y);
			send('down', x, y);
			send('up', x, y);
		},
		move: (x, y) => send('move', x, y),
		key: (key) =>
			sketchKey(
				'down',
				{ key, code: '', ctrlKey: false, shiftKey: false, altKey: false },
				{ editor }
			),
	};
}

/** small n open, a sketch tool picked */
function letter(id = N, tool = 'sketchLine', mode = 'simple') {
	const editor = letterPage({ id, mode });
	editor.selectedTool = tool;
	return editor;
}

const pieces = (editor, id) => sketchOf(editor.project.getItem(id))?.pieces || [];
const topTitle = (editor) => editor.history.queue.find((entry) => !entry.navigation)?.title;

describe('a piece left open is finished on its own letter', () => {
	it('opening another letter mid-piece: the piece is on small n, one step for small n', () => {
		const editor = letter();
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 1097);
		expect(isPieceOpen()).toBe(true);
		editor.selectedGlyphID = O;
		expect(isPieceOpen()).toBe(false);
		expect(pieces(editor, N)).toHaveLength(1);
		expect(pieces(editor, O)).toHaveLength(0);
		const step = editor.history.queue[0];
		expect(step.title).toBe('sketched a line on small n');
		expect(step.itemID).toBe(N);
		expect(editor.selectedGlyphID).toBe(O);
	});

	it('leaving for the board mid-piece: stored on small n, the view stays on the board', () => {
		const editor = letter();
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 1097);
		editor.nav.page = 'Overview';
		editor.navigate();
		expect(isPieceOpen()).toBe(false);
		expect(pieces(editor, N)).toHaveLength(1);
		expect(editor.history.queue[0]).toMatchObject({
			title: 'sketched a line on small n',
			itemID: N,
		});
		expect(editor.nav.page).toBe('Overview');
	});

	it('an older step undone under the open piece: the piece lands on the letter the font holds now', () => {
		const editor = letter();
		editor.selectedItem.addOneShape(square(100, 0, 400));
		editor.history.addState('traced small n');
		const before = editor.project.getItem(N);
		const h = hands(editor);
		h.click(700, 3);
		h.click(700, 1097);
		undoOffer(editor).action.run();
		const now = editor.project.getItem(N);
		expect(now).not.toBe(before);
		// S3: the traced square is gone with the undone step; the one shape left is the line's
		// own built ink.
		expect(now.shapes).toHaveLength(1);
		expect(now.shapes.every((shape) => isBuiltShape(shape))).toBe(true);
		expect(sketchOf(now)?.pieces).toHaveLength(1);
		expect(topTitle(editor)).toBe('sketched a line on small n');
	});

	it('a font swapped in: the piece is finished in the font it was drawn in, never the new one', () => {
		const editor = letter();
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 1097);
		const old = editor.project;
		editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
		expect(isPieceOpen()).toBe(false);
		expect(sketchOf(old.getItem(N))?.pieces).toHaveLength(1);
		expect(sketchOf(editor.project.getItem(N))).toBeFalsy();
		expect(editor.history.queue.some((entry) => /sketched/.test(entry.title))).toBe(false);
	});
});

describe('All tools and the mode switch', () => {
	it("All tools' restoreState with a piece open takes back a click; redoState waits", () => {
		const editor = letter(N, 'sketchLine', 'all');
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 600);
		h.click(500, 900);
		const queue = editor.history.queue.length;
		const tool = installSketchTools().sketchLine;
		expect(tool.pointCount()).toBe(3);
		editor.history.restoreState();
		expect(tool.pointCount()).toBe(2);
		expect(editor.history.queue.length).toBe(queue);
		editor.history.redoState();
		expect(tool.pointCount()).toBe(2);
		h.key('enter');
		expect(pieces(editor, N)).toHaveLength(1);
	});

	it('a mode change mid-piece: the piece is its own step and All tools gets Select', () => {
		const editor = letter();
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 1097);
		setModeForTests('all');
		expect(afterModeChange({ editorOf: () => editor, pick: selectTool })).toBe('select');
		expect(isPieceOpen()).toBe(false);
		expect(pieces(editor, N)).toHaveLength(1);
		expect(editor.selectedTool).toBe('resize');
	});

	it('back in Simple a sketch tool stays picked', () => {
		const editor = letter();
		expect(afterModeChange({ editorOf: () => editor, pick: selectTool })).toBe(null);
		expect(editor.selectedTool).toBe('sketchLine');
	});
});

describe('the screen around the tools', () => {
	it("the top bar's Undo and Redo follow the piece's clicks", async () => {
		const editor = letter();
		await settle();
		const button = (kind) =>
			document.querySelector(`#app__top-bar [data-anyink-control="${kind}"]`);
		const h = hands(editor);
		h.click(300, 3);
		h.click(300, 1097);
		expect(button('undo').title).toBe(word('sketch.undo.takeBack'));
		expect(button('redo').title).toBe(word('sketch.undo.finishFirst'));
		h.key('enter');
		expect(button('undo').title).not.toBe(word('sketch.undo.takeBack'));
	});

	it("the letter's edges snap while its spacing is his, never while it is automatic", () => {
		const editor = letter();
		const item = editor.selectedItem;
		item.advanceWidth = 600;
		const width = item.advanceWidth;
		setSpacingOwner(item, 'manual');
		const h = hands(editor);
		h.click(4, 500);
		h.click(width - 3, 500);
		h.key('enter');
		const sketch = sketchOf(editor.project.getItem(N));
		const ons = Object.values(sketch.points).map((point) => point.on);
		expect(ons).toEqual(['left', 'right']);
		setSpacingOwner(editor.project.getItem(N), 'auto');
		h.click(4, 300);
		h.click(width - 3, 300);
		h.key('enter');
		const after = sketchOf(editor.project.getItem(N));
		const newOns = Object.values(after.points)
			.slice(2)
			.map((point) => point.on ?? null);
		expect(newOns.every((on) => on !== 'left' && on !== 'right')).toBe(true);
	});

	it('the empty-letter box steps aside and the guide lines lock for every sketch tool', () => {
		const editor = letter(N, 'resize');
		expect(overlayShows(editor)).toBe(true);
		SKETCH_TOOLS.forEach((tool) => {
			editor.selectedTool = tool;
			expect(overlayShows(editor)).toBe(false);
			expect(isGuideLineLocked('metric', { tool, mode: 'simple', item: editor.selectedItem })).toBe(
				true
			);
		});
	});

	it('S3 integration: the Line an empty letter opens on shows no tip', async () => {
		const editor = letter(N, 'resize');
		await settle();
		const tipText = () => {
			const tip = document.querySelector('anyink-coach .anyink-coach__tip');
			return shownEl(tip) ? tip.querySelector('.anyink-coach__tip-text')?.textContent || '' : '';
		};
		expect(editor.selectedTool).toBe('sketchLine');
		expect(isOpeningTool(editor)).toBe(true);
		expect(tipText()).toBe('');
		// his own pick of the Line shows it: the next test
	});

	it('Arc picked right after the Line: its own tip first (S2 finalize), then the Line tip back', async () => {
		const editor = letter(N, 'resize');
		await settle();
		// S3: an empty letter opens on the Line by itself; this test starts from his own pick of
		// another tool (tools.js switchToolTo notes it), so the Line below is his pick
		editor.selectedTool = 'resize';
		notePickedTool(editor);
		expect(isOpeningTool(editor)).toBe(false);
		const tipText = () => {
			const tip = document.querySelector('anyink-coach .anyink-coach__tip');
			return shownEl(tip) ? tip.querySelector('.anyink-coach__tip-text')?.textContent || '' : '';
		};
		editor.selectedTool = 'sketchLine';
		editor.publish('whichToolIsSelected', 'sketchLine');
		await settle();
		expect(tipText()).toBe(word('sketch.tip.line'));
		getCoach().tips.noteAction();
		await settle();
		expect(tipText()).toBe('');
		const pick = async (tool) => {
			editor.selectedTool = tool;
			editor.publish('whichToolIsSelected', tool);
			await settle();
		};
		await pick('sketchArc');
		expect(tipText()).toBe(word('sketch.tip.arc'));
		getCoach().tips.noteAction();
		await pick('sketchLine');
		await pick('sketchArc');
		expect(tipText()).toBe(word('sketch.tip.line'));
	});
});
