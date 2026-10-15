// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showError } from '../../../controls/dialogs/dialogs.js';
import { recClear, recDel, recSet, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import { setModeForTests } from '../../mode/mode.js';
import { RECOVERY_CHANGE_EVENT, setRecoveryDeps } from '../recovery.js';
import {
	EMPTY_MESSAGE,
	LOADING_MESSAGE,
	forgetSnapshotsWithFeedback,
	makeEmptyMessage,
	makeRecoverArea,
	makeRecoveryCard,
} from '../recovery_ui.js';

vi.mock('../../../controls/dialogs/dialogs.js', async (importOriginal) => ({
	...(await importOriginal()),
	showError: vi.fn(),
}));

const now = 60 * 60000;
const sessions = [
	{ id: 'a', name: 'Alpha', time: now - 5 * 60000, dirty: true, hasFile: true },
	{ id: 'b', name: 'Beta <i>', time: now - 30000, dirty: true, hasFile: false },
];

async function flush(times = 60) {
	for (let i = 0; i < times; i++) await Promise.resolve();
}

describe('makeRecoveryCard', () => {
	it('renders one row per session with name, age and a file badge', () => {
		const card = makeRecoveryCard(sessions, { now });
		const rows = card.querySelectorAll('.anyink-recovery-row');
		expect(rows).toHaveLength(2);
		expect(rows[0].dataset.sessionId).toBe('a');
		expect(rows[0].querySelector('.anyink-recovery-row__name').textContent).toBe('Alpha');
		expect(rows[0].querySelector('.anyink-recovery-row__when').textContent).toBe('5 minutes ago');
		expect(rows[0].querySelector('.anyink-recovery-row__badge')).not.toBeNull();
		expect(rows[1].querySelector('.anyink-recovery-row__name').textContent).toBe('Beta <i>');
		expect(rows[1].querySelector('.anyink-recovery-row__when').textContent).toBe(
			'less than a minute ago'
		);
		expect(rows[1].querySelector('.anyink-recovery-row__badge')).toBeNull();
		expect(card.getAttribute('role')).toBe('region');
	});

	it('Restore calls onRestore with the id and disables the row while it runs', async () => {
		let finish;
		const onRestore = vi.fn(() => new Promise((resolve) => (finish = resolve)));
		const card = makeRecoveryCard(sessions, { now, onRestore, onDiscard: vi.fn() });
		const row = card.querySelector('[data-session-id="a"]');
		const restore = row.querySelector('.anyink-recovery-row__restore');
		restore.click();
		expect(onRestore).toHaveBeenCalledWith('a');
		expect(restore.hasAttribute('disabled')).toBe(true);
		restore.click();
		expect(onRestore).toHaveBeenCalledTimes(1);
		finish();
		await flush();
		expect(restore.hasAttribute('disabled')).toBe(true); // the page navigates away; stays busy
	});

	it('Discard removes the row and reports when the last one is gone', async () => {
		const onDiscard = vi.fn(async () => undefined);
		const onEmpty = vi.fn();
		const card = makeRecoveryCard(sessions, { now, onDiscard, onEmpty, onRestore: vi.fn() });
		card.querySelector('[data-session-id="b"] .anyink-recovery-row__discard').click();
		await flush();
		expect(onDiscard).toHaveBeenCalledWith('b');
		expect(card.querySelectorAll('.anyink-recovery-row')).toHaveLength(1);
		expect(onEmpty).not.toHaveBeenCalled();

		card.querySelector('[data-session-id="a"] .anyink-recovery-row__discard').click();
		await flush();
		expect(onDiscard).toHaveBeenCalledWith('a');
		expect(onEmpty).toHaveBeenCalledWith(card);
	});

	it('shows the empty message in place when no onEmpty is given', async () => {
		const card = makeRecoveryCard([sessions[0]], { now, onDiscard: async () => undefined });
		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(card.querySelector('.anyink-recovery-row')).toBeNull();
		expect(card.textContent).toContain(EMPTY_MESSAGE);
	});
});

describe('makeRecoverArea', () => {
	it('shows a loading line, then a card when sessions exist', async () => {
		const area = makeRecoverArea({ list: async () => sessions });
		expect(area.textContent).toContain(LOADING_MESSAGE);
		await flush();
		expect(area.querySelector('.anyink-recovery-card')).not.toBeNull();
		expect(area.querySelectorAll('.anyink-recovery-row')).toHaveLength(2);
	});

	it('shows the empty message on the tab when there is nothing to recover', async () => {
		const area = makeRecoverArea({ list: async () => [] });
		await flush();
		expect(area.textContent).toBe(EMPTY_MESSAGE);
	});

	it('removes itself as a banner when there is nothing to recover, or on a listing error', async () => {
		const parent = document.createElement('div');
		const empty = makeRecoverArea({ banner: true, list: async () => [] });
		parent.appendChild(empty);
		expect(empty.textContent).toBe('');
		await flush();
		expect(parent.contains(empty)).toBe(false);

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const broken = makeRecoverArea({
			banner: true,
			list: async () => {
				throw new Error('idb down');
			},
		});
		parent.appendChild(broken);
		await flush();
		expect(parent.contains(broken)).toBe(false);
		warn.mockRestore();
	});

	// Verification of the kv fix: a failed read is not "nothing to recover".
	it('says the snapshots could not be read on the tab when the listing fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const area = makeRecoverArea({
			list: async () => {
				throw new Error('idb <down>');
			},
		});
		await flush();
		expect(area.textContent).not.toBe(EMPTY_MESSAGE);
		expect(area.textContent).toBe(
			'Could not read the crash-recovery snapshots (idb <down>). Reload ANY-INK to try again.'
		);
		expect(area.innerHTML).not.toContain('<down>');
		warn.mockRestore();
	});
});

