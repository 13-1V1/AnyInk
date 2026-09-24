// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Settings snapshots for the 'settings' history entry kind (D-008, D-018).
	A snapshot is a plain, serializable copy of the two settings blocks that
	metric and guide drags touch: project.settings.font and
	project.settings.app.guides. Applying a snapshot merges it back in place,
	so anything holding a reference to those objects keeps working.
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
 * Takes a serializable copy of the settings a metrics / guides drag can change.
 * @param {Object} settings - project.settings
 * @returns {Object | false} { font, guides } or false when settings are missing
 */
export function makeSettingsSnapshot(settings) {
	if (!settings || !settings.font || !settings.app || !settings.app.guides) return false;
	const guides = settings.app.guides;
	const guidesCopy = {};
	Object.keys(guides).forEach((key) => {
		if (key !== 'custom') guidesCopy[key] = clone(guides[key]);
	});
	guidesCopy.custom = Array.isArray(guides.custom) ? guides.custom.map(snapshotGuide) : [];
	return { font: clone(settings.font), guides: guidesCopy };
}

/**
 * Writes a snapshot back into live settings, merging in place: the
 * settings.font, settings.app.guides, and guides.custom references all
 * survive, only their contents change.
 * @param {Object} settings - project.settings (mutated)
 * @param {Object} snapshot - from makeSettingsSnapshot
 * @returns {Object} the same settings object
 */
export function applySettingsSnapshot(settings, snapshot) {
	if (!settings || !snapshot) return settings;

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
