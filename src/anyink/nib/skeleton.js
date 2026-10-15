// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush (RESEARCH 2.3, D-015): a stroke's center line, its skeleton. The filtered samples
	are smoothed along the line (smooth.js, at screen scale), simplified (simplify-js), split where
	the pen turned sharply (more than CORNER_TURN degrees at one point), and each run is fitted
	with curves (fit-curve, Schneider's method). The skeleton is what the nib is swept along, and
	what glyph.anyink.nib.strokes keeps so M10 can ink the stroke again with another nib. Every
	number in it is whole (7.2).

	B8 + B9 fix (hostile finding "brush cost grows with stroke length"): the skeleton is built as
	the samples come in. Once FREEZE_SAMPLES samples are waiting, the first CUT_SAMPLES of them
	are fitted for good (frozen) and never fitted again; only the rest (the tail) is fitted again
	each frame, so a frame costs the same at the end of a 40-second stroke as at its start (a
	15-loop stroke spent up to 125 ms a frame refitting all of it; now under 5 ms). A freeze waits
	until the line has run far enough past the cut for the smoothing there to be settled, so the
	tail is a little longer when the pen moves very slowly. Where the frozen part ends,
	both sides take the line's own direction there, so the join is smooth (unless the line turns
	sharply right there, where it is a corner on both sides). What is frozen depends only on the
	samples, never on when frames came, so the skeleton the brush draws while the button is down,
	the one it inks on release, and makeSkeleton on the same samples are the same curves.

	  CORNER_TURN                      degrees; a sharper turn at one point is a corner
	  FREEZE_SAMPLES, CUT_SAMPLES      samples waiting before a freeze, and how many it freezes
	                                   (64 and 32: fit-curve's time on a tail of 160 samples
	                                   swung from 1 to 8 ms with the hand, too close to a frame)
	  CUT_PX, MAX_TAIL_SAMPLES         B8 + B9 finalize: a freeze also covers at least CUT_PX
	                                   screen pixels of the line forward (a slow hand's stroke was
	                                   cut into many short pieces, each its own curve: 55 curves
	                                   round an o at 10 px a second), unless MAX_TAIL_SAMPLES are
	                                   waiting
	  CLICK                            font units; a press that moves less is a click
	  skeletonTolerance(size, pixel)   { simplify, fit, step }: how far (font units) the
	                                   simplified line and the curves may stray, scaled to the nib
	                                   (a thick nib isn't fussed over, a thin one stays true) and to
	                                   the screen: pixel is font units per screen pixel, so the
	                                   pointer's whole-pixel steps never become bumps in the ink
	  makeSkeletonBuilder({ size, pixel })   one stroke's skeleton as it is drawn:
	    add([x, y])                    a filtered sample, font units
	    curves()                       the skeleton so far (frozen curves, then the tail fitted
	                                   to the samples so far)
	    frozenCount()                  how many curves are frozen
	    frozenSince(k)                 the frozen curves from the k-th on (they never change)
	    tail()                         the tail fitted to the samples so far, starting where the
	                                   frozen curves end
	    tailSamples()                  how many samples the tail has (what a frame refits)
	    finish()                       the finished skeleton (the last sample is the stroke's end,
	                                   even one closer than smooth.js MIN_STEP_PX to the one
	                                   before: B8 + B9 finalize)
	  makeSkeleton(points, { size, pixel })   the same for samples all at once:
	                                   [[start, handle, handle, end], ...] in whole font units; []
	                                   for no points; one still curve [p, p, p, p] for a click (or
	                                   a long press that wandered less than a unit)
*/
import { densify, dist, turnAt, unit, wholePoint, sub } from './geometry.js';
import { fitLine, fitLineWith } from './fit.js';
import { CORNER_TURN, SMOOTH_PX, makeLineSmoother } from './smooth.js';
import { simplify } from './vendor/simplify.js';

export { CORNER_TURN };
export const CLICK = 0.5;
export const FREEZE_SAMPLES = 64;
export const CUT_SAMPLES = 32;
/** A frozen piece covers at least this many screen pixels of the line forward (B8 + B9 finalize) */
export const CUT_PX = 24;
/** ...unless this many samples are waiting: then CUT_SAMPLES, so a frame's work stays bounded */
export const MAX_TAIL_SAMPLES = 4 * FREEZE_SAMPLES;

/**
 * @param {Number} size - the nib, font units
 * @param {Number} [pixel] - font units per screen pixel (0: no screen)
 * @returns {{simplify: Number, fit: Number, step: Number}}
 */
export function skeletonTolerance(size, pixel = 0) {
	const nib = Math.max(1, Number(size) || 1);
	const screen = Math.max(0, Number(pixel) || 0);
	return {
		simplify: Math.max(0.3, 0.003 * nib, 0.5 * screen),
		fit: Math.max(0.75, 0.01 * nib, 0.75 * screen),
		step: Math.max(2, Math.min(12, nib / 8)),
	};
}

/**
 * @param {Array<[Number, Number]>} points - the filtered samples, font units
 * @param {{size: Number, pixel?: Number}} options
 * @returns {Array<Array<[Number, Number]>>}
 */
export function makeSkeleton(points, { size, pixel = 0 }) {
	const builder = makeSkeletonBuilder({ size, pixel });
	(points || []).forEach((point) => builder.add(point));
	return builder.finish();
}

/**
 * @param {{size: Number, pixel?: Number}} options
 * @returns {Object} the builder
 */
export function makeSkeletonBuilder({ size, pixel = 0 }) {
	const tolerance = skeletonTolerance(size, pixel);
	const screen = Math.max(0, Number(pixel) || 0);
	const line = makeLineSmoother(SMOOTH_PX * screen);
	/** font units per screen pixel (1 with no screen) */
	const screenUnit = screen || 1;
	/** How far each way the line's direction at a cut is read, font units */
	const tangentReach = Math.max(line.settledReach / 3, tolerance.step);
	const frozen = [];
	/** The tail's first sample */
	let from = 0;
	/** The tail's first point (the frozen part's end) and the line's direction there */
	let head = null;
	let headDirection = null;

	/** The tail's line: its first point, then each sample smoothed */
	const tailLine = (to) => {
		const points = [head || line.at(from)];
		for (let i = from + 1; i <= to; i++) points.push(line.at(i));
		return points;
	};

	/** The direction of the line at sample i, or null where it turns sharply (a corner) */
	const directionAt = (i) => {
		const along = (length) => {
			const target = line.arcAt(i) + length;
			let j = i;
			if (length < 0) while (j > 0 && line.arcAt(j) > target) j--;
			else while (j < line.count() - 1 && line.arcAt(j) < target) j++;
			return line.at(j);
		};
		const before = along(-tangentReach);
		const at = line.at(i);
		const after = along(tangentReach);
		if (Math.abs(turnAt(before, at, after)) > CORNER_TURN) return null;
		const direction = unit(sub(after, before));
		return direction[0] || direction[1] ? direction : null;
	};

	const freeze = () => {
		// at least CUT_SAMPLES samples, and (B8 + B9 finalize) at least CUT_PX of the line forward,
		// so a slow hand's stroke isn't cut into many short pieces (each a curve of its own);
		// past MAX_TAIL_SAMPLES waiting, CUT_SAMPLES anyway, so a frame's work stays bounded
		let cut = from + CUT_SAMPLES;
		const waiting = line.count() - from;
		if (waiting < MAX_TAIL_SAMPLES) {
			const want = line.progressAt(from) + CUT_PX * screenUnit;
			while (cut < line.count() - 1 && line.progressAt(cut) < want) cut++;
		}
		// the cut's place and direction must be settled: the line runs far enough past it
		const room = line.arcAt(line.count() - 1) - line.arcAt(cut);
		if (cut >= line.settled() || room < line.settledReach + tangentReach) return;
		const direction = directionAt(cut);
		const curves = fitLineOf(tailLine(cut), tolerance, {
			left: headDirection,
			right: direction ? [-direction[0], -direction[1]] : null,
		});
		const start = frozen.at(-1)?.[3] || head;
		const chain = wholeChain(curves, start);
		if (!start && chain.length === 1 && isStill(chain[0])) {
			// the pen hasn't gone anywhere yet: nothing to freeze, but the line starts here
			head = chain[0][0];
		} else {
			frozen.push(...chain);
			if (frozen.length) head = frozen.at(-1)[3];
		}
		headDirection = direction;
		from = cut;
	};

	const tail = () => {
		const last = line.count() - 1;
		if (last < 0) return [];
		if (!frozen.length) {
			const first = line.raw(0);
			let still = true;
			for (let i = 1; i <= last && still; i++) still = dist(line.raw(i), first) < CLICK;
			if (still) {
				const at = wholePoint(first);
				return [[at, at, at, at]];
			}
		}
		if (last <= from) return [];
		const curves = fitLineOf(tailLine(last), tolerance, { left: headDirection, right: null });
		const chain = wholeChain(curves, frozen.at(-1)?.[3] || head);
		if (chain.length || frozen.length) return chain;
		// a press that wandered less than a unit: a dot where it started
		const at = head || wholePoint(line.raw(0));
		return [[at, at, at, at]];
	};

	return {
		add(point) {
			if (!line.add(point)) return;
			if (line.count() - from >= FREEZE_SAMPLES) freeze();
		},
		curves: () => [...frozen, ...tail()],
		frozenCount: () => frozen.length,
		frozenSince: (k = 0) => frozen.slice(k),
		tail,
		tailSamples: () => Math.max(0, line.count() - from),
		finish: () => {
			// the stroke ends where the pen did, even when its last move was a hair's
			if (line.flush() && line.count() - from >= FREEZE_SAMPLES) freeze();
			return [...frozen, ...tail()];
		},
	};
}

/**
 * A line of points to curves: simplified, split at its corners, each run fitted; the first
 * run starts in the direction `left` and the last ends in the direction `right` when given.
 * @param {Array<[Number, Number]>} points
 * @param {{simplify: Number, fit: Number, step: Number}} tolerance
 * @param {{left?: [Number, Number] | null, right?: [Number, Number] | null}} ends
 * @returns {Array<Array<[Number, Number]>>}
 */
function fitLineOf(points, tolerance, { left = null, right = null }) {
	const simplified = simplify(
		points.map(([x, y]) => ({ x, y })),
		tolerance.simplify,
		true
	).map(({ x, y }) => [x, y]);
	if (simplified.length < 2) return [];
	const runs = splitAtCorners(simplified);
	return runs.flatMap((run, i) =>
		fitRun(run, tolerance, {
			left: i === 0 ? left : null,
			right: i === runs.length - 1 ? right : null,
		})
	);
}

/**
 * @param {Array<[Number, Number]>} points
 * @returns {Array<Array<[Number, Number]>>} runs that share their corner points
 */
function splitAtCorners(points) {
	const runs = [];
	let run = [points[0]];
	for (let i = 1; i < points.length - 1; i++) {
		run.push(points[i]);
		if (Math.abs(turnAt(points[i - 1], points[i], points[i + 1])) > CORNER_TURN) {
			runs.push(run);
			run = [points[i]];
		}
	}
	run.push(points.at(-1));
	runs.push(run);
	return runs;
}

/**
 * @param {Array<[Number, Number]>} run
 * @param {{fit: Number, step: Number}} tolerance
 * @param {{left: [Number, Number] | null, right: [Number, Number] | null}} ends
 * @returns {Array<Array<[Number, Number]>>}
 */
function fitRun(run, tolerance, { left, right }) {
	if (run.length === 2 && !left && !right) return [lineCurve(run[0], run[1])];
	const dense = densify(run, tolerance.step);
	if (dense.length < 2) return [];
	const curves =
		left || right
			? fitLineWith(
					dense,
					left || unit(sub(dense[1], dense[0])),
					right || unit(sub(dense.at(-2), dense.at(-1))),
					tolerance.fit
			  )
			: fitLine(dense, tolerance.fit);
	return curves.length ? curves : [lineCurve(run[0], run.at(-1))];
}

/** A straight curve, its handles a third of the way along */
function lineCurve(a, b) {
	const third = (k) => [a[0] + ((b[0] - a[0]) * k) / 3, a[1] + ((b[1] - a[1]) * k) / 3];
	return [a, third(1), third(2), b];
}

/**
 * Rounds a chain of curves to whole units, each curve starting exactly where the one before it
 * ends (the first where `start` is, when given), and drops a curve that rounding shrank to
 * nothing (unless it is all there is).
 * @param {Array<Array<[Number, Number]>>} curves
 * @param {[Number, Number] | null} start - the end of the curves already in the skeleton
 * @returns {Array<Array<[Number, Number]>>}
 */
function wholeChain(curves, start) {
	const out = [];
	let end = start;
	curves.forEach((curve) => {
		const whole = curve.map(wholePoint);
		if (end) whole[0] = end;
		const still = whole.every(([x, y]) => x === whole[0][0] && y === whole[0][1]);
		if (!still || (!out.length && !start)) {
			out.push(whole);
			end = whole[3];
		}
	});
	if (!start && out.length > 1 && isStill(out[0])) out.shift();
	return out;
}

const isStill = (curve) => curve.every(([x, y]) => x === curve[0][0] && y === curve[0][1]);
