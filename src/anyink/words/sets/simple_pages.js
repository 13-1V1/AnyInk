// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
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
	  start.*     only the progress while a font file is brought in (start.importing,
	              start.importReading); B13's start screen retired the tabs' and the recent fonts
	              card's Simple words (B12 + B13 integration)
	B4 + B5 fix pass (critic findings; the words track adds them, the page owners put them on
	screen in Simple):
	  start.*     the progress while a font file is brought in ("Bringing in letters... 3 of
	              111"); the work file is "work file" (2.1), never "project"
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

	// B12 + B13 integration: B13's start screen (sets/start.js) retired the tabs' Simple words; the
	// progress while a font file is brought in stays (formats_io)
	'start.importing': { text: 'Bringing in letters... {done} of {total}' },
	'start.importReading': { text: 'Reading your font file...' },
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
