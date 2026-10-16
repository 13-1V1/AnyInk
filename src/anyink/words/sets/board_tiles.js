// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 word set: the letter board's tiles, keys and drops (UX-BEGINNER.md 4.2, 7.3, 7.6, 7.7;
	section 10 B10). Owner: the B10 board-tiles track (src/anyink/board/tile_state.js,
	board_keys.js, board_drop.js, letter_set.js; controls/glyph-tile).
	Keys:
	  boardTile.caption.*   the word under a tile: Empty, Ready (4.2 Tiles; "Needs a look" is the
	                        checks' own, checks.state.needsLook, B10 + B11 integration)
	  boardTile.title.*     a tile's tooltip: "Capital B · Ready · from a photo", "small e · Needs a
	                        look: floats above the writing line"
	  boardTile.step.*      Undo titles of the letter-set step (2.2: plain titles start with a
	                        small letter, so historyText passes them through)
	  boardTile.toast.*     what the letter set and the board's keys say
	  boardTile.button.*    their buttons
	  boardDrop.*           what a drop on the board says (4.2 Drops)
	feature: 'board' for all of them (B10 turns it on). Letter names come in as {name} from
	letterName (2.2). No exclamation marks.
*/

/** @type {Object<String, Object>} */
const BOARD_TILES = {
	// --------------------------------------------------------------
	// Tiles (4.2)
	// --------------------------------------------------------------
	'boardTile.caption.empty': { text: 'Empty', feature: 'board' },
	'boardTile.caption.ready': { text: 'Ready', feature: 'board' },

	'boardTile.title.empty': { text: '{name} · Empty', feature: 'board' },
	'boardTile.title.photo': { text: '{name} · Ready · from a photo', feature: 'board' },
	'boardTile.title.drawn': { text: '{name} · Ready · drawn', feature: 'board' },
	'boardTile.title.needsLook': { text: '{name} · Needs a look: {reason}', feature: 'board' },

	// --------------------------------------------------------------
	// The letter set: "+ Numbers & symbols" (4.2 Toolbar, 7.3)
	// --------------------------------------------------------------
	'boardTile.step.addNumbers': { text: 'added numbers & symbols', feature: 'board' },
	'boardTile.step.hideNumbers': { text: 'hid numbers & symbols', feature: 'board' },
	'boardTile.toast.numbersHidden': {
		text: 'Hid numbers & symbols. Your letters are kept.',
		feature: 'board',
	},

	// --------------------------------------------------------------
	// Keys on the board (7.6): a key whose letter the board doesn't show yet
	// --------------------------------------------------------------
	'boardTile.toast.notOnBoard': {
		text: "{name} isn't on your board yet.",
		feature: 'board',
	},
	'boardTile.button.addNumbers': { text: 'Add numbers & symbols', feature: 'board' },

	// --------------------------------------------------------------
	// Drops on the board (4.2 Drops)
	// --------------------------------------------------------------
	'boardDrop.other': {
		text: 'ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2).',
		feature: 'board',
	},
};

export default BOARD_TILES;
