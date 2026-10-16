// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: [Create my font] (UX-BEGINNER.md 4.1). Inside the click it starts Windows' save box
	(showSaveFilePicker, "<name>.gs2", starting in Documents) WITHOUT waiting for it, makes the font
	and opens the board. The board is open whatever the box does: a cancelled box, one that never
	answers, or a browser with no save box leave the font open with "Not saved yet [Save]" (the
	status pill and the Next line's rule 10 say the rest). No error.
	When the box gives a file:
	  - a new file, an empty one, or a work file with no letters that isn't a recent font: the font
	    is written there and the pill reads "Saved"
	  - one of his recent fonts, or a work file with letters in it (replace_check.js): nothing is
	    written yet; confirmation 5 asks "That replaces your font "Brennan Hand" (12 letters).
	    [Use a new name] [Replace it]". Use a new name (green: the safe choice is the obvious one)
	    opens the save box again inside its own click; Replace it first keeps a backup copy of the
	    old file (keep_backup.js), then writes. Closing the box writes nothing.
	  - a file with something in it that isn't a work file (replace_check.js unreadable): there is
	    no backup copy to keep, so it is never written over. The box says so and offers only
	    [Use a new name]; closing it writes nothing ('notReplaced').
	  - if he has opened another font by then, nothing is written: the file was for this one.

	  createFont({ name, create, ... })   { editor, done }: editor is the font Create made; done
	      resolves 'saved' | 'replaced' | 'cancelled' | 'noPicker' | 'movedOn' | 'notReplaced'
	  startSavePicker(name, api)           the save box's promise (null when there is none);
	      resolves the handle, or null when cancelled or refused
	  askReplace({ name, letters, unreadable }, { onNewName })   Promise<{ choice, picker }>: choice
	      'newName' | 'replace' | 'closed'; picker is the save box onNewName started in the click
	Buttons carry data-anyink-choice ('new-name', 'replace') and the box data-anyink-dialog
	('replaceFont') for tests and the Next line.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { closeEveryTypeOfDialog, showModalDialog } from '../../controls/dialogs/dialogs.js';
import { getFileApi, isAbortError } from '../files/file_api.js';
import { listRecentProjects } from '../files/handles.js';
import { PROJECT_PICKER_ID, projectFileTypes, saveProject } from '../files/project_files.js';
import { runFileCommand } from '../files/run_command.js';
import { word } from '../words/words.js';
import { keepBackupCopy } from './keep_backup.js';
import { checkReplace } from './replace_check.js';
import './start.css';
import { suggestedFileName } from './start_state.js';

export const REPLACE_DIALOG = 'replaceFont';

/**
 * @param {String} name - the font name
 * @param {Object} [api] - getFileApi()
 * @returns {Promise<Object | null> | null}
 */
export function startSavePicker(name, api = getFileApi()) {
	if (typeof api?.showSaveFilePicker !== 'function') return null;
	try {
		return Promise.resolve(
			api.showSaveFilePicker({
				id: PROJECT_PICKER_ID,
				suggestedName: suggestedFileName(name),
				startIn: 'documents',
				types: projectFileTypes(),
			})
		)
			.then((handle) => handle || null)
			.catch((error) => {
				if (!isAbortError(error)) console.warn('ANY-INK: the save box did not open', error);
				return null;
			});
	} catch (error) {
		console.warn('ANY-INK: the save box did not open', error);
		return null;
	}
}

/**
 * @param {Object} options
 * @param {String} options.name - the font name (the name field's)
 * @param {() => Object} options.create - makes the font and opens the board; returns its editor
 *   (default: the current editor after it ran)
 * @param {Object} [options.api] - getFileApi()
 * @param {() => Promise<Array>} [options.listRecents]
 * @param {Function} [options.ask] - askReplace
 * @param {Function} [options.keepBackup] - keepBackupCopy
 * @param {(editor: Object) => Promise} [options.save] - writes the font to editor.loadedFileHandle
 * @returns {{editor: Object, done: Promise<String>}}
 */
export function createFont({
	name,
	create,
	api = getFileApi(),
	listRecents = listRecentProjects,
	ask = askReplace,
	keepBackup = keepBackupCopy,
	save = (editor) => runFileCommand(() => saveProject(editor)),
}) {
	// Inside the click, before anything else: Chrome opens a save box only in a click
	const picker = startSavePicker(name, api);
	const made = create();
	const editor = made || safeEditor();
	const project = editor?.project;
	const stillThisFont = () => !!editor && editor.project === project;

	const write = async (handle) => {
		editor.loadedFileHandle = handle;
		await save(editor);
	};

	const usePicked = async (handle) => {
		if (!handle) return 'cancelled';
		if (!stillThisFont()) return 'movedOn';
		let recents = [];
		try {
			recents = (await listRecents()) || [];
		} catch {
			recents = [];
		}
		const replace = await checkReplace(handle, { recents });
		if (!stillThisFont()) return 'movedOn';
		if (!replace) {
			await write(handle);
			return 'saved';
		}
		const answer = await ask(replace, { onNewName: () => startSavePicker(name, api) });
		if (answer?.choice === 'newName') {
			return usePicked(answer.picker ? await answer.picker : null);
		}
		// a file that isn't a work file has no backup copy to keep: it is never written over
		if (replace.unreadable) return 'notReplaced';
		if (answer?.choice !== 'replace' || !stillThisFont()) return 'cancelled';
		if (replace.content) {
			try {
				await keepBackup(replace.content, { name: replace.name });
			} catch (error) {
				// no backup copy, no replacing: his old font stays as it is
				console.warn('ANY-INK: no backup copy of the old work file; nothing replaced', error);
				return 'notReplaced';
			}
		}
		await write(handle);
		return 'replaced';
	};

	const done = picker ? picker.then(usePicked) : Promise.resolve('noPicker');
	return { editor, done };
}

/**
 * Confirmation 5 (UX-BEGINNER.md 7.4).
 * @param {{name: String, letters: Number, unreadable?: Boolean}} replace - unreadable: the file
 *   isn't a work file; the box says it stays as it is and has no Replace it
 * @param {Object} [options]
 * @param {() => Promise | null} [options.onNewName] - runs inside the Use a new name click
 * @returns {Promise<{choice: 'newName' | 'replace' | 'closed', picker?: Promise | null}>}
 */
export function askReplace({ name, letters, unreadable = false }, { onNewName } = {}) {
	return new Promise((resolve) => {
		let answered = false;
		let watcher = null;
		const answer = (value) => {
			if (answered) return;
			answered = true;
			watcher?.disconnect();
			closeEveryTypeOfDialog();
			resolve(value);
		};
		const content = document.createElement('div');
		content.className = 'anyink-replace-box';
		content.setAttribute('data-anyink-dialog', REPLACE_DIALOG);
		const question = document.createElement('p');
		question.textContent = unreadable
			? word('startScreen.replace.cannotRead', { name })
			: word('startScreen.replace.question', { name, count: letters || 0 });
		const row = document.createElement('div');
		row.className = 'anyink-replace-box__buttons';
		const button = (choice, key, primary, run) => {
			const element = document.createElement('button');
			element.type = 'button';
			element.className = primary ? 'anyink-primary' : 'anyink-outlined';
			element.setAttribute('data-anyink-choice', choice);
			element.textContent = word(key);
			element.addEventListener('click', run);
			return element;
		};
		row.append(
			button('new-name', 'startScreen.replace.newName', true, () => {
				// the save box opens in this click (Chrome: one box per click)
				const picker = typeof onNewName === 'function' ? onNewName() : null;
				answer({ choice: 'newName', picker });
			})
		);
		if (!unreadable) {
			row.append(
				button('replace', 'startScreen.replace.replaceIt', false, () =>
					answer({ choice: 'replace' })
				)
			);
		}
		content.append(question, row);
		showModalDialog(content, 460);
		// the x, the backdrop or Esc take the box down without an answer: nothing is written
		const box = content.closest('dialog');
		if (box && typeof MutationObserver === 'function') {
			watcher = new MutationObserver(() => {
				if (!box.isConnected) answer({ choice: 'closed' });
			});
			watcher.observe(box.parentNode || document.body, { childList: true });
		}
	});
}

function safeEditor() {
	try {
		return getCurrentProjectEditor();
	} catch {
		return null;
	}
}
