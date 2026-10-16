// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 word set: what the photo flow itself says (src/anyink/photo/photo_flow.js; UX-BEGINNER.md
	4.4 step C and Use it, 4.0 Toasts, 7.7). Owner: the B9 photo-flow track. The screens' own
	words (the How card, the photo dialog, the photo card) are in sets/photo.js.

	The flow hands a screen { code, key, button } for anything that went wrong, so the card shows
	one plain sentence with its fix button (principle 6). Codes whose words B4 already has keep
	them (the photo toasts in sets/toasts.js: HEIC, wrong type, damaged, too big, no decoder);
	the rest are here. The toast after Use it names the earlier letters of the same photo that
	followed the new size (4.4 "One size for the whole photo"): principle 6, a change to a
	letter he isn't looking at says which. Step C's quiet notes (photoFlow.note.*, fix pass) are
	read from the flow's notes, each with its own vars.
*/

/** @type {Object<String, Object>} */
const PHOTO_FLOW = {
	// --------------------------------------------------------------
	// After Use it, when earlier letters from the photo followed (4.0, 4.4)
	// --------------------------------------------------------------
	// B10 + B11 finalize: before "... needs a look now." when no earlier letter followed
	'photoFlow.traced': { text: 'Traced {letter}.', feature: 'photo' },
	// B16: what got better, in plain words (the run read "Also resized small r ... to match the
	// photo" as "I broke r")
	'photoFlow.tracedResized': {
		text: 'Traced {letter}. Resized {others} a little, so all your letters from this photo stay one size.',
		feature: 'photo',
	},
	'photoFlow.tracedMoved': {
		text: 'Traced {letter}. Moved {others} a little, so they sit on the line like it.',
		feature: 'photo',
	},
	'photoFlow.tracedResizedMoved': {
		text: 'Traced {letter}. Resized {resized} and moved {moved} a little, so all your letters from this photo stay one size.',
		feature: 'photo',
	},
	// Joins the last two letters of a list: "Capital B, small r and small e"
	'photoFlow.listAnd': { text: '{first} and {last}', feature: 'photo' },
	// B10 + B11 finalize: a list never runs on (the critic's toast named 11 letters): two names,
	// then how many more
	'photoFlow.listMore': {
		text: '{first}, {second} and {count|1 other letter|# other letters}',
		feature: 'photo',
	},
	// B10 + B11 finalize: the letters this trace made need a look (4.2: "If a later change flips
	// a letter he isn't looking at, a toast says so"), said in the same toast, with [Show me]
	// B16: calm, never "needs a look now" (a first-timer read it as "I broke it")
	'photoFlow.flippedOne': { text: 'Have a look at {other} too.', feature: 'checks' },
	// B16 final: the one letter's reason, in the check's own sentence ("small r is too short for
	// the small-letter line.")
	'photoFlow.flippedReason': { text: 'Have a look: {reason}', feature: 'checks' },
	'photoFlow.flippedMany': {
		text: 'Have a look at {count|1 other letter|# other letters} too.',
		feature: 'checks',
	},
	'photoFlow.saidAndFlipped': { text: '{said} {flipped}', feature: 'photo' },

	// --------------------------------------------------------------
	// When the trace of a part can't be used (7.7)
	// --------------------------------------------------------------
	// finalize: name the control that shows (Adjust > Ink cutoff), never "More ink"
	'photoFlow.noInk': {
		text: 'No ink found in that part. Drag Ink cutoff toward more ink, or draw the box again.',
		feature: 'photo',
	},
	// finalize: a part with no letter in it at all, where more ink can't help
	'photoFlow.noLetter': {
		text: 'No letter found in that part. Draw the box again around the letter.',
		feature: 'photo',
	},
	'photoFlow.tooManySpecks': {
		text: 'That part has too many specks to trace. Drag Ink cutoff toward less ink, or turn on Remove specks.',
		feature: 'photo',
	},
	'photoFlow.readFailed': {
		text: "ANY-INK couldn't read that photo. Choose it again.",
		feature: 'photo',
	},
	'photoFlow.traceFailed': {
		text: "ANY-INK couldn't trace that part. Press Draw a box and pick it again.",
		feature: 'photo',
	},
	'photoFlow.notApplied': {
		text: "ANY-INK couldn't put the traced shapes in this letter. Press Use it again.",
		feature: 'photo',
	},

	// --------------------------------------------------------------
	// Step C's quiet notes under "Look right?" (photo/photo_flow_notes.js; fix pass)
	// --------------------------------------------------------------
	'photoFlow.note.twoLetters': {
		text: 'This part may be two letters that touch. If so, press Draw a box and drag a box around each one.',
		feature: 'photo',
	},
	'photoFlow.note.reachesAbove': {
		text: '{letter} reaches far above the top line, so lines of text in your font will sit further apart.',
		feature: 'photo',
	},
	'photoFlow.note.reachesBelow': {
		text: '{letter} reaches far below the tail line, so lines of text in your font will sit further apart.',
		feature: 'photo',
	},

	// --------------------------------------------------------------
	// The fix buttons those sentences name
	// --------------------------------------------------------------
	'photoFlow.button.drawBox': { text: 'Draw a box', feature: 'photo' },
	'photoFlow.button.chooseAnother': { text: 'Choose another photo', feature: 'photo' },
};

export default PHOTO_FLOW;
