// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: the letter view's header row (UX-BEGINNER.md 4.3): it takes the place of the left area's
	PAGE / EDITING / PANEL buttons in Simple.
	  [<- All letters]   Capital B
	                     [< A] [C >]
	"<- All letters" goes to the board (the Overview page, where B10 mounts it; until then the
	Overview's own letter tiles): the same place as the top bar's logo and "1 Letters"
	(topbar/letters_page.js goToLetters, one place for all three; fix pass: the header went to the
	Overview while the rail went to Simple home, the letter view itself). The name comes from
	letterName (2.2). "< A" / "C >" open the
	previous or next letter in the board's order, round the ends; a letter the board doesn't
	show (one made in More tools) has neither, only the way back. Opening a letter is looking
	around, never an Undo step (7.3): the letter is picked the way the letter chooser picks it,
	and in Simple its record is made with no history entry (B2).

	  boardOrder(project)          the board's letters in order (4.2): the Quick font, A to Z,
	                               a to z, . , ' ? ! -, then the numbers and symbols when
	                               settings.anyink.letterSet is 'quick+numbers'. B10's board
	                               should own this list; the header then imports it from there
	  stepLetter(project, char, step)   the letter step places away (-1, 1), or null
	  letterIdOf(char)             'glyph-0x42'
	  makeLetterHeader(editor)     the header; it follows the open letter ('whichGlyphIsSelected',
	                               subscriber 'anyink.letter.header')
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { charToHex } from '../../common/character_ids.js';
import { makeElement } from '../../common/dom.js';
import { boardLetters, NUMBERS_SET, QUICK_SET } from '../board/letter_set.js';
import { goToLetters } from '../topbar/letters_page.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';

/** 4.2: the Quick font, 58 letters (board/letter_set.js, one copy for the app) */
export const QUICK_FONT = QUICK_SET;

/** 4.2: "+ Numbers & symbols" */
export const NUMBERS_AND_SYMBOLS = NUMBERS_SET;

export const HEADER_SUBSCRIBER = 'anyink.letter.header';

/**
 * @param {Object} project - reads settings.anyink.letterSet
 * @returns {Array<String>}
 */
export function boardOrder(project) {
	return boardLetters(project);
}

/**
 * @param {Object} project
 * @param {String} char - the open letter
 * @param {Number} step - -1 for the previous letter, 1 for the next
 * @returns {String | null} null for a letter the board doesn't show
 */
export function stepLetter(project, char, step) {
	const order = boardOrder(project);
	const at = order.indexOf(char);
	if (at < 0) return null;
	return order[(at + step + order.length) % order.length];
}

/**
 * @param {String} char
 * @returns {String} the letter's record id
 */
export function letterIdOf(char) {
	return `glyph-${charToHex(char)}`;
}

/**
 * @param {Object} [editor] - default: the current project editor
 * @returns {HTMLElement}
 */
export function makeLetterHeader(editor = getCurrentProjectEditor()) {
	const header = makeElement({ tag: 'div', className: 'anyink-letter-header' });
	fill(header, editor);
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: HEADER_SUBSCRIBER,
		callback: () => {
			if (header.isConnected) fill(header, editor);
		},
	});
	return header;
}

/** Draws the header for the open letter. */
function fill(header, editor) {
	header.innerHTML = '';
	const char = charOf(editor);

	const back = button('back', word('letter.back'), () => goToLetters(editor));
	back.title = hintOf('letter.back');
	header.appendChild(back);

	const name = makeElement({
		tag: 'h2',
		className: 'anyink-letter-header__name',
		attributes: { 'data-anyink-letter': 'name' },
	});
	name.textContent = letterName(char) || word('check.aLetter');
	header.appendChild(name);

	const previous = stepLetter(editor.project, char, -1);
	const next = stepLetter(editor.project, char, 1);
	if (previous === null || next === null) return;
	const steps = makeElement({ tag: 'div', className: 'anyink-letter-header__steps' });
	steps.appendChild(stepButton('previous', 'letter.goPrevious', previous, editor));
	steps.appendChild(stepButton('next', 'letter.goNext', next, editor));
	header.appendChild(steps);
}

/**
 * @param {String} part - 'previous' | 'next'
 * @param {String} key - the words for the button
 * @param {String} char - the letter it opens
 * @param {Object} editor
 * @returns {HTMLElement}
 */
function stepButton(part, key, char, editor) {
	const go = button(part, word(key, { char }), () => {
		editor.selectedGlyphID = letterIdOf(char);
	});
	go.title = word('letter.goTo', { name: letterName(char) });
	go.setAttribute('aria-label', go.title);
	return go;
}

/**
 * @param {String} part - data-anyink-letter
 * @param {String} text
 * @param {Function} onClick
 * @returns {HTMLElement}
 */
function button(part, text, onClick) {
	const element = makeElement({
		tag: 'button',
		className: `anyink-letter-header__${part}`,
		attributes: { type: 'button', 'data-anyink-letter': part },
	});
	element.textContent = text;
	element.addEventListener('click', onClick);
	return element;
}

/** The open letter's character, '' when there is none */
function charOf(editor) {
	const id = editor?.selectedGlyphID;
	const item = id ? editor.project?.getItem?.(id) : null;
	if (item?.char) return item.char;
	const hex = typeof id === 'string' ? id.replace(/^glyph-/, '') : '';
	const code = parseInt(hex, 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}

/**
 * @param {String} key
 * @returns {String} the words' hint, '' for none
 */
function hintOf(key) {
	return wordEntry(key)?.hint || '';
}
