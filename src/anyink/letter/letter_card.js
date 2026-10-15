// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: the letter card (UX-BEGINNER.md 4.3 "Letter card sections"), in the panel slot of the
	Simple letter view (panels.js; nav.panel stays 'Attributes' or 'Trace'). A section shows only
	when it applies; nothing is greyed out.

	  Header         always: the letter's name and its state, "Empty" or "Ready" (B11 adds
	                 "Needs a look: <reason>" with [Looks fine to me]). Ready means ink: a
	                 finished shape with an area (spacing/outline.js inkPaths). The shape the
	                 Point pen is still drawing isn't finished, and a stray line (two clicked
	                 points) has no area, so one click never makes a letter Ready
	  Main buttons   the letter has shapes and no photo card step is open: [Trace again] (photos,
	                 B9, only when the letter has a photo), [Draw over it] (the Brush, B8). Until
	                 those flags are on there are none, and the section isn't drawn
	  Fine-tune this letter   the letter has finished shapes. Closed by default; stays as he left
	                 it for the session (view_switches.js). Inside:
	    Shapes       one row per finished shape, "Shape 1 · Solid"; a row picks its shape; the
	                 picked shape gets a [Solid | Hole] switch. "Shape options" (closed): Merge
	                 overlapping shapes (two shapes with ink or more), Flip left-right, Flip
	                 upside-down, Clear letter. Merge is the card's own and happens in the press:
	                 a merge that would leave the letter as it is ("No shapes overlap, so nothing
	                 changed.") records no step
	    Spacing      "Automatic. Drag the purple edges to set it yourself." or "Set by you."
	                 [Back to automatic]. A letter nobody has decided yet (no owner flag) is
	                 automatic while it has no ink: B3 makes it automatic at its first ink
	    This point   Edit points with one point picked: [Smooth] [Corner]
	    "Open in More tools" (a link)
	  B9 adds Fine-tune > Photo and Tail, and the photo card; B8 the Brush section.
	Every change is one Undo step with a plain title (2.2): Merge, Flip, Clear letter and Back to
	automatic name the letter (7.3); Solid / Hole and Smooth / Corner write the letter-tools
	track's titles. Clear letter says so in a toast with [Undo] (7.3: destructive actions use an
	Undo toast, never a confirm). An empty letter's card has no buttons: the canvas overlay holds them
	(empty_overlay.js), so nothing on screen is repeated.

	The card is drawn again only when what it shows changed (a signature of letterCardState), so
	a drag on the canvas never rebuilds it under the pointer. It looks again after every step
	(the save status hears each one, SAVE_STATUS_EVENT), since not every action that records one
	tells the editor, and once more when the press that told it is done (the Point pen says it
	switched tools before it lets go of the shape it closed). Solid or hole is worked out when a
	step is recorded or the shapes change, never on a drag tick: telling them apart tests every
	pair of shapes, and a drag tells the editor two or more times a tick. Until the drag ends
	the rows keep the kinds they had.

	Pure:
	  letterCardState(editor)      what the card shows, read from the editor
	  cardSections(state, isOn)    ['header', 'main'?, 'fineTune'?]
	  mainButtons(state, isOn)     ['traceAgain'?, 'drawOver'?]
	  fineTuneParts(state)         ['shapes', 'spacing', 'point'?, 'moreTools']
	  shapeOptions(state)          ['merge'?, 'flipLeftRight', 'flipUpsideDown', 'clear']
	  shapeKinds(item)             'solid' | 'hole' | 'part' per shape (auto_hole.js shapeRole;
	                               'part' for a reusable part, More tools only)
	  openShapeOf(editor)          the shape the Point pen is still drawing, or null
	  letterInk(item, editor)      the letter's ink, without that shape (Ready, and the empty
	                               overlay's "empty", read this)
	  spacingShown(item)           'auto' | 'manual': what Spacing says
	  sameOutlines(a, b)           true when two lists of shapes draw the same outlines (order,
	                               direction and starting point aside), to whole units
	The Solid / Hole switch and This point use the letter-tools track's auto_hole.js
	(setShapeRole) and point_kind.js (setPickedPointKind), and their words (letterTools.*).
	DOM:
	  makeLetterCard(editor)       the card; follows the editor (subscriber 'anyink.letter.card')
	  TRACE_AGAIN_EVENT            window event [Trace again] sends, detail { itemId }: B9's
	                               photo dialog opens on it
	  resetLetterCardForTests(), kindsWorkForTests() (how many times solid or hole was worked
	                               out, for the drag test)
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { inkOf } from '../board/letter_set.js';
import { openPathOf } from '../coach/open_shape.js';
import { selectTool } from '../../edit_canvas/tools/tools.js';
import { combinePaths } from '../../project_editor/boolean_combine.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { isFeatureOn } from '../mode/features.js';
import { switchMode } from '../mode/switch.js';
import { undoOffer } from '../history/undo_toast.js';
import { inkPaths } from '../spacing/outline.js';
import { getSpacingOwner, hasSpacingOwner, markAuto } from '../spacing/owner.js';
import { toast } from '../toast/toast.js';
import { getTrace } from '../trace/trace_model.js';
import { letterName } from '../words/letter_name.js';
import { word, wordEntry } from '../words/words.js';
import { canBeHole, isBrushStroke, setShapeRole, shapeRole } from './auto_hole.js';
import { pickedPoint, pointKind, setPickedPointKind } from './point_kind.js';
import { isFineTuneOpen, setFineTuneOpen } from './view_switches.js';

