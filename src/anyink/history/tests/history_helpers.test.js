// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	collectionNameFromID,
	indexOfNextItemEntry,
	indexOfSettingsEntryBetween,
	isNavigationBetween,
	objTypeFromID,
} from '../history_helpers.js';

describe('objTypeFromID / collectionNameFromID', () => {
	it('maps every id prefix', () => {
		expect(objTypeFromID('glyph-0x41')).toBe('Glyph');
		expect(objTypeFromID('liga-f-f')).toBe('Ligature');
		expect(objTypeFromID('comp-0')).toBe('Component');
		expect(objTypeFromID('kern-3')).toBe('KernGroup');
		expect(collectionNameFromID('glyph-0x41')).toBe('glyphs');
		expect(collectionNameFromID('liga-f-f')).toBe('ligatures');
		expect(collectionNameFromID('comp-0')).toBe('components');
		expect(collectionNameFromID('kern-3')).toBe('kerning');
	});

	it('returns false for unknown or missing ids', () => {
		expect(objTypeFromID('nope')).toBe(false);
		expect(objTypeFromID(false)).toBe(false);
		expect(objTypeFromID(undefined)).toBe(false);
		expect(collectionNameFromID('')).toBe(false);
	});
});

describe('indexOfNextItemEntry', () => {
	const queue = [
		{ itemID: 'glyph-0x41' },
		{ settingsSave: true },
		{ settingsSave: true },
		{ itemID: 'glyph-0x41' },
		{ wholeProjectSave: true },
	];

	it('skips settings entries', () => {
		expect(indexOfNextItemEntry(queue, 1)).toBe(3);
		expect(indexOfNextItemEntry(queue, 4)).toBe(4);
	});

	it('returns -1 when only settings entries remain', () => {
		expect(indexOfNextItemEntry([{ itemID: 'a' }, { settingsSave: true }], 1)).toBe(-1);
		expect(indexOfNextItemEntry([], 1)).toBe(-1);
	});
});

describe('indexOfSettingsEntryBetween', () => {
	it('finds the newest settings entry strictly between two positions', () => {
		const queue = [{}, { settingsSave: true }, { settingsSave: true }, { wholeProjectSave: true }];
		expect(indexOfSettingsEntryBetween(queue, 0, 3)).toBe(1);
		expect(indexOfSettingsEntryBetween(queue, 1, 3)).toBe(2);
		expect(indexOfSettingsEntryBetween(queue, 2, 3)).toBe(-1);
		expect(indexOfSettingsEntryBetween(queue, 0, 1)).toBe(-1);
	});
});

describe('isNavigationBetween', () => {
	it('is true only for two known, different items', () => {
		expect(isNavigationBetween({ itemID: 'glyph-0x41' }, { itemID: 'glyph-0x42' })).toBe(true);
		expect(isNavigationBetween({ itemID: 'glyph-0x41' }, { itemID: 'glyph-0x41' })).toBe(false);
	});

	it('never treats settings or unknown-item entries as navigation', () => {
		expect(isNavigationBetween({ settingsSave: true, itemID: 'a' }, { itemID: 'b' })).toBe(false);
		expect(isNavigationBetween({ itemID: 'a' }, { settingsSave: true, itemID: 'b' })).toBe(false);
		expect(isNavigationBetween({ itemID: false }, { itemID: 'b' })).toBe(false);
		expect(isNavigationBetween({ itemID: 'a' }, { itemID: false })).toBe(false);
		expect(isNavigationBetween({ itemID: 'a' }, false)).toBe(false);
	});
});
