// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 word set: the start screen (UX-BEGINNER.md 4.1) and its crash card, the replace question
	(7.4 #5). Owner: the B13 start track (src/anyink/start/). The throw-away question and its two
	buttons (7.4 #1) are recovery.js's recover.throwAway* keys, used from there.
	Keys:
	  startScreen.*            the screen: the Continue card, the other fonts, the new-font form,
	                           "Other ways to start...", the credit line, the drop note
	  startScreen.crash.*      the two crash versions of the Continue card (there is never a second
	                           card or a second green button)
	  startScreen.when.*       a backup copy's day and time ("Tuesday 3:40 PM", "today 3:40 PM")
	  startScreen.replace.*    confirmation 5: Create my font onto a recent font or a work file with
	                           letters in it
	  startScreen.note.*       one sentence under the Continue card when Chrome said no, or the file
	                           moved
	feature: 'startScreen' (B13); the work-file note that names step 3 also needs 'useInWord'
	(B14), so before B14 it says only the first sentence. No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const START = {
	'startScreen.appName': { text: 'ANY-INK', feature: 'startScreen' },
	'startScreen.continueTitle': { text: 'Continue where you left off', feature: 'startScreen' },
	'startScreen.continue': {
		text: 'Continue',
		hint: 'Opens this font where you left it.',
		feature: 'startScreen',
	},
	'startScreen.lastUsed': { text: 'last used {ago}', feature: 'startScreen' },
	'startScreen.allowHint': {
		text: 'Chrome may ask to let ANY-INK edit this file. Choose Allow on every visit.',
		feature: 'startScreen',
	},
	'startScreen.note.refused': {
		text: 'Chrome needs your OK to open this file. Press Continue again and choose Allow.',
		feature: 'startScreen',
	},
	'startScreen.note.gone': {
		text: "The work file for {name} isn't where it was. Press Open a saved font... to find it.",
		feature: 'startScreen',
	},
	'startScreen.crash.withFile': {
		text: "{name} has changes from {when} that aren't in its work file.",
		hint: 'ANY-INK closed before these changes reached the work file. A backup copy kept them.',
		feature: 'startScreen',
	},
	'startScreen.crash.continueWithThem': { text: 'Continue with them', feature: 'startScreen' },
	'startScreen.crash.openSaved': { text: 'Open the saved file instead', feature: 'startScreen' },
	'startScreen.crash.noFile': {
		text: 'Unsaved work from {when}: {name}.',
		hint: 'This font was never saved to a work file. A backup copy kept it.',
		feature: 'startScreen',
	},
	'startScreen.crash.continueWithIt': { text: 'Continue with it', feature: 'startScreen' },
	'startScreen.when.today': { text: 'today {time}', feature: 'startScreen' },
	'startScreen.when.yesterday': { text: 'yesterday {time}', feature: 'startScreen' },
	'startScreen.when.day': { text: '{day} {time}', feature: 'startScreen' },
	'startScreen.otherFonts': { text: 'Other fonts:', feature: 'startScreen' },
	'startScreen.openSaved': {
		text: 'Open a saved font...',
		hint: 'Find a work file on this PC.',
		feature: 'startScreen',
	},
	'startScreen.newTitle': { text: 'Make a new font', feature: 'startScreen' },
	'startScreen.nameIt': {
		text: 'Name it:',
		hint: 'Your font shows under this name in Word.',
		feature: 'startScreen',
	},
	'startScreen.defaultName': { text: 'My Font', feature: 'startScreen' },
	'startScreen.defaultNameNumbered': { text: 'My Font {number}', feature: 'startScreen' },
	'startScreen.create': { text: 'Create my font', feature: 'startScreen' },
	'startScreen.whereNote': {
		text: 'Next, Windows asks where to keep your work file. Documents is fine.',
		feature: 'startScreen',
	},
	'startScreen.workFileNote': {
		text: 'This is your work file, not the font.',
		feature: 'startScreen',
	},
	'startScreen.workFileNoteStep3': {
		text: "This is your work file, not the font. You'll make the font for Word in step 3.",
		feature: 'useInWord',
	},
	'startScreen.otherWays': {
		text: 'Other ways to start...',
		hint: 'Bring in a font file, see every backup copy, or open an example. Uses Glyphr Studio words.',
		feature: 'startScreen',
	},
	'startScreen.credit': { text: 'Built on Glyphr Studio 2 (GPL)', feature: 'startScreen' },
	'startScreen.dropNote': { text: 'Drop your work file here', feature: 'startScreen' },
	'startScreen.replace.question': {
		text: 'That replaces your font "{name}" ({count|1 letter|# letters}).',
		hint: 'A backup copy of the old file is kept either way.',
		feature: 'startScreen',
	},
	'startScreen.replace.cannotRead': {
		text: '"{name}" isn\'t a work file, so it stays as it is. Use a new name for your font.',
		hint: "Nothing is written over a file ANY-INK can't keep a backup copy of.",
		feature: 'startScreen',
	},
	'startScreen.replace.newName': { text: 'Use a new name', feature: 'startScreen' },
	'startScreen.replace.replaceIt': { text: 'Replace it', feature: 'startScreen' },
};

export default START;
