// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: who owns a letter's spacing (UX-BEGINNER 7.2 "Spacing owner flag").

	glyph.anyink.spacing is 'auto' (ANY-INK fits it) or 'manual' (set by him). Absent means
	manual, so old and imported fonts are never re-spaced behind his back. Letters first given
	ink in Simple start as 'auto'; [Back to automatic] sets 'auto'.

	Who sets 'manual' (wired by the hooks track, not here):
	  - an edge drag (guides_layer.js finishDrag) and an arrow-key side nudge (onKeyDown), before
	    their addState, so the refit hook sees 'manual' and leaves the drag alone;
	  - in More tools, any Undo step that changes a letter's left space or width: the hook
	    compares spacingOf(item) with the letter's recorded state (spacingChanged) and calls
	    markManual, unless the letter sits exactly where the fitter puts it
	    (flipToManualIfChanged is the plain rule in one call).
	Only an automatic letter is ever flipped: a letter with no flag is already manual, and is
	left exactly as it was (no flag is written), so More tools changes nothing in old fonts.
*/
import { inkBounds } from './measure.js';

export const OWNER = Object.freeze({ auto: 'auto', manual: 'manual' });

/** Sideways moves and width changes smaller than this are rounding, not a change. */
const NOISE = 0.5;

/**
 * @param {Object} item - Glyph
 * @returns {'auto' | 'manual'}
 */
export function getSpacingOwner(item) {
	return item?.anyink?.spacing === OWNER.auto ? OWNER.auto : OWNER.manual;
}

/**
 * Someone has decided this letter's spacing: the flag is 'auto' or 'manual'. A letter with no
 * flag (an old or imported font, or a letter not given ink yet) has no owner; getSpacingOwner
 * still reads it as 'manual', so it is never re-spaced behind his back.
 * @param {Object} item - Glyph
 * @returns {Boolean}
 */
export function hasSpacingOwner(item) {
	const flag = item?.anyink?.spacing;
	return flag === OWNER.auto || flag === OWNER.manual;
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when ANY-INK fits this letter's spacing
 */
export function isAutomatic(item) {
	return getSpacingOwner(item) === OWNER.auto;
}

/**
 * @param {Object} item - Glyph
 * @param {'auto' | 'manual'} owner
 * @returns {Boolean} true when the flag changed
 */
export function setSpacingOwner(item, owner) {
	if (!item || typeof item !== 'object') return false;
	if (owner !== OWNER.auto && owner !== OWNER.manual) return false;
	if (item.anyink?.spacing === owner) return false;
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	item.anyink.spacing = owner;
	return true;
}

/**
 * Spacing is ANY-INK's again ([Back to automatic], a letter's first ink in Simple).
 * The caller fits it (auto_space.js fitSpacing).
 * @param {Object} item - Glyph
 * @returns {Boolean} true when the flag changed
 */
export function markAuto(item) {
	return setSpacingOwner(item, OWNER.auto);
}

/**
 * Set by him: flips an automatic letter only.
 * @param {Object} item - Glyph
 * @returns {Boolean} true when the flag changed
 */
export function markManual(item) {
	if (!isAutomatic(item)) return false;
	return setSpacingOwner(item, OWNER.manual);
}

/**
 * The two numbers a spacing change moves: where the ink starts (the left space) and the width.
 * @param {Object} item - Glyph
 * @returns {{left: Number, width: Number}}
 */
export function spacingOf(item) {
	const bounds = inkBounds(item);
	return {
		left: bounds ? bounds.xMin : 0,
		width: Number(item?.advanceWidth) || 0,
	};
}

/**
 * @param {{left: Number, width: Number}} before - spacingOf, before the change
 * @param {{left: Number, width: Number}} after - spacingOf, after it
 * @returns {Boolean} true when the left space or the width moved
 */
export function spacingChanged(before, after) {
	if (!before || !after) return false;
	return (
		Math.abs((after.left || 0) - (before.left || 0)) >= NOISE ||
		Math.abs((after.width || 0) - (before.width || 0)) >= NOISE
	);
}

/**
 * More tools' rule: an automatic letter whose left space or width changed becomes manual.
 * @param {Object} item - Glyph
 * @param {{left: Number, width: Number}} before - spacingOf, before the change
 * @returns {Boolean} true when the letter was flipped
 */
export function flipToManualIfChanged(item, before) {
	if (!isAutomatic(item)) return false;
	if (!spacingChanged(before, spacingOf(item))) return false;
	return markManual(item);
}
