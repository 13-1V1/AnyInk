// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kvClear } from '../../storage/kv.js';
import {
	EXPORT_FOLDER_KEY,
	EXPORT_PICKER_ID,
	MAX_EXPORTED_FILES,
	chooseExportFolder,
	exportFolderName,
	exportFontToFolder,
	forgetExportFolder,
	getLastExportMessage,
	noteImportedFontFile,
	pickExportFolder,
	preloadExportFolder,
	prepareExportDestination,
	writeExport,
} from '../export_folder.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { recallHandle, rememberHandle } from '../handles.js';
import {
	abortError,
	answerExistingFileDialog,
	clearDialogs,
	fakeApi,
	fakeDirectoryHandle,
	fakeUserActivation,
	namedError,
	securityError,
	toastText,
} from './fakes.js';

// jsdom has no Web Animations API; upstream's dialog close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

const blob = new Blob(['OTTO'], { type: 'font/opentype' });
const withPickers = (directory) =>
	fakeApi({ open: [], save: undefined, directory });

beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
});

afterEach(() => {
	resetFileApi();
	clearDialogs();
});

describe('export_folder: exportFontToFolder', () => {
	it('downloads when there is no File System Access API', async () => {
		const api = fakeApi({});
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'MyFont.otf')).toBe('download');
		expect(api.calls.download).toEqual([{ blob, fileName: 'MyFont.otf' }]);
		expect(toastText()).toContain('Downloading MyFont.otf');
	});

	it('writes fileName into the remembered folder and toasts where it went', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(new Error('picker must not open'));
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'MyFont-Regular.otf')).toBe('folder');
		const file = dir.files.get('MyFont-Regular.otf');
		expect(file.written).toBe(blob);
		expect(file.options).toEqual([{ mode: 'exclusive' }]);
		expect(api.calls.directory).toHaveLength(0);
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Exported MyFont-Regular.otf to Fonts');
	});

	it('asks for a folder the first time, remembers it, then writes', async () => {
		const dir = fakeDirectoryHandle('Exports');
		const api = withPickers(dir);
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'A.ttf')).toBe('folder');
		expect(api.calls.directory[0]).toEqual({
			id: EXPORT_PICKER_ID,
			mode: 'readwrite',
			startIn: 'documents',
		});
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBe(dir);
		expect(exportFolderName()).toBe('Exports');
		expect(dir.files.get('A.ttf').written).toBe(blob);
	});

	it('re-asks (starting in the old folder) when the remembered folder is denied', async () => {
		const old = fakeDirectoryHandle('Old', { query: 'denied' });
		await rememberHandle(EXPORT_FOLDER_KEY, old);
		const fresh = fakeDirectoryHandle('Fresh');
		const api = withPickers(fresh);
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'B.woff')).toBe('folder');
		expect(api.calls.directory[0].startIn).toBe(old);
		expect(fresh.files.get('B.woff').written).toBe(blob);
		expect(old.files.size).toBe(0);
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBe(fresh);
	});

	it('requests permission for a remembered folder that is in the prompt state', async () => {
		const dir = fakeDirectoryHandle('Prompted', { query: 'prompt', request: 'granted' });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(new Error('picker must not open')));
		expect(await exportFontToFolder(blob, 'C.otf')).toBe('folder');
		expect(dir.calls.request).toBe(1);
	});

	it('cancelling the folder picker cancels the export: no download (finding 7)', async () => {
		const api = withPickers(abortError());
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'D.otf')).toBe('cancelled');
		expect(api.calls.download).toEqual([]);
		expect(toastText()).toBe('Export cancelled');
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBeNull();
	});

	it('an expired click (SecurityError from the picker) asks for one more click, no download', async () => {
		const api = withPickers(securityError());
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'E.otf')).toBe('prompt');
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Click Export again to choose an export folder.');
	});

	it("a remembered folder still in 'prompt' asks for one more click: no picker, no download (finding 5)", async () => {
		const dir = fakeDirectoryHandle('Fonts', { query: 'prompt', request: 'prompt' });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(undefined);
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'P.otf')).toBe('prompt');
		expect(api.calls.directory).toHaveLength(0);
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Click Export again to write to Fonts.');
		expect(dir.files.size).toBe(0);
	});

	it('downloads and says why when the folder cannot be written', async () => {
		const dir = fakeDirectoryHandle('ReadOnly', { getFileError: new Error('read only') });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(undefined);
		setFileApi(api);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await exportFontToFolder(blob, 'F.otf')).toBe('download');
		warn.mockRestore();
		expect(api.calls.download).toHaveLength(1);
		expect(toastText()).toContain('Could not write F.otf to ReadOnly');
		expect(toastText()).toContain('read only');
		expect(toastText()).toContain('Downloading it instead');
	});

	it('downloads when open/save pickers exist but the directory picker does not', async () => {
		const api = fakeApi({ open: [], save: undefined });
		setFileApi(api);
		expect(await exportFontToFolder(blob, 'G.otf')).toBe('download');
		expect(api.calls.download).toHaveLength(1);
	});
});

