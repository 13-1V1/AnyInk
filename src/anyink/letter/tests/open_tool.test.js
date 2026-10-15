// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the tool a letter opens with in the Simple letter view (open_tool.js,
	UX-BEGINNER.md 4.3 Tools): the Brush on an empty letter (remembered as the opening Brush, so the
	overlay and the Next line still offer the photo), Select on a letter with ink, Select during the
	photo flow's step C on that letter, nothing while 'brush' is off, nothing in All tools, and
	never in the middle of a Point pen shape. A tool picked between the open and the pick wins.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { twoLetterEditor, B, R } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { isOpeningBrush, resetOpeningToolForTests } from '../../nib/default_tool.js';
import { resetPhotoFlowForTests, stateOf } from '../../photo/photo_flow_state.js';
import { applyOpenTool, watchOpenTool } from '../open_tool.js';
import { switchToolTo } from '../../../edit_canvas/tools/tools.js';

function square() {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({
		name: 'Square',
		pathPoints: [corner(0, 0), corner(400, 0), corner(400, 400), corner(0, 400)],
	});
}

let editor;
beforeEach(() => {
	setModeForTests('simple');
	resetOpeningToolForTests();
	editor = twoLetterEditor();
	editor.nav.page = 'Characters';
	editor.eventHandlers.tool_addPath = {};
	editor.selectedTool = 'resize';
	editor.selectedGlyphID = B;
	editor.selectedGlyph.shapes = [];
});
afterEach(() => {
	resetPhotoFlowForTests();
	resetOpeningToolForTests();
	setModeForTests('all');
});

describe('the tool a letter opens with', () => {
	it('an empty letter: the Brush, remembered as the opening Brush', () => {
		expect(applyOpenTool(editor)).toBe('nib');
		expect(editor.selectedTool).toBe('nib');
		expect(isOpeningBrush(editor)).toBe(true);
		// his own pick of the Brush makes it his
		switchToolTo('nib');
		expect(isOpeningBrush(editor)).toBe(false);
	});

	it('a letter with ink: Select', () => {
		editor.selectedGlyph.addOneShape(square());
		editor.selectedTool = 'nib';
		expect(applyOpenTool(editor)).toBe('resize');
		expect(editor.selectedTool).toBe('resize');
	});

	it("the photo flow's step C on this letter: Select, so a drag never draws behind the result", () => {
		stateOf(editor).flow = {
			editor,
			project: editor.project,
			itemId: B,
			char: 'B',
			status: 'tracing',
			options: {},
		};
		expect(applyOpenTool(editor)).toBe('resize');
	});

	it("nothing before B8, nothing in All tools, nothing in the middle of a Point pen shape", () => {
		setFeaturesForTests({ brush: false });
		expect(applyOpenTool(editor)).toBe(null);
		setFeaturesForTests({ brush: true });
		setModeForTests('all');
		expect(applyOpenTool(editor)).toBe(null);
		setModeForTests('simple');
		editor.eventHandlers.tool_addPath = { newPath: square(), editor };
		editor.selectedTool = 'newPath';
		expect(applyOpenTool(editor)).toBe(null);
		expect(editor.selectedTool).toBe('newPath');
	});
});

describe('step C starting on the letter already open (found in Chrome)', () => {
	it('a drawing tool gives way to Select when the flow starts; a pick of his during step C stays', async () => {
		watchOpenTool(editor);
		await Promise.resolve();
		expect(editor.selectedTool).toBe('nib');
		stateOf(editor).flow = {
			editor,
			project: editor.project,
			itemId: B,
			asset: 'img-1',
			partId: 'p1',
			char: 'B',
			status: 'tracing',
			options: {},
		};
		editor.publish('autoTrace', null);
		expect(editor.selectedTool).toBe('resize');
		// a later change of the same step C (a re-trace) leaves his own pick alone
		switchToolTo('nib');
		stateOf(editor).flow.status = 'ready';
		editor.publish('autoTrace', null);
		expect(editor.selectedTool).toBe('nib');
	});
});

describe('watchOpenTool: after the press that opened the letter', () => {
	it('picks once the press is done; a tool picked in between wins', async () => {
		watchOpenTool(editor);
		await Promise.resolve();
		expect(editor.selectedTool).toBe('nib');
		editor.selectedGlyphID = R;
		editor.selectedGlyph.addOneShape(square());
		editor.selectedGlyphID = B;
		switchToolTo('newRectangle');
		await Promise.resolve();
		expect(editor.selectedTool).toBe('newRectangle');
		editor.selectedGlyphID = R;
		await vi.waitFor(() => expect(editor.selectedTool).toBe('resize'));
	});
});
