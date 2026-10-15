// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Photos in Simple before B9's photo card (UX-BEGINNER.md principle 8, no doors to unbuilt
	rooms): Simple has no way to add, hide, remove or trace a photo until the 'photo' flag is on.
	So a new photo is turned away (trace_import.js, the toast track) and (B4 + B5 finalize) a photo
	already in the font, put there in More tools, isn't drawn in Simple (trace_draw.js): it never
	goes in the font file, and nothing on a Simple screen could take it off. All tools is as
	before. B9 turns 'photo' on and this gate opens by itself.

	  photosClosed()   true while Simple has no way to use a photo
*/
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';

/** @returns {Boolean} true while Simple has no way to use a photo (until B9's photo card) */
export function photosClosed() {
	return isSimpleMode() && !isFeatureOn('photo');
}
