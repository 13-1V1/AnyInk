// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize, the File menu's "Choose where font files go..." row:
//   - Simple keeps it until B14's Use in Word holds it (words track's hand-off: with the row
//     hidden, a folder picked once could never be changed in Simple)
//   - its two toasts ("Font files will go to "Fonts".", "Click again ...") are the font file's
//     stream (group 'export'), so they take the place of an export toast at once instead of
//     waiting up to 6 s behind it (toast track's hand-off)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetExportFolder } from '../../anyink/files/export_folder.js';
import { resetFileApi, setFileApi } from '../../anyink/files/file_api.js';
import { clearDialogs, fakeApi, fakeDirectoryHandle } from '../../anyink/files/tests/fakes.js';
import { setModeForTests } from '../../anyink/mode/mode.js';
import { kvClear } from '../../anyink/storage/kv.js';
import { resetToastsForTests, toast } from '../../anyink/toast/toast.js';
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { GlyphrStudioProject } from '../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import { setCurrentProjectEditor } from '../main.js';
import { makeAppTopBar } from '../menu.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

/** The menu that holds the row: B6's Menu in Simple's top bar, the File menu otherwise */
function openFileMenu() {
	document.querySelectorAll('#app__top-bar').forEach((el) => el.remove());
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	const simpleMenu = topBar.querySelector('[data-anyink-control="menu"]');
	if (simpleMenu) simpleMenu.click();
	else [...topBar.querySelectorAll('.menu-entry-point')].find((b) => b.textContent === 'File').click();
	return document.querySelector('#context-menu');
}
const row = (id) =>
	document.querySelector(`#context-menu [data-anyink-row="${id}"]`)?.closest('.context-menu-row');
const showing = () =>
	document.querySelector('#toast[data-anyink-toast="simple"]:not([data-leaving])')?.textContent ||
	'';
async function waitFor(check, ms = 3000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return false;
}

beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	resetToastsForTests();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	const project = new GlyphrStudioProject({
		settings: { project: { name: 'Brennan Hand' }, font: { family: 'Brennan Hand' } },
	});
	setCurrentProjectEditor(new ProjectEditor({ project }));
	setFileApi(fakeApi({ open: [], save: undefined, directory: fakeDirectoryHandle('Fonts') }));
});
afterEach(() => {
	vi.restoreAllMocks();
	resetFileApi();
	closeEveryTypeOfDialog();
	clearDialogs();
	resetToastsForTests();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('Choose where font files go', () => {
	it('Simple shows the row (until Use in Word, B14)', () => {
		setModeForTests('simple');
		openFileMenu();
		expect(row('font-folder')).toBeTruthy();
	});

	it('All tools shows it, as before', () => {
		openFileMenu();
		expect(row('font-folder')).toBeTruthy();
	});

	it('Simple: picking a folder says so at once, in place of an export toast', async () => {
		setModeForTests('simple');
		const folder = fakeDirectoryHandle('Fonts');
		// an export toast arrives while the folder picker is open (opening the menu cleared the
		// toasts, so this is the one in the way)
		setFileApi(
			fakeApi({
				open: [],
				save: undefined,
				directory: () => {
					toast('toast.fontFileMaking', {}, { group: 'export' });
					return folder;
				},
			})
		);
		openFileMenu();
		row('font-folder').click();
		expect(await waitFor(() => showing().includes('Font files will go to'), 1500)).toBe(true);
	});
});
