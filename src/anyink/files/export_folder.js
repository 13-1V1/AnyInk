// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK export folder (Milestone 6, D-012, D-027).
	Owner: FILES track (shared with the OTF export hand-off in font_export.js).

	Font exports land in one remembered folder instead of the browser's download
	list. The folder handle lives in IndexedDB under 'exportFolder' (handles.js).

	Two steps, because Chromium's transient user activation (needed for a
	permission prompt or a picker) runs out about 5 s after the click, and a real
	font can take longer than that to build (DESIGN_DOC 8):
	  1. prepareExportDestination()   FIRST thing in the click / keydown, before the
	                                  build. Remembered folder -> ensurePermission
	                                  (may prompt). No folder, or the folder was
	                                  refused -> the folder picker. Resolves
	                                    { kind: 'folder', dir }  write there
	                                    { kind: 'download' }     no File System Access /
	                                                             no directory picker
	                                    { kind: 'cancelled' }    picker cancelled ('Export
	                                                             cancelled' toast)
	                                    { kind: 'prompt' }       one more click needed
	                                                             ('Click Export again...' toast)
	  2. writeExport(destination, blob, fileName, { projectId })   after the build.
	                                  Resolves 'folder' | 'download' | 'cancelled' | 'prompt'.
	                                  getLastExportMessage() then says where the file went
	                                  (B1): { result, fileName, folder, message }.
	     - permission lapsed back to 'prompt': toast 'Click Export again to write to
	       <folder>.', no download.
	     - the exact file ANY-INK left there is replaced silently: the normal edit /
	       re-export loop. kv 'exportedFiles' (newest first, cap MAX_EXPORTED_FILES)
	       holds { handle, size, lastModified, projectId } for every export ANY-INK
	       wrote. isSameEntry only compares paths, so a path match alone proves
	       nothing: the file there now must still have the size and lastModified
	       ANY-INK saw right after its write, and come from the same project.
	     - any other same-named file (a downloaded font, the font the project was
	       imported from, a file put back from a backup, an export another program
	       changed, another project's export with the same family-style name) opens
	       askAboutExistingFile: Replace | Keep both ('<name> (2).otf', next free
	       number) | Cancel.
	     - a write that fails removes the entry it just created (no 0-byte font left
	       behind) and falls back to the browser download, with the reason in the toast.
	  exportFontToFolder(blob, fileName, { projectId })  both steps at once (test page,
	                                   callers that have nothing slow between the click
	                                   and the write).

	  chooseExportFolder()             showDirectoryPicker({ id: 'anyink-export', mode:
	                                   'readwrite', startIn: remembered folder or
	                                   Documents }), remembers the choice. Resolves
	                                   { status: 'picked', dir } | { status: 'cancelled' }
	                                   | { status: 'needsClick' } (SecurityError: the
	                                   click's activation expired) | { status: 'unavailable' }.
	  pickExportFolder()               chooseExportFolder() -> the directory handle or false.
	  noteImportedFontFile(handle)     a font file was imported: it is a source again, so
	                                   the next export over it asks first.
	  forgetExportFolder()             next export asks for a folder again.
	  forgetExportedFiles()            every same-named file asks again (test page).
	  preloadExportFolder()            warms exportFolderName() for menu labels.
	  exportFolderName()               '' or the remembered folder's name (sync, from cache).
*/

import { showToast } from '../../controls/dialogs/dialogs.js';
import { saveFile } from '../../project_editor/file_io.js';
import { askAboutExistingFile } from './existing_file_dialog.js';
import { getFileApi, hasDirectoryPicker, hasFileSystemAccess, isAbortError } from './file_api.js';
import {
	ensurePermission,
	findInHandleList,
	forgetHandle,
	forgetHandleList,
	pushHandleToList,
	recallHandle,
	rememberHandle,
	removeHandleFromList,
} from './handles.js';
import { isDirectoryHandle, isFileHandle, writeToHandle } from './write_file.js';

/** kv key (via handles.js) of the remembered export directory */
export const EXPORT_FOLDER_KEY = 'exportFolder';
/** picker id: Chromium remembers one last directory per id */
export const EXPORT_PICKER_ID = 'anyink-export';
/** kv key (via handles.js) of the files ANY-INK itself exported, newest first */
export const EXPORTED_FILES_KEY = 'exportedFiles';
/** how many exported files are remembered as "ours" */
export const MAX_EXPORTED_FILES = 50;
/** 'Keep both' tries '<name> (2)' up to this number */
const MAX_COPY_NUMBER = 999;

let folderCache; // undefined = not loaded, null = none remembered

/**
 * Loads the remembered folder into the cache used by exportFolderName().
 * @returns {Promise<FileSystemDirectoryHandle | null>}
 */
export async function preloadExportFolder() {
	try {
		const dir = await recallHandle(EXPORT_FOLDER_KEY);
		folderCache = isDirectoryHandle(dir) ? dir : null;
	} catch {
		folderCache = null;
	}
	return folderCache;
}

/**
 * @returns {String} the remembered folder's name, or '' (sync; call preloadExportFolder first)
 */
export function exportFolderName() {
	return folderCache?.name || '';
}

// --------------------------------------------------------------
// Choosing the folder
// --------------------------------------------------------------

/**
 * Lets the user choose the export folder and remembers it. Call inside a click.
 * @returns {Promise<{status: 'picked', dir: FileSystemDirectoryHandle} |
 *   {status: 'cancelled' | 'needsClick' | 'unavailable'}>}
 */
export async function chooseExportFolder() {
	if (!hasDirectoryPicker()) return { status: 'unavailable' };
	const remembered = await preloadExportFolder();
	const options = { id: EXPORT_PICKER_ID, mode: 'readwrite' };
	let dir;
	try {
		dir = await getFileApi().showDirectoryPicker({ ...options, startIn: remembered || 'documents' });
	} catch (error) {
		// Chromium rejects a remembered startIn it can no longer resolve with a TypeError.
		if (!remembered || !(error instanceof TypeError || error?.name === 'TypeError')) {
			return pickerFailure(error);
		}
		try {
			dir = await getFileApi().showDirectoryPicker({ ...options, startIn: 'documents' });
		} catch (retryError) {
			return pickerFailure(retryError);
		}
	}
	if (!isDirectoryHandle(dir)) return { status: 'cancelled' };
	await rememberHandle(EXPORT_FOLDER_KEY, dir);
	folderCache = dir;
	return { status: 'picked', dir };
}

/** AbortError = the user closed the picker; SecurityError = the click is too old. */
function pickerFailure(error) {
	if (isAbortError(error)) return { status: 'cancelled' };
	if (error?.name === 'SecurityError') return { status: 'needsClick' };
	throw error;
}

/**
 * Lets the user choose the export folder and remembers it. Call inside a click.
 * @returns {Promise<FileSystemDirectoryHandle | false>} false when cancelled, no
 *   picker exists, or the click's activation already expired
 */
export async function pickExportFolder() {
	const result = await chooseExportFolder();
	return result.status === 'picked' ? result.dir : false;
}

// --------------------------------------------------------------
// Export: destination first, then the write
// --------------------------------------------------------------

/**
 * Settles where an export goes. Call first thing in the click or keydown that
 * starts the export, before the font is built, so the permission prompt and the
 * folder picker still have the gesture's transient activation.
 * @returns {Promise<{kind: 'folder', dir: FileSystemDirectoryHandle} |
 *   {kind: 'download' | 'cancelled' | 'prompt'}>} only 'folder' and 'download'
 *   mean "build the font"; the other two already showed a toast.
 */
export async function prepareExportDestination() {
	if (!hasFileSystemAccess() || !hasDirectoryPicker()) return { kind: 'download' };
	const remembered = await preloadExportFolder();
	if (remembered) {
		const permission = await ensurePermission(remembered, 'readwrite');
		if (permission === 'granted') return { kind: 'folder', dir: remembered };
		if (permission === 'prompt') {
			showToast(clickAgainToWrite(remembered));
			return { kind: 'prompt' };
		}
		// 'denied': this folder was refused. Choose another (the picker starts there).
		showToast(`ANY-INK was not allowed to write to ${remembered.name}. Choose an export folder.`);
	}
	const choice = await chooseExportFolder();
	if (choice.status === 'picked') return { kind: 'folder', dir: choice.dir };
	if (choice.status === 'cancelled') {
		showToast('Export cancelled');
		return { kind: 'cancelled' };
	}
	if (choice.status === 'needsClick') {
		showToast('Click Export again to choose an export folder.');
		return { kind: 'prompt' };
	}
	return { kind: 'download' };
}

/**
 * Writes a built font to the destination prepareExportDestination settled.
 * @param {Object} destination - from prepareExportDestination
 * @param {Blob} blob - the built font
 * @param {String} fileName - e.g. 'MyFont-Regular.otf'
 * @param {Object} [options]
 * @param {String} [options.projectId] - the exporting project's settings.project.id: a
 *   same-named export from another project is not replaced without asking
 * @returns {Promise<'folder' | 'download' | 'cancelled' | 'prompt'>}
 */
export async function writeExport(destination, blob, fileName, { projectId = null } = {}) {
	const kind = destination?.kind;
	if (kind === 'cancelled' || kind === 'prompt') return kind;
	if (kind === 'folder' && isDirectoryHandle(destination.dir)) {
		return writeIntoFolder(destination.dir, blob, fileName, projectId ?? null);
	}
	download(blob, fileName, `Downloading ${fileName}`);
	return 'download';
}

/**
 * ANY-INK (B1): where the newest export's file went, in the words its toast showed. A new
 * object each time, so a caller can tell this export's record from an older one.
 * @type {{result: 'folder' | 'download', fileName: String, folder: String | null,
 *   message: String} | null}
 */
let lastExportMessage = null;

/**
 * @returns {{result: 'folder' | 'download', fileName: String, folder: String | null,
 *   message: String} | null} fileName: the name the file really got ("Keep both" adds
 *   " (2)"); folder: the folder it is in, null for a download; message: the toast's words
 *   (HTML, as shown)
 */
export function getLastExportMessage() {
	return lastExportMessage;
}

/** Shows where the file went and records it (getLastExportMessage). */
function sayWhere(result, fileName, folder, message) {
	lastExportMessage = { result, fileName, folder, message };
	showToast(message);
}

/**
 * Both steps at once: settle the destination, then write.
 * @param {Blob} blob - the built font
 * @param {String} fileName - e.g. 'MyFont.otf'
 * @param {Object} [options] - { projectId }, as for writeExport
 * @returns {Promise<'folder' | 'download' | 'cancelled' | 'prompt'>}
 */
export async function exportFontToFolder(blob, fileName, options = {}) {
	return writeExport(await prepareExportDestination(), blob, fileName, options);
}

async function writeIntoFolder(dir, blob, fileName, projectId) {
	// The build may have taken a while; make sure the folder is still ours to write.
	const permission = await ensurePermission(dir, 'readwrite');
	if (permission === 'prompt') {
		showToast(clickAgainToWrite(dir));
		return 'prompt';
	}
	if (permission !== 'granted') {
		download(
			blob,
			fileName,
			`ANY-INK is no longer allowed to write to ${dir.name}.<br>Downloading ${fileName} instead.`
		);
		return 'download';
	}

	let target = fileName;
	let createsEntry = true;
	try {
		const existing = await findFile(dir, fileName);
		if (existing) {
			createsEntry = false;
			if (!(await isOwnExport(existing, projectId))) {
				const keepBothName = await nextFreeName(dir, fileName);
				const choice = await askAboutExistingFile({
					fileName,
					folderName: dir.name,
					keepBothName,
				});
				if (choice === 'cancel') {
					showToast('Export cancelled');
					return 'cancelled';
				}
				if (choice === 'keepBoth') {
					target = keepBothName;
					createsEntry = true;
				}
			}
		}
	} catch (error) {
		return writeFailed(dir, blob, fileName, error);
	}

	let file;
	try {
		file = await dir.getFileHandle(target, { create: true });
		await writeToHandle(file, blob);
	} catch (error) {
		// A new entry exists from the moment getFileHandle created it; an existing file is
		// safe (the writable swaps in only on close), so only a new one is removed.
		if (createsEntry) await removeQuietly(dir, target);
		return writeFailed(dir, blob, fileName, error, target);
	}
	await rememberExport(file, projectId);
	sayWhere('folder', target, dir.name, `Exported ${target} to ${dir.name}`);
	return 'folder';
}

function writeFailed(dir, blob, fileName, error, target = fileName) {
	console.warn('ANY-INK export to folder failed', error);
	download(
		blob,
		fileName,
		`Could not write ${target} to ${dir.name}: ${describeWriteError(error)}.<br>Downloading it instead.`
	);
	return 'download';
}

/**
 * @param {*} error - what getFileHandle / createWritable / write threw
 * @returns {String} what happened, in plain words
 */
function describeWriteError(error) {
	switch (error?.name) {
		case 'QuotaExceededError':
			return 'the disk is full';
		case 'NotAllowedError':
		case 'SecurityError':
			return 'ANY-INK is not allowed to write there';
		case 'NoModificationAllowedError':
			return 'another program is using the file';
		case 'NotFoundError':
			return 'the folder is no longer there';
		case 'TypeMismatchError':
			return 'a folder with that name is in the way';
		default:
			return error?.message || String(error);
	}
}

/**
 * @returns {Promise<FileSystemFileHandle | null>} the file, or null when there is none
 */
async function findFile(dir, fileName) {
	try {
		return await dir.getFileHandle(fileName);
	} catch (error) {
		if (error?.name === 'NotFoundError') return null;
		throw error;
	}
}

/**
 * @returns {Promise<String>} '<base> (n)<ext>' with the lowest free n from 2
 */
async function nextFreeName(dir, fileName) {
	const dot = fileName.lastIndexOf('.');
	const base = dot > 0 ? fileName.slice(0, dot) : fileName;
	const ext = dot > 0 ? fileName.slice(dot) : '';
	for (let n = 2; n <= MAX_COPY_NUMBER; n++) {
		const candidate = `${base} (${n})${ext}`;
		if (!(await findFile(dir, candidate))) return candidate;
	}
	throw new Error(`every name from "${base} (2)${ext}" to "${base} (${MAX_COPY_NUMBER})${ext}" is taken`);
}

async function removeQuietly(dir, fileName) {
	try {
		if (typeof dir.removeEntry === 'function') await dir.removeEntry(fileName);
	} catch (error) {
		console.warn(`ANY-INK could not remove the unfinished ${fileName}`, error);
	}
}

function clickAgainToWrite(dir) {
	return `Click Export again to write to ${dir.name}.`;
}

// --------------------------------------------------------------
// Files ANY-INK wrote
// --------------------------------------------------------------

/**
 * @param {FileSystemFileHandle} file - the same-named file in the export folder
 * @param {String | null} projectId - the exporting project
 * @returns {Promise<Boolean>} true only when it is byte-for-byte the export ANY-INK
 *   left there for this project: same path, same size, same lastModified. Anything
 *   unreadable counts as "not ours", so the user is asked.
 */
async function isOwnExport(file, projectId) {
	try {
		const record = await findInHandleList(EXPORTED_FILES_KEY, file);
		if (!record || !Number.isFinite(record.size) || !Number.isFinite(record.lastModified)) {
			return false;
		}
		if ((record.projectId ?? null) !== projectId) return false;
		const current = await file.getFile();
		return current.size === record.size && current.lastModified === record.lastModified;
	} catch {
		return false;
	}
}

/**
 * Remembers the file ANY-INK just wrote, with what it looks like on disk right now.
 * A file whose details cannot be read is forgotten instead, so the next export asks.
 */
async function rememberExport(file, projectId) {
	try {
		const written = await file.getFile();
		await pushHandleToList(EXPORTED_FILES_KEY, file, MAX_EXPORTED_FILES, {
			size: written.size,
			lastModified: written.lastModified,
			projectId,
		});
	} catch (error) {
		console.warn('ANY-INK could not remember the exported file', error);
		await removeHandleFromList(EXPORTED_FILES_KEY, file);
	}
}

/**
 * A font file was imported: from now on it is a source, not an ANY-INK export, so
 * an export with the same name asks before replacing it.
 * @param {FileSystemFileHandle} handle - ignored unless it is a file handle
 * @returns {Promise<void>}
 */
export async function noteImportedFontFile(handle) {
	if (!isFileHandle(handle)) return;
	await removeHandleFromList(EXPORTED_FILES_KEY, handle);
}

/**
 * Forgets which files ANY-INK exported: every same-named file asks again.
 * @returns {Promise<void>}
 */
export async function forgetExportedFiles() {
	await forgetHandleList(EXPORTED_FILES_KEY);
}

/**
 * Forgets the remembered export folder.
 * @returns {Promise<void>}
 */
export async function forgetExportFolder() {
	folderCache = null;
	await forgetHandle(EXPORT_FOLDER_KEY);
}

function download(blob, fileName, message) {
	const fallback = getFileApi().download || saveFile;
	fallback(blob, fileName);
	sayWhere('download', fileName, null, message);
}