// B1 fix pass: the export's own words about where the file went ("Exported X (2).otf to Fonts")
// were only in a toast, so the font check's export toast read them back out of the page. The
// writer now records them, with the final file name and folder.
describe('export_folder: what the newest export said', () => {
	it('records the folder write: final name, folder and words', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		await exportFontToFolder(blob, 'MyFont-Regular.otf');
		expect(getLastExportMessage()).toEqual({
			result: 'folder',
			fileName: 'MyFont-Regular.otf',
			folder: 'Fonts',
			message: 'Exported MyFont-Regular.otf to Fonts',
		});
	});

	it('records the "Keep both" name, not the asked-for one', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		dir.addFile('Roboto-Regular.otf', { initial: 'ORIGINAL' });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		const run = exportFontToFolder(blob, 'Roboto-Regular.otf');
		await answerExistingFileDialog('keepBoth');
		await run;
		expect(getLastExportMessage()).toMatchObject({
			result: 'folder',
			fileName: 'Roboto-Regular (2).otf',
			message: 'Exported Roboto-Regular (2).otf to Fonts',
		});
	});

	it('records a download, and a download after a failed write, with their reasons', async () => {
		setFileApi(fakeApi({}));
		await exportFontToFolder(blob, 'MyFont.otf');
		expect(getLastExportMessage()).toEqual({
			result: 'download',
			fileName: 'MyFont.otf',
			folder: null,
			message: 'Downloading MyFont.otf',
		});

		const dir = fakeDirectoryHandle('ReadOnly', { getFileError: new Error('read only') });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await exportFontToFolder(blob, 'F.otf');
		warn.mockRestore();
		expect(getLastExportMessage()).toMatchObject({ result: 'download', fileName: 'F.otf' });
		expect(getLastExportMessage().message).toContain('Could not write F.otf to ReadOnly');
	});
});

