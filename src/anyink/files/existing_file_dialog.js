// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK "file already exists" dialog (Milestone 6, D-012).
	Owner: FILES track.

	Asked by export_folder.js before an export would replace a file that ANY-INK
	did not write itself (a downloaded font, the font the project was imported
	from). Upstream's modal dialog, themed by tokens; plain words.

	  askAboutExistingFile({ fileName, folderName, keepBothName })
	      -> Promise<'replace' | 'keepBoth' | 'cancel'>
	      Closing the dialog any other way (its X, a click outside it, another
	      dialog replacing it) counts as 'cancel'.
	Buttons carry data-anyink-choice="replace|keepBoth|cancel" (tests click them).
*/

import { addAsChildren, makeElement } from '../../common/dom.js';
import { closeEveryTypeOfDialog, showModalDialog } from '../../controls/dialogs/dialogs.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import style from './existing_file_dialog.css?inline';

/**
 * @param {Object} names
 * @param {String} names.fileName - the file that is already there, e.g. 'MyFont-Regular.otf'
 * @param {String} names.folderName - the export folder's name
 * @param {String} names.keepBothName - what 'Keep both' would name the new file
 * @returns {Promise<'replace' | 'keepBoth' | 'cancel'>}
 */
export function askAboutExistingFile({ fileName, folderName, keepBothName }) {
	injectStyleOnce('anyink-existing-file-style', style);
	return new Promise((resolve) => {
		let settled = false;
		let observer = null;
		const finish = (choice) => {
			if (settled) return;
			settled = true;
			observer?.disconnect();
			resolve(choice);
		};

		const content = makeElement({
			tag: 'div',
			className: 'anyink-existing-file',
			innerHTML: `
				<h2>${escapeHTML(fileName)} already exists in ${escapeHTML(folderName)}.</h2>
				<p>
					ANY-INK did not make that file, so it asks before replacing it.
					<strong>Keep both</strong> saves this export as ${escapeHTML(keepBothName)}.
				</p>
			`,
		});
		const button = (choice, label, attributes = {}) =>
			makeElement({
				tag: 'fancy-button',
				attributes: { ...attributes, 'data-anyink-choice': choice },
				innerHTML: label,
				onClick: () => {
					finish(choice);
					closeEveryTypeOfDialog();
				},
			});
		const buttons = makeElement({ tag: 'div', className: 'anyink-existing-file__buttons' });
		addAsChildren(buttons, [
			button('replace', 'Replace', { danger: '' }),
			button('keepBoth', 'Keep both'),
			button('cancel', 'Cancel', { secondary: '' }),
		]);
		content.appendChild(buttons);
		showModalDialog(content, 460);

		const modal = content.closest('#modal-dialog');
		if (!modal?.parentNode) return finish('cancel');
		if (typeof MutationObserver === 'function') {
			observer = new MutationObserver(() => {
				if (!modal.isConnected) finish('cancel');
			});
			observer.observe(modal.parentNode, { childList: true });
		}
	});
}

function escapeHTML(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
