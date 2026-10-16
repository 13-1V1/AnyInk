// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B13 (UX-BEGINNER.md 4.1 "Install offer", section 10 B13): in Simple, the install offer is a
// toast, once, after the first letter becomes Ready (or the first font file, once B14 lands);
// never on the start page, never while a dialog is open; Not now is remembered; then install
// lives in Menu > Help.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests } from '../../mode/features.js';
import { MODE_EVENT, setModeForTests } from '../../mode/mode.js';
import { getPref, resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { activeNotice, resetNotices } from '../../pwa/notices.js';
import { offerInstall, resetLaunch } from '../../pwa/register.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { canInstall, promptInstall } from '../../topbar/install_offer.js';
import { word } from '../../words/words.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import {
	DIALOG_RETRY_MS,
	INSTALL_NOT_NOW_PREF,
	INSTALL_OFFERED_PREF,
	holdInstallEvent,
	noteFontFile,
	resetInstallOfferForTests,
	setInstallOfferDepsForTests,
	tryInstallOffer,
} from '../install_offer.js';

/** Chrome's install event, as the page receives it */
function installEvent(outcome = 'accepted') {
	const event = new Event('beforeinstallprompt', { cancelable: true });
	event.prompt = vi.fn(async () => {});
	event.userChoice = Promise.resolve({ outcome, platform: 'web' });
	return event;
}

const showPage = (appLevel) =>
	window.dispatchEvent(
		new CustomEvent('anyink-page-change', {
			detail: { page: appLevel ? 'app-level' : 'Overview', appLevel },
		})
	);

let ready = 0;
let shown = [];
const fakeShow = (key, vars, options) => shown.push({ key, vars, options });

function useFakes({ installed = false } = {}) {
	setInstallOfferDepsForTests({
		readyLetters: () => ready,
		show: fakeShow,
		isInstalled: () => installed,
	});
}

const simpleToasts = () => [
	...document.querySelectorAll('#toast[data-anyink-toast="simple"]:not([data-leaving])'),
];

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetInstallOfferForTests();
	resetNotices();
	resetLaunch();
	resetToastsForTests();
	document.body.innerHTML = '';
	ready = 0;
	shown = [];
	setModeForTests('simple');
	showPage(false);
	useFakes();
});
afterEach(() => {
	vi.useRealTimers();
	resetInstallOfferForTests();
	resetToastsForTests();
	resetNotices();
	resetLaunch();
	setModeForTests('all');
	showPage(false);
	document.body.innerHTML = '';
});

