// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import {
	getRecoveryStatus,
	initRecovery,
	markDirty,
	setRecoveryDeps,
	snapshotNow,
	stopRecovery,
} from '../../recovery/recovery.js';
import { sessionKey } from '../../recovery/snapshot.js';
import { fakeLocks } from '../../recovery/tests/fake_locks.js';
import { kvClear, recClear, recGet } from '../../storage/kv.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { MAX_RECENTS, listRecentProjects, pushRecentProject, recallHandle } from '../handles.js';
import {
	LAST_PROJECT_KEY,
	PROJECT_PICKER_ID,
	downloadProject,
	hasFileSystemAccess,
	noteProjectOpened,
	openProjectFromHandle,
	openProjectFromPicker,
	pickProjectFile,
	preloadFileHandles,
	projectFileName,
	saveProject,
	saveProjectAs,
	saveProjectText,
} from '../project_files.js';
import {
	abortError,
	clearDialogs,
	fakeApi,
	fakeEditor,
	fakeFileHandle,
	minimalProjectText,
	namedError,
	securityError,
	toastText,
} from './fakes.js';

function makeRealEditor(name = 'Files Test') {
	const project = new GlyphrStudioProject({
		settings: {
			project: { name, id: 'g2_FILESTEST' },
			font: { family: name, upm: 1000, ascent: 800, descent: -200 },
			app: { autoSave: false },
		},
	});
	return new ProjectEditor({ project });
}

/**
 * Starts real crash recovery on one editor (session id 's1', fake Web Locks).
 * @returns {Function} restores recovery's default deps
 */
function useRecovery(editor) {
	const locks = fakeLocks();
	const restore = setRecoveryDeps({
		getEditor: () => editor,
		getEditors: () => [editor],
		locks: () => locks,
		makeSessionId: () => 's1',
	});
	initRecovery();
	return restore;
}

/** The recovery record of the editor's session started by useRecovery. */
function recoveryRecord(editor) {
	return recGet(sessionKey(editor.project.settings.project.id, 's1'));
}

function collectProjectFile(editor) {
	const events = [];
	editor.subscribe({
		topic: 'projectFile',
		subscriberID: 'anyink.testProjectFiles.collect',
		callback: (data) => events.push(data),
	});
	return events;
}

beforeEach(async () => {
	await kvClear();
	await preloadFileHandles();
	document.title = 'ANY-INK';
	clearDialogs();
});

afterEach(() => {
	resetFileApi();
	clearDialogs();
});

describe('project_files: hasFileSystemAccess', () => {
	it('is false in jsdom and true when both pickers are injected', () => {
		expect(hasFileSystemAccess()).toBe(false);
		setFileApi(fakeApi({ open: [], save: fakeFileHandle('x.gs2') }));
		expect(hasFileSystemAccess()).toBe(true);
		setFileApi(fakeApi({ open: [] }));
		expect(hasFileSystemAccess()).toBe(false);
	});
});

