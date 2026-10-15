// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-ui: the photo card in the letter card, steps A and C (docs/UX-BEGINNER.md 4.4 "Step A,
	pick" and "Step C, result", 4.3 "Letter card sections": Photo card, shown while running).

	Step A, pick (reached by [Use a photo] when the font has no photo, or [Choose another
	photo...]):
	  Photo of your small r
	  [ Choose a photo... ]   (green)
	  Photos in this font:  [thumb] [thumb]        newest first, up to 6; click one to use it
	  No photo yet? How to take one >
	  [ Cancel ]
	Step C, result (the trace of the part starts on its own; the canvas shows it):
	  Look right?
	  [ Use it ]  (green)            [ Cancel ]
	  Wrong part?  [ Draw a box ]
	  This replaces your 2 shapes. Undo brings them back.   <- only when the letter has shapes
	  Add to my shapes instead                              <- only when the letter has shapes
	  > Adjust
	     Ink cutoff   less ink --o-- more ink   [Auto]
	     Smooth --o-- Detailed
	     [x] Remove specks
	     [ ] Light ink on dark paper
	     Paper: (Flat scan) (Phone photo)  picked for you
	While tracing it says "Tracing..." and [Use it] stays (Use it traces at full size first). No
	ink found (7.7): the flow's sentence (photoFlow.noInk), [Use it] goes and [Draw a box] is the
	green button. A trace that failed says the flow's words, and [Cancel] is the way out. One
	green button at a time (principle 1); the Next line says rule 2 or 3 with no button of its
	own.
	Nothing traced (fix pass, first-timer finding 3): "Look right?" goes (there is nothing to look
	at) and the sentence, which always sits above the buttons, heads the card. When the fix is a
	setting in Adjust (no ink: the ink cutoff toward more ink; too many specks: toward less ink,
	or Remove specks), Adjust opens by itself, once each time it comes to that, so the sentence
	names controls that show. Opening it for him is not his choice for the session; his press on
	Adjust is, whatever it showed.
	Step C's canvas (finding 5: a Capital H written tall had its stems cut off by the canvas
	top): when a part's result is first ready, the app's card fits the edit canvas to the result
	and every guide line (resultView), unless the view shows them already. Once per part, so
	Adjust's re-traces leave his view alone; Draw a box (another part) fits again. Looking around:
	no Undo step.
	Notes (finalize): the flow's quiet notes for a ready result (two letters may touch, the
	letter reaches far past the top or tail line) show under the buttons, one quiet line each.
	A part with no letter in it at all (code 'no-letter') says so, with [Draw a box] green, and
	Adjust stays as it was: no setting there finds a letter that isn't in the part.
	Adjust is closed at first and stays as he left it for the session. Its controls speak the
	photo flow's own settings (photo_flow.js getFlow options, adjustPart), so a press goes
	straight to the flow: Ink cutoff is threshold ('auto' or 0..255, darker than it is ink, so
	"more ink" is higher; on Auto the slider shows autoThreshold, what the photo picked); Smooth
	--o-- Detailed is smoothDetail (0..1, smooth_detail.js moves both auto-trace settings);
	Remove specks is despeckle; Light ink on dark paper is lightInk; Paper is paper ('scan' or
	'photo'), and picking one starts the ink cutoff on Auto again (a cutoff set by hand means
	another thing in the other mode, as in More tools). No numbers show (principle 3).

	The card holds no font state: the photo flow gives it a state and gets the presses back. It
	never writes to the font, so nothing here is an Undo step.
	  state (step C is the photo flow's getFlow, as it is, plus the step):
	         { step: 'pick' | 'result', char,
	           photos: [{ asset, image }]            step A: image as photo_dialog.js paintPhoto
	                                                 takes it (ImageBitmap, <img>, <canvas>,
	                                                 ImageData, Blob)
	           status: 'tracing' | 'ready' | 'no-ink' | 'error',
	           error: { code, key, vars, button }    what went wrong: the words key of its
	                                                 sentence, and of its fix button (or null)
	           replaces,                             the letter's shapes now (Use it replaces them)
	           options: { threshold, autoThreshold, smoothDetail, despeckle, lightInk, paper,
	                      paperPicked } }            paperPicked: the paper is the one
	                                                 paper_kind.js picked for him
	  handlers: onChoose() (inside the press: the picker needs the click), onPickPhoto(asset),
	            onHow(), onCancel(), onUseIt(), onAddInstead(), onDrawBox(),
	            onFix(error): a failure's own fix button (error.button, a words key; one
	            ending in .drawBox makes [Draw a box] the green button instead; without onFix a
	            key ending in .chooseAnother runs onChoose, any other onDrawBox),
	            onAdjust(changes, what): changes as photo_flow.js adjustPart takes them
	            ({ threshold }, { smoothDetail }, { despeckle }, { lightInk }, { paper,
	            threshold: 'auto' }); what is 'inkCutoff', 'smoothDetail', 'specks', 'lightInk'
	            or 'paper'

	  makePhotoCard(state, handlers)   { element, update(state, handlers?), state() }
	  The app's one card (only in Simple with 'photo' on; the letter card puts its element in its
	  Photo card section, and hides its main buttons and the empty overlay while it shows):
	  openPhotoCard(state, handlers)   the card, made or updated; null when off
	  updatePhotoCard(state, handlers?)
	  closePhotoCard()
	  photoCardElement()               the card's element, or null
	  photoCardState()                 { step, char, status, green } or null; B8 + B9
	                                   integration: status is step C's ('tracing', 'ready',
	                                   'no-ink', 'error'; '' at step A) and green the words key of
	                                   the card's green button, so the Next line names the button
	                                   that shows (rule 3: "Press Draw a box on the card." when
	                                   [Use it] is gone)
	  isPhotoCardOpen()
	  resultView({ ink, font, rect, view })   pure: the canvas view that shows a result whole with
	                                   the guide lines (null: the view shows them already);
	                                   FIT_MARGIN_PX round it, ZOOM_BAR_PX at the bottom
	  The state the app card is given may carry the flow's itemId, asset and partId (getFlow):
	  they say which part step C fits the canvas to.
	  PHOTO_CARD_EVENT                'anyink-photo-card' on window, detail photoCardState() or
	                                   null, whenever the card opens, changes step, status or
	                                   green button, or closes; the Next line hears it as its
	                                   'photoCard' fact (rules 2, 3)
	  resetPhotoCardForTests()
	Words: photo.card.* (words/sets/photo.js), action.useIt. Look: photo_card.css, tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { setCoachFact } from '../coach/coach_state.js';
