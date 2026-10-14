// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Kerning as the font file holds it (B1 fix). A kern value is stored as it was typed on
	the Kerning page (12.5, 40000), but a font file holds only whole numbers from -32,768 to
	32,767, and font-flux-js refuses to write anything else, so one typed value used to stop
	the whole export and the real-font preview. The export (font_export.js) and the preview
	hand upstream's writeGposKernDataToFont this copy instead of project.kerning, and the
	font check (validate_kerning.js) judges by the same numbers, so all three agree.

	  kernValue(value)          -> the whole number the font file holds: rounded like the
	                               exporter rounds points, pulled into -32,768..32,767;
	                               0 (no pair) when the value isn't a finite number
	  kernFits(value)           -> true when the font file holds the value as it is, after rounding
	  getExportKerning(project) -> { [kernId]: { leftGroup, rightGroup, value: kernValue } }
	                               for writeGposKernDataToFont(font, { kerning }); the project
	                               itself is never changed
	A whole-number value in range is written exactly as before, so those font files keep
	the same bytes.
*/

export const MIN_KERN = -32768;
export const MAX_KERN = 32767;

/**
 * @param {*} value - a kern group's value
 * @returns {Number} what the font file holds (0 writes no pair)
 */
export function kernValue(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
	return Math.max(MIN_KERN, Math.min(MAX_KERN, Math.round(value)));
}

/**
 * @param {*} value - a kern group's value (a number)
 * @returns {Boolean} true when rounding alone is enough for the font file to hold it
 */
export function kernFits(value) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return false;
	const rounded = Math.round(value);
	return rounded >= MIN_KERN && rounded <= MAX_KERN;
}

/**
 * The project's kern groups with the values the font file holds.
 * @param {Object} project - GlyphrStudioProject
 * @returns {Object<String, {leftGroup: Array<String>, rightGroup: Array<String>, value: Number}>}
 */
export function getExportKerning(project) {
	const kerning = {};
	Object.entries(project?.kerning || {}).forEach(([id, group]) => {
		if (!group) return;
		kerning[id] = {
			leftGroup: group.leftGroup,
			rightGroup: group.rightGroup,
			value: kernValue(group.value),
		};
	});
	return kerning;
}
