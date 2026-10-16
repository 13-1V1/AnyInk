// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: keys on the letter board (UX-BEGINNER.md 4.2 "type its letter", 7.6 "On the board,
	typing a letter opens that tile (Shift for capitals); arrows move, Enter opens"; section 10
	B10 board_keys.js). Simple with 'board' on, on the board (the Overview page) only. The key map
	(mode/keys.js 'board.openLetter', 'board.move', 'board.openTile') says whether each key is on,
	so Help lists what works here.

	  a letter       the key's own character opens its tile: b small b, Shift+B (or Caps Lock's B)
	                 Capital B, . , ' ? ! - their marks. Opening is looking around (showItem: in
	                 Simple no Undo step). A character the board doesn't show yet (7 before
	                 "+ Numbers & symbols") says so, with [Add numbers & symbols]; any other key
	                 does nothing
	  arrows         move the green ring (the focus, the one tab stop and the last touched mark
	                 together, so there is never a second ring) between tiles, from the focused
	                 tile, else the last touched one, else onto the first; up and down go to the
	                 nearest tile in the next row on screen
	  Enter, Space   open the focused tile (Enter with nothing focused: the last touched one)
	Never with Ctrl, Alt or the Windows key, while typing in a field (the Try-it text), under a
	dialog, or with focus on another control (its own Enter and arrows are its own).
	A held key opens one letter: its repeats are stopped before anything else hears them until it
	goes up, so holding b never reaches the letter view, where B is the Brush.

	The keys come with the tiles: tile_state.js makeBoardTile calls ensureBoardKeys (once, on
	document), so the board page needs no wiring. Tiles are found by
	glyph-tile[board][data-anyink-char].

	  installBoardKeys({ target, getEditor, open })   the keys on target (default document), in
	                     place of any installed there before; returns uninstall.
	                     open(editor, char) default openBoardLetter
	  ensureBoardKeys()  installs the default keys on document unless some are there already
	  openBoardLetter(editor, char)    opens that letter's view (preview/show_item.js showItem)
	  isBoardShowing(editor)           Simple, 'board' on, the Overview page
	  boardTiles(root)                 the board's tiles, in board order
	  nextTileIndex(rects, from, { dx, dy })   pure: where an arrow goes
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { charToHex } from '../../common/character_ids.js';
import { isShown, openDialogName } from '../coach/dom_probe.js';
import { isTextEntryElement } from '../history/undo_shortcut.js';
import { isFeatureOn } from '../mode/features.js';
import { keyOn } from '../mode/keys.js';
import { isSimpleMode } from '../mode/mode.js';
import { showItem } from '../preview/show_item.js';
import { toast } from '../toast/toast.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { boardLetters, NUMBERS_SET, setNumbersShown } from './letter_set.js';

/** The page the board lives on (topbar/letters_page.js LETTERS_PAGE) */
export const BOARD_PAGE = 'Overview';

export const TILE_SELECTOR = 'glyph-tile[board][data-anyink-char]';

const ARROWS = Object.freeze({
	ArrowLeft: { dx: -1, dy: 0 },
	ArrowRight: { dx: 1, dy: 0 },
	ArrowUp: { dx: 0, dy: -1 },
	ArrowDown: { dx: 0, dy: 1 },
});

/** One install per target: target -> uninstall */
const installs = new WeakMap();

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} the board is on screen: Simple, 'board' on, the Overview page
 */
export function isBoardShowing(editor) {
	return isSimpleMode() && isFeatureOn('board') && editor?.nav?.page === BOARD_PAGE;
}

/**
 * @param {Object} editor
 * @param {String} char
 * @returns {Boolean} true when the letter is on screen
 */
export function openBoardLetter(editor, char) {
	const hex = charToHex(char);
	return !!hex && showItem(editor, `glyph-${hex}`);
}

