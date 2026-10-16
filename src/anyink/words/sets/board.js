// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 word set: the letter board, home in Simple (UX-BEGINNER.md 4.2). Owner: the B10 board-page
	track (src/anyink/board/board_page.js, progress.js, filters.js). Words other sets already
	have are used from there, not repeated: "Show me" (screens.js check.showMe), "Add numbers &
	symbols" for the Next line's button (coach.js coach.button.addNumbers), the wrong-file drop
	sentence (errors.js).
	Keys:
	  board.*            the board itself: its name, the progress line and bar
	  board.section.*    the letter sets, as section headings (2.1 "letter set"), their counts and
	                     the check mark of a finished one
	  board.toast.*      a finished section's one-time toast (4.2 Progress)
	  board.filter.*     Show: All / Needs a look / Empty (B11's 'checks'; hidden until a letter
	                     needs a look)
	  board.toolbar.*    the toolbar: Use a photo..., Letter spacing..., + / - Numbers & symbols
	  board.tile.*       under "Needs a look", what a tile shows beside its reason: Looks fine to
	                     me, and the fixes' group name (a tile's caption and tooltip are
	                     sets/board_tiles.js boardTile.*, the board-tiles track's)
	feature: 'board' for B10's own words; 'photo', 'tryIt' and 'checks' for what those flags turn
	on. Sentence case, buttons start with a verb where they act (the toolbar's "+ Numbers &
	symbols" is 4.2's own label; its tooltip says what it does), no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const BOARD = {
	// --------------------------------------------------------------
	// The board and its progress line (4.2 Progress)
	// --------------------------------------------------------------
	'board.title': {
		text: 'Your letters',
		hint: 'Every letter of your font. Click one to work on it.',
		feature: 'board',
	},
	'board.progress': { text: '{ready} of {total} ready', feature: 'board' },
	'board.progressLabel': {
		text: '{ready} of {total} letters ready',
		hint: 'A letter is ready when it has your ink and looks right.',
		feature: 'board',
	},

	// --------------------------------------------------------------
	// Sections: the letter sets (2.1 "letter set", 4.2 Letter set)
	// --------------------------------------------------------------
	'board.section.capitals': { text: 'Capitals', hint: 'A to Z.', feature: 'board' },
	'board.section.small': { text: 'Small letters', hint: 'a to z.', feature: 'board' },
	'board.section.punctuation': {
		text: 'Punctuation',
		hint: 'Period, comma, apostrophe, question mark, exclamation mark and hyphen.',
		feature: 'board',
	},
	'board.section.numbers': {
		text: 'Numbers & symbols',
		hint: '0 to 9 and : ; " ( ) & @ # $ % / *',
		feature: 'board',
	},
	// shown beside a section's name once it has a ready letter: "4 of 26"
	'board.section.count': { text: '{ready} of {total}', feature: 'board' },
	'board.section.done': { text: 'All done', feature: 'board' },
	'board.section.countLabel': { text: '{ready} of {total} {name} ready', feature: 'board' },
	'board.spaceNote': {
		text: 'The space between words is made for you.',
		hint: 'Your font file gets a space a quarter of the letter box wide.',
		feature: 'board',
	},

	// --------------------------------------------------------------
	// A finished section's one-time toast
	// --------------------------------------------------------------
	'board.toast.capitalsDone': { text: 'All capitals done.', feature: 'board' },
	'board.toast.smallDone': {
		text: 'All small letters done. Your font can type words now.',
		feature: 'board',
	},
	'board.toast.punctuationDone': { text: 'All punctuation done.', feature: 'board' },
	'board.toast.numbersDone': { text: 'All numbers & symbols done.', feature: 'board' },

	// --------------------------------------------------------------
	// Show: All / Needs a look / Empty (4.2 Filters)
	// --------------------------------------------------------------
	'board.filter.label': { text: 'Show:', feature: 'checks' },
	'board.filter.group': { text: 'Which letters to show', feature: 'checks' },
	'board.filter.all': { text: 'All {count}', feature: 'checks' },
	'board.filter.needsLook': {
		text: 'Needs a look {count}',
		hint: 'Letters with something to check, each with its fix.',
		feature: 'checks',
	},
	'board.filter.empty': {
		text: 'Empty {count}',
		hint: 'Letters with nothing drawn yet.',
		feature: 'checks',
	},
	'board.filter.noneEmpty': { text: 'Every letter has your ink.', feature: 'checks' },

	// --------------------------------------------------------------
	// Toolbar (4.2 Toolbar)
	// --------------------------------------------------------------
	'board.toolbar.label': { text: 'Board tools', feature: 'board' },
	'board.toolbar.usePhoto': {
		text: 'Use a photo...',
		hint: 'Pick a photo of your handwriting. ANY-INK finds each letter on it.',
		feature: 'photo',
	},
	'board.toolbar.letterSpacing': {
		text: 'Letter spacing...',
		hint: 'Move all letters closer together or further apart.',
		feature: 'tryIt',
	},
	'board.toolbar.addNumbers': {
		text: '+ Numbers & symbols',
		hint: 'Adds 0 to 9 and : ; " ( ) & @ # $ % / * to your letters.',
		feature: 'board',
	},
	'board.toolbar.hideNumbers': {
		text: '- Numbers & symbols',
		hint: 'Hides the numbers & symbols. Nothing you drew is lost; Undo brings them back.',
		feature: 'board',
	},

	// --------------------------------------------------------------
	// Tiles under "Needs a look" (4.2 Filters): the reason and the fixes on the tile. A tile's
	// caption and tooltip are the board-tiles track's (sets/board_tiles.js boardTile.*)
	// --------------------------------------------------------------
	'board.tile.looksFine': {
		text: 'Looks fine to me',
		hint: 'Keeps this letter as it is. It counts as ready.',
		feature: 'checks',
	},
	'board.tile.fixes': { text: 'Fixes for {name}', feature: 'checks' },
};

export default BOARD;
