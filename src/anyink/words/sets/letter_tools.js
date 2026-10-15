// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 word set: the letter view's tools (UX-BEGINNER.md 4.3 Tools, 7.1 #5, 2.4 C).
	Owner: B7 letter-tools track: src/anyink/letter/auto_hole.js (holes made by how deep a shape
	sits), src/anyink/letter/point_kind.js (Smooth / Corner) and src/edit_canvas/tools/tools.js
	(the tool column's words, the Point pen's caption, the Fine-tune group).
	Keys:
	  letterTools.caption.*   the small caption under a tool's word ("click to place points")
	  letterTools.finishShape the Point pen's "Finish the shape" button while a shape is drawn
	  letterTools.madeHole    the automatic toast when a new shape became a hole; {number} is the
	                          shape's place in the letter's shape list, as the letter card counts
	                          ("Shape 2")
	  letterTools.makeSolid   that toast's button
	  letterTools.joinedHole, .madeHoleJoined, .stayedSolid   the same toast where shapes
	                          overlap: a hole merged with the hole it crosses, a hole whose shapes
	                          around it were merged, a shape that couldn't be a hole (B6 + B7 fix)
	  letterTools.droppedShape, .droppedShapeOn   a Point pen shape too small to keep, taken
	                          away when it ends (B6 + B7 finalize)
	  letterTools.step.*      Undo titles these actions write (plain titles, 2.2: they pass
	                          through historyText as they are)
	  letterTools.role.*      the Solid / Hole switch's two words, for the letter card (4.3)
	  letterTools.point.*     the This point row's heading and its two buttons, for the card
	The tool names themselves are mode.js's tool.* words (B5). No pro words here: the glossary's
	term.hole, term.smooth and term.corner (core.js) carry them. No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const LETTER_TOOLS = {
	// --------------------------------------------------------------
	// The tool column (4.3 Tools)
	// --------------------------------------------------------------
	'letterTools.caption.newPath': { text: 'click to place points', feature: 'letterView' },
	// The Point pen's button by the canvas while a shape is being drawn (upstream "Done creating
	// path"), Simple only; live now, since Simple's Point pen shows it today
	'letterTools.finishShape': {
		text: 'Finish the shape',
		hint: 'Or click the first point again.',
	},

	// --------------------------------------------------------------
	// Holes made automatically (7.1 #5)
	// --------------------------------------------------------------
	'letterTools.madeHole': {
		text: 'Made shape {number} a hole',
		hint: 'A shape drawn inside another cuts a hole in it. A shape inside that hole is ink again.',
		feature: 'letterView',
	},
	'letterTools.makeSolid': { text: 'Make it solid', feature: 'letterView' },
	// B6 + B7 fix: holes by what shows under a new shape, where shapes overlap (auto_hole.js)
	'letterTools.joinedHole': {
		text: 'Made it a hole, merged with shape {number}',
		hint: 'Holes that overlap become one hole, so no ink is left where they cross.',
		feature: 'letterView',
	},
	'letterTools.madeHoleJoined': {
		text: 'Made shape {number} a hole and merged the shapes around it',
		hint: 'The shapes under it overlapped, so they became one shape for the hole to cut.',
		feature: 'letterView',
	},
	'letterTools.stayedSolid': {
		text: 'Shape {number} stays solid. Merge overlapping shapes, then draw it again to cut a hole.',
		hint: 'The shapes under it overlap, and joining them here would change how the rest looks.',
		feature: 'letterView',
	},
	// B6 + B7 finalize: a Point pen shape of 1 or 2 clicked points holds no ink and the font file
	// can't hold it, so ending it ("Finish the shape", another tool, leaving the letter) takes it
	// away, as one step (history.removedStray), with this toast
	'letterTools.droppedShape': {
		text: 'A shape needs at least 3 points, so that one was taken away.',
		hint: 'Undo brings it back.',
		feature: 'letterView',
	},
	'letterTools.droppedShapeOn': {
		text: 'A shape needs at least 3 points, so the one on {letter} was taken away.',
		hint: 'Undo brings it back.',
		feature: 'letterView',
	},
	'letterTools.step.madeHole': { text: 'made shape {number} a hole', feature: 'letterView' },
	'letterTools.step.madeSolid': { text: 'made shape {number} solid', feature: 'letterView' },

	// --------------------------------------------------------------
	// The Solid / Hole switch on a picked shape (4.3 Fine-tune > Shapes)
	// --------------------------------------------------------------
	'letterTools.role.solid': {
		text: 'Solid',
		hint: 'The shape is filled with ink.',
		feature: 'letterView',
	},
	'letterTools.role.hole': {
		text: 'Hole',
		hint: 'The shape cuts out of the shape around it, like the middle of an o.',
		feature: 'letterView',
	},

	// --------------------------------------------------------------
	// This point (4.3 Fine-tune, Edit points with one point picked)
	// --------------------------------------------------------------
	'letterTools.point.heading': { text: 'This point', feature: 'letterView' },
	'letterTools.point.smooth': {
		text: 'Smooth',
		hint: 'The curve flows through this point.',
		feature: 'letterView',
	},
	'letterTools.point.corner': {
		text: 'Corner',
		hint: 'The edge turns sharply at this point.',
		feature: 'letterView',
	},
};

export default LETTER_TOOLS;
