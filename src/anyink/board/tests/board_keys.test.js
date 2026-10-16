// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: keys on the letter board (UX-BEGINNER.md 4.2 "type its letter", 7.6 "On the
	board, typing a letter opens that tile (Shift for capitals); arrows move, Enter opens"; section
	10 B10 "keys open the right tile (b, Shift+B, period)").
	  - b opens small b, Shift+B Capital B, the punctuation keys their marks (. , ' ? ! -); the
	    letter the key typed is the one that opens (Caps Lock's B is Capital B)
	  - opening is looking around: no Undo step
	  - arrows move a focus ring between tiles (one tab stop), Enter or Space opens it
	  - a key whose letter the board doesn't show yet (7 before "+ Numbers & symbols") says so,
	    with [Add numbers & symbols]; any other key does nothing
	  - nothing happens with Ctrl or Alt, in a text field, under a dialog, off the board, in All
	    tools or with 'board' off
	  - a held key opens one letter: its repeats never reach the letter view (where B is the Brush)
	Written before board_keys.js existed.
*/
import { describe, expect, it } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { word } from '../../words/words.js';
import { letterPage, setUpScreenTests, showing, shownText } from '../../letter/tests/simple_screen.js';
import { boardLetters, numbersShown } from '../letter_set.js';
import { installBoardKeys, nextTileIndex } from '../board_keys.js';
import { makeBoardTile } from '../tile_state.js';

setUpScreenTests();

/**
 * The board in Simple with 'board' on: the Overview page, and a tile for every board letter
 * (tile_state.js, as the board page lays them out).
 * @returns {{editor: Object, tiles: Array<HTMLElement>, opened: Array<String>, off: Function}}
 */
function board({ last = '', mode = 'simple', open } = {}) {
	setFeaturesForTests({ board: true });
	const editor = letterPage({ mode, page: 'Overview' });
	if (last) editor.selectedItemID = `glyph-0x${last.codePointAt(0).toString(16).toUpperCase()}`;
	editor.nav.page = 'Overview';
	const root = document.createElement('div');
	root.className = 'board-test';
	const tiles = boardLetters(editor.project).map((char) =>
		makeBoardTile(editor.project, char, { lastTouched: char === last })
	);
	tiles.forEach((tile) => root.appendChild(tile));
	// in place of the page's own content, so only these tiles are on screen
	document.querySelector('#app__wrapper').replaceChildren(root);
	const opened = [];
	const off = installBoardKeys({
		getEditor: () => editor,
		open: open || ((_editor, char) => opened.push(char)),
	});
	return { editor, tiles, opened, off, root };
}

/** A keydown as Chrome sends it, from the focused element (or the body) */
function press(key, init = {}) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
	(document.activeElement || document.body).dispatchEvent(event);
	return event;
}

const focusedChar = () => document.activeElement?.getAttribute?.('data-anyink-char') || '';

describe('typing a letter opens its tile', () => {
	it('b, Shift+B, period, comma, apostrophe, question mark, exclamation mark, hyphen', () => {
		const { opened, off } = board();
		press('b');
		press('B', { shiftKey: true });
		press('.');
		press(',');
		press("'");
		press('?', { shiftKey: true });
		press('!', { shiftKey: true });
		press('-');
		expect(opened).toEqual(['b', 'B', '.', ',', "'", '?', '!', '-']);
		off();
	});

	it('the letter the key typed: Caps Lock\'s B is Capital B', () => {
		const { opened, off } = board();
		press('B');
		expect(opened).toEqual(['B']);
		off();
	});

	it('the real opener: small b\'s letter view, and no Undo step', () => {
		const { editor, off } = board({ open: undefined });
		off();
		const steps = editor.history.queue.length;
		const offReal = installBoardKeys({ getEditor: () => editor });
		const event = press('b');
		expect(event.defaultPrevented).toBe(true);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe('glyph-0x62');
		expect(editor.history.queue.length).toBe(steps);
		offReal();
	});

	it('the keys come with the tiles: no wiring, the current font\'s board', () => {
		const { editor, off } = board();
		off(); // nothing installed now
		const tile = makeBoardTile(editor.project, 'b');
		document.querySelector('.board-test').appendChild(tile);
		press('b');
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe('glyph-0x62');
		installBoardKeys()(); // and off again for the next test
	});

	it('a key whose letter isn\'t on the board yet says so, with [Add numbers & symbols]', () => {
		const { editor, opened, off } = board();
		press('7');
		expect(opened).toEqual([]);
		expect(shownText()).toBe(word('boardTile.toast.notOnBoard', { name: 'The number 7' }));
		const add = showing().querySelector('button');
		expect(add.textContent).toBe(word('boardTile.button.addNumbers'));
		add.click();
		expect(numbersShown(editor.project)).toBe(true);
		expect(editor.history.queue[0].title).toBe('added numbers & symbols');
		press('7');
		expect(opened).toEqual(['7']);
		off();
	});

	it('a key for no letter of any set does nothing, and says nothing', () => {
		const { opened, off } = board();
		['é', '~', '`', ' ', 'Tab', 'Shift', 'F5'].forEach((key) => press(key));
		expect(opened).toEqual([]);
		expect(showing()).toBeNull();
		off();
	});

	it('nothing with Ctrl or Alt, in a text field, or under a dialog', () => {
		const { opened, off, root } = board();
		press('b', { ctrlKey: true });
		press('b', { altKey: true });
		press('b', { metaKey: true });
		const field = document.createElement('input');
		field.type = 'text';
		root.appendChild(field);
		field.focus();
		press('b');
		field.blur();
		const dialog = document.createElement('dialog');
		dialog.setAttribute('data-anyink-dialog', 'photoDialog');
		dialog.setAttribute('open', '');
		document.body.appendChild(dialog);
		press('b');
		dialog.remove();
		expect(opened).toEqual([]);
		press('b');
		expect(opened).toEqual(['b']);
		off();
	});

	it('nothing off the board, in All tools, or with \'board\' off', () => {
		const { editor, opened, off } = board();
		editor.nav.page = 'Characters';
		press('b');
		editor.nav.page = 'Overview';
		setModeForTests('all');
		press('b');
		setModeForTests('simple');
		setFeaturesForTests({ board: false });
		press('b');
		expect(opened).toEqual([]);
		off();
	});

	it('a held key opens one letter: its repeats stop before the letter view', () => {
		const { off } = board();
		const reached = [];
		const later = (event) => reached.push(event.key);
		document.addEventListener('keydown', later);
		press('b');
		press('b', { repeat: true });
		press('b', { repeat: true });
		document.dispatchEvent(new KeyboardEvent('keyup', { key: 'b', bubbles: true }));
		press('v');
		document.removeEventListener('keydown', later);
		// the first press reached the page (it opened b); the repeats never did; keys after the
		// key went up are ordinary again
		expect(reached).toEqual(['b', 'v']);
		off();
	});
});

describe('arrows move, Enter opens', () => {
	it('from the last touched tile: right, left, and the ends stay put', () => {
		const { opened, tiles, off } = board({ last: 'C' });
		press('ArrowRight');
		expect(focusedChar()).toBe('D');
		expect(tiles.filter((t) => t.getAttribute('tabindex') === '0').map((t) => t.dataset.anyinkChar))
			.toEqual(['D']);
		// one green ring: it moved with the arrow
		expect(tiles.filter((t) => t.hasAttribute('last-touched')).map((t) => t.dataset.anyinkChar))
			.toEqual(['D']);
		press('ArrowLeft');
		press('ArrowLeft');
		press('ArrowLeft');
		press('ArrowLeft');
		expect(focusedChar()).toBe('A');
		press('Enter');
		expect(opened).toEqual(['A']);
		off();
	});

	it('a tile a filter hides is passed over', () => {
		const { tiles, off } = board({ last: 'C' });
		tiles[3].hidden = true; // D
		tiles[4].parentElement.insertBefore(document.createElement('div'), tiles[4]);
		const cell = document.createElement('div');
		cell.style.display = 'none';
		tiles[4].replaceWith(cell);
		cell.appendChild(tiles[4]); // E, inside a hidden cell
		press('ArrowRight');
		expect(focusedChar()).toBe('F');
		off();
	});

	it('nothing touched yet: the first arrow lands on the first tile; Space opens it too', () => {
		const { opened, off } = board();
		const event = press('ArrowDown');
		expect(event.defaultPrevented).toBe(true);
		expect(focusedChar()).toBe('A');
		press(' ');
		expect(opened).toEqual(['A']);
		off();
	});

	it('up and down go to the nearest tile in the next row', () => {
		const { tiles, off } = board({ last: 'C' });
		// 10 tiles a row, 100 px apart
		tiles.forEach((tile, i) => {
			const x = (i % 10) * 100;
			const y = Math.floor(i / 10) * 120;
			tile.getBoundingClientRect = () => ({ left: x, top: y, right: x + 96, bottom: y + 112, width: 96, height: 112 });
		});
		press('ArrowDown');
		expect(focusedChar()).toBe('M');
		press('ArrowDown');
		expect(focusedChar()).toBe('W');
		press('ArrowUp');
		expect(focusedChar()).toBe('M');
		off();
	});

	it('Enter with nothing focused opens the last touched tile; on a button it is the button\'s', () => {
		const { opened, root, off } = board({ last: 'e' });
		press('Enter');
		expect(opened).toEqual(['e']);
		const button = document.createElement('button');
		root.appendChild(button);
		button.focus();
		press('Enter');
		press('ArrowRight');
		expect(opened).toEqual(['e']);
		expect(document.activeElement).toBe(button);
		off();
	});
});

describe('nextTileIndex (pure)', () => {
	const grid = (count, perRow) =>
		Array.from({ length: count }, (_, i) => {
			const x = (i % perRow) * 100;
			const y = Math.floor(i / perRow) * 120;
			return { left: x, top: y, right: x + 96, bottom: y + 112, width: 96, height: 112 };
		});

	it('left and right step through the order and stop at its ends', () => {
		const rects = grid(5, 5);
		expect(nextTileIndex(rects, 2, { dx: 1, dy: 0 })).toBe(3);
		expect(nextTileIndex(rects, 4, { dx: 1, dy: 0 })).toBe(4);
		expect(nextTileIndex(rects, 0, { dx: -1, dy: 0 })).toBe(0);
		expect(nextTileIndex(rects, -1, { dx: 1, dy: 0 })).toBe(0);
	});

	it('down and up: the next row, the nearest across; a short row takes its last tile', () => {
		// rows of 10, then a row of 6 (punctuation)
		const rects = grid(16, 10);
		expect(nextTileIndex(rects, 3, { dx: 0, dy: 1 })).toBe(13);
		expect(nextTileIndex(rects, 8, { dx: 0, dy: 1 })).toBe(15);
		expect(nextTileIndex(rects, 15, { dx: 0, dy: 1 })).toBe(15);
		expect(nextTileIndex(rects, 13, { dx: 0, dy: -1 })).toBe(3);
		expect(nextTileIndex(rects, 3, { dx: 0, dy: -1 })).toBe(3);
	});
});
