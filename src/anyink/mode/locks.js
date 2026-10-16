// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: guide lines are locked in Simple mode (UX-BEGINNER.md 7.6). Only the horizontal kinds
	'metric' (top, capitals and small-letter lines, the tail line) and 'baseline' (the writing
	line) lock; the side edges ('sideBearing') on the same layer stay draggable, and so do guides
	he added in More tools ('guide'). Move the guide lines (4.8, B15) unlocks the horizontal lines;
	the writing line stays locked. All tools locks nothing but an empty letter's left edge and, with a drawing tool, every line
	(below).
	Fix track: in Simple the side edges of a letter with no shapes lock too. There is no ink for
	its left edge to move, so dragging it only pushed the width below zero (the right edge moving
	the wrong way), and the edge took the press meant for a photo's corner on it. A letter gets its
	spacing when it gets ink (B3).
	B4 + B5 finalize: the left edge of a letter with no shapes locks in All tools too. Its left
	space is measured from ink it doesn't have (upstream reads it as 0 whatever is set), so pushed
	left the edge stayed put and the width grew, moving the right edge instead. Its right edge
	(the width: a space has no ink and still needs one) stays draggable in All tools.
	B6 + B7 integration: in the letter view (B7, 4.3) the side edges show only while Fine-tune is
	open (letter/edges.js), so while it is closed they lock too: an edge he can't see never takes
	a press, changes the pointer, or moves the spacing with an arrow key. With a drawing tool
	picked (Point pen, Rectangle, Oval, Brush) they lock as well: a press there is the tool's, so a
	point meant for the letter never drags an edge (automatic spacing can move ink across one).
	guides_layer.js asks at its two gates: handleGuidesLayerEvent (a drag) and onKeyDown (an arrow
	nudge). Its line kinds come from metrics/hit_test.js.
	B16 (10/16/2026): with a drawing tool picked, every line kind locks in both modes. In All tools
	a Pen click on the writing line placed no point and a Rectangle started on an edge dragged the
	edge; upstream had no draggable lines on the canvas, so a drawing tool always got the press.
	Select (resize) and Edit points (pathEdit) still drag the lines in All tools, as M5 intended.

	  isGuideLineLocked(line, { mode, moving, item, tool })   line: { kind } or a kind; moving:
	                                              Move the guide lines is on (default: the switch
	                                              below); item: the letter whose edges these are;
	                                              tool: the tool picked (editor.selectedTool)
	  setGuideLinesMoving(on) / guideLinesMoving()   B5 wiring: the switch B15's Move the guide
	                                              lines turns on while it is open (off by
	                                              default; the real-browser checks stand in for
	                                              B15 with it)
*/
import { isFineTuneOpen } from '../letter/view_switches.js';
import { isFeatureOn } from './features.js';
import { getMode } from './mode.js';
import { SKETCH_TOOLS } from '../sketch/tools/tool_names.js';

/** The tools whose press draws; no line ever takes it (B6 + B7 in the letter view, B16 everywhere;
 * S2: the sketch tools) */
const DRAWING_TOOLS = Object.freeze(['newPath', 'newRectangle', 'newOval', 'nib', ...SKETCH_TOOLS]);

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
 * @param {String} [options.tool] - the tool picked: a drawing tool locks every line, both modes
 * @returns {Boolean} true when the mode keeps this line still
 */
export function isGuideLineLocked(
	line,
	{ mode = getMode(), moving: open = moving, item, tool } = {}
) {
	const kind = typeof line === 'string' ? line : line?.kind;
	const empty = !!item && !item.shapes?.length;
	if (DRAWING_TOOLS.includes(tool)) return true;
	if (kind === 'sideBearing' && empty && line?.side === 'lsb') return true;
	if (mode !== 'simple') return false;
	if (kind === 'baseline') return true;
	if (kind === 'metric') return !open;
	if (kind === 'sideBearing') {
		if (empty) return true;
		return isFeatureOn('letterView') && !isFineTuneOpen();
	}
	return false;
}
