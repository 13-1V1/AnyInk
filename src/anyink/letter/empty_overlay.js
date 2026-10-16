// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: the box in the middle of an empty letter's canvas (UX-BEGINNER.md 4.3 "Empty letter").
	  +-------------------------------+
	  |  Capital B is empty.          |
	  |  [ Draw it with points ]      |   <- the screen's one green button (principle 1)
	  +-------------------------------+
	Its first button is the green one (.anyink-primary); any others are outlined. The card has no
	buttons on an empty letter, so nothing on screen is repeated (letter_card.js).
	What it offers grows with the Bs (principle 8):
	  now (B7)        "Draw it with points": picks the Point pen, a tool inside Fine-tune, so
	                  Fine-tune opens too (7.6)
	  'brush' (B8)    "Draw with the brush" in its place
	  'photo' (B9)    B9 puts its own first: [Use the same photo] / [Use a photo], [Choose another
	                  photo...], "or drop a photo here", "No photo yet? How to take one"; while
	                  the photo card runs the box hides
	It shows only in the letter view, on an empty letter, and steps aside while a shape tool
	(Point pen, Rectangle, Oval) is picked: he has chosen how to draw, and the box must not sit
	where he clicks. Picking Select again on the still-empty letter brings it back. It is laid
	over the canvas's grid cell (letter.css), so it never moves the canvas or what the canvas
	positions itself. Empty means no finished shape (board/letter_set.js isEmptyLetter, the one
	rule the rail, the Next line and the card read): the shape the Point pen is still drawing
	isn't one yet. B6 + B7 finalize: a letter whose only shape is a stray line of two clicked
	points is not empty (the card says "Empty", since it holds no ink, and lists the shape): the
	box steps aside so the Next line's [Fix it] for that shape is the screen's green button.
	Fix pass, one green button (principle 1): while a dialog is open (coach/dom_probe.js: the
	error box under the save pill's [Fix], the How card, upstream's modal) the dialog holds the
	green button, so the box's first button is outlined until it closes. The box watches the page
	for dialogs coming and going while it is on screen, and lets go once its page is gone.

	B8 + B9 integration (both flags on):
	  +-------------------------------------------+
	  |  Capital B is empty.                      |
	  |  [ Use the same photo ] [thumb]           |   <- green: a photo of the font has parts
	  |  [ Choose another photo... ]              |      not used yet (else [Use a photo])
	  |  [ Draw with the brush ]                  |
	  |  or drop a photo here                     |
	  |  No photo yet? How to take one            |
	  +-------------------------------------------+
	  The buttons open the photo screens through photo/photo_doors.js (photo_app.js answers;
	  the letter view never imports that hub): the photo dialog on that photo
	  with this letter known, or the photo card's step A, or the How card. The box hides while
	  the photo card runs or the photo flow is at step C (PHOTO_CARD_EVENT, the flow's
	  'autoTrace'), so the card's green button is the only one.
	  The Brush an empty letter opens with (letter/open_tool.js) is no choice of his: the box
	  stays and a drag on the paper outside it draws. [Draw with the brush], or picking the Brush
	  himself (its button, B or N), puts the box away, as any other drawing tool does.

	  overlayButtons(isOn, { samePhoto, done })   ['useSamePhoto', 'chooseAnother', 'drawBrush'] /
	                           ['usePhoto', 'drawBrush'] with photos, ['drawBrush'], or
	                           ['drawPoints'] before B8; done (B8 + B9 finalize): the same photo
	                           is one he said he is done with, so ['chooseAnother',
	                           'useSamePhoto', 'drawBrush']: [Use the same photo] stays, outlined
	                           (its other parts may still be his letters), and never leads
	  overlayShows(editor)     true while the box shows
	  makeEmptyOverlay(editor) the box; follows the editor (subscriber 'anyink.letter.overlay')

	S3 (docs/SKETCH.md section 7, one green door), with 'sketch' on: the buttons are
	sketch_door.js doorButtons ([Sketch it] green with its key printed and its line under it,
	unless a photo part waits; [Draw it with points] and the Brush button are gone), then "or drop
	a photo here", the quiet "or sketch the outline instead" link with its picture, and More ways
	(the Brush, "No photo yet? How to take one"). [Sketch it] and the outline link pick the Line
	with the letter's way set (sketch_door.js openSketchDoor). The box stays while the Line the
	letter opened with is picked (an opening tool, as the Brush is), and steps aside while a piece
	is open (sketch/tools/undo_gate.js) or once the letter has a sketch piece.
	With 'sketch' off the box is exactly as before.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { selectTool } from '../../edit_canvas/tools/tools.js';
