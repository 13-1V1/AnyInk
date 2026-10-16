// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 word set: Try it, the strip side (UX-BEGINNER.md 4.0 Preview strip, 4.6 Try it).
	Owner: the B12 strip track: src/anyink/tryit/expand.js, stand_ins.js, font_check_line.js and
	src/anyink/preview/preview_strip.js. The gap fixes and letter spacing keep their own words.
	Words other sets already have are used from there: "Fix it" and "Show me" (screens.js
	check.*), the strip's own labels (screens.js strip.*), "Guide lines" (core.js line.guides).
	Keys:
	  tryit.*         the Try it screen: its title, [Done], the hint line, the font check line
	  tryit.legend    the stand-ins' legend at the small strip's right end (until 5 are ready)
	  tryit.legendLine  the same, as a sentence on Try it's hint line under the sheet
	  tryit.big*      the strip's [Big preview] button, which opens Try it
	Sentence case, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const TRYIT = {
	'tryit.title': { text: 'Try it', hint: 'Your letters big, in any words you type.', feature: 'tryIt' },
	'tryit.done': { text: 'Done', hint: 'Closes Try it (Esc).', feature: 'tryIt' },
	'tryit.doneTip': { text: 'Close Try it (Esc)', feature: 'tryIt' },
	'tryit.hint': {
		text: 'Gap between two letters looks off? Point between them and drag the purple handle.',
		feature: 'tryIt',
	},
	'tryit.bigPreview': {
		text: 'Big preview',
		hint: 'Opens Try it: your letters big.',
		feature: 'tryIt',
	},
	'tryit.bigPreviewTip': { text: 'See your letters big in Try it', feature: 'tryIt' },
	'tryit.legend': {
		text: 'gray = not made yet',
		hint: 'Letters you have not made yet show as faint outlines, so words still read.',
		feature: 'tryIt',
	},
	'tryit.legendLine': {
		text: "Gray letters aren't made yet. Double-click one to make it.",
		feature: 'tryIt',
	},
	'tryit.checkOk': { text: 'Your font builds OK.', feature: 'tryIt' },
	'tryit.checking': { text: 'Checking your font...', feature: 'tryIt' },
	'tryit.checkLabel': { text: 'Font check', feature: 'tryIt' },
};

export default TRYIT;