export const CARD_SUBSCRIBER = 'anyink.letter.card';
export const TRACE_AGAIN_EVENT = 'anyink-trace-again';

/** What the card follows */
const CARD_TOPICS = [
	'currentItem',
	'whichGlyphIsSelected',
	'whichShapeIsSelected',
	'whichPathPointIsSelected',
	'whichToolIsSelected',
	'editCanvasView',
	'traceLayer',
];

/** The drawing tools whose picked point gets This point */
const POINT_TOOL = 'pathEdit';

/** Shape options: closed by default, as he left it for the session */
let shapeOptionsOpen = false;

/** The card on screen (the letter view has one); the step listener draws it again */
let liveView = null;
let listeningForSteps = false;

/** How many times solid or hole was worked out (a whole letter, or one picked shape) */
let kindsWork = 0;

export function resetLetterCardForTests() {
	shapeOptionsOpen = false;
	liveView = null;
	kindsWork = 0;
}

/** @returns {Number} */
export function kindsWorkForTests() {
	return kindsWork;
}

// --------------------------------------------------------------
// What the card shows (pure)
// --------------------------------------------------------------

/**
 * @param {Object} [editor] - default: the current project editor
 * @returns {Object} { itemId, char, name, status ('ready' with ink, else 'empty'), hasShapes
 *   (finished shapes), hasPhoto, photoCardOpen, shapes: [{ index (in item.shapes), kind, picked,
 *   fixed, holeable }] (finished shapes only), mergeable (how many Merge would work on),
 *   spacing, tool, point: { kind } | null, fineTuneOpen, shapeOptionsOpen }
 */
export function letterCardState(editor = getCurrentProjectEditor()) {
	const item = openLetter(editor);
	const open = openShapeOf(editor);
	// Solid or hole shows only inside Fine-tune; worked out only then, and again only when a
	// step was recorded or the shapes changed (a pan, a zoom or a drag tick asks the card too)
	const known = isFineTuneOpen() && item ? kindsOf(item, editor) : null;
	const pickedShape = singleton(editor?.multiSelect?.shapes);
	const point = pickedPoint(editor);
	const char = charOf(editor, item);
	const shapes = [];
	(item?.shapes || []).forEach((shape, index) => {
		// the shape the Point pen is still drawing is listed once it is finished
		if (shape === open) return;
		shapes.push({
			index,
			kind: known?.kinds[index] || '',
			picked: shape === pickedShape,
			// brush strokes are always ink (7.1 #5): no Solid / Hole switch
			fixed: isBrushStroke(shape),
			// B6 + B7 integration: a shape with nothing around it can't show a hole either way
			// round, so the picked one gets the switch only when Hole would do something
			holeable: !!known && shape === pickedShape && isPath(shape) && holeable(known, item, shape),
		});
	});
	return {
		itemId: editor?.selectedGlyphID || null,
		char,
		name: letterName(char) || word('check.aLetter'),
		status: letterInk(item, editor).length ? 'ready' : 'empty',
		hasShapes: shapes.length > 0,
		hasPhoto: !!getTrace(item),
		// B9's photo card says when one of its steps is open
		photoCardOpen: false,
		shapes,
		mergeable: mergeablePaths(item, editor).length,
		spacing: spacingShown(item),
		tool: editor?.selectedTool || '',
		point: point ? { kind: pointKind(point) } : null,
		fineTuneOpen: isFineTuneOpen(),
		shapeOptionsOpen,
	};
}

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Object | null} the shape the Point pen is still placing points on (new_path.js
 *   Tool_NewPath.newPath), or null (coach/open_shape.js openPathOf, the one reader)
 */
