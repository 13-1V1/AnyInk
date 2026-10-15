// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: the photo screens wired to the photo flow in the app (docs/UX-BEGINNER.md
	4.4, 4.5, 4.0 rules 2, 3, 11, 12, 7.7). The screens (how_card.js, photo_dialog.js,
	photo_card.js) hold no font state and the flow (photo_flow.js) draws nothing; this joins them,
	and plugs them into the B6 Next line and the B7 letter view. Simple only, with 'photo' on: every
	way in checks it, and All tools keeps its Trace panel.

	The ways in:
	  Next line rule 11 [How]       the How card (letter unknown); [I have my photo] opens the
	                                picker in the press, in Downloads the first time
	  Next line rule 12 [Do the next one]   the photo dialog on that photo, letter unknown
	  Menu > How to photograph your letters  the How card (topbar/doors.js HOW_CARD_EVENT)
	  the empty-letter overlay      [Use the same photo] (the dialog on the newest photo with parts
	                                not used yet, this letter known), [Use a photo] / [Choose
	                                another photo...] (step A), "No photo yet? How to take one"
	  the letter card               [Trace again] (letter_card.js TRACE_AGAIN_EVENT): the dialog on
	                                the letter's own photo, its part in the green box
	  a photo dropped or pasted on a letter   that letter's photo (4.3): trace/photo_gate.js
	                                setPhotoRoute, so trace_import.js sends it here
	What follows:
	  a picked photo                addPhotoFile; a problem says 7.7's words in Simple's error box,
	                                with its fix ([Choose another photo] opens the picker again);
	                                otherwise the photo dialog. A photo with one part, opened from
	                                a letter, goes straight to step C (4.4 step B) when that part
	                                can be the letter (photo_registry.js onlyPart: no edge scrap,
	                                no lone dot of the pen; B8 + B9 finalize)
	  the dialog's Trace it         startPart: the letter opens, the photo is placed and traced
	  the flow (onFlowChange)       step C in the photo card, made or updated, and closed when the
	                                flow ends (Use it, Cancel, another letter or page)
	  step C's buttons              Use it / Add to my shapes instead (useIt), Cancel (cancelPart),
	                                Draw a box (the dialog again, this letter known, on the part it
	                                had), Adjust (adjustPart), a failure's own fix
	  step A's buttons              Choose a photo... (the picker), a photo of the font (the dialog,
	                                this letter known), How to take one, Cancel
	  the dialog's Skip, Done and a box he drew   change the photo's record, so the work file is
	                                behind (recovery.js markDirty; none of them is an Undo step,
	                                7.3); Done also keeps a photo the card added
	  Cancel in the dialog          takes out a photo the screens added that no letter uses
	                                (cancelPart), unless step C is running behind it ("Wrong part?
	                                Draw a box" then Cancel leaves step C as it was)
	The coach: rule 12 reads the registry's own count (photoSummaries), only for photos whose image
	is in the font; the photo card and the dialog tell it their own facts.

	  initPhotos({ getEditor })     once, at boot (app/main.js)
	  openHow(editor, { char, itemId })
	  pickPhoto(editor, { char, itemId })   Promise<Boolean>: false when the picker was cancelled
	  takePhoto(file, { editor, char, itemId })   Promise<Boolean>
	  choosePart(editor, asset, { char, itemId, pick })   Promise<Boolean>
	  openPick(editor, { char, itemId })     step A for the open letter
	  useSamePhoto(editor)          the dialog on photo_doors.js samePhoto(editor), for the open
	                                letter
	  The overlay's buttons come in as photo_doors.js PHOTO_DOOR_EVENT ('samePhoto', 'pick',
	  'how'), and Fine-tune > Tail as letter_tail.js TAIL_EVENT, so the letter view never
	  imports this hub.
	  traceAgain(editor, itemId)
	  nextPart(editor, photoId)
	  photoSources(editor)          rule 12's photos
	  resetPhotoAppForTests()
	Subscriber id: 'anyink.photo.app.letter' (a substring of no other).
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { setPhotoPreview } from '../autotrace/preview_draw.js';
import { setCoachAction } from '../coach/actions.js';
import { setCoachSource } from '../coach/coach_state.js';
import { TRACE_AGAIN_EVENT } from '../letter/letter_card.js';
import { isFeatureOn } from '../mode/features.js';
import { MODE_EVENT, isSimpleMode } from '../mode/mode.js';
import { markDirty } from '../recovery/recovery.js';
import { dropStaleToasts, toast } from '../toast/toast.js';
import { HOW_CARD_EVENT } from '../topbar/doors.js';
import { setPhotoRoute } from '../trace/photo_gate.js';
import { BIG_IMAGE_BYTES, pickImageFile } from '../trace/trace_import.js';
import { getTrace } from '../trace/trace_model.js';
import { showWordsError } from '../words/error_box.js';
import { closeHowCard, openHowCard } from './how_card.js';
import {
	closePhotoCard,
	isPhotoCardOpen,
	openPhotoCard,
	photoCardState,
	updatePhotoCard,
} from './photo_card.js';
import { openPhotoDialog } from './photo_dialog.js';
import { flowError, getFlow, onFlowChange, photoPreviewShapes } from './photo_flow_state.js';
import { TAIL_EVENT } from './letter_tail.js';
import { PHOTO_DOOR_EVENT, samePhoto } from './photo_doors.js';
import { getPhoto, listPhotos, onlyPart, photoSummaries } from './photo_registry.js';

