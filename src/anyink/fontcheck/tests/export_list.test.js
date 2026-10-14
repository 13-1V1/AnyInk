// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: the exporter's list of letters, in one function the export and the font check share.
*/
import { describe, expect, it } from 'vitest';
import { getExportList, shouldExportItem, spaceWidth } from '../export_list.js';
import { edgeProjectJSON, openEdge, openProject, square } from './fixtures.js';

const glyphIds = (list) => list.glyphs.map((entry) => entry.xg.id);
const ligatureIds = (list) => list.ligatures.map((entry) => entry.xg.id);

describe('getExportList: the exporter list, unchanged by default', () => {
	it('enabled ranges only, sorted, then the missing sources of each ligature', () => {
		const { project } = openEdge();
		const list = getExportList(project);
		expect(glyphIds(list)).toEqual([
			'glyph-0x41',
			'glyph-0x42',
			'glyph-0x43',
			'glyph-0x44',
			'glyph-0x62',
			'glyph-0x66',
			'glyph-0x69',
		]);
		expect(list.glyphs.map((entry) => entry.xc)).toEqual([
			'0x41',
			'0x42',
			'0x43',
			'0x44',
			'0x62',
			'0x66',
			'0x69',
		]);
		expect(ligatureIds(list)).toEqual(['liga-0x66-0x69']);
	});

	it('a check (the default) never adds letters to the project; the export still does', () => {
		const { project } = openEdge();
		getExportList(project);
		expect(project.glyphs['glyph-0x66']).toBeUndefined();
		const list = getExportList(project, { forExport: true });
		expect(project.glyphs['glyph-0x66']).toBe(list.glyphs[5].xg);
		expect(project.glyphs['glyph-0x69']).toBe(list.glyphs[6].xg);
	});

	it('leaves out unedited letters when the project says so, and ligatures when they are off', () => {
		const editor = openEdge({ app: { exportUneditedItems: false, exportLigatures: false } });
		editor.selectedGlyphID = 'glyph-0x45';
		expect(editor.selectedGlyph.sessionState).toBe('new');
		const list = getExportList(editor.project);
		expect(glyphIds(list)).toEqual([
			'glyph-0x41',
			'glyph-0x42',
			'glyph-0x43',
			'glyph-0x44',
			'glyph-0x62',
		]);
		expect(list.ligatures).toEqual([]);
		expect(shouldExportItem(editor.selectedGlyph, editor.project)).toBe(false);
		expect(shouldExportItem(editor.project.getItem('glyph-0x41'), editor.project)).toBe(true);
		expect(shouldExportItem(false, editor.project)).toBe(false);
	});
});

describe('omitEmptyLetters', () => {
	it('drops every letter with no shapes except the space and letters a ligature needs', () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x20'] = { id: 'glyph-0x20', advanceWidth: 400, shapes: [] };
		const { project } = openProject(json);
		const list = getExportList(project, { omitEmptyLetters: true });
		expect(glyphIds(list)).toEqual([
			'glyph-0x20',
			'glyph-0x41',
			'glyph-0x42',
			'glyph-0x44',
			'glyph-0x62',
			'glyph-0x66',
			'glyph-0x69',
		]);
		expect(project.glyphs['glyph-0x43']).toBeDefined();
	});

	it('drops an empty ligature, and with it the need for its letters', () => {
		const json = edgeProjectJSON();
		json.ligatures['liga-0x66-0x69'].shapes = [];
		const { project } = openProject(json);
		const list = getExportList(project, { omitEmptyLetters: true, forExport: true });
		expect(list.ligatures).toEqual([]);
		expect(glyphIds(list)).not.toContain('glyph-0x66');
		expect(project.glyphs['glyph-0x66']).toBeUndefined();
	});
});

describe('addSpaceIfMissing', () => {
	it('adds a space a quarter of the letter box wide, in the list only', () => {
		const { project } = openEdge();
		const list = getExportList(project, { addSpaceIfMissing: true });
		expect(list.glyphs[0].xc).toBe('0x20');
		expect(list.glyphs[0].xg.advanceWidth).toBe(512);
		expect(list.glyphs[0].xg.shapes).toEqual([]);
		expect(project.glyphs['glyph-0x20']).toBeUndefined();
		expect(spaceWidth(project)).toBe(512);
	});

	it('follows the letter box size', () => {
		const json = edgeProjectJSON();
		json.settings.font.upm = 1000;
		const { project } = openProject(json);
		const space = getExportList(project, { addSpaceIfMissing: true }).glyphs[0];
		expect(space.xg.advanceWidth).toBe(250);
	});

	it('keeps a space the font already has', () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x20'] = { id: 'glyph-0x20', advanceWidth: 300, shapes: [] };
		const { project } = openProject(json);
		const list = getExportList(project, { addSpaceIfMissing: true });
		const spaces = list.glyphs.filter((entry) => Number(entry.xc) === 0x20);
		expect(spaces).toHaveLength(1);
		expect(spaces[0].xg).toBe(project.glyphs['glyph-0x20']);
		expect(spaces[0].xg.advanceWidth).toBe(300);
	});

	it('a space that was only opened (no width, no shapes) counts as missing', () => {
		const editor = openProject(edgeProjectJSON());
		editor.selectedGlyphID = 'glyph-0x20'; // clicking the space tile makes a 0-wide space
		expect(editor.selectedGlyph.advanceWidth).toBe(0);
		const list = getExportList(editor.project, { addSpaceIfMissing: true });
		const spaces = list.glyphs.filter((entry) => Number(entry.xc) === 0x20);
		expect(spaces).toHaveLength(1);
		expect(spaces[0].xg).not.toBe(editor.project.glyphs['glyph-0x20']);
		expect(spaces[0].xg.advanceWidth).toBe(512);
		expect(editor.project.glyphs['glyph-0x20'].advanceWidth).toBe(0);
		// without the option the list is upstream's: the 0-wide space goes in as it is
		expect(getExportList(editor.project).glyphs[0].xg).toBe(editor.project.glyphs['glyph-0x20']);
	});

	it('adds one when the space exists but is not exported', () => {
		const json = edgeProjectJSON({ app: { exportUneditedItems: false } });
		const editor = openProject(json);
		editor.selectedGlyphID = 'glyph-0x20'; // opened, never edited
		expect(editor.selectedGlyph.sessionState).toBe('new');
		const list = getExportList(editor.project, { addSpaceIfMissing: true });
		const spaces = list.glyphs.filter((entry) => Number(entry.xc) === 0x20);
		expect(spaces).toHaveLength(1);
		expect(spaces[0].xg).not.toBe(editor.project.glyphs['glyph-0x20']);
		expect(spaces[0].xg.advanceWidth).toBe(512);
	});

	it('both options together: the added space survives omitEmptyLetters', () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x41'].shapes = [square()];
		const { project } = openProject(json);
		const list = getExportList(project, { addSpaceIfMissing: true, omitEmptyLetters: true });
		expect(glyphIds(list)[0]).toBe('glyph-0x20');
		expect(glyphIds(list)).not.toContain('glyph-0x43');
	});
});