describe('export_folder: same-named files (finding 1)', () => {
	async function exportTo(dir, fileName = 'Roboto-Regular.otf') {
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(undefined);
		setFileApi(api);
		return { api, run: exportFontToFolder(blob, fileName) };
	}

	it('asks before replacing a file ANY-INK did not write; Replace overwrites it', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const original = dir.addFile('Roboto-Regular.otf', { initial: 'ORIGINAL' });
		const { api, run } = await exportTo(dir);
		const text = await answerExistingFileDialog('replace');
		expect(text).toContain('Roboto-Regular.otf already exists in Fonts.');
		expect(text).toContain('Roboto-Regular (2).otf');
		expect(await run).toBe('folder');
		expect(original.written).toBe(blob);
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Exported Roboto-Regular.otf to Fonts');
	});

	it('Keep both writes the next free "(n)" name and leaves the original alone', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const original = dir.addFile('Roboto-Regular.otf', { initial: 'ORIGINAL' });
		dir.addFile('Roboto-Regular (2).otf', { initial: 'OLDER COPY' });
		const { run } = await exportTo(dir);
		const text = await answerExistingFileDialog('keepBoth');
		expect(text).toContain('Roboto-Regular (3).otf');
		expect(await run).toBe('folder');
		expect(original.written).toBe('ORIGINAL');
		expect(dir.files.get('Roboto-Regular (2).otf').written).toBe('OLDER COPY');
		expect(dir.files.get('Roboto-Regular (3).otf').written).toBe(blob);
		expect(toastText()).toBe('Exported Roboto-Regular (3).otf to Fonts');
	});

	it('Cancel writes nothing, downloads nothing and says so', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const original = dir.addFile('Roboto-Regular.otf', { initial: 'ORIGINAL' });
		const { api, run } = await exportTo(dir);
		await answerExistingFileDialog('cancel');
		expect(await run).toBe('cancelled');
		expect(original.written).toBe('ORIGINAL');
		expect([...dir.files.keys()]).toEqual(['Roboto-Regular.otf']);
		expect(api.calls.download).toHaveLength(0);
		expect(toastText()).toBe('Export cancelled');
	});

	it('closing the dialog with its X counts as Cancel', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		dir.addFile('Roboto-Regular.otf', { initial: 'ORIGINAL' });
		const { run } = await exportTo(dir);
		for (let i = 0; i < 50 && !document.querySelector('#modal-dialog'); i++) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		document.querySelector('#modal-dialog .modal-dialog__close-button').click();
		expect(await run).toBe('cancelled');
		expect(dir.files.get('Roboto-Regular.otf').written).toBe('ORIGINAL');
	});

	it('re-exporting a file ANY-INK wrote earlier overwrites it without asking', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const { run } = await exportTo(dir, 'Mine-Regular.otf');
		expect(await run).toBe('folder');
		const again = new Blob(['OTTO v2'], { type: 'font/opentype' });
		expect(await exportFontToFolder(again, 'Mine-Regular.otf')).toBe('folder');
		expect(dir.files.get('Mine-Regular.otf').written).toBe(again);
		expect(document.querySelector('#modal-dialog')).toBeNull();
	});

	it('a file ANY-INK wrote in another folder does not count for a same-named file here', async () => {
		const first = fakeDirectoryHandle('First');
		const { run } = await exportTo(first, 'Mine-Regular.otf');
		expect(await run).toBe('folder');
		const second = fakeDirectoryHandle('Second');
		second.addFile('Mine-Regular.otf', { initial: 'SOMEONE ELSE' });
		await rememberHandle(EXPORT_FOLDER_KEY, second);
		const again = exportFontToFolder(blob, 'Mine-Regular.otf');
		await answerExistingFileDialog('cancel');
		expect(await again).toBe('cancelled');
		expect(second.files.get('Mine-Regular.otf').written).toBe('SOMEONE ELSE');
	});

	it('importing a font file makes ANY-INK ask again before overwriting it', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const { run } = await exportTo(dir, 'Mine-Regular.otf');
		expect(await run).toBe('folder');
		await noteImportedFontFile(dir.files.get('Mine-Regular.otf'));
		const again = exportFontToFolder(blob, 'Mine-Regular.otf');
		await answerExistingFileDialog('cancel');
		expect(await again).toBe('cancelled');
	});

	it(`remembers at most ${MAX_EXPORTED_FILES} written files, newest first`, async () => {
		const dir = fakeDirectoryHandle('Many');
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		for (let i = 0; i <= MAX_EXPORTED_FILES; i++) {
			expect(await exportFontToFolder(blob, `F${i}.otf`)).toBe('folder');
		}
		// F0 fell off the list: exporting it again asks, the newest does not.
		expect(await exportFontToFolder(blob, `F${MAX_EXPORTED_FILES}.otf`)).toBe('folder');
		const oldest = exportFontToFolder(blob, 'F0.otf');
		await answerExistingFileDialog('cancel');
		expect(await oldest).toBe('cancelled');
	});
});