import { openDialogName } from '../coach/dom_probe.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { letterName } from '../words/letter_name.js';
import { hasWord, word, wordEntry } from '../words/words.js';
import { paintPhoto } from './paint_photo.js';
import {
	PHOTO_CARD_EVENT,
	isPhotoCardOpen,
	photoCardElement,
	photoCardState,
	setPhotoCardSlot,
} from './photo_card_slot.js';
import { photoPreviewShapes } from './photo_flow_state.js';
import { MAX_LISTED_PHOTOS } from './photo_registry.js';
import { SMOOTH_DETAIL_DEFAULT } from './smooth_detail.js';
import './photo_card.css';

// B8 + B9 integration: where the card is lives in photo_card_slot.js, which the letter view
// reads without importing this file (re-exported here for the card's own callers)
export { PHOTO_CARD_EVENT, isPhotoCardOpen, photoCardElement, photoCardState };

/** Thumbnails are drawn at twice their shown size, for a sharp picture. */
const THUMB = Object.freeze({ width: 128, height: 96 });

/** The Smooth --o-- Detailed slider's step. */
const SMOOTH_STEP = 0.05;

const STATUSES = ['tracing', 'ready', 'no-ink', 'error'];

const PAPERS = ['scan', 'photo'];

/** Adjust stays as he left it for the session. */
let adjustOpen = false;

/** Step C's canvas keeps this much room round the result and the guide lines (finding 5). */
export const FIT_MARGIN_PX = 24;

/** ...and this much at the bottom, where the canvas's zoom bar sits. */
export const ZOOM_BAR_PX = 56;

/** The part step C last fitted the canvas to ('' when none): once per part, never per Adjust. */
let fittedPart = '';

/** @type {{view: Object} | null} the app's one card */
let appCard = null;

// --------------------------------------------------------------
// The state
// --------------------------------------------------------------

/**
 * @param {Object} raw
 * @returns {Object} a clean state
 */
function cleanState(raw = {}) {
	const step = raw.step === 'result' ? 'result' : 'pick';
	const error = raw.error && typeof raw.error.key === 'string' ? raw.error : null;
	return {
		step,
		char: typeof raw.char === 'string' ? raw.char : '',
		photos: (Array.isArray(raw.photos) ? raw.photos : [])
			.filter((photo) => photo && typeof photo.asset === 'string')
			.slice(0, MAX_LISTED_PHOTOS),
		status: STATUSES.includes(raw.status) ? raw.status : 'ready',
		error,
		replaces: Math.max(0, Math.floor(Number(raw.replaces) || 0)),
		options: cleanOptions(raw.options),
		notes: (Array.isArray(raw.notes) ? raw.notes : []).filter(
			(note) => note && typeof note.key === 'string' && hasWord(note.key)
		),
	};
}