/** The picker's id for photos (Chrome remembers its folder) and where it starts (4.4). */
export const PHOTO_PICKER_ID = 'anyink-photo';
export const PHOTO_PICKER_START = 'downloads';

export const PHOTO_APP_SUBSCRIBER = 'anyink.photo.app.letter';

const PAGE_EVENT = 'anyink-page-change';

/**
 * photo_flow.js, loaded the first time it is needed: the app shell (and the test setup, which
 * imports the app shell) never loads the tracer and its pixel readers up front, so a test can
 * still put stand-ins in their place.
 * @returns {Promise<Object>} the module
 */
let flowLoading = null;
function flowModule() {
	flowLoading ||= import('./photo_flow.js');
	return flowLoading;
}

const state = {
	started: false,
	getEditor: getCurrentProjectEditor,
	/** the editors whose letter changes the app follows */
	followed: new WeakSet(),
	/** step A: { editor, char, itemId } while the card shows it */
	pick: null,
	unhooks: [],
};

// --------------------------------------------------------------
// Boot
// --------------------------------------------------------------

/**
 * @param {{getEditor?: () => Object}} [options]
 */
export function initPhotos({ getEditor = getCurrentProjectEditor } = {}) {
	if (state.started) return;
	state.started = true;
	state.getEditor = getEditor;
	setCoachAction('how', (_args, { editor }) => openHow(editor || current()));
	setCoachAction('nextPart', (args, { editor }) => nextPart(editor || current(), args?.photoId));
	setCoachSource('photos', photoSources);
	setPhotoRoute((file, { editor, item } = {}) =>
		takePhoto(file, { editor: editor || current(), ...letterOf(editor || current(), item) })
	);
	state.unhooks.push(onFlowChange(showFlow));
	// step C's green dashed outline on the edit canvas (autotrace/preview_draw.js)
	setPhotoPreview(photoPreviewShapes);
	listen(HOW_CARD_EVENT, () => openHow(current()));
	listen(TRACE_AGAIN_EVENT, (event) => traceAgain(current(), event?.detail?.itemId));
	listen(PHOTO_DOOR_EVENT, (event) => openDoor(current(), event?.detail));
	listen(TAIL_EVENT, (event) => seatTail(current(), event?.detail));
	listen(PAGE_EVENT, follow);
	listen(MODE_EVENT, follow);
	follow();
}

function listen(type, fn) {
	if (typeof globalThis.addEventListener !== 'function') return;
	globalThis.addEventListener(type, fn);
	state.unhooks.push(() => globalThis.removeEventListener(type, fn));
}

function current() {
	try {
		return state.getEditor() || null;
	} catch {
		return null;
	}
}

/** @returns {Boolean} the photo screens show: Simple with 'photo' on */
function screensOn() {
	return isSimpleMode() && isFeatureOn('photo');
}

/**
 * Follows the current editor: the flow watches it (Undo and Redo keep the registry right), and
 * step A closes when he goes to another letter, page or mode.
 */
function follow() {
	const editor = current();
	if (editor && screensOn()) {
		flowModule().then((flow) => flow.watchPhotos(editor));
		if (!state.followed.has(editor) && typeof editor.subscribe === 'function') {
			state.followed.add(editor);
			editor.subscribe({
				topic: 'whichGlyphIsSelected',
				subscriberID: PHOTO_APP_SUBSCRIBER,
				callback: () => closeStalePick(editor),
			});
		}
	}
	closeStalePick(editor);
}