export function openShapeOf(editor) {
	return openPathOf(editor);
}

/**
 * The letter's ink: its shapes with an area (spacing/outline.js inkPaths, so a stray line of two
 * clicked points is none), without the shape the Point pen is still drawing. A letter is Ready
 * once it has some (B11 adds its checks), never at the first click of a shape. B6 + B7
 * finalize: the rule is board/letter_set.js's, which the rail and the Next line read too.
 * @param {Object} item - Glyph
 * @param {Object} editor - ProjectEditor
 * @returns {Array<Object>} paths
 */
export function letterInk(item, editor) {
	return inkOf(item, { open: openPathOf(editor) });
}

/**
 * What Spacing says (7.2). A letter with an owner says its owner. Nobody has decided a letter
 * with no owner yet: it is automatic while it has no ink, since B3 makes a letter automatic at
 * its first ink in Simple (spacing/history_hook.js, the step that gives it an area), and set by
 * him once it has ink with no owner, as an old or imported letter is (never re-spaced behind
 * his back).
 * @param {Object} item - Glyph
 * @returns {'auto' | 'manual'}
 */
export function spacingShown(item) {
	if (hasSpacingOwner(item)) return getSpacingOwner(item);
	return inkPaths(item).length ? 'manual' : 'auto';
}

/**
 * @param {Object} state - letterCardState
 * @param {(flag: String) => Boolean} [isOn]
 * @returns {Array<String>}
 */
export function cardSections(state, isOn = isFeatureOn) {
	const sections = ['header'];
	if (state.hasShapes && !state.photoCardOpen && mainButtons(state, isOn).length) {
		sections.push('main');
	}
	if (state.hasShapes) sections.push('fineTune');
	return sections;
}

/**
 * @param {Object} state - letterCardState
 * @param {(flag: String) => Boolean} [isOn]
 * @returns {Array<'traceAgain' | 'drawOver'>}
 */
export function mainButtons(state, isOn = isFeatureOn) {
	if (!state.hasShapes || state.photoCardOpen) return [];
	const buttons = [];
	if (isOn('photo') && state.hasPhoto) buttons.push('traceAgain');
	if (isOn('brush')) buttons.push('drawOver');
	return buttons;
}

/**
 * @param {Object} state - letterCardState
 * @returns {Array<'shapes' | 'spacing' | 'point' | 'moreTools'>}
 */
export function fineTuneParts(state) {
	const parts = ['shapes', 'spacing'];
	if (state.tool === POINT_TOOL && state.point) parts.push('point');
	parts.push('moreTools');
	return parts;
}

/**
 * @param {{shapes: Array}} state
 * @returns {Array<'merge' | 'flipLeftRight' | 'flipUpsideDown' | 'clear'>}
 */
export function shapeOptions(state) {
	const options = [];
	// two shapes with ink (letterCardState counts them); a bare state counts its shapes
	if ((state.mergeable ?? (state.shapes || []).length) >= 2) options.push('merge');
	options.push('flipLeftRight', 'flipUpsideDown', 'clear');
	return options;
}

/**
 * Solid or hole, per shape, as the canvas and the font file fill them (auto_hole.js shapeRole:
 * a hole's way round cancels the shapes it sits inside).
 * @param {Object} item - Glyph ({ shapes })
 * @returns {Array<'solid' | 'hole' | 'part'>} 'part' for a reusable part (More tools only)
 */
export function shapeKinds(item) {
	const shapes = item?.shapes || [];
	return shapes.map((shape) => (isPath(shape) ? shapeRole(item, shape) : 'part'));
}

