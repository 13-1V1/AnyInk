// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: the Simple top bar (UX-BEGINNER.md 4.0 "Top bar", 4.11). makeAppTopBar (app/menu.js) draws
	it instead of today's bar in Simple once the 'coach' flag is on; All tools, and Simple before
	B6, keep today's bar exactly.

	  ANY-INK  Brennan Hand  (1 Letters 7/58)--(2 Try it)--(3 Use in Word)  [Undo] [Redo]
	                                                         * Saved  More tools  Menu v
	  Next: ... (row 2: <anyink-coach>, the Next line, B6's coach track)

	  logo        "ANY-INK": goes to the letters (letters_page.js: where the letter view's
	              "<- All letters" goes, the Overview page, where B10 mounts the board; never the
	              letter view he is already in)
	  font name   the font's name; opens Font details once B15 lands (until then it is words only:
	              principle 8, no door to an unbuilt room)
	  rail        "1 Letters 7/58" (ready / total, ready_count.js), outlined green on the board or
	              in a letter; "2 Try it" (B12) and "3 Use in Word" (B14) only once their flags are
	              on. While Try it is open, step 2 is the current step (B12 + B13 integration:
	              tryit/expand.js 'anyink-try-it-change'). Nothing is ever locked. Every step keeps
	              its words down to 1280 px; below that only the current step keeps its name
	              (B16, simple_top_bar.css; tests/rail_words.verify.mjs). The rail ends with the Next
	              line's "Next" chip (coach_element.js makeNextChip), which shows only while he
	              has hidden the line with its "x" (data-anyink-slot="next-chip").
	  Undo, Redo  named in plain words ("Undo: traced Capital B"), with the letter when it isn't
	              the one open ("Undo: added a rectangle on small r", the toast's words: the press
	              will take the view there); greyed with a sentence saying why ("Nothing to undo
	              yet") when there's nothing to act on; a press is named in a toast
	              (history/undo_toast.js). Opening another letter is no save status event, so the
	              tooltips are brought up to date again as the pointer comes over them or on focus
	  status      the pill (status_pill.js): Saved / Saving... / Not saved yet [Save] / Couldn't
	              save [Fix]
	  More tools  All tools on, on the same page, with the purple band (mode/band.js)
	  Menu        Simple's one Menu (simple_menu.js)
	A flexible gap between the rail and Undo is marked data-anyink-slot="notices", for the app
	notices. The bar keeps itself up to date (the font name, the ready count, Undo / Redo, the pill)
	on every save status event, which History's every step, Undo and Redo send (recovery.js
	markDirty); a navigate draws it anew.
	B10 + B11 integration: the ready count counts with the board's own Ready rule
	(board/board_page.js readyRuleFor: ink, and no check that needs a look while 'checks' is on,
	read from the Next line's letters), so the rail, the board and the Next line say one number;
	it is said again whenever the Next line's state changes (the font check's answer comes 2 s
	after a step, with no save status event of its own).

	  useSimpleTopBar()                 true when makeAppTopBar draws this bar
	  makeSimpleTopBar(editor)          the bar (#app__top-bar.anyink-topbar)
	  refreshSimpleTopBar(doc)          brings every Simple top bar on the page up to date
*/
import './simple_top_bar.css';
import { getCurrentProjectEditor } from '../../app/main.js';
import { readyRuleFor } from '../board/board_page.js';
import { makeNextChip } from '../coach/coach_element.js';
import { getCoach } from '../coach/coach_state.js';
import { openPathOf } from '../coach/open_shape.js';
import logoHorizontal from '../../common/graphics/anyink-wordmark-horizontal-small.svg?raw';
import { preloadExportFolder } from '../files/export_folder.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { pressRedo, pressUndo } from '../history/undo_toast.js';
import { turnOnMoreTools } from '../mode/band.js';
import { openUseInWord } from '../mode/doors.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { SKETCH_PIECE_EVENT } from '../sketch/tools/undo_gate.js';
import { TRY_IT_CHANGE_EVENT } from '../tryit/expand.js';
import { word, wordEntry } from '../words/words.js';
import { FONT_DETAILS_EVENT, openDoor, TRY_IT_EVENT } from './doors.js';
import { goToLetters } from './letters_page.js';
import { readyCount } from './ready_count.js';
import { openSimpleMenu } from './simple_menu.js';
import { makeStatusPill, updateStatusPill } from './status_pill.js';
import { undoButtonsState } from './undo_buttons.js';

export const TOPBAR_CLASS = 'anyink-topbar';

/** The pages step 1 (Letters) is current on: the board and the letter view */
const LETTER_PAGES = Object.freeze(['Overview', 'Characters']);

/** Curved arrows, drawn in currentColor; no whitespace, so a button's text is only its words */
const UNDO_ICON =
	'<svg class="anyink-topbar__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5.5 3 2 6.5 5.5 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.5 6.5H10a4 4 0 0 1 0 8H7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const REDO_ICON =
	'<svg class="anyink-topbar__icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M10.5 3 14 6.5 10.5 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 6.5H6a4 4 0 0 0 0 8h3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const MENU_ICON =
	'<svg class="anyink-topbar__icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** @returns {Boolean} */
export function useSimpleTopBar() {
	return isSimpleMode() && isFeatureOn('coach');
}

/** @returns {Object | null} the current project editor, if the app has one */
function currentEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/**
 * @param {String} tag
 * @param {String} [className]
 * @param {Object} [data] - data-* values
 * @returns {HTMLElement}
 */
function el(tag, className = '', data = {}) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	Object.entries(data).forEach(([key, value]) => (element.dataset[key] = value));
	if (tag === 'button') element.type = 'button';
	return element;
}