// Verification of the forget fix: Settings > App > Forget must never reject unseen.
describe('forgetSnapshotsWithFeedback', () => {
	let restoreDriver;
	let driver;
	beforeEach(() => {
		driver = fakeDriver();
		restoreDriver = setStorageDriver(driver);
		document.querySelectorAll('#toast').forEach((el) => el.remove());
	});
	afterEach(() => {
		restoreDriver();
		document.querySelectorAll('#toast').forEach((el) => el.remove());
	});

	it('confirms when every snapshot is gone', async () => {
		await recSet('session:a', { id: 'a', dirty: true, project: {} });
		expect(await forgetSnapshotsWithFeedback()).toBe(true);
		expect(driver.data.get('recovery').size).toBe(0);
		expect(document.querySelector('#toast').innerHTML).toBe(
			'Crash-recovery snapshots were forgotten for this browser.'
		);
	});

	it('says what went wrong instead of rejecting when the store cannot be cleared', async () => {
		driver.failWhen((op) => op === 'clear');
		expect(await forgetSnapshotsWithFeedback()).toBe(false);
		expect(document.querySelector('#toast').innerHTML).toBe(
			'Could not forget the snapshots: the quota has been exceeded'
		);
	});
});

// Finding 7: the banner and the Recover tab were two lists that never re-listed.
describe('recover areas stay in sync', () => {
	let restoreDeps;
	beforeEach(async () => {
		await recClear();
		await recSet('session:a', { id: 'a', name: 'Alpha', time: now, dirty: true, project: {} });
		restoreDeps = setRecoveryDeps({
			locks: () => undefined,
			getEditor: () => null,
			getEditors: () => [],
		});
		showError.mockClear();
	});
	afterEach(() => {
		document.body.innerHTML = '';
		restoreDeps();
	});

	it('Discard in the banner empties the Recover tab too', async () => {
		const banner = makeRecoverArea({ banner: true });
		const tab = makeRecoverArea();
		document.body.append(banner, tab);
		await flush();
		expect(tab.querySelectorAll('.anyink-recovery-row')).toHaveLength(1);

		banner.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(document.body.contains(banner)).toBe(false);
		expect(tab.querySelector('.anyink-recovery-row')).toBeNull();
		expect(tab.textContent).toBe(EMPTY_MESSAGE);
	});

	it('Discard in the tab removes the banner', async () => {
		const banner = makeRecoverArea({ banner: true });
		const tab = makeRecoverArea();
		document.body.append(banner, tab);
		await flush();
		tab.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(document.body.contains(banner)).toBe(false);
		expect(tab.textContent).toBe(EMPTY_MESSAGE);
	});

	it('Restore on a row whose record is gone re-lists instead of showing an error', async () => {
		const tab = makeRecoverArea();
		document.body.append(tab);
		await flush();
		await recDel('session:a'); // gone behind the page's back (another tab restored it)
		tab.querySelector('.anyink-recovery-row__restore').click();
		await flush();
		expect(showError).not.toHaveBeenCalled();
		expect(tab.textContent).toBe(EMPTY_MESSAGE);
	});

	it('an area that left the document stops listening', async () => {
		const list = vi.fn(async () => []);
		const area = makeRecoverArea({ list });
		document.body.append(area);
		await flush();
		expect(list).toHaveBeenCalledTimes(1);
		window.dispatchEvent(new Event(RECOVERY_CHANGE_EVENT));
		await flush();
		expect(list).toHaveBeenCalledTimes(2);
		area.remove();
		window.dispatchEvent(new Event(RECOVERY_CHANGE_EVENT));
		window.dispatchEvent(new Event(RECOVERY_CHANGE_EVENT));
		await flush();
		expect(list).toHaveBeenCalledTimes(2);
	});
});

// --------------------------------------------------------------
// Simple (B4 fix track, until B13's start screen and crash card)
// --------------------------------------------------------------

