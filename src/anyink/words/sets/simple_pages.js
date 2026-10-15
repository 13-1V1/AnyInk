// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 integration word set: the upstream pages Simple shows today, until the B that replaces
	each one lands (UX-BEGINNER.md 6.2 "Kept in Simple": the Overview until B10's letter board, the
	letter chooser until B7 and B10, Help until B15). In Simple they say these words; All tools keeps
	Glyphr Studio's own (2.2).
	Owner: the B4 + B5 integration; B10 and B15 retire the keys they replace.
	Keys:
	  tile.*      a letter tile's tooltip after the letter's name (controls/glyph-tile): not made
	              yet, changed (B4 + B5 finalize: "made but empty" retired; an empty letter is
	              "not made yet", from its ink)
	  overview.*  the Overview's welcome card and its preview's tooltip (pages/overview.js)
	  help.*      the Help page's first tab (pages/help.js)
	  start.*     the start page's Load and Examples tabs and the recent fonts card (app/
	              open_project.js, files/recents_ui.js), until B13's start screen; file types
	              show as quotes (menu.type*)
	B4 + B5 fix pass (critic findings; the words track adds them, the page owners put them on
	screen in Simple):
	  start.*     also the New tab ("Make a new font", "Font name"), the Load tab's buttons
	              ("Open a work file...", "Or open a font file..."), the Examples tab, the
	              progress while a font file is brought in ("Bringing in letters... 3 of 111"), and
	              the recent fonts card's buttons; the work file is "work file" (2.1), never
	              "project"
	  file.*      the type name the Windows Save and Open dialogs show for a work file
	  help.*      also Simple's Help in a few sentences until B15 (4.10): pick a letter, the tools
	              and their keys, Undo, Save, the font file, the full manual
	  about.*     About in Simple: the Glyphr Studio credit in house words, a library's own name
	              as a quote (bezier-boolean, SVG-to-Bezier)
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const SIMPLE_PAGES = {
	'tile.notMade': { text: 'Not made yet. Click to start it.' },
	'tile.changed': { text: 'Changed since you opened the font.' },

	'overview.welcomeTitle': { text: 'Welcome to ANY-INK' },
	'overview.welcome': {
		text: 'Draw your own font by clicking, dragging and looking. Pick a letter on the right to start.',
	},
	'overview.previewHint': { text: 'Your letters, in a sample sentence' },

	'start.dropWorkFile': { text: 'An ANY-INK work file' },
	'start.typeWorkFile': { text: '.gs2', quote: true, hint: 'The ending of an ANY-INK work file.' },
	'start.dropFontFile': { text: 'A font file' },
	// B4 + B5 fix pass: the start page takes an SVG font here, not a drawing (2.4 E: an SVG font is
	// a font file); a drawing goes on a letter (toast.dropHint)
	'start.dropDrawing': {
		text: 'A font file made of drawings',
		hint: 'An older kind of font file. A plain drawing goes on a letter instead.',
	},
	'start.recentFonts': { text: 'Recent fonts' },
	'start.backupsUnreadable': {
		text: "Couldn't read the backup copies ({reason}). Reload ANY-INK to try again.",
	},
	'start.exampleOblegg': {
		text: 'Oblegg is the original Glyphr Studio sample font. Every editor feature is in it.',
	},
	'start.exampleSimple': { text: 'The simple example font has a few letters to try things on.' },

	// B4 + B5 fix pass: the rest of the start page in Simple, until B13
	'start.newFontTitle': { text: 'Make a new font' },
	'start.fontName': { text: 'Font name', hint: 'Your font shows under this name in Word.' },
	'start.createFont': { text: 'Make the font' },
	'start.openWorkFile': { text: 'Open a work file...' },
	'start.openFontFile': {
		text: 'Or open a font file...',
		hint: 'Brings the letters of a font file into a new work file.',
	},
	'start.examplesTitle': { text: 'Open an example font' },
	'start.exampleSimpleButton': { text: 'Simple example font' },
	'start.exampleObleggButton': { text: 'Oblegg' },
	'start.importing': { text: 'Bringing in letters... {done} of {total}' },
	// B4 + B5 finalize: the drag note and an example while it opens (2.2: no exclamation marks)
	'start.dropNote': { text: 'Drop it here' },
	'start.loadingExample': { text: 'Opening the example font...' },
	'start.importReading': { text: 'Reading your font file...' },
	'start.recentOpen': { text: 'Open {file}' },
	'start.recentForgetAll': { text: 'Forget every recent font' },
	'start.recentRemove': { text: 'Remove from recent fonts' },
	'file.workFileType': {
		text: 'ANY-INK work file',
		hint: 'What the Windows Save and Open boxes call a .gs2 file.',
	},

	'help.title': { text: 'Help' },
	// B4 + B5 fix pass: Simple's Help in a few sentences, until B15's Help page (4.10)
	'help.howPick': {
		text: 'Pick a letter to open it. To go back to a letter later, double-click it in the preview at the bottom.',
	},
	'help.howDraw': { text: 'Draw it with the tools above the letter: {tools}.' },
	'help.toolKey': { text: '{tool} ({key})' },
	'help.howUndo': { text: 'Ctrl+Z undoes your last change, wherever it was. Ctrl+Y redoes it.' },
	'help.howSave': {
		text: 'Ctrl+S saves your work file. The first time, you choose where it goes. Ctrl+O opens a saved font.',
	},
	'help.howFontFile': { text: 'Ctrl+E makes a font file you can install in Windows.' },
	'help.fullManual': { text: "Full manual (Glyphr Studio's help site, uses pro words)" },
	'about.builtOn': {
		text: 'ANY-INK is a personal version of Glyphr Studio v2, the free font editor by Matthew LaGrandeur. Drawing letters and shapes, spacing, joined letters and making font files all come from Glyphr Studio.',
	},
	'about.library': {
		text: '{name}',
		quote: true,
		hint: "A library's own name, as its makers write it.",
	},
	'help.builtOn': {
		text: "ANY-INK is built on Glyphr Studio. Glyphr Studio's help site explains every tool in more detail, in its own pro words.",
	},
};

export default SIMPLE_PAGES;
