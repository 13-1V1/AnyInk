// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 word set: the display points Simple shares with More tools (UX-BEGINNER.md 2.2, section 10
	B4 "Shared display points" and "Carried from B1"). These say the house words in both modes.
	Owner: the B4 display-points track: the canvas guide labels (edit_canvas.js drawGuideLabel),
	the drag readouts (metrics/overlay.js) and the line labels (metrics_math.js METRIC_LABELS /
	LIVE_LABELS), the File menu rows (menu.js makeFileMenuData) and the Projects menu's B1 rows,
	save_status.js, the preview strip's labels, its Samples menu and size slider, the notices in
	pwa/register.js and pwa/notices.js, and the strings B1 put on screen: the font check messages
	(fontcheck/validate.js, validate_kerning.js), "Show me", "Fix it", "N more letters and N gaps
	need fixing too.", the what-to-do sentences (preview/font_status.js hintFor), "Can't show your
	font yet: ...", "the gap between X and Y", the export toast's ", but ... needs fixing." and
	"Open another font first".

	The lines and spaces take their nouns from core.js (line.*, space.*, term.units); this file
	adds only the words around them. Keys:
	  canvas.*  words drawn on the edit canvas: the side edges, the readout pattern
	  metric.*  line settings with no glossary word (grid size, space between lines, overshoot)
	  menu.*    the File and Projects menus; file names and file types are quote entries
	  status.*  the save status
	  strip.*   the preview strip, its Samples menu and size slider
	  check.*   the font check: its sentences, the strip line, the Real font notice, the export
	            toast
	  notice.*  the app notices: offline, install, a new version
	A file name, a folder name or a file type is an exact label from Windows, shown in
	.anyink-quote: an entry with quote: true, so the list of exemptions is here to review. Later Bs
	put their own screens in sets of their own (sets/coach.js, sets/board.js, ...).
	Placeholders follow words.js: {name} is filled in, {count|one|other} picks by number with #
	standing for the number. {n|has|have} is the verb for one letter (n: 1) or joined letters
	(n: 2).
*/

