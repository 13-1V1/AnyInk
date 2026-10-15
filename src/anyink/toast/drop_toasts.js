// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 fix track: what a drop on a letter says when it brings nothing in (UX-BEGINNER.md
	principle 6, never silently wrong; 7.7 plain messages). The canvas's drop handler
	(edit_canvas/events_drag_drop_paste.js) calls these; both toasts share the drop group
	(upstream_map.js DROP_GROUP), so the hint shown while the file was dragged over the letter
	gives way to them at once.

	  isWorkFile(file)        an ANY-INK work file (.gs2), by its name
	  sayWorkFileDropped()    Simple: "That's an ANY-INK work file. To open it, press Ctrl+O."
	                          (7.6: Ctrl+O opens a saved font in both modes); All tools keeps
	                          its drop hint, as before
	  sayDrawingEmpty()       Simple: "That drawing has no shapes ANY-INK can use." (a drawing
	                          with no shapes, or one that can't be read); All tools says
	                          nothing, as before
*/
import { DROP_HINT } from '../trace/paste_drop.js';
import { toast } from './toast.js';
import { DROP_GROUP } from './upstream_map.js';

/**
 * @param {File | {name?: String} | null} file
 * @returns {Boolean} true for an ANY-INK work file (.gs2)
 */
export function isWorkFile(file) {
	return /\.gs2$/i.test(String(file?.name || ''));
}

/** His own work file was dropped on a letter. */
export function sayWorkFileDropped() {
	toast('toast.dropWorkFile', {}, { group: DROP_GROUP, allTools: DROP_HINT });
}

/** A dropped drawing brought no shapes in. */
export function sayDrawingEmpty() {
	toast('toast.drawingEmpty', {}, { group: DROP_GROUP, allTools: false });
}
