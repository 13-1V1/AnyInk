// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK slider row (Milestone 5, audit C4 and D3).
	One reusable row: [label] [range slider + live readout] [unit] [reset].
	- The slider itself comes from upstream makeFancySlider (same classes, same CSS).
	- 'input' fires per tick (onInput), 'change' fires on release (onChange). Callers commit
	  history on onChange only.
	- Shift while dragging snaps to multiples of shiftSnap (10 units by default).
	- Arrow keys nudge one step, Shift+arrow ten steps, Home/End go to min/max; each key
	  press is a release.
	- Reset (button, or double-click the readout) returns to the neutral value and fires a
	  release so the caller can act on it.
	Colors come only from tokens via slider-row.css and fancy-slider.css.
*/
import { makeElement } from '../../common/dom.js';
import { makeFancySlider } from '../../controls/fancy-slider/fancy_slider.js';
import { clamp, formatValue, nudge, snapToMultiple, snapToStep, toNumber } from './slider_math.js';
import './slider-row.css';

/**
 * @typedef {Object} SliderRow
 * @property {HTMLElement} element - the row, ready to append
 * @property {HTMLInputElement} bar - the range input
 * @property {HTMLElement} readout - the live number readout
 * @property {HTMLButtonElement} resetButton
 * @property {Number} value - current value; setting it is silent (no events)
 * @property {Function} reset - back to neutral, fires input + change
 * @property {Function} setDisabled - (Boolean) greys the row out
 * @property {Function} setRange - ({min, max, step}) re-clamps the current value
 * @property {Number} neutral
 */

/**
 * Build a slider row.
 * @param {Object} o
 * @param {String} [o.id] - id for the range input (labels point at it)
 * @param {String} [o.label] - label text; omit for a bare row under an existing label
 * @param {String} [o.labelHTML] - label markup instead of text (no `for` is set)
 * @param {Number} [o.value] - starting value (defaults to neutral)
 * @param {Number} [o.neutral] - what Reset returns to (defaults to value, else 0)
 * @param {Number} [o.min]
 * @param {Number} [o.max]
 * @param {Number} [o.step]
 * @param {String} [o.unit] - shown after the readout: 'em', '°', '×'
 * @param {Number} [o.shiftSnap] - Shift-drag snap size (default 10 * step)
 * @param {Boolean} [o.disabled]
 * @param {Function} [o.onInput] - (value) every tick
 * @param {Function} [o.onChange] - (value) on release, key nudge, or reset
 * @returns {SliderRow}
 */
