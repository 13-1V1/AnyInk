// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass word set: plain error messages (UX-BEGINNER.md 7.7). One sentence that says
	what happened and what to do, and its buttons; never a browser's own sentence, a code ([PF0],
	SVG1) or a file format's name. words/error_words.js picks the key for what went wrong.
	Owner: the words track. Used by the error box (showError) callers in Simple: the work file's
	save (files/project_files.js saveErrorMessage), Ctrl+O and the start page (files/read_project.js,
	files/open_font.js, app/open_project.js), a file command that failed (files/run_command.js),
	the font file (formats_io/otf/font_export.js), until B6, B13 and B14 give them their own cards.
	Keys:
	  error.*         the sentences; {file} and {folder} are Windows names, shown as quotes
	                  (.anyink-quote) by whoever fills them (word_html.js wordHTML)
	  error.button.*  the buttons
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const ERRORS = {
	'error.boxTitle': {
		text: "That didn't work",
		hint: 'The title of a box that says what went wrong.',
	},
	'error.yourWorkFile': { text: 'your work file' },

	// Saving the work file (7.7 "Save failed", "File changed by another window or app")
	'error.saveFailed': { text: "Couldn't save to {file}. A backup copy is kept." },
	'error.changedElsewhere': {
		text: '{file} was changed somewhere else. Save your work as a new file so nothing is lost.',
		hint: 'Another window or app wrote the file after ANY-INK opened it.',
	},

	// Opening a work file (Ctrl+O, the start page, a recent font)
	'error.notWorkFile': {
		text: "{file} isn't an ANY-INK work file, or it is damaged. Open another work file, or look on the start page for a backup copy.",
	},
	'error.newerWorkFile': {
		text: '{file} was made with a newer ANY-INK. Reload ANY-INK to get the newest version, then open {file} again.',
	},

	// The folder font files go to, and the font file (7.7)
	'error.noFolderPicked': {
		text: "No folder picked. Make a new folder inside Documents (Chrome won't let you pick Documents itself) and choose it.",
	},
	'error.folderNotWritable': { text: "Couldn't write to {folder}. Chrome may need your OK." },
	'error.fontFileFailed': { text: "Couldn't make the font file. Your work is safe. Try again." },

	// Anything else a file command can run into, and the start page's drop target
	'error.didntFinish': { text: "That didn't finish. Your work is safe. Try again." },
	'error.screenFailed': { text: 'Something went wrong showing this screen. Your work is safe.' },
	'error.drawingNotFont': {
		text: '{file} is a drawing, not a font file. To bring in its shapes, open a letter and drop the drawing on it.',
	},
	'error.fontFileUnreadable': {
		text: "ANY-INK couldn't read {file} as a font file. It may be damaged.",
	},
	'error.unsupportedFile': {
		text: 'ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2).',
	},
	'error.permissionToOpen': {
		text: 'Chrome needs your OK to open this file. Press Continue again and choose Allow.',
		feature: 'startScreen',
	},

	// Buttons
	'error.button.tryAgain': { text: 'Try again' },
	'error.button.saveElsewhere': { text: 'Save somewhere else' },
	'error.button.saveAsNew': { text: 'Save as a new file' },
	'error.button.openAnother': { text: 'Open another work file...' },
	'error.button.pickFolder': { text: 'Pick a folder...' },
	'error.button.pickDifferentFolder': { text: 'Pick a different folder' },
	'error.button.close': { text: 'Close' },
};

export default ERRORS;
