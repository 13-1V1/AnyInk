// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
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
import { openProjectFromPicker } from './project_files.js';
import { runFileCommand } from './run_command.js';
import { getSaveStatus } from './save_status.js';
import { isProjectFileHandle } from './write_file.js';

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
