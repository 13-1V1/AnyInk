// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration (docs/SKETCH.md section 6, Datums): the part of snap.js's context that comes from
	the letter, not the tool. install.js hands it to every sketch tool as ctx.snapContext, so the
	letter's edges, its middle and the ink's middle reach snapPoint in the app.

	  - manual: the letter's spacing is set by him (spacing/owner.js 'manual'): its left and right
	    edges and its middle snap and are stored. A letter no one has decided yet follows the mode:
	    Simple spaces it automatically (so never), All tools keeps it as he left it (so always).
	  - edges: { left: 0, right: the letter's width }.
	  - inkMiddle: while spacing is automatic, the middle of the ink (or, with no ink yet, of the
	    sketch's points) pulls x as a hint, never stored; null when there is nothing to measure.

	  letterSnapContext(item, { simple })   { manual, edges, inkMiddle }; {} with no letter
	  snapContextOf(ev)                     the same for a tool_route.js event (ev.item)
*/
import { isSimpleMode } from '../../mode/mode.js';
import { hasSpacingOwner, isAutomatic } from '../../spacing/owner.js';
import { inkBounds } from '../../spacing/measure.js';
import { sketchOf } from '../model.js';

/**
 * @param {Object} item - Glyph (or ligature, component)
 * @param {{simple?: Boolean}} [options] - default: the mode now
 * @returns {{manual?: Boolean, edges?: {left: Number, right: Number}, inkMiddle?: Number|null}}
 */
export function letterSnapContext(item, { simple = isSimpleMode() } = {}) {
	if (!item || typeof item !== 'object') return {};
	const manual = hasSpacingOwner(item) ? !isAutomatic(item) : !simple;
	const width = Number(item.advanceWidth);
	const edges = { left: 0, right: Number.isFinite(width) ? width : 0 };
	return { manual, edges, inkMiddle: manual ? null : middleOf(item) };
}

/**
 * @param {Object} ev - tool_route.js's event
 * @returns {Object}
 */
export function snapContextOf(ev) {
	return letterSnapContext(ev?.item || ev?.editor?.selectedItem || null);
}

/**
 * @param {Object} item
 * @returns {Number | null} the middle of the ink, else of the sketch's points
 */
function middleOf(item) {
	let box = null;
	try {
		box = item.shapes?.length ? inkBounds(item) : null;
	} catch {
		box = null;
	}
	if (box) return Math.round((box.xMin + box.xMax) / 2);
	const xs = Object.values(sketchOf(item)?.points || {})
		.map((point) => Number(point?.x))
		.filter(Number.isFinite);
	if (xs.length < 2) return null;
	return Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
}