/**
 * @param {Object} raw - getFlow's options
 * @returns {{threshold: 'auto' | Number, autoThreshold: Number | null, smoothDetail: Number,
 *   despeckle: Boolean, lightInk: Boolean, paper: String, paperPicked: Boolean}}
 */
function cleanOptions(raw) {
	const o = raw && typeof raw === 'object' ? raw : {};
	const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
	const threshold = number(o.threshold);
	const auto = number(o.autoThreshold);
	const smooth = number(o.smoothDetail);
	return {
		threshold: threshold === null ? 'auto' : Math.round(Math.min(255, Math.max(0, threshold))),
		autoThreshold: auto === null ? null : Math.round(auto),
		smoothDetail: smooth === null ? SMOOTH_DETAIL_DEFAULT : Math.min(1, Math.max(0, smooth)),
		despeckle: o.despeckle !== false,
		lightInk: o.lightInk === true,
		paper: PAPERS.includes(o.paper) ? o.paper : 'scan',
		paperPicked: o.paperPicked === true,
	};
}

/** What a rebuild depends on; anything else is set in place. */
function shapeKey(state) {
	const photos = state.step === 'pick' ? state.photos.map((photo) => photo.asset).join(',') : '';
	return `${state.step}|${state.char}|${photos}`;
}

// --------------------------------------------------------------
// The card
// --------------------------------------------------------------

/**
 * @param {Object} state - see the header
 * @param {Object} [handlers]
 * @returns {{element: HTMLElement, update: Function, state: Function}}
 */
export function makePhotoCard(state, handlers = {}) {
	const card = {
		state: cleanState(state),
		handlers: { ...handlers },
		key: '',
		els: {},
		element: el('section', 'anyink-photo-card', {
			'aria-label': word('photo.card.region'),
			'data-anyink-card': 'photo',
		}),
	};
	draw(card);
	return {
		element: card.element,
		update(next, nextHandlers) {
			if (nextHandlers) card.handlers = { ...nextHandlers };
			card.state = cleanState(next);
			draw(card);
		},
		state: () => ({
			step: card.state.step,
			char: card.state.char,
			status: card.state.step === 'result' ? card.state.status : '',
			green: greenKey(card.state),
		}),
	};
}

/**
 * B8 + B9 integration: the words key of the card's one green button.
 * @param {Object} state - a clean state
 * @returns {String}
 */
function greenKey(state) {
	if (state.step !== 'result') return 'photo.card.choose';
	const fix = fixOf(state);
	if (fix === 'drawBox') return 'photo.card.drawBox';
	if (fix === 'cancel') return 'photo.card.cancel';
	if (fix === 'own') return state.error.button;
	return 'action.useIt';
}

/** Builds the card when its step, letter or photo list changed, then sets what shows. */
function draw(card) {
	const key = shapeKey(card.state);
	if (key !== card.key) {
		card.key = key;
		card.els = {};
		card.element.replaceChildren();
		card.element.setAttribute('data-anyink-photo-card', card.state.step);
		if (card.state.step === 'pick') buildPick(card);
		else buildResult(card);
	}
	if (card.state.step === 'result') syncResult(card);
	yieldGreen(card.element);
}

/**
 * B8 + B9 integration (principle 1, found in Chrome): while a dialog is open over the card (the
 * photo dialog from step A or from "Draw a box", or the error box a photo that can't be used
 * brings) the dialog holds the screen's one green button, so the card's shows outlined until it
 * closes, as the empty-letter overlay's does.
 * @param {HTMLElement} element - the card
 */
function yieldGreen(element) {
	const dialog = !!openDialogName(element.ownerDocument);
	if (dialog) {
		element.querySelectorAll('.anyink-primary').forEach((button) => {
			button.classList.replace('anyink-primary', 'anyink-outlined');
			button.setAttribute('data-anyink-yielded', '');
		});
		return;
	}
	element.querySelectorAll('[data-anyink-yielded]').forEach((button) => {
		button.classList.replace('anyink-outlined', 'anyink-primary');
		button.removeAttribute('data-anyink-yielded');
	});
}

