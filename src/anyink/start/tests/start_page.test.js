// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B13 start screen (UX-BEGINNER.md 4.1, section 10 B13 unit tests):
	  - the Continue card, its permission path (asked inside the click; refused says so in one
	    sentence; a moved file leaves the list)
	  - each crash-card version, with exactly one green button
	  - other fonts and "Open a saved font..." always
	  - the name field's default never collides
	  - Create is green only with no card; "Other ways to start..."
	  - every state passes the banned-word scan (strict)
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFileHandle } from '../../files/tests/fakes.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { RECOVERY_CHANGE_EVENT } from '../../recovery/recovery.js';
import { scanDom } from '../../words/banned.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { makeStartPage } from '../start_page.js';

const NOW = new Date(2026, 9, 15, 9, 0).getTime();
const flush = async (n = 6) => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const recent = (name, options = {}) => ({
	handle: fakeFileHandle(`${name}.gs2`, options),
	name,
	time: NOW - 24 * 60 * 60 * 1000,
});
const visible = (element) => {
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hidden || node.style?.display === 'none') return false;
	}
	return true;
};
/** Green buttons he can see: .anyink-primary, or an upstream green fancy-button */
const greens = (root = document.body) =>
	[
		...root.querySelectorAll(
			'.anyink-primary, fancy-button:not([secondary]):not([minimal]):not([danger])'
		),
	]
		.filter(visible)
		.map((b) => b.textContent.trim());
const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
const card = () => document.querySelector('[data-anyink-card]');
const choice = (name, root = document) => root.querySelector(`[data-anyink-choice="${name}"]`);

/**
 * @param {Object} options - lists and stand-ins
 * @returns {Promise<{page: HTMLElement, deps: Object}>}
 */
async function startScreen({ recents = [], sessions = [], records = {}, ...overrides } = {}) {
	const deps = {
		load: vi.fn(),
		create: vi.fn(() => ({ project: {} })),
		openFiles: vi.fn(),
		moreTools: vi.fn(),
		listRecents: vi.fn(async () => recents),
		listSessions: vi.fn(async () => sessions),
		readRecord: vi.fn(async (id) => records[id]),
		restore: vi.fn(async () => undefined),
		discard: vi.fn(async () => true),
		confirmThrow: vi.fn(async () => true),
		removeRecent: vi.fn(async () => true),
		openRecent: vi.fn(async () => 'opened'),
		openPicker: vi.fn(async () => false),
		askPermission: vi.fn(async () => 'granted'),
		createFont: vi.fn(() => ({ editor: {}, done: Promise.resolve('noPicker') })),
		now: () => NOW,
		...overrides,
	};
	const page = makeStartPage(deps);
	document.body.appendChild(page);
	await page.ready;
	await flush();
	return { page, deps };
}

