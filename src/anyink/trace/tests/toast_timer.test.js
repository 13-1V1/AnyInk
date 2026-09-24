// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 finalize: every toast stays up for its own time. Upstream's showToast
// (src/controls/dialogs/dialogs.js) reused one #toast element and never cleared the
// earlier toast's timer, so the canvas's drag hint (3 s) or the import's loading message
// (60 s) removed the trace toasts that came after them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAllToasts, showToast } from '../../../controls/dialogs/dialogs.js';
import { DROP_HINT } from '../paste_drop.js';

const toasts = () => [...document.querySelectorAll('#toast')];
/** The text of the toast the user can read (the one not fading out), or ''. */
const shown = () => {
	const live = toasts().filter((el) => !el.hasAttribute('data-leaving'));
	return live.length ? live[live.length - 1].textContent : '';
};

beforeEach(() => {
	vi.useFakeTimers();
	// jsdom has no Element.animate; showToast's removal calls it
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
});

afterEach(() => {
	vi.useRealTimers();
});

describe('showToast timers (finalize)', () => {
	it('a photo dropped 2.3 s after the drag hint keeps its toast for its own 3 s', () => {
		showToast(DROP_HINT); // dragenter on the canvas
		vi.advanceTimersByTime(2300);
		showToast('Added a trace image. It is only for reference.', 3000);

		vi.advanceTimersByTime(1000); // 3.3 s: the drag hint's time is long past
		expect(shown()).toBe('Added a trace image. It is only for reference.');
		expect(toasts().length).toBe(1);

		vi.advanceTimersByTime(1900); // 5.2 s: still inside its own 3 s
		expect(shown()).toBe('Added a trace image. It is only for reference.');

		vi.advanceTimersByTime(500); // 5.7 s: gone, fade included
		expect(toasts()).toEqual([]);
	});

	it('the 60 s loading message never removes the toast that replaced it', () => {
		showToast('Loading the image...', 60000);
		vi.advanceTimersByTime(500);
		showToast('Added a trace image.', 3000);
		vi.advanceTimersByTime(3300);
		expect(toasts()).toEqual([]); // its own 3 s, not the loading message's 60 s

		showToast('Loading the image...', 60000);
		vi.advanceTimersByTime(500);
		showToast('A long note', 90000);
		vi.advanceTimersByTime(64500); // 65 s: the loading message's timer would have fired at 60 s
		expect(shown()).toBe('A long note');
	});

	it('a toast shown while the last one fades out stays up', () => {
		showToast('First', 3000);
		vi.advanceTimersByTime(3050); // the first toast is fading out
		showToast('Second', 3000);
		vi.advanceTimersByTime(200); // the fade-out's removal has run
		expect(shown()).toBe('Second');
		vi.advanceTimersByTime(3000);
		expect(toasts()).toEqual([]);
	});

	it('closeAllToasts still closes every toast', () => {
		showToast('One', 3000);
		vi.advanceTimersByTime(3050);
		showToast('Two', 3000);
		closeAllToasts();
		vi.advanceTimersByTime(200);
		expect(toasts()).toEqual([]);
	});
});