describe('when the install toast comes', () => {
	it('not before a letter is Ready: Chrome offering install is not enough', () => {
		holdInstallEvent(installEvent());
		expect(shown).toEqual([]);
		expect(tryInstallOffer()).toBe('not-yet');
	});

	it('after the first Ready letter, once, with Install and Not now', () => {
		holdInstallEvent(installEvent());
		ready = 1;
		expect(tryInstallOffer()).toBe('shown');
		expect(shown).toHaveLength(1);
		const { key, options } = shown[0];
		expect(key).toBe('notice.install');
		expect(options.action.key).toBe('notice.installButton');
		expect(options.dismiss.key).toBe('notice.notNow');
		expect(tryInstallOffer()).toBe('said');
		expect(shown).toHaveLength(1);
	});

	it('a step that makes the first Ready letter brings it (the save status event)', () => {
		holdInstallEvent(installEvent());
		ready = 1;
		window.dispatchEvent(new CustomEvent('anyink-save-status'));
		expect(shown).toHaveLength(1);
	});

	it('Chrome offering install after the letter is Ready brings it then', () => {
		ready = 3;
		expect(tryInstallOffer()).toBe('no-event');
		holdInstallEvent(installEvent());
		expect(shown).toHaveLength(1);
	});

	it('is remembered: a later launch never offers it again, even if he ignored it', () => {
		holdInstallEvent(installEvent());
		ready = 1;
		tryInstallOffer();
		expect(getPref(INSTALL_OFFERED_PREF)).toBeTruthy();
		resetInstallOfferForTests();
		resetPrefsCache();
		useFakes();
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('said');
		expect(shown).toHaveLength(1);
	});

	it('not on the start page; it comes once a font is open', () => {
		showPage(true);
		ready = 1;
		holdInstallEvent(installEvent());
		expect(shown).toEqual([]);
		showPage(false);
		expect(shown).toHaveLength(1);
	});

	it('never during a dialog: it waits until the dialog closes', () => {
		vi.useFakeTimers();
		const dialog = document.createElement('div');
		dialog.dataset.anyinkDialog = 'howCard';
		document.body.append(dialog);
		ready = 1;
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('dialog');
		vi.advanceTimersByTime(DIALOG_RETRY_MS * 3);
		expect(shown).toEqual([]);
		dialog.remove();
		vi.advanceTimersByTime(DIALOG_RETRY_MS);
		expect(shown).toHaveLength(1);
	});

	it('B16: never in the middle of a photo walk; it waits for a calm moment', () => {
		vi.useFakeTimers();
		let walking = true;
		setInstallOfferDepsForTests({
			readyLetters: () => ready,
			show: fakeShow,
			isInstalled: () => false,
			photoWalk: () => walking,
		});
		ready = 1;
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('busy');
		vi.advanceTimersByTime(DIALOG_RETRY_MS * 3);
		expect(shown).toEqual([]);
		walking = false;
		vi.advanceTimersByTime(DIALOG_RETRY_MS);
		expect(shown).toHaveLength(1);
	});

	it('B16: after the first font file it may show even while photo parts are left', () => {
		setFeaturesForTests({ startScreen: true, useInWord: true });
		setInstallOfferDepsForTests({
			readyLetters: () => 0,
			show: fakeShow,
			isInstalled: () => false,
			photoWalk: () => true,
		});
		holdInstallEvent(installEvent());
		noteFontFile();
		expect(shown).toHaveLength(1);
	});

	it('B16: the photo walk is the photo card, or the Next line on step C or on the next part', async () => {
		const { photoWalkNow } = await import('../install_offer.js');
		expect(photoWalkNow({ line: () => ({ name: 'photoParts' }), state: () => ({}) })).toBe(true);
		expect(photoWalkNow({ line: () => ({ name: 'photoResult' }), state: () => ({}) })).toBe(true);
		expect(
			photoWalkNow({
				line: () => ({ name: 'tryLetters' }),
				state: () => ({ photoCard: { step: 'result' } }),
			})
		).toBe(true);
		expect(photoWalkNow({ line: () => ({ name: 'tryLetters' }), state: () => ({}) })).toBe(false);
	});

	it('not when ANY-INK already runs as the installed app', () => {
		useFakes({ installed: true });
		ready = 1;
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('installed');
		expect(shown).toEqual([]);
	});

	it('not after Not now on the All tools notice (one Not now for both)', () => {
		setPref(INSTALL_NOT_NOW_PREF, 1);
		ready = 1;
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('said');
	});

	it('All tools: no toast; the notice there is unchanged', () => {
		setModeForTests('all');
		ready = 1;
		holdInstallEvent(installEvent());
		expect(tryInstallOffer()).toBe('not-simple');
		expect(shown).toEqual([]);
	});

	it('the first font file brings it only once Use in Word (B14) is on', () => {
		// B14 + B15 integration: Use in Word is on in the app; before B14 a font file brought nothing
		setFeaturesForTests({ useInWord: false });
		holdInstallEvent(installEvent());
		noteFontFile();
		expect(shown).toEqual([]);
		setFeaturesForTests({ useInWord: true });
		noteFontFile();
		expect(shown).toHaveLength(1);
	});
});

describe('its buttons', () => {
	it('Not now is remembered', () => {
		holdInstallEvent(installEvent());
		ready = 1;
		tryInstallOffer();
		shown[0].options.dismiss.run();
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeTruthy();
	});

	it('Install asks Chrome; a No in Chrome own box is remembered like Not now', async () => {
		const event = installEvent('dismissed');
		holdInstallEvent(event);
		ready = 1;
		tryInstallOffer();
		await shown[0].options.action.run();
		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeTruthy();
	});

	it('Install uses up Chrome offer, so the Menu row goes too', async () => {
		holdInstallEvent(installEvent());
		ready = 1;
		tryInstallOffer();
		expect(canInstall()).toBe(true);
		await shown[0].options.action.run();
		expect(canInstall()).toBe(false);
	});

	it('Install from the Menu first: the toast has nothing to offer', async () => {
		holdInstallEvent(installEvent());
		await promptInstall();
		ready = 1;
		expect(tryInstallOffer()).toBe('no-event');
	});
});

describe('the hand-over from the notice', () => {
	it('register.js in Simple puts no notice up; the toast takes the offer', () => {
		ready = 1;
		expect(offerInstall(installEvent())).toBe(null);
		expect(document.querySelectorAll('.anyink-pwa-notice')).toHaveLength(0);
		expect(shown).toHaveLength(1);
	});

	it('Chrome event on the page is held too (no notice code needed)', () => {
		ready = 1;
		window.dispatchEvent(installEvent());
		expect(shown).toHaveLength(1);
	});
});