/**
 * item -> what was worked out last: { shapes (the list, by identity), mark (stepMark), kinds,
 * holes: Map(shape -> canBeHole) }
 */
const kindsCache = new WeakMap();

/**
 * Solid or hole per shape, kept until a step is recorded (the pointer let go, Undo, Redo) or
 * the shapes themselves change; a drag tick keeps them. Fix pass: they were worked out again
 * whenever a point moved, every pair of shapes on every 'currentItem' of a drag.
 * @param {Object} item - Glyph
 * @param {Object} editor - ProjectEditor
 * @returns {{kinds: Array<String>, holes: Map}}
 */
function kindsOf(item, editor) {
	const shapes = item.shapes || [];
	const mark = stepMark(editor);
	const known = kindsCache.get(item);
	if (known && sameMembers(known.shapes, shapes) && sameMembers(known.mark, mark)) return known;
	kindsWork++;
	const fresh = { shapes: [...shapes], mark, kinds: shapeKinds(item), holes: new Map() };
	kindsCache.set(item, fresh);
	return fresh;
}

/** Whether the picked shape can be a hole, asked once per shape until the kinds change. */
function holeable(known, item, shape) {
	if (!known.holes.has(shape)) {
		kindsWork++;
		known.holes.set(shape, canBeHole(item, shape));
	}
	return known.holes.get(shape);
}

/**
 * The Undo list as it stands: a new step, an Undo or a Redo changes it; a drag tick doesn't.
 * @param {Object} editor
 * @returns {Array}
 */
function stepMark(editor) {
	const history = editor?.history;
	if (!history) return [];
	return [history.queue?.[0], history.queue?.length, history.redoQueue?.length];
}

/** @returns {Boolean} the same members, in the same order (by identity) */
function sameMembers(a, b) {
	return a.length === b.length && a.every((member, index) => member === b[index]);
}

/**
 * The letter's own drawn shapes that Merge works on: paths with ink, not the one the Point pen
 * is still drawing. Reusable parts (More tools) and stray lines are left as they are.
 * @param {Object} item - Glyph
 * @param {Object} editor - ProjectEditor
 * @returns {Array<Object>} paths, in the letter's order
 */
function mergeablePaths(item, editor) {
	if (!item) return [];
	const ink = new Set(letterInk(item, editor));
	return (item.shapes || []).filter((shape) => isPath(shape) && ink.has(shape));
}

/**
 * Two lists of shapes draw the same outlines: the same sides, whichever way round each goes and
 * wherever it starts (the boolean merge hands back an untouched letter turned round), in any
 * order, to whole units (7.2).
 * @param {Array<Object>} a - paths
 * @param {Array<Object>} b - paths
 * @returns {Boolean}
 */
export function sameOutlines(a, b) {
	if (a.length !== b.length) return false;
	const keys = (paths) => paths.map(outlineKey).sort();
	const before = keys(a);
	const after = keys(b);
	return before.every((key, index) => key === after[index]);
}

/** One outline as its sides (point, handle, handle, point), each the same both ways round */
function outlineKey(path) {
	const points = path?.pathPoints || [];
	const at = (control) => `${Math.round(control.x)},${Math.round(control.y)}`;
	return points
		.map((point, index) => {
			const next = points[(index + 1) % points.length];
			const forward = [at(point.p), at(point.h2), at(next.h1), at(next.p)].join(' ');
			const back = [at(next.p), at(next.h1), at(point.h2), at(point.p)].join(' ');
			return forward < back ? forward : back;
		})
		.sort()
		.join(';');
}

// --------------------------------------------------------------
// The card on screen
// --------------------------------------------------------------

/**
 * @param {Object} [editor]
 * @returns {HTMLElement}
 */
export function makeLetterCard(editor = getCurrentProjectEditor()) {
	const card = makeElement({ tag: 'section', className: 'anyink-letter-card' });
	const view = { editor, card, signature: '', lookAgain: false };
	render(view);
	liveView = view;
	editor.subscribe({
		topic: CARD_TOPICS,
		subscriberID: CARD_SUBSCRIBER,
		callback: () => follow(view),
	});
	listenForSteps();
	return card;
}