/** @type {Object<String, Object>} */
const SCREENS = {
	// --------------------------------------------------------------
	// The edit canvas
	// --------------------------------------------------------------
	'canvas.readout': {
		text: '{label} {value}',
		hint: 'A line or a space and where it is now, in units, shown while you point at it or drag it.',
	},
	'canvas.leftEdge': { text: 'left edge', hint: "Where the letter's own room starts." },
	'canvas.rightEdge': { text: 'right edge', hint: 'Where the next letter starts.' },

	// --------------------------------------------------------------
	// Line settings with no glossary word (More tools only)
	// --------------------------------------------------------------
	'metric.gridSize': {
		text: 'grid size',
		hint: 'How many units tall the letter box is.',
		pro: 'UPM, units per em',
	},
	'metric.lineGap': {
		text: 'space between lines',
		hint: 'Extra room between lines of text.',
		pro: 'line gap',
	},
	'metric.overshoot': {
		text: 'overshoot',
		hint: 'How far round letters reach past a line, so they look as tall as flat ones.',
		pro: 'overshoot',
	},

	// --------------------------------------------------------------
	// File and Projects menus
	// --------------------------------------------------------------
	'menu.fileName': {
		text: '{name}',
		quote: true,
		hint: 'A file or folder name, exactly as Windows shows it.',
	},
	'menu.saveAs': { text: 'Save as...', hint: 'Saves your work file under a new name.' },
	'menu.saveDownload': {
		text: 'Save your work file to Downloads',
		hint: 'This browser saves files to your Downloads folder.',
	},
	'menu.makeFontFile': {
		text: 'Make a font file ({type})',
		hint: 'A font file you install in Windows.',
	},
	'menu.makeWebFontFile': {
		text: 'Make a web font file ({type})',
		hint: 'A font file for websites. Windows and Word need the other kind.',
	},
	'menu.typeOtf': {
		text: '.otf',
		quote: true,
		hint: 'The kind of font file Windows and Word use.',
	},
	'menu.typeTtf': {
		text: '.ttf',
		quote: true,
		hint: 'An older kind of font file. Windows and Word use it too.',
	},
	'menu.typeWoff': { text: '.woff', quote: true, hint: 'A font file for websites.' },
	'menu.typeWoff2': { text: '.woff2', quote: true, hint: 'A smaller font file for websites.' },
	'menu.typeSvg': {
		text: '.svg',
		quote: true,
		hint: 'A font file made of drawings. Few apps use it.',
	},
	'menu.fontFolder': {
		text: 'Font files go to {folder}...',
		hint: 'Press to choose a different folder.',
	},
	'menu.chooseFontFolder': { text: 'Choose where font files go...' },
	'menu.fontFolderPicked': { text: 'Font files will go to {folder}.' },
	'menu.fontFolderClickAgain': { text: 'Click again to choose where font files go.' },
	// B4 + B5 fix pass (critic finding "Make a font file: the folder picker opens with no
	// explanation"): said before the folder picker opens the first time, and after a font file
	// is made; {folder} and {file} are quotes
	'menu.pickFolderFirst': {
		text: 'Pick a folder for your font files. Make a new folder inside Documents and choose it.',
		hint: "Chrome won't let you pick Documents itself.",
	},
	'menu.fontFileNextStep': {
		text: 'To use it in Word, open {folder}, double-click {file} and press Install.',
	},
	'menu.openAnotherFont': { text: 'Open another font' },
	'menu.openAnotherFontFirst': { text: 'Open another font first' },

	// --------------------------------------------------------------
	// Save status
	// --------------------------------------------------------------
	'status.saved': { text: 'Saved', hint: 'Your work file holds your latest change.' },
	'status.saving': { text: 'Saving...', hint: 'Your work file is being written.' },
	'status.notSavedYet': {
		text: 'Not saved yet',
		hint: 'Press Save to choose where your work file goes.',
	},
	'status.changesNotSaved': {
		text: 'Changes not saved yet',
		hint: 'Press Save to put them in your work file.',
	},
	// B4 + B5 fix pass (4.11): Simple's "Not saved yet" when a work file waits for changes
	'status.notSavedToFile': {
		text: 'Not saved yet',
		hint: 'Press Save to put your changes in your work file.',
	},
	'status.couldntSave': {
		text: "Couldn't save",
		hint: "Your work file couldn't be written. Press Save to try again, or Save as... for a new file.",
	},
	'status.tryAgain': { text: 'Press Save to try again' },
	'status.backupKept': {
		text: 'Backup copy kept',
		hint: 'A safety copy of your work is kept in the browser.',
	},
	'status.backupFailed': { text: "Couldn't save a backup copy" },
	'status.noBackupYet': { text: 'No backup copy yet' },

	// --------------------------------------------------------------
	// Preview strip
	// --------------------------------------------------------------
	'strip.title': { text: 'Preview' },
	'strip.textPlaceholder': { text: 'Type anything' },
	// B4 integration: drawn in the strip and on the Overview when the text has no letters to show
	// (display_canvas.js showPlaceholderMessage)
	'strip.nothingToShow': { text: 'Type something to see your letters here.' },
	// B4 + B5 fix pass: text is typed but none of its made letters is on the sheet
	// (preview/placeholder.js)
	'strip.lettersNotMade': { text: 'Your letters show here as you make them.' },
	'strip.textLabel': { text: 'Text to preview in your letters' },
	'strip.samples': { text: 'Samples', hint: 'Sample text to try.' },
	'strip.samplesHint': { text: 'Sample text to try' },
	'strip.realFont': { text: 'Real font', hint: 'Shows the text the way your font file will.' },
	'strip.sizeLabel': { text: 'Type size in points' },
	'strip.sizeHint': { text: 'Type size (Shift snaps to 10 pt)' },
	// B4 + B5 fix pass (4.0): the tooltip on a letter in the strip (preview/letter_tooltip.js)
	'strip.openHint': { text: 'Double-click to work on {letter}' },
	'strip.openInMoreTools': {
		text: 'Double-click to work on {letter} in More tools',
		hint: 'Joined letters are made in More tools.',
	},
	'strip.sampleNeighbors': { text: '{letter} with its neighbors' },
	'strip.noteThisLetter': { text: 'this letter' },
	'strip.noteLetters': { text: '{count|# letter|# letters}' },
	'strip.noteCapitals': { text: 'capitals' },
	'strip.noteSmallLetters': { text: 'small letters' },

	// --------------------------------------------------------------
	// Font check (B1): sentences, the strip line, the Real font notice, the export toast.
	// {letter} starts the sentence ('small a', 'The space'); {n|has|have} agrees with it.
	// --------------------------------------------------------------
	'check.showMe': { text: 'Show me', hint: 'Opens the letter.' },
	'check.fixIt': { text: 'Fix it', hint: 'Fixes it as one step; Undo puts it back.' },
	'check.aLetter': { text: 'a letter' },
	'check.widthBad': { text: "{letter} {n|has|have} a width the font file can't hold." },
	'check.tooWide': { text: '{letter} {n|is|are} wider than the font file allows.' },
	'check.widthBelowZero': {
		text: "{letter} {n|has|have} a width below zero, which the font file can't hold.",
	},
	'check.inkNoWidth': {
		text: '{letter} {n|has|have} ink but no width, so the next letter would sit on top of {n|it|them}.',
	},
	'check.spaceNoWidth': {
		text: '{letter} {n|has|have} no width, so your words would run together.',
	},
	'check.pointBad': { text: "{letter} {n|has|have} a point the font file can't hold." },
	'check.pointFar': {
		text: '{letter} {n|has|have} a point too far out for the font file to hold.',
	},
	'check.strayShape': {
		text: '{letter} {n|has|have} a shape with only {count|# point|# points}. A shape needs at least {min}.',
	},
	'check.strayShapes': {
		text: '{letter} {n|has|have} {count} shapes with fewer than {min} points. A shape needs at least {min}.',
	},
	'check.gapTooFar': { text: '{gap} is moved further than the font file can hold.' },
	'check.gapBetween': { text: 'the gap between {left} and {right}' },
	'check.someGap': { text: 'the gap between two letters' },
	'check.orList': { text: '{names} or {last}' },
	'check.orMore': { text: '{names} or {count} more' },
	'check.andList': { text: '{names} and {last}' },
	'check.moreLetters': { text: '{count|# more letter|# more letters}' },
	'check.moreThings': { text: '{count} more' },
	'check.letters': { text: '{count|# letter|# letters}' },
	'check.gaps': { text: '{count|# gap|# gaps}' },
	'check.moreGaps': { text: '{count|# more gap|# more gaps}' },
	'check.needsFixing': { text: '{list} {count|needs|need} fixing.' },
	'check.needFixingToo': { text: '{list} {count|needs|need} fixing too.' },
	'check.cantShow': { text: "Can't show your font yet: {list} {count|needs|need} fixing." },
	'check.cantShowUnknown': { text: "Can't show your font yet: one of your letters needs fixing." },
	'check.madeAnyway': { text: 'The font file was made' },
	'check.butNeedsFixing': { text: '{where}, but {clause}' },
	// B4 integration: Simple's export check toast, one sentence with the names as quotes
	// B14 + B15 finalize: "Made", as Use in Word's card says it
	'check.exportedButNeedsFixing': { text: 'Made {file} in {folder}, but {clause}' },
	'check.downloadingButNeedsFixing': { text: 'Downloading {file}, but {clause}' },
	'check.hintPoint': { text: 'Show me, then drag the far point back near the letter.' },
	'check.hintGap': { text: 'Show me, then set the gap to a smaller number.' },
	'check.hintShape': {
		text: 'Show me, then delete the stray shape in the letter it is made from.',
	},

	// --------------------------------------------------------------
	// App notices (pwa/register.js, pwa/notices.js)
	// --------------------------------------------------------------
	'notice.offlineReady': { text: 'ANY-INK works offline now.' },
	'notice.install': { text: 'Install ANY-INK as an app so it opens from your desktop.' },
	'notice.installButton': { text: 'Install' },
	'notice.notNow': { text: 'Not now' },
	'notice.update': { text: 'A new version of ANY-INK is ready. Your work is kept.' },
	'notice.reload': {
		text: 'Reload',
		hint: 'Keeps a backup copy of your work, then opens the new version.',
	},
	'notice.updating': { text: 'Saving a backup copy and getting the new version ready...' },
	'notice.updateReplaced': {
		text: 'An even newer version came out meanwhile. Press Reload again.',
	},
	'notice.updateTimedOut': {
		text: "The new version didn't load in time. Your work is still open. Press Reload to try again.",
	},
	'notice.noBackups': { text: "Backups don't work in this window. Press Save before closing." },
	// B4 integration: why [Reload] couldn't get the new version ready (pwa/checkpoint.js)
	'notice.backupStarting': {
		text: 'Backup copies are still starting. Press Reload again in a moment.',
	},
	'notice.undoRunning': { text: 'Wait for Undo or Redo to finish, then press Reload again.' },
	'notice.backupNotEvery': {
		text: "Couldn't save a backup copy of every open font. Press Save, then press Reload again.",
	},
	'notice.changedDuringBackup': {
		text: 'Your work changed while the backup copy was saved. Press Reload again.',
	},
	'notice.changedBeforeReload': {
		text: 'Your work changed. Press Reload again so the backup copy has your newest change.',
	},
	'notice.offlineFailed': {
		text: "ANY-INK couldn't finish setting up to work offline. Connect to the internet and open ANY-INK again.",
	},
	'notice.appLabel': { text: 'ANY-INK app' },
	'notice.later': { text: 'Later' },
	'notice.ok': { text: 'OK' },
};

export default SCREENS;
