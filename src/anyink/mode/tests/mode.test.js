// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, describe, expect, it } from 'vitest';
import { FEATURES, isFeatureOn } from '../features.js';
import {
	LAUNCH_MODE,
	getMode,
	isSimpleMode,
	modeFromSearch,
	setMode,
	setModeForTests,
} from '../mode.js';

afterEach(() => setModeForTests('all'));

describe('mode', () => {
	it("launches in 'all' (All tools) when the address has no ?ui=simple", () => {
		expect(LAUNCH_MODE).toBe('all');
		expect(getMode()).toBe('all');
		expect(isSimpleMode()).toBe(false);
	});

	it('?ui=simple turns Simple on for that load; anything else stays on All tools', () => {
		expect(modeFromSearch('?ui=simple')).toBe('simple');
		expect(modeFromSearch('?project=x&ui=simple')).toBe('simple');
		expect(modeFromSearch('ui=simple')).toBe('simple');
		expect(modeFromSearch('')).toBe('all');
		expect(modeFromSearch(undefined)).toBe('all');
		expect(modeFromSearch('?ui=all')).toBe('all');
		expect(modeFromSearch('?ui=SIMPLE')).toBe('all');
		expect(modeFromSearch('?ui=simplex')).toBe('all');
	});

	it('set and get', () => {
		expect(setMode('simple')).toBe(true);
		expect(getMode()).toBe('simple');
		expect(isSimpleMode()).toBe(true);
		expect(setMode('all')).toBe(true);
		expect(getMode()).toBe('all');
	});

	it('refuses a mode it does not know and keeps the current one', () => {
		setMode('simple');
		expect(setMode('expert')).toBe(false);
		expect(setMode(undefined)).toBe(false);
		expect(getMode()).toBe('simple');
	});

	it('setModeForTests switches and hands back the mode it replaced', () => {
		expect(setModeForTests('simple')).toBe('all');
		expect(isSimpleMode()).toBe(true);
		expect(setModeForTests()).toBe('simple');
		expect(getMode()).toBe('all');
	});
});

describe('features', () => {
	it('starts with no feature turned on (each later B turns on only its own)', () => {
		expect(Object.keys(FEATURES)).toEqual([]);
		expect(isFeatureOn('board')).toBe(false);
		expect(isFeatureOn('coach')).toBe(false);
	});
});
