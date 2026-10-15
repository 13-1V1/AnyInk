// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: how wide the brush draws (UX-BEGINNER.md 10 B8: "Default size 9% of the small-letter
	height"; 4.3 "Size: thin --o-- thick"). The size is a share of the small-letter height, so a
	stroke looks the same weight whatever grid the font uses and follows the guide lines when they
	move. It belongs to this computer, like a pen on his desk: an app pref (D-007), never a font
	setting and never an Undo step. A stroke's own width is kept with its skeleton.

	  BRUSH_PREF                  the pref's name
	  DEFAULT_SHARE               0.09 of the small-letter height
	  MIN_SHARE, MAX_SHARE        thin and thick, the slider's two ends
	  brushShare()                the share now (a damaged pref reads as the default)
	  setBrushShare(share)        kept between thin and thick, saved for this computer
	  brushSize(project)          the nib's width for new strokes in that font, whole units (at
	                              least 2)
	  resetBrushForTests()
*/
import { getPref, setPref } from '../prefs/prefs.js';
import { whole } from './geometry.js';

export const BRUSH_PREF = 'brushSize';
export const DEFAULT_SHARE = 0.09;
export const MIN_SHARE = 0.03;
export const MAX_SHARE = 0.24;

/** The share as this session last set it (the pref is read once) */
let share = null;

/** @returns {Number} */
export function brushShare() {
	if (share === null) share = clampShare(getPref(BRUSH_PREF, DEFAULT_SHARE));
	return share;
}

/**
 * @param {Number} value - a share of the small-letter height
 * @returns {Number} what it was set to
 */
export function setBrushShare(value) {
	share = clampShare(value);
	setPref(BRUSH_PREF, share);
	return share;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number}
 */
export function brushSize(project) {
	const font = project?.settings?.font || {};
	const height =
		Number(font.xHeight) > 0 ? Number(font.xHeight) : 0.55 * (Number(font.upm) || 1000);
	return Math.max(2, whole(brushShare() * height));
}

export function resetBrushForTests() {
	share = null;
}

/** A finite share between thin and thick; anything else is the default */
function clampShare(value) {
	const number = Number(value);
	if (typeof value !== 'number' || !Number.isFinite(number)) return DEFAULT_SHARE;
	return Math.min(MAX_SHARE, Math.max(MIN_SHARE, number));
}