let quiet;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});
beforeEach(() => {
	quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
	setModeForTests('simple');
	setFeaturesForTests({ startScreen: true });
});
afterEach(() => {
	quiet.mockRestore();
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('the page keeps both ids', () => {
	it('#input__new-project-name and #button__create-new-project, in #open-project__page', async () => {
		await startScreen();
		expect(document.querySelector('#open-project__page #input__new-project-name')).not.toBeNull();
		expect(
			document.querySelector('#open-project__page #button__create-new-project')
		).not.toBeNull();
	});
});

describe('no card: Create my font is the one green button', () => {
	it('nothing to continue', async () => {
		await startScreen();
		expect(card()).toBeNull();
		expect(greens()).toEqual([word('startScreen.create')]);
		expect(text(document.body)).toContain(word('startScreen.newTitle'));
		expect(text(document.body)).toContain(word('startScreen.whereNote'));
		expect(text(document.body)).toContain(word('startScreen.workFileNote'));
		// before B14 the note names no step 3 (no doors to unbuilt rooms)
		expect(text(document.body)).not.toContain('step 3');
	});

	it('"Open a saved font..." shows even with no recent fonts', async () => {
		const { deps } = await startScreen();
		const open = [...document.querySelectorAll('button')].find(
			(b) => b.textContent === word('startScreen.openSaved')
		);
		expect(open).toBeTruthy();
		expect(text(document.body)).not.toContain(word('startScreen.otherFonts'));
		open.click();
		expect(deps.openPicker).toHaveBeenCalledTimes(1);
	});
});

describe('the Continue card', () => {
	const list = () => [
		recent('Brennan Hand'),
		recent('Test Caps'),
		recent('Old Hand'),
		recent('A'),
		recent('B'),
	];

	it('names the newest font, one green [Continue]; Create is outlined; up to 3 other fonts', async () => {
		await startScreen({ recents: list() });
		expect(card().dataset.anyinkCard).toBe('continue');
		expect(text(card())).toContain('Brennan Hand');
		expect(text(card())).toContain(word('startScreen.lastUsed', { ago: 'yesterday' }));
		expect(greens()).toEqual([word('startScreen.continue')]);
		expect(document.querySelector('#button__create-new-project').className).toBe('anyink-outlined');
		const names = [...document.querySelectorAll('.anyink-start__font')].map((b) => b.textContent);
		expect(names).toEqual(['Test Caps', 'Old Hand', 'A']);
		expect(text(document.body)).toContain(word('startScreen.openSaved'));
	});

	it('Continue opens the font inside the click (openRecent gets the entry)', async () => {
		const recents = list();
		const { deps, page } = await startScreen({ recents });
		choice('continue').click();
		expect(deps.openRecent).toHaveBeenCalledWith(recents[0]);
		await page.page.lastAction;
	});

	it('Chrome said no: one sentence, Continue again', async () => {
		const { deps, page } = await startScreen({
			recents: list(),
			openRecent: vi.fn(async () => 'denied'),
		});
		choice('continue').click();
		await page.page.lastAction;
		const note = document.querySelector('.anyink-start__note');
		expect(visible(note)).toBe(true);
		expect(note.textContent).toBe(word('startScreen.note.refused'));
		expect(deps.removeRecent).not.toHaveBeenCalled();
	});

	it('a moved file leaves the list and says where to look', async () => {
		const recents = list();
		const left = recents.slice(1);
		let calls = 0;
		const { deps, page } = await startScreen({
			recents,
			listRecents: vi.fn(async () => (calls++ ? left : recents)),
			openRecent: vi.fn(async () => 'missing'),
		});
		choice('continue').click();
		await page.page.lastAction;
		expect(deps.removeRecent).toHaveBeenCalledWith(recents[0].handle);
		expect(document.querySelector('.anyink-start__note').textContent).toBe(
			word('startScreen.note.gone', { name: 'Brennan Hand' })
		);
		expect(text(card())).toContain('Test Caps');
	});

	it('the first-time hint shows while Chrome would still ask', async () => {
		await startScreen({ recents: [recent('Brennan Hand', { query: 'prompt' })] });
		await flush();
		const hint = [...document.querySelectorAll('.anyink-start__hint')].find(
			(p) => p.textContent === word('startScreen.allowHint')
		);
		expect(visible(hint)).toBe(true);
	});

	it('a name under Other fonts opens that font', async () => {
		const recents = list();
		const { deps } = await startScreen({ recents });
		document.querySelectorAll('.anyink-start__font')[1].click();
		expect(deps.openRecent).toHaveBeenCalledWith(recents[2]);
	});
});

describe('the crash card (one card, one green button)', () => {
	const fileHandle = fakeFileHandle('Brennan Hand.gs2', { id: 'bh' });
	const withFile = {
		id: 'session:p1:s1',
		name: 'Brennan Hand',
		time: new Date(2026, 9, 13, 15, 40).getTime(),
		dirty: true,
		hasFile: true,
	};
	const noFile = { ...withFile, id: 'session:p2:s2', name: 'Never Saved', hasFile: false };

	it('newer than its work file: the sentence, [Continue with them], the link', async () => {
		await startScreen({
			recents: [{ handle: fileHandle, name: 'Brennan Hand', time: withFile.time - 60000 }],
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle } },
		});
		expect(document.querySelectorAll('[data-anyink-card]')).toHaveLength(1);
		expect(card().dataset.anyinkCard).toBe('crashWithFile');
		expect(text(card().querySelector('.anyink-start__crash-text'))).toBe(
			word('startScreen.crash.withFile', { name: 'Brennan Hand', when: 'Tuesday 3:40 PM' })
		);
		expect(text(choice('continue'))).toBe(word('startScreen.crash.continueWithThem'));
		expect(text(choice('open-saved'))).toBe(word('startScreen.crash.openSaved'));
		expect(greens()).toEqual([word('startScreen.crash.continueWithThem')]);
		// its own work file isn't listed again under Other fonts
		expect(document.querySelectorAll('.anyink-start__font')).toHaveLength(0);
	});

	it('Continue with them asks for the file inside the click, then restores the backup', async () => {
		const order = [];
		const { deps, page } = await startScreen({
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle } },
			askPermission: vi.fn(async () => order.push('ask') && 'granted'),
			restore: vi.fn(async () => order.push('restore')),
		});
		choice('continue').click();
		expect(deps.askPermission).toHaveBeenCalledWith(fileHandle); // synchronously, in the click
		await page.page.lastAction;
		expect(deps.restore).toHaveBeenCalledWith(withFile.id);
		expect(order[0]).toBe('ask');
	});

	it('Open the saved file instead opens the older file; the backup stays', async () => {
		const { deps, page } = await startScreen({
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle } },
		});
		choice('open-saved').click();
		await page.page.lastAction;
		expect(deps.openRecent).toHaveBeenCalledWith({ handle: fileHandle, name: 'Brennan Hand' });
		expect(deps.restore).not.toHaveBeenCalled();
		expect(deps.discard).not.toHaveBeenCalled();
	});

	it('no work file: "Unsaved work from ...", [Continue with it], "Throw it away"', async () => {
		const { deps, page } = await startScreen({ sessions: [noFile] });
		expect(card().dataset.anyinkCard).toBe('crashNoFile');
		expect(text(card())).toContain(
			word('startScreen.crash.noFile', { name: 'Never Saved', when: 'Tuesday 3:40 PM' })
		);
		expect(greens()).toEqual([word('startScreen.crash.continueWithIt')]);
		choice('continue').click();
		await page.page.lastAction;
		expect(deps.restore).toHaveBeenCalledWith(noFile.id);
	});

	it('Throw it away asks first; Keep it keeps the work', async () => {
		const { deps, page } = await startScreen({
			sessions: [noFile],
			confirmThrow: vi.fn(async () => false),
		});
		choice('throw-away').click();
		await page.page.lastAction;
		expect(deps.confirmThrow).toHaveBeenCalledTimes(1);
		expect(deps.discard).not.toHaveBeenCalled();
	});

	it('Throw it away, answered yes: the copy goes and the screen lists again', async () => {
		let left = [noFile];
		const { deps, page } = await startScreen({
			listSessions: vi.fn(async () => left),
			discard: vi.fn(async () => {
				left = [];
				return true;
			}),
		});
		choice('throw-away').click();
		await page.page.lastAction;
		expect(deps.discard).toHaveBeenCalledWith(noFile.id);
		expect(card()).toBeNull();
		expect(greens()).toEqual([word('startScreen.create')]);
	});

	// Fix pass (findings: the crash card ignored the work file's time; a Replace it copy took over
	// the screen). Written to fail first: any backup copy put the crash card on top, every launch.
	it('older than its work file (opened or saved since): Continue, not the crash card', async () => {
		const handle = fakeFileHandle('Brennan Hand.gs2', { id: 'bh', lastModified: 1 });
		await startScreen({
			recents: [
				{
					handle: fakeFileHandle('Brennan Hand.gs2', { id: 'bh' }),
					name: 'Brennan Hand',
					time: NOW,
				},
			],
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle: handle } },
		});
		expect(card().dataset.anyinkCard).toBe('continue');
		expect(greens()).toEqual([word('startScreen.continue')]);
	});

	it('older than its work file on disk (not a recent font): no crash card', async () => {
		const handle = fakeFileHandle('Brennan Hand.gs2', { id: 'bh', lastModified: NOW });
		await startScreen({
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle: handle } },
		});
		expect(card()).toBeNull();
		expect(greens()).toEqual([word('startScreen.create')]);
	});

	it("a work file Chrome won't let it read, not a recent font: the crash card stays (it can't tell)", async () => {
		const handle = fakeFileHandle('Brennan Hand.gs2', {
			id: 'bh',
			query: 'prompt',
			lastModified: NOW,
		});
		await startScreen({
			sessions: [withFile],
			records: { [withFile.id]: { fileHandle: handle } },
		});
		expect(card().dataset.anyinkCard).toBe('crashWithFile');
		expect(handle.calls.getFile).toBe(0);
	});

	it('a Replace it backup copy: Continue for his font; the copy is kept, not offered', async () => {
		const kept = { ...noFile, name: 'Brennan Hand', time: NOW };
		const { deps } = await startScreen({
			recents: [recent('Brennan Hand')],
			sessions: [kept],
			records: { [kept.id]: { replaced: true, fileHandle: null } },
		});
		expect(card().dataset.anyinkCard).toBe('continue');
		expect(text(card())).toContain('Brennan Hand');
		expect(greens()).toEqual([word('startScreen.continue')]);
		expect(deps.discard).not.toHaveBeenCalled();
	});

	it('a backup copy restored elsewhere lists again (RECOVERY_CHANGE_EVENT)', async () => {
		let left = [noFile];
		await startScreen({ listSessions: vi.fn(async () => left) });
		left = [];
		window.dispatchEvent(new Event(RECOVERY_CHANGE_EVENT));
		await flush();
		expect(card()).toBeNull();
	});
});

