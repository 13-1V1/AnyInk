// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: guide lines are locked in Simple mode (UX-BEGINNER.md 7.6). Only the horizontal kinds
	'metric' (top, capitals and small-letter lines, the tail line) and 'baseline' (the writing
	line) lock; the side edges ('sideBearing') on the same layer stay draggable, and so do guides
	he added in More tools ('guide'). Move the guide lines (4.8, B15) unlocks the horizontal lines;
	the writing line stays locked. All tools locks nothing but an empty letter's left edge (below).
	Fix track: in Simple the side edges of a letter with no shapes lock too. There is no ink for
	its left edge to move, so dragging it only pushed the width below zero (the right edge moving
	the wrong way), and the edge took the press meant for a photo's corner on it. A letter gets its
	spacing when it gets ink (B3).
	B4 + B5 finalize: the left edge of a letter with no shapes locks in All tools too. Its left
	space is measured from ink it doesn't have (upstream reads it as 0 whatever is set), so pushed
	left the edge stayed put and the width grew, moving the right edge instead. Its right edge
	(the width: a space has no ink and still needs one) stays draggable in All tools.
	guides_layer.js asks at its two gates: handleGuidesLayerEvent (a drag) and onKeyDown (an arrow
	nudge). Its line kinds come from metrics/hit_test.js.

	  isGuideLineLocked(line, { mode, moving, item })   line: { kind } or a kind; moving: Move the
	                                              guide lines is on (default: the switch below);
	                                              item: the letter whose edges these are
	  setGuideLinesMoving(on) / guideLinesMoving()   B5 wiring: the switch B15's Move the guide
	                                              lines turns on while it is open (off by
	                                              default; the real-browser checks stand in for
	                                              B15 with it)
*/
import { getMode } from './mode.js';

/** Move the guide lines (4.8, B15) is open */
let moving = false;

/**
 * @param {Boolean} on
 */
export function setGuideLinesMoving(on) {
	moving = !!on;
}

/** @returns {Boolean} */
export function guideLinesMoving() {
	return moving;
}

/**
 * @param {{kind: String} | String} line - a guides-layer line, or its kind
 * @param {Object} [options]
 * @param {'all' | 'simple'} [options.mode] - default: the current mode
 * @param {Boolean} [options.moving] - Move the guide lines is on (B15); default: the switch
 * @param {Object} [options.item] - the letter on the canvas: a side edge of one with no shapes
 *   locks in Simple, and its left edge in All tools too
 * @returns {Boolean} true when the mode keeps this line still
 */
export function isGuideLineLocked(line, { mode = getMode(), moving: open = moving, item } = {}) {
	const kind = typeof line === 'string' ? line : line?.kind;
	const empty = !!item && !item.shapes?.length;
	if (kind === 'sideBearing' && empty && line?.side === 'lsb') return true;
	if (mode !== 'simple') return false;
	if (kind === 'baseline') return true;
	if (kind === 'metric') return !open;
	if (kind === 'sideBearing') return empty;
	return false;
}