// Verification of finding 1: isSameEntry compares paths, so "ANY-INK wrote this path" is
// not "ANY-INK wrote this file". Only the exact file ANY-INK left there is replaced silently.
describe("export_folder: only the file ANY-INK left there is replaced without asking", () => {
	async function exportOnce(dir, fileName, options) {
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		expect(await exportFontToFolder(blob, fileName, options)).toBe('folder');
	}

	it('a different file put back at the same path (restored from a backup) asks first', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await exportOnce(dir, 'Mine-Regular.otf');
		await dir.removeEntry('Mine-Regular.otf');
		dir.addFile('Mine-Regular.otf', { initial: 'RESTORED ORIGINAL' });
		const again = exportFontToFolder(blob, 'Mine-Regular.otf');
		const text = await answerExistingFileDialog('cancel');
		expect(text).toContain('Mine-Regular.otf already exists in Fonts.');
		expect(await again).toBe('cancelled');
		expect(dir.files.get('Mine-Regular.otf').written).toBe('RESTORED ORIGINAL');
	});

	it('an export another program changed after ANY-INK wrote it asks first', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await exportOnce(dir, 'Mine-Regular.otf');
		dir.files.get('Mine-Regular.otf').externalWrite('HAND-EDITED IN A FONT TOOL');
		const again = exportFontToFolder(blob, 'Mine-Regular.otf');
		await answerExistingFileDialog('cancel');
		expect(await again).toBe('cancelled');
		expect(dir.files.get('Mine-Regular.otf').written).toBe('HAND-EDITED IN A FONT TOOL');
	});

	it("another project's export with the same file name asks first; the same project does not", async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await exportOnce(dir, 'MyFont-Regular.otf', { projectId: 'g2_FIRST' });
		expect(await exportFontToFolder(blob, 'MyFont-Regular.otf', { projectId: 'g2_FIRST' })).toBe(
			'folder'
		);
		expect(document.querySelector('#modal-dialog')).toBeNull();
		const second = new Blob(['OTTO from the second project'], { type: 'font/opentype' });
		const fromSecond = exportFontToFolder(second, 'MyFont-Regular.otf', { projectId: 'g2_SECOND' });
		await answerExistingFileDialog('cancel');
		expect(await fromSecond).toBe('cancelled');
		expect(dir.files.get('MyFont-Regular.otf').written).toBe(blob);
	});

	it('a file whose details cannot be read asks first', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		await exportOnce(dir, 'Mine-Regular.otf');
		const file = dir.files.get('Mine-Regular.otf');
		file.getFile = async () => {
			throw namedError('NotReadableError', 'the file is locked');
		};
		const again = exportFontToFolder(blob, 'Mine-Regular.otf');
		await answerExistingFileDialog('replace');
		expect(await again).toBe('folder');
	});
});

describe('export_folder: a failed write leaves no empty file (finding 4)', () => {
	it('removes the entry it just created when the write fails, then downloads', async () => {
		const full = namedError('QuotaExceededError', 'The disk is full.');
		const dir = fakeDirectoryHandle('Fonts', { fileOptions: { writeError: full } });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(undefined);
		setFileApi(api);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await exportFontToFolder(blob, 'MyFont-Regular.otf')).toBe('download');
		warn.mockRestore();
		expect(dir.files.has('MyFont-Regular.otf')).toBe(false);
		expect(dir.calls.removeEntry).toBe(1);
		expect(api.calls.download).toEqual([{ blob, fileName: 'MyFont-Regular.otf' }]);
		expect(toastText()).toContain('the disk is full');
	});

	it('keeps a file that was already there (Replace) when the write fails', async () => {
		const dir = fakeDirectoryHandle('Fonts');
		const full = namedError('QuotaExceededError', 'The disk is full.');
		dir.addFile('MyFont-Regular.otf', { initial: 'ORIGINAL', writeError: full });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const run = exportFontToFolder(blob, 'MyFont-Regular.otf');
		await answerExistingFileDialog('replace');
		expect(await run).toBe('download');
		warn.mockRestore();
		expect(dir.files.get('MyFont-Regular.otf').written).toBe('ORIGINAL');
		expect(dir.calls.removeEntry).toBe(0);
	});

	it('still downloads when the clean-up itself fails', async () => {
		const dir = fakeDirectoryHandle('Fonts', {
			fileOptions: { writeError: new Error('boom') },
			removeError: new Error('locked'),
		});
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		const api = withPickers(undefined);
		setFileApi(api);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await exportFontToFolder(blob, 'X.otf')).toBe('download');
		warn.mockRestore();
		expect(api.calls.download).toHaveLength(1);
	});
});

