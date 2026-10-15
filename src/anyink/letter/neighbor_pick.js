// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter view: which of his letters stands beside the open one (UX-BEGINNER.md 4.3 Canvas,
	"Neighbors"), in one place for the canvas (neighbors.js draws it) and the Neighbors switch
	(view_switches.js names it and shows only when there is one). Pure: reads the font, writes
	nothing, never makes a letter.
	His n stands beside a small letter or a mark, his H beside a capital or a number (numbers
	stand on the capitals line, like H). "Ready" is "has ink and a width" until B11's checks
	decide Ready.

	  neighborChar(char)                 'n' or 'H'
	  neighborItem(item, project)        his ready neighbor letter, or null
	  neighborsAvailable(item, project)  true when there is a ready neighbor to show
*/
import { verticalClass } from '../placement/classes.js';

/** Capital-height classes get his H; everything else his n */
const BESIDE_H = Object.freeze(['capital', 'figure']);

/**
 * @param {String} char - the open letter's character
 * @returns {'n' | 'H'}
 */
export function neighborChar(char) {
	return BESIDE_H.includes(verticalClass(String(char || ''))) ? 'H' : 'n';
}

/**
 * @param {Object} item - the open letter
 * @param {Object} project
 * @returns {Object | null} his n or H when it has ink and a width; never made here
 */
export function neighborItem(item, project) {
	if (!item || item.objType !== 'Glyph' || !project?.glyphs) return null;
	const id = project.getItemID?.(neighborChar(item.char));
	const neighbor = id ? project.glyphs[id] : null;
	if (!neighbor?.shapes?.length || !(Number(neighbor.advanceWidth) > 0)) return null;
	return neighbor;
}

/**
 * @param {Object} item
 * @param {Object} project
 * @returns {Boolean}
 */
export function neighborsAvailable(item, project) {
	return !!neighborItem(item, project);
}
