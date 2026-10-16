// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 fix pass: what a Use in Word font file holds, worked out from the exporter's own list
	(fontcheck/export_list.js getExportList) with the options every Use in Word build uses, so the
	dialog and the card speak of the file that is really built, never of the work file.

	  WORD_EXPORT_OPTIONS          B1's exporter options for every Use in Word build (4.7) plus
	                               B14 + B15's (FACTCHECK_LOG 8.20, 8.12)
	  inkedLetters(project)        the letters (and ligatures) in the file that hold ink; the
	                               space added by addSpaceIfMissing never counts
	  hasLetterToMake(project)     true when the file would hold at least one inked letter
	  writtenGapFixes(project)     the kern groups the file holds: a value, and at least one
	                               left and one right member on the exporter's list
*/
import { getExportKerning } from '../fontcheck/export_kerning.js';
import { getExportList } from '../fontcheck/export_list.js';
import { hasInk } from '../board/letter_set.js';

export const WORD_EXPORT_OPTIONS = Object.freeze({
	omitEmptyLetters: true,
	addSpaceIfMissing: true,
	mergeOverlaps: true,
	kernForLatin: true,
});

const SPACE = 0x20;

/**
 * @param {Object} project
 * @returns {{glyphs: Array<Object>, ligatures: Array<Object>}} the exporter's list, or empty
 */
function listOf(project) {
	if (!project?.settings?.project) return { glyphs: [], ligatures: [] };
	try {
		return getExportList(project, {
			omitEmptyLetters: WORD_EXPORT_OPTIONS.omitEmptyLetters,
			addSpaceIfMissing: WORD_EXPORT_OPTIONS.addSpaceIfMissing,
		});
	} catch (error) {
		console.warn('ANY-INK Use in Word: the letter list could not be read', error);
		return { glyphs: [], ligatures: [] };
	}
}

/**
 * @param {Object} project
 * @returns {Array<Object>} the inked items the font file will hold
 */
export function inkedLetters(project) {
	const { glyphs, ligatures } = listOf(project);
	return [
		...glyphs.filter(({ xg, xc }) => Number(xc) !== SPACE && hasInk(xg)).map(({ xg }) => xg),
		...ligatures.filter(({ xg }) => hasInk(xg)).map(({ xg }) => xg),
	];
}

/**
 * @param {Object} project
 * @returns {Boolean}
 */
export function hasLetterToMake(project) {
	return inkedLetters(project).length > 0;
}

/**
 * @param {Object} project
 * @returns {Array<Object>} the kern groups the font file will really hold
 */
export function writtenGapFixes(project) {
	if (!project?.settings?.app?.exportKerning) return [];
	const listed = new Set(listOf(project).glyphs.map(({ xc }) => Number(xc)));
	const onList = (members) =>
		Array.isArray(members) && members.some((hex) => listed.has(Number(hex)));
	return Object.values(getExportKerning(project)).filter(
		(group) => Number(group?.value) !== 0 && onList(group?.leftGroup) && onList(group?.rightGroup)
	);
}