export function makeSliderRow({
	id = '',
	label = '',
	labelHTML = '',
	value,
	neutral,
	min = 0,
	max = 100,
	step = 1,
	unit = '',
	shiftSnap,
	disabled = false,
	onInput,
	onChange,
} = {}) {
	if (neutral === undefined) neutral = value === undefined ? 0 : toNumber(value, 0);
	if (value === undefined) value = neutral;
	if (shiftSnap === undefined) shiftSnap = step * 10;
	let range = { min, max, step };
	let shiftHeld = false;

	const element = makeElement({ className: 'anyink-slider-row' });
	if (!label && !labelHTML) element.classList.add('anyink-slider-row--no-label');

	// Label
	if (label || labelHTML) {
		const labelElement = makeElement({ tag: 'label', className: 'anyink-slider-row__label' });
		if (labelHTML) labelElement.innerHTML = labelHTML;
		else {
			labelElement.textContent = label;
			if (id) labelElement.setAttribute('for', id);
		}
		element.appendChild(labelElement);
	}

	// Slider + readout (upstream control, so it picks up fancy-slider.css)
	const slider = makeFancySlider(clampToRange(value), false, min, max, step);
	/** @type {HTMLInputElement} */
	const bar = slider.querySelector('.fancy-slider__bar');
	const readout = slider.querySelector('.fancy-slider__slider-readout');
	if (id) bar.setAttribute('id', id);
	bar.setAttribute('aria-label', label || id || 'slider');
	readout.setAttribute('title', 'Double-click to reset');
	element.appendChild(slider);

	// Unit
	const unitElement = makeElement({ className: 'anyink-slider-row__unit', content: unit });
	element.appendChild(unitElement);

	// Reset
	const resetButton = makeElement({
		tag: 'button',
		className: 'anyink-slider-row__reset',
		content: '&#x21BA;',
		attributes: { type: 'button', 'aria-label': 'Reset' },
	});
	element.appendChild(resetButton);

	function clampToRange(v) {
		return snapToStep(toNumber(v, neutral), range.step, range.min, range.max);
	}

	function currentValue() {
		return clampToRange(bar.value);
	}

	function paint(v) {
		readout.textContent = formatValue(v, range.step);
		element.classList.toggle('anyink-slider-row--neutral', v === neutral);
	}

	function setSilently(v) {
		const next = clampToRange(v);
		bar.value = String(next);
		paint(next);
		return next;
	}

	function fire(type) {
		bar.dispatchEvent(new Event(type, { bubbles: true }));
	}

	function updateResetTitle() {
		resetButton.setAttribute('title', `Reset to ${formatValue(neutral, range.step)}${unit}`);
	}

	// Per tick: Shift snaps, readout follows, caller previews
	bar.addEventListener('input', () => {
		let v = currentValue();
		if (shiftHeld) {
			const snapped = snapToMultiple(v, shiftSnap, range.min, range.max);
			if (snapped !== v) {
				v = snapped;
				bar.value = String(v);
			}
		}
		paint(v);
		if (onInput) onInput(v);
	});

	// On release: caller commits
	bar.addEventListener('change', () => {
		const v = currentValue();
		paint(v);
		if (onChange) onChange(v);
	});

	// Track Shift while the pointer is on the bar
	const trackShift = (event) => {
		shiftHeld = !!event.shiftKey;
	};
	bar.addEventListener('pointerdown', trackShift);
	bar.addEventListener('pointermove', trackShift);
	bar.addEventListener('pointerup', trackShift);
	bar.addEventListener('keyup', (event) => {
		if (event.key === 'Shift') shiftHeld = false;
	});

	// Keyboard: arrows nudge 1 (Shift 10), Home / End, PageUp / PageDown 10
	bar.addEventListener('keydown', (event) => {
		if (event.key === 'Shift') shiftHeld = true;
		let next = null;
		const v = currentValue();
		const o = { step: range.step, min: range.min, max: range.max, big: event.shiftKey };
		if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = nudge(v, -1, o);
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = nudge(v, 1, o);
		if (event.key === 'PageDown') next = nudge(v, -1, { ...o, big: true });
		if (event.key === 'PageUp') next = nudge(v, 1, { ...o, big: true });
		if (event.key === 'Home') next = range.min;
		if (event.key === 'End') next = range.max;
		if (next === null) return;
		event.preventDefault();
		event.stopPropagation();
		if (next === v) return;
		bar.value = String(next);
		fire('input');
		fire('change');
	});

	function reset() {
		if (bar.disabled) return;
		setSilently(neutral);
		fire('input');
		fire('change');
	}
	resetButton.addEventListener('click', reset);
	readout.addEventListener('dblclick', reset);

	function setDisabled(flag) {
		bar.disabled = !!flag;
		resetButton.disabled = !!flag;
		element.classList.toggle('anyink-slider-row--disabled', !!flag);
	}

	function setRange(next = {}) {
		range = { ...range, ...next };
		bar.setAttribute('min', String(range.min));
		bar.setAttribute('max', String(range.max));
		bar.setAttribute('step', String(range.step));
		if (next.step !== undefined && shiftSnap === step * 10) shiftSnap = range.step * 10;
		neutral = clamp(neutral, range.min, range.max);
		setSilently(currentValue());
		updateResetTitle();
	}

	updateResetTitle();
	setSilently(value);
	setDisabled(disabled);

	/** @type {SliderRow} */
	const row = {
		element,
		bar,
		readout,
		resetButton,
		reset,
		setDisabled,
		setRange,
		get neutral() {
			return neutral;
		},
		get value() {
			return currentValue();
		},
		set value(v) {
			setSilently(v);
		},
	};
	return row;
}

/**
 * A grid that lines up several slider rows (labels in one column, bars in another).
 * @param {Array<SliderRow>} rows
 * @returns {HTMLElement}
 */
export function makeSliderTable(rows = []) {
	const table = makeElement({ className: 'anyink-slider-table' });
	rows.forEach((row) => table.appendChild(row.element));
	return table;
}
