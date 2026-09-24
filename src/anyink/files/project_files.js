// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK project files (Milestone 6, D-012).
	Owner: FILES track (open / save / recents).

	Every picker gets an id and a startIn (the last project file, else Documents)
	and runs inside the click that asked for it: the only await before a picker
	is one fast IndexedDB read (recallHandle), well inside the transient-activation
	window. The project JSON always comes from editor.makeProjectFileText() so the
	.gs2 format never forks between save paths.

	Only a .gs2 file is ever written in place (isProjectFileHandle, write_file.js): a
	Glyphr Studio v1 .txt, or any other file, is read and never becomes the save
	target, so its first Save goes through Save As with '<name>.gs2' suggested.

	Contract (project_editor.saveProjectFile is a thin call into these):
	  hasFileSystemAccess()          true when open + save pickers exist (file_api.js)
	  openProjectFromPicker()        showOpenFilePicker (id 'anyink-projects', .gs2) ->
	                                 openProjectFromHandle. Resolves the handle, or
	                                 false when cancelled / not a project.
	  openProjectFromHandle(handle, { mode, load })
	                                 ensurePermission (default 'read'; recents use
	                                 'readwrite'), readProjectFile, load into the
	                                 import-target editor, importProjectDataAndNavigate,
	                                 remember + recents + publish 'projectFile'. The
	                                 loader gets the handle only for a .gs2 (else false).
	                                 Resolves 'opened' | 'denied' | 'prompt' | 'missing'
	                                 | 'invalid'. Shows the error dialog for 'invalid'
	                                 (the message lives here); callers toast the rest.
	  saveProject(editor)            in place through editor.loadedFileHandle (a .gs2)
	                                 with an exclusive writable. No handle, not a .gs2,
	                                 or permission 'denied' (toast 'ANY-INK was not
	                                 allowed to write <file>. Choose a new file.') ->
	                                 the Save As picker. Permission still 'prompt'
	                                 (prompt dismissed) -> toast 'Click Save again to
	                                 write <file>.' and false. No API -> download.
	  saveProjectAs(editor)          showSaveFilePicker (suggestedName '<name>.gs2'),
	                                 write, adopt the handle, same tail as saveProject.
	  saveProjectText(editor, text, saveAsCopy)  the same flows with prebuilt text
	                                 (used by upstream's saveTextFile('gs2', ...)).
	  downloadProject(editor)        browser download, for browsers without the API.
	  All save functions resolve true when written, false when cancelled or when the
	  write failed (the reason was shown). They reject only for programming errors;
	  callers still wrap them in runFileCommand (run_command.js).
	  A picker whose click is too old (SecurityError) resolves false with a toast
	  asking for one more click. Write errors are told apart by error.name:
	    NotFoundError               '<file> is no longer where it was.' -> Save As
	    NotAllowedError             'ANY-INK was not allowed to write <file>.' -> Save As
	    NoModificationAllowedError  'close the other window' error box
	    anything else               '<file> could not be saved' + the message
	  (Save As happens once: a freshly picked file that fails is only reported.)
	  Tail after a successful write: remember 'lastProject', pushRecentProject,
	  publish 'projectFile', toast 'Saved <file>'. editor.setProjectAsSaved() and
	  recovery's markClean() run only when no edit landed while the project was being
	  built and written (this editor's revision unchanged); otherwise the dot
	  and the crash-recovery snapshot stay, the toast says the change is not in the
	  file yet, and History records the undo state that WAS written
	  (history.markSavedStateAt), so undo back to it clears the dot.
	  noteProjectOpened(editor, handle)  the open tail on its own, for projects that
	                                 arrived by drag and drop or upstream's chooser.
	                                 A non-.gs2 handle is only remembered as the
	                                 place Save As starts; it is not a recent project.
	  preloadFileHandles()           warms the lastProject cache at startup (optional).
	Tests inject pickers with setFileApi() from file_api.js and a fake `load`.
*/

import { queueProjectSave, rememberFileVersion, assertFileUnchanged } from './save_queue.js';
import { getSaveStatus, setSaveStatus } from './save_status.js';
import { getCurrentProjectEditor, getProjectEditorImportTarget } from '../../app/main.js';
import { importProjectDataAndNavigate } from '../../app/open_project.js';
import { showError, showToast } from '../../controls/dialogs/dialogs.js';
import { makeFileDateString, saveFile } from '../../project_editor/file_io.js';
import { markClean } from '../recovery/recovery.js';
import { getFileApi, hasFileSystemAccess, isAbortError } from './file_api.js';
import { ensurePermission, pushRecentProject, recallHandle, rememberHandle } from './handles.js';
import { readProjectFile } from './read_project.js';
import { isFileHandle, isProjectFileHandle, writeToHandle } from './write_file.js';

export { hasFileSystemAccess } from './file_api.js';

/** picker id: Chromium remembers one last directory per id */
export const PROJECT_PICKER_ID = 'anyink-projects';
/** handles.js key of the most recently opened or saved project file */
export const LAST_PROJECT_KEY = 'lastProject';
/** accepted project files: the pickers show only these unless 'All files' is chosen */
export const PROJECT_FILE_TYPES = [
	{ description: 'ANY-INK project', accept: { 'application/json': ['.gs2'] } },
];

// In-memory mirror of the remembered last-project handle, so pickers can start
// there without waiting for IndexedDB after the first read.
let lastProjectCache; // undefined = not loaded yet, null = nothing remembered

/**
 * Warms the cache of the last project handle. Safe to call any time.
 * @returns {Promise<FileSystemFileHandle | null>}
 */
export async function preloadFileHandles() {
	try {
		lastProjectCache = (await recallHandle(LAST_PROJECT_KEY)) || null;
	} catch {
		lastProjectCache = null;
	}
	return lastProjectCache;
}

async function rememberLastProject(handle) {
	lastProjectCache = handle || null;
	await rememberHandle(LAST_PROJECT_KEY, handle);
}

/**
 * Where a picker should open: the last project's folder, else Documents.
 * @returns {Promise<FileSystemHandle | String>}
 */
async function pickerStartIn() {
	if (lastProjectCache === undefined) await preloadFileHandles();
	return lastProjectCache || 'documents';
}

/**
 * Runs a picker with a startIn handle, retrying with Documents when the browser
 * rejects the remembered handle (TypeError). AbortError (user cancelled) -> false.
 * SecurityError (the click's transient activation ran out, e.g. the user read a
 * permission prompt for a while first) -> false and a toast asking for one more click.
 * @param {Function} picker - api.showOpenFilePicker or api.showSaveFilePicker
 * @param {Object} options - picker options without startIn
 * @param {String} clickAgain - toast for a SecurityError
 * @returns {Promise<*>} the picker's result, or false
 */
async function runPicker(picker, options, clickAgain) {
	const startIn = await pickerStartIn();
	try {
		return await picker({ ...options, startIn });
	} catch (error) {
		if (startIn !== 'documents' && (error instanceof TypeError || error?.name === 'TypeError')) {
			try {
				return await picker({ ...options, startIn: 'documents' });
			} catch (retryError) {
				return pickerFailure(retryError, clickAgain);
			}
		}
		return pickerFailure(error, clickAgain);
	}
}

function pickerFailure(error, clickAgain) {
	if (isAbortError(error)) return false;
	if (error?.name === 'SecurityError') {
		showToast(clickAgain);
		return false;
	}
	throw error;
}

// --------------------------------------------------------------
// Open
// --------------------------------------------------------------

/**
 * Picker only: lets the user choose a project file. Call from a click handler.
 * @returns {Promise<FileSystemFileHandle | false>} false when cancelled or no API
 */
export async function pickProjectFile() {
	if (!hasFileSystemAccess()) return false;
	const handles = await runPicker(
		getFileApi().showOpenFilePicker,
		{ id: PROJECT_PICKER_ID, multiple: false, types: PROJECT_FILE_TYPES },
		'Click Open again to choose a project file.'
	);
	const handle = Array.isArray(handles) ? handles[0] : handles;
	return isFileHandle(handle) ? handle : false;
}

/**
 * Default loader: the upstream import path, with the handle set before the
 * navigate so the File menu shows the file name right away.
 * @param {Object} content - parsed project data
 * @param {FileSystemFileHandle | false} handle - a .gs2 handle, or false
 * @returns {ProjectEditor} the editor that now holds the project
 */
function loadProjectIntoEditor(content, handle) {
	const editor = getProjectEditorImportTarget();
	editor.loadedFileHandle = isProjectFileHandle(handle) ? handle : false;
	importProjectDataAndNavigate(content);
	return getCurrentProjectEditor() || editor;
}

/**
 * Opens a project from a handle that came from a picker or from recents.
 * @param {FileSystemFileHandle} handle
 * @param {Object} [options]
 * @param {'read' | 'readwrite'} [options.mode] - permission to secure first.
 *   Picker handles already have read access; recents ask for readwrite behind
 *   the click so the next Save does not prompt again.
 * @param {Function} [options.load] - (content, handle) => editor; tests and test
 *   pages inject one that does not navigate. It gets the handle only for a .gs2
 *   (the one kind of file Save may write back to), otherwise false.
 * @returns {Promise<'opened' | 'denied' | 'prompt' | 'missing' | 'invalid'>}
 */
export async function openProjectFromHandle(handle, { mode = 'read', load } = {}) {
	if (!isFileHandle(handle)) return 'invalid';
	const permission = await ensurePermission(handle, mode);
	if (permission !== 'granted') return permission;
	const file = await readProjectFile(handle);
	if (file.status !== 'ok') {
		if (file.status === 'invalid' || file.status === 'unreadable') showError(file.message);
		return file.status === 'missing' ? 'missing' : 'invalid';
	}
	const saveTarget = isProjectFileHandle(handle) ? handle : false;
	const editor = (load || loadProjectIntoEditor)(file.content, saveTarget);
	await noteProjectOpened(editor, handle, file.sourceFile);
	return 'opened';
}

/**
 * Opens a .gs2 through the native file picker and loads it into the editor.
 * Call from a click handler (needs transient user activation).
 * @param {Object} [options] - passed to openProjectFromHandle
 * @returns {Promise<FileSystemFileHandle | false>} the handle, or false when cancelled
 */
export async function openProjectFromPicker(options = {}) {
	const handle = await pickProjectFile();
	if (!handle) return false;
	const status = await openProjectFromHandle(handle, options);
	if (status === 'opened') return handle;
	if (status === 'missing') showToast(`${handle.name} could not be found.`);
	if (status === 'denied' || status === 'prompt') {
		showToast(`ANY-INK was not allowed to read ${handle.name}.`);
	}
	return false;
}

/**
 * The open tail on its own, for every path that puts a project file in an editor:
 * the picker and recents (via openProjectFromHandle), drag and drop, and upstream's
 * file chooser (open_project.js). Remembers 'lastProject' (where the next picker
 * starts), pushes recents, publishes 'projectFile'. A file that is not a .gs2 (a v1
 * .txt) is only remembered as where Save As starts: it is not a recent project and
 * the editor has no file to save to. Anything that is not a file handle (no API, a
 * plain File) is ignored.
 * @param {ProjectEditor} editor - the editor that now holds the project
 * @param {FileSystemFileHandle} handle
 * @returns {Promise<Boolean>} true when the handle was recorded
 */
export async function noteProjectOpened(editor, handle, sourceFile) {
	if (!isFileHandle(handle)) return false;
	const history = editor.history;
	const revision = getSaveStatus(editor).revision;
	await rememberFileVersion(editor, handle, sourceFile);
	if (editor.history !== history) return false;
	if (getSaveStatus(editor).revision === revision) {
		setSaveStatus(editor, { file: isProjectFileHandle(handle) ? 'saved' : 'none', error: '' });
	}
	await rememberLastProject(handle);
	const isProjectFile = isProjectFileHandle(handle);
	if (isProjectFile) await pushRecentProject(handle, projectName(editor));
	publishProjectFile(
		editor,
		isProjectFile ? handle : false,
		'open',
		getSaveStatus(editor).file === 'saved'
	);
	return true;
}

// --------------------------------------------------------------
// Save
// --------------------------------------------------------------

/**
 * Saves the project to its open file handle, or falls back to Save As / download.
 * @param {ProjectEditor} editor
 * @returns {Promise<Boolean>} true when written, false when cancelled
 */
export async function saveProject(editor) {
	return saveFlow(editor, false, () => editor.makeProjectFileText());
}

/**
 * Save As: picks a new file, writes, adopts the handle.
 * @param {ProjectEditor} editor
 * @returns {Promise<Boolean>} true when written, false when cancelled
 */
export async function saveProjectAs(editor) {
	return saveFlow(editor, true, () => editor.makeProjectFileText());
}

/**
 * The same flows with text that was already built (upstream's saveTextFile path).
 * @param {ProjectEditor} editor
 * @param {String} text - the .gs2 content
 * @param {Boolean} [saveAsCopy] - true = pick a new file
 * @returns {Promise<Boolean>} true when written, false when cancelled
 */
export async function saveProjectText(editor, text, saveAsCopy = false) {
	return saveFlow(editor, saveAsCopy, () => text);
}

/**
 * Browser download of the .gs2 (no handle involved).
 * @param {ProjectEditor} editor
 * @returns {Promise<Boolean>} true
 */
export async function downloadProject(editor) {
	return downloadProjectText(editor, () => editor.makeProjectFileText());
}

/**
 * One save flow for all three entry points. The permission prompt and the picker
 * (when needed) run before the text is built so they stay inside the user's click.
 * @param {ProjectEditor} editor
 * @param {Boolean} asCopy - force the picker
 * @param {Function} getText - () => String | Promise<String>
 * @returns {Promise<Boolean>}
 */
async function saveFlow(editor, asCopy, getText) {
	const history = editor.history;
	if (!hasFileSystemAccess()) return downloadProjectText(editor, getText);
	let handle = editor.loadedFileHandle;
	// Only a .gs2 is written in place; a v1 .txt (or anything else) goes to Save As.
	let inPlace = !asCopy && isProjectFileHandle(handle);
	if (inPlace) {
		const permission = await ensurePermission(handle, 'readwrite');
		if (permission === 'prompt') {
			// The permission prompt was dismissed (or the click was too old to show it).
			showToast(`Click Save again to write ${handle.name}.`);
			return false;
		}
		if (permission !== 'granted') {
			showToast(notAllowedMessage(handle));
			inPlace = false;
		}
	}
	if (!inPlace) {
		handle = await pickSaveHandle(editor);
		if (!handle) return false;
	}
	return queueProjectSave(editor, async () => {
		if (editor.history !== history) return false;
		const written = captureSaveState(editor);
		setSaveStatus(editor, { file: 'saving', error: '' });
		try {
			const text = await getText();
			if (editor.history !== history) return false;
			return await writeProject(editor, handle, text, written, inPlace);
		} catch (error) {
			setSaveStatus(editor, { file: 'failed', error: error.message });
			throw error;
		}
	});
}

/** No prompts, downloads or fallback pickers are allowed on the background path. */
export async function saveProjectAutomatically(editor, isCurrent = () => true) {
	const history = editor?.history;
	const handle = editor?.loadedFileHandle;
	if (!isProjectFileHandle(handle) || typeof editor?.makeProjectFileText !== 'function')
		return false;
	try {
		return await queueProjectSave(editor, async () => {
			if (!isCurrent() || editor.history !== history || editor.loadedFileHandle !== handle)
				return false;
			if (getSaveStatus(editor).file === 'saved') return true;
			if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
				throw new Error('Click Save to allow writing this file.');
			}
			if (!isCurrent() || editor.history !== history || editor.loadedFileHandle !== handle)
				return false;
			const written = captureSaveState(editor);
			setSaveStatus(editor, { file: 'saving', error: '' });
			const text = await editor.makeProjectFileText();
			if (!isCurrent() || editor.history !== history || editor.loadedFileHandle !== handle)
				return false;
			await writeToHandle(handle, text, async () => {
				await assertFileUnchanged(editor, handle, true);
				if (!isCurrent() || editor.history !== history || editor.loadedFileHandle !== handle) {
					throw new Error('The project changed before the save could finish.');
				}
			});
			if (!isCurrent() || editor.history !== history || editor.loadedFileHandle !== handle)
				return false;
			await rememberFileVersion(editor, handle);
			settleSavedState(editor, written);
			return true;
		});
	} catch (error) {
		if (isCurrent() && editor.history === history)
			setSaveStatus(editor, { file: 'failed', error: error.message || 'Use Save to retry' });
		return false;
	}
}

/**
 * What a save is about to write, taken right before the text is built.
 * @param {ProjectEditor} editor
 * @returns {{revision: Number, history: Object, entry: Object | null}} editor revision and
 *   the undo entry on top of the queue (null: the queue is empty)
 */
function captureSaveState(editor) {
	return {
		history: editor.history,
		revision: getSaveStatus(editor).revision,
		entry: editor?.history?.queue?.[0] || null,
	};
}

/**
 * After a write: saved and clean when no edit landed since captureSaveState;
 * otherwise the dot stays, recovery stays dirty, and History learns which undo state
 * the file holds.
 * @param {ProjectEditor} editor
 * @param {{revision: Number, history: Object, entry: Object | null}} written - from captureSaveState
 * @returns {Boolean} true when the project is now clean
 */
function settleSavedState(editor, written) {
	if (editor.history !== written.history) return false;
	const clean = getSaveStatus(editor).revision === written.revision;
	if (clean) {
		editor.setProjectAsSaved();
		markRecoveryClean(editor);
	} else if (typeof editor.history?.markSavedStateAt === 'function') {
		editor.history.markSavedStateAt(written.entry);
	}
	setSaveStatus(editor, { file: clean ? 'saved' : 'pending', error: '' });
	return clean;
}

/**
 * showSaveFilePicker for this project. Call inside a click.
 * @param {ProjectEditor} editor
 * @returns {Promise<FileSystemFileHandle | false>}
 */
async function pickSaveHandle(editor) {
	const handle = await runPicker(
		getFileApi().showSaveFilePicker,
		{ id: PROJECT_PICKER_ID, suggestedName: projectFileName(editor), types: PROJECT_FILE_TYPES },
		'Click Save again to choose where to save.'
	);
	return isFileHandle(handle) ? handle : false;
}

/**
 * Writes the text, then does the shared bookkeeping.
 * @param {ProjectEditor} editor
 * @param {FileSystemFileHandle} handle
 * @param {String} text - the .gs2 content
 * @param {Object} written - captureSaveState() taken before the text was built
 * @param {Boolean} canRepick - true for the open file: a moved or refused file offers
 *   Save As once; a file just picked in Save As is only reported
 * @returns {Promise<Boolean>} false when the write failed (the reason was shown)
 */
async function writeProject(editor, handle, text, written, canRepick) {
	try {
		await writeToHandle(handle, text, async () => {
			await assertFileUnchanged(editor, handle);
			if (editor.history !== written.history)
				throw new Error('The project changed before the save could finish.');
		});
	} catch (error) {
		if (editor.history === written.history)
			setSaveStatus(editor, { file: 'failed', error: error.message });
		console.warn('ANY-INK save failed', error);
		const name = error?.name;
		if (canRepick && (name === 'NotFoundError' || name === 'NotAllowedError')) {
			showToast(
				name === 'NotFoundError'
					? `${fileLabel(handle)} is no longer where it was. Choose where to save it.`
					: notAllowedMessage(handle)
			);
			const picked = await pickSaveHandle(editor);
			if (!picked) return false;
			return writeProject(editor, picked, text, written, false);
		}
		showError(saveErrorMessage(handle, error));
		return false;
	}
	if (editor.history !== written.history) return false;
	editor.loadedFileHandle = handle;
	await rememberFileVersion(editor, handle);
	await afterProjectSaved(editor, handle, written);
	return true;
}

/**
 * @param {FileSystemFileHandle} handle
 * @param {*} error - what the write threw
 * @returns {String} HTML for the error box
 */
function saveErrorMessage(handle, error) {
	const advice =
		error?.name === 'NoModificationAllowedError'
			? 'If another window has it open, close that window and try again.'
			: '';
	return `
		${fileLabel(handle)} could not be saved.
		${advice}
		<hr>
		${error?.message || error}
	`;
}

function notAllowedMessage(handle) {
	return `ANY-INK was not allowed to write ${fileLabel(handle)}. Choose a new file.`;
}

function fileLabel(handle) {
	return handle?.name || 'The project file';
}

/**
 * The tail of a successful write. The project is marked saved (title dot, recovery
 * clean) only when no edit landed after the text was built: otherwise the file on
 * disk is one change behind memory and crash recovery must keep the newer state.
 * @param {ProjectEditor} editor
 * @param {FileSystemFileHandle} handle
 * @param {Object} written - captureSaveState() taken before the text was built
 */
async function afterProjectSaved(editor, handle, written) {
	const clean = settleSavedState(editor, written);
	await rememberLastProject(handle);
	await pushRecentProject(handle, projectName(editor));
	publishProjectFile(editor, handle, 'save', clean);
	showToast(savedMessage(handle.name || projectFileName(editor), clean));
}

function savedMessage(fileName, clean) {
	if (clean) return `Saved ${fileName}`;
	return `Saved ${fileName}.<br>A change made while saving is not in the file yet.`;
}

/**
 * Upstream's download path: a date-stamped file in the browser's download folder.
 * Same edit-during-save guard as a write.
 * @param {ProjectEditor} editor
 * @param {Function} getText - () => String | Promise<String>
 * @returns {Promise<Boolean>} true
 */
async function downloadProjectText(editor, getText) {
	const written = captureSaveState(editor);
	const text = await getText();
	const blob = new Blob([text], { type: 'text/plain;charset=utf-8', endings: 'native' });
	const fileName = `${projectName(editor)} - ${makeFileDateString()}.gs2`;
	const download = getFileApi().download || saveFile;
	download(blob, fileName);
	const clean = settleSavedState(editor, written);
	publishProjectFile(editor, false, 'download', clean);
	showToast(clean ? 'Saved project file' : savedMessage('project file', false));
	return true;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * Tells crash recovery (src/anyink/recovery) that the file on disk now matches this
 * editor's project, so that session's snapshot goes and the Recover card stays quiet
 * for it. Best effort: never throws, never awaited by the save flow.
 * @param {ProjectEditor} editor - the editor that saved (two-project mode has two)
 */
function markRecoveryClean(editor) {
	try {
		const result = markClean(editor);
		if (result && typeof result.catch === 'function') result.catch(() => undefined);
	} catch {
		// recovery is optional bookkeeping; the save itself already succeeded
	}
}

/**
 * @param {ProjectEditor} editor
 * @returns {String} the project name, or 'Untitled'
 */
export function projectName(editor) {
	return editor?.project?.settings?.project?.name || 'Untitled';
}

/**
 * @param {ProjectEditor} editor
 * @returns {String} '<name>.gs2' with characters Windows forbids in file names replaced
 */
export function projectFileName(editor) {
	const safe = projectName(editor)
		.replace(/[<>:"/\\|?*]/g, '-')
		.replace(/\p{Cc}/gu, '-')
		.trim();
	return `${safe || 'Untitled'}.gs2`;
}

function publishProjectFile(editor, handle, reason, saved = true) {
	if (typeof editor?.publish !== 'function') return;
	editor.publish('projectFile', {
		handle: handle || false,
		name: handle?.name || projectFileName(editor),
		saved,
		reason,
	});
}
