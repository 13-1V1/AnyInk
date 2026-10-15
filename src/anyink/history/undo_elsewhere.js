// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 finalize (UX-BEGINNER.md principle 6: "If an action changes a letter he isn't looking at,
	a toast says which"; 7.3: "the board stays and the toast offers [Show me]"). In Simple, an Undo
	or Redo that changes a letter while a page that isn't a letter shows (Help, About, the
	Overview) says which, with a button that opens it: "Undid: added a rectangle on small b [Show
	small b]". simple_undo.js returns showMe exactly then. On a letter page the view moves to the
	letter (B2), which is answer enough until B6's undo toasts name every press.

	  sayUndoneElsewhere(result, editor, { redo })   result: simple_undo.js undoNewest / redoNewest
*/
import { showItem } from '../preview/show_item.js';
import { toast } from '../toast/toast.js';
import { historyText } from '../words/history_text.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';

/**
 * @param {{done: Boolean, title: String, showMe: {itemID: String, page: String} | null}} result
 * @param {Object} editor - ProjectEditor
 * @param {{redo?: Boolean}} [options]
 */
export function sayUndoneElsewhere(result, editor, { redo = false } = {}) {
	if (!result?.done || !result.showMe || !editor?.project) return;
	const { itemID } = result.showMe;
	const item = editor.project.getItem?.(itemID);
	const letter = letterPhrase(item?.chars || '');
	if (!letter) return;
	const change = historyText(result.title) || word('history.unknown');
	toast(
		redo ? 'undo.redidOn' : 'undo.undidOn',
		{ change, letter },
		{
			kind: 'undo',
			action: {
				label: word('undo.goToLetter', { letter }),
				run: () => showItem(editor, itemID),
			},
		}
	);
}