describe('project_files: saveProject in place', () => {
	it('writes the project JSON through the handle and marks the project saved', async () => {
		setFileApi(fakeApi({ open: [], save: new Error('picker must not open') }));
		const editor = makeRealEditor();
		const events = collectProjectFile(editor);
		const handle = fakeFileHandle('Font.gs2');
		editor.loadedFileHandle = handle;
		editor.setProjectAsUnsaved();
		expect(document.title).toBe('ANY-INK •');

		expect(await saveProject(editor)).toBe(true);

		const saved = JSON.parse(handle.written);
		expect(saved.settings.project.name).toBe('Files Test');
		expect(saved.assets).toBeUndefined();
		expect(handle.options).toEqual([{ mode: 'exclusive' }]);
		expect(document.title).toBe('ANY-INK');
		expect(editor.loadedFileHandle).toBe(handle);
		expect(await recallHandle(LAST_PROJECT_KEY)).toBe(handle);
		const recents = await listRecentProjects();
		expect(recents).toHaveLength(1);
		expect(recents[0].handle).toBe(handle);
		expect(recents[0].name).toBe('Files Test');
		expect(toastText()).toBe('Saved Font.gs2');
		expect(events.some((e) => e.saved === false)).toBe(true);
		expect(events.at(-1)).toMatchObject({ saved: true, handle, reason: 'save' });
	});

	it('produces the same text as makeProjectFileText (format never forks)', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = makeRealEditor();
		const handle = fakeFileHandle('Font.gs2');
		editor.loadedFileHandle = handle;
		await saveProject(editor);
		expect(handle.written).toBe(await editor.makeProjectFileText());
	});

	it('retries without exclusive mode on an older browser', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = fakeEditor('Retry', '{"retry":1}');
		const handle = fakeFileHandle('Retry.gs2', { rejectExclusive: true });
		editor.loadedFileHandle = handle;
		expect(await saveProject(editor)).toBe(true);
		expect(handle.options).toEqual([{ mode: 'exclusive' }, undefined]);
		expect(handle.written).toBe('{"retry":1}');
		expect(editor.savedCalls).toBe(1);
	});

	it('shows an error and resolves false when the write fails', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = fakeEditor('Locked');
		const locked = new Error('another tab holds the lock');
		locked.name = 'NoModificationAllowedError';
		const handle = fakeFileHandle('Locked.gs2', { writeError: locked });
		editor.loadedFileHandle = handle;
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await saveProject(editor)).toBe(false);
		warn.mockRestore();
		expect(editor.savedCalls).toBe(0);
		expect(document.querySelector('#error').innerHTML).toContain('Locked.gs2');
		expect(await listRecentProjects()).toEqual([]);
	});

	it('asks where to save when the handle lost its permission', async () => {
		const picked = fakeFileHandle('Elsewhere.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('Denied');
		const old = fakeFileHandle('Old.gs2', { query: 'denied' });
		editor.loadedFileHandle = old;
		expect(await saveProject(editor)).toBe(true);
		expect(old.written).toBeUndefined();
		expect(picked.written).toBe('{"fake":true}');
		expect(editor.loadedFileHandle).toBe(picked);
		expect(api.calls.save).toHaveLength(1);
	});
});

