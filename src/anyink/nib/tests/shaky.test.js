// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 fix (first-timer finding "a very shaky, slow brush drag gives a lumpy edge"): a slow o
	with about 2 pixels of shake on every mouse event came out with a rippled edge (65 and 48
	curves on its two outlines here; 85 and 74 points in Chrome), where the same o drawn steadily
	was smooth. The samples are now smoothed along the line before the center line is fitted
	(smooth.js), more where the hand is slow, never across a sharp corner, never moving the ends.
	  - the shaky o's edge has no more small ripples than a steady o's, and about as few curves
	  - the tip of a V stays where the hand put it
	  - the stroke still starts and ends where the pen did
	Measured in screen pixels at 40 % zoom, the default nib (99 units), a 125 Hz mouse.
*/
import { describe, expect, it } from 'vitest';
import { makeStrokeFilter } from '../filter.js';
import { flattenCurves } from '../geometry.js';
import { inkStroke } from '../ink.js';
import { makeLineSmoother } from '../smooth.js';
import { asMouse, line, vee } from './strokes.js';

const SIZE = 99;
const DZ = 0.4;
const PIXEL = 1 / DZ;
const RATE = 125;
const RX = 105;
const RY = 115;

/**
 * An o in screen pixels round (0, 0), as the mouse sends it: walked at `speed` px/s, shaken by
 * up to `shake` px each way on every event (repeatable), through the 1 euro filter, settled, in
 * font units
 */
function shakyO({ speed, shake, seed = 11 }) {
	let state = seed;
	const random = () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647 - 0.5;
	};
	const count = Math.ceil((2 * Math.PI * 110 * (362 / 360)) / (speed / RATE));
	const events = Array.from({ length: count + 1 }, (_, i) => {
		const a = ((-100 + (362 * i) / count) * Math.PI) / 180;
		return [RX * Math.cos(a) + 2 * shake * random(), RY * Math.sin(a) + 2 * shake * random()];
	});
	const filter = makeStrokeFilter();
	const out = events.map(([x, y], i) => filter.push(x, y, i / RATE));
	const [x, y] = events.at(-1);
	out.push(...filter.settle(x, y, (events.length - 1) / RATE));
	return out.map((point) => [point.x / DZ, -point.y / DZ]);
}

/** The outer edge's distance from the o's middle, every half degree round, screen pixels */
function outerEdge(contours) {
	const outer = contours
		.filter((contour) => !contour.hole)
		.sort((a, b) => b.curves.length - a.curves.length)[0];
	const points = flattenCurves(outer.curves, 0.05).map(([x, y]) => [x * DZ, -y * DZ]);
	return Array.from({ length: 720 }, (_, k) => {
		const a = (2 * Math.PI * k) / 720;
		const [dx, dy] = [Math.cos(a), Math.sin(a)];
		let far = 0;
		points.forEach(([x1, y1], i) => {
			const [x2, y2] = points[(i + 1) % points.length];
			const [ex, ey] = [x2 - x1, y2 - y1];
			const den = dx * ey - dy * ex;
			if (Math.abs(den) < 1e-12) return;
			const t = (x1 * ey - y1 * ex) / den;
			const u = (x1 * dy - y1 * dx) / den;
			if (t > 0 && u >= 0 && u <= 1) far = Math.max(far, t);
		});
		return far;
	});
}

/** What is left of the edge once its first 40 waves round are taken out: ripples under ~17 px
 * long, root mean square, pixels */
function ripple(radii, keep = 40) {
	const n = radii.length;
	const smooth = new Array(n).fill(0);
	for (let k = 0; k <= keep; k++) {
		let a = 0;
		let b = 0;
		radii.forEach((r, i) => {
			a += r * Math.cos((2 * Math.PI * k * i) / n);
			b += r * Math.sin((2 * Math.PI * k * i) / n);
		});
		a *= (k ? 2 : 1) / n;
		b *= 2 / n;
		for (let i = 0; i < n; i++) {
			const t = (2 * Math.PI * k * i) / n;
			smooth[i] += a * Math.cos(t) + (k ? b * Math.sin(t) : 0);
		}
	}
	return Math.sqrt(radii.reduce((sum, r, i) => sum + (r - smooth[i]) ** 2, 0) / n);
}

