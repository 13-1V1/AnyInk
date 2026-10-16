// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12 + B13 integration (UX-BEGINNER.md 4.6): Try it on the real strip, with the flags as the app
	has them: the gap-fix pieces (the purple handle, Move all letters closer or further apart,
	Gaps you fixed, the Word note) are in Try it's slots once the strip is on the page, the Next
	line's [Try it] from the board's Letter spacing... opens the letter spacing section, and the
	letter spacing topic redraws the strip. Written to fail first: nothing installed the pieces
	(expand.js install() did not call them) and 'letterSpacing' was not a strip topic.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { runCoachAction } from '../../coach/actions.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { isFeatureOn, resetFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { PreviewStrip } from '../../preview/preview_strip.js';
import { FONT_REBUILD_TOPICS, REDRAW_TOPICS } from '../../preview/subscriptions.js';
import { TRY_IT_EVENT } from '../../topbar/doors.js';
import { closeTryIt, getTryItSlot, isTryItOpen } from '../expand.js';

beforeAll(() => {
	if (!customElements.get('preview-strip')) customElements.define('preview-strip', PreviewStrip);
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setModeForTests('simple');
	resetFeaturesForTests(); // the flags as the app has them
});
afterEach(() => {
	closeTryIt();
	setModeForTests('all');
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

function stripOn(editor = twoLetterEditor()) {
	const strip = /** @type {PreviewStrip} */ (document.createElement('preview-strip'));
	document.body.appendChild(strip);
	strip.attachEditor(editor);
	return { strip, editor };
}

describe('Try it with the flags as the app has them', () => {
	it("B12 has landed: 'tryIt' is on", () => {
		expect(isFeatureOn('tryIt')).toBe(true);
	});

	it("the gap-fix pieces sit in Try it's slots", () => {
		stripOn();
		window.dispatchEvent(new CustomEvent(TRY_IT_EVENT, { detail: { cause: 'rail' } }));
		expect(isTryItOpen()).toBe(true);
		expect(getTryItSlot('spacing').querySelector('.anyink-tryit-spacing')).not.toBeNull();
		expect(getTryItSlot('gaps').querySelector('.anyink-gap-list')).not.toBeNull();
		// the handle is drawn only while Try it is open, over the letters
		expect(getTryItSlot('sheet').querySelector('.anyink-gap-handle')).not.toBeNull();
	});

	it("the Next line's [Try it] from Letter spacing... opens that section", () => {
		stripOn();
		runCoachAction('tryIt', { open: 'letterSpacing' });
		expect(isTryItOpen()).toBe(true);
		expect(getTryItSlot('spacing').querySelector('.anyink-tryit-spacing').open).toBe(true);
	});

	it('the strip leaving the page takes the pieces with it', () => {
		const { strip } = stripOn();
		const slot = getTryItSlot('spacing');
		strip.remove();
		expect(slot.querySelector('.anyink-tryit-spacing')).toBeNull();
	});

	it('the letter spacing slider redraws the strip and rebuilds its real font', () => {
		expect(REDRAW_TOPICS).toContain('letterSpacing');
		expect(FONT_REBUILD_TOPICS).toContain('letterSpacing');
	});
});