describe("All tools' install notice and the held offer: one owner of Chrome's event", () => {
	const noticeButton = (label) =>
		[...document.querySelectorAll('.anyink-pwa-notice button')].find(
			(b) => b.textContent === label
		);
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it('Install on the notice uses up the held offer: Simple then shows no Menu row', async () => {
		setModeForTests('all');
		const event = installEvent();
		window.dispatchEvent(event);
		noticeButton(word('notice.installButton')).click();
		await settle();
		expect(event.prompt).toHaveBeenCalledTimes(1);
		setModeForTests('simple');
		expect(canInstall()).toBe(false);
	});

	it('the notice asks Chrome even when only register.js saw the event', async () => {
		setModeForTests('all');
		const event = installEvent();
		offerInstall(event);
		noticeButton(word('notice.installButton')).click();
		await settle();
		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(canInstall()).toBe(false);
	});

	it('Menu row first: the notice never asks Chrome a second time, and goes', async () => {
		setModeForTests('all');
		const event = installEvent();
		window.dispatchEvent(event);
		await promptInstall();
		await settle();
		// the notice went with the offer: no Install button is left to ask Chrome again
		expect(noticeButton(word('notice.installButton'))).toBeUndefined();
		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(document.querySelectorAll('.anyink-pwa-notice')).toHaveLength(0);
	});

	it("a No in Chrome's box from the notice is remembered like Not now", async () => {
		setModeForTests('all');
		window.dispatchEvent(installEvent('dismissed'));
		noticeButton(word('notice.installButton')).click();
		await settle();
		expect(getPref(INSTALL_NOT_NOW_PREF)).toBeTruthy();
	});
});

// Finalize (still open: "the notice stays when Menu > Help used the offer first"; new problem:
// "the All tools install notice carries into Simple"). Written to fail first: the notice stayed
// on screen in both cases.
describe('the All tools notice goes whenever the offer does', () => {
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
	const switchTo = (mode) => {
		const previous = setModeForTests(mode);
		window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode, previous } }));
	};

	it('Menu > Help first, answered No: the notice goes and is not offered again', async () => {
		setModeForTests('all');
		const event = installEvent('dismissed');
		window.dispatchEvent(event);
		expect(activeNotice()).toBe('install');
		await promptInstall();
		await settle();
		expect(event.prompt).toHaveBeenCalledTimes(1);
		expect(activeNotice()).toBeNull();
		switchTo('simple');
		switchTo('all');
		expect(activeNotice()).toBeNull();
	});

	it('Menu > Help first, answered Yes: the notice goes too', async () => {
		setModeForTests('all');
		window.dispatchEvent(installEvent('accepted'));
		await promptInstall();
		await settle();
		expect(activeNotice()).toBeNull();
	});

	it('Simple shows no install notice; back in All tools it comes back while the offer is held', () => {
		setModeForTests('all');
		window.dispatchEvent(installEvent());
		expect(activeNotice()).toBe('install');
		switchTo('simple');
		expect(activeNotice()).toBeNull();
		expect(canInstall()).toBe(true); // the offer lives on in Menu > Help
		switchTo('all');
		expect(activeNotice()).toBe('install');
	});

	it('Not now chosen in Simple keeps the notice away in All tools', () => {
		setModeForTests('all');
		window.dispatchEvent(installEvent());
		switchTo('simple');
		setPref(INSTALL_NOT_NOW_PREF, Date.now());
		switchTo('all');
		expect(activeNotice()).toBeNull();
	});
});

// Finalize: b45.verify's B5-pinned Simple (every flag off) got the install toast, which held the
// queue so "Merging the shapes..." never showed. Written to fail first: the toast ignored the flag.
describe("the install toast is B13's", () => {
	it("with 'startScreen' off it never shows", () => {
		setFeaturesForTests({ startScreen: false });
		ready = 1;
		expect(holdInstallEvent(installEvent())).toBe('flag-off');
		expect(shown).toEqual([]);
		setFeaturesForTests({ startScreen: true });
		expect(tryInstallOffer()).toBe('shown');
	});
});

describe('on the page, through the one toast voice', () => {
	it('shows the house words and an Install button, bottom right', () => {
		setInstallOfferDepsForTests({ readyLetters: () => 1, isInstalled: () => false });
		holdInstallEvent(installEvent());
		const [element] = simpleToasts();
		expect(element?.textContent).toContain(word('notice.install'));
		const labels = [...element.querySelectorAll('button')].map((b) => b.textContent);
		expect(labels).toContain(word('notice.installButton'));
	});
});

scanSimpleScreen('the install toast', () => {
	resetInstallOfferForTests();
	localStorage.clear();
	resetPrefsCache();
	showPage(false);
	setInstallOfferDepsForTests({ readyLetters: () => 1, isInstalled: () => false });
	holdInstallEvent(installEvent());
	return document.body;
});