/**
 * @param {ParentNode} [root]
 * @returns {Array<HTMLElement>} the board's tiles on screen, in board order (the order they are
 *   laid out); a tile a filter hides is left out, so an arrow never lands where he can't see
 */
export function boardTiles(root = globalThis.document) {
	return root?.querySelectorAll ? [...root.querySelectorAll(TILE_SELECTOR)].filter(isShown) : [];
}

/**
 * Where an arrow goes. Left and right step through the order and stop at its ends; up and down
 * go to the nearest tile, left to right, in the next row on screen that way (none: stay).
 * @param {Array<{left: Number, top: Number, width: Number, height: Number}>} rects - each tile's
 *   box on screen, in board order
 * @param {Number} from - the tile it is on; -1 for none (then the first tile)
 * @param {{dx: Number, dy: Number}} step
 * @returns {Number}
 */
export function nextTileIndex(rects, from, { dx = 0, dy = 0 } = {}) {
	const count = rects?.length || 0;
	if (!count) return -1;
	if (!(from >= 0 && from < count)) return 0;
	if (dx) return Math.min(count - 1, Math.max(0, from + Math.sign(dx)));
	if (!dy) return from;
	const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
	const here = centre(rects[from]);
	const tolerance = Math.max(1, (rects[from].height || 0) / 2);
	const ahead = rects
		.map((rect, index) => ({ index, ...centre(rect) }))
		.filter((c) => (c.y - here.y) * Math.sign(dy) > tolerance);
	if (!ahead.length) return from;
	const rowY = ahead.reduce(
		(best, c) => (Math.abs(c.y - here.y) < Math.abs(best - here.y) ? c.y : best),
		ahead[0].y
	);
	const row = ahead.filter((c) => Math.abs(c.y - rowY) <= tolerance);
	return row.reduce((best, c) => (Math.abs(c.x - here.x) < Math.abs(best.x - here.x) ? c : best))
		.index;
}

/**
 * The board's keys on a target (document by default), in place of any installed there before.
 * @param {Object} [options]
 * @param {EventTarget} [options.target] - default: document
 * @param {() => Object} [options.getEditor] - default: the current project editor
 * @param {(editor: Object, char: String) => any} [options.open] - default: openBoardLetter
 * @returns {Function} uninstall
 */
export function installBoardKeys({
	target = globalThis.document,
	getEditor = getCurrentProjectEditor,
	open = openBoardLetter,
} = {}) {
	if (!target || typeof target.addEventListener !== 'function') return () => {};
	installs.get(target)?.();
	const onKey = (event) => {
		try {
			handleBoardKey(event, { getEditor, open, root: target });
		} catch (error) {
			console.warn('ANY-INK board: a key could not be handled', error);
		}
	};
	target.addEventListener('keydown', onKey);
	const uninstall = () => {
		target.removeEventListener('keydown', onKey);
		if (installs.get(target) === uninstall) installs.delete(target);
	};
	installs.set(target, uninstall);
	return uninstall;
}

/** The default keys on document, unless some are installed there already (makeBoardTile). */
export function ensureBoardKeys() {
	const target = globalThis.document;
	if (!target || installs.has(target)) return;
	installBoardKeys({ target });
}

/**
 * @param {KeyboardEvent} event
 * @param {{getEditor: Function, open: Function, root: ParentNode}} context
 */
