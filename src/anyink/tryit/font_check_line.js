// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 (UX-BEGINNER.md 4.6 Font check line): B1's font check as one line at the foot of Try it.
	The check itself is B1's (fontcheck/font_check.js): it runs 2 s after the last change on the
	real exporter's list of letters for the whole font, not only the letters on the sheet, and
	publishes 'fontCheck'. This line only says it:
	  - before the first result: "Checking your font..." (never a silent fall-back to nothing)
	  - no problem:               "Your font builds OK."
	  - a problem:                the check's own sentence naming the letter ("small r has a width
	                              the font file can't hold."), how many more need fixing, and
	                              [Fix it] when fix_it.js has a safe fix, else [Show me] and what
	                              to do (font_status.js hintFor).
	Its buttons are outlined: [Done] is Try it's one green button (principle 1).

	  fontCheckLineState(payload, { project, canFix })  -> { kind, text, more, hint, itemId,
	                                                     problem, fixable }
	  makeFontCheckLine({ onFixIt, onShowMe, doc })     -> { element, update(state), state }
*/
import { canFixProblem } from '../preview/fix_it.js';
import { firstCheckProblem, hintFor, isGapId, moreText } from '../preview/font_status.js';
import { word, wordEntry } from '../words/words.js';

/**
 * @param {{problems?: Array}|null|undefined} payload - the last 'fontCheck' result, null before
 *   the first one
 * @param {{project?: Object, canFix?: Function}} [options]
 * @returns {{kind: 'checking'|'ok'|'problem', text: String, more: String, hint: String,
 *   itemId: String|null, problem: String|null, fixable: Boolean}}
 */
export function fontCheckLineState(payload, { project = null, canFix = canFixProblem } = {}) {
	const quiet = { more: '', hint: '', itemId: null, problem: null, fixable: false };
	if (!payload || typeof payload !== 'object') {
		return { kind: 'checking', text: word('tryit.checking'), ...quiet };
	}
	const first = firstCheckProblem(payload);
	if (!first) return { kind: 'ok', text: word('tryit.checkOk'), ...quiet };
	const fixable = !!canFix(project, first);
	return {
		kind: 'problem',
		text: first.text,
		more: moreText(first.more, first.moreGaps, isGapId(first.itemId)),
		hint: hintFor(first.problem, fixable),
		itemId: first.itemId,
		problem: first.problem,
		fixable,
	};
}

/**
 * @param {Object} o
 * @param {(problem: {itemId: String, problem: String}) => void} o.onFixIt
 * @param {(itemId: String) => void} o.onShowMe
 * @param {Document} [o.doc]
 * @returns {{element: HTMLElement, update: Function, state: Object|null}}
 */
export function makeFontCheckLine({ onFixIt, onShowMe, doc = document }) {
	const element = doc.createElement('div');
	element.className = 'anyink-tryit-check';
	element.setAttribute('role', 'status');
	element.setAttribute('aria-live', 'polite');
	element.setAttribute('aria-label', word('tryit.checkLabel'));

	const text = doc.createElement('span');
	text.className = 'anyink-tryit-check__text';
	const more = doc.createElement('span');
	more.className = 'anyink-tryit-check__more';
	element.append(text, more);

	const makeButton = (key) => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'anyink-tryit-check__button';
		button.textContent = word(key);
		button.title = wordEntry(key)?.hint || '';
		button.hidden = true;
		element.appendChild(button);
		return button;
	};
	const fixButton = makeButton('check.fixIt');
	const showButton = makeButton('check.showMe');

	/** @type {Object|null} */
	let state = null;
	fixButton.addEventListener('click', () => {
		if (state?.itemId) onFixIt?.({ itemId: state.itemId, problem: state.problem });
	});
	showButton.addEventListener('click', () => {
		if (state?.itemId) onShowMe?.(state.itemId);
	});

	return {
		element,
		/** @param {ReturnType<typeof fontCheckLineState>} next */
		update(next) {
			state = next || null;
			const kind = state?.kind || 'checking';
			element.dataset.kind = kind;
			text.textContent = [state?.text, state?.hint]
				.map((part) => String(part ?? '').trim())
				.filter(Boolean)
				.join(' ');
			more.textContent = String(state?.more ?? '');
			more.hidden = !more.textContent;
			const problem = kind === 'problem' && !!state?.itemId;
			fixButton.hidden = !(problem && state.fixable);
			showButton.hidden = !(problem && !state.fixable);
		},
		get state() {
			return state;
		},
	};
}
