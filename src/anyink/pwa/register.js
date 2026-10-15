// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getGlyphrStudioApp } from '../../app/main.js';
import { isSimpleMode } from '../mode/mode.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { getRecoveryStatus, snapshotNow } from '../recovery/recovery.js';
import { peekProject } from '../recovery/snapshot.js';
import { isPersistent } from '../storage/kv.js';
import { word } from '../words/words.js';
import { checkpoint, makeSafeReload } from './checkpoint.js';
import { closeNotice, showNotice } from './notices.js';
import './pwa.css';

// B4 (UX-BEGINNER.md 4.1, 7.7): every notice says the house words, from src/anyink/words
// (notice.*), in both modes: "ANY-INK works offline now.", the install offer, and "A new version
// of ANY-INK is ready. Your work is kept. [Reload]" (it never reloads by itself, D-020).

// B1 (UX-BEGINNER 7.1): app prefs that keep notices from coming back every launch.
export const OFFLINE_READY_PREF = 'pwaOfflineReadyShown';
export const INSTALL_NOT_NOW_PREF = 'pwaInstallNotNow';
// Set when the worker first reports the offline copy ready, so a later launch can say so when
// the launch it happened in was taken by the install offer.
export const OFFLINE_COPY_READY_PREF = 'pwaOfflineCopyReady';

// B1 fix pass: one app notice per launch. On a fresh profile the install offer showed and, the
// moment Not now was pressed, "ready to open offline" took its place. Whichever notice shows
// first takes this launch: the install offer and "ready offline" then wait for a later one.
// Updates and problems always show, because they protect work, and they take the launch too,
// so neither of the other two follows them.
let launchNotice = null; // key of the first app notice shown this launch, or null

/**
 * Shows an app notice and counts it against this launch (updates, problems).
 * @param {Object} spec - notices.js showNotice spec
 * @returns {String | null} the notice key, or null when it wasn't shown
 */
export function showAppNotice(spec) {
	const key = showNotice(spec);
	if (key && !launchNotice) launchNotice = key;
	return key;
}

/**
 * "Ready to open offline": once ever, however many times the worker reports it, and never right
 * after the install offer in the same launch (it is then said on a later launch).
 * @returns {String | null} the notice key, or null when not shown this launch
 */
export function announceOfflineReady() {
	if (getPref(OFFLINE_READY_PREF)) return null;
	setPref(OFFLINE_COPY_READY_PREF, true);
	if (launchNotice && launchNotice !== 'offline-ready') return null;
	return showAppNotice({
		key: 'offline-ready',
		kind: 'info',
		message: word('notice.offlineReady'),
		once: OFFLINE_READY_PREF,
		waits: false, // never right after another notice; a later launch says it instead
	});
}

/**
 * On a later launch: says "ready to open offline" if an earlier launch got the offline copy
 * ready but had no room to say so.
 * @param {Boolean} workerActive - this launch is served by an active service worker
 * @returns {String | null} the notice key, or null when there is nothing to say
 */
export function announceOfflineReadyFromEarlierLaunch(workerActive) {
	if (!workerActive || !getPref(OFFLINE_COPY_READY_PREF)) return null;
	return announceOfflineReady();
}

/** Tests only: forget which notice this launch showed (a fresh launch). */
export function resetLaunch() {
	launchNotice = null;
	heldInstallEvent = null;
}

// B4 + B5 finalize (UX-BEGINNER.md 7.1): in Simple the install offer waits until a font is open;
// on the start page it would be one more thing to decide before he has made anything (B13 moves it
// to after the first ready letter). The last 'anyink-page-change' (navigator.js, app.js) says
// whether an app-level page (the start page) shows. All tools offers at once, as before.
let onAppLevelPage = false;
let heldInstallEvent = null;
window.addEventListener('anyink-page-change', (event) => {
	onAppLevelPage = !!event?.detail?.appLevel;
	if (onAppLevelPage || !heldInstallEvent) return;
	const held = heldInstallEvent;
	heldInstallEvent = null;
	offerInstall(held);
});

/**
 * The install offer, unless Not now was already chosen (here or in Chrome's own install box),
 * or "ready to open offline" already took this launch (Chrome offers again next launch).
 * In Simple, while the start page shows, it is held until a font opens (B4 + B5 finalize).
 * @param {Event} event - Chrome's beforeinstallprompt event
 * @returns {String | null} the notice key, or null when not offered (or held)
 */
