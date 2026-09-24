// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../relative_time.js';

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);
const s = (n) => n * 1000;

describe('relative_time', () => {
	it('labels the recent past in plain words', () => {
		expect(formatRelativeTime(NOW, NOW)).toBe('just now');
		expect(formatRelativeTime(NOW - s(30), NOW)).toBe('just now');
		expect(formatRelativeTime(NOW - s(60), NOW)).toBe('1 minute ago');
		expect(formatRelativeTime(NOW - s(5 * 60), NOW)).toBe('5 minutes ago');
		expect(formatRelativeTime(NOW - s(60 * 60), NOW)).toBe('1 hour ago');
		expect(formatRelativeTime(NOW - s(3 * 60 * 60), NOW)).toBe('3 hours ago');
		expect(formatRelativeTime(NOW - s(24 * 60 * 60), NOW)).toBe('yesterday');
		expect(formatRelativeTime(NOW - s(3 * 24 * 60 * 60), NOW)).toBe('3 days ago');
	});

	it('falls back to a date after a week', () => {
		const then = NOW - s(10 * 24 * 60 * 60);
		expect(formatRelativeTime(then, NOW)).toBe(new Date(then).toLocaleDateString());
	});

	it('never goes negative and tolerates bad input', () => {
		expect(formatRelativeTime(NOW + s(500), NOW)).toBe('just now');
		expect(formatRelativeTime(undefined, NOW)).toBe('');
		expect(formatRelativeTime(NaN, NOW)).toBe('');
	});
});
