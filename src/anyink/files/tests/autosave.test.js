// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import * as recovery from '../../recovery/recovery.js';
import { isSessionKey } from '../../recovery/snapshot.js';
import { recEntries as storeEntries, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import { autosaveNow } from '../autosave.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import {
	noteProjectOpened,
	openProjectFromHandle,
	saveProject,
	saveProjectAs,
} from '../project_files.js';
import { adoptFileVersion, rememberFileVersion, savedFileVersion } from '../save_queue.js';
import { getSaveStatus } from '../save_status.js';
import { clearDialogs } from './fakes.js';

// B10 + B11 integration (D-042): the Undo list's saved copies are records of their own beside
// each session's record; these checks read the session records
const recEntries = async () => (await storeEntries()).filter(([key]) => isSessionKey(key));

const A = 'glyph-0x41';
let editors, resetStorage, resetRecovery, api;

function project(id = 'autosave') {
	return new GlyphrStudioProject({
		settings: { project: { id, name: id } },
		glyphs: {
			[A]: { id: A, advanceWidth: 600 },
			'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 600 },
		},
	});
}

function deferred() {
	let resolve;
	const promise = new Promise((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

// A writable stages data until close, as File System Access does. Each successful
// close changes the file version; two handle objects can point to the same disk.
function fileHandle(disk = { text: '{}', version: 1 }) {
	const handle = {
		kind: 'file',
		name: 'Autosave.gs2',
		disk,
		writes: [],
		abort: vi.fn(async () => {}),
		queryPermission: vi.fn(async () => 'granted'),
		requestPermission: vi.fn(async () => 'granted'),
		getFile: vi.fn(async () => {
			const text = disk.text;
			return { lastModified: disk.version, size: text.length, text: async () => text };
		}),
		isSameEntry: async (other) => other.disk === disk,
	};
	handle.createWritable = vi.fn(async () => {
		let staged;
		return {
			write: async (text) => {
				staged = text;
				handle.writes.push(text);
			},
			close: async () => {
				if (handle.closeGate) {
					handle.closeGate.entered.resolve();
					await handle.closeGate.release.promise;
				}
				if (handle.failure) throw handle.failure;
				disk.text = staged;
				disk.version++;
			},
			abort: handle.abort,
		};
	});
	return handle;
}

async function editorWith(handle = fileHandle(), id = 'autosave') {
	const editor = new ProjectEditor({ project: project(id) });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.editCanvas = { redraw() {} };
	editor.loadedFileHandle = handle;
	editor.setProjectAsSaved();
	editors.push(editor);
	recovery.resyncRecovery();
	await rememberFileVersion(editor, handle);
	return editor;
}

function edit(editor, width) {
	setCurrentProjectEditor(editor);
	editor.project.glyphs[A].advanceWidth = width;
	editor.history.addState(`Width ${width}`);
}

function holdClose(handle) {
	const gate = { entered: deferred(), release: deferred() };
	handle.closeGate = gate;
	return gate;
}

const widthIn = (text) => JSON.parse(text).glyphs[A].advanceWidth;

beforeEach(() => {
	vi.useFakeTimers();
	editors = [];
	resetStorage = setStorageDriver(fakeDriver());
	resetRecovery = recovery.setRecoveryDeps({
		getEditor: () => editors[0],
		getEditors: () => editors,
		locks: () => undefined,
		toast: () => {},
	});
	api = { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn(), download: vi.fn() };
	setFileApi(api);
	recovery.initRecovery();
});

afterEach(async () => {
	recovery.stopRecovery();
	await vi.advanceTimersByTimeAsync(0);
	resetRecovery();
	resetStorage();
	resetFileApi();
	clearDialogs();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('real editor autosave regressions', () => {
	it('a glyph switch during a slow save flushes the newer edit without another timer interval', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		const gate = holdClose(handle);
		edit(editor, 610);
		const saving = autosaveNow(editor);
		await gate.entered.promise;
		edit(editor, 620);
		editor.selectedGlyphID = 'glyph-0x42';
		await vi.advanceTimersByTimeAsync(0);
		expect(handle.writes.map(widthIn)).toEqual([610]);
		expect(editor.history.isAtSavedState()).toBe(false);
		gate.release.resolve();
		await saving;
		// Drain the glyph-switch callback's promises without advancing the 3s timer
		// or calling autosaveNow again, which would mask a missing immediate flush.
		await vi.advanceTimersByTimeAsync(0);
		expect(handle.writes.map(widthIn)).toEqual([610, 620]);
		expect(widthIn(handle.disk.text)).toBe(620);
		expect(getSaveStatus(editor)).toMatchObject({ file: 'saved', revision: 2 });
		expect(editor.history.isAtSavedState()).toBe(true);
	});

	it('a delayed permission result cannot write or change the replacement project status', async () => {
		const editor = await editorWith();
		const oldHandle = editor.loadedFileHandle;
		const entered = deferred();
		const permission = deferred();
		oldHandle.queryPermission.mockImplementationOnce(() => {
			entered.resolve();
			return permission.promise;
		});
		edit(editor, 610);
		const saving = autosaveNow(editor);
		await entered.promise;
		const newHandle = fileHandle();
		editor.loadedFileHandle = newHandle;
		editor.project = project('permission-replacement');
		recovery.resyncRecovery();
		await rememberFileVersion(editor, newHandle);
		edit(editor, 780);
		await recovery.snapshotNow('manual', editor);
		const before = getSaveStatus(editor);
		permission.resolve('granted');
		expect(await saving).toBe(false);
		expect(oldHandle.createWritable).not.toHaveBeenCalled();
		expect(newHandle.createWritable).not.toHaveBeenCalled();
		expect(editor.loadedFileHandle).toBe(newHandle);
		expect(getSaveStatus(editor)).toEqual(before);
		expect(editor.history.isAtSavedState()).toBe(false);
		expect(
			(await recEntries()).find(([, record]) => record.id === 'permission-replacement')[1].project
				.glyphs[A].advanceWidth
		).toBe(780);
		await vi.advanceTimersByTimeAsync(3000);
		expect(widthIn(newHandle.disk.text)).toBe(780);
		expect(getSaveStatus(editor).file).toBe('saved');
	});

	it.each(['stop', 'remove'])(
		'ending a session by %s prevents an in-flight autosave from scheduling another write',
		async (ending) => {
			const editor = await editorWith();
			const handle = editor.loadedFileHandle;
			const gate = holdClose(handle);
			edit(editor, 610);
			const saving = autosaveNow(editor);
			await gate.entered.promise;
			edit(editor, 620);
			await recovery.snapshotNow('manual', editor);
			if (ending === 'stop') recovery.stopRecovery();
			else {
				editors.length = 0;
				recovery.resyncRecovery();
			}
			gate.release.resolve();
			await saving;
			await vi.advanceTimersByTimeAsync(9000);
			expect(handle.writes.map(widthIn)).toEqual([610]);
			expect(editor.history.isAtSavedState()).toBe(false);
			expect((await recEntries())[0][1].project.glyphs[A].advanceWidth).toBe(620);
		}
	);

	it('a new project still autosaves when its timer fires before the old project finishes writing', async () => {
		const editor = await editorWith();
		const oldHandle = editor.loadedFileHandle;
		const gate = holdClose(oldHandle);
		edit(editor, 610);
		const oldSave = autosaveNow(editor);
		await gate.entered.promise;
		const newHandle = fileHandle();
		editor.loadedFileHandle = newHandle;
		editor.project = project('replacement');
		recovery.resyncRecovery();
		await rememberFileVersion(editor, newHandle);
		edit(editor, 720);
		await vi.advanceTimersByTimeAsync(3000);
		gate.release.resolve();
		await oldSave;
		await vi.advanceTimersByTimeAsync(3000);
		expect(newHandle.writes.map(widthIn)).toEqual([720]);
		expect(editor.loadedFileHandle).toBe(newHandle);
		expect(getSaveStatus(editor).file).toBe('saved');
	});

	it('a slow open baseline never clears an edit made while the baseline is being read', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		const read = deferred();
		handle.getFile.mockReturnValueOnce(read.promise);
		const opening = noteProjectOpened(editor, handle);
		edit(editor, 730);
		const openedText = handle.disk.text;
		read.resolve({
			lastModified: handle.disk.version,
			size: openedText.length,
			text: async () => openedText,
		});
		await opening;
		expect(getSaveStatus(editor)).toMatchObject({ file: 'pending', revision: 1 });
		await vi.advanceTimersByTimeAsync(3000);
		expect(widthIn(handle.disk.text)).toBe(730);
	});

	it('an older baseline read completing late cannot replace the new project baseline', async () => {
		const editor = await editorWith();
		const oldHandle = editor.loadedFileHandle;
		const read = deferred();
		oldHandle.getFile.mockReturnValueOnce(read.promise);
		const olderRead = rememberFileVersion(editor, oldHandle);
		const newHandle = fileHandle({ text: '{"new":true}', version: 99 });
		editor.loadedFileHandle = newHandle;
		editor.project = project('new-baseline');
		recovery.resyncRecovery();
		await rememberFileVersion(editor, newHandle);
		const expected = savedFileVersion(editor);
		read.resolve({ lastModified: 1, size: 2 });
		await olderRead;
		expect(savedFileVersion(editor)).toBe(expected);
		edit(editor, 740);
		expect(await autosaveNow(editor)).toBe(true);
	});

	it('opening captures the version of the bytes read, not an external edit made before the open tail', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		handle.disk.text = await editor.makeProjectFileText();
		const externalText = JSON.stringify({ ...JSON.parse(handle.disk.text), externalChange: true });
		const result = await openProjectFromHandle(handle, {
			load: (content, openedHandle) => {
				editor.loadedFileHandle = openedHandle;
				editor.project = new GlyphrStudioProject(content);
				recovery.resyncRecovery();
				// Another writer commits after the read, before noteProjectOpened runs.
				handle.disk.text = externalText;
				handle.disk.version++;
				return editor;
			},
		});
		expect(result).toBe('opened');
		edit(editor, 750);
		expect(await autosaveNow(editor)).toBe(false);
		expect(handle.disk.text).toBe(externalText);
		expect(handle.writes).toHaveLength(0);
	});

	it.each(['same handle', 'equivalent handle'])(
		'Save As choosing the %s checks external changes before overwriting',
		async (choice) => {
			const editor = await editorWith();
			const handle = editor.loadedFileHandle;
			edit(editor, 760);
			await recovery.snapshotNow('manual', editor);
			handle.disk.text = '{"external":"keep me"}';
			handle.disk.version++;
			const picked = choice === 'same handle' ? handle : fileHandle(handle.disk);
			api.showSaveFilePicker.mockResolvedValue(picked);
			expect(await saveProjectAs(editor)).toBe(false);
			expect(handle.disk.text).toBe('{"external":"keep me"}');
			expect(picked.writes).toHaveLength(0);
			expect(picked.abort).toHaveBeenCalledTimes(1);
			expect(getSaveStatus(editor)).toMatchObject({ file: 'failed', recovery: 'saved' });
			expect(editor.history.isAtSavedState()).toBe(false);
		}
	);

	it('writes by three seconds during continuous edits, then repeats for newer edits', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		for (let cycle = 0; cycle < 2; cycle++) {
			for (let tick = 0; tick < 6; tick++) {
				edit(editor, 601 + cycle * 6 + tick);
				await vi.advanceTimersByTimeAsync(499);
				if (tick === 5) expect(handle.writes).toHaveLength(cycle);
				await vi.advanceTimersByTimeAsync(1);
			}
			expect(handle.writes).toHaveLength(cycle + 1);
			expect(widthIn(handle.disk.text)).toBe(606 + cycle * 6);
			expect(getSaveStatus(editor)).toMatchObject({ file: 'saved', revision: (cycle + 1) * 6 });
			expect(editor.history.isAtSavedState()).toBe(true);
		}
	});

	it('switching glyphs saves the edited glyph before the interval expires', async () => {
		const editor = await editorWith();
		edit(editor, 654);
		editor.selectedGlyphID = 'glyph-0x42';
		await vi.advanceTimersByTimeAsync(0);
		expect(widthIn(editor.loadedFileHandle.disk.text)).toBe(654);
		expect(getSaveStatus(editor).file).toBe('saved');
	});

	it.each(['denied', 'prompt'])(
		'permission %s retains recovery without requesting permission or opening a picker',
		async (permission) => {
			const editor = await editorWith();
			const handle = editor.loadedFileHandle;
			handle.queryPermission.mockResolvedValue(permission);
			edit(editor, 655);
			await vi.advanceTimersByTimeAsync(3000);
			expect(handle.requestPermission).not.toHaveBeenCalled();
			expect(handle.createWritable).not.toHaveBeenCalled();
			expect(api.showSaveFilePicker).not.toHaveBeenCalled();
			expect(api.showOpenFilePicker).not.toHaveBeenCalled();
			expect(api.download).not.toHaveBeenCalled();
			expect(getSaveStatus(editor)).toMatchObject({
				file: 'failed',
				recovery: 'saved',
				revision: 1,
			});
			expect((await recEntries())[0][1].project.glyphs[A].advanceWidth).toBe(655);
			expect(editor.history.isAtSavedState()).toBe(false);
		}
	);

	it('failed close keeps the latest recovery copy and a later save can succeed', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		handle.failure = new DOMException('Disk full', 'QuotaExceededError');
		edit(editor, 656);
		await vi.advanceTimersByTimeAsync(3000);
		expect(handle.disk.text).toBe('{}');
		expect(getSaveStatus(editor)).toMatchObject({ file: 'failed', recovery: 'saved', revision: 1 });
		expect((await recEntries())[0][1].project.glyphs[A].advanceWidth).toBe(656);
		expect(recovery.getRecoveryStatus().dirty).toBe(true);
		handle.failure = null;
		expect(await autosaveNow(editor)).toBe(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(widthIn(handle.disk.text)).toBe(656);
		expect(getSaveStatus(editor).file).toBe('saved');
		expect(await recEntries()).toHaveLength(0);
	});

	it.each(['automatic', 'manual'])(
		'serializes a %s save followed by the other kind and captures edits made while queued',
		async (firstKind) => {
			const editor = await editorWith();
			const handle = editor.loadedFileHandle;
			const gate = holdClose(handle);
			edit(editor, 610);
			const first = firstKind === 'automatic' ? autosaveNow(editor) : saveProject(editor);
			await gate.entered.promise;
			const second = firstKind === 'automatic' ? saveProject(editor) : autosaveNow(editor);
			edit(editor, 620);
			await recovery.snapshotNow('manual', editor);
			expect(handle.createWritable).toHaveBeenCalledTimes(1);
			expect(editor.history.isAtSavedState()).toBe(false);
			gate.release.resolve();
			expect(await first).toBe(true);
			expect(await second).toBe(true);
			expect(handle.writes.map(widthIn)).toEqual([610, 620]);
			expect(widthIn(handle.disk.text)).toBe(620);
			expect(getSaveStatus(editor)).toMatchObject({ file: 'saved', revision: 2 });
			expect(editor.history.isAtSavedState()).toBe(true);
		}
	);

	it('an edit during a lone save stays dirty and protected until the next autosave', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		const gate = holdClose(handle);
		edit(editor, 610);
		const saving = autosaveNow(editor);
		await gate.entered.promise;
		edit(editor, 620);
		await recovery.snapshotNow('manual', editor);
		gate.release.resolve();
		await saving;
		expect(widthIn(handle.disk.text)).toBe(610);
		expect(getSaveStatus(editor)).toMatchObject({
			file: 'pending',
			recovery: 'saved',
			revision: 2,
		});
		expect(editor.history.isAtSavedState()).toBe(false);
		expect((await recEntries())[0][1].project.glyphs[A].advanceWidth).toBe(620);
		await vi.advanceTimersByTimeAsync(3000);
		expect(widthIn(handle.disk.text)).toBe(620);
		expect(editor.history.isAtSavedState()).toBe(true);
	});

	it.each(['automatic', 'manual', 'saveAs'])(
		'replacing a project during %s never adopts the old handle or marks the new project saved',
		async (kind) => {
			const editor = await editorWith();
			const oldHandle = kind === 'saveAs' ? fileHandle() : editor.loadedFileHandle;
			api.showSaveFilePicker.mockResolvedValue(oldHandle);
			const gate = holdClose(oldHandle);
			edit(editor, 610);
			const saving =
				kind === 'automatic'
					? autosaveNow(editor)
					: kind === 'manual'
					? saveProject(editor)
					: saveProjectAs(editor);
			await gate.entered.promise;
			const newHandle = fileHandle();
			editor.loadedFileHandle = newHandle;
			editor.project = project('replacement');
			recovery.resyncRecovery();
			await rememberFileVersion(editor, newHandle);
			edit(editor, 777);
			await recovery.snapshotNow('manual', editor);
			const before = getSaveStatus(editor);
			gate.release.resolve();
			expect(await saving).toBe(false);
			expect(editor.loadedFileHandle).toBe(newHandle);
			expect(editor.project.settings.project.id).toBe('replacement');
			expect(editor.history.isAtSavedState()).toBe(false);
			expect(getSaveStatus(editor)).toEqual(before);
			expect(
				(await recEntries()).find(([, record]) => record.id === 'replacement')[1].project.glyphs[A]
					.advanceWidth
			).toBe(777);
		}
	);

	it.each(['automatic', 'manual'])(
		'editing another editor during a slow %s save does not leave the saved editor dirty',
		async (kind) => {
			const first = await editorWith(fileHandle(), 'first');
			const second = await editorWith(fileHandle(), 'second');
			const gate = holdClose(first.loadedFileHandle);
			edit(first, 701);
			const saving = kind === 'automatic' ? autosaveNow(first) : saveProject(first);
			await gate.entered.promise;
			edit(second, 802);
			await recovery.snapshotNow('manual', second);
			gate.release.resolve();
			expect(await saving).toBe(true);
			expect(getSaveStatus(first)).toMatchObject({ file: 'saved', revision: 1 });
			expect(first.history.isAtSavedState()).toBe(true);
			expect(getSaveStatus(second)).toMatchObject({
				file: 'pending',
				recovery: 'saved',
				revision: 1,
			});
			expect(second.history.isAtSavedState()).toBe(false);
			expect(
				recovery.getRecoveryStatus().sessions.find((session) => session.id === 'first').dirty
			).toBe(false);
		}
	);

	it('snapshots preserve the opened file baseline for conflict detection after recovery', async () => {
		const editor = await editorWith();
		const baseline = savedFileVersion(editor);
		edit(editor, 650);
		await recovery.snapshotNow('manual', editor);
		expect((await recEntries())[0][1].fileVersion).toBe(baseline);
		expect(baseline).not.toBeNull();
	});

	it('an unknown recovered file baseline requires manual Save before autosave can write', async () => {
		const editor = await editorWith();
		const handle = editor.loadedFileHandle;
		adoptFileVersion(editor, handle, null);
		edit(editor, 650);
		await recovery.snapshotNow('manual', editor);
		expect(await autosaveNow(editor)).toBe(false);
		expect(handle.disk.text).toBe('{}');
		expect(handle.writes).toHaveLength(0);
		expect(getSaveStatus(editor)).toMatchObject({ file: 'failed', recovery: 'saved' });
		expect(api.showSaveFilePicker).not.toHaveBeenCalled();
		expect(await saveProject(editor)).toBe(true);
		expect(widthIn(handle.disk.text)).toBe(650);
		edit(editor, 660);
		expect(await autosaveNow(editor)).toBe(true);
		expect(widthIn(handle.disk.text)).toBe(660);
	});

	it('two editors opened on the same file refuse to overwrite the first editor’s newer version', async () => {
		const handle = fileHandle();
		const first = await editorWith(handle, 'shared');
		const secondHandle = fileHandle(handle.disk);
		const second = await editorWith(secondHandle, 'shared');
		edit(first, 700);
		expect(await autosaveNow(first)).toBe(true);
		edit(second, 800);
		await recovery.snapshotNow('manual', second);
		expect(await autosaveNow(second)).toBe(false);
		expect(widthIn(handle.disk.text)).toBe(700);
		expect(secondHandle.writes).toHaveLength(0);
		expect(secondHandle.createWritable).toHaveBeenCalledWith({ mode: 'exclusive' });
		expect(secondHandle.abort).toHaveBeenCalledTimes(1);
		expect(getSaveStatus(second)).toMatchObject({ file: 'failed', recovery: 'saved' });
		expect(getSaveStatus(second).error).toMatch(/changed|conflict/i);
		expect(second.history.isAtSavedState()).toBe(false);
		expect(
			(await recEntries()).some(([, record]) => record.project.glyphs[A].advanceWidth === 800)
		).toBe(true);
		expect(api.showSaveFilePicker).not.toHaveBeenCalled();
	});
});