describe('project_files: saveProjectAs and the picker', () => {
	it('picks a file with id, suggestedName and startIn, writes, adopts the handle', async () => {
		const picked = fakeFileHandle('Picked.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('My Font');
		expect(await saveProjectAs(editor)).toBe(true);
		expect(api.calls.save[0]).toMatchObject({
			id: PROJECT_PICKER_ID,
			suggestedName: 'My Font.gs2',
			startIn: 'documents',
		});
		expect(api.calls.save[0].types[0].accept['application/json']).toEqual(['.gs2']);
		expect(editor.loadedFileHandle).toBe(picked);
		expect(picked.written).toBe('{"fake":true}');
		expect(editor.savedCalls).toBe(1);
		expect(editor.published.at(-1)).toMatchObject({
			topic: 'projectFile',
			data: { handle: picked, saved: true, reason: 'save' },
		});
		expect(toastText()).toBe('Saved Picked.gs2');
	});

	it('starts the next picker in the last project file', async () => {
		const first = fakeFileHandle('First.gs2');
		const second = fakeFileHandle('Second.gs2');
		const api = fakeApi({ open: [], save: () => (api.calls.save.length === 1 ? first : second) });
		setFileApi(api);
		const editor = fakeEditor('Twice');
		await saveProjectAs(editor);
		await saveProjectAs(editor);
		expect(api.calls.save[1].startIn).toBe(first);
		expect(editor.loadedFileHandle).toBe(second);
	});

	it('retries with Documents when the browser rejects the remembered startIn', async () => {
		const picked = fakeFileHandle('Picked.gs2');
		const api = fakeApi({
			open: [],
			save: (options) => (typeof options.startIn === 'object' ? new TypeError('bad startIn') : picked),
		});
		setFileApi(api);
		const editor = fakeEditor('Retry');
		editor.loadedFileHandle = false;
		await pushRecentProject(fakeFileHandle('Recent.gs2'), 'Recent');
		await saveProjectAs(editor);
		editor.loadedFileHandle = false;
		expect(await saveProjectAs(editor)).toBe(true);
		expect(api.calls.save.at(-2).startIn).toBe(picked);
		expect(api.calls.save.at(-1).startIn).toBe('documents');
	});

	it('resolves false and writes nothing when the picker is cancelled', async () => {
		setFileApi(fakeApi({ open: [], save: abortError() }));
		const editor = fakeEditor('Cancelled');
		expect(await saveProjectAs(editor)).toBe(false);
		expect(editor.loadedFileHandle).toBe(false);
		expect(editor.savedCalls).toBe(0);
		expect(await listRecentProjects()).toEqual([]);
	});

	it('saveProject with no handle behaves like Save As', async () => {
		const picked = fakeFileHandle('New.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('Fresh');
		expect(await saveProject(editor)).toBe(true);
		expect(api.calls.save).toHaveLength(1);
		expect(editor.loadedFileHandle).toBe(picked);
	});

	it('saveProjectText writes prebuilt text (upstream saveTextFile path)', async () => {
		const handle = fakeFileHandle('Text.gs2');
		const picked = fakeFileHandle('Copy.gs2');
		setFileApi(fakeApi({ open: [], save: picked }));
		const editor = fakeEditor('Text');
		editor.loadedFileHandle = handle;
		expect(await saveProjectText(editor, '{"prebuilt":1}')).toBe(true);
		expect(handle.written).toBe('{"prebuilt":1}');
		expect(await saveProjectText(editor, '{"copy":2}', true)).toBe(true);
		expect(picked.written).toBe('{"copy":2}');
		expect(editor.loadedFileHandle).toBe(picked);
	});

	it('keeps recents de-duplicated and capped', async () => {
		const handles = [];
		const api = fakeApi({ open: [], save: () => handles.at(-1) });
		setFileApi(api);
		const editor = fakeEditor('Many');
		for (let i = 0; i < MAX_RECENTS + 3; i++) {
			handles.push(fakeFileHandle(`Font${i}.gs2`));
			editor.loadedFileHandle = false;
			await saveProjectAs(editor);
		}
		// Saving in place re-pushes the current handle: same length, moved to the top.
		await saveProject(editor);
		const recents = await listRecentProjects();
		expect(recents).toHaveLength(MAX_RECENTS);
		expect(recents[0].handle).toBe(handles.at(-1));
		expect(new Set(recents.map((r) => r.handle.name)).size).toBe(MAX_RECENTS);
	});
});

describe('project_files: no File System Access API', () => {
	it('saveProject downloads the project and marks it saved', async () => {
		const api = fakeApi({});
		setFileApi(api);
		const editor = makeRealEditor('Download Me');
		const events = collectProjectFile(editor);
		editor.setProjectAsUnsaved();
		expect(await saveProject(editor)).toBe(true);
		expect(api.calls.download).toHaveLength(1);
		const { blob, fileName } = api.calls.download[0];
		expect(fileName).toMatch(/^Download Me - \d{4}\.\d{1,2}\.\d{1,2}-\d{1,2}\.\d{2}\.\d{2}\.gs2$/);
		expect(blob).toBeInstanceOf(Blob);
		expect(document.title).toBe('ANY-INK');
		expect(toastText()).toBe('Saved project file');
		expect(events.at(-1)).toMatchObject({ handle: false, saved: true, reason: 'download' });
		expect(await listRecentProjects()).toEqual([]);
	});

	it('saveProjectAs, downloadProject and saveProjectText all download too', async () => {
		const api = fakeApi({});
		setFileApi(api);
		const editor = fakeEditor('DL');
		expect(await saveProjectAs(editor)).toBe(true);
		expect(await downloadProject(editor)).toBe(true);
		expect(await saveProjectText(editor, '{"t":1}')).toBe(true);
		expect(api.calls.download).toHaveLength(3);
		expect(editor.savedCalls).toBe(3);
	});

	it('openProjectFromPicker and pickProjectFile resolve false', async () => {
		setFileApi(fakeApi({}));
		expect(await pickProjectFile()).toBe(false);
		expect(await openProjectFromPicker()).toBe(false);
	});
});

describe('project_files: open', () => {
	it('openProjectFromHandle reads, loads, remembers, publishes', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const handle = fakeFileHandle('Opened.gs2', { query: 'prompt', text: minimalProjectText('Opened') });
		const editor = fakeEditor('Opened');
		const load = vi.fn(() => editor);
		expect(await openProjectFromHandle(handle, { load })).toBe('opened');
		expect(load).toHaveBeenCalledTimes(1);
		const [content, passedHandle] = load.mock.calls[0];
		expect(content.settings.project.name).toBe('Opened');
		expect(passedHandle).toBe(handle);
		expect(handle.calls.request).toBe(1);
		expect(await recallHandle(LAST_PROJECT_KEY)).toBe(handle);
		expect((await listRecentProjects())[0]).toMatchObject({ handle, name: 'Opened' });
		expect(editor.published.at(-1)).toMatchObject({
			topic: 'projectFile',
			data: { handle, saved: true, reason: 'open' },
		});
	});

	it('asks for the requested permission mode', async () => {
		const handle = fakeFileHandle('Mode.gs2', { text: minimalProjectText('Mode') });
		const spy = vi.spyOn(handle, 'queryPermission');
		await openProjectFromHandle(handle, { mode: 'readwrite', load: () => fakeEditor() });
		expect(spy).toHaveBeenCalledWith({ mode: 'readwrite' });
		await openProjectFromHandle(handle, { load: () => fakeEditor() });
		expect(spy).toHaveBeenLastCalledWith({ mode: 'read' });
	});

	it('reports denied / prompt without loading anything', async () => {
		const load = vi.fn();
		const denied = fakeFileHandle('Denied.gs2', { query: 'denied' });
		expect(await openProjectFromHandle(denied, { load })).toBe('denied');
		const prompt = fakeFileHandle('Prompt.gs2', { query: 'prompt', request: 'prompt' });
		expect(await openProjectFromHandle(prompt, { load })).toBe('prompt');
		expect(load).not.toHaveBeenCalled();
		expect(await listRecentProjects()).toEqual([]);
	});

	it("reports 'missing' quietly and 'invalid' with the error dialog", async () => {
		const load = vi.fn();
		const gone = fakeFileHandle('Gone.gs2', { missing: true });
		expect(await openProjectFromHandle(gone, { load })).toBe('missing');
		expect(document.querySelector('#error')).toBeNull();
		const bad = fakeFileHandle('Bad.gs2', { text: 'not json' });
		expect(await openProjectFromHandle(bad, { load })).toBe('invalid');
		expect(document.querySelector('#error').innerHTML).toContain('[PF0]');
		expect(await openProjectFromHandle(null, { load })).toBe('invalid');
		expect(load).not.toHaveBeenCalled();
	});

	it('openProjectFromPicker uses the picker options and resolves the handle', async () => {
		const handle = fakeFileHandle('Picked.gs2', { text: minimalProjectText('Picked') });
		const api = fakeApi({ open: [handle], save: undefined });
		setFileApi(api);
		const editor = fakeEditor('Picked');
		expect(await openProjectFromPicker({ load: () => editor })).toBe(handle);
		expect(api.calls.open[0]).toMatchObject({
			id: PROJECT_PICKER_ID,
			multiple: false,
			startIn: 'documents',
		});
		expect(api.calls.open[0].types[0].accept['application/json']).toEqual(['.gs2']);
		expect((await listRecentProjects())[0].handle).toBe(handle);
	});

	it('openProjectFromPicker resolves false when cancelled or when the file is not a project', async () => {
		setFileApi(fakeApi({ open: abortError(), save: undefined }));
		expect(await openProjectFromPicker({ load: vi.fn() })).toBe(false);
		const bad = fakeFileHandle('Bad.gs2', { text: '{}' });
		setFileApi(fakeApi({ open: [bad], save: undefined }));
		expect(await openProjectFromPicker({ load: vi.fn() })).toBe(false);
		expect(document.querySelector('#error')).not.toBeNull();
	});
});

describe('project_files: names', () => {
	it('builds a safe .gs2 file name from the project name', () => {
		expect(projectFileName(fakeEditor('My Font'))).toBe('My Font.gs2');
		expect(projectFileName(fakeEditor('A/B:C*D?'))).toBe('A-B-C-D-.gs2');
		expect(projectFileName({ project: { settings: { project: { name: '' } } } })).toBe(
			'Untitled.gs2'
		);
		expect(projectFileName(undefined)).toBe('Untitled.gs2');
	});
});

describe('project_files: ProjectEditor integration', () => {
	it('editor.saveProjectFile routes to saveProject / saveProjectAs', async () => {
		const picked = fakeFileHandle('As.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = makeRealEditor('Route');
		const inPlace = fakeFileHandle('Route.gs2');
		editor.loadedFileHandle = inPlace;
		expect(await editor.saveProjectFile()).toBe(true);
		expect(JSON.parse(inPlace.written).settings.project.name).toBe('Route');
		expect(api.calls.save).toHaveLength(0);
		expect(await editor.saveProjectFile(true)).toBe(true);
		expect(api.calls.save).toHaveLength(1);
		expect(editor.loadedFileHandle).toBe(picked);
	});

	it('makeProjectFileText embeds assets only when there are some', async () => {
		const editor = makeRealEditor('Assets');
		expect(JSON.parse(await editor.makeProjectFileText()).assets).toBeUndefined();
		editor.assets.toSaveObject = async () => ({ 'img-abc12345': { type: 'image/png', data: 'AAAA' } });
		const withAssets = JSON.parse(await editor.makeProjectFileText());
		expect(withAssets.assets['img-abc12345'].type).toBe('image/png');
	});

	it('setProjectAsSaved / setProjectAsUnsaved publish only on a change', () => {
		const editor = makeRealEditor('Dot');
		const events = collectProjectFile(editor);
		editor.setProjectAsSaved();
		expect(events).toHaveLength(0);
		editor.setProjectAsUnsaved();
		editor.setProjectAsUnsaved();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ saved: false });
		expect(document.title).toBe('ANY-INK •');
		editor.setProjectAsSaved();
		expect(events).toHaveLength(2);
		expect(events[1]).toMatchObject({ saved: true });
		expect(document.title).toBe('ANY-INK');
	});
});

