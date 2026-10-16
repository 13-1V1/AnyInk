// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration (docs/SKETCH.md section 2: "Leaving the letter mid-piece finishes it on its own
	letter"): History's addState records the letter that is open (editor.selectedItem, read from
	editor.nav.page and the selected id). A piece finished while the view is already moving (the
	board, another letter, a page that shows none) must still be stored as a step of the letter it
	was drawn on. onItsLetter runs the commit with that letter open for the moment of the step,
	then puts the view back exactly as it was, with nothing published (the private ids are set,
	never the setters, which would say a letter was picked).

	  onItsLetter(editor, item, fn)   fn's result; fn runs as is when the letter is open already,
	                                  or when it can't be found by its id
	  isGoneFromFont(editor, item)    true when the editor's font no longer holds this letter (the
	                                  font was replaced): a piece for it is never stored
	  liveItemOf(editor, item, project)   the letter as the font holds it NOW: an Undo writes a
	                                  new object for a letter (history/item_state.js), so a tool
	                                  keeps the letter's id and looks it up; null when the letter
	                                  is gone or the font was swapped for another (project: the
	                                  font the piece was started in); the item itself when the
	                                  editor has no such collection (tests' stand-ins)
*/
import { pageFromItemID } from '../../history/history_helpers.js';

/** editor.nav.page -> the private field that holds its selected id */
const FIELDS = Object.freeze({
	Characters: '_selectedGlyphID',
	Ligatures: '_selectedLigatureID',
	Components: '_selectedComponentID',
});

/** page -> the project's collection */
const COLLECTIONS = Object.freeze({
	Characters: 'glyphs',
	Ligatures: 'ligatures',
	Components: 'components',
});

/**
 * @param {Object} editor
 * @param {Object} item
 * @returns {Boolean}
 */
export function isGoneFromFont(editor, item) {
	const id = item?.id;
	const page = typeof id === 'string' ? pageFromItemID(id) : false;
	const collection = editor?.project?.[COLLECTIONS[page]];
	if (!collection || typeof collection !== 'object') return false;
	return collection[id] !== item;
}

/**
 * @param {Object} editor
 * @param {Object} item
 * @param {Object} [project] - the font the piece was started in
 * @returns {Object | null}
 */
export function liveItemOf(editor, item, project) {
	if (!item) return null;
	if (project && editor?.project && editor.project !== project) return null;
	const id = item.id;
	const page = typeof id === 'string' ? pageFromItemID(id) : false;
	const collection = editor?.project?.[COLLECTIONS[page]];
	if (!collection || typeof collection !== 'object') return item;
	return collection[id] || null;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} item - the letter the piece was drawn on
 * @param {Function} fn
 * @returns {*}
 */
export function onItsLetter(editor, item, fn) {
	if (!editor?.nav || !item || editor.selectedItem === item) return fn();
	const id = item.id;
	const page = typeof id === 'string' ? pageFromItemID(id) : false;
	const field = FIELDS[page];
	if (!field || editor.project?.[COLLECTIONS[page]]?.[id] !== item) return fn();
	const saved = { page: editor.nav.page, id: editor[field] };
	editor.nav.page = page;
	editor[field] = id;
	try {
		return fn();
	} finally {
		editor.nav.page = saved.page;
		editor[field] = saved.id;
	}
}
