// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper for B3 placement: pen strokes for a few handwritten letters, in "cap units"
	(capitals 100 tall, small letters 60, tall letters 106, tails down to 44; y down, the
	writing line at 0), turned into image pixels by drawLetter. Each letter is the shape the
	seating rules find hardest: g's tail hooks back as wide as its bowl, Q's tail dips under
	its bowl, a dropping f has a crossbar and a bottom hook wider than half the letter.
	photoOf can turn the whole photo a little (tilt, degrees, about the middle of the image), the
	way a phone held off square does.
*/
import { arc, drawPart } from './raster.js';

const TWO_PI = Math.PI * 2;
const line = (...points) => points;

/** @type {Object<String, (options: Object) => Array>} strokes in cap units */
export const LETTER_STROKES = {
	a: () => [arc(22, -30, 22, 30, 0, TWO_PI), line([44, -60], [44, 0])],
	B: () => [
		line([0, 0], [0, -100]),
		[[0, -100], [28, -100], ...arc(28, -76, 22, 24, -Math.PI / 2, Math.PI / 2), [0, -52]],
		[[0, -52], [32, -52], ...arc(32, -26, 26, 26, -Math.PI / 2, Math.PI / 2), [0, 0]],
	],
	H: () => [line([0, 0], [0, -100]), line([56, 0], [56, -100]), line([0, -50], [56, -50])],
	A: () => [line([0, 0], [28, -100], [56, 0]), line([12, -40], [44, -40])],
	Y: () => [line([0, -100], [28, -50], [56, -100]), line([28, -50], [28, 0])],
	n: () => [line([0, 0], [0, -60]), [[0, -40], ...arc(20, -40, 20, 20, Math.PI, TWO_PI), [40, 0]]],
	o: () => [arc(24, -30, 24, 30, 0, TWO_PI)],
	e: () => [line([0, -30], [48, -30]), arc(24, -30, 24, 30, 0, (-7 * Math.PI) / 4)],
	l: () => [line([0, -106], [0, 0])],
	m: () => [
		line([0, 0], [0, -60]),
		[[0, -40], ...arc(15, -40, 15, 20, Math.PI, TWO_PI), [30, 0]],
		[[30, -40], ...arc(45, -40, 15, 20, Math.PI, TWO_PI), [60, 0]],
	],
	u: () => [line([0, -60], [0, -20]), arc(20, -20, 20, 20, Math.PI, 0), line([40, -60], [40, 0])],
	c: () => [arc(24, -30, 24, 30, -Math.PI / 4, (-7 * Math.PI) / 4)],
	z: () => [line([0, -60], [40, -60], [0, 0], [40, 0])],
	x: () => [line([0, -60], [40, 0]), line([40, -60], [0, 0])],
	v: () => [line([0, -60], [20, 0], [40, -60])],
	g: () => [
		arc(22, -30, 22, 30, 0, TWO_PI),
		line([44, -60], [44, 26]),
		arc(24, 26, 20, 18, 0, Math.PI),
	],
	p: () => [line([0, -60], [0, 44]), arc(22, -30, 22, 30, 0, TWO_PI)],
	y: () => [line([0, -60], [22, 0]), line([44, -60], [14, 44])],
	j: () => [line([30, -78], [31, -77]), [[30, -60], [30, 30], ...arc(16, 30, 14, 14, 0, Math.PI)]],
	Q: ({ tail = true } = {}) => [
		arc(34, -50, 34, 50, 0, TWO_PI, 120),
		tail ? line([40, -16], [70, 20]) : line([44, -14], [62, -2]),
	],
	f: ({ tail = false } = {}) => [
		[[16, tail ? 30 : 0], [16, -90], ...arc(28, -90, 12, 14, Math.PI, TWO_PI)],
		line([2, -60], [34, -60]),
		...(tail ? [arc(6, 30, 10, 12, 0, Math.PI)] : []),
	],
	'.': () => [line([0, -4], [2, -5])],
	',': () => [arc(3, -4, 2, 2, 0, TWO_PI, 24), line([5, -3], [0, 10])],
	"'": () => [line([0, -100], [-2, -84])],
	'-': () => [line([0, -30], [30, -30])],
};

/**
 * @param {String} char - a key of LETTER_STROKES
 * @param {Object} [options]
 * @param {Number} [options.unit=2] - pixels per cap unit
 * @param {Number} [options.pen=12] - pen width in pixels
 * @param {Number} [options.x0=60] - left of the letter's drawing origin, pixels
 * @param {Number} [options.base=300] - the writing line, pixels from the top
 * @param {Number} [options.size=400] - the square image's side, pixels
 * @param {Boolean} [options.tail] - Q and f: with or without a tail
 * @returns {Object} the part (tight box and mask)
 */
export function drawLetter(
	char,
	{
		unit = 2,
		pen = 12,
		x0 = 60,
		base = 300,
		size = 400,
		width = size,
		height = size,
		tail,
		id = char,
		tilt = 0,
	} = {}
) {
	const turn = turner(tilt, width, height);
	const strokes = LETTER_STROKES[char]({ tail }).map((stroke) =>
		stroke.map(([x, y]) => turn([x0 + x * unit, base + y * unit]))
	);
	return drawPart(strokes, pen, { width, height, id });
}

/**
 * Turns image points about the middle of the image, as the whole photo turns.
 * @param {Number} degrees - clockwise on screen (y down)
 * @returns {(point: [Number, Number]) => [Number, Number]}
 */
export function turner(degrees, width, height) {
	const a = (degrees * Math.PI) / 180;
	const cx = width / 2;
	const cy = height / 2;
	return ([x, y]) => [
		cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
		cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
	];
}

/**
 * A photo of several letters, each its own part (its mask holds only its own ink).
 * @param {Array<{char: String, x0: Number, base?: Number, unit?: Number, drawTail?: Boolean,
 *   named?: Boolean, use?: Object, id?: String}>} specs - named false leaves the part unnamed;
 *   use adds to its use record ({ tail, itemId })
 * @param {Object} [options] - width, height, pen, asset; tilt: the whole photo turned this many
 *   degrees (clockwise on screen) about its middle
 * @returns {{asset: String, parts: Array<Object>, uses: Object}}
 */
export function photoOf(
	specs,
	{ width = 1600, height = 700, pen = 12, asset = 'img-test', tilt = 0 } = {}
) {
	const parts = [];
	const uses = {};
	specs.forEach((spec, i) => {
		const id = spec.id || `p${i + 1}`;
		const part = drawLetter(spec.char, {
			unit: spec.unit ?? 2,
			pen,
			x0: spec.x0,
			base: spec.base ?? 300,
			width,
			height,
			tail: spec.drawTail,
			id,
			tilt,
		});
		parts.push(part);
		if (spec.named !== false) uses[id] = { char: spec.char, itemId: `item-${id}`, ...spec.use };
	});
	return { asset, parts, uses };
}

/** The pixel row where a stroke centered on cap-unit y has its lower edge. */
export function inkEdgeBelow(y, { unit = 2, pen = 12, base = 300 } = {}) {
	return base + y * unit + pen / 2;
}
