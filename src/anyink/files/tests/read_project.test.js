// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { readProjectFile, validateProjectText } from '../read_project.js';
import { fakeFileHandle, minimalProjectText } from './fakes.js';

describe('read_project: validateProjectText', () => {
	it('accepts a v2 project and hands back the parsed data', () => {
		const result = validateProjectText(minimalProjectText('Good'), '2.10.5');
		expect(result.message).toBeUndefined();
		expect(result.content.settings.project.name).toBe('Good');
	});

	it('accepts a v1 project at or above 1.13.2', () => {
		const v1 = JSON.stringify({ projectsettings: { versionnum: '1.13.2' } });
		expect(validateProjectText(v1, '2.10.5').content).toBeTruthy();
	});

	it('reports upstream error codes for bad files', () => {
		expect(validateProjectText('not json', '2.10.5').message).toContain('[PF0]');
		expect(validateProjectText('null', '2.10.5').message).toContain('[PF0]');
		expect(validateProjectText('{"glyphs":{}}', '2.10.5').message).toContain('[PF1]');
		expect(validateProjectText('{"settings":{"project":{}}}', '2.10.5').message).toContain(
			'[PF2]'
		);
		expect(
			validateProjectText('{"settings":{"project":{"latestVersion":"nope"}}}', '2.10.5').message
		).toContain('[PF3]');
		expect(validateProjectText(minimalProjectText('New', '3.0.0'), '2.10.5').message).toContain(
			'[PF4]'
		);
		const oldV1 = JSON.stringify({ projectsettings: { versionnum: '1.13.1' } });
		expect(validateProjectText(oldV1, '2.10.5').message).toContain('[PF5]');
	});

	it('uses the running app version by default', () => {
		expect(validateProjectText(minimalProjectText('Now')).content).toBeTruthy();
	});
});

describe('read_project: readProjectFile', () => {
	it('reads and validates through a file handle', async () => {
		const handle = fakeFileHandle('Good.gs2', { text: minimalProjectText('Good') });
		const result = await readProjectFile(handle);
		expect(result.status).toBe('ok');
		expect(result.fileName).toBe('Good.gs2');
		expect(result.content.settings.project.name).toBe('Good');
	});

	it("reports 'missing' when the file is gone", async () => {
		const handle = fakeFileHandle('Gone.gs2', { missing: true });
		const result = await readProjectFile(handle);
		expect(result.status).toBe('missing');
		expect(result.message).toContain('Gone.gs2');
	});

	it("reports 'invalid' for content that is not a project", async () => {
		const handle = fakeFileHandle('Nope.gs2', { text: '{"hello":1}' });
		const result = await readProjectFile(handle);
		expect(result.status).toBe('invalid');
		expect(result.message).toContain('[PF1]');
	});

	it("reports 'unreadable' for non-handles and read errors", async () => {
		expect((await readProjectFile(null)).status).toBe('unreadable');
		const handle = fakeFileHandle('Bad.gs2');
		handle.getFile = async () => {
			throw new Error('boom');
		};
		const result = await readProjectFile(handle);
		expect(result.status).toBe('unreadable');
		expect(result.message).toContain('boom');
	});
});
