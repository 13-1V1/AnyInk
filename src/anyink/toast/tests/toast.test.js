// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: the one toast voice (UX-BEGINNER.md 2.2, 4.0 Toasts). Every toast goes through toast.js:
// upstream's showToast is routed into it. All tools shows each toast the way it always has (one
// #toast element, the caller's time, the newest replaces the last). Simple shows one toast at a
// time, bottom right above the strip, for 6 s (hover pauses it), with priorities, and only in
// house words: an upstream message with no words key is dropped, and the scan test catches it.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAllToasts, showToast } from '../../../controls/dialogs/dialogs.js';
import { setModeForTests } from '../../mode/mode.js';
import { findUppercase } from '../../words/banned.js';
import { scanState, startToastRecorder } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	TOAST_MS,
	clearToasts,
	droppedToasts,
	resetToastsForTests,
	toast,
	toastLog,
	upstreamToast,
} from '../toast.js';

const here = dirname(fileURLToPath(import.meta.url));

const toasts = () => [...document.querySelectorAll('#toast')];
/** The toast the user can read (not fading out). */
const live = () => toasts().filter((el) => !el.hasAttribute('data-leaving'));
const shownText = () => live().at(-1)?.textContent.replace(/\s+/g, ' ').trim() ?? '';
const button = () => live().at(-1)?.querySelector('button') ?? null;

let warn;
beforeEach(() => {
	vi.useFakeTimers();
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	document.body.innerHTML = '';
	resetToastsForTests();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	resetToastsForTests();
	vi.useRealTimers();
	warn.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-toast-test]').forEach((s) => s.remove());
});

// --------------------------------------------------------------
// All tools: unchanged
// --------------------------------------------------------------

