// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16 fix (acceptance: "a fast brush flick rounds off or bends sharp corners"): sharp corners
	found in the pointer's own samples, before the 1 euro filter. A quick hand sends only 2 to 5
	samples along each straight leg of an M or a V; the filter lags a quick hand, so at the turn
	it cut across (the middle of an M landed 55 px short, a flat U) and nothing after it could
	put the corner back. A corner found here goes in as it is and the filter starts again from it
	(filter.js take), so the smoothing and the fit see a sharp turn and never run a curve across
	it (smooth.js and skeleton.js already keep a sharp turn as a curve end).

	Screen pixels (the filter's units). A corner is:
	  - one sample where the line turns more than RAW_TURN degrees, both legs at least LEG_PX
	    long (a slow hand's jitter, a pixel or two a step, is never a corner); or
	  - a tip that fell between two samples (the mouse never reported the turning point): two
	    turns the same way adding up to more than RAW_TURN, the step between them shorter than
	    SHORT_SHARE of the legs on either side (so a quick round o, where every step is about
	    the same, stays round). The corner is where the two legs meet, carried on straight.
	A turn under RAW_TURN (a quick curve: 12 samples round an o turn 30 degrees each) is left to
	the filter and the smoothing, as before.

	  RAW_TURN, LEG_PX, SHORT_SHARE
	  makeCornerFinder()
	    add([x, y], t)    a pointer sample (one within REST_PX of the last is left out); returns
	                      the corner it shows between the samples before it, { point, t }, or null
*/
import { dist, sub, turnAt, cross } from './geometry.js';

export const RAW_TURN = 100;
export const LEG_PX = 6;
export const SHORT_SHARE = 0.6;
/** A sample this close to the last one is the pen resting, not a step */
const REST_PX = 0.5;
/** A tip between two samples lies no farther past either of them than this many middle steps */
const TIP_REACH = 2;

/** @returns {{add: Function}} */
export function makeCornerFinder() {
	/** the last samples kept, { point, t }; after a corner it is the first, the ones before go */
	let kept = [];

	const single = (a, b, c) =>
		dist(a.point, b.point) >= LEG_PX &&
		dist(b.point, c.point) >= LEG_PX &&
		Math.abs(turnAt(a.point, b.point, c.point)) > RAW_TURN;

	const between = (a, b, c, d) => {
		const first = turnAt(a.point, b.point, c.point);
		const second = turnAt(b.point, c.point, d.point);
		if (Math.sign(first) !== Math.sign(second) || !first) return null;
		if (Math.abs(first) + Math.abs(second) <= RAW_TURN) return null;
		const legIn = dist(a.point, b.point);
		const middle = dist(b.point, c.point);
		const legOut = dist(c.point, d.point);
		if (legIn < LEG_PX || legOut < LEG_PX || middle > SHORT_SHARE * Math.min(legIn, legOut)) {
			return null;
		}
		// where the leg in (a -> b, on past b) meets the leg out (d -> c, on past c)
		const along = sub(b.point, a.point);
		const back = sub(c.point, d.point);
		const across = cross(along, back);
		if (!across) return null;
		const gap = sub(c.point, b.point);
		const s = cross(gap, back) / across;
		const u = cross(gap, along) / across;
		const point = [b.point[0] + along[0] * s, b.point[1] + along[1] * s];
		const pastB = s * Math.hypot(...along);
		const pastC = u * Math.hypot(...back);
		if (!(pastB >= 0 && pastC >= 0)) return null;
		if (pastB > TIP_REACH * middle || pastC > TIP_REACH * middle) return null;
		const share = pastB / Math.max(1e-9, pastB + pastC);
		return { point, t: b.t + (c.t - b.t) * share };
	};

	return {
		add(point, t) {
			const [x, y] = point || [];
			if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
			const sample = { point: [x, y], t: Number.isFinite(t) ? t : kept.at(-1)?.t ?? 0 };
			const last = kept.at(-1);
			if (last && dist(last.point, sample.point) < REST_PX) return null;
			kept.push(sample);
			if (kept.length > 4) kept.shift();
			const n = kept.length;
			if (n >= 3 && single(kept[n - 3], kept[n - 2], kept[n - 1])) {
				const corner = kept[n - 2];
				kept = [corner, sample];
				return { point: [...corner.point], t: corner.t };
			}
			if (n >= 4) {
				const tip = between(kept[0], kept[1], kept[2], kept[3]);
				if (tip) {
					kept = [{ point: tip.point, t: tip.t }, sample];
					return { point: [...tip.point], t: tip.t };
				}
			}
			return null;
		},
	};
}
