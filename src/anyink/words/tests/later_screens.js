// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16: the Simple screens B8 to B15 added, built here so the one check UX-BEGINNER.md 9.4 names
	(banned_words.test.js) scans every Simple screen, not only the B4-era ones. Each builder uses
	the screen's own real builder, with the fixtures its B's tests use; each B's own words test
	still scans its screen in more states.

	  LATER_SCREENS    [{ name, build, timeout? }]: build() makes the screen state in Simple (the
	                   scan turns Simple on first) and returns what scanSimpleScreen scans
	  closeLaterScreens()   takes down whatever a builder left open (dialogs, cards, Try it,
	                   the guide-line banner, the photo flow) and its test seams
*/
import { vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { resetBoardForTests } from '../../board/board_page.js';
import { resetFiltersForTests, setBoardFilter } from '../../board/filters.js';
import { boardEditor, lookChecks, openPage } from '../../board/tests/board_font.js';
import { resetChecksCacheForTests } from '../../checks/cache.js';
import { initChecks, stopChecksForTests } from '../../checks/checks_app.js';
import { fixEditor } from '../../checks/tests/fix_fixtures.js';
import { resetCoachActionsForTests } from '../../coach/actions.js';
import { getCoach, setCoachSource } from '../../coach/coach_state.js';
import {
	closeFontDetails,
	openFontDetails,
	setYourName,
} from '../../fontinfo/font_details_dialog.js';
import { startMovingLines, stopMovingLines } from '../../fontinfo/move_lines.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { makeInstallCard } from '../../install/install_card.js';
import { openBrennanHand } from '../../install/tests/install_fixture.js';
import { closeUseInWord, openUseInWord } from '../../install/use_in_word_dialog.js';
import { FEATURE_NAMES, setFeaturesForTests } from '../../mode/features.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { stepTitle } from '../../nib/commit.js';
import { makeNibTool } from '../../nib/nib_tool.js';
import { line } from '../../nib/tests/strokes.js';
import { closeHowCard, openHowCard } from '../../photo/how_card.js';
import { closePhotoCard, makePhotoCard, resetPhotoCardForTests } from '../../photo/photo_card.js';
import { closePhotoDialog, openPhotoDialog } from '../../photo/photo_dialog.js';
import { resetPhotoFlowForTests } from '../../photo/photo_flow_state.js';
import { SMOOTH_DETAIL_DEFAULT } from '../../photo/smooth_detail.js';
import { photoFont } from '../../photo/tests/photo_dialog_fixture.js';
import { showItem } from '../../preview/show_item.js';
import { makeStartPage } from '../../start/start_page.js';
import { fakeFileHandle } from '../../files/tests/fakes.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { closeTryIt, openTryIt } from '../../tryit/expand.js';
import { historyText } from '../history_text.js';
import { word, wordKeys } from '../words.js';

const q = (selector) => document.querySelector(selector);
const NOW = new Date(2026, 9, 15, 9, 0).getTime();
const flush = async (n = 6) => {
	for (let i = 0; i < n; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** jsdom has no Web Animations or scrolling; the board and the cards use both. */
function stubLayout() {
	Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
}

/** A Brush stroke drawn with pointer events, as nib/tests/brush_words.test.js draws it. */
function drawOn(editor, path) {
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	const tool = makeNibTool(canvas, { getEditor: () => editor });
	let clock = 0;
	const event = (type, [x, y]) => ({
		type,
		pointerId: 1,
		isPrimary: true,
		button: type === 'pointermove' ? -1 : 0,
		clientX: editor.view.dx + x * editor.view.dz,
		clientY: editor.view.dy - y * editor.view.dz,
		timeStamp: (clock += 8),
		preventDefault() {},
	});
	tool.down(event('pointerdown', path[0]));
	path.slice(1).forEach((point) => tool.move(event('pointermove', point)));
	tool.up(event('pointerup', path.at(-1)));
}

const noop = () => {};
const photoCardHandlers = () =>
	Object.fromEntries(
		[
			'onChoose',
			'onPickPhoto',
			'onHow',
			'onCancel',
			'onUseIt',
			'onAddInstead',
			'onDrawBox',
			'onAdjust',
		].map((name) => [name, noop])
	);

/** The start screen as start/tests/start_page.test.js makes it, with stand-in lists. */
async function startScreen({ recents = [], sessions = [], records = {} } = {}) {
	const deps = {
		load: noop,
		create: () => ({ project: {} }),
		openFiles: noop,
		moreTools: noop,
		listRecents: async () => recents,
		listSessions: async () => sessions,
		readRecord: async (id) => records[id],
		restore: async () => undefined,
		discard: async () => true,
		confirmThrow: async () => true,
		removeRecent: async () => true,
		openRecent: async () => 'opened',
		openPicker: async () => false,
		askPermission: async () => 'granted',
		createFont: () => ({ editor: {}, done: Promise.resolve('noPicker') }),
		now: () => NOW,
	};
	const page = makeStartPage(deps);
	document.body.appendChild(page);
	await page.ready;
	await flush();
	return page;
}

/** The Brush, B8: a stroke on Capital B, its Undo and Redo, and every Brush word. */
function brushScreen() {
	setFeaturesForTests({ brush: true, coach: true });
	const editor = twoLetterEditor();
	showItem(editor, B);
	editor.view = { dx: 100, dy: 900, dz: 1 };
	editor.editCanvas = { redraw: noop };
	editor.selectedTool = 'nib';
	drawOn(editor, line([100, 0], [100, 500]));
	const title = editor.history.queue[0].title;
	editor.history.restoreState();
	editor.history.redoState();
	return {
		root: null,
		texts: {
			'Undo title': [historyText(title), historyText(stepTitle(editor.selectedItem))],
			'brush words': wordKeys()
				.filter((key) => key.startsWith('brush.'))
				.map((key) => word(key, { name: 'Capital B', number: 1 })),
		},
	};
}

/** Photos, B9: the How card, the photo dialog and the photo card at steps A and C, together. */
function photoScreens() {
	setFeaturesForTests({ photo: true, coach: true });
	openHowCard({ text: 'Brennan Hand' });
	const how = q('[data-anyink-dialog="howCard"]').cloneNode(true);
	closeHowCard();
	const { record, mask, image } = photoFont({});
	openPhotoDialog({
		record,
		mask,
		image,
		onTrace: noop,
		onCancel: noop,
		onDone: noop,
		onChange: noop,
	});
	const dialog = q('[data-anyink-dialog="photoDialog"]').cloneNode(true);
	closePhotoDialog();
	const thumb = (asset) => {
		const picture = document.createElement('canvas');
		picture.width = 300;
		picture.height = 200;
		return { asset, image: picture };
	};
	const pick = makePhotoCard(
		{ step: 'pick', char: 'r', photos: ['a1', 'a2'].map(thumb) },
		photoCardHandlers()
	);
	const result = makePhotoCard(
		{
			step: 'result',
			char: 'r',
			status: 'ready',
			error: null,
			replaces: 2,
			options: {
				threshold: 'auto',
				autoThreshold: 140,
				smoothDetail: SMOOTH_DETAIL_DEFAULT,
				despeckle: true,
				lightInk: false,
				paper: 'photo',
				paperPicked: true,
			},
		},
		photoCardHandlers()
	);
	const root = document.createElement('div');
	root.append(how, dialog, pick.element, result.element);
	document.body.appendChild(root);
	const adjust = result.element.querySelector('[data-anyink-photo-card-action="adjust"]');
	if (adjust && adjust.getAttribute('aria-expanded') !== 'true') adjust.click();
	return root;
}

/** The letter board, B10: a new font, the top bar, the Next line and the board. */
function boardScreen() {
	stubLayout();
	setFeaturesForTests({ board: true });
	openPage(boardEditor({ seed: false }));
	return q('#app__wrapper');
}

/** Needs a look, B11: the seeded board with the real checks, on Needs a look, its reasons and fixes. */
function needsALookScreen() {
	stubLayout();
	setFeaturesForTests({ board: true, checks: true, letterView: true });
	initChecks();
	setCoachSource('checks', lookChecks());
	const editor = boardEditor();
	openPage(editor);
	setBoardFilter(editor, 'needsLook');
	openPage(editor);
	const line = getCoach().line();
	return {
		root: q('#app__wrapper'),
		texts: { 'Next line': [line.sentence, line.button].filter(Boolean) },
	};
}

/** Try it, B12: the strip opened into Try it on a font with ink in Capital B. */
function tryItScreen() {
	setFeaturesForTests({ coach: true, tryIt: true });
	const editor = twoLetterEditor();
	const item = editor.project.getItem(B);
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	item.addOneShape({
		name: 'Square',
		pathPoints: [corner(0, 0), corner(0, 700), corner(500, 700), corner(500, 0)],
	});
	item.advanceWidth = 600;
	const strip = document.createElement('preview-strip');
	document.body.appendChild(strip);
	strip.attachEditor(editor);
	vi.spyOn(strip.page, 'getClientRects').mockReturnValue([{ width: 1200, height: 400 }]);
	strip.setText('Bra');
	openTryIt();
	strip.needsResize = true;
	strip.redrawNow();
	if (!strip.classList.contains('is-try-it'))
		throw new Error('the screen is not all there: Try it');
	return strip;
}

/** The start screen, B13: a font to continue, and never-saved work's card. */
async function startScreens() {
	setFeaturesForTests({ startScreen: true });
	const recent = (name) => ({ handle: fakeFileHandle(`${name}.gs2`), name, time: NOW - 86400000 });
	const one = await startScreen({ recents: [recent('Brennan Hand'), recent('Test Caps')] });
	const two = await startScreen({
		sessions: [{ id: 's2', name: 'Never Saved', time: NOW - 1000, hasFile: false }],
	});
	const root = document.createElement('div');
	root.append(one, two);
	document.body.appendChild(root);
	return root;
}

/** Use in Word, B14: the dialog before the file is made, and the install card, every part open. */
function useInWordScreens() {
	stubLayout();
	setFeaturesForTests({ useInWord: true, alternates: true });
	openUseInWord({ editor: openBrennanHand() });
	const card = makeInstallCard({
		kind: 'test',
		name: 'Brennan Hand',
		fileName: 'BrennanHand-Test3.otf',
		family: 'Brennan Hand Test 3',
		finalFamily: 'Brennan Hand',
		folder: 'My Fonts',
		downloaded: false,
		earlier: { number: 2, family: 'Brennan Hand Test 2' },
		number: 3,
		gapFixes: true,
		versions: true,
	});
	card.querySelectorAll('details').forEach((details) => {
		details.open = true;
	});
	document.body.appendChild(card);
	return document.body;
}

/** B15: Font details, the Move the guide lines banner, and Help with every flag on. */
function fontDetailsHelpScreens() {
	stubLayout();
	setFeaturesForTests(Object.fromEntries(FEATURE_NAMES.map((name) => [name, true])));
	const help = sampleEditor();
	document.body.innerHTML = '<div id="app__wrapper"><header id="app__top-bar"></header></div>';
	help.nav.page = 'Help';
	help.navigate();
	const page = q('[data-anyink-help]').cloneNode(true);
	const editor = fixEditor({}, { open: 'n' });
	setCurrentProjectEditor(editor);
	setYourName(editor, 'Brennan Meyer');
	openFontDetails({ editor });
	const details = q('[data-anyink-dialog="fontDetails"]')?.cloneNode(true);
	closeFontDetails();
	document.body.innerHTML = '<div id="app__wrapper"><header id="app__top-bar"></header></div>';
	startMovingLines({ editor });
	document.body.append(page, ...(details ? [details] : []));
	return document.body;
}

/**
 * A screen that drew nothing would pass any scan: each builder's result must show what makes it
 * that screen (its elements and words), or the scan fails before it reads a word.
 * @param {Function} build
 * @param {{selectors?: Array<String>, says?: Array<String>}} must
 * @returns {Function}
 */
function checked(build, { selectors = [], says = [] }) {
	return async (recorders) => {
		const result = await build(recorders);
		const root = result instanceof Node ? result : result?.root;
		const shown = [
			root?.textContent || '',
			...Object.values((result instanceof Node ? null : result?.texts) || {}).flat(),
		]
			.join(' ')
			.replace(/\s+/g, ' ');
		const missing = [
			...selectors.filter((selector) => !root?.querySelector(selector)),
			...says.filter((text) => !shown.includes(text)),
		];
		if (missing.length) throw new Error(`the screen is not all there: ${missing.join(', ')}`);
		return result;
	};
}

export const LATER_SCREENS = Object.freeze([
	{
		name: 'the brush: a stroke, its Undo and Redo, its words (B8)',
		build: checked(brushScreen, { says: ['drew a stroke on Capital B'] }),
	},
	{
		name: 'photos: the How card, the photo dialog, the photo card (B9)',
		build: checked(photoScreens, {
			selectors: [
				'[data-anyink-dialog="howCard"]',
				'[data-anyink-dialog="photoDialog"]',
				'.anyink-photo-card',
			],
			says: [word('photo.how.title'), word('photo.card.lookRight')],
		}),
	},
	{
		name: 'the letter board, a new font (B10)',
		build: checked(boardScreen, { selectors: ['[data-anyink-board]'] }),
	},
	{
		name: 'Needs a look: reasons and fixes, and the Next line (B11)',
		build: checked(needsALookScreen, { selectors: ['[data-anyink-board]', '.anyink-board__look'] }),
	},
	{
		name: 'Try it: the strip opened (B12)',
		build: checked(tryItScreen, {}),
	},
	{
		name: 'the start screen: Continue, and the card for unsaved work (B13)',
		build: checked(startScreens, {
			selectors: ['[data-anyink-start]', '.anyink-start__card--crash'],
			says: ['Never Saved', word('startScreen.crash.continueWithIt')],
		}),
	},
	{
		name: 'Use in Word: before the file, and the install card (B14)',
		build: checked(useInWordScreens, {
			selectors: ['dialog[data-anyink-dialog="useInWord"]', 'details[open]'],
		}),
	},
	{
		name: 'Font details, Move the guide lines, Help (B15)',
		build: checked(fontDetailsHelpScreens, {
			selectors: [
				'[data-anyink-help]',
				'[data-anyink-dialog="fontDetails"]',
				'[data-anyink-banner="moveLines"]',
			],
		}),
	},
]);

/** Takes down what a builder left open. */
export function closeLaterScreens() {
	closeHowCard();
	closePhotoDialog();
	closePhotoCard();
	resetPhotoCardForTests();
	resetPhotoFlowForTests();
	closeUseInWord();
	closeFontDetails();
	stopMovingLines();
	closeTryIt();
	stopChecksForTests();
	resetChecksCacheForTests();
	resetBoardForTests();
	resetFiltersForTests();
	resetCoachActionsForTests();
	resetToastsForTests();
	vi.restoreAllMocks();
}