function handleBoardKey(event, { getEditor, open, root }) {
	if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
	const editor = getEditor();
	if (!editor?.project || !isBoardShowing(editor)) return;
	const doc = root?.ownerDocument || root;
	const active = doc?.activeElement || null;
	if (isTextEntryElement(active) || openDialogName(doc)) return;

	const tiles = boardTiles(root);
	const focused = tiles.includes(active) ? active : null;
	// another control (a toolbar button, a link) keeps its own Enter, Space and arrows
	const elsewhere = !focused && !!active && active !== doc.body && active !== doc.documentElement;
	const key = String(event.key ?? '');

	if (ARROWS[key]) {
		if (elsewhere || !keyOn('board.move')) return;
		event.preventDefault();
		moveFocus(tiles, focused || lastTouched(tiles), ARROWS[key]);
		return;
	}
	if (key === 'Enter' || (key === ' ' && focused)) {
		if (elsewhere || !keyOn('board.openTile')) return;
		const tile = focused || lastTouched(tiles);
		if (!tile) return;
		event.preventDefault();
		openFrom(event, editor, tile.getAttribute('data-anyink-char'), open);
		return;
	}
	if ([...key].length !== 1 || !key.trim() || !keyOn('board.openLetter')) return;
	if (boardLetters(editor.project).includes(key)) {
		event.preventDefault();
		openFrom(event, editor, key, open);
		return;
	}
	if (NUMBERS_SET.includes(key)) {
		event.preventDefault();
		sayNotOnBoard(editor, key);
	}
}

/** Opens a letter from a key press, and keeps that key's repeats from going on. */
function openFrom(event, editor, char, open) {
	if (!char) return;
	holdUntilUp(event);
	open(editor, char);
}

/**
 * @param {Array<HTMLElement>} tiles
 * @returns {HTMLElement | null} the tile with the green ring
 */
function lastTouched(tiles) {
	return tiles.find((tile) => tile.hasAttribute('last-touched')) || null;
}

/**
 * Moves the green ring by an arrow: the focus, the one tab stop and the last touched mark.
 * @param {Array<HTMLElement>} tiles
 * @param {HTMLElement | null} from
 * @param {{dx: Number, dy: Number}} step
 */
function moveFocus(tiles, from, step) {
	if (!tiles.length) return;
	const rects = tiles.map((tile) => tile.getBoundingClientRect());
	const index = nextTileIndex(rects, from ? tiles.indexOf(from) : -1, step);
	const tile = tiles[index];
	if (!tile) return;
	tiles.forEach((t) => {
		if (t === tile) return;
		if (t.getAttribute('tabindex') !== '-1') t.setAttribute('tabindex', '-1');
		// the green ring is what he is touching: it moves with the arrows, so it never shows twice
		t.removeAttribute('last-touched');
	});
	tile.setAttribute('tabindex', '0');
	tile.setAttribute('last-touched', '');
	tile.focus({ preventScroll: true });
	if (typeof tile.scrollIntoView === 'function') tile.scrollIntoView({ block: 'nearest' });
}

/**
 * "The number 7 isn't on your board yet." [Add numbers & symbols]
 * @param {Object} editor
 * @param {String} char
 */
function sayNotOnBoard(editor, char) {
	const name = sentenceStart(letterPhrase(char) || char);
	toast(
		'boardTile.toast.notOnBoard',
		{ name },
		{
			allTools: false,
			action: { key: 'boardTile.button.addNumbers', run: () => setNumbersShown(editor, true) },
		}
	);
}

// --------------------------------------------------------------
// A held key
// --------------------------------------------------------------

/** The key whose repeats are being held back: { off } */
let held = null;

/**
 * Stops the repeats of this press's key, before any other listener hears them, until it goes up
 * (or another key is pressed).
 * @param {KeyboardEvent} event
 */
function holdUntilUp(event) {
	releaseHeld();
	const view = globalThis.window;
	if (!view || typeof view.addEventListener !== 'function') return;
	const same = (e) => (event.code ? e.code === event.code : e.key === event.key);
	const onDown = (e) => {
		if (!e.repeat || !same(e)) {
			releaseHeld();
			return;
		}
		e.preventDefault();
		e.stopImmediatePropagation();
	};
	const onUp = (e) => {
		if (same(e)) releaseHeld();
	};
	view.addEventListener('keydown', onDown, true);
	view.addEventListener('keyup', onUp, true);
	held = {
		off: () => {
			view.removeEventListener('keydown', onDown, true);
			view.removeEventListener('keyup', onUp, true);
		},
	};
}

function releaseHeld() {
	held?.off();
	held = null;
}