/**
 * Draws the card for what the editor said, and once more when the press that said it is done:
 * the Point pen tells the editor it switched tools, then lets go of the shape it closed.
 */
function follow(view) {
	if (!view.card.isConnected) return;
	render(view);
	if (view.lookAgain) return;
	view.lookAgain = true;
	queueMicrotask(() => {
		view.lookAgain = false;
		if (view.card.isConnected) render(view);
	});
}

/**
 * Every recorded step changes the save status, which says so on the window: the card looks
 * again, since not every action that records a step tells the editor (upstream's own Merge
 * didn't). One listener for the app; it draws the card on screen.
 */
function listenForSteps() {
	if (listeningForSteps || typeof globalThis.addEventListener !== 'function') return;
	listeningForSteps = true;
	globalThis.addEventListener(SAVE_STATUS_EVENT, (event) => {
		const view = liveView;
		if (!view?.card.isConnected) return;
		const changed = event?.detail?.editor;
		if (changed && changed !== view.editor) return;
		render(view);
	});
}

/** Draws the card again when what it shows changed. */
function render(view) {
	const state = letterCardState(view.editor);
	const signature = JSON.stringify([state, flagsSeen()]);
	if (signature === view.signature) return;
	view.signature = signature;

	const { card, editor } = view;
	card.innerHTML = '';
	card.dataset.anyinkCardState = state.status;
	const builders = {
		header: () => makeHeader(state),
		main: () => makeMainButtons(state),
		fineTune: () => makeFineTune(state, editor, view),
	};
	cardSections(state).forEach((section) => {
		const element = builders[section]();
		element.dataset.anyinkCard = section;
		card.appendChild(element);
	});
}

/** The flags the card reads, so turning one on in a test page draws it again */
function flagsSeen() {
	return ['brush', 'photo'].map((flag) => isFeatureOn(flag));
}

function makeHeader(state) {
	const header = makeElement({ tag: 'div', className: 'anyink-letter-card__header' });
	const name = makeElement({ tag: 'h3', className: 'anyink-letter-card__name' });
	name.textContent = state.name;
	const key = `letter.state.${state.status}`;
	const chip = makeElement({
		tag: 'span',
		className: 'anyink-letter-card__state',
		attributes: { 'data-anyink-state': state.status, title: hintOf(key) },
	});
	chip.textContent = word(key);
	header.appendChild(name);
	header.appendChild(chip);
	return header;
}

function makeMainButtons(state) {
	const row = makeElement({ tag: 'div', className: 'anyink-letter-card__buttons' });
	const actions = {
		traceAgain: () =>
			globalThis.dispatchEvent?.(
				new CustomEvent(TRACE_AGAIN_EVENT, { detail: { itemId: state.itemId } })
			),
		drawOver: () => selectTool('nib'),
	};
	const keys = { traceAgain: 'letter.action.traceAgain', drawOver: 'letter.action.drawOver' };
	mainButtons(state).forEach((name) => {
		row.appendChild(actionButton(name, keys[name], actions[name]));
	});
	return row;
}

function makeFineTune(state, editor, view) {
	const section = makeElement({ tag: 'div', className: 'anyink-letter-card__fine-tune' });
	const toggle = disclosure('fineTune', word('letter.fineTune'), state.fineTuneOpen, () => {
		setFineTuneOpen(!isFineTuneOpen(), editor);
		// the editor tells the card (editCanvasView); a card no subscriber reaches draws itself
		render(view);
	});
	toggle.title = hintOf('letter.fineTune');
	section.appendChild(toggle);
	if (!state.fineTuneOpen) return section;

	const body = makeElement({ tag: 'div', className: 'anyink-letter-card__fine-body' });
	const parts = {
		shapes: () => makeShapes(state, editor, view),
		spacing: () => makeSpacing(state, editor),
		point: () => makePoint(state, editor),
		moreTools: () => makeMoreTools(editor),
	};
	fineTuneParts(state).forEach((part) => {
		const element = parts[part]();
		element.dataset.anyinkFine = part;
		body.appendChild(element);
	});
	section.appendChild(body);
	return section;
}

