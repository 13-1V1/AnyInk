// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { AssetStore } from '../../assets/asset_store.js';
import {
	SESSION_PREFIX,
	describeSession,
	formatAgo,
	isSessionKey,
	makeSessionRecord,
	minutesAgo,
	peekProject,
	sessionKey,
} from '../snapshot.js';

function fakeProject(id = 'p1', name = 'Test Font') {
	return {
		settings: { project: { id, name } },
		save() {
			return { settings: { project: { id, name } }, glyphs: { 'glyph-0x41': {} } };
		},
	};
}

describe('session keys', () => {
	it('keys a live session by project id and session id', () => {
		expect(sessionKey('p1', 's1')).toBe('session:p1:s1');
		expect(isSessionKey(sessionKey('p1', 's1'))).toBe(true);
	});

	it('still builds and recognizes the older per-project keys', () => {
		expect(sessionKey('p1')).toBe(`${SESSION_PREFIX}p1`);
		expect(isSessionKey(sessionKey('p1'))).toBe(true);
		expect(isSessionKey('handle:last')).toBe(false);
		expect(isSessionKey(undefined)).toBe(false);
	});
});

describe('peekProject', () => {
	it('reads an own project property (plain objects)', () => {
		const project = fakeProject();
		expect(peekProject({ project })).toBe(project);
		expect(peekProject({ project: null })).toBeNull();
		expect(peekProject(null)).toBeNull();
	});

	it('never triggers a prototype getter: reads _project instead', () => {
		let getterCalls = 0;
		class EditorLike {
			get project() {
				getterCalls++;
				return fakeProject('default');
			}
		}
		const empty = new EditorLike();
		expect(peekProject(empty)).toBeNull();
		const loaded = new EditorLike();
		const project = fakeProject('loaded');
		loaded._project = project;
		expect(peekProject(loaded)).toBe(project);
		expect(getterCalls).toBe(0);
	});
});

describe('makeSessionRecord', () => {
	it('captures id, name, time, dirty, handle, project save and asset blobs', () => {
		const handle = { kind: 'file', name: 'font.gs2' };
		const assets = new AssetStore();
		const blob = new Blob(['x'], { type: 'image/png' });
		assets.add(blob, { id: 'img-a' });
		const history = { serializeForStorage: () => ({ version: 3, queue: [], redoQueue: [] }) };
		const editor = { project: fakeProject('p1', 'Test Font'), assets, loadedFileHandle: handle, history };
		const record = makeSessionRecord(editor, {
			dirty: true,
			time: 1000,
			key: 'session:p1:s1',
			sessionId: 's1',
			lock: 'anyink-session:p1:s1',
		});
		expect(record).toMatchObject({
			id: 'p1',
			key: 'session:p1:s1',
			sessionId: 's1',
			lock: 'anyink-session:p1:s1',
			name: 'Test Font',
			time: 1000,
			dirty: true,
			hasFile: true,
			fileHandle: handle,
		});
		expect(record.project.glyphs).toEqual({ 'glyph-0x41': {} });
		expect(record.assets).toEqual({ 'img-a': { type: 'image/png', blob } });
		expect(record.history).toEqual({ version: 3, queue: [], redoQueue: [] });
	});

	it('omits the payload for a clean record and nulls a missing handle', () => {
		const editor = { project: fakeProject(), loadedFileHandle: false };
		const record = makeSessionRecord(editor, { dirty: false, time: 5, includeProject: false });
		expect(record.dirty).toBe(false);
		expect(record.hasFile).toBe(false);
		expect(record.fileHandle).toBeNull();
		expect(record).not.toHaveProperty('project');
		expect(record).not.toHaveProperty('assets');
		expect(record).not.toHaveProperty('history');
	});

	it('returns null without a project or a project id', () => {
		expect(makeSessionRecord({ project: null }, { dirty: true, time: 1 })).toBeNull();
		expect(
			makeSessionRecord({ project: { settings: { project: {} } } }, { dirty: true, time: 1 })
		).toBeNull();
	});

	it('falls back to Untitled and an empty asset map', () => {
		const project = fakeProject('p2', '');
		const record = makeSessionRecord({ project }, { dirty: true, time: 1 });
		expect(record.name).toBe('Untitled');
		expect(record.assets).toEqual({});
		expect(record.history).toBeNull();
	});
});

describe('describeSession', () => {
	it('drops the payload, keys the row by its store key and normalizes flags', () => {
		const record = { id: 'p1', name: 'X', time: 9, dirty: 1, hasFile: 0, project: {} };
		const view = describeSession(record, 'session:p1:s1');
		expect(view).toEqual({
			id: 'session:p1:s1',
			projectId: 'p1',
			name: 'X',
			time: 9,
			dirty: false,
			hasFile: false,
		});
		expect(describeSession({ id: 'p2', dirty: true })).toEqual({
			id: 'session:p2',
			projectId: 'p2',
			name: 'Untitled',
			time: 0,
			dirty: true,
			hasFile: false,
		});
	});
});

describe('time wording', () => {
	const now = 10 * 60000;
	it('counts whole minutes and never goes negative', () => {
		expect(minutesAgo(now, now)).toBe(0);
		expect(minutesAgo(now - 3 * 60000 - 500, now)).toBe(3);
		expect(minutesAgo(now + 60000, now)).toBe(0);
	});

	it('reads naturally from seconds to days', () => {
		expect(formatAgo(now - 30000, now)).toBe('less than a minute ago');
		expect(formatAgo(now - 60000, now)).toBe('1 minute ago');
		expect(formatAgo(now - 7 * 60000, now)).toBe('7 minutes ago');
		expect(formatAgo(now - 119 * 60000, now)).toBe('119 minutes ago');
		expect(formatAgo(now - 3 * 3600000, now)).toBe('3 hours ago');
		expect(formatAgo(now - 3 * 86400000, now)).toBe('3 days ago');
	});
});
