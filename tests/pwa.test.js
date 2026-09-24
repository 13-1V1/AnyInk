// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, it, expect, vi } from 'vitest';
import { checkpoint, makeSafeReload } from '../src/anyink/pwa/checkpoint.js';

function fixture() {
	const editors = [{ history: {} }, { history: {} }];
	const status = { started: true, generation: 1, sessions: [{ key: 'a' }, { key: 'b' }] };
	const snapshot = vi.fn().mockResolvedValue(true);
	const deps = { getEditors: () => editors, getStatus: () => structuredClone(status), snapshot };
	return { editors, status, snapshot, deps };
}

describe('PWA recovery gate', () => {
	it('awaits every editor snapshot before activation and reload', async () => {
		const f = fixture();
		let finish;
		f.snapshot.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const activate = vi.fn();
		const reload = vi.fn();
		const update = makeSafeReload({ protect: () => checkpoint(f.deps), activate, reload });
		const pending = update();
		expect(activate).not.toHaveBeenCalled();
		expect(reload).not.toHaveBeenCalled();
		expect(await update()).toBe(false);
		finish(true);
		await pending;
		expect(f.snapshot.mock.calls).toEqual([
			['manual', f.editors[0]],
			['manual', f.editors[1]],
		]);
		expect(activate).toHaveBeenCalledOnce();
		expect(reload).toHaveBeenCalledOnce();
	});
	it.each([false, 'reject'])(
		'refuses update on a failed snapshot (%s), then allows retry',
		async (failure) => {
			const f = fixture();
			if (failure === false) f.snapshot.mockResolvedValueOnce(false);
			else f.snapshot.mockRejectedValueOnce(new Error('Quota exceeded'));
			const activate = vi.fn();
			const reload = vi.fn();
			const update = makeSafeReload({ protect: () => checkpoint(f.deps), activate, reload });
			await expect(update()).rejects.toThrow();
			expect(activate).not.toHaveBeenCalled();
			expect(reload).not.toHaveBeenCalled();
			await update();
			expect(reload).toHaveBeenCalledOnce();
		}
	);
	it('refuses when recovery has not started', async () => {
		const f = fixture();
		f.status.started = false;
		await expect(checkpoint(f.deps)).rejects.toThrow('starting');
	});
	it('refuses during undo or redo', async () => {
		const f = fixture();
		f.editors[1].history.isRestoring = true;
		await expect(checkpoint(f.deps)).rejects.toThrow('undo or redo');
	});
	it.each(['edit', 'replace', 'session'])(
		'refuses a concurrent %s while snapshotting',
		async (change) => {
			const f = fixture();
			f.snapshot.mockImplementationOnce(async () => {
				if (change === 'edit') f.status.generation++;
				if (change === 'replace') f.editors[0] = { history: {} };
				if (change === 'session') f.status.sessions[0].key = 'new-session';
				return true;
			});
			await expect(checkpoint(f.deps)).rejects.toThrow('changed');
		}
	);
	it('checks again after activation has finished', async () => {
		const f = fixture();
		const reload = vi.fn();
		const update = makeSafeReload({
			protect: () => checkpoint(f.deps),
			activate: async () => {
				f.status.generation++;
			},
			reload,
		});
		await expect(update()).rejects.toThrow('changed');
		expect(reload).not.toHaveBeenCalled();
	});
	it('does not reload when activation refuses another open window', async () => {
		const f = fixture();
		const reload = vi.fn();
		const update = makeSafeReload({
			protect: () => checkpoint(f.deps),
			activate: async () => {
				throw new Error('Other window');
			},
			reload,
		});
		await expect(update()).rejects.toThrow('Other window');
		expect(reload).not.toHaveBeenCalled();
	});
});
