// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK file command runner (Milestone 6, D-012).
	Owner: FILES track.

	The File menu rows and the Ctrl+S / Ctrl+E shortcuts start async work (Save,
	Save As, Export, Choose export folder) from a click or keydown and do not wait
	for it. runFileCommand calls the command in the same tick, so pickers and
	permission prompts keep the gesture's transient activation, and turns any
	failure into the error box instead of an unhandled promise rejection.

	  runFileCommand(command, ...args)  -> Promise: the command's result, or false
	                                       after showing the failure with showError
*/

import { showError } from '../../controls/dialogs/dialogs.js';

/**
 * @param {Function} command - (...args) => any | Promise<any>
 * @param {...*} args - passed to the command
 * @returns {Promise<*>} the command's result, or false when it failed (shown to the user)
 */
export function runFileCommand(command, ...args) {
	try {
		return Promise.resolve(command(...args)).catch(showFailure);
	} catch (error) {
		return Promise.resolve(showFailure(error));
	}
}

function showFailure(error) {
	console.warn('ANY-INK file command failed', error);
	showError(`
		That did not finish.
		<hr>
		${escapeHTML(error?.message || String(error))}
	`);
	return false;
}

function escapeHTML(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