import { openDialogName } from '../coach/dom_probe.js';
import { isFeatureOn } from '../mode/features.js';
import { isOpeningTool } from '../nib/default_tool.js';
import { openPhotoDoor, samePhoto } from '../photo/photo_doors.js';
import { PHOTO_CARD_EVENT, isPhotoCardOpen } from '../photo/photo_card_slot.js';
import { paintPhoto } from '../photo/paint_photo.js';
import { getFlow } from '../photo/photo_flow_state.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { isEmptyLetter } from '../board/letter_set.js';
import { openPathOf } from '../coach/open_shape.js';
import { isLetterViewOn, setFineTuneOpen } from './view_switches.js';
import { SKETCH_TOOLS } from '../sketch/tools/tool_names.js';
import { hasSketchPieces } from '../sketch/sketched.js';
import { isPieceOpen, SKETCH_PIECE_EVENT } from '../sketch/tools/undo_gate.js';
import { toolKey } from '../mode/keys.js';
import { doorButtons, moreWays, openSketchDoor, outlinePicture } from './sketch_door.js';

export const OVERLAY_SUBSCRIBER = 'anyink.letter.overlay';

/** Shape tools: picking one means he has chosen how to draw (the Brush: his own pick of it) */
const SHAPE_TOOLS = Object.freeze([
	'newPath',
	'newRectangle',
	'newOval',
	'pathAddPoint',
	'nib',
	// S2 integration: a sketch tool is a choice of how to draw too (the box must not sit where he
	// clicks); S3's door replaces the box's buttons
	...SKETCH_TOOLS,
]);

/** 'autoTrace': the photo flow (B9) says every change of step C on it */
const TOPICS = [
	'currentItem',
	'whichGlyphIsSelected',
	'whichToolIsSelected',
	'traceLayer',
	'autoTrace',
];

/** The photo thumbnail beside [Use the same photo], drawn at twice its shown size */
const THUMB = Object.freeze({ width: 96, height: 72 });

/** Each button: its words and what it does */
const BUTTONS = Object.freeze({
	drawPoints: {
		key: 'letter.overlay.drawPoints',
		run: (editor) => {
			setFineTuneOpen(true, editor);
			selectTool('newPath');
		},
	},
	// his own pick of the Brush (tools.js tells nib/default_tool.js), so the box steps aside
	drawBrush: { key: 'letter.overlay.drawBrush', run: () => selectTool('nib') },
	// B8 + B9 integration: the photo screens (photo/photo_doors.js, answered by photo_app.js)
	useSamePhoto: {
		key: 'letter.overlay.useSamePhoto',
		run: (editor) => openPhotoDoor('samePhoto', letterContext(editor)),
	},
	usePhoto: {
		key: 'letter.overlay.usePhoto',
		run: (editor) => openPhotoDoor('pick', letterContext(editor)),
	},
	chooseAnother: {
		key: 'letter.overlay.chooseAnother',
		run: (editor) => openPhotoDoor('pick', letterContext(editor)),
	},
	// S3: the sketch door (the Line, the letter's way Centerline)
	sketchIt: { key: 'sketch.door.sketchIt', run: (editor) => openSketchDoor(editor, 'center') },
});