function makeShapes(state, editor, view) {
	const part = fineTunePart('letter.fineTune.shapes');
	const list = makeElement({ tag: 'div', className: 'anyink-letter-card__shapes' });
	state.shapes.forEach((shape) => {
		const row = makeElement({ tag: 'div', className: 'anyink-letter-card__shape' });
		if (shape.picked) row.classList.add('anyink-letter-card__shape--picked');
		const number = shape.index + 1;
		const pick = makeElement({
			tag: 'button',
			className: 'anyink-letter-card__shape-pick',
			attributes: {
				type: 'button',
				'data-anyink-shape-row': String(shape.index),
				'aria-pressed': String(shape.picked),
				title: word('letter.shape.pick', { number }),
			},
		});
		const kind = shape.kind === 'part' ? '' : ` · ${word(`letterTools.role.${shape.kind}`)}`;
		pick.textContent = `${word('letter.shape.row', { number })}${kind}`;
		pick.addEventListener('click', () => pickShape(editor, shape.index));
		row.appendChild(pick);
		const switchable = shape.holeable || shape.kind === 'hole';
		if (shape.picked && shape.kind !== 'part' && !shape.fixed && switchable) {
			row.appendChild(kindSwitch(shape, editor));
		}
		list.appendChild(row);
	});
	part.appendChild(list);

	const options = makeElement({ tag: 'div', className: 'anyink-letter-card__options' });
	options.appendChild(
		disclosure('shapeOptions', word('letter.shapeOptions'), state.shapeOptionsOpen, () => {
			shapeOptionsOpen = !shapeOptionsOpen;
			render(view);
		})
	);
	if (state.shapeOptionsOpen) {
		const row = makeElement({ tag: 'div', className: 'anyink-letter-card__buttons' });
		const actions = {
			merge: () => mergeShapes(editor),
			flipLeftRight: () => flip(editor, 'flipEW', 'letter.step.flipLeftRight'),
			flipUpsideDown: () => flip(editor, 'flipNS', 'letter.step.flipUpsideDown'),
			clear: () => clearLetter(editor),
		};
		const keys = {
			merge: 'letter.action.merge',
			flipLeftRight: 'letter.action.flipLeftRight',
			flipUpsideDown: 'letter.action.flipUpsideDown',
			clear: 'letter.action.clear',
		};
		shapeOptions(state).forEach((name) => {
			row.appendChild(actionButton(name, keys[name], actions[name]));
		});
		options.appendChild(row);
	}
	part.appendChild(options);
	return part;
}

function kindSwitch(shape, editor) {
	const group = makeElement({
		tag: 'div',
		className: 'anyink-segmented',
		attributes: {
			role: 'group',
			'aria-label': word('letter.shape.kindLabel'),
			'data-anyink-kind-switch': String(shape.index),
		},
	});
	['solid', 'hole'].forEach((kind) => {
		const key = `letterTools.role.${kind}`;
		const button = makeElement({
			tag: 'button',
			className: 'anyink-segmented__option',
			attributes: {
				type: 'button',
				'data-anyink-kind': kind,
				'aria-pressed': String(shape.kind === kind),
				title: hintOf(key),
			},
		});
		button.textContent = word(key);
		button.addEventListener('click', () => setShapeKind(editor, shape.index, kind));
		group.appendChild(button);
	});
	return group;
}

function makeSpacing(state, editor) {
	const part = fineTunePart('letter.fineTune.spacing');
	const text = makeElement({ tag: 'p', className: 'anyink-letter-card__text' });
	const auto = state.spacing === 'auto';
	text.textContent = word(auto ? 'letter.spacing.auto' : 'letter.spacing.manual');
	part.appendChild(text);
	if (!auto) {
		part.appendChild(
			actionButton('backToAuto', 'letter.action.backToAuto', () => backToAutomatic(editor))
		);
	}
	return part;
}

function makePoint(state, editor) {
	const part = fineTunePart('letterTools.point.heading');
	const group = makeElement({
		tag: 'div',
		className: 'anyink-segmented',
		attributes: { role: 'group', 'aria-label': word('letterTools.point.heading') },
	});
	['smooth', 'corner'].forEach((kind) => {
		const key = `letterTools.point.${kind}`;
		const button = makeElement({
			tag: 'button',
			className: 'anyink-segmented__option',
			attributes: {
				type: 'button',
				'data-anyink-point': kind,
				'aria-pressed': String(state.point?.kind === kind),
				title: hintOf(key),
			},
		});
		button.textContent = word(key);
		button.addEventListener('click', () => setPickedPointKind(editor, kind));
		group.appendChild(button);
	});
	part.appendChild(group);
	return part;
}

