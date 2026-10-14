// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { Guide } from '../../../project_editor/guide.js';
import {
	SYSTEM_GUIDE_NAMES,
	applySettingsSnapshot,
	findPreviousSettingsSnapshot,
	makeSettingsSnapshot,
	snapshotGuide,
	systemGuidesFromList,
} from '../settings_snapshot.js';

function makeSettings() {
	return {
		font: { upm: 1000, ascent: 800, descent: -200, xHeight: 500, capHeight: 700, family: 'Test' },
		app: {
			autoSave: true,
			guides: {
				systemShowGuides: true,
				systemGuides: ['baseline', 'leftSide'],
				customShowGuides: true,
				custom: [new Guide({ name: 'Overshoot', location: 520, angle: 90, visible: true })],
				gridDivisions: 10,
			},
		},
	};
}

describe('snapshotGuide', () => {
	it('keeps every field, including visible: true that Guide.save() drops', () => {
		const guide = new Guide({ name: 'Overshoot', location: 520, visible: true });
		expect(guide.save().visible).toBeUndefined();
		expect(snapshotGuide(guide)).toEqual({
			name: 'Overshoot',
			angle: 90,
			location: 520,
			color: '',
			visible: true,
		});
	});

	it('fills defaults for a bare object', () => {
		expect(snapshotGuide({})).toEqual({
			name: undefined,
			angle: 90,
			location: 200,
			color: '',
			visible: false,
		});
	});
});

describe('makeSettingsSnapshot', () => {
	it('copies font and guides without sharing references', () => {
		const settings = makeSettings();
		const snap = makeSettingsSnapshot(settings);
		expect(snap.font).toEqual(settings.font);
		expect(snap.font).not.toBe(settings.font);
		expect(snap.guides.systemGuides).toEqual(['baseline', 'leftSide']);
		expect(snap.guides.systemGuides).not.toBe(settings.app.guides.systemGuides);
		expect(snap.guides.custom).toEqual([
			{ name: 'Overshoot', angle: 90, location: 520, color: '', visible: true },
		]);
		settings.font.xHeight = 999;
		expect(snap.font.xHeight).toBe(500);
	});

	it('is plain data (survives JSON)', () => {
		const snap = makeSettingsSnapshot(makeSettings());
		expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
	});

	it('returns false for missing settings', () => {
		expect(makeSettingsSnapshot(undefined)).toBe(false);
		expect(makeSettingsSnapshot({ font: {} })).toBe(false);
	});
});

describe('applySettingsSnapshot', () => {
	it('merges in place so existing references stay valid', () => {
		const settings = makeSettings();
		const fontRef = settings.font;
		const guidesRef = settings.app.guides;
		const customRef = settings.app.guides.custom;
		const snap = makeSettingsSnapshot(settings);

		settings.font.xHeight = 640;
		settings.app.guides.systemGuides = ['baseline'];
		settings.app.guides.custom.push(new Guide({ location: 10 }));

		applySettingsSnapshot(settings, snap);

		expect(settings.font).toBe(fontRef);
		expect(settings.app.guides).toBe(guidesRef);
		expect(settings.app.guides.custom).toBe(customRef);
		expect(settings.font.xHeight).toBe(500);
		expect(settings.app.guides.systemGuides).toEqual(['baseline', 'leftSide']);
		expect(settings.app.guides.custom.length).toBe(1);
		expect(settings.app.guides.custom[0]).toBeInstanceOf(Guide);
		expect(settings.app.guides.custom[0].location).toBe(520);
		expect(settings.app.guides.custom[0].visible).toBe(true);
	});

	it('leaves settings alone for a false snapshot', () => {
		const settings = makeSettings();
		settings.font.xHeight = 640;
		applySettingsSnapshot(settings, false);
		expect(settings.font.xHeight).toBe(640);
	});

	it('does not touch unrelated settings', () => {
		const settings = makeSettings();
		const snap = makeSettingsSnapshot(settings);
		settings.app.autoSave = false;
		applySettingsSnapshot(settings, snap);
		expect(settings.app.autoSave).toBe(false);
	});
});

describe('systemGuidesFromList', () => {
	it('maps the shown list to booleans for every system guide', () => {
		const result = systemGuidesFromList(['baseline', 'xHeight']);
		expect(Object.keys(result)).toEqual(SYSTEM_GUIDE_NAMES);
		expect(result.baseline).toBe(true);
		expect(result.xHeight).toBe(true);
		expect(result.ascent).toBe(false);
		expect(result.rightSide).toBe(false);
	});

	it('treats a missing list as nothing shown', () => {
		expect(Object.values(systemGuidesFromList(undefined)).every((v) => v === false)).toBe(true);
	});
});