/** The app card watches the page for dialogs coming and going while it is open. */
let watcher = null;
function watchDialogs(element) {
	if (watcher || typeof MutationObserver === 'undefined') return;
	const body = element.ownerDocument?.body;
	if (!body) return;
	watcher = new MutationObserver((records) => {
		if (records.every((record) => element.contains(record.target))) return;
		yieldGreen(element);
	});
	watcher.observe(body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['hidden', 'open', 'style', 'class'],
	});
}
function stopWatching() {
	watcher?.disconnect();
	watcher = null;
}

/** Calls a handler; one that throws never breaks the card. */
function call(card, name, ...args) {
	try {
		card.handlers[name]?.(...args);
	} catch (error) {
		console.warn(`ANY-INK photo card: ${name} failed`, error);
	}
}

// --------------------------------------------------------------
// Step A
// --------------------------------------------------------------

function buildPick(card) {
	const { state, element } = card;
	const name = letterName(state.char);
	element.appendChild(
		el(
			'h4',
			'anyink-photo-card__title',
			{},
			name ? word('photo.card.pickTitle', { letter: name }) : word('photo.card.region')
		)
	);
	const choose = button('choose', 'photo.card.choose', 'primary');
	choose.addEventListener('click', () => call(card, 'onChoose'));
	element.appendChild(choose);

	if (state.photos.length) {
		element.appendChild(
			el(
				'p',
				'anyink-photo-card__label',
				{ 'data-anyink-photo-card-thumbs-label': '' },
				word('photo.card.inFont')
			)
		);
		const thumbs = el('div', 'anyink-photo-card__thumbs', { 'data-anyink-photo-card-thumbs': '' });
		state.photos.forEach((photo) => {
			const thumb = el('button', 'anyink-photo-card__thumb', {
				type: 'button',
				title: word('photo.card.usePhoto'),
				'aria-label': word('photo.card.usePhoto'),
				'data-anyink-photo-card-action': 'photo',
				'data-anyink-asset': photo.asset,
			});
			const canvas = el('canvas', 'anyink-photo-card__thumb-picture', { 'aria-hidden': 'true' });
			canvas.width = THUMB.width;
			canvas.height = THUMB.height;
			thumb.appendChild(canvas);
			paintPhoto(canvas, photo.image, { fit: 'contain' });
			thumb.addEventListener('click', () => call(card, 'onPickPhoto', photo.asset));
			thumbs.appendChild(thumb);
		});
		element.appendChild(thumbs);
	}

	const how = el('button', 'anyink-photo-card__link', {
		type: 'button',
		'data-anyink-photo-card-action': 'how',
	});
	how.textContent = `${word('photo.card.how')} ›`;
	how.addEventListener('click', () => call(card, 'onHow'));
	element.appendChild(how);

	const row = el('div', 'anyink-photo-card__row');
	const cancel = button('cancel', 'photo.card.cancel', 'outlined');
	cancel.addEventListener('click', () => call(card, 'onCancel'));
	row.appendChild(cancel);
	element.appendChild(row);
}

// --------------------------------------------------------------
// Step C
// --------------------------------------------------------------

function buildResult(card) {
	const { element, els } = card;
	card.adjustAsked = false;
	// "Look right?" only while there is a result to look at (finding 3)
	els.title = el('h4', 'anyink-photo-card__title', {}, word('photo.card.lookRight'));
	element.appendChild(els.title);

	// what happened comes before the buttons: with nothing traced it is the card's heading
	els.status = el('p', 'anyink-photo-card__status', {
		'aria-live': 'polite',
		'data-anyink-photo-card-status': '',
	});
	element.appendChild(els.status);

	const row = el('div', 'anyink-photo-card__row');
	els.useIt = button('useIt', 'action.useIt', 'primary');
	els.useIt.addEventListener('click', () => call(card, 'onUseIt'));
	els.cancel = button('cancel', 'photo.card.cancel', 'outlined');
	els.cancel.addEventListener('click', () => call(card, 'onCancel'));
	row.append(els.useIt, els.cancel);
	element.appendChild(row);
	// a failure's own fix button (the flow's error.button), green while it shows
	els.fix = el('button', 'anyink-photo-card__button anyink-primary', {
		type: 'button',
		'data-anyink-photo-card-action': 'fix',
	});
	els.fix.hidden = true;
	els.fix.addEventListener('click', () => fixIt(card));
	element.appendChild(els.fix);

	const wrong = el('div', 'anyink-photo-card__wrong', { 'data-anyink-photo-card-wrong': '' });
	wrong.appendChild(el('span', 'anyink-photo-card__text', {}, word('photo.card.wrongPart')));
	els.drawBox = button('drawBox', 'photo.card.drawBox', 'outlined');
	els.drawBox.addEventListener('click', () => call(card, 'onDrawBox'));
	wrong.appendChild(els.drawBox);
	element.appendChild(wrong);

	// step C's quiet notes (photo_flow_notes.js: two letters touching, a letter far past the
	// lines), one quiet line each (finalize: the flow had them, the card never showed them)
	els.notes = el('div', 'anyink-photo-card__notes', { 'data-anyink-photo-card-notes': '' });
	element.appendChild(els.notes);
	els.replaces = el('p', 'anyink-photo-card__note', { 'data-anyink-photo-card-replaces': '' });
	element.appendChild(els.replaces);
	els.addInstead = el('button', 'anyink-photo-card__link', {
		type: 'button',
		title: wordEntry('photo.card.addInstead')?.hint || '',
		'data-anyink-photo-card-action': 'addInstead',
	});
	els.addInstead.textContent = word('photo.card.addInstead');
	els.addInstead.addEventListener('click', () => call(card, 'onAddInstead'));
	element.appendChild(els.addInstead);

	buildAdjust(card);
}

