// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import settingsData from '../settings_data.js';

describe('settings_data', () => {
	// Finding 9: the localStorage auto-save wording must not be reachable from any UI path.
	it('has no entries for the removed autoSave, saveLivePreviews and formatSaveFile settings', () => {
		expect(settingsData.app.autoSave).toBeUndefined();
		expect(settingsData.app.saveLivePreviews).toBeUndefined();
		expect(settingsData.app.formatSaveFile).toBeUndefined();
	});

	it('never mentions local storage backups', () => {
		const text = JSON.stringify(settingsData).toLowerCase();
		expect(text).not.toContain('local storage');
		expect(text).not.toContain('localstorage');
	});
});