/** Step A belongs to one letter on one screen: anywhere else it closes as Cancel does. */
function closeStalePick(editor) {
	const pick = state.pick;
	if (!pick || photoCardState()?.step !== 'pick') return;
	const away =
		!screensOn() ||
		editor !== pick.editor ||
		editor?.nav?.page !== 'Characters' ||
		editor?.selectedGlyphID !== pick.itemId;
	if (!away) return;
	state.pick = null;
	closePhotoCard();
	cancel(pick.editor);
}

/** photo_flow.js cancelPart: step C ends, photos the screens added that no letter uses go */
function cancel(editor) {
	return flowModule().then((flow) => flow.cancelPart(editor));
}

/**
 * @param {Object} [editor]
 * @returns {Array<{id: String, unused: Number, done: Boolean}>} rule 12's photos: the
 *   registry's own count, for photos whose image is in the font
 */
export function photoSources(editor) {
	const has = (id) => (typeof editor?.assets?.has === 'function' ? editor.assets.has(id) : true);
	return photoSummaries(editor?.project).filter((photo) => has(photo.id));
}

// --------------------------------------------------------------
// The How card and the picker
// --------------------------------------------------------------

/**
 * @param {Object} editor
 * @param {{char?: String, itemId?: String}} [context] - the letter, when opened from one
 * @returns {Object | null} the card
 */
export function openHow(editor, context = {}) {
	if (!editor || !screensOn()) return null;
	return openHowCard({ onHavePhoto: () => pickPhoto(editor, context) });
}

/**
 * The Windows picker, opened in the press (call it from a click). The picked photo goes on
 * without being waited for, so the How card closes as soon as he has picked one.
 * @param {Object} editor
 * @param {{char?: String, itemId?: String}} [context]
 * @returns {Promise<Boolean>} false when he cancelled the picker
 */
export function pickPhoto(editor, context = {}) {
	if (!editor || !screensOn()) return Promise.resolve(false);
	return pickImageFile({ id: PHOTO_PICKER_ID, startIn: PHOTO_PICKER_START }).then((file) => {
		if (!file) return false;
		takePhoto(file, { editor, ...context });
		return true;
	});
}

/**
 * A photo he picked or dropped: in the font, then the dialog (or step C).
 * @param {File | Blob} file
 * @param {{editor?: Object, char?: String, itemId?: String}} [options]
 * @returns {Promise<Boolean>} true when the photo is in and a screen opened for it
 */
export async function takePhoto(file, { editor = current(), char = '', itemId = '' } = {}) {
	if (!editor || !screensOn()) return false;
	const context = { char, itemId };
	// a big photo takes a moment to read: "Loading..." until it is in (or not)
	let loading = Number(file?.size) > BIG_IMAGE_BYTES;
	if (loading) {
		toast('toast.photoLoading', {}, { group: LOADING, ms: LOADING_MS, stillGood: () => loading });
	}
	let result;
	try {
		const flow = await flowModule();
		result = await flow.addPhotoFile(file, { editor });
	} finally {
		if (loading) {
			loading = false;
			dropStaleToasts();
		}
	}
	if (!result.ok) {
		sayProblem(editor, result, context);
		return false;
	}
	return choosePart(editor, result.asset, context);
}

/** The loading toast's group, and how long it may show at most (it goes once the photo is in) */
const LOADING = 'anyinkPhotoLoading';
const LOADING_MS = 60000;

/**
 * 7.7's words for a photo that can't be used, in Simple's error box with its fix.
 * @param {Object} editor
 * @param {{key: String, button: String | null}} error - photo_flow.js flowError
 * @param {Object} context
 */
function sayProblem(editor, error, context) {
	const buttons = error.button ? [error.button] : [];
	const actions = {};
	if (/\.chooseAnother$/.test(error.button || '')) {
		actions[error.button] = () => pickPhoto(editor, context);
	}
	showWordsError({ key: error.key, buttons }, actions);
}

// --------------------------------------------------------------
// The photo dialog (step B)
// --------------------------------------------------------------

/**
 * @param {Object} editor
 * @param {String} asset - the photo
 * @param {{char?: String, itemId?: String, pick?: String}} [context]
 * @returns {Promise<Boolean>}
 */