describe('the name field', () => {
	it('"My Font 2" when a recent font is already called My Font', async () => {
		await startScreen({ recents: [recent('My Font')] });
		expect(document.querySelector('#input__new-project-name').value).toBe('My Font 2');
	});

	it('"My Font 3" when a backup copy has "My Font 2" too', async () => {
		await startScreen({
			recents: [recent('My Font')],
			sessions: [{ id: 'x', name: 'My Font 2', time: NOW, hasFile: false }],
		});
		expect(document.querySelector('#input__new-project-name').value).toBe('My Font 3');
	});

	it('a name he typed stays', async () => {
		let release;
		const waiting = new Promise((resolve) => (release = resolve));
		const deps = {
			listRecents: () => waiting.then(() => [recent('My Font')]),
			listSessions: async () => [],
			now: () => NOW,
		};
		const page = makeStartPage(deps);
		document.body.appendChild(page);
		document.querySelector('#input__new-project-name').value = 'Brennan Hand';
		release();
		await page.ready;
		expect(document.querySelector('#input__new-project-name').value).toBe('Brennan Hand');
	});
});

describe('Create my font and the rest', () => {
	it('Create hands the name and the maker to createFont', async () => {
		const { deps } = await startScreen();
		document.querySelector('#input__new-project-name').value = '  Brennan Hand ';
		document.querySelector('#button__create-new-project').click();
		expect(deps.createFont).toHaveBeenCalledTimes(1);
		const [{ name, create }] = deps.createFont.mock.calls[0];
		expect(name).toBe('Brennan Hand');
		expect(document.querySelector('#input__new-project-name').value).toBe('Brennan Hand');
		create();
		expect(deps.create).toHaveBeenCalledTimes(1);
	});

	it('an empty name gets the default', async () => {
		const { deps } = await startScreen({ recents: [recent('My Font')] });
		document.querySelector('#input__new-project-name').value = '   ';
		document.querySelector('#button__create-new-project').click();
		expect(deps.createFont.mock.calls[0][0].name).toBe('My Font 2');
	});

	it('Enter in the name field creates too', async () => {
		const { deps } = await startScreen();
		document
			.querySelector('#input__new-project-name')
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(deps.createFont).toHaveBeenCalledTimes(1);
	});

	it('"Other ways to start..." asks for More tools', async () => {
		const { deps } = await startScreen();
		document.querySelector('.anyink-start__other-ways').click();
		expect(deps.moreTools).toHaveBeenCalledTimes(1);
	});

	it('a file dropped anywhere goes to openFiles', async () => {
		const { deps } = await startScreen();
		const drop = new Event('drop', { bubbles: true, cancelable: true });
		const items = [{ kind: 'file' }];
		drop.dataTransfer = { items };
		document.querySelector('#open-project__page').dispatchEvent(drop);
		expect(deps.openFiles).toHaveBeenCalledWith(items);
	});

	it('a list that cannot be read is an empty list, not a broken page', async () => {
		await startScreen({ listSessions: vi.fn(async () => Promise.reject(new Error('no db'))) });
		expect(greens()).toEqual([word('startScreen.create')]);
	});
});

describe('no banned words (strict) in any state', () => {
	const fileHandle = fakeFileHandle('Brennan Hand.gs2');
	const states = {
		none: {},
		continue: { recents: [recent('Brennan Hand', { query: 'prompt' }), recent('Test Caps')] },
		crashWithFile: {
			sessions: [{ id: 's1', name: 'Brennan Hand', time: NOW - 1000, hasFile: true }],
			records: { s1: { fileHandle } },
		},
		crashNoFile: {
			sessions: [{ id: 's2', name: 'Never Saved', time: NOW - 1000, hasFile: false }],
		},
	};
	Object.entries(states).forEach(([name, lists]) => {
		scanSimpleScreen(`start screen, ${name}`, async () => {
			setFeaturesForTests({ startScreen: true });
			const { page } = await startScreen(lists);
			return page;
		});
	});

	it('the refused sentence too', async () => {
		const { page } = await startScreen({
			recents: [recent('Brennan Hand')],
			openRecent: vi.fn(async () => 'prompt'),
		});
		choice('continue').click();
		await page.page.lastAction;
		expect(scanDom(page, { strict: true })).toEqual([]);
	});
});
