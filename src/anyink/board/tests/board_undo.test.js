// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: Undo on the board stays on the board (UX-BEGINNER.md 4.2 "Undo on the board
	undoes the newest change without leaving the board: 'Undid: traced B [Show me]'", 7.3; section
	10 B10 "Undo on the board stays on the board"). Simple with the flags as the app ships them and
	'board' on, Ctrl+Z (the app's own key handler) and the top bar's Undo:
	  - a letter's step (traced, drawn): the board stays, the letter changes back, the toast names
	    it with [Show me], which opens it
	  - a whole-font step about no letter (the letter spacing): the board stays
	  - the letter set's settings step: the board stays (also letter_set_numbers.test.js)
	  - Redo on the board stays too
	These pin what B2 and B6 already did (simple_undo.js: off a letter view the view stays) now
	that the board is the Overview; they passed when written.
*/
import { describe, expect, it } from 'vitest';
import { handleKeyPress } from '../../../edit_canvas/events_keyboard.js';
import { pressRedo, pressUndo } from '../../history/undo_toast.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { word } from '../../words/words.js';
import {
	letterPage,
	setUpScreenTests,
	showing,
	shownText,
	square,
} from '../../letter/tests/simple_screen.js';
import { setNumbersShown } from '../letter_set.js';

setUpScreenTests();

function key(keyName, init = {}) {
	const event = new KeyboardEvent('keydown', {
		key: keyName,
		bubbles: true,
		cancelable: true,
		...init,
	});
	handleKeyPress(event);
	return event;
}

/** small b traced, then back on the board (the Overview), as "<- All letters" leaves it */
function tracedThenBoard() {
	setFeaturesForTests({ board: true });
	const editor = letterPage({ id: 'glyph-0x62' });
	editor.selectedItem.addOneShape(square(100, 0, 500));
	editor.history.addState('traced small b');
	editor.nav.page = 'Overview';
	return editor;
}

describe('Undo on the board stays on the board', () => {
	it('Ctrl+Z: the letter changes back, the board stays, "Undid: traced small b" [Show me]', () => {
		const editor = tracedThenBoard();
		key('z', { ctrlKey: true });
		expect(editor.nav.page).toBe('Overview');
		expect(editor.project.getItem('glyph-0x62').shapes).toHaveLength(0);
		expect(shownText()).toBe(word('undo.undid', { change: 'traced small b' }));
		const showMe = showing().querySelector('button');
		expect(showMe.textContent).toBe(word('check.showMe'));
		showMe.click();
		expect(editor.nav.page).toBe('Characters');
		expect(editor.selectedItemID).toBe('glyph-0x62');
	});

	it('Redo on the board stays on the board too', () => {
		const editor = tracedThenBoard();
		pressUndo(editor);
		pressRedo(editor);
		expect(editor.nav.page).toBe('Overview');
		expect(editor.project.getItem('glyph-0x62').shapes).toHaveLength(1);
	});

	it('a whole-font step about no letter (the letter spacing): the board stays', () => {
		const editor = tracedThenBoard();
		editor.history.addWholeProjectChangePreState('moved all letters closer', { itemID: null });
		editor.project.getItem('glyph-0x62').advanceWidth = 900;
		editor.history.addWholeProjectChangePostState({ itemID: null });
		pressUndo(editor);
		expect(editor.nav.page).toBe('Overview');
		expect(editor.project.getItem('glyph-0x62').advanceWidth).not.toBe(900);
	});

	it('the letter set\'s step: the board stays', () => {
		const editor = tracedThenBoard();
		setNumbersShown(editor, true);
		key('z', { ctrlKey: true });
		expect(editor.nav.page).toBe('Overview');
		expect(editor.project.settings.anyink.letterSet).toBeUndefined();
	});
});
