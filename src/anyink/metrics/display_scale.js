// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Tells the edit canvas when the display scale changes (B1 fix pass): the window moved to a
	screen with another Windows scale, or the browser zoom changed. The guide lines are drawn
	for the scale (guide_strength.js systemGuideStroke), so the canvas redraws right away.
*/

/**
 * Calls `callback` each time window.devicePixelRatio changes.
 * @param {Function} callback
 * @returns {Function} stops listening
 */
export function onDisplayScaleChange(callback) {
	if (typeof globalThis.matchMedia !== 'function') return () => {};
	let query;
	let stopped = false;
	const changed = () => {
		if (stopped) return;
		listen();
		callback();
	};
	const listen = () => {
		query = globalThis.matchMedia(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`);
		query.addEventListener?.('change', changed, { once: true });
	};
	listen();
	return () => {
		stopped = true;
		query?.removeEventListener?.('change', changed);
	};
}
