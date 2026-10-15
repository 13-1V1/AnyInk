// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track, the File menu (app/menu.js makeFileMenuData; UX-BEGINNER.md 4.9, 6.2 Menus,
// principle 7): until B6's Menu replaces it, Simple's File menu
//   - has "Open a saved font... (Ctrl+O)", the same box and picker as Ctrl+O, so switching fonts
//     is on screen (the Projects menu is hidden in Simple);
//   - names the font file Ctrl+E makes over its one font file row: always the .otf, with the
//     Ctrl+E note, even for a font imported from a .woff (All tools keeps the imported format);
// and in both modes no row's key chips wrap onto a second line (Save as: Ctrl Shift S).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAppTopBar } from '../../../app/menu.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { setSaveStatus } from '../../files/save_status.js';
import { fakeApi } from '../../files/tests/fakes.js';
import { setModeForTests } from '../mode.js';
import { word } from '../../words/words.js';
import { sampleEditor } from './controls_probe.js';

let editor;
let api;
let warn;

const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();

/** Opens the real File menu and reads each row: id (or heading / hr), its words, its key chips */
function fileMenu() {
	document.body.innerHTML = '';
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	[...topBar.querySelectorAll('.menu-entry-point')].find((b) => text(b) === 'File').click();
	return [...document.querySelector('#context-menu').children].map((row) => {
		const mark = row.querySelector('[data-anyink-row]');
		const keys = [...row.querySelectorAll('.row-notes code')].map(text);
		if (mark) return { id: mark.dataset.anyinkRow, text: text(row.querySelector('.row-name')), keys };
		if (row.querySelector('hr')) return { id: 'hr' };
		return { id: 'heading', text: text(row) };
	});
}
const ids = (rows) => rows.map((row) => row.id);
const row = (rows, id) => rows.find((r) => r.id === id);
/** The font file heading: the heading right over the first font file row */
const fontHeading = (rows) => rows[rows.findIndex((r) => r.id.startsWith('font-')) - 1].text;

beforeEach(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	editor = sampleEditor();
	api = fakeApi({ open: [], save: undefined, directory: undefined });
	setFileApi(api);
});
afterEach(() => {
	warn.mockRestore();
	resetFileApi();
	document.body.innerHTML = '';
});

describe('Simple: Open a saved font... (Ctrl+O), until B6', () => {
	beforeEach(() => setModeForTests('simple'));

	it('sits under Save and Save as, with its key', () => {
		const rows = fileMenu();
		// B4 + B5 finalize: "Choose where font files go" stays until Use in Word (B14)
		expect(ids(rows)).toEqual([
			'heading',
			'save',
			'save-as',
			'open-font',
			'hr',
			'heading',
			'font-otf',
			'font-folder',
		]);
		expect(row(rows, 'open-font')).toMatchObject({
			text: word('menu.openSavedFont'),
			keys: ['Ctrl', 'o'],
		});
	});

	it('opens the work file picker, the way Ctrl+O does', async () => {
		setSaveStatus(editor, { file: 'saved' });
		fileMenu();
		document.querySelector('[data-anyink-row="open-font"]').closest('.context-menu-row').click();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(api.calls.open).toHaveLength(1);
	});

	it('work not in its file: the same box asks first', async () => {
		fileMenu();
		document.querySelector('[data-anyink-row="open-font"]').closest('.context-menu-row').click();
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(api.calls.open).toEqual([]);
		expect(document.querySelector('#modal-dialog').textContent).toContain(word('open.unsaved'));
	});
});

describe('the font file Ctrl+E makes, named over its row', () => {
	beforeEach(() => {
		// what font_import.js stores for a font imported from a .woff
		editor.project.settings.project.exportFormat = 'woff';
	});

	it('Simple: the .otf, with the Ctrl+E note', () => {
		setModeForTests('simple');
		const rows = fileMenu();
		expect(fontHeading(rows)).toMatch(/-Regular\.otf$/);
		expect(row(rows, 'font-otf').keys).toEqual(['Ctrl', 'e']);
	});

	it('All tools: the imported format, as today', () => {
		const rows = fileMenu();
		expect(fontHeading(rows)).toMatch(/-Regular\.woff$/);
		expect(row(rows, 'font-woff').keys).toEqual(['Ctrl', 'e']);
		expect(row(rows, 'font-otf').keys).toEqual([]);
		expect(row(rows, 'open-font')).toBeUndefined();
	});
});

describe('key chips never wrap (the menu grid has two key cells)', () => {
	it.each(['simple', 'all'])('%s: at most two chips a row; Save as reads Ctrl+Shift, s', (mode) => {
		setModeForTests(mode);
		const rows = fileMenu();
		rows.filter((r) => r.keys).forEach((r) => expect(r.keys.length, r.id).toBeLessThanOrEqual(2));
		expect(row(rows, 'save-as').keys).toEqual(['Ctrl+Shift', 's']);
		expect(row(rows, 'save').keys).toEqual(['Ctrl', 's']);
	});
});
