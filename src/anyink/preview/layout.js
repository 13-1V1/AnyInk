// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Vertical layout math for the preview strip. Pure functions.
	The TextBlock places the first baseline at
	  pagePadding + (ascent + (upm - totalVertical) / 2) * scale + lineGap / 2
	which mirrors how a browser centers a line of native text in its line box.
	Choosing lineGap = area - 2 * padding - fontSizePx centers the em box in the
	strip for both the canvas renderer and the real-font textarea.
	B12 Try it (UX-BEGINNER.md 4.6): one line is centered the same way in the big sheet; words that
	run past its edge wrap onto more lines with an ordinary gap (tryItLayout), never off the sheet.
*/

/** B12: the room around the letters in Try it's big sheet (CSS px) */
export const TRY_IT_PAGE_PADDING = 24;
/** B12: the gap between wrapped lines in Try it, as a share of the type size */
export const TRY_IT_LINE_RATIO = 0.35;

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

/**
 * B12: the gap between wrapped lines in Try it.
 * @param {Number} fontSizePx
 * @returns {Number} whole px, never negative
 */
export function tryItLineGap(fontSizePx) {
	const gap = Number(fontSizePx) * TRY_IT_LINE_RATIO;
	return Number.isFinite(gap) ? Math.max(0, Math.round(gap)) : 0;
}

/**
 * B12: Try it's layout: one line centered in the sheet, or (when the words wrap) lines with an
 * ordinary gap from the top.
 * @param {{areaHeight: Number, fontSizePx: Number, wraps: Boolean}} o
 * @returns {{pagePadding: Number, lineGap: Number}}
 */
export function tryItLayout({ areaHeight, fontSizePx, wraps }) {
	return {
		pagePadding: TRY_IT_PAGE_PADDING,
		lineGap: wraps
			? tryItLineGap(fontSizePx)
			: centeringLineGap(areaHeight, TRY_IT_PAGE_PADDING, fontSizePx),
	};
}

/**
 * B12: true when a written letter (not a space) is left off the sheet by the layout.
 * @param {{data?: Array<Array<{char?: String, isVisible?: Boolean}>>} | null} textBlock
 * @returns {Boolean}
 */
export function writtenOffSheet(textBlock) {
	const blocks = Array.isArray(textBlock?.data) ? textBlock.data : [];
	return blocks.some(
		(block) =>
			Array.isArray(block) &&
			block.some((charData) => !charData?.isVisible && String(charData?.char ?? '').trim() !== '')
	);
}
