// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Font export end to end (finding 5): the export destination (folder permission or
	folder picker) is settled inside the click / keydown, before the font is built,
	so a build longer than Chromium's transient-activation window still writes into
	the folder. Activation is modelled as ending at the first timer after the click,
	which is sooner than any real build.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { ioFont_exportOTF } from '../../../formats_io/otf/font_export.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { kvClear } from '../../storage/kv.js';
import { EXPORT_FOLDER_KEY, forgetExportFolder } from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { rememberHandle } from '../handles.js';
import {
	abortError,
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeUserActivation,
	securityError,
	toastText,
} from './fakes.js';

// jsdom has no Web Animations API; upstream's toast / dialog close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const square = {
	pathPoints: [
		{ p: { coord: { x: 100, y: 100 } } },
		{ p: { coord: { x: 300, y: 100 } } },
		{ p: { coord: { x: 300, y: 300 } } },
		{ p: { coord: { x: 100, y: 300 } } },
	],
};

function makeEditor() {
	const project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Flow Test',
				id: 'g2_EXPORTFLOW',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'FlowTest', style: 'Regular', upm: 1000, ascent: 800, descent: -200 },
			app: { autoSave: false },
		},
		glyphs: {
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600, shapes: [square] },
			'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 620, shapes: [square] },
		},
	});
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

function key(type, value) {
	const event = new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true });
	if (type === 'keydown') handleKeyPress(event);
	else handleKeyUp(event);
}

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

let activation = null;
let warn;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	makeEditor();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	activation?.restore();
	activation = null;
	resetFileApi();
	clearDialogs();
	warn.mockRestore();
	eventHandlerData.isCtrlDown = false;
});

describe('export flow: destination before build (finding 5)', () => {
	it('Ctrl+E: a remembered folder in the prompt state is granted inside the keydown', async () => {
		const dir = fakeDirectoryHandle('Fonts', { query: 'prompt', request: 'granted' });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = fakeApi({ open: [], save: undefined, directory: () => securityError() });
		setFileApi(api);
		activation = fakeUserActivation();
		activation.expireOnFirstTimer();

		key('keydown', 'Control');
		key('keydown', 'e');
		key('keyup', 'e');
		key('keyup', 'Control');

		expect(await waitFor(() => dir.files.size > 0 || api.calls.download.length > 0)).toBe(true);
		expect(api.calls.download).toHaveLength(0);
		expect(api.calls.directory).toHaveLength(0);
		expect(dir.calls.request).toBe(1);
		expect(dir.files.get('FlowTest-Regular.otf').written).toBeInstanceOf(Blob);
	}, 15000);

	it('menu Export OTF with no folder yet: the picker opens first, then the font is built', async () => {
		const dir = fakeDirectoryHandle('Picked');
		const api = fakeApi({
			open: [],
			save: undefined,
			directory: () => (activation.active ? dir : securityError()),
		});
		setFileApi(api);
		activation = fakeUserActivation();
		activation.expireOnFirstTimer();

		expect(await ioFont_exportOTF()).toBe('folder');
		expect(api.calls.directory).toHaveLength(1);
		expect(api.calls.download).toHaveLength(0);
		expect(dir.files.get('FlowTest-Regular.otf').written).toBeInstanceOf(Blob);
		expect(toastText()).toBe('Exported FlowTest-Regular.otf to Picked');
	}, 15000);

	it('cancelling the picker builds and downloads nothing (finding 7)', async () => {
		const api = fakeApi({ open: [], save: undefined, directory: abortError() });
		setFileApi(api);
		expect(await ioFont_exportOTF()).toBe('cancelled');
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Export cancelled');
	}, 15000);

	it('without the File System Access API the font still downloads', async () => {
		const api = fakeApi({});
		setFileApi(api);
		expect(await ioFont_exportOTF()).toBe('download');
		expect(api.calls.download).toHaveLength(1);
		expect(api.calls.download[0].fileName).toBe('FlowTest-Regular.otf');
	}, 15000);
});
