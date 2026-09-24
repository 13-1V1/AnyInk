// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it, vi } from 'vitest';
import { makeFrameCoalescer, makeTrailingDebounce } from '../scheduling.js';

/** A hand-cranked requestAnimationFrame. */
function fakeRaf() {
	const queue = [];
	const raf = (cb) => queue.push(cb);
	raf.tick = () => {
		const batch = queue.splice(0);
		batch.forEach((cb) => cb());
	};
	raf.pending = () => queue.length;
	return raf;
}

/** Hand-cranked timers. */
function fakeTimers() {
	let now = 0;
	let nextId = 1;
	const jobs = new Map();
	return {
		setTimeout: (fn, ms) => {
			const id = nextId++;
			jobs.set(id, { at: now + ms, fn });
			return id;
		},
		clearTimeout: (id) => jobs.delete(id),
		advance(ms) {
			now += ms;
			[...jobs.entries()]
				.filter(([, job]) => job.at <= now)
				.sort((a, b) => a[1].at - b[1].at)
				.forEach(([id, job]) => {
					jobs.delete(id);
					job.fn();
				});
		},
		count: () => jobs.size,
	};
}

describe('makeFrameCoalescer', () => {
	it('runs once per frame no matter how often it is asked', () => {
		const raf = fakeRaf();
		const fn = vi.fn();
		const schedule = makeFrameCoalescer(fn, raf);
		schedule();
		schedule();
		schedule();
		expect(fn).not.toHaveBeenCalled();
		expect(raf.pending()).toBe(1);
		expect(schedule.isPending()).toBe(true);
		raf.tick();
		expect(fn).toHaveBeenCalledTimes(1);
		expect(schedule.isPending()).toBe(false);
	});

	it('accepts new work after the frame ran', () => {
		const raf = fakeRaf();
		const fn = vi.fn();
		const schedule = makeFrameCoalescer(fn, raf);
		schedule();
		raf.tick();
		schedule();
		raf.tick();
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('lets fn reschedule itself for the next frame', () => {
		const raf = fakeRaf();
		let count = 0;
		const schedule = makeFrameCoalescer(() => {
			count++;
			if (count === 1) schedule();
		}, raf);
		schedule();
		raf.tick();
		expect(count).toBe(1);
		expect(raf.pending()).toBe(1);
		raf.tick();
		expect(count).toBe(2);
	});
});

describe('makeTrailingDebounce', () => {
	it('fires once, after the quiet period, with the last arguments', () => {
		const timers = fakeTimers();
		const fn = vi.fn();
		const debounced = makeTrailingDebounce(fn, 400, timers);
		debounced('a');
		timers.advance(200);
		debounced('b');
		timers.advance(200);
		debounced('c');
		expect(fn).not.toHaveBeenCalled();
		expect(debounced.isPending()).toBe(true);
		timers.advance(399);
		expect(fn).not.toHaveBeenCalled();
		timers.advance(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith('c');
		expect(debounced.isPending()).toBe(false);
		expect(timers.count()).toBe(0);
	});

	it('can be cancelled and flushed', () => {
		const timers = fakeTimers();
		const fn = vi.fn();
		const debounced = makeTrailingDebounce(fn, 400, timers);
		debounced(1);
		debounced.cancel();
		timers.advance(1000);
		expect(fn).not.toHaveBeenCalled();
		expect(timers.count()).toBe(0);

		debounced(2);
		debounced.flush();
		expect(fn).toHaveBeenCalledWith(2);
		debounced.flush(); // nothing pending: no second call
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('never fires more than once per quiet period during a steady drag', () => {
		const timers = fakeTimers();
		const fn = vi.fn();
		const debounced = makeTrailingDebounce(fn, 400, timers);
		for (let t = 0; t < 2000; t += 16) {
			debounced(t);
			timers.advance(16);
		}
		expect(fn).not.toHaveBeenCalled(); // a 2 s drag with 16 ms ticks: not one rebuild
		timers.advance(400);
		expect(fn).toHaveBeenCalledTimes(1); // one rebuild on release
	});
});
