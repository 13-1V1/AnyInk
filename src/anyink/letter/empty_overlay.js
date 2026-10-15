// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: the box in the middle of an empty letter's canvas (UX-BEGINNER.md 4.3 "Empty letter").
	  +-------------------------------+
	  |  Capital B is empty.          |
	  |  [ Draw it with points ]      |   <- the screen's one green button (principle 1)
	  +-------------------------------+
	Its first button is the green one (.anyink-primary); any others are outlined. The card has no
	buttons on an empty letter, so nothing on screen is repeated (letter_card.js).
	What it offers grows with the Bs (principle 8):
	  now (B7)        "Draw it with points": picks the Point pen, a tool inside Fine-tune, so
	                  Fine-tune opens too (7.6)
	  'brush' (B8)    "Draw with the brush" in its place
	  'photo' (B9)    B9 puts its own first: [Use the same photo] / [Use a photo], [Choose another
	                  photo...], "or drop a photo here", "No photo yet? How to take one"; while
	                  the photo card runs the box hides
	It shows only in the letter view, on an empty letter, and steps aside while a shape tool
	(Point pen, Rectangle, Oval) is picked: he has chosen how to draw, and the box must not sit
	where he clicks. Picking Select again on the still-empty letter brings it back. It is laid
	over the canvas's grid cell (letter.css), so it never moves the canvas or what the canvas
	positions itself. Empty means no finished shape (board/letter_set.js isEmptyLetter, the one
	rule the rail, the Next line and the card read): the shape the Point pen is still drawing
	isn't one yet. B6 + B7 finalize: a letter whose only shape is a stray line of two clicked
	points is not empty (the card says "Empty", since it holds no ink, and lists the shape): the
	box steps aside so the Next line's [Fix it] for that shape is the screen's green button.
	Fix pass, one green button (principle 1): while a dialog is open (coach/dom_probe.js: the
	error box under the save pill's [Fix], the How card, upstream's modal) the dialog holds the
	green button, so the box's first button is outlined until it closes. The box watches the page
	for dialogs coming and going while it is on screen, and lets go once its page is gone.

	  overlayButtons(isOn)     ['drawBrush'?] or ['drawPoints']
	  overlayShows(editor)     true while the box shows
	  makeEmptyOverlay(editor) the box; follows the editor (subscriber 'anyink.letter.overlay')
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { selectTool } from '../../edit_canvas/tools/tools.js';
import { openDialogName } from '../coach/dom_probe.js';
import { isFeatureOn } from '../mode/features.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { isEmptyLetter } from '../board/letter_set.js';
import { openPathOf } from '../coach/open_shape.js';
import { isLetterViewOn, setFineTuneOpen } from './view_switches.js';

export const OVERLAY_SUBSCRIBER = 'anyink.letter.overlay';

/** Shape tools: picking one means he has chosen how to draw */
const SHAPE_TOOLS = Object.freeze(['newPath', 'newRectangle', 'newOval', 'pathAddPoint']);

const TOPICS = ['currentItem', 'whichGlyphIsSelected', 'whichToolIsSelected', 'traceLayer'];

/** Each button: its words and what it does */
const BUTTONS = Object.freeze({
	drawPoints: {
		key: 'letter.overlay.drawPoints',
		run: (editor) => {
			setFineTuneOpen(true, editor);
			selectTool('newPath');
		},
	},
	drawBrush: { key: 'letter.overlay.drawBrush', run: () => selectTool('nib') },
});

/**
 * @param {(flag: String) => Boolean} [isOn]
 * @returns {Array<'drawPoints' | 'drawBrush'>}
 */
export function overlayButtons(isOn = isFeatureOn) {
	const buttons = [];
	if (isOn('brush')) buttons.push('drawBrush');
	if (!buttons.length) buttons.push('drawPoints');
	return buttons;
}

/**
 * @param {Object} [editor]
 * @returns {Boolean}
 */
export function overlayShows(editor = getCurrentProjectEditor()) {
	if (!isLetterViewOn() || editor?.nav?.page !== 'Characters') return false;
	const item = openLetter(editor);
	if (!item || !isEmptyLetter(item, { open: openPathOf(editor) })) return false;
	return !SHAPE_TOOLS.includes(editor.selectedTool);
}