describe('Simple: the card in house words, and the one start-screen confirm', () => {
	beforeEach(() => {
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		setModeForTests('simple');
	});
	afterEach(() => {
		setModeForTests('all');
		document.body.innerHTML = '';
	});

	const neverSaved = {
		id: 'n',
		name: 'Never Saved',
		time: now - 60000,
		dirty: true,
		hasFile: false,
	};
	const withFile = { id: 'f', name: 'Brennan Hand', time: now - 60000, dirty: true, hasFile: true };
	/** The newest box (one that was answered fades out for 110 ms first). */
	const dialog = () =>
		[...document.querySelectorAll('dialog#modal-dialog')].filter((box) => box.isConnected).at(-1) ??
		null;
	const choice = (name) => dialog()?.querySelector(`[data-anyink-choice="${name}"]`);

	it('Discard on unsaved work with no work file asks first (UX-BEGINNER 7.4 #1)', async () => {
		// fix track: the only copy of a never-saved font went with one press, no confirm, no undo
		const onDiscard = vi.fn(async () => undefined);
		const card = makeRecoveryCard([neverSaved], { now, onDiscard, onRestore: vi.fn() });
		document.body.append(card);
		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(onDiscard).not.toHaveBeenCalled();
		expect(dialog().textContent).toContain("Throw away this unsaved work? This can't be undone.");
		expect(choice('throw-away').textContent).toBe('Throw it away');
		expect(choice('keep').textContent).toBe('Keep it');
		// one green button: Keep it; Throw it away is outlined (principle 1)
		expect(choice('keep').hasAttribute('secondary')).toBe(false);
		expect(choice('throw-away').hasAttribute('secondary')).toBe(true);

		choice('keep').click();
		await flush();
		expect(onDiscard).not.toHaveBeenCalled();
		expect(card.querySelectorAll('.anyink-recovery-row')).toHaveLength(1);

		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		choice('throw-away').click();
		await flush();
		expect(onDiscard).toHaveBeenCalledWith('n');
		expect(card.querySelector('.anyink-recovery-row')).toBeNull();
	});

	it('closing the box by its x keeps the work, and the row can be pressed again', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout'] });
		const onDiscard = vi.fn(async () => undefined);
		const card = makeRecoveryCard([neverSaved], { now, onDiscard, onRestore: vi.fn() });
		document.body.append(card);
		const discard = card.querySelector('.anyink-recovery-row__discard');
		discard.click();
		await flush();
		dialog().querySelector('.modal-dialog__close-button').click();
		vi.advanceTimersByTime(200); // the box fades out, then leaves the page
		await flush();
		vi.useRealTimers();
		expect(dialog()).toBeNull();
		expect(onDiscard).not.toHaveBeenCalled();
		expect(discard.hasAttribute('disabled')).toBe(false);
		expect(card.querySelectorAll('.anyink-recovery-row')).toHaveLength(1);
	});

	it('Discard on a backup with a work file goes at once, as before', async () => {
		const onDiscard = vi.fn(async () => undefined);
		const card = makeRecoveryCard([withFile], { now, onDiscard, onRestore: vi.fn() });
		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(onDiscard).toHaveBeenCalledWith('f');
		expect(dialog()).toBeNull();
	});

	it('All tools discards at once, as before', async () => {
		setModeForTests('all');
		const onDiscard = vi.fn(async () => undefined);
		const card = makeRecoveryCard([neverSaved], { now, onDiscard, onRestore: vi.fn() });
		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		expect(onDiscard).toHaveBeenCalledWith('n');
	});

	it('the Recover tab says "backup copy", never any form of "snapshot" (2.4 G)', async () => {
		// fix track: "Unsaved work is snapshotted every few seconds" slipped past the scan,
		// which matches whole words and plurals only
		const tab = makeRecoverArea({ list: async () => [] });
		await tab.ready;
		expect(tab.textContent).toBe(
			'Nothing to recover. ANY-INK keeps a backup copy every few seconds while you work.'
		);
		expect(tab.textContent).not.toMatch(/snapshot/i);
		const card = makeRecoveryCard([neverSaved], {
			now,
			onDiscard: async () => undefined,
			onRestore: vi.fn(),
		});
		card.querySelector('.anyink-recovery-row__discard').click();
		await flush();
		choice('throw-away').click();
		await flush();
		expect(card.textContent).not.toMatch(/snapshot/i);
		setModeForTests('all');
		expect(makeEmptyMessage().textContent).toBe(EMPTY_MESSAGE); // All tools keeps its words
	});

	it('the badge says "has a saved file"; only the first Restore is green (principle 1)', () => {
		const card = makeRecoveryCard([withFile, { ...withFile, id: 'g' }], { now });
		expect(card.querySelector('.anyink-recovery-row__badge').textContent).toBe('has a saved file');
		const restores = [...card.querySelectorAll('.anyink-recovery-row__restore')];
		expect(restores.map((button) => button.hasAttribute('secondary'))).toEqual([false, true]);
		setModeForTests('all');
		const classic = makeRecoveryCard([withFile, { ...withFile, id: 'g' }], { now });
		expect(classic.querySelector('.anyink-recovery-row__badge').textContent).toBe('from file');
		expect(
			[...classic.querySelectorAll('.anyink-recovery-row__restore')].map((b) =>
				b.hasAttribute('secondary')
			)
		).toEqual([false, false]);
	});
});
