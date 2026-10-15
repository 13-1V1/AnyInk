// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 word set: the Simple top bar (UX-BEGINNER.md 4.0 "Top bar", 4.9 Menu, 4.11 the status pill).
	Owner: the B6 top bar track: src/anyink/topbar/ (simple_top_bar.js, simple_menu.js,
	status_pill.js, undo_buttons.js) and src/anyink/history/undo_toast.js.
	Words other sets already have are used from there, not repeated: the undo toasts' "Undid:
	{change}" and "Nothing to undo yet" (sets/undo.js), "Show me" (screens.js check.showMe), "Save"
	and "More tools" (core.js term.save, term.moreTools), "Save as..." and the font file rows
	(screens.js menu.*), "Open a saved font..." (mode.js menu.openSavedFont).
	Keys:
	  topbar.*        the bar itself: the logo, the font name, the rail, Undo and Redo, Menu
	  topbar.step.*   the three steps of the rail; {ready} and {total} are counts
	  topbar.menu.*   the Menu's groups and rows (4.9); each row names the feature that ships it
	  topbar.status.* the button inside the status pill
	  topbar.toast.*  the top bar's own toasts
	Sentence case, buttons start with a verb where they act, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const TOPBAR = {
	// --------------------------------------------------------------
	// The bar
	// --------------------------------------------------------------
	'topbar.label': { text: 'ANY-INK top bar', hint: 'The row along the top of every screen.' },
	'topbar.logo': { text: 'ANY-INK', hint: 'Goes to your letters.' },
	'topbar.fontName': { text: '{name}', hint: 'The name of the font you are making.' },
	'topbar.fontDetails': {
		text: 'Font details',
		hint: 'Opens the font name, your name and copyright.',
		feature: 'fontDetails',
	},
	'topbar.undo': { text: 'Undo', hint: 'Takes back your newest change (Ctrl+Z).' },
	'topbar.redo': { text: 'Redo', hint: 'Puts back the change you took back (Ctrl+Y).' },
	'topbar.undoTip': { text: 'Undo: {change}' },
	'topbar.redoTip': { text: 'Redo: {change}' },
	// the step is on a letter that isn't the one open: the press takes the view there (the
	// toast's own words, undo.undidOn)
	'topbar.undoTipOn': { text: 'Undo: {change} on {letter}' },
	'topbar.redoTipOn': { text: 'Redo: {change} on {letter}' },
	'topbar.moreToolsTip': {
		text: 'Shows every Glyphr Studio tool, in its own words. Back to simple brings you back.',
	},
	'topbar.menu': { text: 'Menu', hint: 'Save, open, help and more.' },

	// --------------------------------------------------------------
	// The rail: 1 Letters, 2 Try it, 3 Use in Word (4.0)
	// --------------------------------------------------------------
	'topbar.rail': { text: 'Steps', hint: 'The three steps of making a font.' },
	'topbar.step.letters': { text: 'Letters', hint: 'Step 1: make your letters.' },
	'topbar.step.count': { text: '{ready}/{total}' },
	'topbar.step.lettersTip': {
		text: '{ready} of {total} letters ready. Goes to your letters.',
	},
	'topbar.step.tryIt': {
		text: 'Try it',
		hint: 'Step 2: type with your letters to see how they look.',
		feature: 'tryIt',
	},
	'topbar.step.useInWord': {
		text: 'Use in Word',
		hint: 'Step 3: make the font file and install it for Word.',
		feature: 'useInWord',
	},

	// --------------------------------------------------------------
	// Menu (4.9)
	// --------------------------------------------------------------
	'topbar.menu.file': { text: 'File' },
	'topbar.menu.font': { text: 'Font' },
	'topbar.menu.view': { text: 'View' },
	'topbar.menu.help': { text: 'Help' },
	'topbar.menu.newFont': {
		text: 'Start a new font...',
		hint: 'Goes to the start screen. Your work is checked first.',
		feature: 'startScreen',
	},
	'topbar.menu.makeFontFile': {
		text: 'Make my font file...',
		hint: 'Opens Use in Word.',
		feature: 'useInWord',
	},
	'topbar.menu.fontDetails': {
		text: 'Font details...',
		hint: 'The font name, your name and copyright.',
		feature: 'fontDetails',
	},
	'topbar.menu.moveGuideLines': {
		text: 'Move the guide lines...',
		hint: 'Lets you drag the guide lines to fit your writing.',
		feature: 'fontDetails',
	},
	'topbar.menu.darkPaper': {
		text: 'Dark paper',
		hint: 'Light paper or dark paper behind the letter.',
	},
	'topbar.menu.on': { text: 'On' },
	'topbar.menu.off': { text: 'Off' },
	'topbar.menu.helpHow': { text: 'How to make a font', feature: 'help' },
	'topbar.menu.helpPhoto': { text: 'How to photograph your letters', feature: 'photo' },
	'topbar.menu.helpWords': { text: 'What these words mean', feature: 'help' },
	'topbar.menu.helpWord': { text: 'Use your font in Word', feature: 'help' },
	'topbar.menu.helpKeys': { text: 'Keyboard keys', feature: 'help' },
	// Until B15's Help: the one Help page Simple has (B5), so it is never out of reach
	'topbar.menu.helpPage': { text: 'Help', hint: 'A few sentences on how ANY-INK works.' },
	'topbar.menu.tipsAgain': { text: 'Show tips again', hint: 'The first-time tips come back.' },
	'topbar.menu.install': {
		text: 'Install ANY-INK as an app',
		hint: 'So it opens from your desktop, like any other app.',
	},
	'topbar.menu.about': { text: 'About ANY-INK', hint: 'Credits, and the version.' },

	// --------------------------------------------------------------
	// The status pill (4.11): its button
	// --------------------------------------------------------------
	'topbar.status.fix': { text: 'Fix', hint: 'Says what went wrong and how to fix it.' },

	// --------------------------------------------------------------
	// Toasts
	// --------------------------------------------------------------
	'topbar.toast.tipsAgain': { text: 'Tips will show again as you work' },
};

export default TOPBAR;