/** S3: More ways' quiet links (sketch_door.js moreWays) */
const MORE_WAYS = Object.freeze({
	brush: { key: 'sketch.door.brush', run: () => selectTool('nib') },
	how: { key: 'letter.overlay.how', run: (editor) => openPhotoDoor('how', letterContext(editor)) },
});

/**
 * @param {(flag: String) => Boolean} [isOn]
 * @param {{samePhoto?: Boolean}} [options] - a photo of the font has parts not used yet
 * @returns {Array<'useSamePhoto' | 'usePhoto' | 'chooseAnother' | 'drawBrush' | 'drawPoints'>}
 */
export function overlayButtons(isOn = isFeatureOn, { samePhoto: same = false, done = false } = {}) {
	// S3: the sketch's one green door
	if (isOn('sketch')) return doorButtons(isOn, { samePhoto: same, done });
	const buttons = [];
	if (isOn('photo')) {
		if (!same) buttons.push('usePhoto');
		else if (done) buttons.push('chooseAnother', 'useSamePhoto');
		else buttons.push('useSamePhoto', 'chooseAnother');
	}
	if (isOn('brush')) buttons.push('drawBrush');
	else buttons.push('drawPoints');
	return buttons;
}

/**
 * @param {Object} [editor]
 * @returns {Boolean}
 */
export function overlayShows(editor = getCurrentProjectEditor()) {
	if (!isLetterViewOn() || editor?.nav?.page !== 'Characters') return false;
	const item = openLetter(editor);
	if (!item || !isEmptyLetter(item, { open: openPathOf(editor) })) return false;
	// S2 finalize: a sketched letter is not empty on screen (its ink comes with S3); the box would
	// sit over the sketch
	if (hasSketchPieces(item)) return false;
	// B8 + B9 integration: the photo card holds the screen's green button while it runs
	if (isFeatureOn('photo') && (isPhotoCardOpen() || getFlow(editor))) return false;
	// S3: a piece he is drawing is his way chosen; the box must not sit where he clicks
	if (isFeatureOn('sketch') && isPieceOpen()) return false;
	// the Brush (S3: or the Line) the letter opened with is no choice of his: the box stays
	if (isOpeningTool(editor)) return true;
	return !SHAPE_TOOLS.includes(editor.selectedTool);
}

/**
 * @param {Object} [editor]
 * @returns {HTMLElement}
 */
export function makeEmptyOverlay(editor = getCurrentProjectEditor()) {
	const overlay = makeElement({
		tag: 'div',
		className: 'anyink-empty-overlay',
		attributes: { 'data-anyink-overlay': '' },
	});
	const view = { editor, overlay, signature: '', lookAgain: false, observer: null, placed: false };
	update(view);
	editor.subscribe({
		topic: TOPICS,
		subscriberID: OVERLAY_SUBSCRIBER,
		callback: () => follow(view),
	});
	watchForDialogs(view);
	listenForPhotoCard(view);
	listenForPiece(view);
	return overlay;
}

/** S3: a piece opening or ending shows or hides the box (one listener per box). */
function listenForPiece(view) {
	if (typeof globalThis.addEventListener !== 'function') return;
	const onPiece = () => {
		if (!view.overlay.isConnected) {
			if (view.placed) globalThis.removeEventListener(SKETCH_PIECE_EVENT, onPiece);
			return;
		}
		update(view);
	};
	globalThis.addEventListener(SKETCH_PIECE_EVENT, onPiece);
}

/** The photo card opening or closing shows or hides the box (one listener per box). */
function listenForPhotoCard(view) {
	if (typeof globalThis.addEventListener !== 'function') return;
	const onCard = () => {
		if (!view.overlay.isConnected) {
			if (view.placed) globalThis.removeEventListener(PHOTO_CARD_EVENT, onCard);
			return;
		}
		update(view);
	};
	globalThis.addEventListener(PHOTO_CARD_EVENT, onCard);
}

/**
 * Updates the box for what the editor said, and once more when the press that said it is done
 * (the Point pen says it switched tools before it lets go of the shape it closed).
 */
