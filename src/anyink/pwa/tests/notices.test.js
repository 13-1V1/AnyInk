// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 5 (UX-BEGINNER 7.1): one notice on screen at a time; the rest wait their turn.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPref, resetPrefsCache } from '../../prefs/prefs.js';
import { activeNotice, closeNotice, resetNotices, showNotice, waitingNotices } from '../notices.js';

const panels = () => [...document.querySelectorAll('.anyink-pwa-notice')];
const shownText = () => panels().map((panel) => panel.querySelector('p').textContent);
const button = (label) =>
	[...document.querySelectorAll('.anyink-pwa-notice button')].find((b) => b.textContent === label);

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetNotices();
	document.body.innerHTML = '';
});
afterEach(() => resetNotices());

describe('notice queue', () => {
	it('shows one notice at a time and the next after the first is closed', () => {
		showNotice({ key: 'a', kind: 'info', message: 'First' });
		showNotice({ key: 'b', kind: 'info', message: 'Second' });
		expect(shownText()).toEqual(['First']);
		expect(waitingNotices()).toEqual(['b']);
		button('OK').click();
		expect(shownText()).toEqual(['Second']);
		button('OK').click();
		expect(shownText()).toEqual([]);
		expect(activeNotice()).toBe(null);
	});

	it('the same notice asked for twice shows once', () => {
		showNotice({ key: 'offline', kind: 'info', message: 'Ready offline' });
		showNotice({ key: 'offline', kind: 'info', message: 'Ready offline' });
		expect(shownText()).toEqual(['Ready offline']);
		expect(waitingNotices()).toEqual([]);
	});

	it('a waiting notice is not added twice either', () => {
		showNotice({ key: 'a', kind: 'info', message: 'First' });
		showNotice({ key: 'b', kind: 'info', message: 'Second' });
		showNotice({ key: 'b', kind: 'info', message: 'Second' });
		expect(waitingNotices()).toEqual(['b']);
	});

	it('an update takes the spot; the notice it moved comes back after', () => {
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action() {} });
		showNotice({ key: 'offline', kind: 'info', message: 'Offline' });
		showNotice({ key: 'update', kind: 'update', message: 'Update', actionLabel: 'Update', action() {} });
		expect(shownText()).toEqual(['Update']);
		expect(waitingNotices()).toEqual(['install', 'offline']);
		button('Later').click();
		expect(shownText()).toEqual(['Install']);
		button('Later').click();
		expect(shownText()).toEqual(['Offline']);
	});

	it('an info notice never replaces one with a button', () => {
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action() {} });
		showNotice({ key: 'offline', kind: 'info', message: 'Offline' });
		expect(shownText()).toEqual(['Install']);
	});

	it('only an update cuts in; anything else waits for the notice on screen', () => {
		showNotice({ key: 'offline', kind: 'info', message: 'Offline' });
		showNotice({ key: 'failed', kind: 'problem', message: 'Problem' });
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action() {} });
		expect(shownText()).toEqual(['Offline']);
		expect(waitingNotices()).toEqual(['failed', 'install']);
	});

	it('a finished action closes its notice and shows the next', async () => {
		const action = vi.fn(async () => {});
		showNotice({ key: 'go', kind: 'offer', message: 'Go', actionLabel: 'Do it', action });
		showNotice({ key: 'next', kind: 'info', message: 'Next' });
		button('Do it').click();
		await vi.waitFor(() => expect(shownText()).toEqual(['Next']));
		expect(action).toHaveBeenCalledOnce();
	});

	it('a failed action keeps its notice open with the reason', async () => {
		showNotice({
			key: 'update',
			kind: 'update',
			message: 'Update ready.',
			actionLabel: 'Update and reload',
			action: async () => {
				throw new Error('Close other ANY-INK tabs or windows before updating.');
			},
		});
		button('Update and reload').click();
		await vi.waitFor(() =>
			expect(shownText()).toEqual(['Close other ANY-INK tabs or windows before updating.'])
		);
		expect(button('Update and reload').disabled).toBe(false);
	});

	it('asking again replaces the action, so the newest one runs', async () => {
		const old = vi.fn(async () => {});
		const fresh = vi.fn(async () => {});
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action: old });
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action: fresh });
		button('Install').click();
		await vi.waitFor(() => expect(fresh).toHaveBeenCalledOnce());
		expect(old).not.toHaveBeenCalled();
	});

	it('closeNotice removes a notice whether it is showing or waiting', () => {
		showNotice({ key: 'a', kind: 'info', message: 'First' });
		showNotice({ key: 'b', kind: 'info', message: 'Second' });
		closeNotice('b');
		expect(waitingNotices()).toEqual([]);
		closeNotice('a');
		expect(shownText()).toEqual([]);
	});

	it('the dismiss button runs onDismiss with its own label', () => {
		const onDismiss = vi.fn();
		showNotice({
			key: 'install',
			kind: 'offer',
			message: 'Install',
			actionLabel: 'Install',
			action() {},
			dismissLabel: 'Not now',
			onDismiss,
		});
		button('Not now').click();
		expect(onDismiss).toHaveBeenCalledOnce();
		expect(shownText()).toEqual([]);
	});
});

// B1 fix pass: "ready to open offline" came right back after an update notice's Later. A notice
// asked not to wait (waits: false) is shown only when the screen is free, and an update that cuts
// in drops it instead of bringing it back.
describe('notices that do not wait their turn', () => {
	const offline = { key: 'offline', kind: 'info', message: 'Ready offline', once: 'testOnce', waits: false };

	it('is not kept in line when another notice is on screen, and is not counted as seen', () => {
		showNotice({ key: 'install', kind: 'offer', message: 'Install', actionLabel: 'Install', action() {} });
		expect(showNotice(offline)).toBe(null);
		expect(waitingNotices()).toEqual([]);
		expect(getPref('testOnce')).toBeUndefined();
		button('Later').click();
		expect(shownText()).toEqual([]);
	});

	it('an update that cuts in drops it, so it never comes back right after the update', () => {
		expect(showNotice(offline)).toBe('offline');
		showNotice({ key: 'update', kind: 'update', message: 'Update', actionLabel: 'Update', action() {} });
		expect(shownText()).toEqual(['Update']);
		expect(waitingNotices()).toEqual([]);
		button('Later').click();
		expect(shownText()).toEqual([]);
	});

	it('shows as usual when the screen is free', () => {
		expect(showNotice(offline)).toBe('offline');
		expect(shownText()).toEqual(['Ready offline']);
	});
});

describe('notices shown once ever', () => {
	it('remembers a once-ever notice when it is shown and skips it on the next launch', () => {
		showNotice({ key: 'offline', kind: 'info', message: 'Ready offline', once: 'testOnce' });
		expect(getPref('testOnce')).toBeTruthy();
		button('OK').click();
		resetNotices(); // next launch: fresh module state, prefs read back from storage
		resetPrefsCache();
		expect(showNotice({ key: 'offline', kind: 'info', message: 'Ready offline', once: 'testOnce' })).toBe(
			null
		);
		expect(shownText()).toEqual([]);
	});

	it('does not count a once-ever notice that only waited in line', () => {
		showNotice({ key: 'update', kind: 'update', message: 'Update', actionLabel: 'Update', action() {} });
		showNotice({ key: 'offline', kind: 'info', message: 'Ready offline', once: 'testOnce' });
		expect(getPref('testOnce')).toBeUndefined();
		button('Later').click();
		expect(shownText()).toEqual(['Ready offline']);
		expect(getPref('testOnce')).toBeTruthy();
	});
});
