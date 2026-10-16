// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
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
	    take(x, y, t)                 B16 fix (a fast flick cut its corners): push, but a sharp
	                                  corner the raw samples show (raw_corners.js) goes in first,
	                                  exactly where it is, and the filter starts again from it,
	                                  so the lag of a quick hand never cuts across a corner;
	                                  returns the points out, [{ x, y }, ...] (one, or the corner
	                                  and then the sample). B16 final: a sample FAST_STEP_PX or
	                                  more from the one before goes in as it is too (the filter's
	                                  lag on each axis bent a quick diagonal off its leg)
*/
import { OneEuroFilter } from '1eurofilter';
import { makeCornerFinder } from './raw_corners.js';

export const FILTER_SETTINGS = Object.freeze({
	frequency: 120,
	minCutoff: 1.5,
	beta: 0.02,
	dCutoff: 1,
});

/**
 * B16 final: a sample this far (pixels) from the one before is a fast hand: no jitter shows at
 * that speed, and the filter's lag would bend the line (each axis lags on its own, so a quick
 * diagonal leaves its leg), so it goes in as it is and the filter starts again from it.
 */
export const FAST_STEP_PX = 40;

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
	let fx = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
	let fy = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
	let lastTime = null;
	let last = null;
	const corners = makeCornerFinder();

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

	/** Fresh filters whose first sample is (x, y): the line goes on from there exactly */
	const restartAt = (x, y, time) => {
		fx = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
		fy = new OneEuroFilter(frequency, minCutoff, beta, dCutoff);
		last = { x: fx.filter(x, time), y: fy.filter(y, time) };
		return last;
	};

	let lastRaw = null;
	const take = (x, y, t) => {
		const time = timeFor(t);
		const corner = corners.add([x, y], time);
		const fast = !!lastRaw && Math.hypot(x - lastRaw[0], y - lastRaw[1]) >= FAST_STEP_PX;
		lastRaw = [x, y];
		const out = [];
		// the filter starts again at the corner: fresh filters, the corner their first sample
		if (corner) out.push(restartAt(...corner.point, Math.min(time, corner.t)));
		// B16 final: a fast sample goes in as it is
		out.push(fast ? restartAt(x, y, time) : push(x, y, time));
		return out;
	};

	return { push, settle, take };
}
