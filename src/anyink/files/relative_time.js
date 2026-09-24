// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK relative time label ("just now", "3 hours ago") for the recents card.
	Pure function; pass `now` for deterministic tests.
*/

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * @param {Number} then - epoch milliseconds
 * @param {Number} [now] - epoch milliseconds, default Date.now()
 * @returns {String}
 */
export function formatRelativeTime(then, now = Date.now()) {
	if (!Number.isFinite(then)) return '';
	const seconds = Math.max(0, Math.round((now - then) / 1000));
	if (seconds < 45) return 'just now';
	const minutes = Math.round(seconds / MINUTE);
	if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
	const hours = Math.round(seconds / HOUR);
	if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	const days = Math.round(seconds / DAY);
	if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
	return new Date(then).toLocaleDateString();
}
