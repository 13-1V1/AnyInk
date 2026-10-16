// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 fixes: one Undo step about one letter, wherever he is (UX-BEGINNER.md 7.3: a fix button
	is an item step; 4.2: the fix buttons sit on the board's tiles too), and the toast when a fix
	flips another letter's state (4.2: "Moving the line made 3 letters need a look. [Show me]";
	principle 6: an action that changes a letter he isn't looking at says which).

	  recordLetterStep(editor, itemId, title, change, options)
	      change(item) makes the change and returns true when it changed something; then one
	      item step `title` is recorded about that letter (History.addState, so the spacing hook
	      refits an automatic letter inside that same step). Nothing changed: no step, no toast.
	      The letter open in the letter view: a step as any other there. Any other letter (a fix
	      pressed on a board tile; the Next line's Fix it for a letter that isn't open): History
	      records the letter the editor has selected, so for that one call the editor is pointed
	      at it (the page and the selected letter, with no topic published, the letter's own view
	      left as it was) and then put back, so the board stays the board. In a letter view of
	      another letter a toast names the letter that changed, with [Show me].
	      -> { done, title, itemId, flipped }: flipped lists the other letters the step made
	      need a look (a toast says so in Simple)
	  useNeedsALook(fn)   B11's "needs a look", from the checks track: fn(item, { char, editor })
	                      -> truthy when the letter needs a look (the coach's 'checks' source has
	                      the same form). Returns the one it replaced. Until one is set, nothing
	                      is compared and no flip toast shows.
	  needsALookNow(editor, needsALook?) -> Set of the ids of letters with ink that need a look
	  flippedSince(before, editor, { except, needsALook }) -> the ids that need a look now and
	                      didn't before, in code order (Capital A before small a)
	  sayFlipped(editor, ids, { by, letter, showMe }) -> Boolean: the toast, Simple only.
	      by 'line': "Moving the line made small n need a look." / "... made 3 letters ...";
	      by 'fix': "Fixing small a made small n need a look." [Show me] opens the first one
	      (or runs showMe(ids))
*/
import { isSimpleMode } from '../mode/mode.js';
import { showItem } from '../preview/show_item.js';
import { inkBounds } from '../spacing/measure.js';
import { toast } from '../toast/toast.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';

/** @type {Function | null} */
let needsALookSource = null;

/**
 * @param {Function | null} fn - (item, { char, editor }) => needsLook | null
 * @returns {Function | null} the one it replaced
 */
export function useNeedsALook(fn) {
	const previous = needsALookSource;
	needsALookSource = typeof fn === 'function' ? fn : null;
	return previous;
}

/**
 * B16 final: what a letter needs a look for now ({ reason, ... }), or null
 * @param {Object} editor
 * @param {Object} item
 * @returns {Object | null}
 */
export function lookOf(editor, item, needsALook = needsALookSource) {
	if (typeof needsALook !== 'function' || !item) return null;
	try {
		return needsALook(item, { char: item.chars, editor }) || null;
	} catch (error) {
		console.warn('ANY-INK fixes: a letter check failed', error);
		return null;
	}
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Function | null} [needsALook] - default: the one useNeedsALook set
 * @returns {Set<String> | null} null when there is no source to ask
 */
export function needsALookNow(editor, needsALook = needsALookSource) {
	if (typeof needsALook !== 'function' || !editor?.project) return null;
	const ids = new Set();
	lettersWithInk(editor.project).forEach((item) => {
		let look = null;
		try {
			look = needsALook(item, { char: item.chars, editor });
		} catch (error) {
			console.warn('ANY-INK fixes: a letter check failed', error);
		}
		if (look) ids.add(item.id);
	});
	return ids;
}

/**
 * @param {Set<String> | null} before - needsALookNow before the change
 * @param {Object} editor
 * @param {{except?: String | null, needsALook?: Function | null}} [options]
 * @returns {Array<String>}
 */
export function flippedSince(
	before,
	editor,
	{ except = null, needsALook = needsALookSource } = {}
) {
	if (!before) return [];
	const after = needsALookNow(editor, needsALook);
	if (!after) return [];
	return [...after].filter((id) => id !== except && !before.has(id)).sort(byCode);
}

/**
 * @param {Object} editor
 * @param {String} itemId - 'glyph-0x61'
 * @param {String} title - the step's plain title ('sat small a on the writing line')
 * @param {(item: Object) => Boolean} change
 * @param {{needsALook?: Function | null, showMe?: Function}} [options]
 * @returns {{done: Boolean, title: String, itemId: String, flipped: Array<String>}}
 */
