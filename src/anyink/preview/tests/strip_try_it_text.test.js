// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize (UX-BEGINNER.md 4.0 Preview strip: the Try-it text "Starts as the font name";
	verdict: "the strip text is still 'the five boxing wizards jump quickly'" while the Next line's
	letter order reads the font name): in Simple, once the Next line is on ('coach'), the strip's
	text starts as the font's name until he types or picks a sample, the same rule the coach
	reads (coach/font_facts.js defaultTryItText), so the two never disagree. All tools, and Simple
	before B6, keep the sample sentence.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { defaultTryItText } from '../../coach/font_facts.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { noFlags } from '../../mode/tests/no_flags.js';
import { getPref, resetPrefsCache } from '../../prefs/prefs.js';
import { PREF_KEYS, PreviewStrip } from '../preview_strip.js';
import { DEFAULT_SAMPLE_TEXT } from '../sample_presets.js';

beforeAll(() => {
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
});
afterEach(() => {
	setModeForTests('all');
	document.body.innerHTML = '';
});

function stripOn(editor) {
	const strip = new PreviewStrip();
	strip.build();
	document.body.appendChild(strip);
	strip.attachEditor(editor);
	return strip;
}

describe('Simple with the Next line on: the Try-it text starts as the font name', () => {
	it('no text typed yet: the strip says the font name, and the coach reads the same', () => {
		setModeForTests('simple');
		setFeaturesForTests({ coach: true });
		const editor = twoLetterEditor();
		const strip = stripOn(editor);
		expect(strip.textInput.value).toBe('Two Letters');
		expect(strip.textInput.value).toBe(defaultTryItText(editor.project));
		// not written to the prefs: it is no text he typed
		expect(getPref(PREF_KEYS.text, null)).toBe(null);
	});

	it('what he types stays his, for this font and the next', () => {
		setModeForTests('simple');
		setFeaturesForTests({ coach: true });
		const strip = stripOn(twoLetterEditor());
		strip.setText('Brennan');
		strip.attachEditor(twoLetterEditor());
		expect(strip.textInput.value).toBe('Brennan');
	});
});

describe('as before elsewhere', () => {
	it('All tools: the sample sentence', () => {
		setModeForTests('all');
		const strip = stripOn(twoLetterEditor());
		expect(strip.textInput.value).toBe(DEFAULT_SAMPLE_TEXT);
	});

	it('Simple before B6 (no flags): the sample sentence', () => {
		setModeForTests('simple');
		noFlags();
		const strip = stripOn(twoLetterEditor());
		expect(strip.textInput.value).toBe(DEFAULT_SAMPLE_TEXT);
	});
});
