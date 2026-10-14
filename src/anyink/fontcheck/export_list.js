// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The exporter's list of letters (B1, UX-BEGINNER 7.2): one function that the font
	export (src/formats_io/otf/font_export.js) and the font check (validate.js) both call,
	so the check looks at exactly the letters the font file will hold.

	  getExportList(project, options) -> { glyphs: [{ xg, xc }], ligatures: [{ xg, xc, chars }] }
	    xg is the letter (a Glyph), xc its hex id ('0x41') or, for a ligature, its key.
	    options (all off by default, which is the upstream exporter's list exactly):
	      forExport         - the export itself: a ligature's missing source letters are
	                          created in the project, and skipped ligatures are logged
	                          (upstream behavior). Off for a check, which never changes
	                          the project; it lists stand-ins for those letters instead.
	      omitEmptyLetters  - leave out every letter with no shapes, except the space and
	                          letters an exported ligature is made of; empty ligatures
	                          are left out too
	      addSpaceIfMissing - when no space is in the list, or the listed space is blank
	                          (no shapes, no width: the space tile was only opened), use
	                          one a quarter of the letter box wide; it exists in this list
	                          only, never in the project
	  shouldExportItem(item, project)  upstream's rule for one item
	  spaceWidth(project)              the width addSpaceIfMissing uses
*/
import { decToHex } from '../../common/character_ids.js';
import { Glyph } from '../../project_data/glyph.js';
import { sortLigatures } from '../../project_data/glyphr_studio_project.js';

const SPACE = 0x20;

/**
 * Using a combination of a provided item's Session State,
 * and the project setting for exporting empty items,
 * figures out if this item should be exported or not.
 * (Moved here unchanged from font_export.js.)
 * @param {Glyph | Object | false} item - item to check
 * @param {Object} project - the project the item belongs to
 * @returns {Boolean}
 */
export function shouldExportItem(item, project) {
	// null char is always exported and handled separately
	if (item.name === '.null') return false;

	if (item.sessionState === 'new') {
		return !!project.settings.app.exportUneditedItems;
	}
	if (item) return true;
	return false;
}

/**
 * A quarter of the letter box, measured the way the exporter reads the letter box size.
 * @param {Object} project
 * @returns {Number} whole font units (512 at the default 2,048)
 */
export function spaceWidth(project) {
	const upm = Number(project?.settings?.font?.upm || 1000);
	const unitsPerEm = Number.isFinite(upm) ? Math.max(16, Math.min(16384, Math.round(upm))) : 1000;
	return Math.round(unitsPerEm / 4);
}

/**
 * @param {Object} item
 * @returns {Boolean} true when the item has no shapes at all
 */
function isEmpty(item) {
	return !item?.shapes || item.shapes.length === 0;
}

/**
 * A space that was only opened: no shapes and no width (clicking the space tile makes
 * one). In the font file it would make words run together, so it counts as missing.
 * @param {Object} item
 * @returns {Boolean}
 */
function isBlankSpace(item) {
	const width = Math.round(Number(item?.advanceWidth) || 0);
	return isEmpty(item) && width <= 0;
}

/**
 * Looks through the project and lists the items the font file will hold.
 * With every option off this is upstream's populateExportList, unchanged.
 * @param {Object} project - GlyphrStudioProject
 * @param {Object} [options]
 * @param {Boolean} [options.forExport]
 * @param {Boolean} [options.omitEmptyLetters]
 * @param {Boolean} [options.addSpaceIfMissing]
 * @returns {{glyphs: Array<{xg: Glyph, xc: String}>, ligatures: Array<{xg: Glyph, xc: String, chars: String}>}}
 */
export function getExportList(
	project,
	{ forExport = false, omitEmptyLetters = false, addSpaceIfMissing = false } = {}
) {
	// Add Glyphs
	let checklist = [];
	let exportGlyphs = [];

	project.settings.project.characterRanges.forEach((range) => {
		if (range.enabled) {
			range.getMemberIDs().forEach((hexID) => {
				if (checklist.indexOf(hexID) === -1) {
					const thisGlyph = project.getItem(`glyph-${hexID}`);
					if (shouldExportItem(thisGlyph, project)) {
						exportGlyphs.push({ xg: thisGlyph, xc: hexID });
						checklist.push(hexID);
					}
				}
			});
		}
	});

	exportGlyphs.sort((a, b) => a.xc - b.xc);

	// Add Ligatures
	const exportLigatures = [];
	if (project.settings.app.exportLigatures) {
		for (const key of Object.keys(project.ligatures)) {
			if (project.ligatures[key].gsub.length > 1) {
				const thisLigature = project.ligatures[key];

				if (
					shouldExportItem(thisLigature, project) &&
					!(omitEmptyLetters && isEmpty(thisLigature))
				) {
					exportLigatures.push({ xg: thisLigature, xc: key, chars: thisLigature.chars });

					/*
					When exporting to OTF, if a ligature depends on certain
					characters, and one or more of those characters do not
					exist in the font, it causes an error.
					This will check to see if Glyph objects exist for all
					Ligature source characters, and if some are missing, it
					will create blank Glyphs for them.
					A check lists a blank stand-in instead, and leaves the project alone.
				 */
					project.ligatures[key].gsub.forEach((charID) => {
						const hexID = '' + decToHex(charID);
						const id = `glyph-${hexID}`;
						if (!project.glyphs[id]) {
							const newGlyph = forExport
								? project.addItemByType(new Glyph({ id: id }), 'Glyph', id)
								: new Glyph({ id: id });
							if (!checklist.includes(hexID)) {
								exportGlyphs.push({ xg: newGlyph, xc: hexID });
								checklist.push(hexID);
							}
						}
					});
				}
			} else if (forExport) {
				console.warn(`
				Skipped exporting ligature ${project.ligatures[key].name}.
				Source chars length: ${project.ligatures[key].gsub.length}
			`);
			}
		}
		exportLigatures.sort(sortLigatures);
	}

	if (omitEmptyLetters) {
		const needed = new Set();
		exportLigatures.forEach(({ xg }) => xg.gsub.forEach((charID) => needed.add(Number(charID))));
		exportGlyphs = exportGlyphs.filter(
			({ xg, xc }) => !isEmpty(xg) || Number(xc) === SPACE || needed.has(Number(xc))
		);
	}

	if (addSpaceIfMissing) {
		const at = exportGlyphs.findIndex(({ xc }) => Number(xc) === SPACE);
		const space = {
			xg: new Glyph({ id: 'glyph-0x20', advanceWidth: spaceWidth(project) }),
			xc: '0x20',
		};
		if (at === -1) {
			const before = exportGlyphs.findIndex(({ xc }) => Number(xc) > SPACE);
			exportGlyphs.splice(before === -1 ? exportGlyphs.length : before, 0, space);
		} else if (isBlankSpace(exportGlyphs[at].xg)) {
			exportGlyphs[at] = space;
		}
	}

	return { glyphs: exportGlyphs, ligatures: exportLigatures };
}
