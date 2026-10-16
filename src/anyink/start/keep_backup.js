// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13: a backup copy of a work file that is about to be replaced (UX-BEGINNER.md 4.1, 7.4 #5:
	"Replace it first keeps a backup copy of the old file, then writes").

	The copy is a crash-recovery record of its own (the same 'recovery' store and shape
	recovery.js writes, D-026): dirty, with no work file, under a key and a lock name no tab ever
	holds, so it shows at once in the backups list (Other ways to start... > Recover). It is
	marked replaced: true, a kept copy and not a crash, so the start screen's card never offers it
	(start_state.js chooseCard): Continue stays on the font he is making. Restoring it brings the old font
	back exactly, its photos too (the file's base64 images become Blobs here, as a backup keeps
	them). recovery.js keeps at most 3 per font, as for every backup.

	  keepBackupCopy(content, { name, now, write, announce })   Promise<String> the record's key;
	      rejects when the copy could not be written (the caller then writes nothing)
*/
import { AssetStore } from '../assets/asset_store.js';
import { RECOVERY_CHANGE_EVENT } from '../recovery/recovery.js';
import { sessionKey } from '../recovery/snapshot.js';
import { recSet } from '../storage/kv.js';

/**
 * @param {Object} content - the old file's data (parsed .gs2)
 * @param {Object} [options]
 * @param {String} [options.name] - the font's name when the data has none
 * @param {Number} [options.now] - epoch ms
 * @param {(key: String, record: Object) => Promise} [options.write] - default: recSet
 * @param {() => void} [options.announce] - default: RECOVERY_CHANGE_EVENT on window
 * @returns {Promise<String>} the record's key
 */
export async function keepBackupCopy(content, { name, now = Date.now(), write, announce } = {}) {
	if (!content || typeof content !== 'object') throw new TypeError('Nothing to keep.');
	const meta = content.settings?.project || {};
	const projectId = meta.id || `replaced${now}`;
	const sessionId = `replaced-${now}-${Math.random().toString(36).slice(2, 8)}`;
	const key = sessionKey(projectId, sessionId);
	const images = new AssetStore();
	await images.loadSaveObject(content.assets);
	const record = {
		id: projectId,
		key,
		sessionId,
		lock: `anyink-replaced:${sessionId}`,
		name: meta.name || name || 'Untitled',
		time: now,
		dirty: true,
		replaced: true,
		hasFile: false,
		fileHandle: null,
		fileVersion: null,
		project: content,
		assets: images.toBlobMap(),
		history: null,
	};
	await (write || recSet)(key, record);
	(announce || defaultAnnounce)();
	return key;
}

function defaultAnnounce() {
	globalThis.dispatchEvent?.(new Event(RECOVERY_CHANGE_EVENT));
}
