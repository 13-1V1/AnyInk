// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 fix pass: what the start screen's card needs to know about each backup copy that a
	listRecoverableSessions() row doesn't say (UX-BEGINNER.md 4.1, 7.5: the crash card "appears
	only when one is newer than its file"). Reads the stored record, never writes.

	  sessionFacts(sessions, recents, { readRecord })   Promise<rows>: each row as it came, plus
	      replaced    a Replace it copy (keep_backup.js): kept, not a crash
	      fileHandle  its work file's handle, or null
	      fileTime    the newest of: that file's recent-fonts time (its last open or save here)
	                  and the file's own lastModified when Chrome already lets it be read (no
	                  question asked); null when neither is known (the card can't tell, so a
	                  copy with a work file still shows)
*/

/**
 * @param {Object} a - a file handle
 * @param {Object} b - a file handle
 * @returns {Promise<Boolean>}
 */
export async function sameFile(a, b) {
	if (!a || !b) return false;
	if (a === b) return true;
	try {
		return typeof a.isSameEntry === 'function' ? await a.isSameEntry(b) : false;
	} catch {
		return false;
	}
}

/**
 * @param {Object} handle
 * @returns {Promise<Number | null>} the file's lastModified, only when reading asks nothing
 */
async function modifiedTime(handle) {
	try {
		if (typeof handle?.queryPermission !== 'function' || typeof handle.getFile !== 'function') {
			return null;
		}
		if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') return null;
		const file = await handle.getFile();
		return typeof file?.lastModified === 'number' ? file.lastModified : null;
	} catch {
		return null;
	}
}

/**
 * @param {Object} handle - the work file
 * @param {Array<{handle: Object, time: Number}>} recents
 * @returns {Promise<Number | null>}
 */
async function fileTimeOf(handle, recents) {
	let best = null;
	for (const entry of recents || []) {
		if (typeof entry?.time === 'number' && (await sameFile(entry.handle, handle))) {
			best = Math.max(best ?? entry.time, entry.time);
		}
	}
	const modified = await modifiedTime(handle);
	if (modified !== null) best = Math.max(best ?? modified, modified);
	return best;
}

/**
 * @param {Array<Object>} sessions - listRecoverableSessions() rows
 * @param {Array<Object>} recents - listRecentProjects() rows
 * @param {{readRecord: (id: String) => Promise<Object>}} deps
 * @returns {Promise<Array<Object>>}
 */
export async function sessionFacts(sessions, recents, { readRecord }) {
	const rows = [];
	for (const session of sessions || []) {
		let record = null;
		try {
			record = await readRecord(session.id);
		} catch {
			record = null;
		}
		const fileHandle = record?.fileHandle || null;
		const fileTime = session.hasFile && fileHandle ? await fileTimeOf(fileHandle, recents) : null;
		rows.push({ ...session, replaced: record?.replaced === true, fileHandle, fileTime });
	}
	return rows;
}
