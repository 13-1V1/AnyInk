// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 word set: the Next line (UX-BEGINNER.md 4.0 "Next line", its 17 rules, and the tips).
	Owner: the B6 coach track: src/anyink/coach/ (rules.js picks one sentence and its button,
	coach_element.js draws <anyink-coach>, tips.js the "Tip:" line).
	Keys:
	  coach.*          the line itself: its label, "Something else", the hide button, the chip
	                   that brings it back
	  coach.rule.*     one sentence per rule, by what it says; {letter} is a letterPhrase
	                   ('small r', 'Capital B', 'the period'), {done} the same at the start of a
	                   sentence, {count} a number
	  coach.button.*   the rules' buttons; buttons start with a verb (2.2). "Show me", "Fix it"
	                   and "Go to {letter}" are screens.js's check.showMe and check.fixIt and
	                   core.js's action.goTo, not repeated here
	  coach.tip.*      first-use tips (4.0 Tips, 4.3 Tools, 4.4 Use it), at most 3 in a session
	Each entry names the feature flag that ships it (principle 8): a rule, button or tip shows
	only while its flag is on. One sentence per rule, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const COACH = {
	// --------------------------------------------------------------
	// The line (4.0 "Next line")
	// --------------------------------------------------------------
	'coach.region': {
		text: 'What to do next',
		hint: 'One sentence saying what to do next, with the button that does it.',
		feature: 'coach',
	},
	'coach.next': { text: 'Next:', feature: 'coach' },
	'coach.somethingElse': {
		text: 'Something else',
		hint: 'Shows another thing you could do next.',
		feature: 'coach',
	},
	'coach.hide': {
		text: 'Hide the next step',
		hint: 'Hides this line until you close ANY-INK. The Next button by the steps brings it back.',
		feature: 'coach',
	},
	'coach.chip': { text: 'Next', hint: 'Shows the next step again.', feature: 'coach' },
	'coach.tipLabel': { text: 'Tip:', feature: 'coach' },

	// --------------------------------------------------------------
	// The 17 rules (4.0), in order; rule 1 (a dialog is open) says nothing
	// --------------------------------------------------------------
	// 2, 3: the photo card in the letter card (4.4 steps A and C)
	'coach.rule.photoPick': {
		text: 'Choose the photo that has your {letter} on it.',
		feature: 'photo',
	},
	'coach.rule.photoResult': {
		text: 'Look right? Press Use it. Wrong part? Press Draw a box.',
		feature: 'photo',
	},
	// 4, 5: Try it is open
	'coach.rule.tryItHappy': {
		text: 'Happy with how it looks? Make a font file for Word.',
		feature: 'useInWord',
	},
	'coach.rule.tryItTyping': {
		text: "Type anything to try your letters. Press Done when you're finished.",
		feature: 'tryIt',
	},
	// 6: the font check found a problem; its own message names the problem, this is for one that
	// came with no words
	'coach.rule.fontProblem': {
		text: "{letter} has a problem the font file can't hold.",
		feature: 'coach',
	},
	// 8: this letter is empty, said with the ways to fill it that exist (principle 8)
	'coach.rule.emptyPhotoBrush': {
		text: '{letter} is empty. Use a photo of it, or draw it with the brush.',
		feature: 'photo',
	},
	'coach.rule.emptyPhoto': { text: '{letter} is empty. Use a photo of it.', feature: 'photo' },
	'coach.rule.emptyBrush': {
		text: '{letter} is empty. Draw it with the brush.',
		feature: 'brush',
	},
	'coach.rule.emptyPoints': {
		text: '{letter} is empty. Draw it with points.',
		feature: 'letterView',
	},
	// 8, B6 + B7 fix pass: a drawing tool is picked on the empty letter (its key names what the
	// tool does on the paper), or the Point pen has a shape still open ({button} is the green
	// "Finish the shape" by the canvas, letterTools.finishShape)
	'coach.rule.drawFirstPoint': {
		text: 'Click on the paper to drop your first point.',
		feature: 'letterView',
	},
	'coach.rule.drawRectangle': {
		text: 'Drag on the paper to draw a rectangle.',
		feature: 'letterView',
	},
	'coach.rule.drawOval': { text: 'Drag on the paper to draw an oval.', feature: 'letterView' },
	'coach.rule.keepClicking': {
		text: 'Keep clicking to drop points, then press {button}.',
		feature: 'letterView',
	},
	'coach.rule.closeShape': {
		text: 'Click your first point, or press {button}.',
		feature: 'letterView',
	},
	// 9
	'coach.rule.needsLook': {
		text: '{count|1 letter needs|# letters need} a look.',
		feature: 'checks',
	},
	// 10; after a failed save the pill's words, with its Fix (topbar.status.fix)
	'coach.rule.notSaved': { text: "Your work isn't saved yet.", feature: 'coach' },
	'coach.rule.saveFailed': { text: "Couldn't save your work.", feature: 'coach' },
	// 11 (before the handwriting sheet, M9)
	'coach.rule.firstPhoto': {
		text: 'First, write your letters on paper and take one photo of the page.',
		feature: 'photo',
	},
	// 12
	'coach.rule.morePhotoLetters': {
		text: 'This photo has {count|1 more letter|# more letters}.',
		feature: 'photo',
	},
	// 13
	'coach.rule.tryLetters': { text: 'Try your letters in a sentence.', feature: 'tryIt' },
	// 14
	'coach.rule.makeFontFile': {
		text: 'Make a font file and try your letters in Word.',
		feature: 'useInWord',
	},
	// 15: the next empty letter, on the board and in the letter view
	'coach.rule.nextLetter': { text: 'Next: {letter}.', feature: 'coach' },
	'coach.rule.doneNextLetter': { text: '{done} looks done. Next: {letter}.', feature: 'coach' },
	// 16
	'coach.rule.allReady': {
		text: 'All {count} letters are ready. Add numbers & symbols next?',
		feature: 'board',
	},
	// 17
	'coach.rule.upToDate': {
		text: 'Your font is up to date. Type something in Try it.',
		feature: 'tryIt',
	},

	// --------------------------------------------------------------
	// Buttons
	// --------------------------------------------------------------
	'coach.button.useInWord': {
		text: 'Use in Word',
		hint: 'Makes a font file and shows how to put it in Word.',
		feature: 'useInWord',
	},
	'coach.button.save': { text: 'Save', hint: 'Keeps your work file up to date.', feature: 'coach' },
	'coach.button.how': {
		text: 'How',
		hint: 'Shows how to photograph your letters.',
		feature: 'photo',
	},
	'coach.button.nextPart': {
		text: 'Do the next one',
		hint: 'Shows the next letter in your photo.',
		feature: 'photo',
	},
	'coach.button.tryIt': {
		text: 'Try it',
		hint: 'Shows your letters big, to try them in words.',
		feature: 'tryIt',
	},
	'coach.button.make': { text: 'Make {letter}', hint: 'Opens that letter.', feature: 'coach' },
	'coach.button.addNumbers': {
		text: 'Add numbers & symbols',
		hint: 'Adds 0 to 9 and : ; " ( ) & @ # $ % / * to your letters.',
		feature: 'board',
	},

	// --------------------------------------------------------------
	// Tips (4.0 Tips): one quiet line under the sentence, gone after the next press
	// --------------------------------------------------------------
	'coach.tip.photoStays': {
		text: 'The faint photo stays under the letter for comparing. It never goes in the font file.',
		feature: 'photo',
	},
	'coach.tip.brush': {
		text: 'Drag to draw. Each drag is one stroke; Undo removes the last one.',
		feature: 'brush',
	},
	// B6 + B7 finalize: a shape placed by clicks has no round handles; Smooth (This point, in
	// Fine-tune) is how a corner gets its curve
	'coach.tip.editPoints': {
		text: 'Drag a point to reshape it. Press Smooth to round a corner.',
		feature: 'coach',
	},
	'coach.tip.pointPen': {
		text: 'Click to drop points. Hold and drag to bend the curve. Click the first point to finish.',
		feature: 'coach',
	},
	'coach.tip.shapes': {
		text: 'Drag to draw. Draw one inside another to cut a hole.',
		feature: 'letterView',
	},
};

export default COACH;