/**
 * @param {String} key - a words key
 * @returns {String} its hint, or ''
 */
const hintOf = (key) => wordEntry(key)?.hint || '';

// --------------------------------------------------------------
// The pieces
// --------------------------------------------------------------

function makeLogo(bar) {
	const logo = el('button', `${TOPBAR_CLASS}__logo`, { anyinkControl: 'logo' });
	logo.innerHTML = logoHorizontal;
	logo.setAttribute('aria-label', word('topbar.logo'));
	logo.title = hintOf('topbar.logo');
	logo.addEventListener('click', () => goToLetters(bar.editor || currentEditor()));
	return logo;
}

/**
 * @param {Object} editor
 * @returns {String} the font's name, as the bar says it
 */
const fontNameOf = (editor) =>
	word('topbar.fontName', { name: editor?.project?.settings?.project?.name || '' });

function makeFontName(bar, editor) {
	const opens = isFeatureOn('fontDetails');
	const element = el(opens ? 'button' : 'span', `${TOPBAR_CLASS}__font-name`, {
		anyinkControl: 'fontName',
	});
	element.textContent = fontNameOf(editor);
	element.title = opens ? word('topbar.fontDetails') : hintOf('topbar.fontName');
	if (opens) {
		element.addEventListener('click', () => openDoor(FONT_DETAILS_EVENT, { cause: 'fontName' }));
	}
	return element;
}

/**
 * @param {String} id - 'letters' | 'tryIt' | 'useInWord'
 * @param {Number} number
 * @param {String} nameKey
 * @param {Function} onClick
 * @returns {HTMLElement}
 */
function makeStep(id, number, nameKey, onClick) {
	const step = el('button', `${TOPBAR_CLASS}__step`, { anyinkStep: id });
	const numberEl = el('span', `${TOPBAR_CLASS}__step-number`);
	numberEl.textContent = String(number);
	const nameEl = el('span', `${TOPBAR_CLASS}__step-name`);
	nameEl.textContent = word(nameKey);
	step.append(numberEl, nameEl);
	step.title = hintOf(nameKey);
	step.addEventListener('click', onClick);
	return step;
}

function makeLink() {
	const link = el('span', `${TOPBAR_CLASS}__link`);
	link.setAttribute('aria-hidden', 'true');
	return link;
}

function makeRail(bar) {
	// a div, not a <nav>: upstream styles every nav and reads the page's first one (main.js)
	const rail = el('div', `${TOPBAR_CLASS}__rail`, { anyinkControl: 'rail' });
	rail.setAttribute('role', 'navigation');
	rail.setAttribute('aria-label', word('topbar.rail'));
	const letters = makeStep('letters', 1, 'topbar.step.letters', () =>
		goToLetters(bar.editor || currentEditor())
	);
	letters.append(el('span', `${TOPBAR_CLASS}__step-count`));
	rail.append(letters);
	// principle 8: a step shows only once the B that builds its screen has landed
	if (isFeatureOn('tryIt')) {
		rail.append(
			makeLink(),
			makeStep('tryIt', 2, 'topbar.step.tryIt', () => openDoor(TRY_IT_EVENT, { cause: 'rail' }))
		);
	}
	if (isFeatureOn('useInWord')) {
		rail.append(
			makeLink(),
			makeStep('useInWord', 3, 'topbar.step.useInWord', () => openUseInWord('rail'))
		);
	}
	// the Next line's "Next" chip (coach_element.js): shows only while he has hidden the line
	const slot = el('span', `${TOPBAR_CLASS}__next-chip`, { anyinkSlot: 'next-chip' });
	slot.append(makeNextChip());
	rail.append(slot);
	return rail;
}