function buildAdjust(card) {
	const { element, els } = card;
	const toggle = el('button', 'anyink-photo-card__disclosure', {
		type: 'button',
		title: wordEntry('photo.card.adjust')?.hint || '',
		'aria-expanded': String(adjustOpen),
		'data-anyink-photo-card-action': 'adjust',
	});
	toggle.appendChild(el('span', 'anyink-photo-card__chevron', { 'aria-hidden': 'true' }));
	toggle.appendChild(el('span', '', {}, word('photo.card.adjust')));
	const body = el('div', 'anyink-photo-card__adjust', { 'data-anyink-photo-card-adjust-body': '' });
	body.hidden = !adjustOpen;
	els.adjustToggle = toggle;
	els.adjustBody = body;
	// his press is his choice for the session, from what shows now (it may have opened for him)
	toggle.addEventListener('click', () => {
		adjustOpen = toggle.getAttribute('aria-expanded') !== 'true';
		showAdjust(card, adjustOpen);
	});
	element.append(toggle, body);

	// Ink cutoff   less ink --o-- more ink   [Auto]
	const ink = el('div', 'anyink-photo-card__setting');
	ink.appendChild(
		el(
			'span',
			'anyink-photo-card__setting-name',
			{ title: wordEntry('photo.card.inkCutoff')?.hint || '' },
			word('photo.card.inkCutoff')
		)
	);
	const inkEnds = el('div', 'anyink-photo-card__slider', {
		'data-anyink-photo-card-ends': 'inkCutoff',
	});
	els.ink = slider('inkCutoff', 'photo.card.inkCutoff', { min: 0, max: 255, step: 1 });
	els.ink.addEventListener('input', () =>
		call(card, 'onAdjust', { threshold: Math.round(Number(els.ink.value)) }, 'inkCutoff')
	);
	inkEnds.append(end('photo.card.lessInk'), els.ink, end('photo.card.moreInk'));
	els.auto = el('button', 'anyink-photo-card__auto', {
		type: 'button',
		title: wordEntry('photo.card.auto')?.hint || '',
		'aria-pressed': 'false',
		'data-anyink-photo-card-action': 'auto',
	});
	els.auto.textContent = word('photo.card.auto');
	els.auto.addEventListener('click', () =>
		call(card, 'onAdjust', { threshold: 'auto' }, 'inkCutoff')
	);
	ink.append(inkEnds, els.auto);

	// Smooth --o-- Detailed
	const smooth = el('div', 'anyink-photo-card__slider anyink-photo-card__setting', {
		title: wordEntry('photo.card.smoothDetail')?.hint || '',
		'data-anyink-photo-card-ends': 'smoothDetail',
	});
	els.smooth = slider('smoothDetail', 'photo.card.smoothDetail', {
		min: 0,
		max: 1,
		step: SMOOTH_STEP,
	});
	els.smooth.addEventListener('input', () =>
		call(card, 'onAdjust', { smoothDetail: Number(els.smooth.value) }, 'smoothDetail')
	);
	smooth.append(end('photo.card.smooth'), els.smooth, end('photo.card.detailed'));

	// [x] Remove specks, [ ] Light ink on dark paper
	els.specks = check('specks', 'photo.card.specks');
	els.specks.input.addEventListener('change', () =>
		call(card, 'onAdjust', { despeckle: els.specks.input.checked }, 'specks')
	);
	els.lightInk = check('lightInk', 'photo.card.lightInk');
	els.lightInk.input.addEventListener('change', () =>
		call(card, 'onAdjust', { lightInk: els.lightInk.input.checked }, 'lightInk')
	);

	// Paper: (Flat scan) (Phone photo)  picked for you
	const paper = el('div', 'anyink-photo-card__paper');
	paper.appendChild(el('span', 'anyink-photo-card__setting-name', {}, word('photo.card.paper')));
	const choices = el('div', 'anyink-photo-card__segmented', { role: 'group' });
	els.paperScan = paperButton('paperScan', 'photo.card.paperScan');
	els.paperPhoto = paperButton('paperPhoto', 'photo.card.paperPhoto');
	const pickPaper = (paper) => {
		card.state.options = { ...card.state.options, paper, threshold: 'auto', paperPicked: false };
		syncResult(card);
		call(card, 'onAdjust', { paper, threshold: 'auto' }, 'paper');
	};
	els.paperScan.addEventListener('click', () => pickPaper('scan'));
	els.paperPhoto.addEventListener('click', () => pickPaper('photo'));
	choices.append(els.paperScan, els.paperPhoto);
	els.picked = el(
		'span',
		'anyink-photo-card__picked',
		{ 'data-anyink-photo-card-picked': '' },
		word('photo.card.paperPicked')
	);
	paper.append(choices, els.picked);

	body.append(ink, smooth, els.specks.label, els.lightInk.label, paper);
}

