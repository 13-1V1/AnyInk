// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15: Font details (UX-BEGINNER.md 4.8, 7.3, section 10 B15). Opened by the font name in the top
	bar and Menu > Font details... (topbar/doors.js FONT_DETAILS_EVENT):
	  Font details                                        [x]
	  Font name   [ Brennan Hand______________ ]
	  Your name   [ Brennan Meyer_____________ ]
	  Copyright   [ Copyright 2026 Brennan Meyer ]
	  Numbers & symbols   (o) off
	  Accented letters and more are in More tools.
	  [ Move the guide lines... ]
	  [ Done ]  (green)
	Font name writes both the project name and the font family. Copyright fills itself from Your
	name and the year until he edits it (it follows while it is empty or reads exactly "Copyright
	<a year> <his name before>"). Numbers & symbols is the board's own switch (board/letter_set.js
	setNumbersShown). Each field change is ONE settings Undo step when the field loses focus (or
	Enter, or the dialog closes with something typed): settings steps hold settings.anyink and
	the project name (7.3, history/settings_snapshot.js). A blank font name goes back to the name
	it had. Move the guide lines... closes the dialog and unlocks the lines (move_lines.js).
	B14 + B15 finalize: a font name too long for Word's test fonts gets one quiet line under it,
	naming the first test font (fontinfo.shortInWord), as he types; only with 'useInWord'.
	It is an ANY-INK dialog (the photo track's modal shell, photo_dialog.js openModal: the Next
	line steps aside, editor keys never reach the letter under it), shown only in Simple with
	'fontDetails' on. All tools keeps upstream's Settings page.

	  openFontDetails({ editor, cause })   the dialog, or null (not Simple, the flag off, no font)
	  closeFontDetails() / isFontDetailsOpen()
	  setFontName(editor, name)            true when the name changed (one settings step)
	  setYourName(editor, name, { year })  true when it changed; Copyright follows in that step
	  setCopyright(editor, text)           true when it changed (one settings step)
	  autoCopyright(name, year)            'Copyright 2026 Brennan Meyer'; '' for no name
	  copyrightFollows(copyright, name)    true while Copyright still fills itself
	  readDetails(project)                 { fontName, yourName, copyright, numbers }
	  installFontDetails({ getEditor })    answers the top bar's door; returns the uninstall
	  FONT_DETAILS_NAME                    'fontDetails' (data-anyink-dialog)
	Words: fontinfo.* (words/sets/fontinfo.js). Look: font_details_dialog.css and the shared
	modal shell (photo/photo_dialog.css), tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { numbersShown, setNumbersShown } from '../board/letter_set.js';
import { familyBase, fontBaseName, testBuildNames } from '../install/build_names.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { openModal } from '../photo/photo_dialog.js';
import { FONT_DETAILS_EVENT } from '../topbar/doors.js';
import { word, wordEntry } from '../words/words.js';
import { startMovingLines } from './move_lines.js';
import './font_details_dialog.css';

export const FONT_DETAILS_NAME = 'fontDetails';

/** The fields, in order: their words key and the setter that records the step */
const FIELDS = Object.freeze([
	{ name: 'fontName', key: 'fontinfo.fontName' },
	{ name: 'yourName', key: 'fontinfo.yourName' },
	{ name: 'copyright', key: 'fontinfo.copyright' },
]);

/** A font name longer than this is cut (Windows and Word show far less) */
const MAX_LENGTH = 64;

/** @type {{modal: Object, editor: Object} | null} */
let current = null;

// --------------------------------------------------------------
// The font's details (no screen)
// --------------------------------------------------------------

/**
 * @param {String} name
 * @param {Number} [year]
 * @returns {String}
 */
export function autoCopyright(name, year = new Date().getFullYear()) {
	const who = clean(name);
	return who ? word('fontinfo.copyrightText', { year: String(year), name: who }) : '';
}

/**
 * @param {String} copyright - what Copyright says now
 * @param {String} name - Your name as it is now (before a change)
 * @returns {Boolean} true while Copyright still fills itself from the name
 */
export function copyrightFollows(copyright, name) {
	const text = clean(copyright);
	if (!text) return true;
	const year = text.match(/\b(\d{4})\b/)?.[1];
	return !!year && text === autoCopyright(name, Number(year));
}

/**
 * @param {Object} project
 * @returns {{fontName: String, yourName: String, copyright: String, numbers: Boolean}}
 */
export function readDetails(project) {
	const settings = project?.settings || {};
	return {
		fontName: String(settings.project?.name ?? settings.font?.family ?? ''),
		yourName: String(settings.font?.designer ?? ''),
		copyright: String(settings.font?.copyright ?? ''),
		numbers: numbersShown(project),
	};
}