function makeMoreTools(editor) {
	const part = makeElement({ tag: 'div', className: 'anyink-letter-card__more-tools' });
	const link = makeElement({
		tag: 'button',
		className: 'anyink-letter-card__link',
		attributes: {
			type: 'button',
			'data-anyink-action': 'moreTools',
			title: hintOf('letter.action.moreTools'),
		},
	});
	link.textContent = word('letter.action.moreTools');
	link.addEventListener('click', () => switchMode('all', { editor }));
	part.appendChild(link);
	return part;
}

// --------------------------------------------------------------
// Changes (each one Undo step)
// --------------------------------------------------------------

/**
 * Picks one shape, as a row of the Shapes list. A row already picked stays picked (upstream's
 * select() lets go of a shape picked already, which a row press must never do).
 */
function pickShape(editor, index) {
	const shape = openLetter(editor)?.shapes?.[index];
	if (!shape) return;
	// B6 + B7 finalize: the row picks the whole shape: picked points let go, so Delete takes the
	// shape the card shows picked, even with Edit points picked (7.6)
	editor.multiSelect.points.clear();
	const picked = editor.multiSelect.shapes;
	if (!(picked.count === 1 && picked.singleton === shape)) picked.select(shape);
	editor.publish('whichShapeIsSelected', shape);
}

/** Solid or hole, for the picked shape (auto_hole.js turns it round when that shows it). */
function setShapeKind(editor, index, kind) {
	const item = openLetter(editor);
	const shape = item?.shapes?.[index];
	if (!isPath(shape) || !setShapeRole(item, shape, kind)) return;
	const key = kind === 'hole' ? 'letterTools.step.madeHole' : 'letterTools.step.madeSolid';
	editor.history.addState(word(key, { number: index + 1 }));
	editor.publish('currentItem', editor.selectedItem);
}

/**
 * Merge overlapping shapes, in the press: the letter's drawn shapes with ink are united where
 * they overlap, in one Undo step named for the letter, on whole-number points (7.2), with a
 * toast that says it. When nothing overlaps (a B with its two holes) the merge would hand the
 * same outlines back: the letter is left exactly as it was, no step is recorded and the toast
 * says nothing changed (principle 6). Fix pass: the card used upstream's
 * combineUniteAllGlyphPaths, which toasted first and merged 200 ms later in a timer; the card
 * drew itself in between ("Capital B · Empty") and an Undo step "merged the shapes" was added
 * for a merge that changed nothing.
 * @param {Object} editor - ProjectEditor
 */
function mergeShapes(editor) {
	const item = openLetter(editor);
	if (!item) return;
	const name = nameOf(item, editor);
	const paths = mergeablePaths(item, editor);
	if (paths.length < 2) {
		toast('letter.toast.nothingToMerge', {}, { group: MERGE_TOAST_GROUP });
		return;
	}
	const merged = combinePaths(paths, 'unite');
	if (!Array.isArray(merged) || !merged.length) {
		toast('letter.toast.mergeFailed', {}, { group: MERGE_TOAST_GROUP });
		return;
	}
	if (sameOutlines(paths, merged)) {
		toast('letter.toast.nothingToMerge', {}, { group: MERGE_TOAST_GROUP });
		return;
	}
	editor.multiSelect.points.clear();
	editor.multiSelect.shapes.clear();
	replaceShapes(item, paths, merged);
	record(editor, item, 'letter.step.merged');
	toast('letter.toast.merged', { name }, { group: MERGE_TOAST_GROUP });
}

/** Merge's toasts take each other's place */
const MERGE_TOAST_GROUP = 'anyinkLetterMerge';

/**
 * Takes `paths` out of the letter and puts `merged` where the first of them was; every other
 * shape (a part, a stray line, the one the Point pen is drawing) stays the same object, in its
 * place. The merged shapes get whole-number points.
 * @param {Object} item - Glyph
 * @param {Array<Object>} paths - shapes of the letter
 * @param {Array<Object>} merged - new paths
 */
