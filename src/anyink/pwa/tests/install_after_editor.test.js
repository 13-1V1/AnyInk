// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B13: in Simple the install offer is no notice any more: it moves to the toast after the first
// Ready letter (start/install_offer.js, tested in start/tests/install_offer.test.js).
// B4 + B5 finalize (toast track's hand-off: "the install offer only after the editor opens, not on
// the start page"; UX-BEGINNER.md 7.1: install is offered once he has started, B13 moves it to
// after the first ready letter). In Simple, an install offer that arrives while the start page
// shows waits until a font is open; All tools offers it at once, as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { resetInstallOfferForTests, setInstallOfferDepsForTests } from '../../start/install_offer.js';
import { word } from '../../words/words.js';
import { resetNotices } from '../notices.js';
import { offerInstall, resetLaunch } from '../register.js';

const shownText = () =>
	[...document.querySelectorAll('.anyink-pwa-notice p')].map((p) => p.textContent);

function installEvent() {
	const event = new Event('beforeinstallprompt', { cancelable: true });
	event.prompt = vi.fn(async () => {});
	event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
	return event;
}
const showPage = (appLevel) =>
	window.dispatchEvent(
		new CustomEvent('anyink-page-change', {
			detail: { page: appLevel ? 'Open project' : 'Overview', appLevel },
		})
	);

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetNotices();
	resetLaunch();
	resetInstallOfferForTests();
	document.body.innerHTML = '';
});
afterEach(() => {
	resetInstallOfferForTests();
	setModeForTests('all');
	showPage(false);
	resetNotices();
	resetLaunch();
	document.body.innerHTML = '';
});

describe('the install offer and the start page', () => {
	it('Simple: no notice, on the start page or in a font; the toast takes the offer', () => {
		const toasts = [];
		setInstallOfferDepsForTests({
			readyLetters: () => 1,
			show: (key) => toasts.push(key),
			isInstalled: () => false,
		});
		setModeForTests('simple');
		showPage(true);
		expect(offerInstall(installEvent())).toBe(null);
		showPage(false);
		expect(shownText()).toEqual([]);
		expect(toasts).toEqual(['notice.install']);
	});

	it('All tools: shows on the start page, as before', () => {
		showPage(true);
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
	});
});