/**
 * @param {Object} [editor]
 * @returns {HTMLElement}
 */
export function makeEmptyOverlay(editor = getCurrentProjectEditor()) {
	const overlay = makeElement({
		tag: 'div',
		className: 'anyink-empty-overlay',
		attributes: { 'data-anyink-overlay': '' },
	});
	const view = { editor, overlay, signature: '', lookAgain: false, observer: null, placed: false };
	update(view);
	editor.subscribe({
		topic: TOPICS,
		subscriberID: OVERLAY_SUBSCRIBER,
		callback: () => follow(view),
	});
	watchForDialogs(view);
	return overlay;
}

/**
 * Updates the box for what the editor said, and once more when the press that said it is done
 * (the Point pen says it switched tools before it lets go of the shape it closed).
 */
function follow(view) {
	if (!view.overlay.isConnected) return;
	update(view);
	if (view.lookAgain) return;
	view.lookAgain = true;
	queueMicrotask(() => {
		view.lookAgain = false;
		if (view.overlay.isConnected) update(view);
	});
}

/**
 * Watches the page for a dialog opening or closing, so the box's first button gives up the
 * green while one is open. Lets go once the box has been on the page and is gone (its page was
 * drawn again).
 */
function watchForDialogs(view) {
	const body = view.overlay.ownerDocument?.body;
	if (typeof MutationObserver === 'undefined' || !body) return;
	view.observer = new MutationObserver((records) => {
		const { overlay } = view;
		if (!overlay.isConnected) {
			if (view.placed) view.observer.disconnect();
			return;
		}
		view.placed = true;
		if (overlay.hidden) return;
		if (records.every((record) => overlay.contains(record.target))) return;
		markGreen(view);
	});
	view.observer.observe(body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['hidden', 'open', 'style', 'class', 'data-anyink-hidden'],
	});
}

/** The first button is the screen's green one, unless an open dialog holds it (principle 1). */
function markGreen(view) {
	const first = view.overlay.querySelector('[data-anyink-overlay-action]');
	if (!first) return;
	const dialog = !!openDialogName(view.overlay.ownerDocument);
	first.classList.toggle('anyink-primary', !dialog);
	first.classList.toggle('anyink-outlined', dialog);
}

/** Shows or hides the box, and draws it again for another letter. */
function update(view) {
	const { editor, overlay } = view;
	const shows = overlayShows(editor);
	overlay.hidden = !shows;
	if (overlay.isConnected) view.placed = true;
	const name = letterName(charOf(editor)) || word('check.aLetter');
	const buttons = overlayButtons();
	const signature = JSON.stringify([name, buttons]);
	if (signature === view.signature) {
		if (shows) markGreen(view);
		return;
	}
	view.signature = signature;

	overlay.innerHTML = '';
	const box = makeElement({ tag: 'div', className: 'anyink-empty-overlay__box' });
	const title = makeElement({ tag: 'p', className: 'anyink-empty-overlay__title' });
	title.textContent = word('letter.overlay.empty', { name });
	box.setAttribute('role', 'region');
	box.setAttribute('aria-label', title.textContent);
	box.appendChild(title);
	buttons.forEach((id, index) => {
		const { key, run } = BUTTONS[id];
		const button = makeElement({
			tag: 'button',
			className: index === 0 ? 'anyink-primary' : 'anyink-outlined',
			attributes: { type: 'button', 'data-anyink-overlay-action': id },
		});
		button.textContent = word(key);
		const hint = wordEntry(key)?.hint;
		if (hint) button.title = hint;
		button.addEventListener('click', () => run(editor));
		box.appendChild(button);
	});
	overlay.appendChild(box);
	if (shows) markGreen(view);
}

/** The open letter, looked up without making one */
function openLetter(editor) {
	const id = editor?.selectedGlyphID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	return editor.project.getItem(id) || null;
}

function charOf(editor) {
	const item = openLetter(editor);
	if (item?.char) return item.char;
	const code = parseInt(String(editor?.selectedGlyphID || '').replace(/^glyph-/, ''), 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}
