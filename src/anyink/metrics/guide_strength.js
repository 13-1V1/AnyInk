// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	How strongly the edit canvas draws the system guide lines (B1).
	At a new font's Transparency setting (70) the lines used to be drawn at 30%, so the writing
	line (baseline) was 1.6:1 against paper and 1.7:1 against slate: hard to find. The strength
	is now worked out from the theme's own color tokens (--canvas-guide over --canvas-bg): at the
	default setting the writing line, and the left and right edges, reach 3:1, the WCAG minimum
	for lines a person has to see. The other lines keep their lighter levels (guide.js
	guideLevelOpacity), so the writing line stays the strongest.
	The Transparency setting keeps its whole range: 100 is invisible, 0 is solid, and settings
	in between are stretched around the new default, never drawn weaker than chosen.
	On a display scaled above 100% (Windows 125%, 150%...) the browser stretches the edit canvas,
	whose buffer is its CSS size, and smooths each 1 px line over more than one screen pixel;
	systemGuideStroke makes up for that (B1 fix pass), so 3:1 holds on the screen itself.
	Pure functions; edit_canvas.js drawSystemGuidelines calls systemGuideStroke.
*/
import { transparencyToAlpha } from '../../common/colors.js';
import { parseToRGB } from '../theme/theme.js';

/** A new font's system guide Transparency (glyphr_studio_project.js settings.app.guides). */
export const DEFAULT_SYSTEM_TRANSPARENCY = 70;

/** WCAG 2.x (1.4.11): a line a person has to see needs 3:1 against what is behind it. */
export const WRITING_LINE_CONTRAST = 3;

const alphaCache = new Map();

/**
 * Relative luminance of an opaque color, per WCAG.
 * @param {{r: Number, g: Number, b: Number}} rgb - 0 to 255 each
 * @returns {Number}
 */
function luminance({ r, g, b }) {
	const lin = (v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * WCAG contrast ratio of two opaque CSS colors, from 1 to 21.
 * @param {String} colorA
 * @param {String} colorB
 * @returns {Number}
 */
export function contrastRatio(colorA, colorB) {
	return ratio(parseToRGB(colorA), parseToRGB(colorB));
}

/**
 * The smallest alpha, in the 1/255 steps a canvas stores, at which `color` drawn over
 * `background` reaches `target` contrast against that background. 1 if it never does.
 * @param {String} color - CSS color of the line
 * @param {String} background - CSS color behind it
 * @param {Number} target - contrast ratio, e.g. 3
 * @returns {Number}
 */
export function alphaForContrast(color, background, target) {
	const key = `${color}|${background}|${target}`;
	if (alphaCache.has(key)) return alphaCache.get(key);
	const top = parseToRGB(color);
	const bg = parseToRGB(background);
	let found = 1;
	for (let step = 0; step <= 255; step++) {
		const a = step / 255;
		const mix = (k) => Math.round(top[k] * a + bg[k] * (1 - a));
		if (ratio({ r: mix('r'), g: mix('g'), b: mix('b') }, bg) >= target) {
			found = a;
			break;
		}
	}
	alphaCache.set(key, found);
	return found;
}

/**
 * The alpha to draw the system guide lines with, before each line's level (guide.js).
 * @param {Number|String} transparency - settings.app.guides.systemTransparency, 0 to 100
 * @param {String} guideColor - the --canvas-guide token's value
 * @param {String} canvasColor - the --canvas-bg token's value
 * @returns {Number} 0 to 1
 */
export function systemGuideAlpha(transparency, guideColor, canvasColor) {
	const chosen = transparencyToAlpha(transparency);
	if (!guideColor || !canvasColor) return chosen;
	const usual = transparencyToAlpha(DEFAULT_SYSTEM_TRANSPARENCY);
	const strong = Math.max(usual, alphaForContrast(guideColor, canvasColor, WRITING_LINE_CONTRAST));
	// Stretch the setting so the default lands on `strong`: 0 stays 0, 1 stays 1
	if (chosen <= usual) return (chosen / usual) * strong;
	return strong + ((chosen - usual) / (1 - usual)) * (1 - strong);
}

/**
 * The least share of a 1 px canvas line's strength that its brightest screen row keeps once
 * the browser stretches the canvas by `scale` screen pixels per canvas pixel. Chrome smooths a
 * stretched canvas (bilinear), and the nearest screen row can sit up to half a screen pixel from
 * the canvas row's middle: it keeps 1 - 1 / (2 * scale), so 60% at 125% and 67% at 150%.
 * @param {Number} scale - window.devicePixelRatio
 * @returns {Number} 0.5 to 1
 */
export function upscaleKeeps(scale) {
	const s = Number(scale);
	if (!(s > 1)) return 1;
	return 1 - 1 / (2 * s);
}

/**
 * How to draw the system guide lines on this display. At 100% that is systemGuideAlpha and a
 * 1 px line, exactly as before. Above 100% the alpha is raised so the line's brightest screen
 * row still shows what 100% shows; when even a solid 1 px line can't (125%), the line is drawn
 * 2 canvas px thick at the 100% alpha, because every screen row between two equal canvas rows
 * shows their full alpha.
 * @param {Number|String} transparency - settings.app.guides.systemTransparency, 0 to 100
 * @param {String} guideColor - the --canvas-guide token's value
 * @param {String} canvasColor - the --canvas-bg token's value
 * @param {Number} scale - window.devicePixelRatio
 * @returns {{alpha: Number, thickness: Number}} alpha 0 to 1, thickness in canvas px
 */
export function systemGuideStroke(transparency, guideColor, canvasColor, scale = 1) {
	const alpha = systemGuideAlpha(transparency, guideColor, canvasColor);
	const keeps = upscaleKeeps(scale);
	if (keeps >= 1 || alpha <= 0) return { alpha, thickness: 1 };
	// A canvas stores alpha in 1/255 steps: round up so the screen never shows less
	const raised = Math.ceil((alpha / keeps) * 255 - 1e-9) / 255;
	if (raised <= 1) return { alpha: raised, thickness: 1 };
	return { alpha, thickness: 2 };
}
