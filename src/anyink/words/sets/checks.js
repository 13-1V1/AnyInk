// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11 word set: the checks on each letter (UX-BEGINNER.md 4.2 "Ready", "Needs a look", soft
	notes; 4.3 the letter card's state chip; 4.0 rule 7; section 10 B11). Owner: the B11 checks
	track (src/anyink/checks/checks.js, soft_notes.js, cache.js, looks_fine.js).

	Keys start with 'checks.':
	  checks.reason.*   one sentence per problem, as the Next line says it (rule 7: "Capital B
	                    floats above the writing line."); {letter} starts the sentence
	                    (sentenceStart(letterPhrase(char)): 'small e', 'The period')
	  checks.short.*    the same problem without the letter's name, for a tile's tooltip and the
	                    card's chip ("small e · Needs a look: floats above the writing line")
	  checks.line.*     the line a letter's size is judged by, as it sits in a sentence
	  checks.looksFine  the button every problem offers; checks.step.looksFine its Undo title
	  checks.state.*    the tile's caption and the card's chip for a letter that needs a look
	  checks.note.*     soft notes: a quiet line on the card that never takes Ready away
	The fix buttons, their Undo titles and the "made N letters need a look" toasts are the fixes
	track's (sets/fixes.js, 'fixes.*'); the font file's own sentences are B1's ('check.*').
	No exclamation marks (2.2). Every word here passes the banned-word scan.
*/

/** @type {Object<String, Object>} */
const CHECKS = {
	// --------------------------------------------------------------
	// Reasons (4.2, 4.0 rule 7; B11's list)
	// --------------------------------------------------------------
	'checks.reason.hangs': {
		text: '{letter} hangs past its edges, into the letters beside it.',
		hint: 'Part of the ink reaches past the purple edges of the letter.',
		feature: 'checks',
	},
	'checks.short.hangs': { text: 'hangs past its edges', feature: 'checks' },
	'checks.reason.floats': {
		text: '{letter} floats above the writing line.',
		hint: 'The bottom of the letter should sit on the writing line.',
		feature: 'checks',
	},
	'checks.short.floats': { text: 'floats above the writing line', feature: 'checks' },
	'checks.reason.sinks': {
		text: '{letter} sinks below the writing line.',
		hint: 'The bottom of the letter should sit on the writing line.',
		feature: 'checks',
	},
	'checks.short.sinks': { text: 'sinks below the writing line', feature: 'checks' },
	'checks.reason.tooTall': {
		text: '{letter} is too tall for {line}.',
		hint: 'It is much bigger than its guide lines, so it would look too big next to your other letters.',
		feature: 'checks',
	},
	'checks.short.tooTall': { text: 'too tall for {line}', feature: 'checks' },
	'checks.reason.tooShort': {
		text: '{letter} is too short for {line}.',
		hint: 'It is much smaller than its guide lines, so it would look too small next to your other letters.',
		feature: 'checks',
	},
	'checks.short.tooShort': { text: 'too short for {line}', feature: 'checks' },
	'checks.reason.narrow': {
		text: '{letter} is too narrow, so the letters beside it would crowd it.',
		feature: 'checks',
	},
	'checks.short.narrow': { text: 'too narrow', feature: 'checks' },
	'checks.reason.wide': {
		text: '{letter} is too wide, so it would leave a big gap after it.',
		feature: 'checks',
	},
	'checks.short.wide': { text: 'too wide', feature: 'checks' },
	'checks.reason.specks': {
		text: '{letter} has {count|a speck|# specks} of stray ink.',
		hint: 'Tiny dots of ink that are not part of the letter.',
		feature: 'checks',
	},
	'checks.short.specks': { text: '{count|a speck|# specks} of stray ink', feature: 'checks' },
	'checks.reason.pokesTop': {
		text: '{letter} pokes above the top line.',
		hint: 'Ink far above the top line can be cut off when you type.',
		feature: 'checks',
	},
	'checks.short.pokesTop': { text: 'pokes above the top line', feature: 'checks' },
	'checks.reason.pokesTail': {
		text: '{letter} pokes below the tail line.',
		hint: 'Ink far below the tail line can be cut off when you type.',
		feature: 'checks',
	},
	'checks.short.pokesTail': { text: 'pokes below the tail line', feature: 'checks' },
	'checks.reason.pokesBoth': {
		text: '{letter} pokes above the top line and below the tail line.',
		feature: 'checks',
	},
	'checks.short.pokesBoth': {
		text: 'pokes above the top line and below the tail line',
		feature: 'checks',
	},
	// Ink with no width says B1's own sentence (check.inkNoWidth); a font-file problem says the
	// font check's sentence. Their short forms:
	'checks.short.inkNoWidth': { text: 'has ink but no width', feature: 'checks' },
	'checks.short.fontFile': { text: "has a problem the font file can't hold", feature: 'checks' },

	// --------------------------------------------------------------
	// The line a size is judged by, as it sits in a sentence ({line} above)
	// --------------------------------------------------------------
	'checks.line.xHeight': { text: 'the small-letter line', feature: 'checks' },
	'checks.line.capHeight': { text: 'the capitals line', feature: 'checks' },
	'checks.line.ascent': { text: 'the top line', feature: 'checks' },
	'checks.line.between': {
		text: 'its guide lines',
		hint: 'A small t reaches halfway from the small-letter line to the top line.',
		feature: 'checks',
	},

	// --------------------------------------------------------------
	// Looks fine to me (4.2: every problem offers it; stored per letter and per problem)
	// --------------------------------------------------------------
	'checks.looksFine': {
		text: 'Looks fine to me',
		hint: 'Keeps the letter as it is. It counts as ready until you change its shapes.',
		feature: 'checks',
	},
	'checks.step.looksFine': { text: 'said {letter} looks fine', feature: 'checks' },

	// --------------------------------------------------------------
	// States (4.2 tiles, 4.3 the card's chip)
	// --------------------------------------------------------------
	'checks.state.needsLook': {
		text: 'Needs a look',
		hint: 'Something about this letter may come out wrong when you type. The card says what.',
		feature: 'checks',
	},
	'checks.state.needsLookWhy': { text: 'Needs a look: {reason}', feature: 'checks' },

	// --------------------------------------------------------------
	// Soft notes (4.2: never take Ready away, never turn a tile amber)
	// --------------------------------------------------------------
	'checks.note.thicker': {
		text: 'Note: thicker than your other letters.',
		hint: 'The pen line looks heavier here than in most of your letters.',
		feature: 'checks',
	},
	'checks.note.thinner': {
		text: 'Note: thinner than your other letters.',
		hint: 'The pen line looks lighter here than in most of your letters.',
		feature: 'checks',
	},
	// Which line it reaches past (B10 + B11 fix pass), in step C's words (photo_flow.js notes)
	'checks.note.pokesTop': {
		text: 'Note: reaches far above the top line, so lines of text will sit further apart.',
		hint: 'Nothing is cut off. Word leaves more room between lines for it.',
		feature: 'checks',
	},
	'checks.note.pokesTail': {
		text: 'Note: reaches far below the tail line, so lines of text will sit further apart.',
		hint: 'Nothing is cut off. Word leaves more room between lines for it.',
		feature: 'checks',
	},
	'checks.note.pokesBoth': {
		text: 'Note: reaches far above the top line and far below the tail line, so lines of text will sit further apart.',
		hint: 'Nothing is cut off. Word leaves more room between lines for it.',
		feature: 'checks',
	},
};

export default CHECKS;
