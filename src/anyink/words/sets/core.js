// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 word set: the glossary (UX-BEGINNER.md 2.1) and the house words of 2.2.
	Owner: B4 core (src/anyink/words). Other tracks use these keys and never redefine them: the
	canvas guide labels and drag readouts use line.* and space.*; a "?" hint shows hint, with
	pro as small print (.anyink-pro-word).

	Keys:
	  term.*   the glossary's words
	  line.*   the five guide lines, keyed by their settings names (metrics_math.js keys)
	  space.*  the two side spaces (lsb, rsb)
	  unit.*   2.2's units: pt for type size, inches for paper, units only in drag readouts
	  action.* 2.2's button words
	  cheer.*  2.2's one celebration
	feature: the flag that ships the word (UX-BEGINNER section 10; 'alternates', 'weight' and
	'roughen' are M11, M12 and M13), or null for words live from B4. "More tools" is null: the
	switch is B5's and every screen that shows the word comes after it.
*/

/** @type {Object<String, Object>} */
const CORE = {
	// --------------------------------------------------------------
	// Glossary (2.1), in the table's order
	// --------------------------------------------------------------
	'term.letter': {
		text: 'letter',
		hint: 'Any single thing you draw: a letter, a number or a punctuation mark.',
		like: 'One stamp in a rubber-stamp set',
		pro: 'glyph, character',
		feature: null,
	},
	'term.letterSet': {
		text: 'letter set',
		hint: 'A group of letters to make, like Capitals.',
		pro: 'character range, Unicode block',
		feature: 'board',
	},
	'term.shape': {
		text: 'shape',
		hint: 'One closed outline in a letter.',
		like: 'One cut-out piece of a vinyl decal',
		pro: 'path, contour',
		feature: null,
	},
	'term.hole': {
		text: 'hole',
		hint: 'A shape that cuts out instead of filling, like the middle of o.',
		like: 'A Blender boolean Difference',
		pro: 'counter, reverse winding',
		feature: 'letterView',
	},
	'term.point': {
		text: 'point',
		hint: "A dot on a shape's edge you drag to reshape it.",
		like: 'A vertex in Blender',
		pro: 'path point, node',
		feature: 'letterView',
	},
	'term.curveHandle': {
		text: 'curve handle',
		hint: 'The arm on a point that bends the curve.',
		like: 'Blender curve handles',
		pro: 'control point, Bezier handle',
		feature: 'letterView',
	},
	'term.smooth': {
		text: 'smooth',
		hint: 'A point where the curve flows through.',
		pro: 'symmetric, flat',
		feature: 'letterView',
	},
	'term.corner': {
		text: 'corner',
		hint: 'A point where the curve turns sharply.',
		pro: 'corner point',
		feature: 'letterView',
	},
	'line.guides': {
		text: 'guide lines',
		hint: 'The five lines every letter is drawn on.',
		like: "Kids' handwriting paper",
		pro: 'metrics, vertical metrics',
		feature: null,
	},
	'line.baseline': {
		text: 'writing line',
		hint: 'The line letters sit on.',
		like: 'The ruled line on notebook paper',
		pro: 'baseline',
		feature: null,
	},
	'line.xHeight': {
		text: 'small-letter line',
		hint: 'How tall a, c, e and x are.',
		like: 'The dashed middle line on handwriting paper',
		pro: 'x-height',
		feature: null,
	},
	'line.capHeight': {
		text: 'capitals line',
		hint: 'How tall H and E are.',
		pro: 'cap height',
		feature: null,
	},
	'line.ascent': {
		text: 'top line',
		hint: 'How high b, d and h reach.',
		pro: 'ascender, ascent',
		feature: null,
	},
	'line.descent': {
		text: 'tail line',
		hint: 'How low g, p and y reach.',
		pro: 'descender, descent',
		feature: null,
	},
	'term.letterBox': {
		text: 'letter box',
		hint: 'The square every letter is drawn in.',
		like: 'A sheet of graph paper',
		pro: 'em, em square',
		feature: null,
	},
	'term.units': {
		text: 'units',
		hint: 'Ruler ticks inside the letter box. You see them only while you drag.',
		like: 'Graph-paper squares',
		pro: 'font units, UPM',
		feature: null,
	},
	'space.lsb': {
		text: 'left space',
		hint: 'The gap built into the left side of a letter.',
		like: 'Clearance between parts nested on a sheet',
		pro: 'left side bearing, LSB',
		feature: 'letterView',
	},
	'space.rsb': {
		text: 'right space',
		hint: 'The gap built into the right side of a letter.',
		like: 'Clearance between parts nested on a sheet',
		pro: 'right side bearing, RSB',
		feature: 'letterView',
	},
	'term.letterWidth': {
		text: 'letter width',
		hint: 'Ink plus both spaces: how far the next letter moves over.',
		like: 'How far a typewriter carriage moves',
		pro: 'advance width',
		feature: 'letterView',
	},
	'term.letterSpacing': {
		text: 'letter spacing',
		hint: 'Every gap in the font, made closer or further apart at once.',
		pro: 'tracking',
		feature: 'tryIt',
	},
	'term.gapFix': {
		text: 'gap fix',
		hint: 'The gap between two particular letters, like e and n, made closer or wider.',
		like: 'Nudging one clip on a timeline',
		pro: 'kerning, kern',
		feature: 'tryIt',
	},
	'term.photo': {
		text: 'photo',
		hint: 'Your handwriting under the letter. It never goes in the font file.',
		like: 'Tracing paper',
		pro: 'trace image, trace layer',
		feature: 'photo',
	},
	'term.inkCutoff': {
		text: 'ink cutoff',
		hint: 'How dark something must be to count as ink.',
		like: 'The level knob on an audio noise gate',
		pro: 'threshold',
		feature: 'photo',
	},
	'term.brush': {
		text: 'brush',
		hint: 'Drag to draw ink.',
		like: 'A felt-tip marker',
		pro: 'nib, stroke',
		feature: 'brush',
	},
	'term.versions': {
		text: 'versions',
		hint: 'Two or three takes of one letter that take turns as you type.',
		like: 'Alternate takes of a vocal',
		pro: 'alternates, calt',
		feature: 'alternates',
	},
	'term.boldness': {
		text: 'boldness',
		hint: 'How heavy the strokes are.',
		pro: 'weight, offset',
		feature: 'weight',
	},
	'term.inkTexture': {
		text: 'ink texture',
		hint: 'Rough edges and ink bleed.',
		like: 'Cheap paper soaking up ink',
		pro: 'roughen, distress',
		feature: 'roughen',
	},
	'term.workFile': {
		text: 'work file',
		hint: "Your ANY-INK file. It holds everything you made. It is not the font: Word can't use it.",
		like: 'A .blend file',
		pro: 'project file',
		feature: null,
	},
	'term.save': {
		text: 'Save',
		hint: 'Keeps your work file up to date.',
		like: 'Saving a .blend',
		pro: 'save project',
		feature: null,
	},
	'term.fontFile': {
		text: 'font file',
		hint: 'The file you install in Windows so Word can use your font. You make it in step 3, Use in Word.',
		like: 'Exporting a .glb from Blender',
		pro: 'OTF export',
		feature: 'useInWord',
	},
	'term.backupCopy': {
		text: 'backup copy',
		hint: 'The hidden safety copy kept in the browser.',
		like: "A game's autosave slot",
		pro: 'recovery snapshot',
		feature: 'startScreen',
	},
	'term.moreTools': {
		text: 'More tools',
		hint: 'Everything Glyphr Studio can do, in its own words.',
		like: "Blender's full window next to a simple add-on panel",
		pro: 'Expert mode',
		feature: null,
	},

	// --------------------------------------------------------------
	// House words of 2.2
	// --------------------------------------------------------------
	'unit.pt': { text: '{size} pt', hint: 'Type size, in points.' },
	'unit.inch': { text: '{size} in', hint: 'Inches, for anything on paper.' },
	'unit.units': { text: '{count|# unit|# units}', hint: 'Ruler ticks in the letter box, in readouts only.' },
	'action.useIt': { text: 'Use it', feature: 'photo' },
	'action.goTo': { text: 'Go to {letter}', feature: 'coach' },
	'cheer.fontWorks': { text: 'Your font works. Type something!', feature: 'useInWord' },
};

export default CORE;

/** Help's "What these words mean" (4.10): the 2.1 table, in its order. */
export const GLOSSARY = Object.freeze([
	'term.letter',
	'term.letterSet',
	'term.shape',
	'term.hole',
	'term.point',
	'term.curveHandle',
	'term.smooth',
	'term.corner',
	'line.guides',
	'line.baseline',
	'line.xHeight',
	'line.capHeight',
	'line.ascent',
	'line.descent',
	'term.letterBox',
	'term.units',
	'space.lsb',
	'space.rsb',
	'term.letterWidth',
	'term.letterSpacing',
	'term.gapFix',
	'term.photo',
	'term.inkCutoff',
	'term.brush',
	'term.versions',
	'term.boldness',
	'term.inkTexture',
	'term.workFile',
	'term.save',
	'term.fontFile',
	'term.backupCopy',
	'term.moreTools',
]);
