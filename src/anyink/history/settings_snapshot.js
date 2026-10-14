// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Settings snapshots for the 'settings' history entry kind (D-008, D-018).
	A snapshot is a plain, serializable copy of the two settings blocks that
	metric and guide drags touch: project.settings.font and
	project.settings.app.guides. Applying a snapshot merges it back in place,
	so anything holding a reference to those objects keeps working.

	B2 (UX-BEGINNER 7.3): a snapshot also holds settings.anyink (the letter set, photos, letter
	spacing, ...) and the project name, so font details and the letter-set toggle undo as settings
	steps. Undo and redo hand the snapshot they leave as changedFrom: settings.anyink keys and the
	name then change only where that one step changed them, so a key written later by a step
	that keeps no settings copy (an item step) is never taken back by an older settings step.
**/

import { clone } from '../../common/functions.js';
import { Guide } from '../../project_editor/guide.js';

/** Names of the system guides, in the order editor.systemGuides lists them */
export const SYSTEM_GUIDE_NAMES = [
	'ascent',
	'capHeight',
	'xHeight',
	'baseline',
	'descent',
	'leftSide',
	'rightSide',
];

/**
 * Copies one custom guide into a plain object with every field spelled out.
 * Guide.save() drops default values (and `visible: true`), which the Guide
 * constructor then reads back as `false`, so a lossless copy is needed here.
 * @param {Object} guide - Guide instance or plain guide object
 * @returns {Object}
 */
export function snapshotGuide(guide = {}) {
	return {
		name: guide.name,
		angle: guide.angle === 0 ? 0 : 90,
		location: Number.isFinite(guide.location) ? guide.location : 200,
		color: guide.color || '',
		visible: !!guide.visible,
	};
}

/**
 * Takes a serializable copy of the settings a settings step can change.
 * @param {Object} settings - project.settings
 * @returns {Object | false} { font, guides, anyink?, projectName? } or false when settings are
 *   missing (anyink and projectName only when the settings have them)
 */
export function makeSettingsSnapshot(settings) {
	if (!settings || !settings.font || !settings.app || !settings.app.guides) return false;
	const guides = settings.app.guides;
	const guidesCopy = {};
	Object.keys(guides).forEach((key) => {
		if (key !== 'custom') guidesCopy[key] = clone(guides[key]);
	});
	guidesCopy.custom = Array.isArray(guides.custom) ? guides.custom.map(snapshotGuide) : [];
	const snapshot = { font: clone(settings.font), guides: guidesCopy };
	if (isPlainObject(settings.anyink)) snapshot.anyink = clone(settings.anyink);
	if (typeof settings.project?.name === 'string') snapshot.projectName = settings.project.name;
	return snapshot;
}

/**
 * Writes a snapshot back into live settings, merging in place: the
 * settings.font, settings.app.guides, guides.custom and settings.anyink
 * references all survive, only their contents change.
 * @param {Object} settings - project.settings (mutated)
 * @param {Object} snapshot - from makeSettingsSnapshot
 * @param {Object} [options]
 * @param {Object | false} [options.changedFrom] - the snapshot an undo or redo leaves: then
 *   settings.anyink keys and the project name are written only where the two differ
 * @returns {Object} the same settings object
 */
export function applySettingsSnapshot(settings, snapshot, { changedFrom = false } = {}) {
	if (!settings || !snapshot) return settings;
	applyAnyinkBlock(settings, snapshot, changedFrom || false);
	applyProjectName(settings, snapshot, changedFrom || false);

	if (snapshot.font && settings.font) {
		Object.assign(settings.font, clone(snapshot.font));
	}

	if (snapshot.guides && settings.app) {
		if (!settings.app.guides) settings.app.guides = {};
		const guides = settings.app.guides;
		Object.keys(snapshot.guides).forEach((key) => {
			if (key !== 'custom') guides[key] = clone(snapshot.guides[key]);
		});
		if (Array.isArray(snapshot.guides.custom)) {
			if (!Array.isArray(guides.custom)) guides.custom = [];
			guides.custom.length = 0;
			snapshot.guides.custom.forEach((guide) => guides.custom.push(new Guide(guide)));
		}
	}

	return settings;
}

/**
 * B2: puts settings.anyink back, in place. A snapshot from before B2 has no copy of it and
 * leaves it alone.
 * @param {Object} settings - project.settings (mutated)
 * @param {Object} snapshot
 * @param {Object | false} changedFrom - see applySettingsSnapshot
 */
function applyAnyinkBlock(settings, snapshot, changedFrom) {
	const target = snapshot.anyink;
	if (!isPlainObject(target)) return;
	if (!isPlainObject(settings.anyink)) settings.anyink = {};
	const live = settings.anyink;
	const from = isPlainObject(changedFrom?.anyink) ? changedFrom.anyink : null;
	const keys = new Set([...Object.keys(target), ...Object.keys(from || live)]);
	keys.forEach((key) => {
		if (from && sameData(target[key], from[key])) return;
		if (Object.hasOwn(target, key)) live[key] = clone(target[key]);
		else delete live[key];
	});
}

/**
 * B2: puts the project name back (Font name writes it together with the font family).
 * @param {Object} settings - project.settings (mutated)
 * @param {Object} snapshot
 * @param {Object | false} changedFrom - see applySettingsSnapshot
 */
function applyProjectName(settings, snapshot, changedFrom) {
	if (typeof snapshot.projectName !== 'string' || !settings.project) return;
	if (
		typeof changedFrom?.projectName === 'string' &&
		changedFrom.projectName === snapshot.projectName
	) {
		return;
	}
	settings.project.name = snapshot.projectName;
}

/** @returns {Boolean} true for a plain data object (not an array, not null) */
function isPlainObject(value) {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** @returns {Boolean} true when two pieces of plain settings data hold the same thing */
function sameData(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Turns the project's list of shown system guides into the boolean map the
 * editor keeps (editor.systemGuides).
 * @param {Array} list - settings.app.guides.systemGuides
 * @returns {Object} { ascent: Boolean, capHeight: Boolean, ... }
 */
export function systemGuidesFromList(list) {
	const shown = Array.isArray(list) ? list : [];
	const result = {};
	SYSTEM_GUIDE_NAMES.forEach((name) => {
		result[name] = shown.includes(name);
	});
	return result;
}

/**
 * Walks the undo queue (newest first) from `fromIndex` looking for the most
 * recent thing that knows what the settings were: a settings entry, or a
 * whole-project entry (whose project carries its own settings). Falls back
 * to the initial project.
 * @param {Array} queue - History.queue
 * @param {Number} fromIndex - first index to look at (1 skips the entry being undone)
 * @param {Object} initialProject - History.initialProject
 * @returns {Object | false} snapshot, or false when nothing is known
 */
export function findPreviousSettingsSnapshot(queue = [], fromIndex = 1, initialProject = false) {
	for (let i = fromIndex; i < queue.length; i++) {
		const entry = queue[i];
		if (!entry) continue;
		if (entry.settingsSave && entry.settingsState) return entry.settingsState;
		if (entry.wholeProjectSave && entry.itemState?.settings) {
			return makeSettingsSnapshot(entry.itemState.settings);
		}
	}
	return makeSettingsSnapshot(initialProject?.settings);
}
