// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: the flow's state, one per editor, and what the photo screens read from it
	(docs/UX-BEGINNER.md 4.4). photo_flow.js is the way in; it re-exports everything here.

	  stateOf(editor)          { flow, photos, added, adding, memory, paperByHand, ticket,
	                           watching, reconciling }: the running flow (step C) or null, the
	                           photos' kept pixels (photo_flow_data.js), the photos addPhotoFile
	                           added since the last Use it (Cancel takes them out again), the
	                           photos still coming in (fingerprint -> Promise of the result), his
	                           Adjust settings per photo for this session, the photos whose paper
	                           he picked
	  emit(flow, editor)       after every change: publishes FLOW_TOPIC on the editor (the edit
	                           canvas redraws on it, the coach reads again) and calls the listeners
	  getFlow(editor) / onFlowChange(fn) / whenFlowSettled(editor) / photoPreviewShapes(item,
	  editor)                  the readers (photo_flow.js header, item 6)
	  FLOW_ERRORS, flowError(code), failure(code)   what a code says and the button that fixes it
	  addUnhook(fn)            a window listener a watched editor added (tests take them off)
	  currentEditor(), coded(code), resetPhotoFlowForTests()
*/
import { getCurrentProjectEditor } from '../../app/main.js';

/** The topic every flow change publishes (the canvas redraws, the coach reads again). */
export const FLOW_TOPIC = 'autoTrace';

/** What each code says, and the button that fixes it (7.7). */
export const FLOW_ERRORS = Object.freeze({
	heic: Object.freeze({ key: 'toast.photoHeic', button: 'photoFlow.button.chooseAnother' }),
	'wrong-type': Object.freeze({
		key: 'toast.photoWrongType',
		button: 'photoFlow.button.chooseAnother',
	}),
	damaged: Object.freeze({ key: 'toast.photoDamaged', button: 'photoFlow.button.chooseAnother' }),
	'too-big': Object.freeze({ key: 'toast.photoTooBig', button: 'photoFlow.button.chooseAnother' }),
	'no-decoder': Object.freeze({ key: 'toast.photoNoDecoder', button: null }),
	'read-failed': Object.freeze({
		key: 'photoFlow.readFailed',
		button: 'photoFlow.button.chooseAnother',
	}),
	'no-ink': Object.freeze({ key: 'photoFlow.noInk', button: 'photoFlow.button.drawBox' }),
	// finalize: a part with no letter's ink at all (ruled-line bits, a punch hole, specks only),
	// where more ink can't help, so the sentence names only the box
	'no-letter': Object.freeze({ key: 'photoFlow.noLetter', button: 'photoFlow.button.drawBox' }),
	'too-many': Object.freeze({ key: 'photoFlow.tooManySpecks', button: null }),
	'trace-failed': Object.freeze({
		key: 'photoFlow.traceFailed',
		button: 'photoFlow.button.drawBox',
	}),
	'not-applied': Object.freeze({ key: 'photoFlow.notApplied', button: null }),
});

/** Per editor: { flow, photos, added, adding, memory, paperByHand, ticket, watching, reconciling } */
let states = new WeakMap();
const listeners = new Set();
/** Window listeners each watched editor added (tests take them off again). */
const unhooks = new Set();

/** @param {Function} fn - takes one watch off again */
export function addUnhook(fn) {
	unhooks.add(fn);
}

// --------------------------------------------------------------
// Reading (photo_flow.js header, item 6)
// --------------------------------------------------------------

/**
 * @param {Object} [editor]
 * @returns {Object | null}
 */
export function getFlow(editor = currentEditor()) {
	if (!editor) return null;
	const flow = stateOf(editor).flow;
	return flow ? snapshotOf(flow) : null;
}

/**
 * @param {Function} fn - called with (flow or null, editor) after every change
 * @returns {Function} unsubscribe
 */
export function onFlowChange(fn) {
	if (typeof fn !== 'function') return () => {};
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/**
 * @param {Object} [editor]
 * @returns {Promise<Object | null>} the flow once it is not tracing (null when none runs)
 */
export function whenFlowSettled(editor = currentEditor()) {
	return new Promise((resolve) => {
		const check = () => {
			const flow = editor ? stateOf(editor).flow : null;
			if (flow && (flow.status === 'tracing' || flow.timer)) return false;
			resolve(flow ? snapshotOf(flow) : null);
			return true;
		};
		if (check()) return;
		const off = onFlowChange(() => {
			if (check()) off();
		});
	});
}

/**
 * @param {Object} item - the letter on the canvas
 * @param {Object} [editor] - the canvas's editor
 * @returns {Array<Object> | null} the traced shapes of step C over the photo, or null
 */
export function photoPreviewShapes(item, editor = currentEditor()) {
	if (!item || !editor) return null;
	const flow = stateOf(editor).flow;
	if (!flow || flow.itemId !== item.id || flow.project !== editor.project) return null;
	if (flow.status !== 'ready' && flow.status !== 'tracing') return null;
	const shapes = flow.result?.shapes;
	return Array.isArray(shapes) && shapes.length ? shapes : null;
}

/**
 * @param {String} code
 * @returns {{code: String, key: String, button: String | null}}
 */
export function flowError(code) {
	const known = FLOW_ERRORS[code] ? code : 'not-applied';
	return Object.freeze({ code: known, ...FLOW_ERRORS[known] });
}

export function failure(code) {
	return { ok: false, ...flowError(code) };
}

/** A flow with nothing to note (photo_flow_notes.js stepNotes). */
const NO_NOTES = Object.freeze([]);

export function snapshotOf(flow) {
	const item = flow.project.getItem(flow.itemId);
	return Object.freeze({
		itemId: flow.itemId,
		char: flow.char,
		asset: flow.asset,
		partId: flow.partId,
		status: flow.status,
		error: flow.error ? flowError(flow.error) : null,
		shapes: flow.result?.shapes?.length || 0,
		points: flow.result?.points || 0,
		replaces: Array.isArray(item?.shapes) ? item.shapes.length : 0,
		options: Object.freeze({
			...flow.options,
			autoThreshold: flow.autoThreshold,
			paperPicked: !flow.paperByHand,
		}),
		placed: flow.placed ? Object.freeze({ ...flow.placed }) : null,
		notes: flow.notes || NO_NOTES,
	});
}

export function emit(flow, editor = flow?.editor) {
	const snap = flow && stateOf(flow.editor).flow === flow ? snapshotOf(flow) : null;
	try {
		editor?.publish?.(FLOW_TOPIC, snap);
	} catch (error) {
		console.warn('ANY-INK photo: publishing the flow failed', error);
	}
	for (const fn of [...listeners]) {
		try {
			fn(snap, editor);
		} catch (error) {
			console.warn('ANY-INK photo: a flow listener failed', error);
		}
	}
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

export function stateOf(editor) {
	let s = states.get(editor);
	if (!s) {
		s = {
			flow: null,
			photos: new Map(),
			added: new Set(),
			adding: new Map(),
			memory: new Map(),
			paperByHand: new Set(),
			ticket: 0,
			watching: false,
			reconciling: false,
		};
		states.set(editor, s);
	}
	return s;
}

export function currentEditor() {
	try {
		return getCurrentProjectEditor();
	} catch {
		return null;
	}
}

export function coded(code) {
	return Object.assign(new Error(code), { code });
}

/** Tests: forget every flow, kept photo and listener. */
export function resetPhotoFlowForTests() {
	for (const fn of [...listeners]) listeners.delete(fn);
	for (const off of [...unhooks]) off();
	unhooks.clear();
	states = new WeakMap();
}
