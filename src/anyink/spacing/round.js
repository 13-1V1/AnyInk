// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: whole font units (UX-BEGINNER 7.2 "Whole numbers"). Everything spacing writes,
	every point and every width, is a whole number, the way the font file stores it.

	  whole(value)            Math.round, never -0; anything that isn't a number is 0
	  isWhole(value)
	  roundItemPoints(item)   rounds the letter's own points, and the curve handles it uses;
	                          returns how many numbers changed. Handles that are off keep
	                          their stored place (nothing reads it), so a whole letter is left
	                          exactly as it was. Letters it is made from are theirs to round.
	  roundWidth(item)        true when the width changed
	  roundItem(item)         both; true when anything changed
	Numbers are written straight to each point's coordinate: the point setters would drag the
	handles along or switch a handle on.
*/

/**
 * @param {*} value
 * @returns {Number} a whole number (0 for anything that isn't a finite number)
 */
export function whole(value) {
	const n = Math.round(Number(value));
	if (!Number.isFinite(n) || n === 0) return 0;
	return n;
}

/**
 * @param {*} value
 * @returns {Boolean}
 */
export function isWhole(value) {
	return Number.isInteger(value);
}

/**
 * @param {Object} item - Glyph
 * @returns {Number} how many coordinates were rounded
 */
export function roundItemPoints(item) {
	let moved = 0;
	(item?.shapes || []).forEach((shape) => {
		if (shape?.objType !== 'Path' || !Array.isArray(shape.pathPoints)) return;
		let shapeMoved = 0;
		shape.pathPoints.forEach((point) => {
			[point.p, point.h1, point.h2].forEach((control) => {
				if (!control?.coord) return;
				if (control !== point.p && control.use === false) return;
				shapeMoved += roundCoord(control.coord);
			});
		});
		if (shapeMoved) {
			shape.changed?.();
			moved += shapeMoved;
		}
	});
	if (moved) item.changed?.();
	return moved;
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when the width changed
 */
export function roundWidth(item) {
	if (!item) return false;
	const width = whole(item.advanceWidth);
	if (width === item.advanceWidth) return false;
	item.advanceWidth = width;
	return true;
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when a point or the width changed
 */
export function roundItem(item) {
	const points = roundItemPoints(item) > 0;
	const width = roundWidth(item);
	return points || width;
}

/** @returns {Number} how many of x and y changed */
function roundCoord(coord) {
	let changed = 0;
	const x = whole(coord.x);
	if (x !== coord.x) {
		coord.x = x;
		changed++;
	}
	const y = whole(coord.y);
	if (y !== coord.y) {
		coord.y = y;
		changed++;
	}
	return changed;
}
