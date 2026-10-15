// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 word set: the words drawn on the letter view's canvas (UX-BEGINNER.md 4.3 Canvas).
	Owner: B7 letter-canvas track: src/anyink/letter/guide_lines.js (the five labeled lines),
	guide_letter.js (the faint guide letter), edges.js (the left and right edges inside
	Fine-tune), neighbors.js (his n or H on each side) and edit_canvas.js's Simple pass.
	The line labels are core.js's line.* words and the edge labels its space.* words; the
	switches' own words are letter.js's letter.switch.* (the letter-card track). This file adds
	only the words drawn under his neighbor letters.
	Keys:
	  letterCanvas.neighborLabel   under each neighbor letter the first time they show;
	                               {letter} is letterName(): "small n", "Capital H" (2.2: a
	                               letter name is always written in full)
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const LETTER_CANVAS = {
	'letterCanvas.neighborLabel': {
		text: 'Your {letter}, shown for comparing',
		hint: 'Drawn faintly on each side so you can judge the spacing. It is not part of this letter.',
		feature: 'letterView',
	},
};

export default LETTER_CANVAS;
