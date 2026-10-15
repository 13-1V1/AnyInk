// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 word set: the Brush (UX-BEGINNER.md 4.3 Tools and the letter card's Brush section, 7.3,
	10 B8; src/anyink/nib). Owner: B8 brush track.
	Keys:
	  brush.section         the letter card's Brush section heading
	  brush.size.*          "Size: thin --o-- thick": the label, the two ends, the slider's name
	  brush.step.drew       the Undo title one stroke writes (2.2: a plain title, starting with a
	                        small letter, so historyText passes it through); {name} is
	                        letterPhrase ('Capital B', 'the question mark')
	  brush.shapeName       the name a stroke's shape is given ("Brush stroke 3"); only More
	                        tools' Shapes list shows names, but it is a word he can read
	  brush.next.drag       what to do with the Brush picked on an empty letter, for the Next
	                        line (rule 8's drawing sentence; the coach owns the rule)
	The tool's own name and tooltip are mode.js's tool.nib; its first-use tip is coach.js's
	coach.tip.brush; the overlay's and the card's buttons are letter.js's. All 'brush' (B8).
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const BRUSH = {
	'brush.section': { text: 'Brush', feature: 'brush' },
	'brush.size.label': {
		text: 'Size',
		hint: 'How wide the brush draws. New strokes use it; strokes already drawn stay as they are.',
		feature: 'brush',
	},
	'brush.size.thin': { text: 'thin', feature: 'brush' },
	'brush.size.thick': { text: 'thick', feature: 'brush' },
	'brush.size.slider': { text: 'Brush size', feature: 'brush' },
	'brush.step.drew': { text: 'drew a stroke on {name}', feature: 'brush' },
	'brush.shapeName': { text: 'Brush stroke {number}', feature: 'brush' },
	'brush.next.drag': {
		text: 'Drag on the paper to draw. Each drag is one stroke.',
		feature: 'brush',
	},
};

export default BRUSH;
