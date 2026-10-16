// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10: the letter board, home in Simple (UX-BEGINNER.md 4.2). In Simple with the 'board' flag on,
	the Overview page (pages/overview.js; the page id stays 'Overview', where the logo, "1 Letters"
	and "<- All letters" go: topbar/letters_page.js) is this board, across the whole page. It takes
	the place of B5's stand-in, the Welcome card and the 95 tiles of every Basic Latin letter, which
	the rail's "7/58" and the Next line contradicted.

	  Your letters   7 of 58 ready   [#####.............]   the one progress line
	  Show: (All 58) (Needs a look 1) (Empty 51)     [Use a photo...] [Letter spacing...] [+ ...]
	  Capitals   2 of 26                             a section's count once it has a ready
	  [B] [H] [A] [C] ...                            letter; a check mark once all are ready
	  Small letters ...
	  Punctuation ...   The space between words is made for you.
	  Numbers & symbols (with "+ Numbers & symbols" on)
	The toolbar (4.2): Use a photo... (with 'photo'; the photo screens' picker, then the photo
	dialog with the letter unknown), Letter spacing... (with B12's 'tryIt' and 3 ready letters: the
	Next line's 'tryIt' action, { open: 'letterSpacing' }), + / - Numbers & symbols (letter_set.js
	toggleNumbers: one settings Undo step). Every button on the board is outlined; the one green
	button is the Next line's (principle 1).

	The tiles are the board-tiles track's (tile_state.js makeBoardTile, updateBoardTile: GlyphTile
	with the board's states, caption and tooltip), in board order (letter_set.js). A press on a
	tile opens that letter (preview/show_item.js, the way Show me opens one: looking around, never
	an Undo step, 7.3). Typing a letter, the arrows and Enter are board_keys.js's; drops are
	board_drop.js's.

	One truth (D-037): every count and every tile reads the one rule for ink and Ready
	(letter_set.js hasInk, through tile_state.js tileStateOf), and "Needs a look" is the Next
	line's own: B11's checks as the app coach read them (its state's letters), only while
	'checks' is on. So the board and the Next line never disagree, and the rail agrees once it
	counts with readyRuleFor (until B11's checks the rail's ink rule is the same). Until B11,
	Ready is ink and the filters stay hidden (filters.js).

	Keeping up without moving the page: the board draws again a frame after a change (every Undo
	step, Undo and Redo, a letter's change, the font check, the coach's state), and only what
	changed: a tile whose state, ink or photo didn't change is left as it is, so the focus the
	arrow keys gave it stays, and a drawing with nothing changed touches nothing. Measured in
	Chrome (tests/board.html): all 58 tiles anew about 3.5 ms, after one letter's change about
	0.3 ms (16 ms is one frame; updateBoard returns the ms it took).

	What it remembers this session, per font (the editor's History, as the coach does): the letter
	he had open last (the green ring and the tab stop, and "<- All letters" scrolls to it), and
	which sections were finished, so a section that finishes says so once ("All small letters done.
	Your font can type words now."), wherever he is when it happens. Never in the font.

	Fix pass (critic):
	  - the filter he picked ends when he leaves the board (a letter, Help, a More tools page, a
	    switch to All tools) and when the filters hide (filters.js settleBoardFilter, each
	    drawing), so the board always opens on All and a later amber letter never finds it
	    filtered to that one tile; the Next line is told, since rule 9 reads the filter
	    (shots/d6-board-after-new-amber.png);
	  - "+ Numbers & symbols" always shows what it added: when the section is new since the
	    font's last drawing (the toolbar, rule 16's button, Redo), the board goes back to All,
	    scrolls the section into view and marks it for a moment (data-anyink-new, board.css);
	    rule 16's button pressed in a letter goes to the board to show it
	    (shots/46-numbers-added.png).

	  BOARD_SUBSCRIBER         'anyink.board.pageRender' (a substring of no other id)
	  isBoardOn()              Simple with 'board' on
	  makeBoardPage(editor)    the Overview page in Simple: the board, nothing to its left
	  makeBoard(editor)        the board element, kept up to date while it is on the page
	  updateBoard(board)       draws it again now (only what changed); returns the ms it took
	  boardState(board)        { summary, filter, ms } of the last drawing, for tests and pages
	  shownTiles(board)        its tiles on the page, in page order; tileOf(board, char)
	  openLetterFromBoard(editor, char)   opens that letter, as a tile press does
	  lastTouchedOnBoard(editor)          the letter he had open last ('' for none)
	  readyRuleFor(editor)     the board's Ready rule, for the rail's count (readyCount isReady)
	  installBoard()           once (also on the first board): the Next line's 'showNeedsLook'
	                           (rule 9's [Show me]) and 'addNumbers' (rule 16), the finished-section
	                           toasts (watched at each step) and the letter he had open last.
	                           app/main.js may call it at boot, so a section finished before the
	                           board ever showed still says so
	  resetBoardForTests()
*/
import './board.css';
import { getCurrentProjectEditor } from '../../app/main.js';
import { charToHex } from '../../common/character_ids.js';
import { hasCoachAction, runCoachAction, setCoachAction } from '../coach/actions.js';
import { getCoach } from '../coach/coach_state.js';
import { letterFingerprint, letterItem } from '../coach/font_facts.js';
import { openPathOf } from '../coach/open_shape.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { showItem } from '../preview/show_item.js';
import { toast } from '../toast/toast.js';
import { goToLetters, LETTERS_PAGE } from '../topbar/letters_page.js';
import { getTrace } from '../trace/trace_model.js';
import { word, wordEntry } from '../words/words.js';
import {
	endBoardFilter,
	filtersShown,
	getBoardFilter,
	makeFilterBar,
	makeLookFixes,
	setBoardFilter,
	settleBoardFilter,
	shownFilter,
	tileShows,
} from './filters.js';
import {
	boardLetters,
	hasInk,
	numbersShown,
	setNumbersShown,
	toggleNumbers,
} from './letter_set.js';
import { boardSummary, doneSections, newlyDone } from './progress.js';
import { unfinishedLook } from './sketch_unfinished.js';
import { makeBoardTile, tileStateOf, updateBoardTile } from './tile_state.js';

export const BOARD_SUBSCRIBER = 'anyink.board.pageRender';

/** What the board follows on the editor: a letter's change, the lines, the font check */
const TOPICS = Object.freeze([
	'currentItem',
	'whichGlyphIsSelected',
	'fontMetrics',
	'fontCheck',
	'traceLayer',
	'projectFile',
]);

const PAGE_EVENT = 'anyink-page-change';

/** How long a section just added stays marked (board.css anyink-board-new runs 1.6 s) */
const NEW_MARK_MS = 2000;

/** Boards on the page (or about to be), each with its view */
const views = new Map();

/** Per font (the editor's History): { lastTouched, done, toasted, numbers } */
let memories = new WeakMap();

const install = {
	done: false,
	/** the page the app last drew, from 'anyink-page-change' */
	lastPage: '',
	unhooks: [],
	coach: null,
};

// --------------------------------------------------------------
// Where the board shows
// --------------------------------------------------------------

/** @returns {Boolean} Simple with 'board' on: the Overview is the letter board */
export function isBoardOn() {
	return isSimpleMode() && isFeatureOn('board');
}

/**
 * The Overview page in Simple: the board across the whole page (4.2).
 * @param {Object} [editor] - ProjectEditor
 * @returns {HTMLElement} the page content (#app__page)
 */
export function makeBoardPage(editor = getCurrentProjectEditor()) {
	const content = element('div');
	content.id = 'app__page';
	const page = element('div', 'content__page anyink-board-page');
	const area = element('div', 'content-page__right-area anyink-board-area');
	area.appendChild(makeBoard(editor));
	page.appendChild(area);
	content.appendChild(page);
	return content;
}

// --------------------------------------------------------------
// The board
// --------------------------------------------------------------

/**
 * @param {Object} [editor] - ProjectEditor
 * @returns {HTMLElement} the board
 */
export function makeBoard(editor = getCurrentProjectEditor()) {
	installBoard();
	// coming back from a letter ("<- All letters", "1 Letters", Undo): that letter was touched
	if (install.lastPage === 'Characters') noteTouched(editor, charOfId(editor?.selectedGlyphID));

	const board = element('section', 'anyink-board');
	board.dataset.anyinkBoard = '';
	const titleId = `anyink-board-title-${views.size + 1}`;
	board.setAttribute('aria-labelledby', titleId);

	const head = makeHead(titleId);
	const controls = element('div', 'anyink-board__controls');
	const body = element('div', 'anyink-board__sections');
	board.append(head.root, controls, body);

	const view = {
		editor,
		board,
		head,
		controls,
		body,
		controlsKey: '',
		project: null,
		/** char -> { cell, tile, key } */
		cells: new Map(),
		/** section id -> { root, count, done, tiles, note } */
		sections: new Map(),
		empty: null,
		summary: null,
		filter: 'all',
		/** a section to bring into view once the board is on the page ('' for none) */
		reveal: '',
		ms: 0,
		pending: false,
		attached: false,
	};
	views.set(board, view);
	board.addEventListener('click', (event) => onBoardClick(view, event));

	updateView(view);
	follow(view);
	// once the page is on screen: a section just added, else the letter he had open last, comes
	// into view
	queueMicrotask(() => {
		if (!board.isConnected) return;
		view.attached = true;
		if (view.reveal) {
			revealSection(view);
			return;
		}
		const touched = view.cells.get(lastTouchedOnBoard(editor));
		touched?.tile?.scrollIntoView?.({ block: 'nearest' });
	});
	return board;
}

/**
 * Draws the board again now, only what changed.
 * @param {HTMLElement} board
 * @returns {Number} the ms it took (0 for no board)
 */
export function updateBoard(board) {
	const view = views.get(board);
	return view ? updateView(view) : 0;
}

/**
 * @param {HTMLElement} board
 * @returns {{summary: Object | null, filter: String, ms: Number} | null}
 */
export function boardState(board) {
	const view = views.get(board);
	return view ? { summary: view.summary, filter: view.filter, ms: view.ms } : null;
}

/**
 * @param {HTMLElement} board
 * @returns {Array<HTMLElement>} its tiles, in page order
 */
export function shownTiles(board) {
	return [...(board?.querySelectorAll?.('[data-anyink-board-cell] > glyph-tile') || [])];
}

/**
 * @param {HTMLElement} board
 * @param {String} char
 * @returns {HTMLElement | null} the tile on the page for that letter
 */
export function tileOf(board, char) {
	const tile = views.get(board)?.cells.get(char)?.tile || null;
	return tile?.isConnected || board?.contains?.(tile) ? tile : null;
}

/**
 * Opens a letter from the board: the letter view, with no Undo step (7.3).
 * @param {Object} editor - ProjectEditor
 * @param {String} char
 * @returns {Boolean} true when it opened
 */
export function openLetterFromBoard(editor, char) {
	const hex = charToHex(char);
	if (!hex || !editor) return false;
	noteTouched(editor, char);
	// B10 + B11 finalize: opening a letter is asking to see it again: its look's "Something
	// else" skips end, so an amber letter shows its fix on the Next line (rule 7)
	forgetLooks(char);
	return showItem(editor, `glyph-${hex}`);
}

/** The Next line's look skips of one letter, or of all of them, end (coach_state.js) */
function forgetLooks(char) {
	try {
		getCoach().forgetLookSkips?.(char);
	} catch {
		// no coach here: nothing to forget
	}
}

/**
 * @param {Object} editor
 * @returns {String} the letter he had open last on this font, when the board shows it
 */
export function lastTouchedOnBoard(editor) {
	const char = memoryOf(editor)?.lastTouched || '';
	return char && editor?.project && boardLetters(editor.project).includes(char) ? char : '';
}

// --------------------------------------------------------------
// Drawing
// --------------------------------------------------------------

/**
 * @param {Object} view
 * @returns {Number} ms
 */
function updateView(view) {
	const started = now();
	const { editor } = view;
	if (!editor?.project) return 0;
	if (view.project !== editor.project) {
		// another font, or a whole-font Undo brought back another copy: every tile anew
		view.cells.forEach(({ cell }) => cell.remove());
		view.cells.clear();
		view.project = editor.project;
	}
	const focusChar = focusedChar(view.board);
	// a section added since this font's last drawing shows, whatever the filter (critic: the
	// numbers stayed behind "Needs a look", so the press looked like it did nothing)
	let filterEnded = false;
	if (numbersAdded(editor)) {
		filterEnded = endBoardFilter(editor);
		view.reveal = 'numbers';
	}
	const { infos, summary, read } = readBoard(editor);
	// the filters hid (no letter needs a look): the pick ends with them (filters.js)
	if (read && settleBoardFilter(editor, summary)) filterEnded = true;
	const filter = shownFilter(getBoardFilter(editor), summary);
	setAttr(view.board, 'data-filter', filter);
	drawHead(view, summary);
	drawControls(view, summary, filter);
	drawSections(view, infos, summary, filter);
	if (focusChar) tileOf(view.board, focusChar)?.focus?.({ preventScroll: true });
	noteDone(editor, summary);
	view.summary = summary;
	view.filter = filter;
	if (view.reveal && view.board.isConnected) revealSection(view);
	// rule 9 reads the filter: the Next line looks again
	if (filterEnded) refreshCoach();
	view.ms = now() - started;
	return view.ms;
}

/**
 * @param {Object} editor
 * @returns {Boolean} true when the Numbers & symbols section is new since this font's last
 *   drawing (the first drawing of a font only notes it)
 */
function numbersAdded(editor) {
	const memory = memoryOf(editor);
	const shown = numbersShown(editor.project);
	const before = memory?.numbers;
	if (memory) memory.numbers = shown;
	return before === false && shown;
}

/**
 * Brings the section just added into view and marks it for a moment.
 * @param {Object} view
 */
function revealSection(view) {
	const id = view.reveal;
	view.reveal = '';
	const root = view.sections.get(id)?.root;
	if (!root?.isConnected) return;
	root.scrollIntoView?.({ block: 'nearest' });
	root.setAttribute('data-anyink-new', '');
	setTimeout(() => root.removeAttribute('data-anyink-new'), NEW_MARK_MS);
}

/**
 * Every letter of the board, read once: each tile's state (tile_state.js) and the counts made
 * from those same states, so a tile and a count can't disagree.
 * @param {Object} editor
 * @returns {{infos: Map<String, Object>, summary: Object, read: Boolean}} read: false when the
 *   checks are on but the Next line follows another font (its "needs a look" unknown here)
 */
function readBoard(editor) {
	const project = editor.project;
	const open = openPathOf(editor);
	const checksOn = isFeatureOn('checks');
	const looks = checksOn ? coachLooks(editor) : null;
	const checks = looks ? (_item, { char }) => looks.get(char) || null : null;
	const infos = new Map();
	const facts = boardLetters(project).map((char) => {
		const info = tileStateOf(project, char, { checks, checksOn: !!checks, editor, open });
		infos.set(char, info);
		const ink = info.state !== 'empty';
		return {
			char,
			ink,
			ready: info.state === 'ready',
			needsLook: info.state === 'needsLook' ? info.look : null,
		};
	});
	return { infos, summary: boardSummary(facts), read: !checksOn || !!looks };
}

/**
 * The board's Ready rule, for the rail's "7/58" (topbar/ready_count.js readyCount's isReady): ink,
 * and no check that needs a look while 'checks' is on, read as the board reads it, so the rail
 * never counts a letter the board shows amber.
 * @param {Object} editor
 * @returns {(item: Object, char: String) => Boolean}
 */
export function readyRuleFor(editor) {
	const open = openPathOf(editor);
	const looks = isFeatureOn('checks') ? coachLooks(editor) : null;
	const font = editor?.project?.settings?.font || null;
	// S3 finalize: a sketched letter plainly missing strokes is never Ready, read here directly
	// (not only through the coach's looks, which need 'checks' and the app's coach)
	return (item, char) =>
		hasInk(item, { open }) && !looks?.get(char) && !unfinishedLook(item, char, { font, open });
}

/**
 * B11's "Needs a look", as the Next line reads it: the app coach's letters (its checks source is
 * its own), by letter.
 * @param {Object} editor
 * @returns {Map<String, Object> | null}
 */
function coachLooks(editor) {
	try {
		const coach = getCoach();
		if (coach.editor() !== editor) return null;
		const letters = coach.state()?.letters;
		if (!Array.isArray(letters)) return null;
		return new Map(letters.filter((l) => l?.needsLook).map((l) => [l.char, l.needsLook]));
	} catch (error) {
		console.warn('ANY-INK board: the Next line state could not be read', error);
		return null;
	}
}

/** The title, "7 of 58 ready" and the bar */
function makeHead(titleId) {
	const root = element('div', 'anyink-board__head');
	const title = element('h2', 'anyink-board__title');
	title.id = titleId;
	title.textContent = word('board.title');
	title.title = hintOf('board.title');
	const progress = element('span', 'anyink-board__progress');
	const bar = element('div', 'anyink-board__bar');
	bar.setAttribute('role', 'progressbar');
	bar.setAttribute('aria-valuemin', '0');
	const fill = element('div', 'anyink-board__bar-fill');
	bar.appendChild(fill);
	root.append(title, progress, bar);
	return { root, progress, bar, fill };
}

function drawHead(view, summary) {
	const { progress, bar, fill } = view.head;
	const words = { ready: summary.ready, total: summary.total };
	setText(progress, word('board.progress', words));
	setAttr(bar, 'aria-valuemax', String(summary.total));
	setAttr(bar, 'aria-valuenow', String(summary.ready));
	setAttr(bar, 'aria-label', word('board.progressLabel', words));
	setAttr(bar, 'title', hintOf('board.progressLabel'));
	const width = `${Math.round(summary.fraction * 1000) / 10}%`;
	if (fill.style.width !== width) fill.style.width = width;
}

/** The filters (B11) and the toolbar; drawn again only when what they show changed */
function drawControls(view, summary, filter) {
	const { editor } = view;
	const showFilters = filtersShown(summary);
	const tools = toolbarButtons(editor, summary);
	const key = JSON.stringify([
		showFilters ? [filter, summary.total, summary.needsLook, summary.empty] : 0,
		tools.map((tool) => tool.key),
	]);
	if (key === view.controlsKey) return;
	view.controlsKey = key;
	const focused = globalThis.document?.activeElement;
	const refocus = view.controls.contains(focused)
		? focused.dataset.anyinkBoardFilter || focused.dataset.anyinkBoardTool || ''
		: '';

	const parts = [];
	if (showFilters) {
		parts.push(
			makeFilterBar(summary, filter, (picked) => {
				if (!setBoardFilter(editor, picked)) return;
				updateView(view);
				// B10 + B11 integration: the Next line follows what the board shows (rule 9)
				refreshCoach();
			})
		);
	}
	const toolbar = element('div', 'anyink-board__toolbar');
	toolbar.setAttribute('role', 'toolbar');
	toolbar.setAttribute('aria-label', word('board.toolbar.label'));
	tools.forEach((tool) => toolbar.appendChild(toolButton(tool, view)));
	parts.push(toolbar);
	view.controls.replaceChildren(...parts);

	if (refocus) {
		view.controls
			.querySelector(
				`[data-anyink-board-filter="${refocus}"], [data-anyink-board-tool="${refocus}"]`
			)
			?.focus?.({ preventScroll: true });
	}
}

/**
 * 4.2 Toolbar, each only when its feature works (principle 8).
 * @returns {Array<{id: String, key: String, run: Function}>}
 */
function toolbarButtons(editor, summary) {
	const tools = [];
	if (isFeatureOn('photo')) {
		tools.push({ id: 'usePhoto', key: 'board.toolbar.usePhoto', run: () => usePhoto(editor) });
	}
	// "3 or more letters are ready": Try it with letter spacing open (B12 turns 'tryIt' on)
	if (isFeatureOn('tryIt') && summary.ready >= 3) {
		tools.push({
			id: 'letterSpacing',
			key: 'board.toolbar.letterSpacing',
			run: () => runCoachAction('tryIt', { open: 'letterSpacing' }, { editor }),
		});
	}
	const shown = numbersShown(editor.project);
	tools.push({
		id: 'numbers',
		key: shown ? 'board.toolbar.hideNumbers' : 'board.toolbar.addNumbers',
		run: () => toggleNumbers(editor),
	});
	return tools;
}

function toolButton(tool, view) {
	const button = element('button', 'anyink-board__tool anyink-outlined');
	button.type = 'button';
	button.dataset.anyinkBoardTool = tool.id;
	button.textContent = word(tool.key);
	button.title = hintOf(tool.key);
	button.addEventListener('click', () => {
		tool.run();
		// the change shows at once (the save status also asks for a drawing next frame)
		if (view.board.isConnected || !view.attached) updateView(view);
	});
	return button;
}

/**
 * "Use a photo...": the Windows picker in the press, then the photo dialog with the letter
 * unknown (4.4). The photo screens' hub is loaded when pressed: the pages never import it (an
 * import loop through the Next line's actions, D-040).
 * @param {Object} editor
 * @returns {Promise<Boolean>}
 */
async function usePhoto(editor) {
	try {
		const { pickPhoto } = await import('../photo/photo_app.js');
		return await pickPhoto(editor, {});
	} catch (error) {
		console.warn('ANY-INK board: the photo picker could not open', error);
		return false;
	}
}

/**
 * The sections and their tiles, in board order, under the filter in effect.
 * @param {Object} view
 * @param {Map<String, Object>} infos - tile_state.js tileStateOf, by letter
 * @param {Object} summary - progress.js boardSummary
 * @param {String} filter
 */
function drawSections(view, infos, summary, filter) {
	const touched = lastTouchedOnBoard(view.editor);
	const shownSections = [];
	summary.sections.forEach((section) => {
		const letters = section.letters.filter((letter) => tileShows(filter, letter.state));
		const part = sectionPart(view, section.id);
		if (!letters.length) {
			part.root.remove();
			return;
		}
		drawSectionHead(part, section);
		const cells = letters.map((letter) =>
			cellFor(view, letter, infos.get(letter.char), {
				lastTouched: letter.char === touched,
				withLook: filter === 'needsLook',
			})
		);
		sameChildren(part.tiles, cells);
		setHidden(part.note, !(section.id === 'punctuation' && filter === 'all'));
		shownSections.push(part.root);
	});
	// a section no longer on the board (numbers hidden) goes
	[...view.sections.keys()].forEach((id) => {
		if (!summary.sections.some((section) => section.id === id)) {
			view.sections.get(id).root.remove();
			view.sections.delete(id);
		}
	});
	const parts = [...shownSections];
	if (!shownSections.length) {
		// "Empty" with every letter inked: say so rather than show nothing
		view.empty ||= element('p', 'anyink-board__nothing');
		setText(view.empty, word('board.filter.noneEmpty'));
		parts.push(view.empty);
	}
	sameChildren(view.body, parts);
	keepOneTabStop(view.board);
}

/**
 * The board is one tab stop (board_keys.js moves it with the arrows): the last touched tile, or
 * the tile the arrows left it on; when a filter hid that one, the first tile shown.
 * @param {HTMLElement} board
 */
function keepOneTabStop(board) {
	const tiles = shownTiles(board);
	if (!tiles.length) return;
	const stops = tiles.filter((tile) => tile.getAttribute('tabindex') === '0');
	if (stops.length === 1) return;
	const keep = stops.find((tile) => tile.hasAttribute('last-touched')) || stops[0] || tiles[0];
	tiles.forEach((tile) => {
		const index = tile === keep ? '0' : '-1';
		if (tile.getAttribute('tabindex') !== index) tile.setAttribute('tabindex', index);
	});
}

/** The section's parts, made once and kept */
function sectionPart(view, id) {
	let part = view.sections.get(id);
	if (part) return part;
	const root = element('section', 'anyink-board__section');
	root.dataset.anyinkBoardSection = id;
	const head = element('h3', 'anyink-board__section-head');
	const name = element('span', 'anyink-board__section-name');
	const count = element('span', 'anyink-board__section-count');
	const done = element('span', 'anyink-board__section-done');
	done.textContent = '✓';
	head.append(name, count, done);
	const tiles = element('div', 'anyink-board__tiles');
	tiles.setAttribute('role', 'group');
	const note = element('p', 'anyink-board__note');
	note.textContent = word('board.spaceNote');
	note.title = hintOf('board.spaceNote');
	root.append(head, tiles, note);
	part = { root, name, count, done, tiles, note };
	view.sections.set(id, part);
	return part;
}

function drawSectionHead(part, section) {
	const name = word(section.nameKey);
	setText(part.name, name);
	setAttr(part.name, 'title', hintOf(section.nameKey));
	setAttr(part.tiles, 'aria-label', name);
	const words = { ready: section.ready, total: section.total };
	// "4 of 26" only once the section has a ready letter (4.2 Progress)
	setText(part.count, section.showCount ? word('board.section.count', words) : '');
	setHidden(part.count, !section.showCount);
	setAttr(part.count, 'aria-label', word('board.section.countLabel', { ...words, name }));
	setHidden(part.done, !section.done);
	setAttr(part.done, 'title', word('board.section.done'));
	setAttr(part.done, 'aria-label', word('board.section.done'));
	if (part.root.hasAttribute('data-done') !== section.done) {
		part.root.toggleAttribute('data-done', section.done);
	}
}

/**
 * The cell of one letter: its tile (tile_state.js), made once and changed in place when its
 * state, ink or photo changes, plus its reason and fixes under "Needs a look".
 * @returns {HTMLElement} the cell
 */
function cellFor(view, letter, info, { lastTouched, withLook }) {
	const { editor } = view;
	const item = letterItem(editor.project, letter.char);
	const look = withLook ? lookKey(letter.needsLook) : '';
	const key = [
		info.state,
		info.source || '',
		info.title,
		letterFingerprint(item),
		item ? 1 : 0,
		getTrace(item)?.asset || '',
		lastTouched ? 1 : 0,
		look,
	].join('|');
	let cell = view.cells.get(letter.char);
	if (cell?.key === key) return cell.cell;
	if (!cell) {
		const root = element('div', 'anyink-board__cell');
		root.dataset.anyinkBoardCell = '';
		root.dataset.char = letter.char;
		const tile = makeBoardTile(editor.project, letter.char, tileOptions(editor, info, lastTouched));
		root.appendChild(tile);
		cell = { cell: root, tile, key: '', look: '', ring: lastTouched };
		view.cells.set(letter.char, cell);
	} else if (cell.ring !== lastTouched) {
		updateBoardTile(cell.tile, info, { lastTouched });
	} else {
		// the ring and the tab stop stay as they are (the arrows may have moved the tab stop)
		updateBoardTile(cell.tile, info);
	}
	cell.ring = lastTouched;
	cell.cell.dataset.state = info.state;
	if (cell.look !== look) {
		cell.cell.querySelector('.anyink-board__look')?.remove();
		const fixes = look
			? makeLookFixes(letter, (action, args) => {
					runCoachAction(action, args, { editor });
					if (view.board.isConnected) updateView(view);
			  })
			: null;
		if (fixes) cell.cell.appendChild(fixes);
		cell.look = look;
	}
	cell.key = key;
	return cell.cell;
}

/** tile_state.js makeBoardTile's options: the state is already read, so it reads it again */
function tileOptions(editor, info, lastTouched) {
	return {
		checks: info.look ? () => info.look : null,
		checksOn: !!info.look,
		editor,
		open: openPathOf(editor),
		lastTouched,
	};
}

/** @returns {String} what a "Needs a look" tile shows, as one string ('' for none) */
function lookKey(look) {
	if (!look) return '';
	return JSON.stringify([look.id ?? '', look.reason || '', look.fixLabel || '', look.action || '']);
}

/** A press on a tile opens its letter (a press on its fixes is theirs) */
function onBoardClick(view, event) {
	const target = /** @type {Element} */ (event.target);
	if (!target?.closest || target.closest('.anyink-board__look, button')) return;
	const cell = target.closest('[data-anyink-board-cell]');
	if (!cell || !view.board.contains(cell)) return;
	openLetterFromBoard(view.editor, cell.dataset.char);
}

// --------------------------------------------------------------
// Following the font
// --------------------------------------------------------------

function follow(view) {
	const { editor } = view;
	if (typeof editor?.subscribe !== 'function') return;
	// one subscription for the newest board: a board drawn again takes this id over
	editor.subscribe({
		topic: [...TOPICS],
		subscriberID: BOARD_SUBSCRIBER,
		callback: () => schedule(view),
	});
}

/** Draws the board a frame from now (once, however many changes come before then) */
function schedule(view) {
	if (view.pending) return;
	if (view.attached && !view.board.isConnected) {
		views.delete(view.board);
		return;
	}
	view.pending = true;
	nextFrame(() => {
		view.pending = false;
		if (!view.board.isConnected) {
			if (view.attached) views.delete(view.board);
			return;
		}
		view.attached = true;
		updateView(view);
	});
}

function scheduleAll() {
	[...views.values()].forEach(schedule);
}

/** Every board on the page, drawn again now */
function updateAll() {
	[...views.values()].forEach((view) => {
		if (view.board.isConnected) updateView(view);
	});
}

// --------------------------------------------------------------
// Installed once: the Next line's actions, toasts, the letter he had open last
// --------------------------------------------------------------

export function installBoard() {
	if (install.done) return;
	install.done = true;
	installActions();
	listen(SAVE_STATUS_EVENT, () => {
		scheduleAll();
		watchDone();
	});
	listen(MODE_EVENT, (event) => {
		// a switch to All tools leaves the board (a More tools visit is a page change, below)
		if (event?.detail?.mode === 'all' && !event.detail.visit) endFilter(currentEditor());
		scheduleAll();
	});
	listen(PAGE_EVENT, (event) => {
		const page = event?.detail?.appLevel ? '' : String(event?.detail?.page || '');
		// he left a letter: that one was touched last
		if (install.lastPage === 'Characters' && page !== 'Characters') {
			const editor = currentEditor();
			noteTouched(editor, charOfId(editor?.selectedGlyphID));
		}
		// he left the board: the filter he picked there ends, so it opens on All next time
		if (install.lastPage === LETTERS_PAGE && page !== LETTERS_PAGE) endFilter(currentEditor());
		install.lastPage = page;
	});
	followCoach();
}

/** The Next line's buttons that open the board's parts (coach/actions.js; principle 8) */
function installActions() {
	// rule 9 "2 letters need a look." [Show me]: the board, with Needs a look picked
	setCoachAction('showNeedsLook', (_args, { editor } = {}) => {
		const target = editor || currentEditor();
		if (!target) return false;
		// B10 + B11 finalize: [Show me] asks for every one again, the skipped ones too
		forgetLooks();
		setBoardFilter(target, 'needsLook');
		if (target.nav?.page !== LETTERS_PAGE) goToLetters(target);
		else updateAll();
		refreshCoach();
		return true;
	});
	// rule 16 "All 58 letters are ready. Add numbers & symbols next?" [Add numbers & symbols]:
	// the board shows the new section (from a letter too, so the press never looks like nothing)
	if (!hasCoachAction('addNumbers')) {
		setCoachAction('addNumbers', (_args, { editor } = {}) => {
			const target = editor || currentEditor();
			const changed = setNumbersShown(target, true);
			if (target?.nav && target.nav.page !== LETTERS_PAGE) goToLetters(target);
			else updateAll();
			return changed;
		});
	}
}

/** The filter he picked on the board ends; the Next line (rule 9 reads it) looks again */
function endFilter(editor) {
	if (endBoardFilter(editor)) refreshCoach();
}

/** The coach's state changes (B11's checks among them): the boards follow */
function followCoach() {
	try {
		const coach = getCoach();
		if (install.coach === coach) return;
		install.coach = coach;
		// (finished sections are watched at each step, the save status: a drag's ticks never count)
		const stop = coach.subscribe(scheduleAll);
		install.unhooks.push(stop);
	} catch {
		// no coach here (a page without the Next line): the save status still draws the board
	}
}

/** The Next line reads the board's filter (rule 9): it looks again when the filter changes */
function refreshCoach() {
	try {
		getCoach().refresh();
	} catch {
		// no coach here: nothing to tell
	}
}

/** A section finished anywhere (the letter view too) says so once */
function watchDone() {
	if (!isBoardOn()) return;
	const editor = currentEditor();
	if (!editor?.project) return;
	try {
		noteDone(editor, readBoard(editor).summary);
	} catch (error) {
		console.warn('ANY-INK board: could not read the letters', error);
	}
}

/**
 * The first look at a font only notes what is finished; a section finished after that says so,
 * once a session.
 * @param {Object} editor
 * @param {Object} summary
 */
function noteDone(editor, summary) {
	const memory = memoryOf(editor);
	if (!memory || !isBoardOn()) return;
	const done = doneSections(summary);
	const fresh = newlyDone(memory.done, done).filter((id) => !memory.toasted.has(id));
	memory.done = done;
	fresh.forEach((id) => {
		memory.toasted.add(id);
		const section = summary.sections.find((one) => one.id === id);
		if (section) toast(section.toastKey, {}, { kind: 'info', allTools: false });
	});
}

function noteTouched(editor, char) {
	const memory = memoryOf(editor);
	if (memory && char) memory.lastTouched = char;
}

/**
 * @returns {{lastTouched: String, done: Array<String> | null, toasted: Set<String>,
 *   numbers: Boolean | null} | null} numbers: whether the last drawing showed Numbers & symbols
 */
function memoryOf(editor) {
	const key = editor?.history || editor;
	if (!key || typeof key !== 'object') return null;
	let memory = memories.get(key);
	if (!memory) {
		memory = { lastTouched: '', done: null, toasted: new Set(), numbers: null };
		memories.set(key, memory);
	}
	return memory;
}

function listen(type, fn) {
	if (typeof globalThis.addEventListener !== 'function') return;
	globalThis.addEventListener(type, fn);
	install.unhooks.push(() => globalThis.removeEventListener(type, fn));
}

/** Forgets every board, memory and listener. */
export function resetBoardForTests() {
	install.unhooks.forEach((unhook) => unhook());
	install.unhooks = [];
	install.done = false;
	install.lastPage = '';
	install.coach = null;
	views.clear();
	memories = new WeakMap();
}

// --------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------

function currentEditor() {
	try {
		return getCurrentProjectEditor() || null;
	} catch {
		return null;
	}
}

/** @returns {String} 'glyph-0x42' -> 'B'; '' for anything else */
function charOfId(id) {
	const match = typeof id === 'string' ? /^glyph-0x([0-9a-f]+)$/i.exec(id) : null;
	return match ? String.fromCodePoint(parseInt(match[1], 16)) : '';
}

/** @returns {String} the letter of the tile with the keyboard's focus, '' for none */
function focusedChar(board) {
	const focused = globalThis.document?.activeElement;
	if (!focused || !board.contains(focused)) return '';
	return focused.closest?.('[data-anyink-board-cell]')?.dataset.char || '';
}

/** Puts the children in this order, touching the page only when they differ */
function sameChildren(parent, children) {
	const now = [...parent.children];
	if (now.length === children.length && now.every((child, i) => child === children[i])) return;
	parent.replaceChildren(...children);
}

function element(tag, className = '') {
	const made = document.createElement(tag);
	if (className) made.className = className;
	return made;
}

function setText(node, text) {
	if (node.textContent !== text) node.textContent = text;
}

function setHidden(node, hidden) {
	if (node.hidden !== hidden) node.hidden = hidden;
}

function setAttr(node, name, value) {
	if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function hintOf(key) {
	return wordEntry(key)?.hint || '';
}

function now() {
	return globalThis.performance?.now?.() ?? Date.now();
}

/** One frame from now; a timer where there are no frames */
function nextFrame(fn) {
	if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(fn);
	else setTimeout(fn, 16);
}