describe('export_folder: destination first, build second (finding 5)', () => {
	let activation;
	afterEach(() => activation?.restore());

	it('prepareExportDestination asks for permission while the click is live', async () => {
		activation = fakeUserActivation();
		const dir = fakeDirectoryHandle('Fonts', { query: 'prompt', request: 'granted' });
		await rememberHandle(EXPORT_FOLDER_KEY, dir);
		setFileApi(withPickers(undefined));
		const destination = await prepareExportDestination();
		expect(destination).toEqual({ kind: 'folder', dir });
		expect(dir.calls.request).toBe(1);
		// The build takes longer than the click's activation window...
		activation.expire();
		// ...and the write still lands in the folder.
		expect(await writeExport(destination, blob, 'Slow-Regular.otf')).toBe('folder');
		expect(dir.files.get('Slow-Regular.otf').written).toBe(blob);
	});

	it('opens the folder picker up front when no folder is remembered', async () => {
		activation = fakeUserActivation();
		const dir = fakeDirectoryHandle('Picked');
		const api = withPickers(() => (activation.active ? dir : securityError()));
		setFileApi(api);
		const destination = await prepareExportDestination();
		expect(destination).toEqual({ kind: 'folder', dir });
		activation.expire();
		expect(await writeExport(destination, blob, 'A.otf')).toBe('folder');
		expect(api.calls.download).toHaveLength(0);
	});

	it("resolves { kind: 'cancelled' } (and toasts) when the picker is cancelled", async () => {
		setFileApi(withPickers(abortError()));
		expect(await prepareExportDestination()).toEqual({ kind: 'cancelled' });
		expect(toastText()).toBe('Export cancelled');
	});

	it("resolves { kind: 'download' } without the API", async () => {
		setFileApi(fakeApi({}));
		expect(await prepareExportDestination()).toEqual({ kind: 'download' });
	});

	it("writeExport stops with 'prompt' if permission lapsed back to prompt before the write", async () => {
		const dir = fakeDirectoryHandle('Fonts', { query: 'prompt', request: 'prompt' });
		const api = withPickers(undefined);
		setFileApi(api);
		expect(await writeExport({ kind: 'folder', dir }, blob, 'Late.otf')).toBe('prompt');
		expect(toastText()).toBe('Click Export again to write to Fonts.');
		expect(api.calls.download).toHaveLength(0);
		expect(dir.files.size).toBe(0);
	});

	it('writeExport downloads and says why when the folder was denied during the build', async () => {
		const dir = fakeDirectoryHandle('Fonts', { query: 'denied' });
		const api = withPickers(undefined);
		setFileApi(api);
		expect(await writeExport({ kind: 'folder', dir }, blob, 'Denied.otf')).toBe('download');
		expect(api.calls.download).toHaveLength(1);
		expect(toastText()).toContain('no longer allowed to write to Fonts');
	});
});

describe('export_folder: pickExportFolder and memory', () => {
	it('resolves false without a directory picker', async () => {
		setFileApi(fakeApi({ open: [], save: undefined }));
		expect(await pickExportFolder()).toBe(false);
	});

	it('remembers the picked folder and forgets it on request', async () => {
		const dir = fakeDirectoryHandle('Chosen');
		setFileApi(withPickers(dir));
		expect(await pickExportFolder()).toBe(dir);
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBe(dir);
		expect(exportFolderName()).toBe('Chosen');
		await forgetExportFolder();
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBeNull();
		expect(exportFolderName()).toBe('');
	});

	it('retries with Documents when the remembered startIn is rejected', async () => {
		const old = fakeDirectoryHandle('Old');
		await rememberHandle(EXPORT_FOLDER_KEY, old);
		const fresh = fakeDirectoryHandle('Fresh');
		const api = withPickers((options) =>
			typeof options.startIn === 'object' ? new TypeError('bad startIn') : fresh
		);
		setFileApi(api);
		expect(await pickExportFolder()).toBe(fresh);
		expect(api.calls.directory.map((o) => o.startIn)).toEqual([old, 'documents']);
	});

	it('resolves false when cancelled and leaves the old folder remembered', async () => {
		const old = fakeDirectoryHandle('Old');
		await rememberHandle(EXPORT_FOLDER_KEY, old);
		setFileApi(withPickers(abortError()));
		expect(await pickExportFolder()).toBe(false);
		expect(await recallHandle(EXPORT_FOLDER_KEY)).toBe(old);
	});

	it('chooseExportFolder tells cancelled, needs-a-click and unavailable apart', async () => {
		setFileApi(withPickers(abortError()));
		expect(await chooseExportFolder()).toEqual({ status: 'cancelled' });
		setFileApi(withPickers(securityError()));
		expect(await chooseExportFolder()).toEqual({ status: 'needsClick' });
		setFileApi(fakeApi({ open: [], save: undefined }));
		expect(await chooseExportFolder()).toEqual({ status: 'unavailable' });
		const dir = fakeDirectoryHandle('Chosen');
		setFileApi(withPickers(dir));
		expect(await chooseExportFolder()).toEqual({ status: 'picked', dir });
	});

	it('preloadExportFolder fills the name cache used by the menu', async () => {
		expect(exportFolderName()).toBe('');
		await rememberHandle(EXPORT_FOLDER_KEY, fakeDirectoryHandle('Later'));
		expect(exportFolderName()).toBe('');
		await preloadExportFolder();
		expect(exportFolderName()).toBe('Later');
	});
});