// --------------------------------------------------------------
// Integration seams (M6 sweep)
// --------------------------------------------------------------

describe('project_files: crash recovery hand-off (D-026)', () => {
	let restoreDeps = null;

	beforeEach(async () => {
		await recClear();
	});

	afterEach(() => {
		stopRecovery();
		if (restoreDeps) restoreDeps();
		restoreDeps = null;
	});

	async function flush(times = 20) {
		for (let i = 0; i < times; i++) await Promise.resolve();
	}

	it("a save in place calls markClean: the session's record goes and the timer stops", async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = makeRealEditor('Recover Me');
		restoreDeps = useRecovery(editor);
		markDirty();
		expect(await snapshotNow('manual')).toBe(true);
		expect((await recoveryRecord(editor)).dirty).toBe(true);
		markDirty();
		expect(getRecoveryStatus().dirty).toBe(true);
		expect(getRecoveryStatus().timerPending).toBe(true);
		const handle = fakeFileHandle('Recover.gs2');
		editor.loadedFileHandle = handle;

		expect(await saveProject(editor)).toBe(true);
		await flush();

		expect(getRecoveryStatus().dirty).toBe(false);
		expect(getRecoveryStatus().timerPending).toBe(false);
		expect(await recoveryRecord(editor)).toBeUndefined();
	});

	it('the download fallback marks recovery clean too', async () => {
		setFileApi(fakeApi({}));
		const editor = makeRealEditor('Download Clean');
		restoreDeps = useRecovery(editor);
		markDirty();
		expect(await snapshotNow('manual')).toBe(true);
		expect(await saveProject(editor)).toBe(true);
		await flush();
		expect(getRecoveryStatus().dirty).toBe(false);
		expect(await recoveryRecord(editor)).toBeUndefined();
	});

	it('a cancelled Save As leaves the project dirty', async () => {
		setFileApi(fakeApi({ open: [], save: abortError() }));
		const editor = makeRealEditor('Still Dirty');
		restoreDeps = useRecovery(editor);
		markDirty();
		expect(await saveProjectAs(editor)).toBe(false);
		await flush();
		expect(getRecoveryStatus().dirty).toBe(true);
	});
});

