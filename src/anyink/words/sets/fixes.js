// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 word set: the one-click fixes (UX-BEGINNER.md 4.2, 4.3, 7.2, 7.3, section 10 B11).
	Owner: the B11 fixes track: src/anyink/checks/fixes.js, fix_step.js and
	fit_lines_to_writing.js.

	Keys start with 'fixes.':
	  fixes.button.*   the fix buttons, as the board's tiles and the Next line show them
	                   (outlined on a tile; the Next line's one green button in the letter view)
	  fixes.step.*     Undo titles: plain words starting with a small letter, which
	                   words/history_text.js passes through as they are ("Undid: sat small e on
	                   the writing line"); {letter} is letterPhrase ('small e', 'the period'),
	                   {line} a line's house word ('small-letter line')
	  fixes.toast.*    a fix or a moved line that changed another letter's state (4.2,
	                   principle 6); {letter} the fixed letter, {other} the one that changed
	Toasts of two sentences end with a period; a short acknowledgement has none (toasts.js).
*/

/** @type {Object<String, Object>} */
const FIXES = {
	// --------------------------------------------------------------
	// Buttons (4.2 "Needs a look", 4.0 rule 7)
	// --------------------------------------------------------------
	'fixes.button.fitSpacing': {
		text: 'Fit spacing',
		hint: 'Gives the letter its automatic spacing.',
		feature: 'checks',
	},
	'fixes.button.sitOnLine': {
		text: 'Sit on the line',
		hint: 'Moves the letter up or down so it sits on the writing line.',
		feature: 'checks',
	},
	'fixes.button.matchSize': {
		text: 'Match size',
		hint: 'Makes the letter as tall as its line, keeping its shape.',
		feature: 'checks',
	},
	'fixes.button.removeSpecks': {
		text: 'Remove {count|1 speck|# specks}',
		hint: 'Takes out tiny dots of ink that are not part of the letter.',
		feature: 'checks',
	},
	'fixes.button.shrinkToFit': {
		text: 'Shrink to fit',
		hint: 'Makes the letter smaller until it fits between the top line and the tail line.',
		feature: 'checks',
	},
	'fixes.button.fixIt': {
		text: 'Fix it',
		hint: 'Tidies the letter so the font file can hold it.',
		feature: 'checks',
	},
	'fixes.button.drawBox': {
		text: 'Draw a box',
		hint: 'Opens your photo so you can drag a box around each letter on its own.',
		feature: 'checks',
	},
	'fixes.button.moveLine': {
		text: 'Move the line to fit your writing',
		hint: 'Moves the guide line to the size most of your letters are, for every letter.',
		feature: 'checks',
	},

	// --------------------------------------------------------------
	// Undo titles (7.3: each fix is one step)
	// --------------------------------------------------------------
	'fixes.step.fitSpacing': { text: 'fitted the spacing of {letter}', feature: 'checks' },
	'fixes.step.sitOnLine': { text: 'sat {letter} on the writing line', feature: 'checks' },
	'fixes.step.matchSize': { text: 'resized {letter} to fit its line', feature: 'checks' },
	'fixes.step.removeSpecks': {
		text: 'removed {count|a speck|# specks} from {letter}',
		feature: 'checks',
	},
	'fixes.step.shrinkToFit': {
		text: 'shrank {letter} to fit between the guide lines',
		feature: 'checks',
	},
	'fixes.step.fixIt': { text: 'fixed {letter} for the font file', feature: 'checks' },
	'fixes.step.moveLine': { text: 'moved the {line} to fit your writing', feature: 'checks' },
	// B15's guide-line drags, through the same helper
	'fixes.step.movedLine': { text: 'moved the {line}', feature: 'fontDetails' },

	// --------------------------------------------------------------
	// Toasts (4.2: "Moving the line made 3 letters need a look. [Show me]")
	// --------------------------------------------------------------
	'fixes.toast.lineFlippedOne': {
		text: 'Moving the line made {other} need a look.',
		feature: 'checks',
	},
	'fixes.toast.lineFlippedMany': {
		text: 'Moving the line made {count} letters need a look.',
		feature: 'checks',
	},
	'fixes.toast.fixFlippedOne': {
		text: 'Fixing {letter} made {other} need a look.',
		feature: 'checks',
	},
	'fixes.toast.fixFlippedMany': {
		text: 'Fixing {letter} made {count} letters need a look.',
		feature: 'checks',
	},
	'fixes.toast.fixedOther': { text: 'Fixed {letter}', feature: 'checks' },
};

export default FIXES;