/**
 * Font name: the project name and the font family, one settings step.
 * @param {Object} editor
 * @param {String} name
 * @returns {Boolean} true when it changed
 */
export function setFontName(editor, name) {
	const settings = editor?.project?.settings;
	const value = clean(name).slice(0, MAX_LENGTH);
	if (!settings?.project || !settings.font || !value) return false;
	if (settings.project.name === value && settings.font.family === value) return false;
	settings.project.name = value;
	settings.font.family = value;
	return record(editor, 'fontinfo.step.fontName');
}

/**
 * Your name, and Copyright with it while Copyright still follows: one settings step.
 * @param {Object} editor
 * @param {String} name
 * @param {{year?: Number}} [options]
 * @returns {Boolean} true when it changed
 */
export function setYourName(editor, name, { year } = {}) {
	const font = editor?.project?.settings?.font;
	const value = clean(name);
	if (!font || String(font.designer ?? '') === value) return false;
	const follows = copyrightFollows(font.copyright, font.designer);
	font.designer = value;
	if (follows) font.copyright = autoCopyright(value, year);
	return record(editor, 'fontinfo.step.yourName');
}

/**
 * @param {Object} editor
 * @param {String} text
 * @returns {Boolean} true when it changed
 */
export function setCopyright(editor, text) {
	const font = editor?.project?.settings?.font;
	const value = clean(text);
	if (!font || String(font.copyright ?? '') === value) return false;
	font.copyright = value;
	return record(editor, 'fontinfo.step.copyright');
}

// --------------------------------------------------------------
// The dialog
// --------------------------------------------------------------

/**
 * @param {{editor?: Object, cause?: String}} [options]
 * @returns {{element: HTMLElement, close: Function} | null}
 */
export function openFontDetails({ editor = getCurrentProjectEditor() } = {}) {
	if (!isSimpleMode() || !isFeatureOn('fontDetails') || !editor?.project?.settings) return null;
	const titleId = 'anyink-font-details-title';
	const inputs = {};
	const commitAll = () => FIELDS.forEach(({ name }) => commit(editor, name, inputs));
	const modal = openModal({
		name: FONT_DETAILS_NAME,
		className: 'anyink-font-details',
		labelledBy: titleId,
		onKey: (event) => {
			const name = event.target?.getAttribute?.('data-anyink-fontinfo-field');
			if (event.key !== 'Enter' || !name) return false;
			commit(editor, name, inputs);
			return true;
		},
	});
	const { dialog } = modal;
	// closing (Done, the x, Escape, Move the guide lines) keeps what was typed
	modal.cleanups.push(commitAll, () => {
		if (current?.modal === modal) current = null;
	});

	const head = el('div', 'anyink-modal__head');
	head.appendChild(el('h2', 'anyink-modal__title', { id: titleId }, word('fontinfo.title')));
	const x = el('button', 'anyink-modal__close', {
		type: 'button',
		'aria-label': word('fontinfo.close'),
		'data-anyink-fontinfo-action': 'x',
	});
	x.textContent = '×';
	x.addEventListener('click', () => modal.close());
	head.appendChild(x);

	const form = el('div', 'anyink-font-details__fields');
	FIELDS.forEach(({ name, key }) => {
		const id = `anyink-font-details-${name}`;
		const label = el('label', 'anyink-font-details__label', { for: id }, word(key));
		const hint = wordEntry(key)?.hint;
		if (hint) label.title = hint;
		const input = el('input', 'anyink-font-details__input', {
			id,
			type: 'text',
			spellcheck: 'false',
			autocomplete: 'off',
			'data-anyink-fontinfo-field': name,
		});
		if (name === 'fontName') input.maxLength = MAX_LENGTH;
		if (hint) input.title = hint;
		input.addEventListener('change', () => commit(editor, name, inputs));
		input.addEventListener('blur', () => commit(editor, name, inputs));
		inputs[name] = input;
		form.append(label, input);
		if (name === 'fontName') {
			// B14 + B15 finalize: what Word will call a long name's test font, as he types
			const short = el('p', 'anyink-font-details__note anyink-font-details__short', {
				'data-anyink-fontinfo-note': 'shortInWord',
			});
			const sayShort = () => showShortName(short, input.value);
			input.addEventListener('input', sayShort);
			inputs.sayShort = sayShort;
			form.append(short);
		}
	});

	const numbersRow = el('div', 'anyink-font-details__row');
	const numbersLabel = el('span', 'anyink-font-details__label', {}, word('fontinfo.numbers'));
	const numbersHint = wordEntry('fontinfo.numbers')?.hint;
	if (numbersHint) numbersLabel.title = numbersHint;
	const numbers = el('button', 'anyink-font-details__switch', {
		type: 'button',
		role: 'switch',
		'aria-label': word('fontinfo.numbers'),
		'data-anyink-fontinfo-action': 'numbers',
	});
	if (numbersHint) numbers.title = numbersHint;
	numbers.addEventListener('click', () => {
		commitAll();
		setNumbersShown(editor, !numbersShown(editor.project));
		fill(editor, inputs, numbers);
	});
	numbersRow.append(numbersLabel, numbers);

	const more = el('p', 'anyink-font-details__note', {}, word('fontinfo.moreLetters'));

	const moveLines = button('moveLines', 'fontinfo.moveLines', 'outlined');
	moveLines.addEventListener('click', () => {
		modal.close();
		startMovingLines({ editor });
	});

	const row = el('div', 'anyink-modal__buttons');
	const done = button('done', 'fontinfo.done', 'primary');
	done.addEventListener('click', () => modal.close());
	row.append(done);

	dialog.append(head, form, numbersRow, more, moveLines, row);
	fill(editor, inputs, numbers);
	current = { modal, editor };
	modal.show(inputs.fontName);
	return { element: dialog, close: () => modal.close() };
}