describe('All tools: showToast looks and behaves as today', () => {
	it('one #toast, the message as HTML, the caller time, fancy kept', () => {
		showToast('Switched to<br>Other font', 2000, true);
		const [element] = toasts();
		expect(element.innerHTML).toBe('Switched to<br>Other font');
		expect(element.hasAttribute('fancy')).toBe(true);
		expect(element.style.display).toBe('block');
		expect(element.hasAttribute('data-anyink-toast')).toBe(false);
		vi.advanceTimersByTime(1900);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(300);
		expect(toasts()).toEqual([]);
	});

	it("the default time is upstream's 3 s", () => {
		showToast('No more undo');
		vi.advanceTimersByTime(2900);
		expect(shownText()).toBe('No more undo');
		vi.advanceTimersByTime(300);
		expect(toasts()).toEqual([]);
	});

	it('the newest message replaces the one showing, in the same element', () => {
		showToast('First', 3000);
		const first = toasts()[0];
		showToast('Second', 3000);
		expect(toasts()).toEqual([first]);
		expect(shownText()).toBe('Second');
	});

	it("unmapped and Simple-only messages keep Glyphr Studio's words", () => {
		showToast('Added 3 kern groups');
		expect(shownText()).toBe('Added 3 kern groups');
		showToast('Values were rounded for the selected path points.');
		expect(shownText()).toBe('Values were rounded for the selected path points.');
		showToast('Restored deleted item<br>Latin Small Letter C');
		expect(toasts()[0].innerHTML).toBe('Restored deleted item<br>Latin Small Letter C');
	});

	it('a toast both modes share says the house words (2.2)', () => {
		showToast('Uniting all glyph shapes... ', 10000);
		expect(shownText()).toBe('Merging the shapes...');
	});

	it('toast(key) says the house words; allTools: its own words; allTools false: nothing', () => {
		toast('toast.photoReplaced');
		expect(shownText()).toBe('Replaced the photo');
		toast('toast.photoAdded', { letter: 'small a' }, { allTools: 'Added a <b>trace</b> image.' });
		expect(toasts()[0].innerHTML).toBe('Added a <b>trace</b> image.');
		closeAllToasts();
		vi.advanceTimersByTime(200);
		toast('toast.photoReplaced', {}, { allTools: false });
		expect(toasts()).toEqual([]);
		toast(null, {}, { allTools: 'Saved Font.gs2' });
		expect(shownText()).toBe('Saved Font.gs2');
	});

	it('a keyed toast with a button: the button runs once and closes the toast', () => {
		const run = vi.fn();
		toast('toast.backupFailed', {}, { action: { key: 'term.save', run } });
		expect(shownText()).toBe("Couldn't save a backup copy. Press Save to keep your work. Save");
		button().click();
		expect(run).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(200);
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

	it('the font file toasts keep their words in All tools', () => {
		showToast('Exported BrennanHand-Regular.otf to Fonts');
		expect(toasts()[0].innerHTML).toBe('Exported BrennanHand-Regular.otf to Fonts');
		showToast('Exporting OTF font file...');
		expect(shownText()).toBe('Exporting OTF font file...');
	});

	it('a shared toast with quoted names puts them in .anyink-quote', () => {
		toast(
			'toast.fontFileExported',
			{ file: 'A.otf', folder: 'Fonts' },
			{ quotes: ['file', 'folder'] }
		);
		// B14 + B15 finalize: "Made", as Use in Word's card says it
		expect(toasts()[0].innerHTML).toBe(
			'Made <span class="anyink-quote">A.otf</span> in <span class="anyink-quote">Fonts</span>'
		);
	});
});

// --------------------------------------------------------------
// Simple: one voice
// --------------------------------------------------------------

describe('Simple: one toast at a time, in house words', () => {
	beforeEach(() => setModeForTests('simple'));

	it('a keyed toast shows its words as text for 6 s, marked for the scan', () => {
		toast('toast.broughtBack', { letter: '<b>small c</b>' });
		const [element] = toasts();
		expect(element.dataset.anyinkToast).toBe('simple');
		expect(element.getAttribute('role')).toBe('status');
		expect(element.textContent).toBe('Brought back <b>small c</b>'); // text, never HTML
		expect(TOAST_MS).toBe(6000);
		vi.advanceTimersByTime(TOAST_MS - 100);
		expect(live()).toHaveLength(1);
		vi.advanceTimersByTime(300);
		expect(toasts()).toEqual([]);
	});

	it('hover pauses it; leaving lets it finish its time', () => {
		toast('toast.merged');
		vi.advanceTimersByTime(5000);
		live()[0].dispatchEvent(new Event('mouseenter'));
		vi.advanceTimersByTime(20000);
		expect(shownText()).toBe('Merged the shapes');
		live()[0].dispatchEvent(new Event('mouseleave'));
		vi.advanceTimersByTime(900);
		expect(shownText()).toBe('Merged the shapes');
		vi.advanceTimersByTime(300);
		expect(toasts()).toEqual([]);
	});

	it('an undo toast is not replaced by an info toast; the info toast waits its turn', () => {
		toast('toast.broughtBack', { letter: 'small c' }, { kind: 'undo' });
		vi.advanceTimersByTime(1000);
		toast('toast.photoReplaced');
		expect(shownText()).toBe('Brought back small c');
		vi.advanceTimersByTime(TOAST_MS - 1000 + 200);
		expect(shownText()).toBe('Replaced the photo');
		vi.advanceTimersByTime(TOAST_MS);
		expect(toasts()).toEqual([]);
	});

	it('a toast with a button is never replaced by an info toast', () => {
		const run = vi.fn();
		toast('toast.backupFailed', {}, { action: { key: 'term.save', run }, tone: 'warning' });
		toast('toast.merged');
		expect(shownText()).toContain("Couldn't save a backup copy");
		expect(live()[0].dataset.tone).toBe('warning');
		button().click();
		expect(run).toHaveBeenCalledTimes(1);
		expect(shownText()).toBe('Merged the shapes'); // its turn came when the button closed it
	});

	it('an error toast stays its full time; the next note waits its turn (4.0)', () => {
		// fix track: the probe's case. Every error toast is info with no button; a tool key's
		// toast 50 ms later used to replace it, and it never came back
		toast('toast.saveNotAllowed', { file: 'Brennan Hand.gs2' }, { quotes: ['file'] });
		vi.advanceTimersByTime(50);
		toast('mode.toolSwitched', { tool: 'Rectangle', key: 'R' }, { group: 'toolSwitch' });
		expect(shownText()).toBe(
			"ANY-INK wasn't allowed to write Brennan Hand.gs2. Choose a new file."
		);
		vi.advanceTimersByTime(TOAST_MS - 50 + 200);
		expect(shownText()).toBe('Switched to Rectangle (R)');
		// a group still replaces its own at once
		toast('mode.toolSwitched', { tool: 'Oval', key: 'O' }, { group: 'toolSwitch' });
		expect(shownText()).toBe('Switched to Oval (O)');
	});

	it('the same words again keep the toast showing and give it its time again', () => {
		upstreamToast('New shape was too small.');
		const first = live()[0];
		vi.advanceTimersByTime(5000);
		upstreamToast('New shape was too small.');
		expect(live()).toEqual([first]);
		vi.advanceTimersByTime(TOAST_MS - 100);
		expect(live()).toEqual([first]);
	});

	it('a toast with a button waiting its turn is never pushed out by plain notes', () => {
		// fix track: the probe's case. "Couldn't save a backup copy [Save]" waited behind an
		// undo toast, four "The photo already fits" pushed it out, and it was never shown
		const run = vi.fn();
		upstreamToast('Restored deleted item<br>Latin Small Letter C', { context: { chars: 'c' } });
		toast('toast.backupFailed', {}, { tone: 'warning', action: { key: 'term.save', run } });
		for (let i = 0; i < 4; i++) toast('toast.photoAlreadyFits');
		const seen = [];
		for (let i = 0; i < 6; i++) {
			seen.push(shownText());
			vi.advanceTimersByTime(TOAST_MS + 200);
		}
		expect(seen.slice(0, 3)).toEqual([
			'Brought back small c',
			"Couldn't save a backup copy. Press Save to keep your work. Save",
			'The photo already fits',
		]);
	});

	it('an undo toast pushes the export check aside; its [Show me] comes back after', () => {
		// fix track: the probe's case (D-035: the check's button is never lost)
		const run = vi.fn();
		const options = {
			group: 'export',
			tone: 'warning',
			ms: 12000,
			action: { key: 'check.showMe', run },
		};
		toast(
			'check.butNeedsFixing',
			{ where: 'Made the font file', clause: 'small a needs fixing.' },
			options
		);
		upstreamToast('Restored deleted item<br>Latin Small Letter C', { context: { chars: 'c' } });
		expect(shownText()).toBe('Brought back small c');
		vi.advanceTimersByTime(TOAST_MS + 200);
		expect(shownText()).toMatch(/small a needs fixing\. Show me$/);
		button().click();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('an offer pushed aside while the pointer is on it still comes back', () => {
		// fix track: the fading element's own timer (the pointer leaving it restarts it) must not
		// end the offer that waits for its turn again
		toast('toast.backupFailed', {}, { tone: 'warning', action: { key: 'term.save', run() {} } });
		const old = live()[0];
		old.dispatchEvent(new Event('mouseenter'));
		upstreamToast('Restored deleted item<br>Latin Small Letter C', { context: { chars: 'c' } });
		old.dispatchEvent(new Event('mouseleave'));
		vi.advanceTimersByTime(TOAST_MS + 200);
		expect(shownText()).toBe("Couldn't save a backup copy. Press Save to keep your work. Save");
	});

	it('closeAllToasts (a click on the canvas, Esc, every page change) keeps an offer with its button', () => {
		// fix track: the probe's case. The [Save] toast is not repeated for minutes, so losing it
		// to the next click lost the only offer to save
		const run = vi.fn();
		upstreamToast('Restored deleted item<br>Latin Small Letter C', { context: { chars: 'c' } });
		toast('toast.backupFailed', {}, { tone: 'warning', action: { key: 'term.save', run } });
		toast('toast.merged');
		closeAllToasts();
		expect(shownText()).toBe("Couldn't save a backup copy. Press Save to keep your work. Save");
		closeAllToasts(); // showing, it stays where it is
		expect(live()).toHaveLength(1);
		button().click();
		expect(run).toHaveBeenCalledTimes(1);
		expect(live()).toEqual([]);
	});

	it('a newer toast of the same group replaces one with no button at once', () => {
		upstreamToast('Uniting all glyph shapes... ', { duration: 10000 });
		expect(shownText()).toBe('Merging the shapes...');
		upstreamToast('Combine shapes: unite complete!', { duration: 2000 });
		expect(shownText()).toBe('Merged the shapes');
		vi.advanceTimersByTime(TOAST_MS - 100); // at least 6 s, whatever upstream asked for
		expect(shownText()).toBe('Merged the shapes');
	});

	it('an upstream message Simple never shows is not shown', () => {
		upstreamToast('Values were rounded for the selected path points.');
		expect(toasts()).toEqual([]);
		expect(droppedToasts()).toEqual([]);
		expect(toastLog().at(-1)).toMatchObject({
			source: 'upstream',
			mode: 'simple',
			shown: false,
			reason: 'never',
		});
	});

	it('an upstream message with no words key is dropped, and the scan catches it', () => {
		const recorder = startToastRecorder();
		upstreamToast('Done!<br>Something new');
		upstreamToast('Something else new');
		recorder.flush();
		recorder.stop();
		expect(toasts()).toEqual([]);
		expect(droppedToasts()).toEqual(['Done! Something new', 'Something else new']);
		const hits = scanState({ toasts: recorder.messages });
		expect(hits.length).toBeGreaterThanOrEqual(2);
		expect(hits.map((hit) => hit.text).join('\n')).toContain('Something else new');
	});

	it('a message another track still owns shows as it came', () => {
		upstreamToast('Exported BrennanHand-Regular.otf to Fonts');
		expect(shownText()).toBe('Made BrennanHand-Regular.otf in Fonts');
	});

	it('a toast only All tools shows (key null) says nothing in Simple', () => {
		toast(null, {}, { allTools: 'Saved Font.gs2' });
		expect(toasts()).toEqual([]);
		expect(toastLog().at(-1)).toMatchObject({
			source: 'key',
			key: null,
			shown: false,
			reason: 'all-tools only',
		});
	});

	it('closeAllToasts closes the toast and drops the line', () => {
		toast('toast.broughtBack', { letter: 'small c' }, { kind: 'undo' });
		toast('toast.merged');
		closeAllToasts();
		vi.advanceTimersByTime(TOAST_MS * 3);
		expect(toasts()).toEqual([]);
		clearToasts(); // twice is fine
	});

	it('a missing key never breaks the caller: nothing shows and it warns', () => {
		expect(() => toast('toast.noSuchKey')).not.toThrow();
		expect(toasts()).toEqual([]);
		expect(warn).toHaveBeenCalled();
	});

	it('sentence case: nothing shows in capitals', () => {
		const style = document.createElement('style');
		style.dataset.toastTest = '';
		style.textContent =
			readFileSync(join(here, '../../../controls/dialogs/dialogs.css'), 'utf8') +
			readFileSync(join(here, '../toast.css'), 'utf8');
		document.head.appendChild(style);
		toast('toast.backupFailed', {}, { action: { key: 'term.save', run() {} } });
		expect(findUppercase(document.body)).toEqual([]);
	});

	it('file and folder names show as quotes (2.3), which the scan reads as "…"', () => {
		const recorder = startToastRecorder();
		upstreamToast('Exported BrennanHand-Regular.otf to Fonts');
		recorder.flush();
		recorder.stop();
		const quotes = [...live()[0].querySelectorAll('.anyink-quote')].map((q) => q.textContent);
		expect(quotes).toEqual(['BrennanHand-Regular.otf', 'Fonts']);
		expect(shownText()).toBe('Made BrennanHand-Regular.otf in Fonts');
		expect(recorder.messages).toEqual(['Made "…" in "…"']);
		expect(scanState({ toasts: recorder.messages })).toEqual([]);
		// the export's group, as upstream_map gives it: the newer export toast takes the place
		toast(
			'toast.fontFileDownloading',
			{ file: '<b>A.otf</b>' },
			{ quotes: ['file'], group: 'export' }
		);
		expect(live()[0].querySelector('.anyink-quote').textContent).toBe('<b>A.otf</b>');
	});

	it('the same words again in one group keep the toast and give it its time again', () => {
		upstreamToast('Exporting OTF font file...');
		const first = live()[0];
		vi.advanceTimersByTime(5000);
		upstreamToast('Exporting<br>Latin Capital Letter A', { duration: 999999 });
		upstreamToast('Exporting<br>Latin Capital Letter B', { duration: 999999 });
		expect(live()).toEqual([first]);
		vi.advanceTimersByTime(TOAST_MS * 3);
		expect(live()).toEqual([first]); // 999999 ms now, as upstream asked
		upstreamToast('Exported A-Regular.otf to Fonts');
		expect(shownText()).toBe('Made A-Regular.otf in Fonts');
		expect(live()).not.toContain(first);
	});

	it('the log names the key each toast said', () => {
		toast('toast.merged');
		upstreamToast('Uniting all glyph shapes... ');
		expect(toastLog().slice(-2)).toEqual([
			expect.objectContaining({
				source: 'key',
				key: 'toast.merged',
				text: word('toast.merged'),
				shown: true,
			}),
			expect.objectContaining({
				source: 'upstream',
				key: 'toast.merging',
				shown: true,
				reason: 'key',
			}),
		]);
	});
});

describe('the toast stylesheet', () => {
	it('puts Simple toasts bottom right above the strip, in tokens only', () => {
		const css = readFileSync(join(here, '../toast.css'), 'utf8');
		expect(css).toMatch(
			/#toast\[data-anyink-toast='simple'\]\s*\{[^}]*bottom:\s*calc\(var\(--anyink-strip-height/
		);
		expect(css).toMatch(/#toast\[data-anyink-toast='simple'\]\s*\{[^}]*right:/);
		expect(css).not.toMatch(/:\s*#[0-9a-f]{3,8}\b/i);
		expect(css).not.toMatch(/rgba?\(/);
		expect(css).not.toMatch(/text-transform:\s*uppercase/);
	});

	// B6 + B7 integration (found in Chrome, tests/b67.verify.mjs): on the letter page the canvas's
	// zoom bar and, inside Fine-tune, the view switches sit in its bottom right corner, where a
	// toast covered them for its 6 s. A Simple toast sits just above that corner when it is there.
	it('on a page with the canvas zoom bar, a Simple toast sits above it (anchored to it)', () => {
		const css = readFileSync(join(here, '../toast.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		expect(css).toMatch(/\.editor-page__zoom-area\s*\{[^}]*anchor-name:\s*--anyink-zoom-area/);
		expect(css).toMatch(
			/#toast\[data-anyink-toast='simple'\]\s*\{[^}]*bottom:\s*calc\(\s*anchor\(--anyink-zoom-area top,/
		);
		expect(css).toMatch(/@supports \(anchor-name: --a\)/);
	});
});

// B12 + B13 integration: the install offer's [Not now] (start/install_offer.js passes
// options.dismiss). Written to fail first: the toast drew one button only.
describe('a second, plain button: options.dismiss', () => {
	it('Simple: [Install] then [Not now]; Not now runs once and closes the toast', () => {
		setModeForTests('simple');
		const install = vi.fn();
		const notNow = vi.fn();
		toast(
			'notice.install',
			{},
			{
				action: { key: 'notice.installButton', run: install },
				dismiss: { key: 'notice.notNow', run: notNow },
			}
		);
		const buttons = [...live().at(-1).querySelectorAll('button')];
		expect(buttons.map((b) => b.textContent)).toEqual([
			word('notice.installButton'),
			word('notice.notNow'),
		]);
		expect(buttons[1].classList.contains('anyink-toast__dismiss')).toBe(true);
		expect(buttons.some((b) => b.classList.contains('anyink-primary'))).toBe(false);
		buttons[1].click();
		buttons[1].click();
		expect(notNow).toHaveBeenCalledTimes(1);
		expect(install).not.toHaveBeenCalled();
		vi.advanceTimersByTime(200);
		expect(live()).toEqual([]);
	});

	it('the dismiss button does nothing once stillGood says no', () => {
		setModeForTests('simple');
		const notNow = vi.fn();
		let good = true;
		toast(
			'notice.install',
			{},
			{
				stillGood: () => good,
				action: { key: 'notice.installButton', run() {} },
				dismiss: { key: 'notice.notNow', run: notNow },
			}
		);
		good = false;
		live().at(-1).querySelectorAll('button')[1].click();
		expect(notNow).not.toHaveBeenCalled();
	});

	it('All tools: the classic toast shows both buttons too', () => {
		const notNow = vi.fn();
		toast(
			'notice.install',
			{},
			{
				action: { key: 'notice.installButton', run() {} },
				dismiss: { key: 'notice.notNow', run: notNow },
			}
		);
		const buttons = [...toasts().at(-1).querySelectorAll('button')];
		expect(buttons).toHaveLength(2);
		buttons[1].click();
		expect(notNow).toHaveBeenCalledTimes(1);
	});
});
