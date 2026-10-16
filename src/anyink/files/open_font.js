// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: Ctrl+O, "Open a saved font" (UX-BEGINNER.md 7.6, 4.9), the same in both modes: the work
	file picker (openProjectFromPicker), instead of upstream's new window. The font that opens
	takes this editor's place, so work its work file doesn't hold is never dropped: first a box,
	"Your work has changes that aren't saved. [Save] [Cancel]". After Save finishes the box reads
	"Saved. [Open a font...]": the picker needs a click of its own (Chrome opens one picker per
	click, and Save may already have used it to ask where). A save that was cancelled or failed
	closes the box; runFileCommand has already said why.
	A browser with no file picker keeps upstream's Ctrl+O (the app in a new window), so nothing is
	lost there either.
	B4 + B5 finalize:
	  - the picked font goes into the editor Ctrl+O was pressed in (the one the check guarded),
	    never the app's import target, which with two fonts open can be the other one
	  - "unsaved" is any work its work file doesn't hold: ink the file lacks (the leave-site
	    check's rule, app.js hasInkNotInItsFile), or, while the save status isn't Saved, any
	    real History step (a photo, a rename, a guide line: no shapes needed)
	  - a backup copy of his work is written (recovery.js snapshotNow) before the font is
	    replaced, so nothing between two backups is lost

	  openFontCommand({ editor, unsaved })   'picker' | 'asked' | 'window'
	  hasUnsavedWork(editor)                 the rule above
	B10 + B11 integration (UX-BEGINNER.md 4.2 Drops: "A .gs2 opens it"; the board-tiles track's
	need 4): a work file dropped on the letter board opens into the font he is in, with Ctrl+O's
	check first (the same box: [Save] [Cancel]; no second click after Save, since a drop needs
	no picker). The file's handle is taken during the drop itself (board_drop.js:
	DataTransferItem.getAsFileSystemHandle, which only works then), so Save writes back to the
	file he dropped; without it (no File System Access, or the handle can't be read) the dropped
	file itself is read and the font has no work file yet (Save asks where). A file that isn't a
	work file ANY-INK can read says so in 7.7's words, as Ctrl+O's picker does.
	  openDroppedFont({ editor, file, handle, unsaved })   'opened' | 'asked' | 'failed'; handle:
	                                         the promise getAsFileSystemHandle gave (or null)
	Buttons carry data-anyink-choice (save, cancel, open) for tests and later Bs.
*/
import { hasInkNotInItsFile } from '../../app/app.js';
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../../app/main.js';
import { forgetSecondProject, importProjectDataAndNavigate } from '../../app/open_project.js';
import { addAsChildren, makeElement } from '../../common/dom.js';
import { closeEveryTypeOfDialog, showModalDialog } from '../../controls/dialogs/dialogs.js';
import { isLookingAroundEntry } from '../history/history_helpers.js';
import { snapshotNow } from '../recovery/recovery.js';
import { word } from '../words/words.js';
import { hasFileSystemAccess } from './file_api.js';
import { openProjectFromHandle, openProjectFromPicker } from './project_files.js';
import { readFileText, validateProjectText } from './read_project.js';
import { runFileCommand } from './run_command.js';
import { getSaveStatus } from './save_status.js';
import { isFileHandle, isProjectFileHandle } from './write_file.js';
import { sayError } from '../words/error_box.js';
import { openErrorWords } from '../words/error_words.js';

const BOX_CLASS = 'anyink-open-box';

/**
 * @param {Object} [options]
 * @param {Object} [options.editor] - default: the current project editor
 * @param {() => Boolean} [options.unsaved] - default: hasUnsavedWork(editor)
 * @returns {Promise<'picker' | 'asked' | 'window'>} what it did
 */
export async function openFontCommand({ editor = getCurrentProjectEditor(), unsaved } = {}) {
	if (!hasFileSystemAccess()) {
		window.open(window.location.href, '_blank');
		return 'window';
	}
	const isUnsaved = unsaved || (() => hasUnsavedWork(editor));
	const pick = () => runFileCommand(() => openProjectFromPicker({ load: loadInto(editor) }));
	if (!isUnsaved()) {
		pick();
		return 'picker';
	}
	showBox([
		button('save', 'open.save', false, async () => {
			await runFileCommand(() => editor.saveProjectFile());
			if (isUnsaved()) {
				closeEveryTypeOfDialog();
				return;
			}
			showBox(
				[
					button('open', 'open.openFont', false, () => {
						closeEveryTypeOfDialog();
						pick();
					}),
				],
				'open.saved'
			);
		}),
		button('cancel', 'open.cancel', true, () => closeEveryTypeOfDialog()),
	]);
	return 'asked';
}

/**
 * A work file dropped on the board opens into this font, after Ctrl+O's unsaved check.
 * @param {Object} options
 * @param {Object} [options.editor] - default: the current project editor
 * @param {File} options.file - the dropped file
 * @param {Promise<FileSystemHandle | null> | FileSystemHandle | null} [options.handle] - taken
 *   during the drop (getAsFileSystemHandle)
 * @param {() => Boolean} [options.unsaved] - default: hasUnsavedWork(editor)
 * @returns {Promise<'opened' | 'asked' | 'failed'>}
 */
export async function openDroppedFont({
	editor = getCurrentProjectEditor(),
	file,
	handle = null,
	unsaved,
} = {}) {
	const isUnsaved = unsaved || (() => hasUnsavedWork(editor));
	const open = async () => {
		let opened = false;
		await runFileCommand(async () => (opened = await openDropped(editor, file, handle)));
		return opened;
	};
	if (!isUnsaved()) return (await open()) ? 'opened' : 'failed';
	showBox([
		button('save', 'open.save', false, async () => {
			await runFileCommand(() => editor.saveProjectFile());
			closeEveryTypeOfDialog();
			// saved: the dropped font opens now (a drop needs no picker, so no second click)
			if (!isUnsaved()) await open();
		}),
		button('cancel', 'open.cancel', true, () => closeEveryTypeOfDialog()),
	]);
	return 'asked';
}

/**
 * @returns {Promise<Boolean>} true when the font opened
 */
async function openDropped(editor, file, handlePromise) {
	let handle = null;
	try {
		handle = await handlePromise;
	} catch {
		handle = null;
	}
	if (isFileHandle(handle) && isProjectFileHandle(handle)) {
		const status = await openProjectFromHandle(handle, { load: loadInto(editor) });
		if (status === 'opened') return true;
		// 'invalid' said why already (7.7); a handle it may not read falls back to the file itself
		if (status === 'invalid') return false;
	}
	if (!file) return false;
	let text = '';
	try {
		text = await readFileText(file);
	} catch (error) {
		sayDropFailed(error?.message || 'The file could not be read.', file.name);
		return false;
	}
	const result = validateProjectText(text);
	if (!result.content) {
		sayDropFailed(result.message, file.name);
		return false;
	}
	await loadInto(editor)(result.content, false);
	return true;
}

/** A dropped file that isn't a work file ANY-INK can read: 7.7's words, as Ctrl+O's picker */
function sayDropFailed(message, fileName) {
	if (message) console.warn('ANY-INK: the dropped work file did not open:', message);
	sayError(openErrorWords(message, fileName), {
		actions: { 'error.button.openAnother': () => openFontCommand() },
		allTools: message,
	});
}

/**
 * B4 + B5 finalize: any work the font's work file doesn't hold.
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean}
 */
export function hasUnsavedWork(editor) {
	if (!editor?.project) return false;
	if (editor.project.settings?.app?.stopPageNavigation === false) return false;
	if (getSaveStatus(editor).file === 'saved') return false;
	if (hasInkNotInItsFile(editor)) return true;
	return (editor.history?.queue || []).some((entry) => !isLookingAroundEntry(entry));
}

/**
 * The loader for Ctrl+O's picker: the picked font goes into this editor (the one the unsaved
 * check guarded), after a backup copy of what it holds now.
 * @param {Object} editor - ProjectEditor
 * @returns {(content: Object, handle: FileSystemFileHandle | false) => Promise<Object>}
 */
function loadInto(editor) {
	return async (content, handle) => {
		try {
			await snapshotNow('open', editor);
		} catch (error) {
			console.warn('ANY-INK: no backup copy before opening another font', error);
		}
		forgetSecondProject();
		const app = getGlyphrStudioApp();
		app.editorImportTarget = editor;
		editor.loadedFileHandle = isProjectFileHandle(handle) ? handle : false;
		importProjectDataAndNavigate(content, editor);
		return editor;
	};
}

/**
 * @param {String} choice - data-anyink-choice
 * @param {String} key - its words
 * @param {Boolean} outlined - every button but the one green one is outlined (principle 1)
 * @param {Function} run
 * @returns {Element}
 */
function button(choice, key, outlined, run) {
	return makeElement({
		tag: 'fancy-button',
		attributes: { 'data-anyink-choice': choice, ...(outlined ? { secondary: '' } : {}) },
		content: word(key),
		onClick: run,
	});
}

/**
 * The box: one sentence and its buttons. A box already showing gets the new words in place.
 * @param {Array<Element>} buttons
 * @param {String} [key] - the sentence
 */
function showBox(buttons, key = 'open.unsaved') {
	const content = makeElement({ tag: 'div', className: BOX_CLASS });
	content.appendChild(makeElement({ tag: 'p', content: word(key) }));
	const row = makeElement({ tag: 'div', className: `${BOX_CLASS}__buttons` });
	addAsChildren(row, buttons);
	content.appendChild(row);

	const showing = document.querySelector(`#modal-dialog .${BOX_CLASS}`);
	if (showing?.isConnected) showing.replaceWith(content);
	else showModalDialog(content, 460);
}
