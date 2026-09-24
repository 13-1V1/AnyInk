// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Small timing helpers for the preview strip.
	- makeFrameCoalescer: many calls in one frame become one call on the next frame.
	- makeTrailingDebounce: a burst of calls becomes one call, ms after the last one.
	Both take their clock as a parameter so tests can drive them by hand.
*/

/**
 * @param {Function} fn - what to run once per frame
 * @param {Function} [raf] - requestAnimationFrame-like scheduler
 * @returns {Function & {isPending: Function}} call it as often as you like
 */
export function makeFrameCoalescer(fn, raf = (cb) => globalThis.requestAnimationFrame(cb)) {
	let pending = false;
	const run = () => {
		pending = false;
		fn();
	};
	const schedule = () => {
		if (pending) return;
		pending = true;
		raf(run);
	};
	schedule.isPending = () => pending;
	return schedule;
}

/**
 * @param {Function} fn - runs with the most recent arguments
 * @param {Number} ms - quiet time before fn runs
 * @param {{setTimeout: Function, clearTimeout: Function}} [timers]
 * @returns {Function & {cancel: Function, flush: Function, isPending: Function}}
 */
export function makeTrailingDebounce(fn, ms, timers = globalThis) {
	let handle = null;
	let lastArgs = [];
	const clear = () => {
		if (handle !== null) {
			timers.clearTimeout(handle);
			handle = null;
		}
	};
	const debounced = (...args) => {
		lastArgs = args;
		clear();
		handle = timers.setTimeout(() => {
			handle = null;
			fn(...lastArgs);
		}, ms);
	};
	debounced.cancel = clear;
	debounced.flush = () => {
		if (handle === null) return;
		clear();
		fn(...lastArgs);
	};
	debounced.isPending = () => handle !== null;
	return debounced;
}
