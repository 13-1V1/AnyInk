// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { isDirectoryHandle, isFileHandle, writeToHandle } from '../write_file.js';
import { fakeDirectoryHandle, fakeFileHandle } from './fakes.js';

describe('write_file: handle detection', () => {
	it('tells file handles, directory handles and junk apart', () => {
		expect(isFileHandle(fakeFileHandle('a.gs2'))).toBe(true);
		expect(isFileHandle({ createWritable() {} })).toBe(true);
		expect(isFileHandle(fakeDirectoryHandle('out'))).toBe(false);
		expect(isFileHandle(false)).toBe(false);
		expect(isFileHandle(null)).toBe(false);
		expect(isFileHandle('a.gs2')).toBe(false);
		expect(isDirectoryHandle(fakeDirectoryHandle('out'))).toBe(true);
		expect(isDirectoryHandle(fakeFileHandle('a.gs2'))).toBe(false);
	});
});

describe('write_file: writeToHandle', () => {
	it('writes with an exclusive lock and closes', async () => {
		const handle = fakeFileHandle('a.gs2');
		const result = await writeToHandle(handle, 'hello');
		expect(result).toEqual({ exclusive: true });
		expect(handle.options).toEqual([{ mode: 'exclusive' }]);
		expect(handle.written).toBe('hello');
	});

	it('retries without the mode option when the browser rejects it (TypeError)', async () => {
		const handle = fakeFileHandle('a.gs2', { rejectExclusive: true });
		const result = await writeToHandle(handle, 'hello');
		expect(result).toEqual({ exclusive: false });
		expect(handle.calls.createWritable).toBe(2);
		expect(handle.options).toEqual([{ mode: 'exclusive' }, undefined]);
		expect(handle.written).toBe('hello');
	});

	it('does not retry for other createWritable errors', async () => {
		const handle = fakeFileHandle('a.gs2');
		const locked = new Error('locked');
		locked.name = 'NoModificationAllowedError';
		handle.createWritable = async () => {
			throw locked;
		};
		await expect(writeToHandle(handle, 'x')).rejects.toBe(locked);
	});

	it('aborts the writable and rethrows when write() fails', async () => {
		const failure = new Error('disk full');
		const handle = fakeFileHandle('a.gs2', { writeError: failure });
		await expect(writeToHandle(handle, 'x')).rejects.toBe(failure);
		expect(handle.calls.abort).toBe(1);
		expect(handle.written).toBeUndefined();
	});

	it('rejects for anything that is not a file handle', async () => {
		await expect(writeToHandle(null, 'x')).rejects.toBeInstanceOf(TypeError);
		await expect(writeToHandle(fakeDirectoryHandle('d'), 'x')).rejects.toBeInstanceOf(TypeError);
	});
});
