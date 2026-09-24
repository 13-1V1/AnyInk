// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { selectOrCreateExceptionGroup } from '../../anyink/kerning/exception_group.js';
import {
	dragValue,
	getDragZone,
	isClassGroup,
	isPointerInDragZone,
} from '../../anyink/kerning/kern_drag.js';
import { notifyKernPairsChanged } from '../../anyink/kerning/kern_lookup.js';
import { getRepresentatives, kernPairState } from '../../anyink/kerning/pair_state.js';
import { getCurrentProjectEditor } from '../../app/main.js';
import { kernGroupSideMaxWidth } from '../../project_editor/cross_item_actions.js';
import { setCursor } from '../cursors.js';
import { eventHandlerData } from '../events.js';

/**
	// ----------------------------------------------------------------
	// Kern - drags the right-hand group to set the kern value
	// ----------------------------------------------------------------
	ANY-INK (Milestone 5, audit B5, D-010):
	- a drag starts only when the pointer is on the right group's ink area or within a few
	  pixels of the x = value line; clicks elsewhere do nothing
	- the value is measured from the first pointer position and the starting value, so
	  rounding per tick never loses sub-unit motion; Shift snaps to 10
	- 'currentKernGroup' is published per tick; 'kernPairs' (lookup invalidated, real-font
	  rebuild) and one history entry land on release, the entry only when the value changed
	- Alt-drag on a class group creates (or reuses) a one-by-one exception for the pair the
	  view is showing, selects it, and drags that instead
 */
export class Tool_Kern {
	constructor() {
		this.dragging = false;
		this.firstX = 0;
		this.startValue = 0;
		this.groupID = false;
	}

	/**
	 * Drag zone for the selected group in canvas terms.
	 * @param {Object} editor
	 * @param {Object} kernGroup
	 * @returns {Boolean} pointer is over the zone
	 */
	isOverDragZone(editor, kernGroup) {
		const font = editor.project.settings.font;
		const zone = getDragZone(kernGroup, {
			rightWidth: kernGroupSideMaxWidth(kernGroup.rightGroup) || editor.project.defaultAdvanceWidth,
			ascent: Number(font.ascent) || 0,
			descent: Number(font.descent) || 0,
		});
		return isPointerInDragZone(eventHandlerData.mousePosition, editor.view, zone);
	}

	mousedown(event) {
		// log('Tool_Kern - mouse down');
		const editor = getCurrentProjectEditor();
		let kernGroup = editor.selectedKernGroup;
		if (!kernGroup) return;
		if (!this.isOverDragZone(editor, kernGroup)) return;

		const altHeld = !!(event?.altKey || eventHandlerData.isAltDown);
		if (altHeld && isClassGroup(kernGroup)) {
			const exception = selectOrCreateExceptionGroup(editor, kernGroup, getRepresentatives(kernGroup));
			if (!exception) return;
			kernGroup = exception;
		}

		this.dragging = true;
		this.firstX = eventHandlerData.mousePosition.x;
		this.startValue = Number(kernGroup.value) || 0;
		this.groupID = kernGroup.id;
		kernPairState.dragging = true;
		kernPairState.hover = true;
		setCursor('ew-resize');
		redrawCanvas(editor, 'kern:dragStart');
	}

	mousemove(event) {
		const editor = getCurrentProjectEditor();
		const kernGroup = editor.selectedKernGroup;
		if (!kernGroup) return;

		if (this.dragging) {
			// Button released outside the canvas: finish the drag instead of sticking
			if (event && typeof event.buttons === 'number' && event.buttons === 0) {
				this.mouseup(event);
				return;
			}
			const snap = !!(event?.shiftKey || eventHandlerData.isShiftDown);
			const newValue = dragValue(
				this.startValue,
				this.firstX,
				eventHandlerData.mousePosition.x,
				editor.view.dz,
				snap
			);
			if (newValue !== kernGroup.value) {
				kernGroup.value = newValue;
				// Per tick: the narrow item topic only. The lookup reads the value live, so the
				// strip's canvas flavor follows; 'kernPairs' (which rebuilds the real font) waits
				// for release.
				editor.publish('currentKernGroup', kernGroup);
			}
			setCursor('ew-resize');
			return;
		}

		const over = this.isOverDragZone(editor, kernGroup);
		if (over !== kernPairState.hover) {
			kernPairState.hover = over;
			redrawCanvas(editor, 'kern:hover');
		}
		setCursor(over ? 'ew-resize' : 'default');
	}

	mouseup() {
		// log('Tool_Kern - Mouse Up');
		if (!this.dragging) return;
		const editor = getCurrentProjectEditor();
		const kernGroup = editor.selectedKernGroup;
		this.dragging = false;
		kernPairState.dragging = false;

		if (kernGroup && kernGroup.value !== this.startValue) {
			editor.history.addState('Kern group value: ' + kernGroup.value);
		}
		notifyKernPairsChanged(editor, {
			groupID: kernGroup ? kernGroup.id : this.groupID,
			value: kernGroup ? kernGroup.value : this.startValue,
		});
		this.groupID = false;
		redrawCanvas(editor, 'kern:dragEnd');
	}
}

function redrawCanvas(editor, caller) {
	if (editor.editCanvas && typeof editor.editCanvas.redraw === 'function') {
		editor.editCanvas.redraw(caller);
	}
}