/**
 * @param {'undo' | 'redo'} kind
 * @param {Object} bar
 * @returns {HTMLElement}
 */
function makeHistoryButton(kind, bar) {
	const button = el('button', `${TOPBAR_CLASS}__${kind}`, { anyinkControl: kind });
	const label = el('span', `${TOPBAR_CLASS}__label`);
	label.textContent = word(kind === 'undo' ? 'topbar.undo' : 'topbar.redo');
	button.innerHTML = kind === 'undo' ? UNDO_ICON : REDO_ICON;
	button.append(label);
	button.addEventListener('click', () => {
		// greyed: the tooltip says why; the press does nothing (principle 6)
		if (button.getAttribute('aria-disabled') === 'true') return;
		const editor = bar.editor || currentEditor();
		if (kind === 'undo') pressUndo(editor);
		else pressRedo(editor);
	});
	// the open letter can change with no event the bar hears ("< A" / "C >", the chooser): the
	// tooltip is said again just before it shows
	const update = () => refreshHistoryButtons(bar, bar.editor || currentEditor());
	button.addEventListener('pointerenter', update);
	button.addEventListener('focus', update);
	return button;
}

function makeMoreTools(bar) {
	const button = el('button', `${TOPBAR_CLASS}__more-tools`, { anyinkControl: 'moreTools' });
	button.textContent = word('term.moreTools');
	button.title = word('topbar.moreToolsTip');
	button.addEventListener('click', () =>
		turnOnMoreTools({ editor: bar.editor || currentEditor() })
	);
	return button;
}

function makeMenuButton(bar) {
	const button = el('button', `${TOPBAR_CLASS}__menu`, { anyinkControl: 'menu' });
	const label = el('span', `${TOPBAR_CLASS}__label`);
	label.textContent = word('topbar.menu');
	button.append(label);
	button.insertAdjacentHTML('beforeend', MENU_ICON);
	button.title = hintOf('topbar.menu');
	button.setAttribute('aria-haspopup', 'menu');
	button.setAttribute('aria-expanded', 'false');
	button.addEventListener('click', () => openSimpleMenu(button, bar.editor || currentEditor()));
	return button;
}

// --------------------------------------------------------------
// The bar
// --------------------------------------------------------------

/**
 * @param {Object} [editor] - ProjectEditor; default: the current one
 * @returns {HTMLElement}
 */
export function makeSimpleTopBar(editor = currentEditor()) {
	listenOnce();
	preloadExportFolder(); // the Menu names the font file folder as it opens
	const bar = el('header', TOPBAR_CLASS, { anyinkTopbar: 'simple' });
	bar.id = 'app__top-bar';
	bar.setAttribute('aria-label', word('topbar.label'));
	bar.editor = editor;

	const row = el('div', `${TOPBAR_CLASS}__row`);
	row.append(
		makeLogo(bar),
		makeFontName(bar, editor),
		makeRail(bar),
		el('span', `${TOPBAR_CLASS}__spacer`, { anyinkSlot: 'notices' }),
		makeHistoryButton('undo', bar),
		makeHistoryButton('redo', bar),
		makeStatusPill(editor),
		makeMoreTools(bar),
		makeMenuButton(bar)
	);
	// Row 2: the Next line (4.0); its state lives in the coach, so a new bar shows it at once
	const next = document.createElement('anyink-coach');
	next.className = `${TOPBAR_CLASS}__next`;
	bar.append(row, next);
	refreshBar(bar, editor);
	followTools(editor);
	return bar;
}

/** Subscriber id: the ready count follows the Point pen (never a substring of another id) */
const TOOL_SUBSCRIBER = 'anyink.topbar.readyCount';

/**
 * B6 + B7 finalize: a shape finished with "Finish the shape" records no step (its points were
 * steps already) but the Point pen lets go of it as it switches tools: the count is said again
 * then, so the letter counts the moment it is finished, never at its first click.
 * @param {Object} editor
 */
