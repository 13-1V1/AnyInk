// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 + B5 fix pass word set: what Undo and Redo say (UX-BEGINNER.md 1 principle 6: "If an action
	changes a letter he isn't looking at, a toast says which"; 4.0 Toasts; 7.3). {change} is
	historyText(title) ('added a rectangle'), {letter} a letterPhrase ('small a').
	Owner: the words track; used by Simple's undo (history/simple_undo.js) when Ctrl+Z changes a
	letter on a page that isn't that letter (Help, About, the Overview), until B6's undo toasts.
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const UNDO = {
	'undo.undid': { text: 'Undid: {change}' },
	'undo.undidOn': { text: 'Undid: {change} on {letter}' },
	'undo.redid': { text: 'Redid: {change}' },
	'undo.redidOn': { text: 'Redid: {change} on {letter}' },
	'undo.nothing': { text: 'Nothing to undo yet' },
	'undo.nothingToRedo': { text: 'Nothing to redo' },
	'undo.goToLetter': { text: 'Show {letter}' },
};

export default UNDO;