describe('project_files: noteProjectOpened (drag and drop, upstream chooser)', () => {
	it('records a file handle: lastProject, recents, projectFile', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = makeRealEditor('Dropped');
		const events = collectProjectFile(editor);
		const handle = fakeFileHandle('Dropped.gs2');

		expect(await noteProjectOpened(editor, handle)).toBe(true);

		expect(await recallHandle(LAST_PROJECT_KEY)).toBe(handle);
		const recents = await listRecentProjects();
		expect(recents).toHaveLength(1);
		expect(recents[0]).toMatchObject({ handle, name: 'Dropped' });
		expect(events.at(-1)).toMatchObject({ handle, saved: true, reason: 'open' });
	});

	it('ignores false and a plain File (no File System Access API)', async () => {
		const editor = makeRealEditor('Plain');
		const events = collectProjectFile(editor);
		expect(await noteProjectOpened(editor, false)).toBe(false);
		expect(await noteProjectOpened(editor, new File(['{}'], 'plain.gs2'))).toBe(false);
		expect(await listRecentProjects()).toEqual([]);
		expect(await recallHandle(LAST_PROJECT_KEY)).toBeNull();
		expect(events).toEqual([]);
	});
});

// --------------------------------------------------------------
// Review fixes (M6 hostile review)
// --------------------------------------------------------------

