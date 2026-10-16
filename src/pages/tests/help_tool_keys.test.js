// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16: Glyphr Studio 2.10.5 picked Path edit with B or P. ANY-INK's one key map (UX-BEGINNER 7.6,
// D-035, D-038) moved them: P is New path, E Path edit, B and N the Brush, in both modes. All
// tools' Help > Keyboard shortcuts is drawn from that map, so someone with upstream's habits finds
// the keys this build uses there.
import { describe, expect, it, vi } from 'vitest';
import { makeKeyboardShortcutReference } from '../help.js';

/** The Tools rows as the table shows them: { 'Select the ... tool': ['E', ...] } */
function toolRows() {
	vi.spyOn(console, 'log').mockImplementation(() => {});
	const table = makeKeyboardShortcutReference();
	const rows = {};
	table.querySelectorAll('label').forEach((label) => {
		const text = label.textContent.replace(/\s+/g, ' ').trim();
		if (!/^Select the .* tool$/i.test(text)) return;
		const keys = label.previousElementSibling;
		rows[text] = [...keys.querySelectorAll('code')].map((code) => code.textContent);
	});
	return rows;
}

describe('All tools Help > Keyboard shortcuts: the tool keys this build uses', () => {
	it('E picks Path edit, P New path, B and N the Brush; B no longer picks Path edit', () => {
		const rows = toolRows();
		expect(rows['Select the Path Edit (Pen) tool']).toEqual(['E']);
		expect(rows['Select the New Path tool']).toContain('P');
		expect(rows['Select the Brush tool']).toEqual(expect.arrayContaining(['B', 'N']));
		expect(rows['Select the Path Edit (Pen) tool']).not.toContain('B');
		expect(rows['Select the Path Edit (Pen) tool']).not.toContain('P');
	});
});
