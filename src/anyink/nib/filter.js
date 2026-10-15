// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (RESEARCH 2.3): the 1 euro filter on the pointer's samples, one filter per channel
	(x and y), timestamps in seconds (1eurofilter 1.3.0, BSD-3-Clause). It takes out a hand's
	jitter when the pen moves slowly and keeps up when it moves fast. The brush filters screen
	pixels, so the same hand gives the same smoothing at any zoom.

	  FILTER_SETTINGS                 { frequency, minCutoff, beta, dCutoff }: frequency is only
	                                  the first guess (the timestamps set it after that); minCutoff
	                                  (Hz) sets how much slow jitter goes; beta how fast it keeps up
	  makeStrokeFilter(settings)      one stroke's filter:
	    push(x, y, t)                 a sample in, { x, y } out (the first comes out as it went in)
	    settle(x, y, t)               the pen stopped at (x, y): the samples the filter gives while
	                                  it catches up with it, a sixtieth of a second apart, the last
	                                  one within SETTLED of (x, y) (or exactly it), so a stroke
	                                  ends where the pen did and not short of it
*/
import { OneEuroFilter } from '1eurofilter';

export const FILTER_SETTINGS = Object.freeze({
	frequency: 120,
	minCutoff: 1.5,
	beta: 0.02,
	dCutoff: 1,
});

/** How close the settle comes before it stops, in the filter's units (pixels in the app) */
export const SETTLED = 0.05;
/** The settle's steps: a sixtieth of a second each, at most this many */
const SETTLE_STEP = 1 / 60;
const SETTLE_STEPS = 240;

/**
 * @param {typeof FILTER_SETTINGS} [settings]
 * @returns {{push: Function, settle: Function}}
 */
export function makeStrokeFilter(settings = FILTER_SETTINGS) {
	const { frequency, minCutoff, beta, dCutoff } = settings;
	const fx = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
	const fy = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
	let lastTime = null;
	let last = null;

	/** A time the filter can use: seconds, never before the last one */
	const timeFor = (t) => {
		const time = Number.isFinite(t) ? t : lastTime ?? 0;
		lastTime = lastTime === null ? time : Math.max(lastTime, time);
		return lastTime;
	};

	const push = (x, y, t) => {
		const time = timeFor(t);
		last = { x: fx.filter(x, time), y: fy.filter(y, time) };
		return last;
	};

	const settle = (x, y, t) => {
		const tail = [];
		if (!last) return [push(x, y, t)];
		let time = timeFor(t);
		for (let i = 0; i < SETTLE_STEPS; i++) {
			time += SETTLE_STEP;
			const point = push(x, y, time);
			tail.push(point);
			if (Math.hypot(point.x - x, point.y - y) <= SETTLED) return tail;
		}
		last = { x, y };
		tail.push(last);
		return tail;
	};

	return { push, settle };
}
