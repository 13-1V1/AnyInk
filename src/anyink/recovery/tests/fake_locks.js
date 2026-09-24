// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper: a stand-in for navigator.locks (jsdom has no Web Locks API),
	shared by the recovery tests. It behaves like Chromium for exclusive locks:
	a request for a free name is granted at once, a request for a held name
	queues until the holder lets go, and query() reports held and pending
	requests. hold(name) simulates another tab holding a lock; call the returned
	function to "close" that tab.
*/

/** @returns {{requests: Array, held: Map, request: Function, query: Function, hold: Function}} */
export function fakeLocks() {
	const held = new Map();
	const waiting = new Map(); // name -> [resolve, ...]
	const api = {
		requests: [],
		held,
		async request(name, options, callback) {
			const mode = options?.mode;
			api.requests.push({ name, mode });
			if (held.has(name)) {
				if (options?.ifAvailable) return callback(null);
				await new Promise((resolve) => {
					if (!waiting.has(name)) waiting.set(name, []);
					waiting.get(name).push(resolve);
				});
			}
			held.set(name, true);
			try {
				return await callback({ name, mode });
			} finally {
				held.delete(name);
				const next = waiting.get(name)?.shift();
				if (next) next();
			}
		},
		async query() {
			const pending = [];
			waiting.forEach((queue, name) => queue.forEach(() => pending.push({ name, mode: 'exclusive' })));
			return { held: [...held.keys()].map((name) => ({ name, mode: 'exclusive' })), pending };
		},
		/**
		 * Holds a lock the way another tab would.
		 * @param {String} name
		 * @returns {Function} releases it (the other tab closed or crashed)
		 */
		hold(name) {
			let release = () => {};
			const open = new Promise((resolve) => (release = resolve));
			api.request(name, { mode: 'exclusive' }, () => open);
			return release;
		},
	};
	return api;
}
