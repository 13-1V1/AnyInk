// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12: "Gaps you fixed (2)" in Try it (UX-BEGINNER.md 4.6; 7.3). A closed section, hidden while
	the font has no gap fix; each fix as words ("en" closer / further, the pair shown as a quote,
	since it is his letters, not a word); [x] takes it away (gap_handle.js removeGapFix: one
	whole-font step, an Undo toast). It follows the font on 'kernPairs' (every gap change and every
	whole-font Undo publishes it).
	B12 fix pass: only the gap fixes Simple made, between two letters with ink (listedGapFixes);
	the pair in quotes and the whole phrase ('"ol" further apart'); with no gap fix the row keeps
	its place (visibility hidden, class is-empty), so the first fix never pushes the words on the
	sheet; it follows the font on release (a 'kernPairs' tick with dragging true is skipped), so
	nothing comes or changes under the pointer while a gap is dragged.

	  listedGapFixes(project)      kern_lookup.js onePairFixes, both letters with ink
	  makeGapList({ getEditor })   { element (<details>), refresh(), detach() }
	  installGapList(controller)   puts it in Try it's 'gaps' slot (expand.js) and keeps it fresh
	                               while Try it is open; returns an uninstall function
*/
import { hasInk } from '../board/letter_set.js';
import { onePairFixes } from '../kerning/kern_lookup.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { letterPhrase } from '../words/letter_name.js';
import { wordHTML } from '../words/word_html.js';
import { word } from '../words/words.js';
import { removeGapFix } from './gap_handle.js';

const SUBSCRIBER_ID = 'anyink.gapList.refresh';
/** expand.js TRY_IT_CHANGE_EVENT (not imported: expand.js may import this file) */
export const TRY_IT_CHANGE = 'anyink-try-it-change';
const STYLE_ID = 'anyink-gap-list-style';
const STYLE = `
.anyink-gap-list summary { cursor: pointer; }
.anyink-gap-list.is-empty { visibility: hidden; }
.anyink-gap-list ul { list-style: none; margin: 4px 0 0; padding: 0 0 0 18px; }
.anyink-gap-list li { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.anyink-gap-list li button {
	border: 1px solid var(--chrome-border-strong);
	background: transparent;
	color: inherit;
	border-radius: var(--radius);
	padding: 0 6px;
	cursor: pointer;
}
`;

/** @returns {String} the character a kern hex stands for */
function charOf(hex) {
	const code = parseInt(String(hex).replace(/^0x/i, ''), 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}

/**
 * The gap fixes "Gaps you fixed" and the Word note count: Simple's own, between two letters
 * that have ink.
 * @param {Object} project
 * @returns {Array<{groupID: String, left: String, right: String, value: Number}>}
 */
export function listedGapFixes(project) {
	const glyphs = project?.glyphs || {};
	return onePairFixes(project).filter(
		(fix) => hasInk(glyphs[`glyph-${fix.left}`]) && hasInk(glyphs[`glyph-${fix.right}`])
	);
}

/**
 * @param {{getEditor: () => Object}} options
 * @returns {{element: HTMLDetailsElement, refresh: Function, detach: Function}}
 */
export function makeGapList({ getEditor }) {
	injectStyleOnce(STYLE_ID, STYLE);
	const details = document.createElement('details');
	details.className = 'anyink-gap-list';
	const summary = document.createElement('summary');
	const list = document.createElement('ul');
	details.append(summary, list);
	let attached = null;

	const refresh = () => {
		const editor = getEditor();
		attach(editor);
		const fixes = listedGapFixes(editor?.project);
		const empty = fixes.length === 0;
		// the row keeps its place with nothing in it: the words on the sheet never move for it
		details.classList.toggle('is-empty', empty);
		if (empty) {
			details.open = false;
			details.setAttribute('aria-hidden', 'true');
		} else details.removeAttribute('aria-hidden');
		summary.tabIndex = empty ? -1 : 0;
		summary.textContent = word('tryitGaps.list.title', { count: fixes.length });
		list.replaceChildren(...fixes.map((fix) => row(fix)));
	};

	const row = (fix) => {
		const left = charOf(fix.left);
		const right = charOf(fix.right);
		let key = 'tryitGaps.list.even';
		if (fix.value < 0) key = 'tryitGaps.list.closer';
		if (fix.value > 0) key = 'tryitGaps.list.further';
		const names = {
			left: letterPhrase(left) || left,
			right: letterPhrase(right) || right,
		};
		const li = document.createElement('li');
		const text = document.createElement('span');
		text.innerHTML = wordHTML(key, { pair: `${left}${right}` }, ['pair']);
		text.title = word(`${key}Names`, names);
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = '×';
		const label = word('tryitGaps.list.remove', names);
		remove.setAttribute('aria-label', label);
		remove.title = label;
		remove.addEventListener('click', () => {
			const editor = getEditor();
			if (editor) removeGapFix(editor, fix.left, fix.right);
			refresh();
		});
		li.append(text, remove);
		return li;
	};

	function attach(editor) {
		if (!editor || editor === attached || typeof editor.subscribe !== 'function') return;
		detach();
		attached = editor;
		editor.subscribe({
			topic: 'kernPairs',
			subscriberID: SUBSCRIBER_ID,
			// a live drag tick changes nothing here: the list follows the step on release
			callback: (payload) => {
				if (payload?.dragging) return;
				refresh();
			},
		});
	}
	function detach() {
		attached?.unsubscribe?.({ idToRemove: SUBSCRIBER_ID });
		attached = null;
	}

	refresh();
	return { element: details, refresh, detach };
}

/**
 * @param {{slots: Object<String, HTMLElement>, strip?: Object}} controller - expand.js makeTryIt
 * @param {{win?: Window}} [options]
 * @returns {Function} uninstall
 */
export function installGapList(controller, { win = globalThis } = {}) {
	const slot = controller?.slots?.gaps;
	if (!slot) return () => {};
	const list = makeGapList({ getEditor: () => controller.strip?.editor });
	slot.replaceChildren(list.element);
	const onChange = (event) => {
		if (event?.detail?.open) list.refresh();
		else list.detach();
	};
	win.addEventListener?.(TRY_IT_CHANGE, onChange);
	return () => {
		win.removeEventListener?.(TRY_IT_CHANGE, onChange);
		list.detach();
		list.element.remove();
	};
}
