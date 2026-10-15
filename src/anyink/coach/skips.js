// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: "Something else" on the Next line (UX-BEGINNER.md 4.0). It moves the coach to the next
	rule that matches and remembers the skip, per suggestion ("next letter: c", "this photo"),
	until the state behind it changes or the session ends. Skips live in memory only, never in
	the font.

	A suggestion is named by a key ('next:c', 'photo:<id>', 'save') and the state behind it by a
	stamp (a string: the letter is still empty, the photo still has 4 parts left, the save status
	is still "not saved"). A skip holds while the suggestion comes back with the same stamp; a
	new stamp means the state changed, so the suggestion shows again.

	B6 + B7 fix pass: the app hands the rules toObject(), so a stamp that changed was never seen
	here and a skip lasted the session. prune(live) ends every skip whose suggestion the state
	no longer holds, or holds with another stamp (rules.js liveSkips); coach_state.js runs it
	each time it works the line out. A skip that ended stays over when the state changes back.

	  isSkippedIn(skips, key, stamp)   pure, for rules.js: skips is { key: stamp }
	  makeSkips()                      the memory: { skip, isSkipped, prune, forget, clear,
	                                   toObject, size }
*/

/**
 * @param {Object<String, String> | null | undefined} skips - { key: stamp }
 * @param {String} key
 * @param {String} stamp
 * @returns {Boolean} true while that suggestion is skipped and its state hasn't changed
 */
export function isSkippedIn(skips, key, stamp) {
	if (!skips || typeof key !== 'string' || !key) return false;
	return Object.hasOwn(skips, key) && skips[key] === String(stamp ?? '');
}

/**
 * @returns {{skip: (key: String, stamp: String) => void, isSkipped: (key: String, stamp: String)
 *   => Boolean, prune: (live: Map<String, String>) => Array<String>, forget: (key: String) =>
 *   void, clear: () => void, toObject: () => Object<String, String>, size: () => Number}}
 */
export function makeSkips() {
	/** @type {Map<String, String>} */
	const skipped = new Map();
	return {
		skip(key, stamp) {
			if (typeof key !== 'string' || !key) return;
			skipped.set(key, String(stamp ?? ''));
		},
		isSkipped(key, stamp) {
			if (!skipped.has(key)) return false;
			if (skipped.get(key) === String(stamp ?? '')) return true;
			// the state behind it changed: the skip is over
			skipped.delete(key);
			return false;
		},
		/**
		 * Ends every skip whose suggestion is gone from live, or back with another stamp.
		 * @param {Map<String, String>} live - rules.js liveSkips(state)
		 * @returns {Array<String>} the keys whose skip ended
		 */
		prune(live) {
			const ended = [];
			skipped.forEach((stamp, key) => {
				if (live?.get?.(key) === stamp) return;
				skipped.delete(key);
				ended.push(key);
			});
			return ended;
		},
		forget(key) {
			skipped.delete(key);
		},
		clear() {
			skipped.clear();
		},
		toObject() {
			return Object.fromEntries(skipped);
		},
		size() {
			return skipped.size;
		},
	};
}
