// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize (the fontinfo verdict's leftover), written to fail first: Move the guide
// lines on an empty letter opened it with the Brush picked, so a drag on a guide line drew a
// stroke ("drew a stroke on small n") instead of moving the line. While the lines are unlocked
// the letter is on Select: picked when the lines unlock, and the tool a letter opens with then.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { twoLetterEditor, B, R } from '../../history/tests/two_letters.js';
import { applyOpenTool } from '../../letter/open_tool.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetOpeningToolForTests } from '../../nib/default_tool.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { startMovingLines, stopMovingLines } from '../move_lines.js';

let editor;
beforeEach(() => {
	document.body.innerHTML = '';
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ fontDetails: true, brush: true, letterView: true });
	resetOpeningToolForTests();
	resetToastsForTests();
	editor = twoLetterEditor();
	editor.nav.page = 'Characters';
	editor.eventHandlers.tool_addPath = {};
	editor.selectedGlyphID = B;
	editor.selectedGlyph.shapes = [];
	editor.selectedTool = 'resize';
});
afterEach(() => {
	stopMovingLines();
	resetOpeningToolForTests();
	resetToastsForTests();
	resetFeaturesForTests();
	setModeForTests('all');
	vi.restoreAllMocks();
});

describe('the guide lines unlocked on an empty letter', () => {
	it('the Brush the letter opened with gives way to Select', () => {
		expect(applyOpenTool(editor)).toBe('nib');
		expect(startMovingLines({ editor })).toBe(true);
		expect(editor.selectedTool).toBe('resize');
	});

	it('another empty letter opened while they are unlocked opens on Select', () => {
		startMovingLines({ editor });
		editor.selectedGlyphID = R;
		editor.selectedGlyph.shapes = [];
		expect(applyOpenTool(editor)).toBe('resize');
		stopMovingLines();
		expect(applyOpenTool(editor)).toBe('nib');
	});
});
