// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 5: the app's own notices. "Ready to open offline" is shown once ever, the install
// offer's "Not now" is remembered, and the first launch never stacks notices.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPref, resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { word } from '../../words/words.js';
import { resetNotices, showNotice, waitingNotices } from '../notices.js';
import {
	announceOfflineReady,
	announceOfflineReadyFromEarlierLaunch,
	INSTALL_NOT_NOW_PREF,
	OFFLINE_COPY_READY_PREF,
	OFFLINE_READY_PREF,
	offerInstall,
	resetLaunch,
	showAppNotice,
} from '../register.js';

const shownText = () =>
	[...document.querySelectorAll('.anyink-pwa-notice p')].map((p) => p.textContent);
const buttons = () =>
	[...document.querySelectorAll('.anyink-pwa-notice button')].map((b) => b.textContent);
const button = (label) =>
	[...document.querySelectorAll('.anyink-pwa-notice button')].find((b) => b.textContent === label);

/** Chrome's install event, as the page receives it. */
function installEvent(outcome = 'accepted') {
	const event = new Event('beforeinstallprompt', { cancelable: true });
	event.prompt = vi.fn(async () => {});
	event.userChoice = Promise.resolve({ outcome, platform: 'web' });
	return event;
}

/** A new launch: module state is fresh and prefs are read back from storage. */
function relaunch() {
	resetNotices();
	resetLaunch();
	resetPrefsCache();
	document.body.innerHTML = '';
}

beforeEach(() => {
	localStorage.clear();
	relaunch();
});
afterEach(() => resetNotices());

describe('ready to open offline', () => {
	it('shows once even when the worker reports it twice', () => {
		announceOfflineReady();
		announceOfflineReady();
		expect(shownText()).toEqual([word('notice.offlineReady')]);
	});

	it('never shows again on a later launch', () => {
		announceOfflineReady();
		button(word('notice.ok')).click();
		expect(getPref(OFFLINE_READY_PREF)).toBeTruthy();
		relaunch();
		announceOfflineReady();
		expect(shownText()).toEqual([]);
	});
});

describe('install offer', () => {
	it('offers Install and Not now, once, however often Chrome fires', () => {
		window.dispatchEvent(installEvent());
		window.dispatchEvent(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
		expect(buttons()).toEqual([word('notice.installButton'), word('notice.notNow')]);
	});

	it('remembers Not now, so the next launch does not offer again', () => {
		offerInstall(installEvent());
		button(word('notice.notNow')).click();
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeTruthy();
		relaunch();
		const event = installEvent();
		expect(offerInstall(event)).toBe(null);
		window.dispatchEvent(event);
		expect(shownText()).toEqual([]);
	});

	it('remembers a No in Chrome own install box the same way', async () => {
		offerInstall(installEvent('dismissed'));
		button(word('notice.installButton')).click();
		await vi.waitFor(() => expect(getPref(INSTALL_NOT_NOW_PREF)).toBeTruthy());
		expect(shownText()).toEqual([]);
	});

	it('closes when the app gets installed', () => {
		offerInstall(installEvent());
		window.dispatchEvent(new Event('appinstalled'));
		expect(shownText()).toEqual([]);
	});
});

// B1 fix pass: on a fresh profile the install offer showed, and the moment Not now was pressed
// "ready to open offline" took its place. One app notice per launch: the other one waits.
describe('one app notice per launch', () => {
	it('after the install offer, "ready offline" does not follow it in the same launch', () => {
		offerInstall(installEvent());
		announceOfflineReady();
		expect(shownText()).toEqual([word('notice.install')]);
		expect(waitingNotices()).toEqual([]);
		button(word('notice.notNow')).click();
		expect(shownText()).toEqual([]);
		expect(getPref(OFFLINE_READY_PREF)).toBeFalsy();
	});

	it('says "ready offline" on the next launch instead, once', () => {
		offerInstall(installEvent());
		announceOfflineReady();
		button(word('notice.notNow')).click();
		relaunch();
		announceOfflineReadyFromEarlierLaunch(true);
		expect(shownText()).toEqual([word('notice.offlineReady')]);
		button(word('notice.ok')).click();
		relaunch();
		announceOfflineReadyFromEarlierLaunch(true);
		expect(shownText()).toEqual([]);
	});

	it('does not say "ready offline" on a later launch when it never got ready', () => {
		announceOfflineReadyFromEarlierLaunch(true);
		expect(shownText()).toEqual([]);
	});

	it('does not claim "ready offline" from an earlier launch without a working offline copy', () => {
		offerInstall(installEvent());
		announceOfflineReady();
		relaunch();
		announceOfflineReadyFromEarlierLaunch(false);
		expect(shownText()).toEqual([]);
	});

	it('after "ready offline", the install offer waits for a later launch (nothing remembered)', () => {
		announceOfflineReady();
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.offlineReady')]);
		button(word('notice.ok')).click();
		expect(shownText()).toEqual([]);
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeFalsy();
		relaunch();
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
	});

	// B1 fix pass: an update or a problem notice takes the launch too, so nothing follows it.
	const update = () =>
		showAppNotice({ key: 'update', kind: 'update', message: 'Update ready.', actionLabel: 'Update', action() {} });

	it('after an update notice, "ready offline" from an earlier launch waits for a later one', () => {
		setPref(OFFLINE_COPY_READY_PREF, true);
		update();
		announceOfflineReadyFromEarlierLaunch(true);
		expect(shownText()).toEqual(['Update ready.']);
		expect(waitingNotices()).toEqual([]);
		button('Later').click();
		expect(shownText()).toEqual([]);
		relaunch();
		announceOfflineReadyFromEarlierLaunch(true);
		expect(shownText()).toEqual([word('notice.offlineReady')]);
	});

	it('an update that cuts in on "ready offline" is not followed by it again', () => {
		announceOfflineReady();
		update();
		expect(shownText()).toEqual(['Update ready.']);
		button('Later').click();
		expect(shownText()).toEqual([]);
	});

	it('after the offline setup problem, the install offer waits for a later launch', () => {
		showAppNotice({
			key: 'offline-failed',
			kind: 'problem',
			message: 'Offline setup could not finish.',
		});
		expect(offerInstall(installEvent())).toBe(null);
		button(word('notice.ok')).click();
		expect(shownText()).toEqual([]);
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeFalsy();
		relaunch();
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
	});

	it('a second install event in the same launch still refreshes the offer on screen', () => {
		offerInstall(installEvent());
		expect(offerInstall(installEvent())).toBe('install');
		expect(shownText()).toEqual([word('notice.install')]);
	});

	it('an update still cuts in, whatever else showed this launch', () => {
		offerInstall(installEvent());
		showNotice({
			key: 'update',
			kind: 'update',
			message: 'Update ready.',
			actionLabel: 'Update',
			action() {},
		});
		expect(shownText()).toEqual(['Update ready.']);
	});
});
