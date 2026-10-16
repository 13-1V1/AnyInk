// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 word set: Try it's gap fixes and letter spacing (UX-BEGINNER.md 4.6). Owner: the B12
	tryit-gaps track (src/anyink/tryit/letter_spacing.js, gap_handle.js, gap_list.js,
	word_note.js). Undo titles for gap fixes are history.js's (history.gapCloser, gapApart,
	gapFixRemovedPair), used from there, not repeated.
	Keys:
	  tryitGaps.spacing.*   "Move all letters closer or further apart": the closed section, its
	                        slider's two ends, [Reset]
	  tryitGaps.step.*      the letter-spacing slider's Undo titles (plain titles pass through
	                        history_text.js as they are)
	  tryitGaps.handle.*    the purple gap handle's tooltip
	  tryitGaps.list.*      "Gaps you fixed (2)": the closed section and each fix as words
	  tryitGaps.toast.*     what a gap fix and its removal say, with [Undo]
	  tryitGaps.wordNote*   "Word needs one setting for gap fixes." and, with B14's 'useInWord',
	                        its pointer to step 3; before B14, wordNoteLater says nothing is
	                        needed now
	Sentence case, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const TRYIT_GAPS = {
	// Letter spacing (4.6 "Move all letters closer or further apart")
	'tryitGaps.spacing.title': {
		text: 'Move all letters closer or further apart',
		hint: 'Every gap in the font at once. Letters never overlap: at the far left end they touch.',
		feature: 'tryIt',
	},
	'tryitGaps.spacing.closer': { text: 'closer', feature: 'tryIt' },
	'tryitGaps.spacing.further': { text: 'further apart', feature: 'tryIt' },
	'tryitGaps.spacing.slider': {
		text: 'Letter spacing: closer or further apart',
		feature: 'tryIt',
	},
	'tryitGaps.spacing.reset': {
		text: 'Reset',
		hint: 'Puts every gap back the way the letters were spaced.',
		feature: 'tryIt',
	},
	'tryitGaps.step.closer': { text: 'moved all letters closer', feature: 'tryIt' },
	'tryitGaps.step.apart': { text: 'moved all letters further apart', feature: 'tryIt' },
	'tryitGaps.step.reset': { text: 'put the letter spacing back', feature: 'tryIt' },

	// The gap handle (4.6 Gap handle)
	'tryitGaps.handle.tip': {
		text: 'drag to close or open this gap',
		hint: 'Double-click it to take the gap fix away.',
		feature: 'tryIt',
	},
	'tryitGaps.handle.label': {
		text: 'Gap between {left} and {right}: drag to close or open it',
		feature: 'tryIt',
	},

	// Gaps you fixed (4.6)
	'tryitGaps.list.title': { text: 'Gaps you fixed ({count})', feature: 'tryIt' },
	// the pair as his own letters, in quotes, and the whole phrase (B12 fix pass)
	'tryitGaps.list.closer': { text: '"{pair}" closer', feature: 'tryIt' },
	'tryitGaps.list.further': { text: '"{pair}" further apart', feature: 'tryIt' },
	'tryitGaps.list.even': { text: '"{pair}" as it was', feature: 'tryIt' },
	// the same row in letter names, as its tooltip
	'tryitGaps.list.closerNames': { text: '{left} and {right} closer', feature: 'tryIt' },
	'tryitGaps.list.furtherNames': { text: '{left} and {right} further apart', feature: 'tryIt' },
	'tryitGaps.list.evenNames': { text: '{left} and {right} as they were', feature: 'tryIt' },
	'tryitGaps.list.remove': {
		text: 'Take away the gap fix between {left} and {right}',
		feature: 'tryIt',
	},

	// Toasts
	'tryitGaps.toast.closer': { text: 'Moved {left} and {right} closer.', feature: 'tryIt' },
	'tryitGaps.toast.apart': { text: 'Moved {left} and {right} apart.', feature: 'tryIt' },
	'tryitGaps.toast.removed': {
		text: 'Took away the gap fix between {left} and {right}.',
		feature: 'tryIt',
	},

	// The Word note (4.6, after the first gap fix)
	'tryitGaps.wordNote': {
		text: 'Word needs one setting for gap fixes.',
		hint: 'Word only uses gap fixes when one setting is on.',
		feature: 'tryIt',
	},
	'tryitGaps.wordNotePointer': { text: 'Use in Word will show you.', feature: 'useInWord' },
	// before B14 (no Use in Word yet): says plainly that nothing is needed now (B12 fix pass)
	'tryitGaps.wordNoteLater': {
		text: 'Nothing to do now: you will be shown it when you put your font in Word.',
		feature: 'tryIt',
	},
};

export default TRYIT_GAPS;