describe('project_files: an edit that lands mid-save stays unsaved (finding 2)', () => {
	let restoreDeps = null;

	beforeEach(async () => {
		await recClear();
	});

	afterEach(() => {
		stopRecovery();
		if (restoreDeps) restoreDeps();
		restoreDeps = null;
	});

	async function flush(times = 20) {
		for (let i = 0; i < times; i++) await Promise.resolve();
	}

	/** An editor whose save awaits (like base64 asset encoding) while the user edits. */
	function editorWithEditDuringSave(name) {
		const editor = makeRealEditor(name);
		editor.assets.toSaveObject = async () => {
			await Promise.resolve();
			editor.project.getItem('glyph-0x41', true).advanceWidth = 777;
			editor.setProjectAsUnsaved();
			markDirty();
			return {};
		};
		editor.project.getItem('glyph-0x41', true).advanceWidth = 600;
		return editor;
	}

	it('in place: the file is written, but the dot and the recovery snapshot stay', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = editorWithEditDuringSave('Mid Save');
		restoreDeps = useRecovery(editor);
		markDirty();
		editor.setProjectAsUnsaved();
		expect(await snapshotNow('manual')).toBe(true);
		const handle = fakeFileHandle('Mid.gs2');
		editor.loadedFileHandle = handle;

		expect(await saveProject(editor)).toBe(true);
		await flush();

		expect(JSON.parse(handle.written).glyphs['glyph-0x41'].advanceWidth).toBe(600);
		expect(editor.project.getItem('glyph-0x41').advanceWidth).toBe(777);
		expect(document.title).toBe('ANY-INK •');
		expect(getRecoveryStatus().dirty).toBe(true);
		expect(getRecoveryStatus().timerPending).toBe(true);
		expect((await recoveryRecord(editor))?.dirty).toBe(true);
		expect(toastText()).toContain('Saved Mid.gs2');
		expect(toastText()).toContain('not in the file yet');
	});

	it('download fallback: same guard', async () => {
		setFileApi(fakeApi({}));
		const editor = editorWithEditDuringSave('Mid Download');
		restoreDeps = useRecovery(editor);
		markDirty();
		editor.setProjectAsUnsaved();
		expect(await snapshotNow('manual')).toBe(true);
		expect(await saveProject(editor)).toBe(true);
		await flush();
		expect(document.title).toBe('ANY-INK •');
		expect(getRecoveryStatus().dirty).toBe(true);
		expect((await recoveryRecord(editor))?.dirty).toBe(true);
	});

	it('no edit during the save: saved and clean as before', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = makeRealEditor('Quiet Save');
		restoreDeps = useRecovery(editor);
		markDirty();
		editor.setProjectAsUnsaved();
		editor.loadedFileHandle = fakeFileHandle('Quiet.gs2');
		expect(await saveProject(editor)).toBe(true);
		await flush();
		expect(document.title).toBe('ANY-INK');
		expect(getRecoveryStatus().dirty).toBe(false);
		expect(toastText()).toBe('Saved Quiet.gs2');
	});
});