export async function choosePart(editor, asset, context = {}) {
	const record = getPhoto(editor?.project, asset);
	if (!record || !screensOn()) return false;
	const { char = '', pick } = context;
	// 4.4 step B: only a photo with exactly one part, opened from a letter, skips the dialog;
	// the one part this letter can be (photo_registry.js onlyPart: no edge scrap, no lone dot)
	const only = char && !pick ? onlyPart(record, { char }) : null;
	if (only) {
		const flow = await flowModule();
		await flow.startPart({ editor, asset, partId: only, char });
		return true;
	}
	return openDialogOn(editor, asset, context);
}

/**
 * @param {Object} editor
 * @param {String} asset
 * @param {{char?: String, itemId?: String, pick?: String}} context
 * @returns {Promise<Boolean>}
 */
async function openDialogOn(editor, asset, { char = '', itemId = '', pick } = {}) {
	const flow = await flowModule();
	const pixels = await flow.photoPixels(editor, asset);
	if (!pixels) {
		sayProblem(editor, flowError('read-failed'), { char, itemId });
		return false;
	}
	const view = openPhotoDialog({
		record: pixels.record,
		// the stored photo itself (the dialog decodes it); its pixels' mask for a box he drags
		image: pixels.blob || pixels.image,
		mask: pixels.mask,
		ink: pixels.ink,
		char,
		itemId,
		pick,
		onTrace: ({ partId, char: named }) => {
			flow.startPart({ editor, asset, partId, char: named || char });
		},
		onCancel: () => cancelledDialog(editor),
		onDone: () => {
			flow.keepAddedPhoto(editor, asset);
			changed(editor);
		},
		onChange: () => changed(editor),
	});
	return !!view;
}

/** Cancel in the dialog: step C behind it stays; otherwise photos the screens added go. */
async function cancelledDialog(editor) {
	if (getFlow(editor)) return;
	await cancel(editor);
	if (photoCardState()?.step === 'pick' && state.pick?.editor === editor) showPick(state.pick);
}

/** The photo's record changed with no Undo step (Skip, Done, a box he drew): the file is behind. */
function changed(editor) {
	try {
		markDirty(editor);
	} catch (error) {
		console.warn('ANY-INK photo: the change could not be marked', error);
	}
}

/**
 * @param {Object} editor
 * @param {String} photoId - the photo's asset id (rule 12's args)
 * @returns {Promise<Boolean>}
 */
export function nextPart(editor, photoId) {
	if (!editor || !getPhoto(editor.project, photoId)) return Promise.resolve(false);
	return openDialogOn(editor, photoId, {});
}

/**
 * [Trace again]: the dialog on the letter's own photo, its part in the green box. A letter whose
 * photo isn't in the font's photo list (put there in More tools) gets step A instead.
 * @param {Object} editor
 * @param {String} itemId
 * @returns {Promise<Boolean>}
 */
export function traceAgain(editor, itemId) {
	if (!editor || !screensOn()) return Promise.resolve(false);
	const id = itemId || editor.selectedGlyphID;
	const item = id ? editor.project?.getItem?.(id) : null;
	const { char } = letterOf(editor, item);
	const asset = getTrace(item)?.asset;
	if (!asset || !getPhoto(editor.project, asset) || !editor.assets?.has?.(asset)) {
		openPick(editor, { char, itemId: id });
		return Promise.resolve(true);
	}
	return openDialogOn(editor, asset, { char, itemId: id });
}

/**
 * The letter view's doors (photo_doors.js): the empty-letter overlay's buttons.
 * @param {Object} editor
 * @param {{door: String, char?: String, itemId?: String}} detail
 */
function openDoor(editor, detail = {}) {
	const context = { char: detail.char || '', itemId: detail.itemId || '' };
	if (detail.door === 'samePhoto') useSamePhoto(editor);
	else if (detail.door === 'pick') openPick(editor, context);
	else if (detail.door === 'how') openHow(editor, context);
}

/**
 * Fine-tune > Tail (letter_tail.js): the flow re-seats the letter in one step.
 * @param {Object} editor
 * @param {{itemId: String, tail: Boolean}} detail
 * @returns {Promise<Object | null>}
 */
async function seatTail(editor, { itemId, tail } = {}) {
	if (!editor || !screensOn() || typeof tail !== 'boolean') return null;
	const flow = await flowModule();
	const result = await flow.setLetterTail(editor, itemId, tail);
	if (!result.ok) toast(result.key);
	return result;
}

