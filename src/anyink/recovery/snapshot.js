// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK recovery snapshot helpers (Milestone 6, D-012).
	Pure functions shared by recovery.js and recovery_ui.js: the session record
	shape, its store key, and the "n minutes ago" wording. Nothing here touches
	storage, the DOM, or the app.

	Session record (one per live editor session, in the 'recovery' store under
	sessionKey(projectId, sessionId) = 'session:<projectId>:<sessionId>'):
	  { id, key, sessionId, lock, name, time, dirty, hasFile, fileHandle, project, assets, history }
	  - id:         the project id (two copies of one font share it; the key tells them apart)
	  - lock:       the Web Lock name the live session holds (session_lock.sessionLockName)
	  - fileHandle: the FileSystemFileHandle of the open .gs2 (structured-cloneable) or null
	  - project:    editor.project.save()                   (payload)
	  - assets:     editor.assets.toBlobMap()               (payload)
	  - history:    editor.history.serializeForStorage()    (payload: the undo queue that
	                describes exactly this project, adopted on restore)
	Older builds wrote one record per project under 'session:<projectId>' without key,
	lock or history; those stay listable and restorable.
*/

export const SESSION_PREFIX = 'session:';

/**
 * @param {String} projectId
 * @param {String} [sessionId] - omitted: the older per-project key
 * @returns {String} store key
 */
export function sessionKey(projectId, sessionId) {
	return sessionId ? `${SESSION_PREFIX}${projectId}:${sessionId}` : SESSION_PREFIX + projectId;
}

/** @param {String} key @returns {Boolean} */
export function isSessionKey(key) {
	return typeof key === 'string' && key.startsWith(SESSION_PREFIX);
}

/**
 * The editor's project without side effects. ProjectEditor's `project` getter
 * builds a default project on first read, which must never happen from a
 * background snapshot, so a real editor is read through its `_project` field.
 * Plain objects (tests, test pages) expose `project` as an own property.
 * @param {Object} editor
 * @returns {Object | null} GlyphrStudioProject or null when nothing is loaded
 */
export function peekProject(editor) {
	if (!editor) return null;
	if (Object.getOwnPropertyDescriptor(editor, 'project')) return editor.project || null;
	if ('_project' in editor) return editor._project || null;
	return null;
}

/**
 * Builds the record written to the 'recovery' store.
 * @param {Object} editor - ProjectEditor (or a stand-in with project / assets / loadedFileHandle)
 * @param {Object} options
 * @param {Boolean} options.dirty
 * @param {Number} options.time - epoch ms
 * @param {Boolean} [options.includeProject=true] - false: no payload
 * @param {String} [options.key] - store key of the session
 * @param {String} [options.sessionId]
 * @param {String} [options.lock] - Web Lock name the session holds
 * @returns {Object | null} null when the editor has no project
 */
export function makeSessionRecord(
	editor,
	{ dirty, time, includeProject = true, key, sessionId, lock }
) {
	const project = peekProject(editor);
	const meta = project?.settings?.project;
	if (!meta?.id) return null;
	const handle = editor.loadedFileHandle || null;
	const record = {
		id: meta.id,
		...(key ? { key } : {}),
		...(sessionId ? { sessionId } : {}),
		...(lock ? { lock } : {}),
		name: meta.name || 'Untitled',
		time,
		dirty: !!dirty,
		hasFile: !!handle,
		fileHandle: handle,
	};
	if (includeProject) {
		record.project = project.save();
		record.assets = typeof editor.assets?.toBlobMap === 'function' ? editor.assets.toBlobMap() : {};
		record.history =
			typeof editor.history?.serializeForStorage === 'function'
				? editor.history.serializeForStorage()
				: null;
	}
	return record;
}

/**
 * The list-row view of a record (no payload). Rows are keyed by the store key, so
 * two snapshots of one project are two rows.
 * @param {Object} record
 * @param {String} [key] - its store key; default: record.key, else the older per-project key
 * @returns {{id: String, projectId: String, name: String, time: Number, dirty: Boolean, hasFile: Boolean}}
 */
export function describeSession(record, key) {
	return {
		id: key || record.key || sessionKey(record.id),
		projectId: record.id,
		name: record.name || 'Untitled',
		time: record.time || 0,
		dirty: record.dirty === true,
		hasFile: !!record.hasFile,
	};
}

/**
 * @param {Number} time - epoch ms
 * @param {Number} now - epoch ms
 * @returns {Number} whole minutes, never negative
 */
export function minutesAgo(time, now = Date.now()) {
	return Math.max(0, Math.floor((now - time) / 60000));
}

/**
 * Human wording for the toast and the card rows.
 * @param {Number} time - epoch ms
 * @param {Number} now - epoch ms
 * @returns {String} 'less than a minute ago' | 'n minutes ago' | 'n hours ago' | 'n days ago'
 */
export function formatAgo(time, now = Date.now()) {
	const minutes = minutesAgo(time, now);
	if (minutes < 1) return 'less than a minute ago';
	if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours} hours ago`;
	return `${Math.floor(hours / 24)} days ago`;
}
