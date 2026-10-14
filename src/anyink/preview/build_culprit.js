// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 item 6: when the real-font preview can't be built, find what broke it, so the strip can
	name it instead of quietly showing a system font.
	- A letter: FontFlux reports problems with a path like "$.glyphs[2].advanceWidth"; the index
	  is the glyph's place in font.glyphs, and the builder keeps a map from glyph name to item id.
	- A gap between two letters: "$.kerningClasses[0].value must be an integer from -32768 to
	  32767." (or "$.kerning[0].value" for a single pair). FontFlux's index counts merged
	  tables, not the project's gaps, so the gap is found by its value instead: the first gap
	  whose value the font file can't hold and whose letters (on both sides) are in the font.
	  When more than one is broken, one with several letters on a side is named first. Since
	  the B1 fix pass the preview writes gaps the way the font file holds them
	  (export_kerning.js), so this is a safety net.
*/

const GLYPH_PATH = /\$\.glyphs\[(\d+)\]/;
const GAP_PATH = /\$\.kerning(?:Classes)?\[\d+\]/;
const MIN_GAP = -32768;
const MAX_GAP = 32767;

/**
 * @param {String} text - a FontFlux issue path or error message
 * @returns {Number} the glyph index it points at, or -1
 */
export function glyphIndexFromPath(text) {
	const match = GLYPH_PATH.exec(String(text ?? ''));
	return match ? Number(match[1]) : -1;
}

/**
 * The project item behind the first thing FontFlux complains about.
 * @param {Object} font - the FontFlux font that failed to export
 * @param {Map<String, String>} idsByName - glyph name in the font -> project item id
 * @param {Error} [error] - what export threw; its message is read when validate() finds nothing
 * @param {Object} [gaps] - to name a gap: { kerning: project.kerning,
 *   glyphNameFor: hex -> glyph name in the font (font_export.js getUniqueGlyphName) }
 * @returns {String|null} item id ('glyph-0x61', 'kern-0'), or null when nothing can be named
 */
export function failingItemId(font, idsByName, error, gaps = {}) {
	if (!font || !idsByName) return null;
	const clues = [];
	try {
		const report = font.validate();
		(report?.errors || []).forEach((issue) => clues.push(issue.path, issue.message));
	} catch {
		// validate() runs the same checks as export; if it throws too, the message is all we have
	}
	if (error?.message) clues.push(error.message);

	for (const clue of clues) {
		const index = glyphIndexFromPath(clue);
		if (index < 0) continue;
		const id = idsByName.get(font.glyphs?.[index]?.name);
		if (id) return id;
	}
	if (clues.some((clue) => GAP_PATH.test(String(clue ?? '')))) {
		return failingGapId(font, gaps.kerning, gaps.glyphNameFor);
	}
	return null;
}

/**
 * @param {*} value
 * @returns {Boolean} true when the font file can hold this gap value
 */
export function isWholeGap(value) {
	return Number.isInteger(value) && value >= MIN_GAP && value <= MAX_GAP;
}

/**
 * The gap the font file can't hold, among those the font was built with.
 * @param {Object} font - FontFlux font (its glyph names)
 * @param {Object} [kerning] - project.kerning: id -> { leftGroup, rightGroup, value }
 * @param {Function} [glyphNameFor] - hex -> glyph name in the font
 * @returns {String|null} 'kern-0'
 */
function failingGapId(font, kerning, glyphNameFor) {
	if (!kerning || typeof glyphNameFor !== 'function') return null;
	const names = new Set((font.glyphs || []).map((glyph) => glyph?.name).filter(Boolean));
	const inFont = (hexes) =>
		(Array.isArray(hexes) ? hexes : []).filter((hex) => names.has(glyphNameFor(hex)));

	const broken = [];
	Object.entries(kerning).forEach(([id, gap]) => {
		// The exporter writes only gaps with a number other than 0 (gpos.js)
		if (!gap || typeof gap.value !== 'number' || !gap.value || isWholeGap(gap.value)) return;
		const left = inFont(gap.leftGroup);
		const right = inFont(gap.rightGroup);
		if (!left.length || !right.length) return;
		broken.push({ id, single: left.length === 1 && right.length === 1 });
	});
	const pick = broken.find((gap) => !gap.single) || broken[0];
	return pick ? pick.id : null;
}
