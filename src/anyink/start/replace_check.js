// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: the replace check (UX-BEGINNER.md 4.1, 7.4 #5). Create my font's save picker gave a file;
	before anything is written there, is it one of his fonts?
	  - one of his recent fonts (the same file on disk), letters or not, or
	  - an existing work file with letters in it
	Then nothing is written yet and the start screen asks "That replaces your font "<name>" (12
	letters). [Use a new name] [Replace it]". A new file, an empty file, or a work file with no
	letters that isn't a recent font is written at once.
	Fix pass (7.4 #5: a backup copy of the old file is always kept): a file with something in it
	that isn't a work file ANY-INK can read (not JSON, or JSON that isn't a font) has no backup copy
	to keep, so it is never written over: it comes back unreadable and the box offers only Use a
	new name.

	  checkReplace(handle, { recents })   Promise<null | { name, letters, content, unreadable }>
	      content: the old file's data (null when it is empty), for the backup copy
	      unreadable: the file holds something that isn't a work file
*/
import { readFileText } from '../files/read_project.js';
import { sameFile } from './card_facts.js';
import { countLetters } from './start_state.js';

/**
 * @param {*} data - parsed JSON
 * @returns {Boolean} true when it looks like a work file (a Glyphr Studio 2 or 1 project)
 */
function isWorkFile(data) {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
	// Glyphr Studio 2: settings.project names the font (the same test the file reader makes:
	// files/read_project.js); a settings object alone (some other program's file) is not a font
	const project = data.settings?.project;
	if (project && typeof project === 'object') {
		const said = [project.latestVersion, project.id, project.name];
		if (said.some((value) => typeof value === 'string' && value)) return true;
	}
	// Glyphr Studio 1
	const old = data.projectsettings;
	return !!old && typeof old === 'object' && !!old.versionnum;
}

/**
 * @param {Object} handle - what the picker gave
 * @returns {Promise<{content: Object | null, unreadable: Boolean}>} the file's data (null when
 *   it is new or empty); unreadable when it holds something that isn't a work file
 */
async function readContent(handle) {
	let file = null;
	try {
		file = await handle.getFile();
	} catch {
		return { content: null, unreadable: false }; // nothing there yet
	}
	if (!file || !file.size) return { content: null, unreadable: false };
	try {
		const text = await readFileText(file);
		if (!text || !text.trim()) return { content: null, unreadable: false };
		const parsed = JSON.parse(text);
		return isWorkFile(parsed)
			? { content: parsed, unreadable: false }
			: { content: null, unreadable: true };
	} catch {
		return { content: null, unreadable: true };
	}
}

/**
 * @param {Object} handle - FileSystemFileHandle from showSaveFilePicker
 * @param {Object} [options]
 * @param {Array<{handle: Object, name: String}>} [options.recents]
 * @returns {Promise<{name: String, letters: Number, content: Object | null,
 *   unreadable: Boolean} | null>}
 */
export async function checkReplace(handle, { recents = [] } = {}) {
	if (!handle) return null;
	let recent = null;
	for (const entry of recents || []) {
		if (await sameFile(entry?.handle, handle)) {
			recent = entry;
			break;
		}
	}
	const { content, unreadable } = await readContent(handle);
	const letters = countLetters(content);
	if (!recent && !unreadable && letters === 0) return null;
	const name =
		content?.settings?.project?.name ||
		recent?.name ||
		String(handle.name || '').replace(/\.[^.]*$/, '') ||
		'Untitled';
	return { name, letters, content, unreadable };
}