/** Closes Font details (what was typed is kept). */
export function closeFontDetails() {
	current?.modal.close();
}

/** @returns {Boolean} */
export function isFontDetailsOpen() {
	return !!current && !current.modal.closed;
}

/**
 * @param {{getEditor?: Function}} [options]
 * @returns {Function} the uninstall
 */
export function installFontDetails({ getEditor = getCurrentProjectEditor } = {}) {
	const onDoor = (event) => openFontDetails({ editor: getEditor(), cause: event?.detail?.cause });
	globalThis.addEventListener?.(FONT_DETAILS_EVENT, onDoor);
	return () => globalThis.removeEventListener?.(FONT_DETAILS_EVENT, onDoor);
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/** A field's value into the font when it differs; the fields then show the font as it is */
function commit(editor, name, inputs) {
	const input = inputs[name];
	if (!input) return;
	const details = readDetails(editor.project);
	if (input.value !== details[name] && clean(input.value) !== details[name]) {
		if (name === 'fontName') setFontName(editor, input.value);
		else if (name === 'yourName') setYourName(editor, input.value);
		else if (name === 'copyright') setCopyright(editor, input.value);
	}
	fill(editor, inputs, null, name);
}

/**
 * The fields and the switch show the font as it is now. A field with something typed in it
 * that isn't in the font yet keeps it, unless it is the one just committed (`committed`).
 */
function fill(editor, inputs, numbers, committed = '') {
	const details = readDetails(editor.project);
	inputs.sayShort?.();
	FIELDS.forEach(({ name }) => {
		const input = inputs[name];
		if (!input) return;
		const typing = input.dataset.anyinkShown !== undefined && input.value !== input.dataset.anyinkShown;
		if (typing && name !== committed) return;
		if (input.value !== details[name]) input.value = details[name];
		input.dataset.anyinkShown = details[name];
	});
	const toggle = numbers || inputs.fontName?.closest?.('dialog')?.querySelector(
		'[data-anyink-fontinfo-action="numbers"]'
	);
	if (toggle) {
		toggle.setAttribute('aria-checked', String(details.numbers));
		toggle.textContent = word(details.numbers ? 'fontinfo.on' : 'fontinfo.off');
	}
}

/**
 * B14 + B15 finalize: the quiet line under Font name. A name Word's test fonts would cut
 * (install/build_names.js familyBase) names the first test font; else the line is hidden. Only
 * once Use in Word is on.
 * @param {HTMLElement} line
 * @param {String} name - as typed
 */
function showShortName(line, name) {
	const cut = isFeatureOn('useInWord') && familyBase(name) !== fontBaseName(name);
	line.hidden = !cut;
	line.textContent = cut
		? word('fontinfo.shortInWord', { test: testBuildNames(name, 1).family })
		: '';
}

/** One settings step, titled in plain words */
function record(editor, key) {
	if (typeof editor.history?.addSettingsState === 'function') {
		editor.history.addSettingsState(word(key));
	}
	return true;
}

/** @returns {String} trimmed, inner runs of spaces made one */
function clean(text) {
	return String(text ?? '')
		.replace(/\s+/g, ' ')
		.trim();
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
		'data-anyink-fontinfo-action': name,
	});
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}
