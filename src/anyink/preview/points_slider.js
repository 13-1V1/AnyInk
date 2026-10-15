// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	A type-size slider in points, built on upstream's fancy slider.
	8 to 200 pt, readout 'NN pt', Shift-drag snaps to 10, arrows nudge 1 (Shift 10).
	Reports per tick (onInput) and on release (onChange) so callers can keep the
	cheap work per tick and the expensive work for release.
*/
import { makeFancySlider } from '../../controls/fancy-slider/fancy_slider.js';
import { word } from '../words/words.js';
import { injectStyleOnce } from './inject_style.js';
import style from './points-slider.css?inline';
import { DEFAULT_PT, MAX_PT, MIN_PT, clampPt, formatPt, nudgePt, snapPt } from './units.js';

const STYLE_ID = 'anyink-points-slider-style';

// Shift state, tracked here because upstream stops tracking modifiers while an
// input has focus (and a range input has focus while it is dragged).
let shiftDown = false;
let shiftTracked = false;
function trackShift() {
	if (shiftTracked || typeof window === 'undefined') return;
	shiftTracked = true;
	window.addEventListener('keydown', (e) => (e.key === 'Shift' ? (shiftDown = true) : 0), true);
	window.addEventListener('keyup', (e) => (e.key === 'Shift' ? (shiftDown = false) : 0), true);
	window.addEventListener('blur', () => (shiftDown = false));
}

/**
 * @param {Object} [options]
 * @param {Number} [options.value] - starting points
 * @param {Function} [options.onInput] - (pt) every tick
 * @param {Function} [options.onChange] - (pt) on release or keyboard nudge
 * @param {String} [options.id] - id for the range input (for a <label for>)
 * @param {Document} [options.doc]
 * @returns {{element: HTMLElement, input: HTMLInputElement, get: Function, set: Function}}
 */
export function makePointsSlider({ value = DEFAULT_PT, onInput, onChange, id, doc } = {}) {
	injectStyleOnce(STYLE_ID, style, doc || document);
	trackShift();

	let pt = clampPt(value);
	const element = makeFancySlider(pt, false, MIN_PT, MAX_PT, 1);
	element.classList.add('points-slider');
	/** @type {HTMLInputElement} */
	const input = element.querySelector('.fancy-slider__bar');
	const readout = element.querySelector('.fancy-slider__slider-readout');
	if (id) input.id = id;
	input.setAttribute('aria-label', word('strip.sizeLabel'));
	input.setAttribute('title', word('strip.sizeHint'));

	const show = () => {
		readout.textContent = formatPt(pt);
		input.value = String(pt);
	};

	// The fancy slider's own listener writes the bare number first; this one runs after it.
	input.addEventListener('input', () => {
		pt = shiftDown ? snapPt(input.value) : clampPt(input.value);
		show();
		if (onInput) onInput(pt);
	});
	input.addEventListener('change', () => {
		if (onChange) onChange(pt);
	});
	input.addEventListener('keydown', (event) => {
		if (!event.shiftKey) return; // plain arrows are the browser's 1-step nudge
		const dir = arrowDirection(event.key);
		if (!dir) return;
		event.preventDefault();
		pt = nudgePt(pt, dir, true);
		show();
		if (onInput) onInput(pt);
		if (onChange) onChange(pt);
	});

	show();
	return {
		element,
		input,
		get: () => pt,
		set: (next) => {
			pt = clampPt(next);
			show();
		},
	};
}

/**
 * @param {String} key - KeyboardEvent.key
 * @returns {Number} +1, -1, or 0
 */
export function arrowDirection(key) {
	if (key === 'ArrowRight' || key === 'ArrowUp') return 1;
	if (key === 'ArrowLeft' || key === 'ArrowDown') return -1;
	return 0;
}