/** Sets everything step C shows from the state, in place. */
function syncResult(card) {
	const { state, els } = card;
	const { status, options } = state;
	const stuck = status === 'no-ink' || status === 'error';

	// One green button: Use it; the fix when the trace can't be used (Draw a box when no ink
	// was found, the failure's own button, else Cancel)
	const fix = fixOf(state);
	els.useIt.hidden = stuck;
	setKind(els.drawBox, fix === 'drawBox' ? 'primary' : 'outlined');
	setKind(els.cancel, fix === 'cancel' ? 'primary' : 'outlined');
	els.fix.hidden = fix !== 'own';
	els.fix.textContent = fix === 'own' ? word(state.error.button) : '';

	els.status.textContent = statusText(state);
	// nothing traced: no "Look right?"; when the fix is in Adjust (more ink, fewer specks) Adjust
	// opens by itself, once each time it comes to that, so the sentence names what shows
	// (finding 3). Opening it for him is not his choice for the session.
	els.title.hidden = stuck;
	if (fixInAdjust(state)) {
		if (!card.adjustAsked) showAdjust(card, true);
		card.adjustAsked = true;
	} else {
		card.adjustAsked = false;
	}
	const notes = status === 'ready' ? state.notes.map(noteText).filter(Boolean) : [];
	const shown = [...els.notes.children].map((line) => line.textContent);
	if (shown.join('\n') !== notes.join('\n')) {
		els.notes.replaceChildren(
			...notes.map((text) =>
				el('p', 'anyink-photo-card__note', { 'data-anyink-photo-card-note': '' }, text)
			)
		);
	}
	els.notes.hidden = !notes.length;
	const has = state.replaces > 0;
	els.replaces.hidden = !has;
	els.replaces.textContent = has ? word('photo.card.replaces', { count: state.replaces }) : '';
	els.addInstead.hidden = !has || stuck;

	// Adjust
	const auto = options.threshold === 'auto';
	els.auto.setAttribute('aria-pressed', String(auto));
	const cutoff = auto ? options.autoThreshold : options.threshold;
	if (Number.isFinite(cutoff)) setSlider(els.ink, cutoff);
	setSlider(els.smooth, options.smoothDetail);
	els.specks.input.checked = options.despeckle;
	els.lightInk.input.checked = options.lightInk;
	els.paperScan.setAttribute('aria-pressed', String(options.paper === 'scan'));
	els.paperPhoto.setAttribute('aria-pressed', String(options.paper === 'photo'));
	els.picked.hidden = !options.paperPicked;
}

/**
 * @param {Object} state
 * @returns {'drawBox' | 'own' | 'cancel' | null} the fix that is the green button, if any
 */
function fixOf(state) {
	if (state.status === 'no-ink') return 'drawBox';
	if (state.status !== 'error') return null;
	const fixKey = state.error?.button;
	if (typeof fixKey !== 'string' || !hasWord(fixKey)) return 'cancel';
	return /\.drawBox$/.test(fixKey) ? 'drawBox' : 'own';
}

/**
 * @param {Object} state - a clean state
 * @returns {Boolean} nothing traced, and the fix is a setting in Adjust: no ink (the ink cutoff
 *   toward more ink), too many specks (toward less ink, or Remove specks)
 */