describe('findPreviousSettingsSnapshot', () => {
	const initialProject = { settings: makeSettings() };

	it('returns the nearest older settings entry', () => {
		const older = { font: { xHeight: 111 }, guides: { custom: [] } };
		const oldest = { font: { xHeight: 222 }, guides: { custom: [] } };
		const queue = [
			{ settingsSave: true, settingsState: { font: { xHeight: 333 }, guides: {} } },
			{ itemID: 'glyph-0x41', itemState: {} },
			{ settingsSave: true, settingsState: older },
			{ settingsSave: true, settingsState: oldest },
		];
		expect(findPreviousSettingsSnapshot(queue, 1, initialProject)).toBe(older);
	});

	it('reads settings out of a whole-project entry', () => {
		const projectSettings = makeSettings();
		projectSettings.font.xHeight = 444;
		const queue = [
			{ settingsSave: true, settingsState: {} },
			{ wholeProjectSave: true, itemState: { settings: projectSettings } },
		];
		const snap = findPreviousSettingsSnapshot(queue, 1, initialProject);
		expect(snap.font.xHeight).toBe(444);
	});

	it('falls back to the initial project', () => {
		const queue = [{ settingsSave: true, settingsState: {} }, { itemID: 'glyph-0x41' }];
		const snap = findPreviousSettingsSnapshot(queue, 1, initialProject);
		expect(snap.font.xHeight).toBe(500);
		expect(findPreviousSettingsSnapshot([], 1, {})).toBe(false);
	});
});

// --------------------------------------------------------------
// B2: settings steps also cover settings.anyink and the project name
// --------------------------------------------------------------

function makeFullSettings() {
	const settings = makeSettings();
	settings.project = { name: 'Brennan Hand', id: 'g2_TEST' };
	settings.anyink = { formatVersion: 1, letterSet: 'quick', sheet: { pages: [] } };
	return settings;
}

describe('B2: settings.anyink and the project name', () => {
	it('a snapshot copies settings.anyink and the project name', () => {
		const settings = makeFullSettings();
		const snap = makeSettingsSnapshot(settings);
		expect(snap.anyink).toEqual(settings.anyink);
		expect(snap.anyink).not.toBe(settings.anyink);
		expect(snap.anyink.sheet).not.toBe(settings.anyink.sheet);
		expect(snap.projectName).toBe('Brennan Hand');
		expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
	});

	it('applying puts them back in place (the settings.anyink object survives)', () => {
		const settings = makeFullSettings();
		const anyinkRef = settings.anyink;
		const snap = makeSettingsSnapshot(settings);
		settings.anyink.letterSet = 'quick+numbers';
		settings.anyink.photos = { img1: { scale: 2 } };
		settings.project.name = 'Other Hand';
		applySettingsSnapshot(settings, snap);
		expect(settings.anyink).toBe(anyinkRef);
		expect(settings.anyink.letterSet).toBe('quick');
		expect('photos' in settings.anyink).toBe(false);
		expect(settings.project.name).toBe('Brennan Hand');
	});

	it('with changedFrom, only what that step changed goes back', () => {
		const settings = makeFullSettings();
		const before = makeSettingsSnapshot(settings);
		settings.anyink.letterSet = 'quick+numbers';
		const after = makeSettingsSnapshot(settings);
		// written later by a step that does not capture settings (no settings snapshot of its own)
		settings.anyink.photos = { img1: { scale: 2 } };
		settings.project.name = 'Renamed Elsewhere';
		applySettingsSnapshot(settings, before, { changedFrom: after });
		expect(settings.anyink.letterSet).toBe('quick');
		expect(settings.anyink.photos).toEqual({ img1: { scale: 2 } });
		expect(settings.project.name).toBe('Renamed Elsewhere');
	});

	it('a key the older state did not have is removed again', () => {
		const settings = makeFullSettings();
		delete settings.anyink.letterSet;
		const before = makeSettingsSnapshot(settings);
		settings.anyink.letterSet = 'quick+numbers';
		const after = makeSettingsSnapshot(settings);
		applySettingsSnapshot(settings, before, { changedFrom: after });
		expect('letterSet' in settings.anyink).toBe(false);
	});

	it('an older snapshot without them (before B2) leaves them alone', () => {
		const settings = makeFullSettings();
		const old = makeSettingsSnapshot(settings);
		delete old.anyink;
		delete old.projectName;
		settings.anyink.letterSet = 'quick+numbers';
		settings.project.name = 'New Name';
		applySettingsSnapshot(settings, old);
		expect(settings.anyink.letterSet).toBe('quick+numbers');
		expect(settings.project.name).toBe('New Name');
	});

	it('settings without an anyink block or a project still snapshot', () => {
		const snap = makeSettingsSnapshot(makeSettings());
		expect(snap.anyink).toBeUndefined();
		expect(snap.projectName).toBeUndefined();
	});
});
