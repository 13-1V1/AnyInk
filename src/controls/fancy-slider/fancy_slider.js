// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { addAsChildren, makeElement } from '../../common/dom.js';

/**
 * Makes a styled slider element.
 * Color comes from fancy-slider.css (accent-color: var(--touch)); nothing is set inline.
 * @param {Number} initialValue - what the slider value should be
 * @param {Function | false} callback - what to do when it changes
 * @param {Number} min - min value for the slider
 * @param {Number} max - max value for the slider
 * @param {Number} step - how big each step is
 * @returns {Element}
 */
export function makeFancySlider(initialValue = 50, callback, min = 0, max = 100, step = 1) {
	// log('makeFancySlider', 'start');

	let wrapper = makeElement({ className: 'fancy-slider__wrapper' });
	let sliderReadout = makeElement({
		className: 'fancy-slider__slider-readout',
		innerHTML: '' + initialValue,
	});

	let bar = makeElement({
		tag: 'input',
		attributes: {
			type: 'range',
			value: initialValue,
			min: min,
			max: max,
			step: step,
		},
		className: 'fancy-slider__bar',
	});
	bar.addEventListener('input', (event) => {
		// @ts-expect-error 'property does exist'
		const value = parseInt(event.target.value);
		sliderReadout.innerHTML = '' + value;
		if (callback) callback(value);
	});

	addAsChildren(wrapper, [bar, sliderReadout]);

	// log('makeFancySlider', 'end');
	return wrapper;
}