export function offerInstall(event) {
	if (getPref(INSTALL_NOT_NOW_PREF)) return null;
	if (isSimpleMode() && onAppLevelPage) {
		heldInstallEvent = event;
		return null;
	}
	// Another notice took this launch; Chrome offers again next launch
	if (launchNotice && launchNotice !== 'install') return null;
	return showAppNotice({
		key: 'install',
		kind: 'offer',
		message: word('notice.install'),
		actionLabel: word('notice.installButton'),
		action: async () => {
			await event.prompt();
			const choice = await event.userChoice;
			if (choice?.outcome === 'dismissed') setPref(INSTALL_NOT_NOW_PREF, Date.now());
		},
		dismissLabel: word('notice.notNow'),
		onDismiss: () => setPref(INSTALL_NOT_NOW_PREF, Date.now()),
	});
}

export function activateWaiting(worker) {
	if (!worker || worker.state === 'activated') return Promise.resolve();
	return new Promise((resolve, reject) => {
		const channel = new MessageChannel();
		const finish = (error) => {
			clearTimeout(timeout);
			worker.removeEventListener('statechange', changed);
			channel.port1.close();
			if (error) reject(error);
			else resolve();
		};
		const changed = () => {
			if (worker.state === 'activated') finish();
			else if (worker.state === 'redundant') finish(new Error(word('notice.updateReplaced')));
		};
		const timeout = setTimeout(() => finish(new Error(word('notice.updateTimedOut'))), 15000);
		channel.port1.onmessage = ({ data }) => {
			if (data.error) finish(new Error(data.error));
		};
		worker.addEventListener('statechange', changed);
		worker.postMessage({ type: 'ANYINK_ACTIVATE' }, [channel.port2]);
	});
}

/**
 * The update notice: a new version is ready, and [Reload] keeps a backup copy of the work, then
 * reloads. Never reloads by itself (D-020).
 * @param {Function} update - () => Promise: protect the work, activate, reload (makeSafeReload)
 * @returns {Object} a notices.js showNotice spec
 */
export function makeUpdateNotice(update) {
	return {
		key: 'update',
		kind: 'update',
		message: word('notice.update'),
		actionLabel: word('notice.reload'),
		action: async () => {
			const busy = document.createElement('dialog');
			busy.className = 'anyink-pwa-busy';
			busy.textContent = word('notice.updating');
			busy.addEventListener('cancel', (event) => event.preventDefault());
			// The upstream editor has document keyboard shortcuts even with a dialog open.
			const block = (event) => {
				event.stopImmediatePropagation();
				event.preventDefault();
			};
			document.body.append(busy);
			busy.showModal();
			window.addEventListener('keydown', block, true);
			window.addEventListener('keyup', block, true);
			try {
				await update();
			} finally {
				window.removeEventListener('keydown', block, true);
				window.removeEventListener('keyup', block, true);
				busy.close();
				busy.remove();
			}
		},
	};
}

async function start() {
	if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
	const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
		scope: import.meta.env.BASE_URL,
		updateViaCache: 'none',
	});
	const update = makeSafeReload({
		protect: () => {
			if (!isPersistent()) throw new Error(word('notice.noBackups'));
			return checkpoint({
				getEditors: () =>
					getGlyphrStudioApp().projectEditors.filter((editor) => peekProject(editor)),
				getStatus: getRecoveryStatus,
				snapshot: snapshotNow,
			});
		},
		activate: () => activateWaiting(registration.waiting),
		reload: () => location.reload(),
	});
	// One update notice at most: asking again while it shows or waits adds nothing.
	const offerUpdate = () => showAppNotice(makeUpdateNotice(update));
	if (registration.waiting) offerUpdate();
	announceOfflineReadyFromEarlierLaunch(!!registration.active);
	const observe = (worker) =>
		worker?.addEventListener('statechange', () => {
			if (worker.state === 'installed') {
				if (registration.active) offerUpdate();
				else announceOfflineReady();
			}
		});
	observe(registration.installing);
	registration.addEventListener('updatefound', () => observe(registration.installing));
	// An external activation can only offer a prompt. It never reloads this page.
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (registration.active) offerUpdate();
	});
	window.addEventListener('focus', () => {
		if (registration.waiting) offerUpdate();
		if (navigator.onLine) registration.update().catch(() => {});
	});
}

window.addEventListener('beforeinstallprompt', (event) => {
	event.preventDefault();
	offerInstall(event);
});
window.addEventListener('appinstalled', () => closeNotice('install'));

const boot = () =>
	start().catch(() =>
		showAppNotice({
			key: 'offline-failed',
			kind: 'problem',
			message: word('notice.offlineFailed'),
		})
	);
if (document.readyState === 'loading')
	document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
