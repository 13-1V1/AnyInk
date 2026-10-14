// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Hit-testing a DisplayCanvas text block: which glyph box is under a point,
	and where a double-click on it should navigate. Pure functions.
	charData comes from TextBlock.data: { item, view: {dx, dy, dz}, widths: {advance}, isVisible }.
	view.dx / view.dy are the glyph origin (left, baseline) in CSS px; view.dz is px per font unit.
*/

/**
 * @param {Array<Array<Object>>} data - TextBlock.data (blocks of charData)
 * @param {Number} x - CSS px from the canvas left edge
 * @param {Number} y - CSS px from the canvas top edge
 * @param {{ascent: Number|String, descent: Number|String}} font - project.settings.font
 * @returns {Object|false} the charData under the point
 */
export function findCharAtPoint(data, x, y, font) {
	if (!Array.isArray(data) || !font) return false;
	const ascent = Number(font.ascent) || 0;
	const descent = Math.abs(Number(font.descent) || 0);
	for (const block of data) {
		if (!Array.isArray(block)) continue;
		for (const charData of block) {
			if (!charData?.view || !charData.isVisible) continue;
			const { dx, dy, dz } = charData.view;
			const advance = Number(charData.widths?.advance) || 0;
			const left = dx;
			const right = dx + advance * dz;
			const top = dy - ascent * dz;
			const bottom = dy + descent * dz;
			if (x >= left && x < right && y >= top && y <= bottom) return charData;
		}
	}
	return false;
}

/**
 * Where a double-click on this character should take the editor.
 * Only real project items navigate; missing glyphs and spaces do nothing.
 * @param {Object|false} charData
 * @returns {{id: String, page: String}|false}
 */
export function navigationTargetForChar(charData) {
	const target = navigationTargetForId(charData?.item?.id);
	// A letter on the sheet opens that letter, never a gap
	return target && target.page !== 'Kerning' ? target : false;
}

/**
 * Which page edits this item: letters, joined letters, and (B1) the gap between two letters,
 * which a font notice can name.
 * @param {String} id - project item id
 * @returns {{id: String, page: String}|false}
 */
export function navigationTargetForId(id) {
	if (typeof id !== 'string') return false;
	if (id.startsWith('glyph-')) return { id, page: 'Characters' };
	if (id.startsWith('liga-')) return { id, page: 'Ligatures' };
	if (id.startsWith('kern-')) return { id, page: 'Kerning' };
	return false;
}
