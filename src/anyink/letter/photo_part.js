// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 finalize: Fine-tune > Photo (UX-BEGINNER.md 4.3 "Letter card sections", 7.3, 7.6), the
	last piece of the letter card B9 left unbuilt. It shows on a letter with a photo under it,
	first inside Fine-tune:

	  Photo   Photo fade   faint --o-- strong
	          [Hide photo] / [Show photo]
	          > Photo options                     closed at first; as he left it for the session
	              [x] Lock the photo              on after Use it (7.6): Select never moves it
	              [ ] Light ink on dark paper
	              [Fit to letter box] [Fit to capitals line]
	              [Remove photo]

	Every change is one Undo step that names the letter (7.3): the fade on release only (a drag
	shows each tick and records one step), hide and show, lock and unlock, light ink, the two
	fits (the trace module's own fitTraceToBand, the letter box being the top line to the tail
	line, the capitals line's band from the writing line up), and Remove photo, which says so in
	a toast with [Undo] (7.3: a destructive change gets an Undo toast, never a confirm). A fit
	works whether or not the photo is locked: the lock stops a drag on the canvas, not a press
	here. The photo is the letter's trace (trace/trace_model.js); nothing here touches its
	shapes, and the photo never goes in the font file.

	Pure:
	  photoPartState(item)       { fade (5..100, a percent), visible, locked, invert } for the
	                             letter's photo, or null when it has none
	DOM:
	  makePhotoPart(state, editor, { redraw })   the part; state is letterCardState(...).photo
	  holdFade()                 the fade the card shows while a drag is under way (the card
	                             isn't drawn again under the pointer), else null
	  resetPhotoPartForTests()
	Words: letter.photo.*, letter.step.photo*, letter.toast.photoRemoved (words/sets/letter.js).
*/
import { makeElement } from '../../common/dom.js';
import { undoOffer } from '../history/undo_toast.js';
import { toast } from '../toast/toast.js';
import { fitBands, fitTraceToBand } from '../trace/trace_fit.js';
import { OPACITY_MIN, TRACE_DEFAULTS, getTrace, setTrace } from '../trace/trace_model.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';

/** Photo options: closed at first, as he left it for the session */
let optionsOpen = false;
/** The fade shown when a drag of the slider began, while it is under way */
let held = null;

/**
 * @param {Object} item - Glyph
 * @returns {{fade: Number, visible: Boolean, locked: Boolean, invert: Boolean} | null}
 */
export function photoPartState(item) {
	const trace = getTrace(item);
	if (!trace) return null;
	return {
		fade: held ?? percentOf(trace.opacity),
		visible: trace.visible !== false,
		locked: !!trace.locked,
		invert: !!trace.invert,
		optionsOpen,
	};
}

/** @returns {Number | null} */
export function holdFade() {
	return held;
}

/**
 * @param {Object} state - photoPartState
 * @param {Object} editor - ProjectEditor
 * @param {{redraw: Function}} options - draws the card again (a disclosure opened)
 * @returns {HTMLElement}
 */
export function makePhotoPart(state, editor, { redraw }) {
	const part = makeElement({ tag: 'div', className: 'anyink-letter-card__part' });
	const title = makeElement({ tag: 'h4', className: 'anyink-letter-card__part-title' });
	title.textContent = word('letter.fineTune.photo');
	title.title = hintOf('letter.fineTune.photo');
	part.appendChild(title);

	part.appendChild(fadeSlider(state, editor));

	const visible = state.visible;
	part.appendChild(
		button(visible ? 'hide' : 'show', visible ? 'letter.photo.hide' : 'letter.photo.show', () =>
			change(
				editor,
				{ visible: !visible },
				visible ? 'letter.step.photoHidden' : 'letter.step.photoShown'
			)
		)
	);

	const options = makeElement({ tag: 'div', className: 'anyink-letter-card__options' });
	options.appendChild(
		disclosure(word('letter.photoOptions'), state.optionsOpen, () => {
			optionsOpen = !optionsOpen;
			redraw?.();
		})
	);
	if (state.optionsOpen) {
		options.append(
			check('lock', 'letter.photo.lock', state.locked, (on) =>
				change(editor, { locked: on }, on ? 'letter.step.photoLocked' : 'letter.step.photoUnlocked')
			),
			check('lightInk', 'letter.photo.lightInk', state.invert, (on) =>
				change(
					editor,
					{ invert: on },
					on ? 'letter.step.photoLightInk' : 'letter.step.photoDarkInk'
				)
			)
		);
		const row = makeElement({ tag: 'div', className: 'anyink-letter-card__buttons' });
		row.append(
			button('fitBox', 'letter.photo.fitBox', () => fit(editor, 'em', 'letter.step.photoFitBox')),
			button('fitCaps', 'letter.photo.fitCaps', () =>
				fit(editor, 'cap', 'letter.step.photoFitCaps')
			),
			button('remove', 'letter.photo.remove', () => remove(editor))
		);
		options.appendChild(row);
	}
	part.appendChild(options);
	return part;
}

/** "Photo fade  faint --o-- strong": each tick shows, the release is one step. */
function fadeSlider(state, editor) {
	const control = makeElement({
		tag: 'div',
		className: 'anyink-photo-fade',
		attributes: { 'data-anyink-photo': 'fade', title: hintOf('letter.photo.fade') },
	});
	const label = makeElement({ tag: 'span', className: 'anyink-photo-fade__label' });
	label.textContent = word('letter.photo.fade');
	const faint = makeElement({ tag: 'span', className: 'anyink-photo-fade__end' });
	faint.textContent = word('letter.photo.faint');
	const strong = makeElement({ tag: 'span', className: 'anyink-photo-fade__end' });
	strong.textContent = word('letter.photo.strong');
	const slider = makeElement({
		tag: 'input',
		className: 'anyink-photo-fade__slider',
		attributes: {
			type: 'range',
			min: String(Math.round(OPACITY_MIN * 100)),
			max: '100',
			step: '1',
			'aria-label': word('letter.photo.fade'),
			'data-anyink-photo-input': 'fade',
		},
	});
	slider.value = String(state.fade);
	slider.addEventListener('input', () => {
		const item = openLetter(editor);
		const trace = getTrace(item);
		if (!trace) return;
		if (held === null) held = percentOf(trace.opacity);
		setTrace(item, { ...trace, opacity: Number(slider.value) / 100 });
		editor.publish('traceLayer', item);
	});
	slider.addEventListener('change', () => {
		const item = openLetter(editor);
		const trace = getTrace(item);
		const before = held ?? (trace ? percentOf(trace.opacity) : null);
		held = null;
		if (!trace) return;
		const value = Number(slider.value);
		if (percentOf(trace.opacity) !== value) setTrace(item, { ...trace, opacity: value / 100 });
		if (value === before) {
			editor.publish('traceLayer', item);
			return;
		}
		record(editor, item, 'letter.step.photoFade');
	});
	control.append(label, faint, slider, strong);
	return control;
}

/** One trace setting changed, as one step. */
function change(editor, changes, key) {
	const item = openLetter(editor);
	const trace = getTrace(item);
	if (!trace) return;
	if (Object.entries(changes).every(([name, value]) => !!trace[name] === !!value)) return;
	setTrace(item, { ...trace, ...changes });
	record(editor, item, key);
}

/** Fit to the letter box (the top line to the tail line) or the capitals line's band. */
function fit(editor, band, key) {
	const item = openLetter(editor);
	const trace = getTrace(item);
	if (!trace) return;
	const { top, bottom } = fitBands(editor.project?.settings?.font)[band];
	const next = fitTraceToBand(trace, top, bottom);
	if (!next) return;
	if (['x', 'y', 'scale'].every((name) => Math.abs(next[name] - trace[name]) < 1e-9)) return;
	setTrace(item, next);
	record(editor, item, key);
}

/** Remove photo: one step, and a toast with [Undo] (7.3). */
function remove(editor) {
	const item = openLetter(editor);
	if (!getTrace(item)) return;
	const name = nameOf(editor, item);
	setTrace(item, null);
	record(editor, item, 'letter.step.photoRemoved');
	toast('letter.toast.photoRemoved', { name }, { kind: 'destructive', ...undoOffer(editor) });
}

/** One Undo step named in plain words; the canvas and the card follow. */
function record(editor, item, key) {
	editor.history.addState(word(key, { name: nameOf(editor, item) }));
	editor.publish('traceLayer', item);
	editor.publish('currentItem', editor.selectedItem);
}

function percentOf(opacity) {
	const value = Number.isFinite(Number(opacity)) ? Number(opacity) : TRACE_DEFAULTS.opacity;
	return Math.round(Math.min(1, Math.max(OPACITY_MIN, value)) * 100);
}

function openLetter(editor) {
	const id = editor?.selectedGlyphID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	return editor.project.getItem(id) || null;
}

function nameOf(editor, item) {
	let char = typeof item?.char === 'string' ? item.char : '';
	if (!char) {
		const code = parseInt(String(editor?.selectedGlyphID || '').replace(/^glyph-/, ''), 16);
		char = Number.isFinite(code) ? String.fromCodePoint(code) : '';
	}
	return letterName(char) || word('check.aLetter');
}

function hintOf(key) {
	return wordEntry(key)?.hint || '';
}

function button(name, key, onClick) {
	const element = makeElement({
		tag: 'button',
		className: 'anyink-letter-card__button',
		attributes: { type: 'button', 'data-anyink-photo-action': name },
	});
	element.textContent = word(key);
	const hint = hintOf(key);
	if (hint) element.title = hint;
	element.addEventListener('click', onClick);
	return element;
}

function check(name, key, on, onChange) {
	const label = makeElement({
		tag: 'label',
		className: 'anyink-letter-card__check',
		attributes: { title: hintOf(key) },
	});
	const input = makeElement({
		tag: 'input',
		attributes: { type: 'checkbox', 'data-anyink-photo-input': name },
	});
	input.checked = !!on;
	input.addEventListener('change', () => onChange(input.checked));
	const text = makeElement({ tag: 'span' });
	text.textContent = word(key);
	label.append(input, text);
	return label;
}

function disclosure(text, open, onToggle) {
	const element = makeElement({
		tag: 'button',
		className: 'anyink-disclosure',
		attributes: {
			type: 'button',
			'data-anyink-toggle': 'photoOptions',
			'aria-expanded': String(open),
		},
	});
	element.appendChild(
		makeElement({
			tag: 'span',
			className: 'anyink-disclosure__chevron',
			attributes: { 'aria-hidden': 'true' },
		})
	);
	const label = makeElement({ tag: 'span', className: 'anyink-disclosure__label' });
	label.textContent = text;
	element.appendChild(label);
	element.addEventListener('click', onToggle);
	return element;
}

export function resetPhotoPartForTests() {
	optionsOpen = false;
	held = null;
}
