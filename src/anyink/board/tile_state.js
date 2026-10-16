// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: what a letter's tile on the board shows (UX-BEGINNER.md 4.2 Tiles and "Ready"; section 10
	B10 tile_state.js). GlyphTile's session-state attribute grows into the board's states
	(controls/glyph-tile/glyph_tile.js draws them; tile_state.css is their look):

	  state       look                                              caption        tooltip
	  empty       a faint outlined letter, dashed border            "Empty"        "Capital B · Empty"
	  ready       his ink                                           "Ready"        "... · Ready · from a photo" | "... · Ready · drawn"
	  needsLook   his ink, amber border, "!" (B11, 'checks' on)     "Needs a look" "small e · Needs a look: floats above the writing line"
	  sheet       his ink, after M9 ("from your sheet"); nothing makes it yet
	  last touched (any state): a green outline ring, and the board's one tab stop

	Ready and Empty follow the one rule the rail, the Next line and the letter card read
	(letter_set.js hasInk): a letter whose only shape is a stray line has no ink, so its tile says
	Empty, as the card does. Until B11 turns on 'checks', Ready = has ink and no tile is amber. With
	'checks' on, B11's check for the letter (the Next line's source: (item, { char, editor }) =>
	needsLook | null, coach_state.js) makes it "Needs a look"; its tooltip says needsLook.short
	(the reason without the letter's name) or else the reason sentence, without its period.
	"From a photo": the letter has a photo under it and ink that isn't only brush strokes; anything
	else with ink is "drawn". Looking never makes a letter's record (project.getItem, never the
	selectedItem getter).

	  TILE_STATES                         ['empty', 'ready', 'needsLook', 'sheet']
	  tileStateOf(project, char, { checks, checksOn, editor, open })
	      -> { char, itemId, state, source: 'photo' | 'drawn' | null, name, caption, title,
	           reason, look }
	  tileAttributes(info, { lastTouched })   the GlyphTile attributes for that state
	  makeBoardTile(project, char, options)   a new GlyphTile for the board; options as
	                                          tileStateOf, plus lastTouched. The first one also
	                                          installs the board's keys (board_keys.js)
	  updateBoardTile(tile, info, { lastTouched })   the same tile, changed in place (its ink
	                                          redrawn); returns it
	  lastTouchedChar(editor)             the letter he had open last ('' for none, or for an
	                                      item the board doesn't show)
*/
import { GlyphTile } from '../../controls/glyph-tile/glyph_tile.js';
import { charToHex } from '../../common/character_ids.js';
import { isFeatureOn } from '../mode/features.js';
import { strokeIdOf } from '../nib/stroke_record.js';
import { getTrace } from '../trace/trace_model.js';
import { letterName } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { ensureBoardKeys } from './board_keys.js';
import { boardLetters, hasInk, inkOf } from './letter_set.js';

/** The board's tile states (4.2), as GlyphTile's session-state */
export const TILE_STATES = Object.freeze(['empty', 'ready', 'needsLook', 'sheet']);

/**
 * @param {Object} project - GlyphrStudioProject
 * @param {String} char - one letter of the board
 * @param {Object} [options]
 * @param {Function | null} [options.checks] - B11: (item, { char, editor }) => needsLook | null
 * @param {Boolean} [options.checksOn] - default: the 'checks' flag
 * @param {Object | null} [options.editor] - passed to checks
 * @param {Object | null} [options.open] - the shape the Point pen is still drawing (no ink)
 * @returns {{char: String, itemId: String, state: String, source: String | null, name: String,
 *   caption: String, title: String, reason: String, look: Object | null}}
 */
export function tileStateOf(
	project,
	char,
	{ checks = null, checksOn = isFeatureOn('checks'), editor = null, open = null } = {}
) {
	const itemId = `glyph-${charToHex(char)}`;
	const item = typeof project?.getItem === 'function' ? project.getItem(itemId) || null : null;
	const name = letterName(char) || char;
	const base = { char, itemId, name, source: null, reason: '', look: null };

	if (!hasInk(item, { open })) {
		return {
			...base,
			state: 'empty',
			caption: word('boardTile.caption.empty'),
			title: word('boardTile.title.empty', { name }),
		};
	}

	const look = checksOn ? lookOf(item, char, checks, editor) : null;
	if (look) {
		const reason = shortReason(look);
		return {
			...base,
			state: 'needsLook',
			source: sourceOf(item, open),
			reason,
			look,
			// B10 + B11 integration: the checks' own "Needs a look", the card's chip's words
			caption: word('checks.state.needsLook'),
			title: word('boardTile.title.needsLook', { name, reason }),
		};
	}

	const source = sourceOf(item, open);
	return {
		...base,
		state: 'ready',
		source,
		caption: word('boardTile.caption.ready'),
		title: word(source === 'photo' ? 'boardTile.title.photo' : 'boardTile.title.drawn', { name }),
	};
}

/**
 * B11's check for one letter; a check that throws counts as none (the tile stays Ready).
 * @returns {Object | null}
 */
function lookOf(item, char, checks, editor) {
	if (typeof checks !== 'function') return null;
	try {
		const look = checks(item, { char, editor });
		return look && typeof look === 'object' ? look : null;
	} catch (error) {
		console.warn('ANY-INK board: a letter check failed', error);
		return null;
	}
}

/** @returns {String} the tooltip's reason: short, else the sentence without its final period */
function shortReason(look) {
	const text = String(look.short || look.reason || '').trim();
	return text.replace(/[.]$/, '');
}

/**
 * @param {Object} item - a letter with ink
 * @param {Object | null} open
 * @returns {'photo' | 'drawn'}
 */
function sourceOf(item, open) {
	if (!getTrace(item)?.asset) return 'drawn';
	return inkOf(item, { open }).some((path) => strokeIdOf(path) === null) ? 'photo' : 'drawn';
}

/**
 * @param {Object} info - tileStateOf
 * @param {{lastTouched?: Boolean}} [options]
 * @returns {Object<String, String>} GlyphTile attributes
 */
export function tileAttributes(info, { lastTouched = false } = {}) {
	const attributes = {
		board: '',
		'displayed-item-id': info.itemId,
		'data-anyink-char': info.char,
		'session-state': info.state,
		caption: info.caption,
		title: info.title,
		'aria-label': info.title,
		role: 'button',
		// one tab stop on the board: the last touched tile (board_keys.js moves it)
		tabindex: lastTouched ? '0' : '-1',
	};
	if (lastTouched) attributes['last-touched'] = '';
	return attributes;
}

/**
 * @param {Object} project
 * @param {String} char
 * @param {Object} [options] - tileStateOf's, plus lastTouched
 * @returns {GlyphTile}
 */
export function makeBoardTile(project, char, options = {}) {
	defineTile();
	// the board's keys come with its tiles (board_keys.js), so the board page wires nothing
	ensureBoardKeys();
	const info = tileStateOf(project, char, options);
	return new GlyphTile({ ...tileAttributes(info, options), project });
}

/**
 * @param {HTMLElement} tile - a board tile (makeBoardTile)
 * @param {Object} info - tileStateOf
 * @param {{lastTouched?: Boolean}} [options] - left out: the tile keeps its ring as it is
 * @returns {HTMLElement} the same tile
 */
export function updateBoardTile(tile, info, options = {}) {
	const ring = options.lastTouched ?? tile.hasAttribute('last-touched');
	const attributes = tileAttributes(info, { lastTouched: ring });
	// the tab stop belongs to board_keys.js once he moves with the arrows
	if (!('lastTouched' in options)) delete attributes.tabindex;
	Object.entries(attributes).forEach(([key, value]) => {
		if (tile.getAttribute(key) !== value) tile.setAttribute(key, value);
	});
	if (!ring) tile.removeAttribute('last-touched');
	if (typeof tile.refresh === 'function') tile.refresh();
	return tile;
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {String} the letter he had open last, when the board shows it; '' otherwise
 */
export function lastTouchedChar(editor) {
	const id = editor?.selectedItemID;
	const hex = typeof id === 'string' ? /^glyph-0x([0-9a-f]+)$/i.exec(id) : null;
	if (!hex) return '';
	const char = String.fromCodePoint(parseInt(hex[1], 16));
	return boardLetters(editor.project).includes(char) ? char : '';
}

/** The app defines glyph-tile in main.js; test pages and unit tests may not have. */
function defineTile() {
	if (typeof customElements === 'undefined') return;
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
}
