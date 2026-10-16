// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 brush: how wide the brush draws (UX-BEGINNER.md 10 B8: "Default size 9% of the small-letter
	height"; 4.3 "Size: thin --o-- thick"). The size is a share of the small-letter height, so a
	stroke looks the same weight whatever grid the font uses and follows the guide lines when they
	move. It belongs to this computer, like a pen on his desk: an app pref (D-007), never a font
	setting and never an Undo step. A stroke's own width is kept with its skeleton.

	B16 fix (acceptance T4: a first Brush stroke after 7 letters traced from a felt-tip photo came
	out 45 % thinner than them): a font with letters traced from a photo (item.anyink.photoFit) has
	a pen, the median line thickness of those letters (spacing/measure.js strokeEstimate, the
	measure the "thinner than your other letters" note uses). The Brush starts at that pen. A size
	he picks with the slider is saved with the pen it was picked for (BRUSH_PEN_PREF, a share of
	the small-letter height, or none): it stays his while the font's pen is that pen (within
	PEN_MATCH), and a font with another pen starts at its own. A font with no traced letters
	draws with the saved size.

	  BRUSH_PREF, BRUSH_PEN_PREF  the prefs' names
	  DEFAULT_SHARE               0.09 of the small-letter height
	  MIN_SHARE, MAX_SHARE        thin and thick, the slider's two ends
	  MIN_TRACED                  traced letters needed before the font has a pen (3)
	  penWeight(project)          the traced letters' pen in font units, or null
	  brushShare(project?)        the share now for that font (a damaged pref reads as the default)
	  setBrushShare(share, project?)
	                              kept between thin and thick, saved for this computer with the
	                              pen of that font
	  brushSize(project)          the nib's width for new strokes in that font, whole units (at
	                              least 2)
	  resetBrushForTests()
*/
import { getPref, setPref } from '../prefs/prefs.js';
import { medianOver, strokeEstimate } from '../spacing/measure.js';
import { whole } from './geometry.js';

export const BRUSH_PREF = 'brushSize';
export const BRUSH_PEN_PREF = 'brushPen';
export const DEFAULT_SHARE = 0.09;
export const MIN_SHARE = 0.03;
export const MAX_SHARE = 0.24;
export const MIN_TRACED = 3;
/** A saved size stays his while the font's pen is within this share of the pen it was set for */
export const PEN_MATCH = 0.15;

/** The saved size and the pen it was picked for, as this session last set them (read once) */
let saved = null;

/**
 * @param {Object} [project] - GlyphrStudioProject
 * @returns {Number}
 */
export function brushShare(project) {
	const { share, pen } = savedSize();
	const fontPen = penShare(project);
	if (fontPen === null || samePen(pen, fontPen)) return share;
	return clampShare(fontPen);
}

/**
 * @param {Number} value - a share of the small-letter height
 * @param {Object} [project] - the font it was picked in (its pen is saved with it)
 * @returns {Number} what it was set to
 */
export function setBrushShare(value, project) {
	saved = { share: clampShare(value), pen: penShare(project) };
	setPref(BRUSH_PREF, saved.share);
	setPref(BRUSH_PEN_PREF, saved.pen);
	return saved.share;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number}
 */
export function brushSize(project) {
	return Math.max(2, whole(brushShare(project) * smallLetterHeight(project)));
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number | null} font units; null with fewer than MIN_TRACED traced letters
 */
export function penWeight(project) {
	const traced = Object.values(project?.glyphs || {}).filter(
		(item) => item?.anyink?.photoFit && Number.isFinite(strokeEstimate(item))
	);
	if (traced.length < MIN_TRACED) return null;
	const pen = medianOver(traced, strokeEstimate);
	return Number.isFinite(pen) && pen > 0 ? pen : null;
}

export function resetBrushForTests() {
	saved = null;
}

/** The saved size and its pen, read from the prefs once */
function savedSize() {
	if (saved === null) {
		const pen = Number(getPref(BRUSH_PEN_PREF, null));
		saved = {
			share: clampShare(getPref(BRUSH_PREF, DEFAULT_SHARE)),
			pen: Number.isFinite(pen) && pen > 0 ? pen : null,
		};
	}
	return saved;
}

/** The font's pen as a share of its small-letter height, or null */
function penShare(project) {
	const pen = project ? penWeight(project) : null;
	return pen === null ? null : pen / smallLetterHeight(project);
}

/** true when the saved size was picked for this pen */
function samePen(savedPen, fontPen) {
	return savedPen !== null && Math.abs(savedPen - fontPen) <= PEN_MATCH * fontPen;
}

/** The small-letter height in font units */
function smallLetterHeight(project) {
	const font = project?.settings?.font || {};
	return Number(font.xHeight) > 0 ? Number(font.xHeight) : 0.55 * (Number(font.upm) || 1000);
}

/** A finite share between thin and thick; anything else is the default */
function clampShare(value) {
	const number = Number(value);
	if (typeof value !== 'number' || !Number.isFinite(number)) return DEFAULT_SHARE;
	return Math.min(MAX_SHARE, Math.max(MIN_SHARE, number));
}