function replaceShapes(item, paths, merged) {
	const list = item.shapes;
	const at = list.indexOf(paths[0]);
	paths.forEach((path) => list.splice(list.indexOf(path), 1));
	const added = merged.map((path) => item.addOneShape(path));
	list.splice(list.length - added.length, added.length);
	list.splice(at, 0, ...added);
	added.forEach((path) => path.roundAll(0));
	item.changed();
}

/** Flips the whole letter about its middle; whole-number points (7.2). */
function flip(editor, method, key) {
	const item = openLetter(editor);
	if (!item?.shapes?.length) return;
	item[method]();
	item.roundAll?.(0);
	record(editor, item, key);
}

function clearLetter(editor) {
	const item = openLetter(editor);
	if (!item?.shapes?.length) return;
	const name = nameOf(item, editor);
	editor.multiSelect.points.clear();
	editor.multiSelect.shapes.clear();
	item.shapes = [];
	record(editor, item, 'letter.step.cleared');
	// B6 + B7 finalize: its [Undo] takes back this clear, and only while it is the newest change
	toast('letter.toast.cleared', { name }, { kind: 'destructive', ...undoOffer(editor) });
}

/** Spacing is ANY-INK's again: the step's refit hook fits it (B3, Simple). */
function backToAutomatic(editor) {
	const item = openLetter(editor);
	if (!item) return;
	markAuto(item);
	record(editor, item, 'letter.step.backToAuto');
}

/** One Undo step named in plain words, then the canvas and the card follow. */
function record(editor, item, key, vars = {}) {
	editor.history.addState(word(key, { ...vars, name: nameOf(item, editor) }));
	editor.publish('currentItem', editor.selectedItem);
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

/**
 * A disclosure button: "> Fine-tune this letter" (closed) / "v ..." (open).
 * @param {String} id - data-anyink-toggle
 * @param {String} text
 * @param {Boolean} open
 * @param {Function} onToggle
 * @returns {HTMLElement}
 */
function disclosure(id, text, open, onToggle) {
	const button = makeElement({
		tag: 'button',
		className: 'anyink-disclosure',
		attributes: { type: 'button', 'data-anyink-toggle': id, 'aria-expanded': String(open) },
	});
	button.appendChild(
		makeElement({
			tag: 'span',
			className: 'anyink-disclosure__chevron',
			attributes: { 'aria-hidden': 'true' },
		})
	);
	const label = makeElement({ tag: 'span', className: 'anyink-disclosure__label' });
	label.textContent = text;
	button.appendChild(label);
	button.addEventListener('click', onToggle);
	return button;
}

/** An outlined button (the one green button is the Next line's or the overlay's, principle 1). */
function actionButton(name, key, onClick) {
	const button = makeElement({
		tag: 'button',
		className: 'anyink-letter-card__button',
		attributes: { type: 'button', 'data-anyink-action': name },
	});
	button.textContent = word(key);
	const hint = hintOf(key);
	if (hint) button.title = hint;
	button.addEventListener('click', onClick);
	return button;
}

function fineTunePart(titleKey) {
	const part = makeElement({ tag: 'div', className: 'anyink-letter-card__part' });
	const title = makeElement({ tag: 'h4', className: 'anyink-letter-card__part-title' });
	title.textContent = word(titleKey);
	part.appendChild(title);
	return part;
}

/** @param {String} key */
function hintOf(key) {
	return wordEntry(key)?.hint || '';
}

/** The open letter, looked up without making one */
function openLetter(editor) {
	const id = editor?.selectedGlyphID;
	if (!id || typeof editor?.project?.getItem !== 'function') return null;
	return editor.project.getItem(id) || null;
}

function charOf(editor, item) {
	if (item?.char) return item.char;
	const hex = String(editor?.selectedGlyphID || '').replace(/^glyph-/, '');
	const code = parseInt(hex, 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}

function nameOf(item, editor) {
	return letterName(charOf(editor, item)) || word('check.aLetter');
}

/** The one member of a multi-select, or null */
function singleton(selection) {
	if (!selection) return null;
	try {
		return selection.count === 1 ? selection.singleton || null : null;
	} catch {
		return null;
	}
}

function isPath(shape) {
	return shape?.objType === 'Path';
}