const curvesOf = (contours) => contours.map((contour) => contour.curves.length);

describe('a shaky, slow o comes out as smooth as a steady one', () => {
	const steady = inkStroke(shakyO({ speed: 150, shake: 0 }), { size: SIZE, pixel: PIXEL });
	const steadyRipple = ripple(outerEdge(steady.contours));

	it.each([
		['150 px a second', { speed: 150, shake: 2 }],
		['60 px a second', { speed: 60, shake: 2 }],
		['150 px a second, another hand', { speed: 150, shake: 2, seed: 99 }],
		// B8 + B9 finalize (second hostile pass: at 7 to 8 px a second the edge was as lumpy as
		// before the fix, 85 and 79 points in Chrome; the smoothing now reads how far the line
		// goes forward, not how far the shaking pen travels)
		['25 px a second', { speed: 25, shake: 2 }],
		['10 px a second', { speed: 10, shake: 2 }],
	])('%s, 2 px of shake on every event', (_, options) => {
		const { contours } = inkStroke(shakyO(options), { size: SIZE, pixel: PIXEL });
		// before: 0.15 px, five times the steady o's; now within a few hundredths of it
		expect(ripple(outerEdge(contours))).toBeLessThanOrEqual(steadyRipple + 0.05);
		// before: 65 and 48 curves; the steady o has 15 and 11
		curvesOf(contours).forEach((count) => expect(count).toBeLessThanOrEqual(30));
	});
});

describe('smoothing keeps what the hand meant', () => {
	it('the tip of a V stays where the hand put it (within 2 px; the filter alone lags ~1.4 px)', () => {
		const points = asMouse(vee(100, 0, 500), { dz: DZ, speed: 150, jitter: 0.4 });
		const { contours } = inkStroke(points, { size: SIZE, pixel: PIXEL });
		const bottom = Math.min(
			...contours.flatMap((contour) => flattenCurves(contour.curves, 0.1).map(([, y]) => y))
		);
		expect(Math.abs(bottom - -SIZE / 2) * DZ).toBeLessThanOrEqual(2);
	});

	// B8 + B9 finalize (second hostile pass): a sharp turn just before the end of a stroke (a
	// short flick back up) was never found as a corner, and the tip came out 3.5 px short
	it('a turn right before the end (a 12 px flick back up) stays where the hand put it', () => {
		const flick = [100 + 30 * Math.sin(Math.PI / 6), 100 + 30 * Math.cos(Math.PI / 6)];
		const path = [...line([100, 400], [100, 100]), ...line([100, 100], flick).slice(1)];
		const points = asMouse(path, { dz: DZ, speed: 150, jitter: 0.4 });
		const { contours } = inkStroke(points, { size: SIZE, pixel: PIXEL });
		const bottom = Math.min(
			...contours.flatMap((contour) => flattenCurves(contour.curves, 0.1).map(([, y]) => y))
		);
		expect(Math.abs(bottom - (100 - SIZE / 2)) * DZ).toBeLessThanOrEqual(2);
	});

	it('the stroke starts and ends where the pen did', () => {
		const points = shakyO({ speed: 150, shake: 2 });
		const { skeleton } = inkStroke(points, { size: SIZE, pixel: PIXEL });
		expect(skeleton[0][0]).toEqual(points[0].map(Math.round));
		expect(skeleton.at(-1)[3]).toEqual(points.at(-1).map(Math.round));
	});

	it('a sample once settled never moves again as the line goes on', () => {
		const points = shakyO({ speed: 150, shake: 2 });
		const smoother = makeLineSmoother(3 * PIXEL);
		const seen = [];
		points.forEach((point) => {
			smoother.add(point);
			for (let i = seen.length; i < smoother.settled(); i++) seen.push(smoother.at(i));
		});
		expect(seen.length).toBeGreaterThan(points.length / 2);
		seen.forEach((point, i) => expect(smoother.at(i)).toEqual(point));
	});

	it('no screen, no smoothing: the samples are used as they are', () => {
		const smoother = makeLineSmoother(0);
		[
			[0, 0],
			[3, 1],
			[6, -1],
		].forEach((point) => smoother.add(point));
		expect([0, 1, 2].map((i) => smoother.at(i))).toEqual([
			[0, 0],
			[3, 1],
			[6, -1],
		]);
	});
});