function follow(view) {
	if (!view.overlay.isConnected) return;
	update(view);
	if (view.lookAgain) return;
	view.lookAgain = true;
	queueMicrotask(() => {
		view.lookAgain = false;
		if (view.overlay.isConnected) update(view);
	});
}

/**
 * Watches the page for a dialog opening or closing, so the box's first button gives up the
 * green while one is open. Lets go once the box has been on the page and is gone (its page was
 * drawn again).
 */
function watchForDialogs(view) {
	const body = view.overlay.ownerDocument?.body;
	if (typeof MutationObserver === 'undefined' || !body) return;
	view.observer = new MutationObserver((records) => {
		const { overlay } = view;
		if (!overlay.isConnected) {
			if (view.placed) view.observer.disconnect();
			return;
		}
		view.placed = true;
		if (overlay.hidden) return;
		if (records.every((record) => overlay.contains(record.target))) return;
		markGreen(view);
	});
	view.observer.observe(body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['hidden', 'open', 'style', 'class', 'data-anyink-hidden'],
	});
}

/** The first button is the screen's green one, unless an open dialog holds it (principle 1). */
function markGreen(view) {
	const first = view.overlay.querySelector('[data-anyink-overlay-action]');
	if (!first) return;
	const dialog = !!openDialogName(view.overlay.ownerDocument);
	first.classList.toggle('anyink-primary', !dialog);
	first.classList.toggle('anyink-outlined', dialog);
}

/** Shows or hides the box, and draws it again for another letter. */
function update(view) {
	const { editor, overlay } = view;
	const shows = overlayShows(editor);
	overlay.hidden = !shows;
	if (overlay.isConnected) view.placed = true;
	const name = letterName(charOf(editor)) || word('check.aLetter');
	const same = isFeatureOn('photo') ? samePhoto(editor) : null;
	const buttons = overlayButtons(isFeatureOn, { samePhoto: !!same, done: !!same?.done });
	const sketch = isFeatureOn('sketch');
	const signature = JSON.stringify([name, buttons, same?.asset || '', sketch]);
	if (signature === view.signature) {
		if (shows) markGreen(view);
		return;
	}
	view.signature = signature;

	overlay.innerHTML = '';
	const box = makeElement({ tag: 'div', className: 'anyink-empty-overlay__box' });
	const title = makeElement({ tag: 'p', className: 'anyink-empty-overlay__title' });
	title.textContent = word('letter.overlay.empty', { name });
	box.setAttribute('role', 'region');
	box.setAttribute('aria-label', title.textContent);
	box.appendChild(title);
	buttons.forEach((id, index) => {
		const { key, run } = BUTTONS[id];
		const button = makeElement({
			tag: 'button',
			className: index === 0 ? 'anyink-primary' : 'anyink-outlined',
			attributes: { type: 'button', 'data-anyink-overlay-action': id },
		});
		button.textContent = word(key);
		const hint = wordEntry(key)?.hint;
		if (hint) button.title = hint;
		button.addEventListener('click', () => run(editor));
		if (id === 'useSamePhoto' && same) {
			box.appendChild(withThumb(button, editor.assets?.get?.(same.asset)?.blob));
		} else if (id === 'sketchIt') {
			box.append(withKey(button, toolKey('sketchLine')), note('sketch.door.sketchItLine'));
		} else {
			box.appendChild(button);
		}
	});
	if (sketch) addSketchLines(box, editor);
	else if (isFeatureOn('photo')) addPhotoLines(box, editor);
	overlay.appendChild(box);
	if (shows) markGreen(view);
}

/** [Use the same photo] with the photo's thumbnail beside it */
function withThumb(button, blob) {
	const row = makeElement({ tag: 'div', className: 'anyink-empty-overlay__same' });
	const canvas = makeElement({
		tag: 'canvas',
		className: 'anyink-empty-overlay__thumb',
		attributes: { 'aria-hidden': 'true' },
	});
	canvas.width = THUMB.width;
	canvas.height = THUMB.height;
	if (blob) paintPhoto(canvas, blob, { fit: 'contain' });
	row.append(button, canvas);
	return row;
}

