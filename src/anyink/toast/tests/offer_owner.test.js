// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (new problem "An offer outlives its font: the export check's [Show me] (and the
// backup [Save]) survive Ctrl+O into another font and act on that font"). An offer (an info toast
// with a button) is kept through a page change in Simple, so its button is never lost; but it
// belongs to the font that raised it. Raised with stillGood (true while that font is the open
// one), it goes as soon as stillGood says no: at the next clear (a page change), when its turn
// to show comes, and its button does nothing. The two offers that act on a font say whose they
// are: the export check's [Show me] (fontcheck/export_toast.js) and the backup copy's [Save]
// (recovery/recovery.js).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { clearToasts, resetToastsForTests, toast } from '../toast.js';

const live = () =>
	[...document.querySelectorAll('#toast[data-anyink-toast="simple"]')].filter(
		(el) => !el.hasAttribute('data-leaving')
	);
const shownText = () => live().at(-1)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const button = () => live().at(-1)?.querySelector('button') ?? null;

let warn;
beforeEach(() => {
	vi.useFakeTimers();
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
});
afterEach(() => {
	resetToastsForTests();
	vi.useRealTimers();
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

function offer(stillGood, run = vi.fn()) {
	toast('toast.backupFailed', {}, { tone: 'warning', action: { key: 'term.save', run }, stillGood });
	return run;
}

describe("an offer and its font", () => {
	it('kept through a page change while its font is open (as before)', () => {
		offer(() => true);
		clearToasts();
		expect(shownText()).toContain("Couldn't save a backup copy");
	});

	it('another font opened: the next page change takes it down', () => {
		let mine = true;
		offer(() => mine);
		mine = false;
		clearToasts();
		expect(shownText()).toBe('');
	});

	it('waiting behind an undo toast when the font changed: never shown', () => {
		let mine = true;
		offer(() => mine);
		toast('undo.undid', { change: 'added a rectangle' }, { kind: 'undo' });
		expect(shownText()).toContain('Undid');
		mine = false;
		vi.advanceTimersByTime(6500);
		expect(shownText()).toBe('');
	});

	it('its button does nothing once its font is gone', () => {
		let mine = true;
		const run = offer(() => mine);
		mine = false;
		button().click();
		expect(run).not.toHaveBeenCalled();
	});

	it('its button acts while its font is open', () => {
		const run = offer(() => true);
		button().click();
		expect(run).toHaveBeenCalledTimes(1);
	});
});
