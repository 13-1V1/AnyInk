// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { kvClear } from '../../storage/kv.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { listRecentProjects, pushRecentProject } from '../handles.js';
import { STYLE_ID, SUBSCRIBER_ID, makeRecentFilesCard } from '../recents_ui.js';
import { clearDialogs, fakeApi, fakeFileHandle, toastText } from './fakes.js';

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);
const HOUR = 60 * 60 * 1000;

function rows(card) {
	return [...card.querySelectorAll('.anyink-recents__row')];
}
function names(card) {
	return rows(card).map((row) => row.querySelector('.anyink-recents__name').textContent);
}

async function seed() {
	const older = fakeFileHandle('Older.gs2');
	const newer = fakeFileHandle('Newer.gs2');
	vi.spyOn(Date, 'now').mockReturnValue(NOW - 2 * HOUR);
	await pushRecentProject(older, 'Older Font');
	vi.spyOn(Date, 'now').mockReturnValue(NOW - 10 * 1000);
	await pushRecentProject(newer, 'Newer Font');
	vi.restoreAllMocks();
	return { older, newer };
}

beforeEach(async () => {
	await kvClear();
	clearDialogs();
	setFileApi(fakeApi({ open: [], save: undefined }));
});

afterEach(() => {
	resetFileApi();
	clearDialogs();
	vi.restoreAllMocks();
});

describe('recents_ui: makeRecentFilesCard', () => {
	it('returns false without the File System Access API', () => {
		setFileApi(fakeApi({}));
		expect(makeRecentFilesCard()).toBe(false);
	});

	it('renders one row per recent project, newest first, with file name and time', async () => {
		await seed();
		const card = makeRecentFilesCard({ now: () => NOW });
		expect(card).not.toBe(false);
		await card.ready;
		expect(names(card)).toEqual(['Newer Font', 'Older Font']);
		const [first, second] = rows(card);
		expect(first.querySelector('.anyink-recents__file').textContent).toBe('Newer.gs2');
		expect(first.querySelector('.anyink-recents__time').textContent).toBe('just now');
		expect(second.querySelector('.anyink-recents__time').textContent).toBe('2 hours ago');
		expect(first.getAttribute('role')).toBe('listitem');
		expect(first.getAttribute('tabindex')).toBe('0');
		expect(document.getElementById(STYLE_ID)).not.toBeNull();
		expect(document.getElementById(STYLE_ID).textContent).not.toMatch(/#[0-9a-f]{3,8}\b/i);
	});

	it('shows an empty state and hides Clear when nothing was opened', async () => {
		const card = makeRecentFilesCard();
		await card.ready;
		expect(rows(card)).toHaveLength(0);
		expect(card.querySelector('.anyink-recents__empty').textContent).toBe('Nothing opened yet');
		expect(card.querySelector('.anyink-recents__clear').hidden).toBe(true);
	});

	it('opens a row with readwrite permission through openProjectFromHandle', async () => {
		const { newer } = await seed();
		const openHandle = vi.fn(async () => 'opened');
		const load = () => {};
		const card = makeRecentFilesCard({ openHandle, load });
		await card.ready;
		rows(card)[0].click();
		expect(await card.lastAction).toBe('opened');
		expect(openHandle).toHaveBeenCalledWith(newer, { mode: 'readwrite', load });
		expect(newer.calls.query).toBe(1);
		expect((await listRecentProjects())).toHaveLength(2);
	});

	it('opens a row from the keyboard too', async () => {
		await seed();
		const openHandle = vi.fn(async () => 'opened');
		const card = makeRecentFilesCard({ openHandle });
		await card.ready;
		rows(card)[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		await card.lastAction;
		expect(openHandle).toHaveBeenCalledTimes(1);
	});

	it('drops a row with a toast when permission is denied', async () => {
		const { older } = await seed();
		older.queryPermission = async () => 'denied';
		const openHandle = vi.fn();
		const card = makeRecentFilesCard({ openHandle });
		await card.ready;
		expect(await card.openRecent({ handle: older, name: 'Older Font', time: NOW })).toBe('denied');
		expect(openHandle).not.toHaveBeenCalled();
		expect(toastText()).toContain('Older Font');
		expect(names(card)).toEqual(['Newer Font']);
		expect((await listRecentProjects()).map((r) => r.name)).toEqual(['Newer Font']);
	});

	it('asks for one more click when the activation was gone (prompt)', async () => {
		const { newer } = await seed();
		newer.queryPermission = async () => 'prompt';
		newer.requestPermission = async () => 'prompt';
		const openHandle = vi.fn();
		const card = makeRecentFilesCard({ openHandle });
		await card.ready;
		expect(await card.openRecent({ handle: newer, name: 'Newer Font', time: NOW })).toBe('prompt');
		expect(openHandle).not.toHaveBeenCalled();
		expect(toastText()).toContain('once more');
		expect(names(card)).toEqual(['Newer Font', 'Older Font']);
	});

	it('drops a row whose file is gone', async () => {
		const { newer } = await seed();
		const openHandle = vi.fn(async () => 'missing');
		const card = makeRecentFilesCard({ openHandle });
		await card.ready;
		expect(await card.openRecent({ handle: newer, name: 'Newer Font', time: NOW })).toBe('missing');
		expect(toastText()).toContain('could not be found');
		expect(names(card)).toEqual(['Older Font']);
	});

	it('keeps a row whose file is not a valid project (the error dialog explains)', async () => {
		await seed();
		const openHandle = vi.fn(async () => 'invalid');
		const card = makeRecentFilesCard({ openHandle });
		await card.ready;
		await card.openRecent((await listRecentProjects())[0]);
		expect(names(card)).toEqual(['Newer Font', 'Older Font']);
	});

	it('removes one entry with its button and all of them with Clear', async () => {
		await seed();
		const card = makeRecentFilesCard();
		await card.ready;
		const openHandle = vi.fn();
		rows(card)[0].querySelector('.anyink-recents__remove').click();
		await card.lastAction;
		expect(openHandle).not.toHaveBeenCalled();
		expect(names(card)).toEqual(['Older Font']);
		card.querySelector('.anyink-recents__clear').click();
		await card.lastAction;
		expect(rows(card)).toHaveLength(0);
		expect(await listRecentProjects()).toEqual([]);
	});

	it("re-renders on the editor's 'projectFile' topic and lets go once detached", async () => {
		const editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		const card = makeRecentFilesCard();
		document.body.appendChild(card);
		await card.ready;
		expect(rows(card)).toHaveLength(0);
		expect(editor.subscribers.projectFile[SUBSCRIBER_ID]).toBeTypeOf('function');

		await pushRecentProject(fakeFileHandle('Late.gs2'), 'Late Font');
		editor.publish('projectFile', { saved: true });
		await card.lastAction;
		expect(names(card)).toEqual(['Late Font']);

		card.remove();
		editor.publish('projectFile', { saved: true });
		expect(editor.subscribers.projectFile[SUBSCRIBER_ID]).toBeUndefined();
	});
});
