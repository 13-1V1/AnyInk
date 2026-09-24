// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Vertical layout math for the preview strip. Pure functions.
	The TextBlock places the first baseline at
	  pagePadding + (ascent + (upm - totalVertical) / 2) * scale + lineGap / 2
	which mirrors how a browser centers a line of native text in its line box.
	Choosing lineGap = area - 2 * padding - fontSizePx centers the em box in the
	strip for both the canvas renderer and the real-font textarea.
*/

/**
 * Line gap (px) that centers a single line of text in the given area.
 * @param {Number} areaHeight - canvas area height in CSS px
 * @param {Number} pagePadding - TextBlockOptions.pagePadding
 * @param {Number} fontSizePx - TextBlockOptions.fontSize
 * @returns {Number} whole px, never negative
 */
export function centeringLineGap(areaHeight, pagePadding, fontSizePx) {
	const gap = Number(areaHeight) - 2 * Number(pagePadding) - Number(fontSizePx);
	if (!Number.isFinite(gap)) return 0;
	return Math.max(0, Math.round(gap));
}

/**
 * First baseline (CSS px from the top) of native text laid out like FontPreview:
 * padding, then a line box of fontSize + lineGap with the font's content area
 * (ascent + |descent|) centered in it.
 * @param {Object} o
 * @param {Number} o.fontSizePx
 * @param {Number} o.lineGap
 * @param {Number} o.pagePadding
 * @param {Number} o.upm
 * @param {Number} o.ascent
 * @param {Number} o.descent - negative in project settings
 * @returns {{dy: Number, dz: Number}} a view usable by metricLineYs
 */
export function nativeFirstLineView({ fontSizePx, lineGap, pagePadding, upm, ascent, descent }) {
	const px = Number(fontSizePx) || 0;
	const units = Number(upm) || 1000;
	const dz = px / units;
	const asc = Number(ascent) || 0;
	const desc = Math.abs(Number(descent) || 0);
	const lineHeight = px + (Number(lineGap) || 0);
	const contentHeight = (asc + desc) * dz;
	const dy = (Number(pagePadding) || 0) + (lineHeight - contentHeight) / 2 + asc * dz;
	return { dy, dz };
}