// Verification of finding 2: when an edit overtakes a save, the dot stays, but the
// undo state the file holds is still recorded, so undo can tell when it is back there.
describe('project_files: the saved state after an edit overtook a save', () => {
	it('undo back to what the file holds clears the dot; undo past it shows the dot', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const handle = fakeFileHandle('Race.gs2');
		const editor = new ProjectEditor();
		editor.loadedFileHandle = handle; // opened from Race.gs2
		editor.project = new GlyphrStudioProject({
			settings: {
				project: { name: 'Race', id: 'g2_RACE' },
				font: { family: 'Race', upm: 1000, ascent: 800, descent: -200 },
				app: { autoSave: false },
			},
			glyphs: { 'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 600 } },
		});
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		const widthA = () => editor.project.glyphs['glyph-0x41'].advanceWidth;
		const editA = (width) => {
			editor.project.glyphs['glyph-0x41'].advanceWidth = width;
			editor.history.addState(`A to ${width}`);
		};
		editA(700);
		// The next edit lands while the file is being written.
		const createWritable = handle.createWritable;
		handle.createWritable = async (options) => {
			const writable = await createWritable(options);
			const write = writable.write;
			writable.write = async (data) => {
				await write(data);
				editA(800);
			};
			return writable;
		};

		expect(await saveProject(editor)).toBe(true);
		expect(JSON.parse(handle.written).glyphs['glyph-0x41'].advanceWidth).toBe(700);
		expect(widthA()).toBe(800);
		expect(document.title).toBe('ANY-INK •');
		editor.history.restoreState(); // 700 = what the file holds
		expect(widthA()).toBe(700);
		expect(document.title).toBe('ANY-INK');
		editor.history.restoreState(); // 600: the file still holds 700
		expect(widthA()).toBe(600);
		expect(document.title).toBe('ANY-INK •');
	});
});

