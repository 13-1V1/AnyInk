// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (toast track's hand-off: "the install offer only after the editor opens, not on
// the start page"; UX-BEGINNER.md 7.1: install is offered once he has started, B13 moves it to
// after the first ready letter). In Simple, an install offer that arrives while the start page
// shows waits until a font is open; All tools offers it at once, as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setModeForTests } from '../../mode/mode.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
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
	document.body.innerHTML = '';
});
afterEach(() => {
	setModeForTests('all');
	showPage(false);
	resetNotices();
	resetLaunch();
	document.body.innerHTML = '';
});

describe('the install offer and the start page', () => {
	it('Simple: on the start page it waits, and shows once a font is open', () => {
		setModeForTests('simple');
		showPage(true);
		offerInstall(installEvent());
		expect(shownText()).toEqual([]);
		showPage(false);
		expect(shownText()).toEqual([word('notice.install')]);
	});

	it('Simple: offered while a font is open, it shows at once', () => {
		setModeForTests('simple');
		showPage(false);
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
	});

	it('All tools: shows on the start page, as before', () => {
		showPage(true);
		offerInstall(installEvent());
		expect(shownText()).toEqual([word('notice.install')]);
	});
});
