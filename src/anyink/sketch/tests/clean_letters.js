// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Sketch S1 test helper: clean centerlines of small a, r, s, e and Capital B, built by hand from
	straight lines and circular arcs in the Brush's skeleton format [[p0, h1, h2, p3], ...], on
	the new-font lines (writing line 0, small-letter line 1100, capitals line 1480). These are what
	a tidy sketch of each letter looks like; the Bumpy measure must not call any of them bumpy.

	  line(a, b)                              one straight cubic
	  arc(cx, cy, rx, ry, from, to)           an elliptical arc, degrees, counterclockwise when
	                                          to > from; split every 90 degrees at most
	  cleanLetters()                          { a, r, s, e, B, o }: each a list of pieces
	                                          { name, skeleton, closed }
	  wobble(skeleton, amount, wavelength)    the same centerline with a sine wobble across it
	                                          (a shaky hand), as a skeleton of short straight cubics
*/

const RAD = Math.PI / 180;

/** @returns {Array<[Number, Number]>} */
export function line(a, b) {
	const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
	return [a, at(1 / 3), at(2 / 3), b];
}

/** @returns {Array<Array<[Number, Number]>>} */
export function arc(cx, cy, rx, ry, from, to) {
	const pieces = Math.max(1, Math.ceil(Math.abs(to - from) / 90));
	const step = (to - from) / pieces;
	const k = (4 / 3) * Math.tan((step * RAD) / 4);
	const at = (deg) => [cx + rx * Math.cos(deg * RAD), cy + ry * Math.sin(deg * RAD)];
	const tangent = (deg) => [-rx * Math.sin(deg * RAD), ry * Math.cos(deg * RAD)];
	const out = [];
	for (let i = 0; i < pieces; i++) {
		const a0 = from + step * i;
		const a1 = a0 + step;
		const p0 = at(a0);
		const p3 = at(a1);
		const t0 = tangent(a0);
		const t1 = tangent(a1);
		out.push([
			p0,
			[p0[0] + k * t0[0], p0[1] + k * t0[1]],
			[p3[0] - k * t1[0], p3[1] - k * t1[1]],
			p3,
		]);
	}
	return out;
}

const piece = (name, skeleton, closed = false) => ({ name, skeleton, closed });

/** @returns {Object<String, Array<{name: String, skeleton: Array, closed: Boolean}>>} */
export function cleanLetters() {
	return {
		// single-story a: the hook over into the stem; the bowl from the bar round to the stem
		a: [
			piece('hook and stem', [...arc(290, 800, 200, 230, 150, 0), line([490, 800], [490, 50])]),
			piece('bowl', [line([490, 560], [290, 560]), ...arc(290, 300, 200, 260, 90, 330)]),
		],
		// r: the stem, and the short ear leaving it
		r: [
			piece('stem', [line([80, 50], [80, 1050])]),
			piece('ear', arc(280, 800, 200, 250, 180, 60)),
		],
		// s: the top bowl turning left, the bottom bowl turning right
		s: [
			piece('spine', [...arc(300, 825, 230, 225, 20, 270), ...arc(300, 300, 250, 300, 90, -160)]),
		],
		// e: the bar, then round the bowl, open at the lower right
		e: [piece('bar and bowl', [line([60, 560], [540, 560]), ...arc(300, 560, 240, 510, 0, 320)])],
		// B: the stem and two bowls, each bowl a line out, a half circle and a line back
		B: [
			piece('stem', [line([80, 50], [80, 1430])]),
			piece('top bowl', [
				line([80, 1430], [320, 1430]),
				...arc(320, 1110, 320, 320, 90, -90),
				line([320, 790], [80, 790]),
			]),
			piece('bottom bowl', [
				line([80, 790], [360, 790]),
				...arc(360, 420, 370, 370, 90, -90),
				line([360, 50], [80, 50]),
			]),
		],
		// o: one closed ring
		o: [piece('ring', arc(300, 550, 250, 500, 90, 450), true)],
	};
}

/**
 * @param {Array<Array<[Number, Number]>>} skeleton
 * @param {Number} amount - how far the wobble swings each side, font units
 * @param {Number} wavelength - font units along the line
 * @returns {Array<Array<[Number, Number]>>}
 */
export function wobble(skeleton, amount, wavelength) {
	const points = [];
	for (const curve of skeleton) {
		for (let i = points.length ? 1 : 0; i <= 40; i++) {
			const t = i / 40;
			const u = 1 - t;
			const [p0, p1, p2, p3] = curve;
			points.push([
				u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
				u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
			]);
		}
	}
	let along = 0;
	const moved = points.map((point, i) => {
		if (i) along += Math.hypot(point[0] - points[i - 1][0], point[1] - points[i - 1][1]);
		const before = points[Math.max(0, i - 1)];
		const after = points[Math.min(points.length - 1, i + 1)];
		const dx = after[0] - before[0];
		const dy = after[1] - before[1];
		const length = Math.hypot(dx, dy) || 1;
		const shift = amount * Math.sin((2 * Math.PI * along) / wavelength);
		return [point[0] - (dy / length) * shift, point[1] + (dx / length) * shift];
	});
	return moved.slice(1).map((point, i) => line(moved[i], point));
}
