// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize (UX-BEGINNER.md 7.3: "Destructive actions use an Undo toast, not a confirm:
	Clear letter, delete a shape ..."): what Delete took, said in Simple after its one step, with
	[Undo] that takes back exactly that step while it is the newest change (history/undo_toast.js
	undoOffer):
	  "Deleted a shape from small a." [Undo]     Delete on picked shapes
	  "Deleted 2 points from small a." [Undo]    Delete on picked points
	project_editor/actions.js calls it after deleteSelectedPaths / deleteSelectedPoints record
	their step. All tools says nothing new.

	  sayDeleted(editor, { what, count })   what: 'shape' | 'point'; true when a toast was asked
*/
import { undoOffer } from '../history/undo_toast.js';
import { isSimpleMode } from '../mode/mode.js';
import { toast } from '../toast/toast.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';

/**
 * @param {Object} editor - ProjectEditor
 * @param {{what: 'shape' | 'point', count: Number}} deleted
 * @returns {Boolean}
 */
export function sayDeleted(editor, { what, count }) {
	if (!isSimpleMode() || !editor || !(count > 0)) return false;
	const item = editor.selectedItem;
	const name = letterPhrase(item?.chars || '') || word('history.thisLetter');
	const key = what === 'point' ? 'letter.toast.deletedPoint' : 'letter.toast.deletedShape';
	toast(key, { count, name }, { kind: 'destructive', ...undoOffer(editor) });
	return true;
}
