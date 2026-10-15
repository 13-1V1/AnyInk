// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass word set: letter sets (UX-BEGINNER.md 2.1 "letter set", 2.4 E). A character
	range or Unicode block is never named by its block name or codes in Simple; words/letter_set.js
	letterSetName(range) picks one of these. Owner: the words track; used by the range switch on
	the Overview and the letter chooser (panels/item_chooser.js) until B10's board names its own
	sections (Capitals, Small letters, Punctuation, Numbers & symbols, Accented letters).
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const LETTER_SETS = {
	'set.basic': {
		text: 'Letters, numbers and punctuation',
		hint: 'The everyday letters: a to z, A to Z, 0 to 9 and punctuation.',
		pro: 'Basic Latin',
	},
	'set.accented': {
		text: 'Accented letters',
		hint: 'Letters like é, ñ and ü.',
		pro: 'Latin-1 Supplement',
	},
	'set.moreAccented': {
		text: 'More accented letters',
		hint: 'Letters like ā, ł and ş.',
		pro: 'Latin Extended-A, Latin Extended-B',
	},
	'set.punctuation': {
		text: 'Punctuation',
		hint: 'Dashes, curly quotes and other marks.',
		pro: 'General Punctuation',
	},
	'set.like': { text: 'Letters like {sample}', hint: 'A letter set named by its first letters.' },
	'set.letters': { text: 'Letters' },
	// B4 + B5 finalize: a letter set with nothing to show (the letter chooser, Simple)
	'set.noLetters': { text: 'This letter set has no letters to show.' },
};

export default LETTER_SETS;
