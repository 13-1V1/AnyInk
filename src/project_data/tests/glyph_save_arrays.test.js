// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Glyph.save() hands out copies of its usedIn and gsub arrays (M8 integration fix). Before
// the fix it returned the live arrays, so every whole-project undo snapshot shared them with
// the live project, and upstream's in-place splice (removeLinkFromUsedIn) changed old
// snapshots too: undo could not bring a component's "used in" list back.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../app/main.js';
import { removeLinkFromUsedIn } from '../../project_editor/cross_item_actions.js';
import { importGlyphrProjectFromText } from '../../project_editor/import_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import { Glyph } from '../glyph.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('Glyph.save() arrays', () => {
	it('usedIn and gsub come back as copies, not the live arrays', () => {
		const glyph = new Glyph({ id: 'liga-0x66-0x69', usedIn: ['glyph-0x41'], gsub: [0x66, 0x69] });
		const saved = glyph.save();
		expect(saved.usedIn).toEqual(['glyph-0x41']);
		expect(saved.gsub).toEqual([0x66, 0x69]);
		expect(saved.usedIn).not.toBe(glyph.usedIn);
		expect(saved.gsub).not.toBe(glyph.gsub);
		glyph.usedIn.splice(0, 1);
		glyph.gsub.push(0x6c);
		expect(saved.usedIn).toEqual(['glyph-0x41']);
		expect(saved.gsub).toEqual([0x66, 0x69]);
	});

	it('a whole-project undo brings back a usedIn list that was spliced in place', () => {
		const text = readFileSync(join(here, '../../samples/oblegg.gs2'), 'utf8');
		const editor = new ProjectEditor({ project: importGlyphrProjectFromText(text) });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x3A'; // colon: two instances of comp-0
		const before = [...editor.project.getItem('comp-0').usedIn];
		expect(before).toContain('glyph-0x3A');

		editor.history.addWholeProjectChangePreState('Unlink the colon');
		removeLinkFromUsedIn(editor.project.getItem('comp-0'), 'glyph-0x3A');
		editor.history.addWholeProjectChangePostState();
		expect(editor.project.getItem('comp-0').usedIn.length).toBe(before.length - 1);

		editor.history.restoreState();
		expect(editor.project.getItem('comp-0').usedIn).toEqual(before);
	});
});
