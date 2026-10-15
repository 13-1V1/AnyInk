// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5 word set: Ctrl+O, "Open a saved font" (UX-BEGINNER.md 4.9, 7.6), in both modes.
	Owner: B5 wiring, src/anyink/files/open_font.js. B6's Menu row "Open a saved font..." uses the
	same box, so it says these words too.
	Keys:
	  open.unsaved   the box when his work has changes its work file doesn't hold
	  open.save / open.cancel   its two buttons
	  open.saved     the box after Save finished; open.openFont is its button (a new click, so
	                 Chrome lets the picker open: one picker per click)
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const OPEN = {
	'open.unsaved': {
		text: "Your work has changes that aren't saved.",
		hint: 'Save first, so opening another font loses nothing.',
	},
	'open.save': { text: 'Save' },
	'open.cancel': { text: 'Cancel' },
	'open.saved': { text: 'Saved.' },
	'open.openFont': { text: 'Open a font...' },
};

export default OPEN;