/**
 * [Use the same photo]: the dialog on samePhoto, for the open letter.
 * @param {Object} editor
 * @returns {Promise<Boolean>}
 */
export function useSamePhoto(editor) {
	const record = samePhoto(editor);
	if (!record || !screensOn()) return Promise.resolve(false);
	return openDialogOn(editor, record.asset, letterOf(editor));
}

// --------------------------------------------------------------
// The photo card: step A
// --------------------------------------------------------------

/**
 * @param {Object} editor
 * @param {{char?: String, itemId?: String}} [context] - default: the open letter
 * @returns {Object | null} the card
 */
export function openPick(editor, context = {}) {
	if (!editor || !screensOn()) return null;
	const letter = letterOf(editor);
	const pick = {
		editor,
		char: context.char || letter.char,
		itemId: context.itemId || letter.itemId,
	};
	state.pick = pick;
	return showPick(pick);
}

function showPick(pick) {
	const { editor, char, itemId } = pick;
	const context = { char, itemId };
	const photos = listPhotos(editor.project)
		.filter((record) => editor.assets?.has?.(record.asset))
		.map((record) => ({ asset: record.asset, image: editor.assets.get(record.asset).blob }));
	return openPhotoCard(
		{ step: 'pick', char, photos },
		{
			onChoose: () => pickPhoto(editor, context),
			onPickPhoto: (asset) => choosePart(editor, asset, context),
			onHow: () => openHow(editor, context),
			onCancel: () => {
				state.pick = null;
				closePhotoCard();
				cancel(editor);
			},
		}
	);
}

// --------------------------------------------------------------
// The photo card: step C
// --------------------------------------------------------------

/** Step C follows the flow: made or updated while it runs, closed when it ends. */
function showFlow(flow, editor) {
	if (editor && editor !== current()) return;
	if (!flow) {
		if (photoCardState()?.step === 'result') closePhotoCard();
		return;
	}
	if (!screensOn()) return;
	state.pick = null;
	const cardState = { step: 'result', ...flow };
	if (isPhotoCardOpen()) updatePhotoCard(cardState, resultHandlers(editor));
	else openPhotoCard(cardState, resultHandlers(editor));
}

function resultHandlers(editor) {
	return {
		onUseIt: () => use(editor, 'replace'),
		onAddInstead: () => use(editor, 'add'),
		onCancel: () => cancel(editor),
		onDrawBox: () => drawBox(editor),
		onAdjust: (changes) => flowModule().then((flow) => flow.adjustPart(editor, changes)),
		onFix: (error) => fix(editor, error),
	};
}

async function use(editor, mode) {
	const flow = await flowModule();
	const result = await flow.useIt(editor, { mode });
	if (!result.ok) toast(result.key);
	return result;
}

/** "Wrong part? [Draw a box]": the dialog again, this letter known, on the part it had. */
function drawBox(editor) {
	const flow = getFlow(editor);
	if (!flow) return Promise.resolve(false);
	return openDialogOn(editor, flow.asset, {
		char: flow.char,
		itemId: flow.itemId,
		pick: flow.partId,
	});
}

/** A failure's own fix: another photo (step A for this letter), or the box again. */
async function fix(editor, error) {
	const running = getFlow(editor);
	if (/\.chooseAnother$/.test(error?.button || '')) {
		const context = running ? { char: running.char, itemId: running.itemId } : {};
		await cancel(editor);
		openPick(editor, context);
		return;
	}
	drawBox(editor);
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * @param {Object} editor
 * @param {Object} [item] - default: the open letter
 * @returns {{char: String, itemId: String}}
 */
function letterOf(editor, item) {
	const id = item?.id || editor?.selectedGlyphID || '';
	if (typeof id !== 'string' || !id.startsWith('glyph-')) return { char: '', itemId: '' };
	const glyph = item || editor.project?.getItem?.(id);
	let char = typeof glyph?.char === 'string' ? glyph.char : '';
	if (!char) {
		const code = parseInt(id.replace(/^glyph-/, ''), 16);
		char = Number.isFinite(code) ? String.fromCodePoint(code) : '';
	}
	return { char, itemId: id };
}

/** Tests: back to before initPhotos. */
export function resetPhotoAppForTests() {
	state.unhooks.splice(0).forEach((off) => off());
	state.started = false;
	state.getEditor = getCurrentProjectEditor;
	state.followed = new WeakSet();
	state.pick = null;
	setPhotoRoute(null);
	setPhotoPreview(null);
	closeHowCard();
}
