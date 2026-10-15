// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 4.1, 2.4 G, 7.7): the app notices are a display point shared by both modes,
// so they say the house words: "ANY-INK works offline now.", the install offer with [Install]
// [Not now], and the update notice "A new version of ANY-INK is ready. Your work is kept.
// [Reload]" (it still never reloads by itself, D-020). Every word comes from src/anyink/words.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { setModeForTests } from '../../mode/mode.js';
import { findUppercase, scanDom } from '../../words/banned.js';
import { word } from '../../words/words.js';
import { resetNotices } from '../notices.js';
import {
	activateWaiting,
	announceOfflineReady,
	makeUpdateNotice,
	offerInstall,
	resetLaunch,
	showAppNotice,
} from '../register.js';

const panel = () => document.querySelector('.anyink-pwa-notice');
const shownText = () => panel()?.querySelector('p').textContent;
const buttons = () => [...(panel()?.querySelectorAll('button') || [])].map((b) => b.textContent);

function installEvent() {
	const event = new Event('beforeinstallprompt', { cancelable: true });
	event.prompt = vi.fn(async () => {});
	event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
	return event;
}

beforeEach(() => {
	localStorage.clear();
	resetNotices();
	resetLaunch();
	resetPrefsCache();
	document.body.innerHTML = '';
});
afterEach(() => {
	resetNotices();
	setModeForTests('all');
	vi.useRealTimers();
});

describe('app notices in house words', () => {
	it('ready offline', () => {
		announceOfflineReady();
		expect(shownText()).toBe(word('notice.offlineReady'));
		expect(shownText()).toBe('ANY-INK works offline now.');
		expect(buttons()).toEqual([word('notice.ok')]);
		expect(panel().getAttribute('aria-label')).toBe(word('notice.appLabel'));
	});

	it('the install offer', () => {
		offerInstall(installEvent());
		expect(shownText()).toBe(word('notice.install'));
		expect(buttons()).toEqual([word('notice.installButton'), word('notice.notNow')]);
		expect(buttons()).toEqual(['Install', 'Not now']);
	});

	it('the update notice, and what it says while it saves a backup copy', async () => {
		let finish;
		const update = vi.fn(() => new Promise((resolve) => (finish = resolve)));
		showAppNotice(makeUpdateNotice(update));
		expect(shownText()).toBe(word('notice.update'));
		expect(shownText()).toBe('A new version of ANY-INK is ready. Your work is kept.');
		expect(buttons()).toEqual([word('notice.reload'), word('notice.later')]);
		expect(update).not.toHaveBeenCalled(); // never reloads by itself (D-020)

		HTMLDialogElement.prototype.showModal ??= function () {
			this.open = true;
		};
		HTMLDialogElement.prototype.close ??= function () {
			this.open = false;
		};
		panel().querySelector('button').click();
		await Promise.resolve();
		expect(document.querySelector('.anyink-pwa-busy').textContent).toBe(word('notice.updating'));
		expect(update).toHaveBeenCalledTimes(1);
		finish();
	});

	it('a new version that was replaced says what to press', async () => {
		const worker = new EventTarget();
		worker.state = 'installed';
		worker.postMessage = () => {};
		const pending = activateWaiting(worker);
		worker.state = 'redundant';
		worker.dispatchEvent(new Event('statechange'));
		await expect(pending).rejects.toThrow(word('notice.updateReplaced'));
	});

	it('a new version that takes too long says what to press', async () => {
		vi.useFakeTimers();
		const worker = new EventTarget();
		worker.state = 'installed';
		worker.postMessage = () => {};
		const pending = activateWaiting(worker);
		const check = expect(pending).rejects.toThrow(word('notice.updateTimedOut'));
		vi.advanceTimersByTime(15000);
		await check;
	});

	['all', 'simple'].forEach((mode) => {
		it(`say no banned word and nothing in capitals (${mode})`, () => {
			setModeForTests(mode);
			const seen = [];
			[
				() => announceOfflineReady(),
				() => offerInstall(installEvent()),
				() => showAppNotice(makeUpdateNotice(async () => {})),
			].forEach((show) => {
				resetNotices();
				resetLaunch();
				localStorage.clear();
				resetPrefsCache();
				document.body.innerHTML = '';
				show();
				seen.push(...scanDom(document.body), ...findUppercase(document.body));
			});
			expect(seen).toEqual([]);
			[
				'notice.noBackups',
				'notice.offlineFailed',
				'notice.updateReplaced',
				'notice.updateTimedOut',
				'notice.updating',
			].forEach((key) => expect(word(key)).not.toMatch(/recovery|protect|snapshot|project/i));
		});
	});
});
