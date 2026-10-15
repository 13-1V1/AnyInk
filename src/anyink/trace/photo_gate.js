// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Photos in Simple before B9's photo card (UX-BEGINNER.md principle 8, no doors to unbuilt
	rooms): Simple had no way to add, hide, remove or trace a photo until the 'photo' flag was on.
	So a new photo was turned away (trace_import.js, the toast track) and (B4 + B5 finalize) a
	photo already in the font, put there in More tools, wasn't drawn in Simple (trace_draw.js): it
	never goes in the font file, and nothing on a Simple screen could take it off. All tools is as
	before.

	B9, 10/15/2026: the photo card, the photo dialog and the photo flow (src/anyink/photo) landed
	and turned 'photo' on (mode/features.js), so the gate is open: Simple draws the photo under a
	letter and lets the photo flow trace it. The gate still reads the flag rather than answering
	"open" for good, so a "before B9" test that turns 'photo' off with setFeaturesForTests sees
	the drawing as it was.
	B8 + B9 integration: what only a closed gate said is gone (the "can't use photos yet" toast and
	the drawings-only drop and paste hints, with toast/upstream_map.js withoutPhoto and
	trace_import.js turnPhotoAway). A photo dropped or pasted on a letter in Simple goes to the
	photo flow instead of the Trace panel (4.3 "Drop a photo anywhere on this screen"): the photo
	screens register their route here, so the trace layer never imports them.

	  photosClosed()          true while Simple has no way to use a photo (the 'photo' flag is off)
	  setPhotoRoute(fn)       fn(file, { editor, item }) -> Promise<Boolean>: where Simple sends a
	                          dropped or pasted photo (photo/photo_app.js); null takes it off
	  photoRoute()            that route while Simple has photos on, else null (All tools keeps
	                          the Trace panel's own import)
*/
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';

/** @type {Function | null} */
let route = null;

/** @returns {Boolean} true while Simple has no way to use a photo (the 'photo' flag is off) */
export function photosClosed() {
	return isSimpleMode() && !isFeatureOn('photo');
}

/**
 * @param {Function | null} fn - (file, { editor, item }) => Promise<Boolean>
 * @returns {Function | null} the route it replaced
 */
export function setPhotoRoute(fn) {
	const previous = route;
	route = typeof fn === 'function' ? fn : null;
	return previous;
}

/** @returns {Function | null} */
export function photoRoute() {
	return isSimpleMode() && isFeatureOn('photo') ? route : null;
}
