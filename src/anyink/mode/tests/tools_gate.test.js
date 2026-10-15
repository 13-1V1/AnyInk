// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 6.2 Tools, 6.3 "a gate inside selectTool / switchToolTo"): a tool the
// mode hides can't be picked however it is asked (a key, a stale button, code), and a hidden tool
// left picked from More tools falls back to Select when the tool buttons are drawn. Space-drag
// ('pan') and the view buttons are not drawing tools and always pass.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	makeEditToolsButtons,
	selectTool,
	switchToolTo,
	toolShown,
} from '../../../edit_canvas/tools/tools.js';
import { setModeForTests } from '../mode.js';
import { sampleEditor } from './controls_probe.js';

let editor;
let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = sampleEditor();
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x41';
	editor.eventHandlers.tool_addPath = {};
	editor.selectedTool = 'resize';
});
afterEach(() => warn.mockRestore());

describe('the tool gate', () => {
	it('All tools: every tool can be picked, as today', () => {
		['pathAddPoint', 'newPath', 'pathEdit', 'newRectangle', 'newOval', 'resize'].forEach((tool) => {
			selectTool(tool);
			expect(editor.selectedTool).toBe(tool);
		});
		switchToolTo('kern');
		expect(editor.selectedTool).toBe('kern');
	});

	it('Simple: Add a point and the Kerning tool are refused by selectTool and switchToolTo', () => {
		setModeForTests('simple');
		selectTool('pathAddPoint');
		expect(editor.selectedTool).toBe('resize');
		switchToolTo('pathAddPoint');
		switchToolTo('kern');
		expect(editor.selectedTool).toBe('resize');
		expect(toolShown('pathAddPoint')).toBe(false);
	});

	it('Simple: the shown tools, Space-drag and the view buttons all pass', () => {
		setModeForTests('simple');
		['newPath', 'pathEdit', 'newRectangle', 'newOval', 'resize', 'pan'].forEach((tool) => {
			switchToolTo(tool);
			expect(editor.selectedTool).toBe(tool);
		});
		expect(toolShown('zoomEm')).toBe(true);
		expect(toolShown('displayMode')).toBe(true);
	});

	it('Simple: a hidden tool left picked from More tools becomes Select when the buttons are drawn', () => {
		editor.selectedTool = 'pathAddPoint';
		setModeForTests('simple');
		makeEditToolsButtons();
		expect(editor.selectedTool).toBe('resize');
	});

	it('All tools: drawing the buttons never changes the tool', () => {
		editor.selectedTool = 'pathAddPoint';
		makeEditToolsButtons();
		expect(editor.selectedTool).toBe('pathAddPoint');
	});
});
