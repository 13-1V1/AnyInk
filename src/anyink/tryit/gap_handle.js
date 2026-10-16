// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B12: the purple gap handle in Try it (UX-BEGINNER.md 4.6 Gap handle; 7.3). Point between two
	made letters on the sheet: a purple handle with the tooltip "drag to close or open this gap".
	A drag is live (the pair's one-pair rule moves on every tick, 'kernPairs' with dragging);
	release writes it as ONE whole-font step about no letter (itemID null), "moved small e and
	small n closer", so Undo never jumps pages; a toast says it with [Undo]. Double-click the
	handle: the gap fix goes (one step, an Undo toast). Simple makes one-pair rules only (a kern
	group with one left and one right letter, kern_lookup.js onePairGroupID); a drag back to what
	the pair had without its rule takes the rule away.
	B12 fix pass: the step marks the pair as Simple's gap fix (kern_lookup.js markGapFix), so
	"Gaps you fixed" lists his fixes only; a drag stops where the two letters' ink touches (the
	letter-spacing slider's floor: never closer than touching unless they already were); Undo
	and Redo wait while the handle is held (undo_hold.js), and a drag whose font was swapped
	under it anyway is dropped, never written on the new font; a step's before-copy always gets
	its after-copy, even when the change throws.

	  GAP_REACH_PX                         how far either side of a gap the pointer finds it
	  findGapAtPoint(data, x, y, font, { reach })
	                                       the gap under a point: { left, right, x, top, bottom,
	                                       dz } (charData from TextBlock.data, x the right
	                                       letter's left edge in CSS px), or false. Both letters
	                                       made (glyphs with ink), side by side on one line. Uses
	                                       preview/hit_test.js findCharAtPoint first, so a point
	                                       inside a letter only finds that letter's two gaps
	  beginGapDrag(editor, c1, c2)         { startValue, floor, set(value), finish(), cancel() }:
	                                       set is live (never below floor, where the ink
	                                       touches), finish restores and records the one step
	                                       (null when nothing changed or the font was swapped),
	                                       cancel puts it back
	  touchFloor(project, c1, c2, start)   the closest a pair may be dragged: where the two
	                                       letters' ink touches, read row by row (a letter tucks
	                                       under an overhang; the boxes when no row is shared),
	                                       or where it is now when closer
	  removeGapFix(editor, c1, c2)         the pair's rule taken away in one step; false when it
	                                       has none
	  attachGapHandle({ host, hoverTarget, getLayout, getEditor, onChange })
	                                       the handle on the sheet. host: the positioned element
	                                       the handle goes in; hoverTarget: where the pointer is
	                                       watched (default host); getLayout() -> { data, font,
	                                       canvas } or null (the strip's DisplayCanvas text
	                                       block); returns { element, detach(), hide() }
	  stripLayout(strip)                   that layout from the <preview-strip>
	  installGapHandle(controller)         while Try it is open (expand.js makeTryIt's
	                                       'anyink-try-it-change'), the handle lives in its 'sheet'
	                                       slot and watches the strip's sheet; it hides when the
	                                       letters are redrawn under it ('anyink-strip-redraw');
	                                       returns an uninstall function. Simple only, since Try
	                                       it opens only there.
*/
import { KernGroup } from '../../project_data/kern_group.js';
import { dragValue } from '../kerning/kern_drag.js';
import {
	kernOffsetFor,
	kernOffsetWithout,
	markGapFix,
	notifyKernPairsChanged,
	onePairGroupID,
	toKernHex,
} from '../kerning/kern_lookup.js';
import { hasInk } from '../board/letter_set.js';
import { undoOffer } from '../history/undo_toast.js';
import { findCharAtPoint } from '../preview/hit_test.js';
import { inkBounds, rowExtent } from '../spacing/measure.js';
import { itemContours } from '../spacing/outline.js';
import { injectStyleOnce } from '../preview/inject_style.js';
import { toast } from '../toast/toast.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { holdUndoKeys } from './undo_hold.js';

export const GAP_REACH_PX = 6;
/** expand.js TRY_IT_CHANGE_EVENT and preview_strip.js's redraw event (not imported: they may
 * import this file) */
export const TRY_IT_CHANGE = 'anyink-try-it-change';
export const STRIP_REDRAW = 'anyink-strip-redraw';
const STYLE_ID = 'anyink-gap-handle-style';
const STYLE = `
.anyink-gap-handle {
	position: absolute;
	width: 6px;
	margin-left: -3px;
	border-radius: 3px;
	background: var(--structure-deep);
	box-shadow: 0 0 0 2px var(--structure-soft);
	cursor: ew-resize;
	pointer-events: auto;
	touch-action: none;
	z-index: 2;
}
.anyink-gap-handle[hidden] { display: none; }
.anyink-gap-handle.is-dragging { background: var(--structure); }
`;

// --------------------------------------------------------------
// Where the gaps are
// --------------------------------------------------------------

/** A letter that can have a gap fix beside it: a made glyph showing on the sheet. */
function isMadeLetter(charData) {
	const item = charData?.item;
	if (!charData?.isVisible || !charData.view || !item) return false;
	if (typeof item.id !== 'string' || !item.id.startsWith('glyph-')) return false;
	return hasInk(item);
}

/**
 * @param {Array<Array<Object>>} data - TextBlock.data
 * @param {Number} x - CSS px from the canvas left edge
 * @param {Number} y - CSS px from the canvas top edge
 * @param {{ascent: Number|String, descent: Number|String}} font
 * @param {{reach?: Number}} [options]
 * @returns {{left: Object, right: Object, x: Number, top: Number, bottom: Number, dz: Number} | false}
 */
export function findGapAtPoint(data, x, y, font, { reach = GAP_REACH_PX } = {}) {
	if (!Array.isArray(data) || !font) return false;
	const ascent = Number(font.ascent) || 0;
	const descent = Math.abs(Number(font.descent) || 0);
	const under = findCharAtPoint(data, x, y, font);
	let best = false;
	let bestDistance = Infinity;
	for (const block of data) {
		if (!Array.isArray(block)) continue;
		for (let i = 1; i < block.length; i++) {
			const left = block[i - 1];
			const right = block[i];
			if (under && under !== left && under !== right) continue;
			if (!isMadeLetter(left) || !isMadeLetter(right)) continue;
			if (left.lineNumber !== right.lineNumber) continue;
			const dz = Number(right.view.dz) || 0;
			const gapX = right.view.dx;
			const leftEnd = left.view.dx + (Number(left.widths?.advance) || 0) * left.view.dz;
			const low = Math.min(gapX, leftEnd);
			const high = Math.max(gapX, leftEnd);
			if (x < low - reach || x > high + reach) continue;
			const top = right.view.dy - ascent * dz;
			const bottom = right.view.dy + descent * dz;
			if (y < top || y > bottom) continue;
			const distance = x >= low && x <= high ? 0 : Math.min(Math.abs(x - low), Math.abs(x - high));
			if (distance < bestDistance) {
				bestDistance = distance;
				best = { left, right, x: gapX, top, bottom, dz };
			}
		}
	}
	return best;
}

// --------------------------------------------------------------
// Writing gap fixes
// --------------------------------------------------------------

/** @returns {String} 'small e' for '0x65' */
function nameOfHex(hex) {
	const code = parseInt(String(hex).replace(/^0x/i, ''), 16);
	const phrase = Number.isFinite(code) ? letterPhrase(String.fromCodePoint(code)) : '';
	return phrase || word('history.thisLetter');
}

function namesOf(left, right) {
	return { left: nameOfHex(left), right: nameOfHex(right) };
}

/**
 * The closest a gap drag may bring two letters: where their ink touches (the space right of
 * the left letter's ink plus the space left of the right letter's), as the letter-spacing
 * slider stops at touching; a pair already closer than that keeps where it is.
 * @param {Object} project
 * @param {String} c1 - left letter (char or hex)
 * @param {String} c2 - right letter
 * @param {Number} [startValue] - the pair's gap value when the drag began
 * @returns {Number} font units (-Infinity when either letter has no ink)
 */
export function touchFloor(project, c1, c2, startValue = 0) {
	const leftItem = project?.glyphs?.[`glyph-${toKernHex(c1)}`];
	const rightItem = project?.glyphs?.[`glyph-${toKernHex(c2)}`];
	const leftInk = leftItem ? inkBounds(leftItem) : null;
	const rightInk = rightItem ? inkBounds(rightItem) : null;
	if (!leftInk || !rightInk) return -Infinity;
	const advance = Number(leftItem.advanceWidth) || 0;
	const space = closestRowSpace(leftItem, rightItem, leftInk, rightInk, advance) ??
		advance - leftInk.xMax + rightInk.xMin;
	const touching = Math.ceil(-space) || 0;
	return Math.min(Math.round(Number(startValue) || 0), touching);
}

/** rows read across the height two letters share, for touchFloor */
const FLOOR_ROWS = 512;

/**
 * The narrowest space between two letters set side by side (no gap fix), read row by row over
 * the height where both have ink, so a letter can tuck under an overhang (To, Ty, Wa, Yo).
 * @returns {Number | null} font units; null when no row has ink in both
 */
function closestRowSpace(leftItem, rightItem, leftInk, rightInk, advance) {
	const low = Math.max(leftInk.yMin, rightInk.yMin);
	const high = Math.min(leftInk.yMax, rightInk.yMax);
	if (!(high > low)) return null;
	const a = itemContours(leftItem);
	const b = itemContours(rightItem);
	const step = (high - low) / FLOOR_ROWS;
	let closest = null;
	for (let row = 0; row <= FLOOR_ROWS; row++) {
		// a hair inside the shared band, so a row never lands exactly on a flat edge
		const y = Math.min(high - 1e-6, Math.max(low + 1e-6, low + row * step));
		const left = rowExtent(a, y);
		const right = rowExtent(b, y);
		if (!left || !right) continue;
		const space = advance - left.right + right.left;
		if (closest === null || space < closest) closest = space;
	}
	return closest;
}

/**
 * Never closer than touching (floor) or the left letter's whole width, never further than the
 * letter box.
 */
function clampGap(project, leftHex, value, floor = -Infinity) {
	const leftItem = project?.glyphs?.[`glyph-${leftHex}`];
	const min = Math.max(floor, -Math.max(0, Math.round(Number(leftItem?.advanceWidth) || 0)));
	const max = Math.max(1, Math.round(Number(project?.settings?.font?.upm) || 1000));
	const whole = Math.round(Number(value) || 0) || 0;
	return Math.min(max, Math.max(min, whole));
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} c1 - left letter (char or hex)
 * @param {String} c2 - right letter
 * @returns {{startValue: Number, set: Function, finish: Function, cancel: Function, left: String,
 *   right: String}}
 */
export function beginGapDrag(editor, c1, c2) {
	const project = editor.project;
	const left = toKernHex(c1);
	const right = toKernHex(c2);
	const ownID = onePairGroupID(project, left, right);
	const own = ownID ? project.kerning[ownID] : null;
	const original = own ? own.value : null;
	const startValue = kernOffsetFor(project, left, right);
	const base = kernOffsetWithout(project, left, right, ownID);
	const floor = touchFloor(project, left, right, startValue);
	let temp = null;
	let value = startValue;
	let done = false;

	const liveGroup = () => {
		if (own) return own;
		if (!temp) {
			temp = project.addItemByType(
				new KernGroup({ leftGroup: [left], rightGroup: [right], value: startValue }),
				'KernGroup'
			);
		}
		return temp;
	};
	const restore = () => {
		if (temp) delete project.kerning[temp.id];
		temp = null;
		if (own) own.value = original;
	};
	/** The font was swapped under the drag (a whole-font Undo): the drag is dropped. */
	const swapped = () => editor.project !== project;
	const drop = () => {
		done = true;
		restore();
		notifyKernPairsChanged(editor, { dragging: false });
	};

	return {
		left,
		right,
		startValue,
		floor,
		/** @returns {Number} the value it took (whole, held to the range) */
		set(next) {
			if (done) return value;
			if (swapped()) {
				drop();
				return value;
			}
			value = clampGap(project, left, next, floor);
			const group = liveGroup();
			group.value = value;
			notifyKernPairsChanged(editor, { groupID: group.id, value, dragging: true });
			return value;
		},
		/** @returns {Object | null} the step's result, null when nothing changed */
		finish() {
			if (done) return null;
			if (swapped()) {
				drop();
				return null;
			}
			done = true;
			restore();
			if (value === startValue) {
				notifyKernPairsChanged(editor, { dragging: false });
				return null;
			}
			return commitGap(editor, { left, right, value, startValue, base, ownID });
		},
		cancel() {
			if (done) return;
			done = true;
			restore();
			notifyKernPairsChanged(editor, { dragging: false });
		},
	};
}

/** One whole-font step about no letter. */
function commitGap(editor, { left, right, value, startValue, base, ownID }) {
	const project = editor.project;
	const closer = value < startValue;
	const names = namesOf(left, right);
	editor.history.addWholeProjectChangePreState(
		word(closer ? 'history.gapCloser' : 'history.gapApart', names),
		{ itemID: null }
	);
	let groupID = ownID;
	let removed = false;
	try {
		if (value === base) {
			if (ownID) deleteGroup(editor, ownID);
			removed = !!ownID;
			groupID = '';
		} else if (ownID) {
			project.kerning[ownID].value = value;
		} else {
			groupID = project.addItemByType(
				new KernGroup({ leftGroup: [left], rightGroup: [right], value }),
				'KernGroup'
			).id;
		}
		markGapFix(project, left, right, value !== base);
	} finally {
		// the before-copy always gets its after-copy
		editor.history.addWholeProjectChangePostState();
	}
	notifyKernPairsChanged(editor, { groupID, value, dragging: false });
	toast(closer ? 'tryitGaps.toast.closer' : 'tryitGaps.toast.apart', names, {
		kind: 'info',
		...undoOffer(editor),
	});
	return { groupID, value, closer, removed, left, right };
}

function deleteGroup(editor, groupID) {
	delete editor.project.kerning[groupID];
	// the Kerning page (More tools) picks its first group again
	if (editor._selectedKernGroupID === groupID) editor._selectedKernGroupID = false;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {String} c1 - left letter (char or hex)
 * @param {String} c2 - right letter
 * @returns {Boolean} true when a gap fix was taken away
 */
export function removeGapFix(editor, c1, c2) {
	const project = editor?.project;
	const left = toKernHex(c1);
	const right = toKernHex(c2);
	const ownID = onePairGroupID(project, left, right);
	if (!ownID) return false;
	const names = namesOf(left, right);
	editor.history.addWholeProjectChangePreState(word('history.gapFixRemovedPair', names), {
		itemID: null,
	});
	try {
		deleteGroup(editor, ownID);
		markGapFix(project, left, right, false);
	} finally {
		editor.history.addWholeProjectChangePostState();
	}
	notifyKernPairsChanged(editor, { groupID: ownID, removed: true, dragging: false });
	toast('tryitGaps.toast.removed', names, { kind: 'destructive', ...undoOffer(editor) });
	return true;
}

// --------------------------------------------------------------
// The handle on the sheet
// --------------------------------------------------------------

/**
 * @param {Object} options
 * @param {HTMLElement} options.host - positioned element the handle goes in
 * @param {HTMLElement} [options.hoverTarget] - where the pointer is watched (default host)
 * @param {() => ({data: Array, font: Object, canvas: HTMLElement} | null)} options.getLayout
 * @param {() => Object} options.getEditor
 * @param {(result: Object | null) => void} [options.onChange] - after a fix is written or removed
 * @returns {{element: HTMLElement, detach: Function, hide: Function}}
 */
export function attachGapHandle({
	host,
	hoverTarget = host,
	getLayout,
	getEditor,
	onChange = () => {},
}) {
	injectStyleOnce(STYLE_ID, STYLE, host.ownerDocument);
	const handle = host.ownerDocument.createElement('div');
	handle.className = 'anyink-gap-handle';
	handle.hidden = true;
	handle.setAttribute('role', 'button');
	handle.title = word('tryitGaps.handle.tip');
	host.appendChild(handle);

	let gap = null;
	let drag = null;

	const offset = (canvas) => {
		const hostRect = host.getBoundingClientRect();
		const canvasRect = canvas.getBoundingClientRect();
		return { x: canvasRect.left - hostRect.left, y: canvasRect.top - hostRect.top, canvasRect };
	};
	const hide = () => {
		if (drag) return;
		gap = null;
		handle.hidden = true;
	};
	const place = (x) => {
		handle.style.left = `${x + gap.offsetX}px`;
	};
	const show = (found, canvas) => {
		const { x, y } = offset(canvas);
		gap = { ...found, offsetX: x };
		place(found.x);
		handle.style.top = `${found.top + y}px`;
		handle.style.height = `${Math.max(8, found.bottom - found.top)}px`;
		handle.setAttribute(
			'aria-label',
			word('tryitGaps.handle.label', namesOf(toKernHex(found.left.char), toKernHex(found.right.char)))
		);
		handle.hidden = false;
	};

	const onHover = (event) => {
		if (drag) return;
		const layout = getLayout();
		if (!layout?.canvas || !layout.data) return hide();
		const { canvasRect } = offset(layout.canvas);
		const found = findGapAtPoint(
			layout.data,
			event.clientX - canvasRect.left,
			event.clientY - canvasRect.top,
			layout.font
		);
		if (found) show(found, layout.canvas);
		else hide();
	};
	const onDown = (event) => {
		const editor = getEditor();
		if (!gap || !editor || (event.button ?? 0) !== 0) return;
		event.preventDefault();
		event.stopPropagation();
		try {
			handle.setPointerCapture?.(event.pointerId);
		} catch {
			// a synthetic pointer has nothing to capture
		}
		drag = {
			session: beginGapDrag(editor, gap.left.char, gap.right.char),
			release: holdUndoKeys({ win: host.ownerDocument.defaultView || globalThis }),
			firstX: event.clientX,
			startX: gap.x,
			dz: gap.dz,
		};
		handle.classList.add('is-dragging');
	};
	const onDragMove = (event) => {
		if (!drag) return;
		event.stopPropagation();
		const { session, firstX, startX, dz } = drag;
		const value = session.set(dragValue(session.startValue, firstX, event.clientX, dz));
		place(startX + (value - session.startValue) * dz);
	};
	const endDrag = (event, cancel = false) => {
		if (!drag) return;
		event?.stopPropagation?.();
		const { session, firstX, dz, release } = drag;
		drag = null;
		release();
		handle.classList.remove('is-dragging');
		if (cancel) {
			session.cancel();
			return hide();
		}
		if (event && Number.isFinite(event.clientX)) {
			session.set(dragValue(session.startValue, firstX, event.clientX, dz));
		}
		const result = session.finish();
		if (result) onChange(result);
	};
	const onDoubleClick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		const editor = getEditor();
		if (!gap || !editor) return;
		if (removeGapFix(editor, gap.left.char, gap.right.char)) onChange({ removed: true });
	};

	hoverTarget.addEventListener('pointermove', onHover);
	hoverTarget.addEventListener('pointerleave', hide);
	handle.addEventListener('pointerdown', onDown);
	handle.addEventListener('pointermove', onDragMove);
	handle.addEventListener('pointerup', (event) => endDrag(event));
	handle.addEventListener('pointercancel', (event) => endDrag(event, true));
	handle.addEventListener('lostpointercapture', () => endDrag(null));
	handle.addEventListener('dblclick', onDoubleClick);

	return {
		element: handle,
		hide,
		detach() {
			if (drag) endDrag(null, true);
			hoverTarget.removeEventListener('pointermove', onHover);
			hoverTarget.removeEventListener('pointerleave', hide);
			handle.remove();
		},
	};
}

/**
 * The strip's letters as hit_test.js reads them, or null when it shows no canvas letters.
 * @param {Object} strip - <preview-strip>
 * @returns {{data: Array, font: Object, canvas: HTMLElement} | null}
 */
export function stripLayout(strip) {
	const renderer = strip?.renderer;
	const block = renderer?.textBlock;
	if (!block?.data || !renderer.canvas) return null;
	return { data: block.data, font: block.project?.settings?.font, canvas: renderer.canvas };
}

/**
 * @param {{slots: Object<String, HTMLElement>, strip: Object}} controller - expand.js makeTryIt
 * @param {{win?: Window}} [options]
 * @returns {Function} uninstall
 */
export function installGapHandle(controller, { win = globalThis } = {}) {
	const strip = controller?.strip;
	let attached = null;
	const hideOnRedraw = () => attached?.hide();
	const off = () => {
		attached?.detach();
		attached = null;
		strip?.removeEventListener?.(STRIP_REDRAW, hideOnRedraw);
	};
	const onChange = (event) => {
		const host = controller?.slots?.sheet;
		if (!event?.detail?.open || !host || !strip) return off();
		if (attached) return;
		attached = attachGapHandle({
			host,
			hoverTarget: strip.canvasWrapper || host,
			getLayout: () => stripLayout(strip),
			getEditor: () => strip.editor,
		});
		strip.addEventListener?.(STRIP_REDRAW, hideOnRedraw);
	};
	win.addEventListener?.(TRY_IT_CHANGE, onChange);
	return () => {
		win.removeEventListener?.(TRY_IT_CHANGE, onChange);
		off();
	};
}
