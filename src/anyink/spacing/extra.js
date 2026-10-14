// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B3 spacing: where the letter-spacing extra is kept (UX-BEGINNER 4.6).

	  settings.anyink.spacing = { extra }   the slider's value, a whole number from -G to +G
	  glyph.anyink.spacingExtra = { left, right }
	                                         how much of it each side of this letter has now
	The second one is what makes the slider undo-free to move back: because a side stops at
	touching, a letter's own spacing can't be worked out from its sides and the extra alone.
	Keeping what was added gives it back exactly: own spacing = side - added. It is kept with
	the letter (so it rides along in Undo steps and in the work file) only while it matters,
	and dropped when the extra and both shares are 0.

	A letter with no record while the extra isn't 0 (drawn by hand in More tools after the
	slider moved) is taken to have the whole extra on both sides, so the next slider move
	shifts it by the change only, like every other letter.
*/
import { clampExtra, extraRange as rangeForFont } from './gap_rule.js';
import { whole } from './round.js';

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number} the letter-spacing extra, whole, held to -G..+G
 */
export function getExtra(project) {
	const font = project?.settings?.font;
	return clampExtra(project?.settings?.anyink?.spacing?.extra ?? 0, font);
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {Number} value - already held to the range
 */
export function storeExtra(project, value) {
	const settings = project?.settings;
	if (!settings) return;
	if (!settings.anyink || typeof settings.anyink !== 'object') settings.anyink = {};
	const spacing = settings.anyink.spacing;
	settings.anyink.spacing = {
		...(spacing && typeof spacing === 'object' ? spacing : {}),
		extra: value,
	};
}

/**
 * The slider's ends.
 * @param {Object} projectOrFont - GlyphrStudioProject, or its settings.font
 * @returns {{min: Number, max: Number}} whole font units, -G and +G
 */
export function extraRange(projectOrFont) {
	return rangeForFont(projectOrFont?.settings?.font ?? projectOrFont);
}

/**
 * How much of the extra each side of a letter has.
 * @param {Object} item - Glyph
 * @param {Number} extra - the font's extra now
 * @returns {{left: Number, right: Number}}
 */
export function appliedExtra(item, extra) {
	const record = item?.anyink?.spacingExtra;
	if (record && typeof record === 'object') {
		const left = Number(record.left);
		const right = Number(record.right);
		if (Number.isFinite(left) && Number.isFinite(right)) return { left, right };
	}
	const all = whole(extra);
	return { left: all, right: all };
}

/**
 * Keeps how much of the extra each side has; drops the record when it no longer matters.
 * @param {Object} item - Glyph
 * @param {{left: Number, right: Number}} applied
 * @param {Number} extra - the font's extra now
 * @returns {Boolean} true when the record changed
 */
export function recordApplied(item, applied, extra) {
	if (!item) return false;
	const left = whole(applied.left);
	const right = whole(applied.right);
	const old = item.anyink?.spacingExtra;
	if (left === 0 && right === 0 && whole(extra) === 0) {
		if (!old) return false;
		delete item.anyink.spacingExtra;
		return true;
	}
	if (old && old.left === left && old.right === right) return false;
	if (!item.anyink || typeof item.anyink !== 'object') item.anyink = {};
	item.anyink.spacingExtra = { left, right };
	return true;
}
