// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK file API seam (Milestone 6, D-012).
	Owner: FILES track.

	The three File System Access pickers and the download fallback are reached
	through getFileApi() so unit tests (jsdom has none of them) can inject fakes
	with setFileApi(). Production code never calls window.show*Picker directly.

	  getFileApi()        { showOpenFilePicker, showSaveFilePicker, showDirectoryPicker, download }
	                      Picker fields are undefined when the browser lacks them.
	                      download is undefined by default: callers fall back to
	                      upstream's saveFile (project_editor/file_io.js).
	  setFileApi(impl)    tests only: replaces the whole object until resetFileApi().
	  resetFileApi()      back to the real browser globals.
	  hasFileSystemAccess()  true when open + save pickers are functions.
	  hasDirectoryPicker()   true when showDirectoryPicker is a function.
	  isAbortError(e)     the user closed a picker (not an error worth showing).
*/

let override = null;

/**
 * @returns {Object} the picker functions in use (real or injected)
 */
export function getFileApi() {
	if (override) return override;
	const g = globalThis;
	return {
		showOpenFilePicker:
			typeof g.showOpenFilePicker === 'function' ? g.showOpenFilePicker.bind(g) : undefined,
		showSaveFilePicker:
			typeof g.showSaveFilePicker === 'function' ? g.showSaveFilePicker.bind(g) : undefined,
		showDirectoryPicker:
			typeof g.showDirectoryPicker === 'function' ? g.showDirectoryPicker.bind(g) : undefined,
		download: undefined,
	};
}

/**
 * Tests only. Pass an object with any of showOpenFilePicker, showSaveFilePicker,
 * showDirectoryPicker, download; a missing picker reads as "browser lacks it".
 * @param {Object | null} impl
 */
export function setFileApi(impl) {
	override = impl || null;
}

/** Back to the real browser globals. */
export function resetFileApi() {
	override = null;
}

/**
 * @returns {Boolean} true in Chromium browsers with the File System Access API
 */
export function hasFileSystemAccess() {
	const api = getFileApi();
	return (
		typeof api.showOpenFilePicker === 'function' && typeof api.showSaveFilePicker === 'function'
	);
}

/**
 * @returns {Boolean} true when a directory picker exists (Chromium desktop)
 */
export function hasDirectoryPicker() {
	return typeof getFileApi().showDirectoryPicker === 'function';
}

/**
 * @param {*} error
 * @returns {Boolean} true when the user dismissed a picker
 */
export function isAbortError(error) {
	return !!error && error.name === 'AbortError';
}