function followTools(editor) {
	if (typeof editor?.subscribe !== 'function') return;
	editor.subscribe({
		topic: 'whichToolIsSelected',
		subscriberID: TOOL_SUBSCRIBER,
		callback: () => refreshSimpleTopBar(globalThis.document),
	});
}

/**
 * @param {HTMLElement} bar
 * @param {Object} editor
 */
function refreshBar(bar, editor) {
	if (!editor) return;
	bar.editor = editor;
	const page = editor.nav?.page;
	const name = bar.querySelector('[data-anyink-control="fontName"]');
	const fontName = fontNameOf(editor);
	if (name && name.textContent !== fontName) name.textContent = fontName;
	const letters = bar.querySelector('[data-anyink-step="letters"]');
	if (letters) {
		// the shape the Point pen is still drawing is no letter yet (B6 + B7 finalize); a letter
		// that needs a look isn't ready (B10 + B11 integration: the board's rule)
		const { ready, total } = readyCount(editor.project, {
			open: openPathOf(editor),
			isReady: readyRuleFor(editor),
		});
		const count = letters.querySelector(`.${TOPBAR_CLASS}__step-count`);
		const text = word('topbar.step.count', { ready, total });
		if (count && count.textContent !== text) count.textContent = text;
		letters.title = word('topbar.step.lettersTip', { ready, total });
		if (LETTER_PAGES.includes(page) && !tryItShowing) letters.setAttribute('aria-current', 'step');
		else letters.removeAttribute('aria-current');
	}
	const tryItStep = bar.querySelector('[data-anyink-step="tryIt"]');
	if (tryItStep) {
		if (tryItShowing) tryItStep.setAttribute('aria-current', 'step');
		else tryItStep.removeAttribute('aria-current');
	}
	refreshHistoryButtons(bar, editor);
	updateStatusPill(bar.querySelector('[data-anyink-control="status"]'), editor);
}

/**
 * @param {Object} editor
 * @returns {String | false} the item open in a letter view; false on the board, Help, About
 */
function openItemOf(editor) {
	try {
		return editor?.selectedItemID || false;
	} catch {
		return false;
	}
}

/**
 * Undo and Redo: live or greyed, and the tooltip that names what they will do.
 * @param {HTMLElement} bar
 * @param {Object} editor
 */
function refreshHistoryButtons(bar, editor) {
	if (!editor) return;
	const state = undoButtonsState(editor.history, editor.project, {
		openItemID: openItemOf(editor),
	});
	['undo', 'redo'].forEach((kind) => {
		const button = bar.querySelector(`[data-anyink-control="${kind}"]`);
		if (!button) return;
		const disabled = String(!state[kind].enabled);
		if (button.getAttribute('aria-disabled') !== disabled) {
			button.setAttribute('aria-disabled', disabled);
		}
		if (button.title !== state[kind].tip) button.title = state[kind].tip;
	});
}

/**
 * @param {Document} [doc]
 */
export function refreshSimpleTopBar(doc = document) {
	const editor = currentEditor();
	doc
		?.querySelectorAll?.(`#app__top-bar.${TOPBAR_CLASS}`)
		.forEach((bar) => refreshBar(bar, editor));
}

let listening = false;
/** B12 + B13 integration: Try it is open (its change event says so) */
let tryItShowing = false;

/** One listener for the page: every History step, Undo and Redo sends a save status event. */
function listenOnce() {
	if (listening || typeof globalThis.addEventListener !== 'function') return;
	listening = true;
	globalThis.addEventListener(SAVE_STATUS_EVENT, () => refreshSimpleTopBar(globalThis.document));
	// S2 integration: Undo / Redo's tooltips follow an open sketch piece ("Take back the last
	// point", "Finish the line first") as its clicks come and go
	globalThis.addEventListener(SKETCH_PIECE_EVENT, () => refreshSimpleTopBar(globalThis.document));
	globalThis.addEventListener(TRY_IT_CHANGE_EVENT, (event) => {
		tryItShowing = !!event?.detail?.open;
		refreshSimpleTopBar(globalThis.document);
	});
	// B10 + B11 integration: the checks' answers reach the Next line's state (a font check, a
	// pass after a step); the count follows it, as the board does
	try {
		getCoach().subscribe(() => refreshSimpleTopBar(globalThis.document));
	} catch (error) {
		console.warn('ANY-INK top bar: could not follow the Next line', error);
	}
}
