// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK file writer (Milestone 6, D-012).
	Owner: FILES track.

	One place that writes through a FileSystemFileHandle. Exclusive mode makes the
	write atomic against other tabs (Chromium 121+); older builds reject the
	option with a TypeError, so the write is retried without it. Anything else
	(NoModificationAllowedError while another tab holds the lock, NotAllowedError
	when permission lapsed) propagates to the caller, which shows it.
*/

/**
 * @param {*} value
 * @returns {Boolean} true for anything that looks like a FileSystemFileHandle
 */
export function isFileHandle(value) {
	return (
		!!value &&
		typeof value === 'object' &&
		(value.kind === 'file' || typeof value.createWritable === 'function')
	);
}

/**
 * The only files ANY-INK writes a project into: a .gs2 (any case). A Glyphr Studio v1
 * .txt project, a font or anything else is read, never overwritten with .gs2 JSON.
 * @param {*} value
 * @returns {Boolean} true for a file handle whose name ends in .gs2
 */
export function isProjectFileHandle(value) {
	return isFileHandle(value) && typeof value.name === 'string' && /\.gs2$/i.test(value.name);
}

/**
 * @param {*} value
 * @returns {Boolean} true for anything that looks like a FileSystemDirectoryHandle
 */
export function isDirectoryHandle(value) {
	return (
		!!value &&
		typeof value === 'object' &&
		(value.kind === 'directory' || typeof value.getFileHandle === 'function')
	);
}

/**
 * Writes data to a file handle, replacing the file's content.
 * @param {FileSystemFileHandle} handle
 * @param {String | Blob | BufferSource} data
 * @returns {Promise<{exclusive: Boolean}>} whether the exclusive lock was used
 */
export async function writeToHandle(handle, data, beforeWrite) {
	if (!isFileHandle(handle)) throw new TypeError('writeToHandle: not a file handle');
	let writable;
	let exclusive = true;
	try {
		writable = await handle.createWritable({ mode: 'exclusive' });
	} catch (error) {
		// Older Chromium: unknown option value -> TypeError. Retry the plain way.
		if (!(error instanceof TypeError || error?.name === 'TypeError')) throw error;
		exclusive = false;
		writable = await handle.createWritable();
	}
	try {
		await beforeWrite?.();
		await writable.write(data);
		await writable.close();
	} catch (error) {
		try {
			if (typeof writable.abort === 'function') await writable.abort();
		} catch {
			// the original error is the one to report
		}
		throw error;
	}
	return { exclusive };
}
