// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdict "Make a font file (.otf) / Ctrl+E: the folder picker opens with no
// explanation, and cancelling says only 'No font file was made'"). In Simple, until B14's Use in
// Word, the File menu's font file and Ctrl+E:
//   - say where to pick before the folder picker opens the first time ("Pick a folder for your
//     font files. Make a new folder inside Documents and choose it.")
//   - when the picker is cancelled, say 7.7's "No folder picked. ..." with [Pick a folder...],
//     which picks one and makes the font file
//   - when the remembered folder is refused, say 7.7's "Couldn't write to "Fonts". Chrome may
//     need your OK." as the picker opens to choose again
//   - after a font file lands in the folder (and nothing needs fixing), say the next step: "To
//     use it in Word, open "Fonts", double-click "X.otf" and press Install."
// All tools keeps its words ("Export cancelled", no sentence before the picker).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ioFont_exportOTF } from '../../../formats_io/otf/font_export.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { exportWithFontCheck } from '../../fontcheck/export_toast.js';
import { setModeForTests } from '../../mode/mode.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { EXPORT_FOLDER_KEY, forgetExportFolder } from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { rememberHandle } from '../handles.js';
import { abortError, clearDialogs, fakeApi, fakeDirectoryHandle, toastText } from './fakes.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const square = {
	pathPoints: [
		{ p: { coord: { x: 100, y: 0 } } },
		{ p: { coord: { x: 300, y: 0 } } },
		{ p: { coord: { x: 300, y: 300 } } },
		{ p: { coord: { x: 100, y: 300 } } },
	],
};

function makeEditor() {
	const project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Folder Words',
				id: 'g2_FOLDERWORDS',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'FolderWords', style: 'Regular', upm: 1000, ascent: 800, descent: -200 },
			app: { autoSave: false },
		},
		glyphs: {
			'glyph-0x20': { id: 'glyph-0x20', advanceWidth: 250, shapes: [] },
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 400, shapes: [square] },
		},
	});
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

const simpleToast = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])');
const simpleText = () => simpleToast()?.querySelector('.anyink-toast__text')?.textContent || '';
const said = (key) => toastLog().filter((record) => record.key === key && record.shown);

async function waitFor(check, ms = 4000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

const make = () => exportWithFontCheck(ioFont_exportOTF);

beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	resetToastsForTests();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	makeEditor();
});
afterEach(() => {
	vi.restoreAllMocks();
	resetFileApi();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('Simple: where font files go', () => {
	beforeEach(() => setModeForTests('simple'));

	it('the first time, a sentence says what to pick before the picker opens', async () => {
		let showingWhenPickerOpened = '';
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: () => {
					showingWhenPickerOpened = simpleText();
					return fakeDirectoryHandle('Fonts');
				},
			})
		);
		await make();
		expect(showingWhenPickerOpened).toBe(word('menu.pickFolderFirst'));
	});

	it('cancelled: 7.7 "No folder picked." with [Pick a folder...], which makes the font file', async () => {
		let answer = abortError();
		const fonts = fakeDirectoryHandle('Fonts');
		const api = fakeApi({ open: [], save: undefined, directory: () => answer });
		setFileApi(api);
		expect(await make()).toBe('cancelled');
		expect(simpleText()).toBe(word('error.noFolderPicked'));
		const button = simpleToast().querySelector('button');
		expect(button.textContent).toBe(word('error.button.pickFolder'));
		answer = fonts;
		button.click();
		expect(await waitFor(() => api.calls.directory.length === 2)).toBe(true);
		expect(await waitFor(() => Object.keys(fonts.files || {}).length > 0 || said('toast.fontFileExported').length > 0)).toBe(true);
	});

	it('the remembered folder refused: 7.7 "Couldn\'t write to "Fonts"." as the picker opens', async () => {
		const refused = fakeDirectoryHandle('Fonts', { query: 'denied', request: 'denied' });
		await rememberHandle(EXPORT_FOLDER_KEY, refused);
		let showingWhenPickerOpened = '';
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: () => {
					showingWhenPickerOpened = simpleText();
					return fakeDirectoryHandle('Other');
				},
			})
		);
		await make();
		expect(showingWhenPickerOpened).toBe(word('error.folderNotWritable', { folder: 'Fonts' }));
	});

	it('made in the folder: the next step to Word follows', async () => {
		setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
		expect(await make()).toBe('folder');
		const [next] = said('menu.fontFileNextStep');
		expect(next?.text).toMatch(/^To use it in Word, open Fonts, double-click .+\.otf and press Install\.$/);
	});
});

describe('All tools: as before', () => {
	it('cancelled says "Export cancelled"; nothing is said before the picker', async () => {
		let showingWhenPickerOpened = 'not opened';
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: () => {
					showingWhenPickerOpened = toastText();
					return abortError();
				},
			})
		);
		expect(await make()).toBe('cancelled');
		expect(showingWhenPickerOpened).toBe('');
		expect(toastText()).toBe('Export cancelled');
		expect(said('menu.fontFileNextStep')).toEqual([]);
	});
});
