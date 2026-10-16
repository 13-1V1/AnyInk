// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 + S3: the card's Flip left-right and Flip upside-down (letter_card.js), on the letter's
	shapes, its sketch and its Brush strokes together (docs/SKETCH.md section 7). The shapes flip
	about the middle of the letter's ink (Glyph.flipEW / flipNS) taken to the nearest half unit,
	so whole points land on whole points, every point whole after (7.2); the sketch takes the same mirror
	(sketch/follow.js followShapes): its points, Mirror line and circles flip, every Arc bends the
	other way, every aim turns (left-right: 180 - dir; upside-down: 360 - dir), pins that no
	longer hold go. No Undo step here: the caller records one.

	  flipLetter(item, way, { project })   way 'leftRight' | 'upsideDown'; true when it flipped
*/
import { followShapes } from '../sketch/follow.js';
import { flipLeftRight, flipUpsideDown } from '../sketch/follow_matrix.js';

/**
 * @param {Object} item - Glyph
 * @param {'leftRight' | 'upsideDown'} way
 * @param {{project?: Object}} [options]
 * @returns {Boolean}
 */
export function flipLetter(item, way, { project } = {}) {
	if (!item?.shapes?.length) return false;
	const center = item.maxes?.center;
	const leftRight = way === 'leftRight';
	// the middle on a half unit, so whole points flip to whole points (the sketch's too)
	const mid = Math.round(2 * Number(leftRight ? center?.x : center?.y)) / 2;
	if (!Number.isFinite(mid)) return false;
	if (leftRight) item.flipEW(mid);
	else item.flipNS(mid);
	item.roundAll?.(0);
	followShapes(item, { matrix: leftRight ? flipLeftRight(mid) : flipUpsideDown(mid) }, { project });
	return true;
}
