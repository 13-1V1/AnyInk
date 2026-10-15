// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-ui: the How card (docs/UX-BEGINNER.md 4.4 "The How card", section 3 at 0:01 and 0:02).
	How to get a good photo of his letters, before the computer does anything:
	  How to photograph your letters                                   [x]
	  1. Use a black felt-tip pen (a Sharpie works) on plain white printer paper, not lined
	     notebook paper.
	  2. Write every letter about 1 inch tall, all the same size, with a finger's width between
	     letters, a thumb's width between rows.
	  3. For a first try, write the letters in "Brennan Hand" once each: B r e n a H d. Or write
	     the whole alphabet: capitals in rows, then small letters in rows, then . , ' ? ! -
	  4. Lay the page flat in even light. Hold the phone straight above it and take one photo.
	     More than one page? Take one photo of each.
	  5. Get the photo onto this PC: email it to yourself, or use Phone Link, and save it to
	     Downloads.
	  [ I have my photo ]  (green)                     [ Close ]
	Step 3 names the letters of the Try-it text once each (it starts as the font name, so on the
	main path every Try-it letter is in the photo, 4.0); with none, it asks for the whole alphabet.
	Fix pass (first-timer finding 4): 4.4's "on one page: capitals on one line, small letters on
	the next" asked for about 30 in of line (26 one-inch capitals a finger apart) on an 8.5 in
	page, and lined notebook paper, which many people grab, made most of the junk parts: printer
	paper, rows, and a photo of each page. The x is the shell's (photo_dialog.css: scoped so
	upstream's button:hover resets can't move it out from under the pointer).
	It is an ANY-INK dialog (coach rule 1: the Next line steps aside; editor keys blocked), shown
	only in Simple with 'photo' on. Opened by rule 11's [How], "No photo yet? How to take one" (the
	empty-letter overlay, the photo card's step A) and Help; the opener says what [I have my photo]
	does.

	  openHowCard({ text, onHavePhoto, onClose })   the card, or null (not Simple, 'photo' off)
	    text         the Try-it text (default: the coach's, coach/font_facts.js defaultTryItText)
	    onHavePhoto()  [I have my photo]: opens the picker. Called inside the press, before any
	                 await, so the browser keeps the click (the picker needs it). It may return a
	                 Promise: false (the picker was cancelled) keeps the card open, anything else
	                 closes it; a plain return closes it at once (false keeps it). A photo dialog
	                 the flow opens in its place closes it too.
	    onClose()    Close, the x or Escape
	  closeHowCard()     closes it without calling onClose
	  isHowCardOpen()
	  howLetters(text)   the text's letters once each, in order, no spaces ('Brennan Hand' ->
	                     B r e n a H d)
	  HOW_CARD_NAME      'howCard' (data-anyink-dialog)
	Words: photo.how.* (words/sets/photo.js). Look: how_card.css and the shared modal shell
	(photo_dialog.css), tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { defaultTryItText } from '../coach/font_facts.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { word, wordEntry } from '../words/words.js';
import { openModal } from './photo_dialog.js';
import './how_card.css';

export const HOW_CARD_NAME = 'howCard';

/** Step 3 lists at most this many letters; a longer text asks for the whole alphabet. */
export const MAX_FIRST_TRY = 20;

/** @type {Object | null} */
let current = null;

/**
 * @param {String} text
 * @returns {Array<String>} its letters once each, in order, no spaces
 */
export function howLetters(text) {
	const seen = [];
	for (const char of Array.from(String(text ?? ''))) {
		if (char.trim() && !seen.includes(char)) seen.push(char);
	}
	return seen;
}

/**
 * @param {{text?: String, onHavePhoto?: Function, onClose?: Function}} [options]
 * @returns {{element: HTMLElement, close: Function} | null}
 */
export function openHowCard({ text, onHavePhoto, onClose } = {}) {
	if (!isSimpleMode() || !isFeatureOn('photo')) return null;
	const tryItText = text === undefined ? currentTryItText() : String(text ?? '');
	const titleId = 'anyink-how-card-title';
	const modal = openModal({
		name: HOW_CARD_NAME,
		className: 'anyink-how-card',
		labelledBy: titleId,
		onCancel: () => {
			try {
				onClose?.();
			} catch (error) {
				console.warn('ANY-INK How card: onClose failed', error);
			}
		},
	});
	const { dialog } = modal;

	const head = el('div', 'anyink-modal__head');
	head.appendChild(el('h2', 'anyink-modal__title', { id: titleId }, word('photo.how.title')));
	const x = el('button', 'anyink-modal__close', {
		type: 'button',
		'aria-label': word('photo.how.close'),
		'data-anyink-how-action': 'x',
	});
	x.textContent = '×';
	x.addEventListener('click', () => modal.cancel());
	head.appendChild(x);

	const steps = el('ol', 'anyink-how-card__steps');
	stepTexts(tryItText).forEach((parts) => {
		const item = el('li', 'anyink-how-card__step');
		parts.forEach((part, i) => {
			if (i) item.appendChild(globalThis.document.createTextNode(' '));
			item.appendChild(el('span', '', {}, part));
		});
		steps.appendChild(item);
	});

	const row = el('div', 'anyink-modal__buttons');
	const have = button('havePhoto', 'photo.how.havePhoto', 'primary');
	have.addEventListener('click', () => havePhoto(modal, onHavePhoto));
	const close = button('close', 'photo.how.close', 'outlined');
	close.classList.add('anyink-modal__button--end');
	close.addEventListener('click', () => modal.cancel());
	row.append(have, close);

	dialog.append(head, steps, row);
	const view = { element: dialog, close: () => modal.close() };
	current = { modal, view };
	modal.cleanups.push(() => {
		if (current?.modal === modal) current = null;
	});
	modal.show(have);
	return view;
}

/** Closes the How card without calling onClose. */
export function closeHowCard() {
	current?.modal.close();
}

/** @returns {Boolean} */
export function isHowCardOpen() {
	return !!current && !current.modal.closed;
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** @returns {Array<Array<String>>} each step's sentences */
function stepTexts(text) {
	const letters = howLetters(text);
	const firstTry =
		letters.length && letters.length <= MAX_FIRST_TRY
			? [
					word('photo.how.firstTry', { text: text.trim(), letters: letters.join(' ') }),
					word('photo.how.orAlphabet'),
			  ]
			: [word('photo.how.alphabet')];
	return [
		[word('photo.how.pen')],
		[word('photo.how.size')],
		firstTry,
		[word('photo.how.light')],
		[word('photo.how.transfer')],
	];
}

/** [I have my photo]: the picker opens in the press; the card goes once a photo came. */
function havePhoto(modal, onHavePhoto) {
	let result;
	try {
		result = onHavePhoto?.();
	} catch (error) {
		console.warn('ANY-INK How card: the photo could not be picked', error);
		return;
	}
	if (result && typeof result.then === 'function') {
		result.then(
			(picked) => {
				if (picked !== false) modal.close();
			},
			() => {}
		);
		return;
	}
	if (result !== false) modal.close();
}

/** The Try-it text the Next line works from (the font name until he types another). */
function currentTryItText() {
	try {
		return defaultTryItText(getCurrentProjectEditor()?.project);
	} catch {
		return '';
	}
}

function el(tag, className, attributes = {}, text = '') {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	if (text) element.textContent = text;
	return element;
}

function button(name, key, kind) {
	const element = el('button', `anyink-modal__button anyink-${kind}`, {
		type: 'button',
		'data-anyink-how-action': name,
	});
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}
