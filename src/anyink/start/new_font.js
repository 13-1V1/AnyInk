// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 + B13 integration: Menu > Start a new font... (UX-BEGINNER.md 4.9, 7.4 confirmation 4). The
	Simple Menu row sends 'anyink-start-new-font' (topbar/doors.js NEW_FONT_EVENT); this answers
	it with the start screen. Work the work file doesn't hold is never dropped: Ctrl+O's box first
	(files/open_font.js), "Your work has changes that aren't saved. [Save] [Cancel]". After a Save
	that saved, the start screen comes straight away: it opens no picker, so it needs no second
	click (Create on the start screen is a click of its own). A Save that didn't save closes the
	box; runFileCommand has already said why.
	On the way a backup copy of the font is written (recovery.js snapshotNow), as Ctrl+O does, and
	the editor he was in becomes the one the start screen's Create or Continue fills.

	  startNewFontCommand({ editor, unsaved, goToStart })   'start' | 'asked'
	  goToStartScreen(editor)        the backup copy, then the start screen for that editor
	  installNewFont({ run })        listens for the Menu row's event; returns the uninstall
*/
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../../app/main.js';
import { forgetSecondProject, makePage_OpenProject } from '../../app/open_project.js';
import { closeEveryTypeOfDialog } from '../../controls/dialogs/dialogs.js';
import { button, hasUnsavedWork, showBox } from '../files/open_font.js';
import { runFileCommand } from '../files/run_command.js';
import { snapshotNow } from '../recovery/recovery.js';
import { NEW_FONT_EVENT } from '../topbar/doors.js';

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Promise<void>}
 */
export async function goToStartScreen(editor) {
	try {
		await snapshotNow('new', editor);
	} catch (error) {
		console.warn('ANY-INK: no backup copy before starting a new font', error);
	}
	forgetSecondProject();
	const app = getGlyphrStudioApp();
	if (editor) app.editorImportTarget = editor;
	app.appPageNavigate(makePage_OpenProject);
}

/**
 * @param {Object} [options]
 * @param {Object} [options.editor] - default: the current project editor
 * @param {() => Boolean} [options.unsaved] - default: hasUnsavedWork(editor)
 * @param {(editor: Object) => Promise | void} [options.goToStart] - default: goToStartScreen
 * @returns {Promise<'start' | 'asked'>}
 */
export async function startNewFontCommand({
	editor = getCurrentProjectEditor(),
	unsaved,
	goToStart = goToStartScreen,
} = {}) {
	const isUnsaved = unsaved || (() => hasUnsavedWork(editor));
	if (!isUnsaved()) {
		await goToStart(editor);
		return 'start';
	}
	showBox([
		button('save', 'open.save', false, async () => {
			await runFileCommand(() => editor.saveProjectFile());
			closeEveryTypeOfDialog();
			if (!isUnsaved()) await goToStart(editor);
		}),
		button('cancel', 'open.cancel', true, () => closeEveryTypeOfDialog()),
	]);
	return 'asked';
}

/**
 * @param {{run?: Function, win?: Window}} [options]
 * @returns {Function} uninstall
 */
export function installNewFont({ run = () => startNewFontCommand(), win = globalThis } = {}) {
	const onDoor = () => {
		run();
	};
	win.addEventListener?.(NEW_FONT_EVENT, onDoor);
	return () => win.removeEventListener?.(NEW_FONT_EVENT, onDoor);
}
