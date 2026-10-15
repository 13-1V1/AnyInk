// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Simple's error box (UX-BEGINNER.md 7.7 plain error messages, principle 1 one green button;
	B4 + B5 finalize). error_words.js picks the words for what went wrong; this shows them in the
	place upstream's error box shows (#error, so Esc and a page change close it as before): a
	plain title, the one sentence (file and folder names as quotes, word_html.js), and its
	buttons, the first one green and the rest outlined. The browser's own sentence is never
	shown; callers keep it for the console.
	Until B6, B13 and B14 give these their own cards.

	  showWordsError(words, actions)        words: { key, vars, quotes, buttons } from
	                                        error_words.js; actions: { buttonKey: () => void }
	                                        what a button does after the box closes (none:
	                                        it only closes the box)
	  sayError(words, { actions, allTools })   Simple: showWordsError; All tools: upstream's
	                                        showError(allTools) as before (Glyphr Studio's words)
	Buttons carry data-anyink-choice = their words key, for tests and later Bs.
*/
import './error_box.css';
import { addAsChildren, makeElement } from '../../common/dom.js';
import { closeEveryTypeOfDialog, showError } from '../../controls/dialogs/dialogs.js';
import { isSimpleMode } from '../mode/mode.js';
import { escapeWordHTML, wordHTML } from './word_html.js';
import { word } from './words.js';

/**
 * @param {{key: String, vars?: Object, quotes?: Array<String>, buttons?: Array<String>}} words
 * @param {Object<String, Function>} [actions] - what each button does
 * @returns {HTMLElement} the box
 */
export function showWordsError(words, actions = {}) {
	const element = makeElement({ tag: 'div', id: 'error' });
	element.dataset.anyinkError = words.key;
	element.setAttribute('role', 'alertdialog');

	const header = makeElement({
		className: 'error__header',
		innerHTML: `<h3>${escapeWordHTML(word('error.boxTitle'))}</h3>`,
	});
	const close = makeElement({
		tag: 'button',
		innerHTML: '&times;',
		attributes: { 'aria-label': word('error.button.close') },
	});
	close.addEventListener('click', () => closeEveryTypeOfDialog());
	header.appendChild(close);

	const body = makeElement({ className: 'error__body' });
	body.appendChild(
		makeElement({ tag: 'p', innerHTML: wordHTML(words.key, words.vars, words.quotes) })
	);
	const keys = words.buttons || [];
	if (keys.length) {
		const row = makeElement({ className: 'anyink-error__buttons' });
		addAsChildren(
			row,
			keys.map((key, index) => {
				// B6 + B7 finalize: the first is the screen's green button, marked as every other
				// one is, so the Next line and the empty overlay give way to it (principle 1)
				const button = makeElement({
					tag: 'fancy-button',
					className: index === 0 ? 'anyink-primary' : '',
					content: escapeWordHTML(word(key)),
					attributes: {
						'data-anyink-choice': key,
						...(index > 0 ? { secondary: '' } : {}),
					},
				});
				button.addEventListener('click', () => {
					closeEveryTypeOfDialog();
					actions?.[key]?.();
				});
				return button;
			})
		);
		body.appendChild(row);
	}
	addAsChildren(element, [header, body]);

	closeEveryTypeOfDialog();
	document.body.appendChild(element);
	return element;
}

/**
 * The error box in the mode's words.
 * @param {Object} words - from error_words.js
 * @param {{actions?: Object<String, Function>, allTools?: String}} [options] - allTools: the HTML
 *   upstream's box shows in All tools (Glyphr Studio's own words, as before)
 */
export function sayError(words, { actions = {}, allTools = '' } = {}) {
	if (isSimpleMode()) showWordsError(words, actions);
	else showError(allTools);
}
