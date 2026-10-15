// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 word set: the letter view's card side (UX-BEGINNER.md 4.3): the letter header, the letter
	card and its "Fine-tune this letter" section, the empty-letter overlay and the view switches
	(src/anyink/letter). Owner: B7 letter-card track.
	Keys:
	  letter.back / goPrevious / goNext / goTo   the header: "<- All letters", "< A" / "C >"
	  letter.state.*      the card's state chip: Empty, Ready ("Needs a look" is B11's)
	  letter.fineTune*    the closed section and its parts
	  letter.shape.*      Shapes: one row per shape, the Solid / Hole switch's label
	  letter.action.*     buttons and links on the card
	  letter.spacing.*    Spacing: automatic or set by you
	  The Solid / Hole and Smooth / Corner words, and their Undo titles, are the letter-tools
	  track's (letterTools.role.*, letterTools.point.*, letterTools.step.*, history.point*).
	  letter.overlay.*    the box in the middle of an empty letter
	  letter.switch.*     the view switches inside Fine-tune (Dark paper and Outline only use
	                      view.canvasTheme and view.displayMode, B5's words)
	  letter.step.*       Undo titles (2.2: new ANY-INK actions write plain titles, starting with
	                      a small letter, so historyText passes them through)
	  letter.toast.*      the card's toasts
	feature: 'letterView' for B7's own words; 'brush' and 'photo' for the buttons B8 and B9 turn on.
	No exclamation marks (2.2). Letter names come in as {name} from letterName (2.2).
*/

/** @type {Object<String, Object>} */
const LETTER = {
	// --------------------------------------------------------------
	// Header (4.3 "Header row")
	// --------------------------------------------------------------
	'letter.back': {
		text: '← All letters',
		hint: 'Back to every letter of your font.',
		feature: 'letterView',
	},
	'letter.goPrevious': { text: '‹ {char}', feature: 'letterView' },
	'letter.goNext': { text: '{char} ›', feature: 'letterView' },
	'letter.goTo': { text: 'Go to {name}', feature: 'letterView' },

	// --------------------------------------------------------------
	// The card's state chip (4.3 "Letter card sections", Header)
	// --------------------------------------------------------------
	'letter.state.empty': {
		text: 'Empty',
		hint: 'Nothing drawn yet. An empty letter is left out of your font file.',
		feature: 'letterView',
	},
	'letter.state.ready': {
		text: 'Ready',
		hint: 'This letter has ink. It goes in your font file.',
		feature: 'letterView',
	},

	// --------------------------------------------------------------
	// Fine-tune this letter (closed by default)
	// --------------------------------------------------------------
	'letter.fineTune': {
		text: 'Fine-tune this letter',
		hint: 'Shapes, spacing and the extra drawing tools for this letter.',
		feature: 'letterView',
	},
	'letter.fineTune.shapes': { text: 'Shapes', feature: 'letterView' },
	'letter.fineTune.spacing': { text: 'Spacing', feature: 'letterView' },

	'letter.shape.row': { text: 'Shape {number}', feature: 'letterView' },
	'letter.shape.pick': { text: 'Pick shape {number}', feature: 'letterView' },
	'letter.shape.kindLabel': { text: 'Solid or hole', feature: 'letterView' },
	'letter.shapeOptions': { text: 'Shape options', feature: 'letterView' },

	'letter.action.merge': {
		text: 'Merge overlapping shapes',
		hint: 'Shapes that overlap become one shape.',
		feature: 'letterView',
	},
	'letter.action.flipLeftRight': { text: 'Flip left-right', feature: 'letterView' },
	'letter.action.flipUpsideDown': { text: 'Flip upside-down', feature: 'letterView' },
	'letter.action.clear': {
		text: 'Clear letter',
		hint: 'Takes every shape off this letter. Undo brings them back.',
		feature: 'letterView',
	},
	'letter.action.backToAuto': {
		text: 'Back to automatic',
		hint: 'ANY-INK sets the space on each side again.',
		feature: 'letterView',
	},
	'letter.action.moreTools': {
		text: 'Open in More tools',
		hint: 'Every Glyphr Studio tool, in its own words. Back to simple brings you back.',
		feature: 'letterView',
	},
	'letter.action.traceAgain': {
		text: 'Trace again',
		hint: 'Trace this letter from its photo again.',
		feature: 'photo',
	},
	'letter.action.drawOver': {
		text: 'Draw over it',
		hint: 'Picks the Brush, to add ink to this letter.',
		feature: 'brush',
	},

	'letter.spacing.auto': {
		text: 'Automatic. Drag the purple edges to set it yourself.',
		feature: 'letterView',
	},
	'letter.spacing.manual': { text: 'Set by you.', feature: 'letterView' },


	// --------------------------------------------------------------
	// The empty-letter overlay (4.3 "Empty letter")
	// --------------------------------------------------------------
	'letter.overlay.empty': { text: '{name} is empty.', feature: 'letterView' },
	'letter.overlay.drawPoints': {
		text: 'Draw it with points',
		hint: 'Picks the Point pen. Click to place points; click the first point to finish.',
		feature: 'letterView',
	},
	'letter.overlay.drawBrush': {
		text: 'Draw with the brush',
		hint: 'Picks the Brush. Drag to draw.',
		feature: 'brush',
	},

	// --------------------------------------------------------------
	// View switches, inside Fine-tune (4.3 Canvas, "View controls")
	// --------------------------------------------------------------
	'letter.switch.neighbors': { text: 'Neighbors', feature: 'letterView' },
	'letter.switch.neighborsTip': {
		text: 'Shows your {letter} on each side, to judge the spacing.',
		feature: 'letterView',
	},
	'letter.switch.guideLetter': { text: 'Guide letter', feature: 'letterView' },
	'letter.switch.guideLetterTip': {
		text: 'A faint letter to draw over. It never goes in your font file.',
		feature: 'letterView',
	},
	'letter.switch.group': { text: 'What the canvas shows', feature: 'letterView' },

	// --------------------------------------------------------------
	// Undo titles (2.2 "Undo titles, one rule"; 7.3: each names the letter it changed)
	// --------------------------------------------------------------
	'letter.step.flipLeftRight': { text: 'flipped {name} left-right', feature: 'letterView' },
	'letter.step.flipUpsideDown': { text: 'flipped {name} upside-down', feature: 'letterView' },
	'letter.step.cleared': { text: 'cleared {name}', feature: 'letterView' },
	'letter.step.merged': { text: 'merged the shapes of {name}', feature: 'letterView' },
	'letter.step.backToAuto': {
		text: 'put the spacing of {name} back to automatic',
		feature: 'letterView',
	},

	// --------------------------------------------------------------
	// Toasts (4.0: a destructive change gets an Undo toast, 7.3)
	// --------------------------------------------------------------
	'letter.toast.cleared': { text: 'Cleared {name}.', feature: 'letterView' },
	// B6 + B7 finalize (7.3: delete a shape is destructive, so it gets an Undo toast): Delete on a
	// picked shape or on picked points, in Simple
	'letter.toast.deletedShape': {
		text: 'Deleted {count|a shape|# shapes} from {name}.',
		feature: 'letterView',
	},
	'letter.toast.deletedPoint': {
		text: 'Deleted {count|a point|# points} from {name}.',
		feature: 'letterView',
	},
	'letter.toast.undo': { text: 'Undo', feature: 'letterView' },
	// Merge overlapping shapes (fix pass): said only after a real merge; a merge that would
	// change nothing says so instead, and records no step (principle 6)
	'letter.toast.merged': { text: 'Merged the overlapping shapes of {name}.', feature: 'letterView' },
	'letter.toast.nothingToMerge': {
		text: 'No shapes overlap, so nothing changed.',
		feature: 'letterView',
	},
	'letter.toast.mergeFailed': {
		text: "Couldn't merge the shapes. Nothing changed.",
		feature: 'letterView',
	},
};

export default LETTER;