function fixInAdjust(state) {
	// finalize: a part with no letter in it at all ('no-letter') is fixed by the box, never Adjust
	if (state.status === 'no-ink') return state.error?.code !== 'no-letter';
	return state.status === 'error' && state.error?.code === 'too-many';
}

/** Shows or hides Adjust's settings, and says so on its toggle. */
function showAdjust(card, open) {
	const { adjustToggle, adjustBody } = card.els;
	adjustToggle.setAttribute('aria-expanded', String(open));
	adjustBody.hidden = !open;
}

/** The failure's own fix: onFix(error); without one, a fix named for a card button does it. */
function fixIt(card) {
	const { error } = card.state;
	if (card.handlers.onFix) {
		call(card, 'onFix', error);
		return;
	}
	if (/\.chooseAnother$/.test(error?.button || '')) call(card, 'onChoose');
	else call(card, 'onDrawBox');
}

/** A note's sentence, or '' when its words can't be made. */
function noteText(note) {
	try {
		return word(note.key, note.vars || {});
	} catch {
		return '';
	}
}

function statusText(state) {
	if (state.status === 'tracing') return word('photo.card.tracing');
	const { error } = state;
	if ((state.status === 'error' || state.status === 'no-ink') && error && hasWord(error.key)) {
		try {
			return word(error.key, error.vars);
		} catch {
			// a sentence missing its values says nothing rather than half of it
		}
	}
	return state.status === 'no-ink' ? word('photoFlow.noInk') : '';
}

/** A slider he is moving keeps its spot; the others follow the state. */
function setSlider(input, value) {
	if (input.ownerDocument?.activeElement === input) return;
	input.value = String(value);
}

function setKind(element, kind) {
	element.removeAttribute('data-anyink-yielded');
	element.classList.toggle('anyink-primary', kind === 'primary');
	element.classList.toggle('anyink-outlined', kind !== 'primary');
}

// --------------------------------------------------------------
// The app's one card
// --------------------------------------------------------------

/**
 * @param {Object} state
 * @param {Object} handlers
 * @returns {{element: HTMLElement, update: Function, state: Function} | null}
 */
export function openPhotoCard(state, handlers) {
	if (!isSimpleMode() || !isFeatureOn('photo')) return null;
	if (appCard) appCard.view.update(state, handlers);
	else appCard = { view: makePhotoCard(state, handlers) };
	setPhotoCardSlot(appCard.view);
	watchDialogs(appCard.view.element);
	tell();
	fitResult(state);
	return appCard.view;
}

/**
 * @param {Object} state
 * @param {Object} [handlers]
 */
export function updatePhotoCard(state, handlers) {
	if (!appCard) return;
	const before = appCard.view.state();
	appCard.view.update(state, handlers);
	const after = appCard.view.state();
	if (['step', 'char', 'status', 'green'].some((name) => before[name] !== after[name])) tell();
	fitResult(state);
}

/** Closes the card (the flow's Use it, Cancel, or another letter). */
export function closePhotoCard() {
	fittedPart = '';
	if (!appCard) return;
	appCard.view.element.remove();
	appCard = null;
	setPhotoCardSlot(null);
	stopWatching();
	tell();
}

// --------------------------------------------------------------
// Step C's canvas (finding 5)
// --------------------------------------------------------------

/**
 * The canvas view that shows a traced result whole, with every guide line (the top line to the
 * tail line) and the letter's left edge, FIT_MARGIN_PX clear of the canvas's sides and top and
 * ZOOM_BAR_PX of its bottom, centered; or null when the view shows all that already (his view
 * stays). Pure.
 * @param {{ink: {xMin: Number, xMax: Number, yMin: Number, yMax: Number}, font: Object,
 *   rect: {width: Number, height: Number}, view?: {dx: Number, dy: Number, dz: Number}}} options
 *   - the result's box in font units, the font's settings (ascent, descent, capHeight, xHeight),
 *   the canvas's size, the view now
 * @returns {{dx: Number, dy: Number, dz: Number} | null}
 */