/** S3: [Sketch it] with its key printed beside it (SKETCH.md 2: every door prints its key) */
function withKey(button, key) {
	if (!key) return button;
	const row = makeElement({ tag: 'div', className: 'anyink-empty-overlay__same' });
	const print = makeElement({
		tag: 'span',
		className: 'anyink-empty-overlay__key',
		attributes: { 'aria-hidden': 'true' },
	});
	print.textContent = key;
	button.setAttribute('aria-keyshortcuts', key);
	row.append(button, print);
	return row;
}

/** A quiet line of words under a door */
function note(key) {
	const line = makeElement({ tag: 'p', className: 'anyink-empty-overlay__note' });
	line.textContent = word(key);
	return line;
}

/** A quiet link: its words key, its data-anyink-overlay-link name, what it does */
function quietLink(key, name, run) {
	const link = makeElement({
		tag: 'button',
		className: 'anyink-empty-overlay__link',
		attributes: { type: 'button', 'data-anyink-overlay-link': name },
	});
	link.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) link.title = hint;
	link.addEventListener('click', run);
	return link;
}

/** More ways folds get their own ids, so aria-controls names the right one */
let foldCount = 0;

/**
 * S3: "or drop a photo here" (with photos), the outline door with its picture, and More ways:
 * a quiet fold with the Brush and "No photo yet? How to take one".
 */
function addSketchLines(box, editor) {
	if (isFeatureOn('photo')) box.appendChild(note('letter.overlay.dropHere'));
	const outline = quietLink('sketch.door.outline', 'outline', () =>
		openSketchDoor(editor, 'outline')
	);
	outline.classList.add('anyink-empty-overlay__link--outline');
	outline.appendChild(outlinePicture(box.ownerDocument));
	box.appendChild(outline);

	const ways = moreWays(isFeatureOn);
	if (!ways.length) return;
	foldCount += 1;
	const fold = makeElement({
		tag: 'div',
		className: 'anyink-empty-overlay__more',
		attributes: { 'data-anyink-overlay-more': '', id: `anyink-overlay-more-${foldCount}` },
	});
	fold.hidden = true;
	ways.forEach((way) => {
		const { key, run } = MORE_WAYS[way];
		fold.appendChild(quietLink(key, way, () => run(editor)));
	});
	const toggle = quietLink('sketch.door.moreWays', 'more', () => {
		fold.hidden = !fold.hidden;
		toggle.setAttribute('aria-expanded', String(!fold.hidden));
	});
	toggle.setAttribute('aria-expanded', 'false');
	toggle.setAttribute('aria-controls', fold.id);
	box.append(toggle, fold);
}

/** "or drop a photo here" and "No photo yet? How to take one" (4.3) */
function addPhotoLines(box, editor) {
	const drop = makeElement({ tag: 'p', className: 'anyink-empty-overlay__note' });
	drop.textContent = word('letter.overlay.dropHere');
	const how = makeElement({
		tag: 'button',
		className: 'anyink-empty-overlay__link',
		attributes: { type: 'button', 'data-anyink-overlay-link': 'how' },
	});
	how.textContent = word('letter.overlay.how');
	how.addEventListener('click', () => openPhotoDoor('how', letterContext(editor)));
	box.append(drop, how);
}

/** The open letter, as the photo screens take it */
function letterContext(editor) {
	return { char: charOf(editor), itemId: editor?.selectedGlyphID || '' };
}

/** The open letter, looked up without making one */
function openLetter(editor) {
	const id = editor?.selectedGlyphID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	return editor.project.getItem(id) || null;
}

function charOf(editor) {
	const item = openLetter(editor);
	if (item?.char) return item.char;
	const code = parseInt(String(editor?.selectedGlyphID || '').replace(/^glyph-/, ''), 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}
