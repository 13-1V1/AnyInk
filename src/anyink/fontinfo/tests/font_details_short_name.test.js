// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 finalize (the names track's NEEDS 5), written to fail first: a font name too long for
// Word's test fonts gets one quiet line under Font name, naming what Word will call the first
// test font; a name that fits gets none. The line follows his typing; it only shows once Use in
// Word is on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixEditor } from '../../checks/tests/fix_fixtures.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { expectNoBanned, scanState } from '../../words/tests/banned_scan.js';
import { closeFontDetails, openFontDetails } from '../font_details_dialog.js';
import { stopMovingLines } from '../move_lines.js';

const dialog = () => document.querySelector('dialog[data-anyink-dialog="fontDetails"]');
const field = () => dialog().querySelector('[data-anyink-fontinfo-field="fontName"]');
const shortLine = () => dialog().querySelector('[data-anyink-fontinfo-note="shortInWord"]');

beforeEach(() => {
	document.body.innerHTML = '';
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ fontDetails: true, useInWord: true });
	resetToastsForTests();
});
afterEach(() => {
	closeFontDetails();
	stopMovingLines();
	resetToastsForTests();
	resetFeaturesForTests();
	setModeForTests('all');
	vi.restoreAllMocks();
});

const typeName = (text) => {
	field().value = text;
	field().dispatchEvent(new Event('input'));
};

describe('a font name Word will shorten', () => {
	it('a name that fits: no line', () => {
		openFontDetails({ editor: fixEditor({}, { open: 'n' }) });
		typeName('Brennan Hand');
		expect(shortLine().hidden).toBe(true);
	});

	it('a long name: one quiet line with what Word calls the test font', () => {
		openFontDetails({ editor: fixEditor({}, { open: 'n' }) });
		typeName('Brennan Meyer’s Everyday Handwriting');
		expect(shortLine().hidden).toBe(false);
		expect(shortLine().textContent).toContain('Brennan Meyer’s Test 1');
		expectNoBanned(scanState({ root: dialog() }, { strict: true }));
	});

	it('not before Use in Word is on', () => {
		setFeaturesForTests({ useInWord: false });
		openFontDetails({ editor: fixEditor({}, { open: 'n' }) });
		typeName('Brennan Meyer’s Everyday Handwriting');
		expect(shortLine()?.hidden ?? true).toBe(true);
	});
});