export function recordLetterStep(editor, itemId, title, change, options = {}) {
	const result = { done: false, title, itemId, flipped: [] };
	const item = letterOf(editor, itemId);
	if (!item || typeof change !== 'function' || typeof editor.history?.addState !== 'function') {
		return result;
	}
	const needsALook = options.needsALook === undefined ? needsALookSource : options.needsALook;
	const before = needsALookNow(editor, needsALook);
	const open = isLetterOpen(editor, itemId);
	let changed = false;
	if (open) {
		changed = !!change(item);
		if (changed) editor.history.addState(title);
	} else if (!pointAt(editor, itemId, () => (changed = !!change(item)) && record(editor, title))) {
		return result;
	}
	if (!changed) return result;
	editor.publish?.('currentItem', open ? editor.selectedItem || item : item);
	result.done = true;
	result.flipped = flippedSince(before, editor, { except: itemId, needsALook });
	if (result.flipped.length) {
		sayFlipped(editor, result.flipped, { by: 'fix', letter: nameOf(item), showMe: options.showMe });
	} else if (!open && editor.nav?.isOnEditCanvasPage) {
		sayChangedElsewhere(editor, item, options.showMe);
	}
	return result;
}

/**
 * @param {Object} editor
 * @param {Array<String>} ids - letters that need a look now
 * @param {{by?: 'fix' | 'line', letter?: String, showMe?: Function}} [options]
 * @returns {Boolean} true when a toast was asked for
 */
export function sayFlipped(editor, ids, { by = 'fix', letter = '', showMe } = {}) {
	if (!isSimpleMode() || !Array.isArray(ids) || !ids.length) return false;
	const first = letterOf(editor, ids[0]);
	const one = ids.length === 1;
	const key = `fixes.toast.${by === 'line' ? 'line' : 'fix'}Flipped${one ? 'One' : 'Many'}`;
	const vars = { count: ids.length, other: first ? nameOf(first) : '', letter: letter || '' };
	if (one && !vars.other) return false;
	if (by !== 'line' && !vars.letter) vars.letter = word('history.thisLetter');
	toast(key, vars, {
		kind: 'automatic',
		action: { key: 'check.showMe', run: () => show(editor, ids, showMe) },
	});
	return true;
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** In a letter view of another letter: which letter the fix changed. */
function sayChangedElsewhere(editor, item, showMe) {
	if (!isSimpleMode()) return;
	toast(
		'fixes.toast.fixedOther',
		{ letter: nameOf(item) },
		{
			kind: 'automatic',
			action: { key: 'check.showMe', run: () => show(editor, [item.id], showMe) },
		}
	);
}

function show(editor, ids, showMe) {
	if (typeof showMe === 'function') return showMe(ids);
	return showItem(editor, ids[0]);
}

/** One item step; true so the caller's && chain reads as "changed and recorded". */
function record(editor, title) {
	editor.history.addState(title);
	return true;
}

/**
 * Points the editor at a letter that isn't open for one call: the page and the selected
 * letter only, no topic published, and the letter's own view (which the spacing hook moves to
 * keep the ink still on screen) put back as it was, so opening it later fits it as usual.
 * @param {Object} editor
 * @param {String} itemId - a letter ('glyph-...')
 * @param {Function} run
 * @returns {Boolean} false when it can't (not a letter id)
 */
function pointAt(editor, itemId, run) {
	if (!/^glyph-/.test(itemId) || !editor.nav) return false;
	const page = editor.nav.page;
	const selected = editor._selectedGlyphID;
	const views = editor._views || null;
	const hadView = !!views && Object.hasOwn(views, itemId);
	const view = hadView ? { ...views[itemId] } : null;
	try {
		editor.nav.page = 'Characters';
		editor._selectedGlyphID = itemId;
		run();
	} finally {
		editor.nav.page = page;
		editor._selectedGlyphID = selected;
		if (views && hadView) views[itemId] = view;
		else if (views) delete views[itemId];
	}
	return true;
}

/** @returns {Boolean} true when the letter view shows this letter */
function isLetterOpen(editor, itemId) {
	if (!editor?.nav?.isOnEditCanvasPage) return false;
	return editor.selectedItemID === itemId;
}

/** @returns {Object | null} the letter (glyphs and joined letters) */
function letterOf(editor, itemId) {
	if (typeof itemId !== 'string') return null;
	const project = editor?.project;
	return project?.glyphs?.[itemId] || project?.ligatures?.[itemId] || null;
}

/** @returns {Array<Object>} every letter with ink, glyphs then joined letters */
function lettersWithInk(project) {
	return [...Object.values(project.glyphs || {}), ...Object.values(project.ligatures || {})].filter(
		(item) => item && !!inkBounds(item)
	);
}

/** @returns {String} 'small a', 'the period', or "this letter" */
export function nameOf(item) {
	return letterPhrase(item?.chars) || word('history.thisLetter');
}

/** Code order for the toast's first letter: ids sorted by their code as a number. */
function byCode(a, b) {
	return codeOf(a) - codeOf(b) || String(a).localeCompare(String(b));
}

function codeOf(id) {
	const match = /^glyph-0x([0-9a-f]+)$/i.exec(String(id));
	return match ? parseInt(match[1], 16) : Number.MAX_SAFE_INTEGER;
}
