// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 integration: the words Simple shows on today's letter page (the Characters page, until
	B7's letter view replaces it), so the banned-word scan finds nothing on what exists in Simple
	(UX-BEGINNER.md 2.3, 2.4 D, 2.2 "Letter names come from letterName", "Sentence case
	everywhere"). All tools keeps Glyphr Studio's own words: every function here returns the
	upstream text it is given unless Simple is on.

	  toolTitle(tool, upstream)        Simple: "Rectangle (R)" (tool.* words, keys.js toolKey: the
	                                   key the "Switched to" toast names too)
	  viewToolTitle(id, upstream)      Simple: "Fit letter", "Outline only" (S3: "See-through" with
	                                   'sketch' on), "Dark paper", "Zoom in"
	  navSuperTitle(superTitle)        Simple: the nav buttons' small labels, "Page", "Letter"
	  pageTitle(page)                  Simple: a page's name on the page button and in its
	                                   chooser ("All letters", "One letter", "Help", "About
	                                   ANY-INK"; fix track: the page chooser stays in Simple until
	                                   B6's rail replaces it, so Help and About are no dead end)
	  navItemTitle(project, itemId, upstream)   Simple: the letter's name, "small a" (never
	                                   "Latin Small Letter A")
	  tileTitle(chars, sessionState, upstream, item)   Simple: a letter tile's tooltip (the
	                                   Overview, the letter chooser): "small a" and what the tile
	                                   shows, in words (no "glyph-0x61", no "Item does not exist
	                                   yet"). Read from the letter's ink (fix track), not from
	                                   upstream's session state alone: its 'new' means "made this
	                                   session, not marked edited", which drawing a rectangle
	                                   leaves as it was. item: default the open font's record.
	simple_labels.css keeps the small label in sentence case in Simple.
*/
import './simple_labels.css';
import { getCurrentProject } from '../../app/main.js';
import { isFeatureOn } from './features.js';
import { toolKey } from './keys.js';
import { isSimpleMode } from './mode.js';
import { letterName } from '../words/letter_name.js';
import { hasWord, word } from '../words/words.js';

/**
 * @param {String} tool - the tool's internal name ('newRectangle')
 * @param {String} upstream - Glyphr Studio's tooltip ('New rectangle')
 * @returns {String}
 */
export function toolTitle(tool, upstream) {
	if (!isSimpleMode() || !hasWord(`tool.${tool}`)) return upstream;
	const key = toolKey(tool);
	const name = word(`tool.${tool}`);
	return key ? `${name} (${key})` : name;
}

/**
 * @param {String} id - the view tool's id in visibility.js's 'viewTool' area ('zoomEm')
 * @param {String} upstream - Glyphr Studio's tooltip ('Zoom to fit a full Em')
 * @returns {String}
 */
export function viewToolTitle(id, upstream) {
	if (!isSimpleMode() || !hasWord(`view.${id}`)) return upstream;
	// S3 integration: with 'sketch' on the switch is "See-through" (letter/view_switches.js
	// displayModeKey), so "outline" means one thing in Simple
	if (id === 'displayMode' && isFeatureOn('sketch') && hasWord('view.seeThrough')) {
		return word('view.seeThrough');
	}
	return word(`view.${id}`);
}

/**
 * @param {String} superTitle - 'PAGE', 'EDITING', 'PANEL'
 * @returns {String} what the nav button's small label says
 */
export function navSuperTitle(superTitle) {
	const key = `nav.${String(superTitle).toLowerCase()}`;
	if (!isSimpleMode() || !hasWord(key)) return superTitle;
	return word(key);
}

/** The pages Simple shows (visibility.js 'page'), by their words keys */
const PAGE_WORDS = Object.freeze({
	Overview: 'page.overview',
	Characters: 'page.characters',
	Help: 'page.help',
	About: 'page.about',
});

/**
 * @param {String} page - the navigator's page name ('Overview')
 * @returns {String} what the page button and the page chooser call it
 */
export function pageTitle(page) {
	if (!isSimpleMode() || !PAGE_WORDS[page]) return page;
	return word(PAGE_WORDS[page]);
}

/**
 * @param {Object} project - the open project (getItem, getItemName)
 * @param {String} itemId - 'glyph-0x61'
 * @param {String} upstream - the name All tools shows ('Latin Small Letter A')
 * @returns {String}
 */
export function navItemTitle(project, itemId, upstream) {
	if (!isSimpleMode() || !itemId) return upstream;
	return letterName(charsOf(project, itemId)) || word('check.aLetter');
}

/** Upstream's session states for a letter made or changed since the font was opened */
const THIS_SESSION = ['new', 'changed'];

/**
 * The words after a tile's name: every letter with no ink says "Not made yet. Click to start it."
 * (with a record or not, so Capital A on a new font says what every other empty letter says); a
 * letter with ink made or changed this session says so; one with ink from the file, nothing.
 * @param {String} chars - the letter(s) the tile stands for
 * @param {String} sessionState - 'notCreated' | 'new' | 'changed' | 'old' | ''
 * @param {String} upstream - Glyphr Studio's tooltip
 * @param {Object | null} [item] - the letter's record (default: the open font's, by chars)
 * @returns {String}
 */
export function tileTitle(chars, sessionState, upstream, item = letterRecord(chars)) {
	if (!isSimpleMode()) return upstream;
	const name = letterName(chars) || word('check.aLetter');
	if (!item?.shapes?.length) return `${name}\n\n${word('tile.notMade')}`;
	if (THIS_SESSION.includes(sessionState)) return `${name}\n\n${word('tile.changed')}`;
	return name;
}

/**
 * @param {String} chars - one letter
 * @returns {Object | null} its record in the open font; null for none, or more than one letter
 */
function letterRecord(chars) {
	const points = [...String(chars ?? '')];
	if (points.length !== 1) return null;
	const id = `glyph-0x${points[0].codePointAt(0).toString(16).toUpperCase()}`;
	try {
		return getCurrentProject()?.getItem?.(id) || null;
	} catch {
		return null;
	}
}

/**
 * @param {Object} project
 * @param {String} itemId
 * @returns {String} the characters the item stands for, from the project or a glyph's id
 */
function charsOf(project, itemId) {
	const chars = project?.getItem?.(itemId)?.chars;
	if (typeof chars === 'string' && chars) return chars;
	const glyph = /^glyph-0x([0-9a-f]+)$/i.exec(itemId);
	if (!glyph) return '';
	const code = parseInt(glyph[1], 16);
	return Number.isInteger(code) && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}
