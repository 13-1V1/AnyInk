// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 fix track word set: the start page's Recover card in Simple (UX-BEGINNER.md 2.4 G "backup
	copy", 4.1, 7.4 #1), until B13's start screen and crash card take these keys over.
	Owner: the toast fix track (src/anyink/recovery/recovery_ui.js). All tools keeps the card's
	own words (2.2).
	Keys:
	  recover.nothing        the Recover tab when there is nothing to recover
	  recover.hasFile        the badge on a backup copy whose font has a work file
	  recover.throwAway*     the one start-screen confirm (7.4 #1), for unsaved work with no work
	  recover.keep           file: the question, and its two buttons
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const RECOVERY = {
	'recover.nothing': {
		text: 'Nothing to recover. ANY-INK keeps a backup copy every few seconds while you work.',
	},
	'recover.hasFile': { text: 'has a saved file' },
	'recover.throwAwayQuestion': { text: "Throw away this unsaved work? This can't be undone." },
	'recover.throwAway': { text: 'Throw it away' },
	'recover.keep': { text: 'Keep it' },
};

export default RECOVERY;
