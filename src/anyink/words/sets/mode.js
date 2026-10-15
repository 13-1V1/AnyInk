// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5 word set: the mode switch (UX-BEGINNER.md 4.11 "More tools band", 6.1, 6.3, 7.6).
	Owner: B5 mode core, src/anyink/mode/: band.js (the purple band and the landing rule) and
	keys.js (the "Switched to Rectangle (R)" toast in Simple).
	Keys:
	  mode.band.*     the band under the top bar while More tools is on
	  mode.toolSwitched   the toast a tool key shows in Simple; {tool} is a tool.* word, {key}
	                  the key pressed ("R")
	  tool.*          the drawing tools' names in house words (2.4 D), by the tool's internal name
	                  (D-001): B7 labels the tool buttons with these, Help (B15) lists the keys;
	                  until B7, Simple's tool tooltips (mode/simple_labels.js)
	  view.*, nav.*   today's letter page in Simple until B7: the view switches' tooltips and the
	                  nav buttons' small labels (B4 + B5 integration)
	  page.*          the pages Simple shows, on the page button and in the page chooser, which
	                  Simple keeps until B6's rail replaces it (fix track)
	  menu.openSavedFont   Simple's File menu row for Ctrl+O until B6's Menu (4.9, fix track)
	"More tools" itself is core.js's term.moreTools. No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const MODE = {
	// --------------------------------------------------------------
	// The More tools band (4.11, 6.3)
	// --------------------------------------------------------------
	'mode.band.moreTools': {
		text: "More tools: every Glyphr Studio tool is showing, with Glyphr Studio's own words.",
		hint: 'More tools stays on until you go back to simple or close ANY-INK.',
	},
	'mode.band.backToSimple': { text: 'Back to simple' },
	'mode.band.landedUndo': {
		text: 'Undo took you to one of the More tools pages.',
		hint: 'The change you undid was made on a More tools page, so More tools is on while you look.',
	},
	'mode.band.landedRedo': {
		text: 'Redo took you to one of the More tools pages.',
		hint: 'The change you redid was made on a More tools page, so More tools is on while you look.',
	},
	'mode.band.landed': {
		text: 'This is one of the More tools pages.',
		hint: 'More tools is on while you look at this page.',
	},
	'mode.band.backToLetters': { text: 'Back to my letters' },

	// --------------------------------------------------------------
	// Tool keys (7.6)
	// --------------------------------------------------------------
	'mode.toolSwitched': { text: 'Switched to {tool} ({key})' },

	// --------------------------------------------------------------
	// The drawing tools (2.4 D, 4.3)
	// --------------------------------------------------------------
	'tool.nib': { text: 'Brush', hint: 'Drag to draw ink.', pro: 'nib, stroke', feature: 'brush' },
	'tool.resize': { text: 'Select', hint: 'Pick a shape to move it or change its size.' },
	'tool.pathEdit': {
		text: 'Edit points',
		hint: 'Drag a point to reshape. Drag a round handle to bend the curve.',
	},
	'tool.newPath': {
		text: 'Point pen',
		hint: 'Click to drop points. Hold and drag to bend the curve.',
	},
	'tool.newRectangle': {
		text: 'Rectangle',
		hint: 'Drag to draw. Draw one inside another to cut a hole.',
	},
	'tool.newOval': { text: 'Oval', hint: 'Drag to draw. Draw one inside another to cut a hole.' },
	'tool.pathAddPoint': {
		text: 'Add a point',
		hint: 'Click on a shape’s edge to add a point there.',
	},

	// --------------------------------------------------------------
	// Today's letter page in Simple, until B7's letter view (2.4 D): the view switches'
	// tooltips and the letter button's small label (mode/simple_labels.js)
	// --------------------------------------------------------------
	'view.zoomOut': { text: 'Zoom out' },
	'view.zoomIn': { text: 'Zoom in' },
	'view.displayMode': { text: 'Outline only', hint: 'Shows your shapes as outlines, or filled in.' },
	'view.canvasTheme': { text: 'Dark paper', hint: 'Light paper or dark paper behind the letter.' },
	'view.zoomEm': { text: 'Fit letter', hint: 'Zooms so the whole letter box fits.' },
	'view.zoom1to1': { text: 'Actual size' },
	'view.pan': { text: 'Move view', hint: 'Or hold Space and drag.' },
	'nav.editing': { text: 'Letter' },
	'nav.page': { text: 'Page' },

	// --------------------------------------------------------------
	// The page chooser in Simple, until B6's rail and "<- All letters" (fix track)
	// --------------------------------------------------------------
	'page.overview': { text: 'All letters' },
	'page.characters': { text: 'One letter' },
	'page.help': { text: 'Help' },
	'page.about': { text: 'About ANY-INK' },

	// --------------------------------------------------------------
	// Simple's File menu, until B6's Menu (4.9, fix track)
	// --------------------------------------------------------------
	'menu.openSavedFont': {
		text: 'Open a saved font...',
		hint: 'Opens a work file you saved before, in place of this one.',
	},
};

export default MODE;
