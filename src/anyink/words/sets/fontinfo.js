// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 word set: Font details and Move the guide lines (UX-BEGINNER.md 4.8, 7.3).
	Owner: the B15 fontinfo track: src/anyink/fontinfo/font_details_dialog.js and move_lines.js.
	Words other sets already have are used from there, not repeated: the line names (core.js
	line.*), "moved the {line}" (fixes.js fixes.step.movedLine, the step a dragged line records),
	"Moving the line made 3 letters need a look." (fixes.js fixes.toast.lineFlipped*), Show me
	(screens.js check.showMe).
	Keys:
	  fontinfo.*          the dialog: title, fields, the Numbers & symbols switch, its buttons
	  fontinfo.step.*     Undo titles: plain words starting with a small letter, passed through as
	                      they are ("Undid: changed the font name")
	  fontinfo.banner.*   the purple banner while the guide lines are unlocked
	  fontinfo.toast.*    a moved line that made letters look right again
	  fontinfo.readout.*  the drag readout when a line stops short of the other (lowercase, like
	                      the canvas's other readouts; {line} is the line's own name)
	Sentence case, buttons start with a verb where they act, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const FONTINFO = {
	// --------------------------------------------------------------
	// The dialog (4.8)
	// --------------------------------------------------------------
	'fontinfo.title': { text: 'Font details', feature: 'fontDetails' },
	'fontinfo.close': { text: 'Close', hint: 'Closes Font details.', feature: 'fontDetails' },
	'fontinfo.fontName': {
		text: 'Font name',
		hint: 'The name Word shows in its font list.',
		feature: 'fontDetails',
	},
	'fontinfo.yourName': {
		text: 'Your name',
		hint: 'Saved inside the font file as the person who made it.',
		feature: 'fontDetails',
	},
	'fontinfo.copyright': {
		text: 'Copyright',
		hint: 'Who owns the font. It fills itself in from your name until you change it.',
		feature: 'fontDetails',
	},
	// what Copyright fills itself with: {year} is this year, {name} his name
	'fontinfo.copyrightText': { text: 'Copyright {year} {name}', feature: 'fontDetails' },
	'fontinfo.numbers': {
		text: 'Numbers & symbols',
		hint: 'Shows 0 to 9 and symbols like & and @ on your letters page. Hiding them keeps your letters.',
		feature: 'fontDetails',
	},
	'fontinfo.shortInWord': {
		text: 'Word keeps font names short: your first test font will be called {test}.',
		feature: 'useInWord',
	},
	'fontinfo.on': { text: 'on', feature: 'fontDetails' },
	'fontinfo.off': { text: 'off', feature: 'fontDetails' },
	'fontinfo.moreLetters': {
		text: 'Accented letters and more are in More tools.',
		feature: 'fontDetails',
	},
	'fontinfo.moveLines': {
		text: 'Move the guide lines...',
		hint: 'Lets you drag the guide lines to fit your writing, for every letter.',
		feature: 'fontDetails',
	},
	'fontinfo.done': { text: 'Done', hint: 'Closes Font details.', feature: 'fontDetails' },

	// --------------------------------------------------------------
	// Undo titles (7.3: settings steps)
	// --------------------------------------------------------------
	'fontinfo.step.fontName': { text: 'changed the font name', feature: 'fontDetails' },
	'fontinfo.step.yourName': { text: 'changed your name', feature: 'fontDetails' },
	'fontinfo.step.copyright': { text: 'changed the copyright', feature: 'fontDetails' },

	// --------------------------------------------------------------
	// The banner while the guide lines are unlocked (4.8)
	// --------------------------------------------------------------
	'fontinfo.banner.text': {
		text: "Guide lines unlocked. Drag a line to move it for every letter. Letters keep their size, and they'll be checked again. Undo puts it back.",
		feature: 'fontDetails',
	},
	'fontinfo.banner.done': {
		text: 'Done',
		hint: 'Locks the guide lines again.',
		feature: 'fontDetails',
	},

	// --------------------------------------------------------------
	// Toasts
	// --------------------------------------------------------------
	'fontinfo.readout.smallStops': {
		text: '{line} stops here, so small letters stay shorter than capitals',
		hint: 'Shown by the pointer when the small-letter line reaches the closest it can get to the capitals line.',
		feature: 'fontDetails',
	},
	'fontinfo.readout.capitalsStops': {
		text: '{line} stops here, so capitals stay taller than small letters',
		hint: 'Shown by the pointer when the capitals line reaches the closest it can get to the small-letter line.',
		feature: 'fontDetails',
	},
	'fontinfo.toast.lineCleared': {
		text: 'Moving the line made {count|1 letter|# letters} look right.',
		feature: 'fontDetails',
	},
};

export default FONTINFO;
