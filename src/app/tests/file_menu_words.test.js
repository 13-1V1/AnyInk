// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 2.2, 2.4 E): the File menu is a display point Simple shares with More tools,
// so its rows say the house words in both modes: work file, font file, where font files go. A
// file name, a folder name and a file type (.otf) are exact Windows labels: each sits in
// .anyink-quote, a words.js entry with quote: true, the only place the banned-word scan lets
// them through. Rows are found by their id (data-anyink-row), never by their words.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import {
	EXPORT_FOLDER_KEY,
	forgetExportFolder,
	preloadExportFolder,
} from '../../anyink/files/export_folder.js';
import { resetFileApi, setFileApi } from '../../anyink/files/file_api.js';
import { rememberHandle } from '../../anyink/files/handles.js';
import {
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeFileHandle,
} from '../../anyink/files/tests/fakes.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { kvClear } from '../../anyink/storage/kv.js';
import { findUppercase, scanDom } from '../../anyink/words/banned.js';
import { word, wordEntry, wordKeys } from '../../anyink/words/words.js';
import { setCurrentProjectEditor } from '../main.js';
import { makeAppTopBar } from '../menu.js';

// jsdom has no Web Animations; menus and toasts fade with element.animate.
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

function makeEditor() {
	const project = new GlyphrStudioProject({
		settings: {
			project: { name: 'Brennan Hand', id: 'g2_FILE_MENU_WORDS' },
			font: { family: 'Brennan Hand', upm: 1000, ascent: 800, descent: -200 },
			app: { autoSave: false },
		},
	});
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

function openFileMenu() {
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	[...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
	return document.querySelector('#context-menu');
}

/** @returns {Element | null} the row with that id */
const row = (id) =>
	document.querySelector(`#context-menu [data-anyink-row="${id}"]`)?.closest('.context-menu-row');
const rowText = (id) => row(id)?.querySelector('.row-name').textContent;
const headings = () => [...document.querySelectorAll('#context-menu h2')];
const type = (key) => word(key);

async function settle(ms = 30) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

let editor;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	editor = makeEditor();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	vi.restoreAllMocks();
	resetFileApi();
	closeEveryTypeOfDialog();
	clearDialogs();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('File menu rows, in house words (both modes)', () => {
	it('names every row with the words keys', () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		openFileMenu();
		expect(rowText('save')).toBe(word('term.save'));
		expect(rowText('save-as')).toBe(word('menu.saveAs'));
		expect(rowText('font-otf')).toBe(word('menu.makeFontFile', { type: type('menu.typeOtf') }));
		expect(rowText('font-ttf')).toBe(word('menu.makeFontFile', { type: type('menu.typeTtf') }));
		expect(rowText('font-woff')).toBe(
			word('menu.makeWebFontFile', { type: type('menu.typeWoff') })
		);
		expect(rowText('font-woff2')).toBe(
			word('menu.makeWebFontFile', { type: type('menu.typeWoff2') })
		);
		expect(rowText('font-folder')).toBe(word('menu.chooseFontFolder'));
		expect(rowText('font-svg')).toBe(word('menu.makeFontFile', { type: type('menu.typeSvg') }));
		// What that reads like
		expect(rowText('font-otf')).toBe('Make a font file (.otf)');
		expect(rowText('font-woff2')).toBe('Make a web font file (.woff2)');
	});

	it('keeps the keyboard notes where they were', () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		openFileMenu();
		const keys = (id) => [...row(id).querySelectorAll('.row-notes code')].map((c) => c.textContent);
		expect(keys('save')).toEqual(['Ctrl', 's']);
		// B5 fix track: two chips, so they never wrap (the menu grid has two key cells)
		expect(keys('save-as')).toEqual(['Ctrl+Shift', 's']);
		expect(keys('font-otf')).toEqual(['Ctrl', 'e']);
		expect(keys('font-ttf')).toEqual([]);
		expect(keys('font-svg')).toEqual(['Ctrl', 'g']);
	});

	it('names the folder font files go to, when one was chosen', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		await rememberHandle(EXPORT_FOLDER_KEY, fakeDirectoryHandle('My Fonts'));
		await preloadExportFolder();
		openFileMenu();
		expect(rowText('font-folder')).toBe(word('menu.fontFolder', { folder: 'My Fonts' }));
		expect(row('font-folder').querySelector('.anyink-quote').textContent).toBe('My Fonts');
	});

	it('shows file names and file types as quotes (exact Windows labels)', () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		editor.loadedFileHandle = fakeFileHandle('Brennan Hand.gs2');
		openFileMenu();
		const quoted = headings().map((h) => h.querySelector('.anyink-quote')?.textContent);
		expect(quoted).toEqual([
			'Brennan Hand.gs2',
			'BrennanHand-Regular.otf',
			expect.stringMatching(/\.svg$/),
		]);
		['font-otf', 'font-ttf', 'font-woff', 'font-woff2', 'font-svg'].forEach((id) =>
			expect(row(id).querySelector('.anyink-quote')?.textContent, id).toMatch(/^\.[a-z0-9]+$/)
		);
		[
			'menu.fileName',
			'menu.typeOtf',
			'menu.typeTtf',
			'menu.typeWoff',
			'menu.typeWoff2',
			'menu.typeSvg',
		].forEach((key) => expect(wordEntry(key).quote, key).toBe(true));
	});

	it('without the File System Access API, Save says where the work file goes', () => {
		setFileApi(fakeApi({}));
		openFileMenu();
		expect(rowText('save')).toBe(word('menu.saveDownload'));
		expect(headings()[0].querySelector('.anyink-quote').textContent).toMatch(/\.gs2$/);
	});

	it('puts words into its HTML that hold no markup characters (menu.js fills them in as they are)', () => {
		const screens = wordKeys().filter((key) =>
			/^(menu|check|strip|status|notice|canvas|metric)\./.test(key)
		);
		expect(screens.length).toBeGreaterThan(50);
		screens.forEach((key) => expect(wordEntry(key).text, key).not.toMatch(/[<>&"]/));
	});

	['all', 'simple'].forEach((mode) => {
		it(`says no banned word and nothing in capitals (${mode})`, () => {
			setModeForTests(mode);
			setFileApi(fakeApi({ open: [], save: undefined }));
			const menu = openFileMenu();
			expect([...scanDom(menu), ...findUppercase(menu)]).toEqual([]);
		});
	});
});

describe('File menu: choosing where font files go', () => {
	it('says the folder it picked, in house words', async () => {
		setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('My Fonts') }));
		openFileMenu();
		row('font-folder').click();
		await settle();
		const toast = document.querySelector('#toast');
		expect(toast.textContent).toContain(word('menu.fontFolderPicked', { folder: 'My Fonts' }));
		expect(toast.querySelector('.anyink-quote')?.textContent).toBe('My Fonts');
		expect(scanDom(toast)).toEqual([]);
	});
});
