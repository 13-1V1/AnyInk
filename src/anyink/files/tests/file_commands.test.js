// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Every Save / Save As / Export caller (File menu rows, Ctrl+S, Ctrl+E) shows a
	failure instead of leaving an unhandled promise rejection (finding 6).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { makeAppTopBar } from '../../../app/menu.js';
import { makeOpenProjectTabs } from '../../../app/open_project.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { kvClear } from '../../storage/kv.js';
import { forgetExportFolder } from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { runFileCommand } from '../run_command.js';
import { clearDialogs, fakeApi, fakeFileHandle, namedError } from './fakes.js';

// jsdom has no Web Animations API; upstream's toast / dialog close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

function makeEditor() {
	const project = new GlyphrStudioProject({
		settings: {
			project: { name: 'Commands', id: 'g2_COMMANDS' },
			font: { family: 'Commands', upm: 1000, ascent: 800, descent: -200 },
			app: { autoSave: false },
		},
	});
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

async function settle(ms = 30) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText() {
	return document.querySelector('#error')?.innerHTML || '';
}

function openFileMenu() {
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	[...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
}

/** B4: rows are found by their id (menu.js data-anyink-row), never by their words. */
function clickMenuRow(id) {
	const mark = document.querySelector(`#context-menu [data-anyink-row="${id}"]`);
	if (!mark) throw new Error(`no File menu row "${id}"`);
	mark.closest('.context-menu-row').click();
}

let editor;
let warn;
let consoleError;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	editor = makeEditor();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	resetFileApi();
	clearDialogs();
	warn.mockRestore();
	consoleError.mockRestore();
	eventHandlerData.isCtrlDown = false;
	eventHandlerData.isShiftDown = false;
	document.querySelectorAll('#app__top-bar, #tabs-and-content').forEach((el) => el.remove());
});

describe('runFileCommand', () => {
	it('shows a rejection with showError and resolves false', async () => {
		expect(await runFileCommand(() => Promise.reject(new Error('disk on fire')))).toBe(false);
		expect(errorText()).toContain('disk on fire');
	});

	it('shows a synchronous throw the same way', async () => {
		expect(
			await runFileCommand(() => {
				throw new Error('thrown right away');
			})
		).toBe(false);
		expect(errorText()).toContain('thrown right away');
	});

	it('passes the result through and calls the command in the same tick', async () => {
		let called = false;
		const pending = runFileCommand(async () => {
			called = true;
			return 'folder';
		});
		expect(called).toBe(true);
		expect(await pending).toBe('folder');
		expect(errorText()).toBe('');
	});
});

describe('callers catch rejections (finding 6)', () => {
	it('File > Save shows a failure instead of an unhandled rejection', async () => {
		setFileApi(fakeApi({ open: [], save: fakeFileHandle('x.gs2') }));
		editor.saveProjectFile = () => Promise.reject(new Error('save exploded'));
		openFileMenu();
		clickMenuRow('save');
		await settle();
		expect(errorText()).toContain('save exploded');
	});

	it('File > Save as... shows a failure', async () => {
		setFileApi(fakeApi({ open: [], save: fakeFileHandle('x.gs2') }));
		editor.saveProjectFile = () => Promise.reject(new Error('save as exploded'));
		openFileMenu();
		clickMenuRow('save-as');
		await settle();
		expect(errorText()).toContain('save as exploded');
	});

	it('File > Choose export folder... shows a failure', async () => {
		setFileApi(
			fakeApi({ open: [], save: fakeFileHandle('x.gs2'), directory: new Error('picker exploded') })
		);
		openFileMenu();
		clickMenuRow('font-folder');
		await settle();
		expect(errorText()).toContain('picker exploded');
	});

	it('File > Export OTF file shows a failure from the destination step', async () => {
		setFileApi(
			fakeApi({ open: [], save: fakeFileHandle('x.gs2'), directory: new Error('export exploded') })
		);
		openFileMenu();
		clickMenuRow('font-otf');
		await settle();
		expect(errorText()).toContain('export exploded');
	});

	it('Ctrl+S shows a failure', async () => {
		editor.saveProjectFile = () => Promise.reject(new Error('ctrl s exploded'));
		handleKeyPress(new KeyboardEvent('keydown', { key: 'Control', cancelable: true }));
		handleKeyPress(new KeyboardEvent('keydown', { key: 's', cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 's', cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 'Control', cancelable: true }));
		await settle();
		expect(errorText()).toContain('ctrl s exploded');
	});

	it('Ctrl+S saves in place; Ctrl+Shift+S is Save as (DESIGN_DOC 6)', async () => {
		const calls = [];
		editor.saveProjectFile = (saveAsCopy = false) => {
			calls.push(saveAsCopy);
			return Promise.resolve(true);
		};
		const down = (key, shiftKey = false) =>
			handleKeyPress(new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey, cancelable: true }));
		const up = (key, shiftKey = false) =>
			handleKeyUp(new KeyboardEvent('keyup', { key, ctrlKey: true, shiftKey, cancelable: true }));
		down('Control');
		down('s');
		up('s');
		down('Shift', true);
		down('S', true);
		up('S', true);
		up('Shift');
		up('Control');
		await settle();
		expect(calls).toEqual([false, true]);
	});

	it('Open page: "Open a project file..." shows a picker failure instead of an unhandled rejection', async () => {
		setFileApi(
			fakeApi({ open: namedError('NotAllowedError', 'File picker already active.'), save: undefined })
		);
		const tabs = makeOpenProjectTabs();
		tabs.id = 'tabs-and-content';
		document.body.appendChild(tabs);
		tabs.querySelector('#button__open-project-file').click();
		await settle();
		expect(errorText()).toContain('File picker already active.');
	});

	it('Ctrl+E shows a failure', async () => {
		setFileApi(fakeApi({ open: [], save: undefined, directory: new Error('ctrl e exploded') }));
		handleKeyPress(new KeyboardEvent('keydown', { key: 'Control', cancelable: true }));
		handleKeyPress(new KeyboardEvent('keydown', { key: 'e', cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 'e', cancelable: true }));
		handleKeyUp(new KeyboardEvent('keyup', { key: 'Control', cancelable: true }));
		await settle(700);
		expect(errorText()).toContain('ctrl e exploded');
	});
});
