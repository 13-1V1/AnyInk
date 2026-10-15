// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 fix (first-timer finding "a very shaky, slow brush drag gives a lumpy edge"): the
	filtered samples are smoothed once more along the line before the center line is fitted. The 1
	euro filter smooths in time; at a slow, shaky drag it still lets through wobbles of about a
	pixel a few pixels apart, the fit followed them, and the ink's edge rippled (85 points on one
	outline of an o). This averages each sample with its neighbours along the line (a Gaussian
	SMOOTH_PX screen pixels wide), so a slow hand, which leaves many samples per pixel, is smoothed
	hardest and a quick one hardly at all. Where the line turns sharply (a corner: more than
	CORNER_TURN degrees between the CORNER_REACH before a point and the CORNER_REACH after it)
	nothing is averaged across, so the tip of a V stays where he put it; the two ends of the
	stroke stay put too.

	B8 + B9 finalize (the second hostile pass):
	- How far apart two samples are, for the Gaussian and the corners, is how far the line went
	  forward between them (progress), not how far the pen travelled: a shaking pen moving slowly
	  travels many times the distance it covers (at 7 to 8 px a second the o came out as lumpy as
	  before the fix). Progress is how far a point on a rope ROPE_PX long, pulled along by the
	  pen, has moved: shaking within the rope's length moves it nowhere, a real turn moves it as
	  far as the pen goes; a step that pulls nothing still adds PROGRESS_FLOOR of itself, so
	  progress always grows.
	- A sample closer than MIN_STEP_PX to the last one kept is left out (the last one left out
	  comes back as the stroke's end, flush): a pen resting mid-stroke keeps sending samples a
	  fraction of a pixel apart, and before this the tail never froze (frames of 78 ms after 10 s
	  at 240 Hz, 214 ms after 20 s).
	- Corners near either end of the line drawn so far are judged on the chords there are, at
	  least a third of the reach long: a sharp turn just before the end (a short flick back up)
	  was never found and the tip came out 3.5 px short; near the start likewise.

	It works as the samples come in: a sample's smoothed place is settled once the line has gone
	far enough forward past it (settledReach), so the part of a stroke drawn earlier never moves
	again.

	  SMOOTH_PX                  the Gaussian's width (sigma), screen pixels
	  MIN_STEP_PX                samples closer than this to the last kept one are left out
	  makeLineSmoother(sigma)    sigma in font units (0: no smoothing):
	    add([x, y])              a sample in (one closer than MIN_STEP_PX, or 1/1000 unit with no
	                             smoothing, to the last is left out); returns false for that one
	    flush()                  the last sample left out comes in after all (the stroke's end);
	                             returns true when one did
	    count()                  samples so far
	    raw(i)                   sample i as it came in
	    arcAt(i)                 the length of the line up to sample i
	    progressAt(i)            how far forward the line had gone at sample i
	    settled()                how many samples have their smoothed place settled
	    at(i)                    sample i smoothed; one not settled yet is smoothed with the
	                             line drawn so far (the last sample stays where it is, as the
	                             end of a finished stroke does)
	    isCorner(i)              true for a settled corner
	    settledReach             how far forward (font units) the line must run past a sample to
	                             settle it
	  CORNER_TURN                degrees, the same as the center line's own corner rule
*/
import { dist, turnAt } from './geometry.js';

export const SMOOTH_PX = 3;
export const CORNER_TURN = 65;
export const MIN_STEP_PX = 0.25;
/** Progress: the rope's length, screen pixels (more than what the filter lets a shake through) */
export const ROPE_PX = 1;
/** A step that goes nowhere forward still counts this share of its length as progress */
export const PROGRESS_FLOOR = 0.05;
/** The Gaussian reaches this many sigmas each way */
const SIGMAS = 3;
/** A corner near an end needs a chord at least this share of the reach on that side */
const END_CHORD_SHARE = 1 / 3;

/**
 * @param {Number} sigma - font units
 * @returns {Object} the smoother
 */
export function makeLineSmoother(sigma) {
	const width = Number(sigma) > 0 ? Number(sigma) : 0;
	const reach = SIGMAS * width;
	// SMOOTH_PX screen pixels is `width` font units
	const minStep = width ? (MIN_STEP_PX * width) / SMOOTH_PX : 1e-3;
	const points = [];
	const arcs = [];
	/** progress: how far forward the line went (see the header) */
	const prog = [];
	/** the point on the rope (see progressTo) and the rope's length, font units */
	let rope = null;
	const ropeLength = width ? (ROPE_PX * width) / SMOOTH_PX : 0;
	/** the last sample left out, which flush() brings in */
	let pending = null;
	/** cornerness (degrees) of each sample, once its chords are there */
	const turns = [];
	/** true / false once decided */
	const corners = [];
	/** smoothed places once settled */
	const smooth = [];
	/** undecided corners near the end of the line so far, worked out once per sample count */
	let provisional = new Map();
	let provisionalFor = -1;

	const settledReach = 3 * reach;

	/** The first sample at least `length` forward from i (backwards for a negative), or -1 */
	const indexAlong = (i, length) => {
		const target = prog[i] + length;
		if (length < 0) {
			let j = i;
			while (j > 0 && prog[j] > target) j--;
			return prog[j] <= target ? j : -1;
		}
		let j = i;
		while (j < points.length - 1 && prog[j] < target) j++;
		return prog[j] >= target ? j : -1;
	};

	/**
	 * How sharply the line turns at i, over the reach each way; near an end, over the chord there
	 * is when it is at least END_CHORD_SHARE of the reach; null when there is too little
	 */
	const turnOf = (i, { toEnd = false } = {}) => {
		let before = indexAlong(i, -reach);
		let after = indexAlong(i, reach);
		if (before < 0 && prog[i] - prog[0] >= END_CHORD_SHARE * reach) before = 0;
		const last = points.length - 1;
		if (after < 0 && toEnd && prog[last] - prog[i] >= END_CHORD_SHARE * reach) after = last;
		if (before < 0 || after < 0 || before === i || after === i) return null;
		return Math.abs(turnAt(points[before], points[i], points[after]));
	};

	/** Decide what can be decided: a corner is the sharpest turn within its reach */
	const decide = () => {
		const end = prog.at(-1);
		for (let i = turns.length; i < points.length && end - prog[i] >= reach; i++) {
			turns.push(turnOf(i));
		}
		for (let i = corners.length; i < turns.length; i++) {
			if (end - prog[i] < 2 * reach) break;
			corners.push(sharpest(i, (j) => turns[j]));
		}
	};

	/** True when i turns more than CORNER_TURN and more than every sample within its reach */
	const sharpest = (i, turnAtIndex) => {
		const turn = turnAtIndex(i);
		if (turn === null || turn === undefined || !(turn > CORNER_TURN)) return false;
		for (let j = i - 1; j >= 0 && prog[i] - prog[j] <= reach; j--) {
			if ((turnAtIndex(j) ?? 0) >= turn) return false;
		}
		for (let j = i + 1; j < points.length && prog[j] - prog[i] <= reach; j++) {
			if ((turnAtIndex(j) ?? 0) > turn) return false;
		}
		return true;
	};

	/** A corner: decided, or (near the end of the line so far) judged on the chords there are */
	const cornerAt = (k) => {
		if (k < corners.length) return corners[k];
		if (provisionalFor !== points.length) {
			provisional = new Map();
			provisionalFor = points.length;
		}
		if (!provisional.has(k)) {
			const turnHere = (j) => {
				if (j < turns.length && turns[j] !== null) return turns[j];
				const key = `t${j}`;
				if (!provisional.has(key)) provisional.set(key, turnOf(j, { toEnd: true }));
				return provisional.get(key);
			};
			provisional.set(k, sharpest(k, turnHere));
		}
		return provisional.get(k);
	};

	/** The Gaussian at i, inside [lo, hi], its reach cut down to stay even on both sides */
	const average = (i, lo, hi) => {
		const r = Math.min(reach, prog[i] - prog[lo], prog[hi] - prog[i]);
		if (!(r > 0)) return points[i];
		const s = r / SIGMAS;
		let x = 0;
		let y = 0;
		let total = 0;
		for (let j = i; j >= lo && prog[i] - prog[j] <= r; j--) {
			const d = prog[i] - prog[j];
			const k = Math.exp(-(d * d) / (2 * s * s));
			x += k * points[j][0];
			y += k * points[j][1];
			total += k;
		}
		for (let j = i + 1; j <= hi && prog[j] - prog[i] <= r; j++) {
			const d = prog[j] - prog[i];
			const k = Math.exp(-(d * d) / (2 * s * s));
			x += k * points[j][0];
			y += k * points[j][1];
			total += k;
		}
		return [x / total, y / total];
	};

	/** The nearest corner at or before i (0 when none), and at or after i (or the end) */
	const bounds = (i) => {
		let lo = i;
		while (lo > 0 && !cornerAt(lo) && prog[i] - prog[lo] <= reach) lo--;
		let hi = i;
		while (hi < points.length - 1 && !cornerAt(hi) && prog[hi] - prog[i] <= reach) hi++;
		return [lo, hi];
	};

	const smoothedAt = (i) => {
		if (!reach || i === 0 || cornerAt(i)) return points[i];
		const [lo, hi] = bounds(i);
		return average(i, lo, hi);
	};

	const settle = () => {
		const end = prog.at(-1);
		while (smooth.length < points.length && end - prog[smooth.length] >= settledReach) {
			smooth.push(smoothedAt(smooth.length));
		}
	};

	/**
	 * How far forward a new sample takes the line (see the header): a point on a rope ROPE_PX
	 * long follows the pen and moves only once the pen pulls the rope tight, so shaking within
	 * the rope's length moves it nowhere while a real turn (a flick back up) moves it as far as
	 * the pen goes
	 */
	const progressTo = (point) => {
		const n = points.length;
		if (!n) {
			rope = [...point];
			return 0;
		}
		const step = dist(points[n - 1], point);
		const pull = dist(rope, point);
		let moved = 0;
		if (pull > ropeLength) {
			moved = pull - ropeLength;
			const t = moved / pull;
			rope = [rope[0] + (point[0] - rope[0]) * t, rope[1] + (point[1] - rope[1]) * t];
		}
		return prog[n - 1] + Math.max(moved, PROGRESS_FLOOR * step);
	};

	const take = (point) => {
		const last = points.at(-1);
		const forward = progressTo(point);
		arcs.push(last ? arcs.at(-1) + dist(last, point) : 0);
		prog.push(forward);
		points.push(point);
		if (!reach) {
			smooth.push(points.at(-1));
			return;
		}
		decide();
		settle();
	};

	return {
		settledReach,
		add(point) {
			const [x, y] = point || [];
			if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
			const last = points.at(-1);
			if (last && dist(last, [x, y]) <= minStep) {
				// a pen resting, or a hair's move: no new sample, but the stroke may end here
				pending = dist(last, [x, y]) > 1e-3 ? [x, y] : null;
				return false;
			}
			pending = null;
			take([x, y]);
			return true;
		},
		flush() {
			if (!pending) return false;
			const point = pending;
			pending = null;
			take(point);
			return true;
		},
		count: () => points.length,
		raw: (i) => points[i],
		arcAt: (i) => arcs[i],
		progressAt: (i) => prog[i],
		settled: () => smooth.length,
		isCorner: (i) => corners[i] === true,
		at(i) {
			if (i < smooth.length) return smooth[i];
			if (i === points.length - 1 || !reach) return points[i];
			// not settled: smoothed with the line so far, which ends at the last sample
			return smoothedAt(i);
		},
	};
}