export function resultView({ ink, font, rect, view }) {
	const unit = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
	const top = Math.max(ink.yMax, unit(font?.ascent), unit(font?.capHeight), unit(font?.xHeight));
	const bottom = Math.min(ink.yMin, unit(font?.descent), 0);
	const left = Math.min(ink.xMin, 0);
	const right = Math.max(ink.xMax, 0);
	const room = {
		left: FIT_MARGIN_PX,
		top: FIT_MARGIN_PX,
		right: rect.width - FIT_MARGIN_PX,
		bottom: rect.height - ZOOM_BAR_PX,
	};
	if (view && [view.dx, view.dy, view.dz].every(Number.isFinite)) {
		const shows =
			view.dx + left * view.dz >= room.left &&
			view.dx + right * view.dz <= room.right &&
			view.dy - top * view.dz >= room.top &&
			view.dy - bottom * view.dz <= room.bottom;
		if (shows) return null;
	}
	const width = right - left;
	const height = top - bottom;
	const roomW = room.right - room.left;
	const roomH = room.bottom - room.top;
	if (!(width > 0 && height > 0 && roomW > 0 && roomH > 0)) return null;
	const dz = Math.min(roomW / width, roomH / height);
	return {
		dx: room.left + (roomW - width * dz) / 2 - left * dz,
		dy: room.top + (roomH - height * dz) / 2 + top * dz,
		dz,
	};
}

/**
 * When step C's result is first ready for a part, the canvas shows it whole with the guide lines
 * (a letter written tall had its stems cut off by the canvas top). Once per part: Adjust's
 * re-traces leave his view alone; Draw a box (another part), or step C again after Cancel or
 * Use it, fits again. Looking around: no Undo step, nothing written to the font.
 * @param {Object} raw - the state the hub gives the card (the flow's getFlow, plus the step)
 */
function fitResult(raw) {
	if (raw?.step !== 'result' || raw.status !== 'ready' || !raw.itemId) return;
	const key = `${raw.itemId}|${raw.asset}|${raw.partId}`;
	if (key === fittedPart) return;
	let editor = null;
	try {
		editor = getCurrentProjectEditor();
	} catch {
		return;
	}
	const item = editor?.selectedItem;
	if (!item || item.id !== raw.itemId) return;
	const ink = shapesBox(photoPreviewShapes(item, editor));
	const rect = editor.getEditCanvasWrapperBounds?.();
	if (!ink || !(rect?.width > 0 && rect?.height > 0)) return;
	fittedPart = key;
	const next = resultView({ ink, font: editor.project?.settings?.font, rect, view: editor.view });
	if (!next) return;
	editor.view = next;
	editor.publish?.('editCanvasView', editor.view);
}

/** @returns {{xMin, xMax, yMin, yMax} | null} the box round the shapes (their curves' extremes) */
function shapesBox(shapes) {
	if (!Array.isArray(shapes)) return null;
	const box = { xMin: Infinity, xMax: -Infinity, yMin: Infinity, yMax: -Infinity };
	for (const shape of shapes) {
		const m = shape?.maxes;
		if (![m?.xMin, m?.xMax, m?.yMin, m?.yMax].every(Number.isFinite)) continue;
		box.xMin = Math.min(box.xMin, m.xMin);
		box.xMax = Math.max(box.xMax, m.xMax);
		box.yMin = Math.min(box.yMin, m.yMin);
		box.yMax = Math.max(box.yMax, m.yMax);
	}
	return box.xMin <= box.xMax ? box : null;
}

/** Tells the Next line (rules 2 and 3) and the page (the letter card, the overlay). */
function tell() {
	const detail = photoCardState();
	setCoachFact('photoCard', detail);
	globalThis.dispatchEvent?.(new CustomEvent(PHOTO_CARD_EVENT, { detail }));
}

export function resetPhotoCardForTests() {
	appCard?.view.element.remove();
	appCard = null;
	setPhotoCardSlot(null);
	stopWatching();
	adjustOpen = false;
	fittedPart = '';
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

function el(tag, className, attributes = {}, text = '') {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	if (text) element.textContent = text;
	return element;
}

function button(name, key, kind) {
	const element = el('button', `anyink-photo-card__button anyink-${kind}`, {
		type: 'button',
		'data-anyink-photo-card-action': name,
	});
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}

function slider(name, key, { min, max, step }) {
	return el('input', 'anyink-photo-card__range', {
		type: 'range',
		min: String(min),
		max: String(max),
		step: String(step),
		'aria-label': word(key),
		'data-anyink-photo-card-input': name,
	});
}

function end(key) {
	return el('span', 'anyink-photo-card__end', {}, word(key));
}

function check(name, key) {
	const label = el('label', 'anyink-photo-card__check', {
		title: wordEntry(key)?.hint || '',
	});
	const input = el('input', '', { type: 'checkbox', 'data-anyink-photo-card-input': name });
	label.append(input, el('span', '', {}, word(key)));
	return { label, input };
}

function paperButton(name, key) {
	const element = el('button', 'anyink-photo-card__choice', {
		type: 'button',
		title: wordEntry(key)?.hint || '',
		'aria-pressed': 'false',
		'data-anyink-photo-card-action': name,
	});
	element.textContent = word(key);
	return element;
}
