// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass (critic finding "Just opening the space tile triggers 'The space has no width,
	so your words would run together.'"): in Simple, opening a letter is never a change (B2), so
	opening the space must not leave a font that needs fixing. The root is where the letter is
	made (project_editor.js selectedGlyph: new Glyph() is 0 wide); the space should be made a
	quarter of the letter box wide (export_list.js spaceWidth, the width B14's export adds and
	[Fix it] gives it). B4 + B5 finalize: project_editor.js makes the space (and the no-break
	space) that wide in Simple; All tools makes it as before.
	The check itself stays: a space someone set to 0 is still named (space_width.test.js).
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { spaceWidth } from '../export_list.js';
import { PROBLEM, validateFont } from '../validate.js';
import { openEdge } from './fixtures.js';

afterEach(() => {
	setModeForTests('all');
	vi.restoreAllMocks();
});

/** Opens a letter the way a tile click does, in Simple. */
function openLetter(id) {
	setModeForTests('simple');
	const editor = openEdge();
	editor.selectedGlyphID = id;
	editor.selectedGlyph; // the tile click reads it, which makes the letter
	return editor;
}

describe('opening the space in Simple', () => {
	it.each(['glyph-0x20', 'glyph-0xA0'])(
		'makes %s a quarter of the letter box wide, so nothing needs fixing',
		(id) => {
			const editor = openLetter(id);
			expect(editor.project.glyphs[id].advanceWidth).toBe(spaceWidth(editor.project));
			expect(validateFont(editor.project).map((p) => p.problem)).not.toContain(
				PROBLEM.spaceNoWidth
			);
		}
	);

	it('All tools: opening the space makes it as before (0 wide, one Undo step)', () => {
		const editor = openEdge();
		editor.selectedGlyphID = 'glyph-0x20';
		editor.selectedGlyph;
		expect(editor.project.glyphs['glyph-0x20'].advanceWidth).toBe(0);
	});

	it('opening any other letter still makes nothing that needs fixing', () => {
		const editor = openLetter('glyph-0x61');
		expect(editor.project.glyphs['glyph-0x61']).toBeTruthy();
		expect(validateFont(editor.project).filter((p) => p.itemId === 'glyph-0x61')).toEqual([]);
	});
});
