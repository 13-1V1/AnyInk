// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 (UX-BEGINNER.md section 10 B9, the B5 notes in D-035): turning 'photo' on opens the photo
// gate, so Simple takes, draws and traces photos; a "before B9" guard can still close it.
import { describe, expect, it } from 'vitest';
import { FEATURES, isFeatureOn, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { photosClosed } from '../photo_gate.js';

describe('the photo gate', () => {
	it("B9 turned 'photo' on: Simple's gate is open, as All tools' always was", () => {
		expect(FEATURES.photo).toBe(true);
		expect(isFeatureOn('photo')).toBe(true);
		setModeForTests('simple');
		expect(photosClosed()).toBe(false);
		setModeForTests('all');
		expect(photosClosed()).toBe(false);
	});

	it('a "before B9" guard (photo off) still sees Simple turn photos away; All tools never does', () => {
		setFeaturesForTests({ photo: false });
		setModeForTests('simple');
		expect(photosClosed()).toBe(true);
		setModeForTests('all');
		expect(photosClosed()).toBe(false);
	});
});
