// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 integration (UX-BEGINNER.md 6.2 Strip: "Hidden in Simple: Real font, Metrics"): the
// strip's two toggles carry their visibility.js ids and hide in Simple; what a hidden toggle
// turns on is off while it is hidden (the pref is kept for All tools), so Simple never shows a
// real-font sheet or guide lines it has no switch for. The strip follows 'anyink-mode-change'.
// All tools shows both toggles and honors both prefs, as before.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { HIDDEN_ATTRIBUTE } from '../../mode/hide.js';
import { setMode, setModeForTests } from '../../mode/mode.js';
import { getPref, resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { PREF_KEYS, PreviewStrip } from '../preview_strip.js';

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setPref(PREF_KEYS.realFont, true);
	setPref(PREF_KEYS.metrics, true);
});
afterEach(() => {
	setModeForTests('all');
	document.body.innerHTML = '';
});

function makeStrip() {
	const strip = new PreviewStrip();
	strip.build();
	document.body.appendChild(strip);
	return strip;
}

const toggle = (strip, id) => strip.querySelector(`[data-anyink-strip="${id}"]`);
const hidden = (element) => element.hidden && element.hasAttribute(HIDDEN_ATTRIBUTE);

describe('the strip toggles carry their ids', () => {
	it('Real font and Guide lines, each with a class of its own', () => {
		const strip = makeStrip();
		expect(toggle(strip, 'realFont').classList).toContain('preview-strip__toggle--real-font');
		expect(toggle(strip, 'guideLines').classList).toContain('preview-strip__toggle--guide-lines');
		expect(toggle(strip, 'realFont')).toBe(strip.realFontToggle.label);
		expect(toggle(strip, 'guideLines')).toBe(strip.metricsToggle.label);
	});
});

describe('All tools: as before', () => {
	it('both toggles show, and both prefs are on', () => {
		const strip = makeStrip();
		expect(hidden(toggle(strip, 'realFont'))).toBe(false);
		expect(hidden(toggle(strip, 'guideLines'))).toBe(false);
		expect(strip.realFontOn).toBe(true);
		expect(strip.metricsOn).toBe(true);
	});
});

describe('Simple: no Real font, no guide lines (6.2 Strip)', () => {
	it('hides both toggles and draws the canvas sheet with no guide lines', () => {
		setModeForTests('simple');
		const strip = makeStrip();
		expect(hidden(toggle(strip, 'realFont'))).toBe(true);
		expect(hidden(toggle(strip, 'guideLines'))).toBe(true);
		expect(strip.realFontOn).toBe(false);
		expect(strip.metricsOn).toBe(false);
		const renderer = strip.ensureRenderer();
		expect(renderer).toBeInstanceOf(DisplayCanvas);
		expect(renderer.showMetricLines).toBe(false);
		// the prefs are kept for All tools
		expect(getPref(PREF_KEYS.realFont)).toBe(true);
		expect(getPref(PREF_KEYS.metrics)).toBe(true);
	});

	it('follows a mode change: back in All tools both toggles show again', () => {
		setModeForTests('simple');
		const strip = makeStrip();
		setMode('all');
		expect(hidden(toggle(strip, 'realFont'))).toBe(false);
		expect(hidden(toggle(strip, 'guideLines'))).toBe(false);
		expect(strip.realFontOn).toBe(true);
		setMode('simple');
		expect(hidden(toggle(strip, 'realFont'))).toBe(true);
		expect(strip.metricsOn).toBe(false);
	});
});