describe('project_files: only .gs2 files are written in place (finding 3)', () => {
	it('a v1 .txt handle is never overwritten: Save goes to Save As with <name>.gs2', async () => {
		const picked = fakeFileHandle('MyFont.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('MyFont', '{"v2":true}');
		const v1 = fakeFileHandle('MyFont.txt', { initial: 'V1 PROJECT' });
		editor.loadedFileHandle = v1;
		expect(await saveProject(editor)).toBe(true);
		expect(v1.written).toBe('V1 PROJECT');
		expect(v1.calls.createWritable).toBe(0);
		expect(api.calls.save).toHaveLength(1);
		expect(api.calls.save[0].suggestedName).toBe('MyFont.gs2');
		expect(picked.written).toBe('{"v2":true}');
		expect(editor.loadedFileHandle).toBe(picked);
	});

	it('openProjectFromHandle does not hand a .txt handle to the loader', async () => {
		const v1 = fakeFileHandle('Old.txt', { text: minimalProjectText('Old', '1.13.2') });
		const load = vi.fn(() => fakeEditor('Old'));
		expect(await openProjectFromHandle(v1, { load })).toBe('opened');
		expect(load.mock.calls[0][1]).toBe(false);
		const gs2 = fakeFileHandle('New.gs2', { text: minimalProjectText('New') });
		await openProjectFromHandle(gs2, { load });
		expect(load.mock.calls[1][1]).toBe(gs2);
	});

	it('noteProjectOpened: a .txt is not a recent project, but Save As starts next to it', async () => {
		const picked = fakeFileHandle('Converted.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('Converted');
		const v1 = fakeFileHandle('Converted.txt');
		await noteProjectOpened(editor, v1);
		expect(await listRecentProjects()).toEqual([]);
		expect(await saveProject(editor)).toBe(true);
		expect(api.calls.save[0].startIn).toBe(v1);
	});
});

describe('project_files: expired clicks and refused permission (finding 6)', () => {
	it('SecurityError from the save picker resolves false and asks for one more click', async () => {
		const api = fakeApi({ open: [], save: securityError() });
		setFileApi(api);
		const editor = fakeEditor('Late');
		expect(await saveProjectAs(editor)).toBe(false);
		expect(toastText()).toBe('Click Save again to choose where to save.');
		expect(editor.savedCalls).toBe(0);
		expect(document.querySelector('#error')).toBeNull();
	});

	it('SecurityError from the open picker resolves false too', async () => {
		setFileApi(fakeApi({ open: securityError(), save: undefined }));
		expect(await pickProjectFile()).toBe(false);
		expect(toastText()).toBe('Click Open again to choose a project file.');
	});

	it("a Blocked file says so before the Save As picker opens", async () => {
		const picked = fakeFileHandle('Elsewhere.gs2');
		let toastWhenPickerOpened = '';
		const api = fakeApi({
			open: [],
			save: () => {
				toastWhenPickerOpened = toastText();
				return picked;
			},
		});
		setFileApi(api);
		const editor = fakeEditor('Blocked');
		editor.loadedFileHandle = fakeFileHandle('Blocked.gs2', { query: 'prompt', request: 'denied' });
		expect(await saveProject(editor)).toBe(true);
		expect(toastWhenPickerOpened).toBe(
			'ANY-INK was not allowed to write Blocked.gs2. Choose a new file.'
		);
		expect(picked.written).toBe('{"fake":true}');
	});

	it("Blocked, then the picker's click has expired: no rejection, one more click", async () => {
		setFileApi(fakeApi({ open: [], save: securityError() }));
		const editor = fakeEditor('Blocked Late');
		editor.loadedFileHandle = fakeFileHandle('Late.gs2', { query: 'prompt', request: 'denied' });
		expect(await saveProject(editor)).toBe(false);
		expect(toastText()).toBe('Click Save again to choose where to save.');
	});

	it("a permission prompt that was dismissed asks for one more click (no Save As picker)", async () => {
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		const editor = fakeEditor('Dismissed');
		const handle = fakeFileHandle('Dismissed.gs2', { query: 'prompt', request: 'prompt' });
		editor.loadedFileHandle = handle;
		expect(await saveProject(editor)).toBe(false);
		expect(api.calls.save).toHaveLength(0);
		expect(toastText()).toBe('Click Save again to write Dismissed.gs2.');
		expect(editor.loadedFileHandle).toBe(handle);
	});
});

describe('project_files: the write error says what happened (finding 8)', () => {
	let warn;
	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => warn.mockRestore());

	it('NotFoundError: says the file moved, then Save As', async () => {
		const picked = fakeFileHandle('Found.gs2');
		let toastWhenPickerOpened = '';
		const api = fakeApi({
			open: [],
			save: () => {
				toastWhenPickerOpened = toastText();
				return picked;
			},
		});
		setFileApi(api);
		const editor = fakeEditor('Moved');
		editor.loadedFileHandle = fakeFileHandle('Moved.gs2', {
			createError: namedError('NotFoundError', 'A requested file could not be found.'),
		});
		expect(await saveProject(editor)).toBe(true);
		expect(toastWhenPickerOpened).toBe('Moved.gs2 is no longer where it was. Choose where to save it.');
		expect(picked.written).toBe('{"fake":true}');
		expect(editor.loadedFileHandle).toBe(picked);
		expect(document.querySelector('#error')).toBeNull();
	});

	it('NotAllowedError: says ANY-INK may not write it, then Save As', async () => {
		const picked = fakeFileHandle('Allowed.gs2');
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('Refused');
		editor.loadedFileHandle = fakeFileHandle('Refused.gs2', {
			createError: namedError('NotAllowedError', 'The request is not allowed.'),
		});
		expect(await saveProject(editor)).toBe(true);
		expect(api.calls.save).toHaveLength(1);
		expect(picked.written).toBe('{"fake":true}');
	});

	it('NoModificationAllowedError: the another-window text, no picker', async () => {
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		const editor = fakeEditor('Locked');
		editor.loadedFileHandle = fakeFileHandle('Locked.gs2', {
			writeError: namedError('NoModificationAllowedError', 'lock held'),
		});
		expect(await saveProject(editor)).toBe(false);
		const error = document.querySelector('#error').innerHTML;
		expect(error).toContain('Locked.gs2 could not be saved');
		expect(error).toContain('another window');
		expect(api.calls.save).toHaveLength(0);
	});

	it('anything else: a plain could-not-save with the message, no another-window guess', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		const editor = fakeEditor('Full');
		editor.loadedFileHandle = fakeFileHandle('Full.gs2', {
			writeError: namedError('QuotaExceededError', 'The disk is full.'),
		});
		expect(await saveProject(editor)).toBe(false);
		const error = document.querySelector('#error').innerHTML;
		expect(error).toContain('Full.gs2 could not be saved');
		expect(error).toContain('The disk is full.');
		expect(error).not.toContain('another window');
	});

	it('a file just picked in Save As that fails is reported, not re-picked', async () => {
		const picked = fakeFileHandle('Picked.gs2', {
			createError: namedError('NotFoundError', 'gone already'),
		});
		const api = fakeApi({ open: [], save: picked });
		setFileApi(api);
		const editor = fakeEditor('Once');
		expect(await saveProjectAs(editor)).toBe(false);
		expect(api.calls.save).toHaveLength(1);
		expect(document.querySelector('#error').innerHTML).toContain('gone already');
	});
});
