// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: Simple's one Menu (UX-BEGINNER.md 4.9), opened by the top bar's Menu button. Four groups:
	  File   Save (Ctrl+S), Save as..., Open a saved font... (Ctrl+O), Start a new font... (B13),
	         Make my font file... (Ctrl+E, B14)
	  Font   Font details..., Move the guide lines... (B15)
	  View   Dark paper (switch), More tools
	  Help   How to make a font, How to photograph your letters (B9), What these words mean, Use
	         your font in Word, Keyboard keys (B15), Show tips again, Install ANY-INK as an app
	         (only when Chrome offers it), About ANY-INK
	A row shows only when visibility.js shows its 'menu.<id>' (principle 8: each names its
	feature), and a group's heading only over a row that shows (mode/sections.js keepShown).
	Stand-ins (section 10 "Stubs are named"): until B14's Make my font file... shows, the Menu
	keeps the two font file rows Simple's File menu had ("Make a font file (.otf)" with Ctrl+E, and
	"Choose where font files go...", visibility 'file.font-otf' / 'file.font-folder'); until B15's
	Help rows show, it keeps "Help", the Help page Simple has (B5's, 'help.help-page'). Without
	them turning the Menu on would take those away.
	Every row's words come from src/anyink/words; each row carries data-anyink-row with its id.

	  menuRows(editor, { isOn })   the makeContextMenu rows to draw, in order
	  openSimpleMenu(button, editor)   the menu under the button (#context-menu, marked
	                               data-anyink-menu="simple"); returns it
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { closeEveryTypeOfDialog, makeContextMenu } from '../../controls/dialogs/dialogs.js';
import { ioFont_exportOTF } from '../../formats_io/otf/font_export.js';
import { chooseExportFolder, exportFolderName } from '../files/export_folder.js';
import { openFontCommand } from '../files/open_font.js';
import { runFileCommand } from '../files/run_command.js';
import { exportWithFontCheck } from '../fontcheck/export_toast.js';
import { turnOnMoreTools } from '../mode/band.js';
import { openUseInWord } from '../mode/doors.js';
import { isFeatureOn } from '../mode/features.js';
import { fontFileKeyFormat } from '../mode/keys.js';
import { heading, item, keepShown, rule } from '../mode/sections.js';
import { isShown, menuRowId } from '../mode/visibility.js';
import { resetTips } from '../coach/coach_state.js';
import { getCanvasTheme, toggleCanvasTheme } from '../theme/theme.js';
import { toast } from '../toast/toast.js';
import { QUOTE_CLASS } from '../words/banned.js';
import { escapeWordHTML } from '../words/word_html.js';
import { word } from '../words/words.js';
import {
	FONT_DETAILS_EVENT,
	HELP_EVENT,
	HOW_CARD_EVENT,
	MOVE_GUIDE_LINES_EVENT,
	NEW_FONT_EVENT,
	openDoor,
} from './doors.js';
import { canInstall, promptInstall } from './install_offer.js';

/** Room kept between the menu and the window's edge, px */
const EDGE = 8;

/**
 * @param {String} id - the row's id ('save', 'font-otf')
 * @param {String} html - its words, as HTML
 * @returns {String}
 */
function rowHTML(id, html) {
	return `<span data-anyink-row="${id}">${html}</span>`;
}

/** @param {String} key @param {Object} [vars] @returns {String} the words, as safe HTML */
const words = (key, vars) => escapeWordHTML(word(key, vars));

/** @param {String} text @returns {String} a Windows name, as a quote (.anyink-quote) */
const quoteHTML = (text) => `<span class="${QUOTE_CLASS}">${escapeWordHTML(text)}</span>`;

/** @param {String} key @returns {Object} a group heading row */
function groupHeading(key) {
	return heading({
		child: makeElement({ tag: 'h2', content: words(key) }),
		className: 'spanAll',
	});
}

/** @returns {Object} a separator row */
const separator = () => rule({ name: 'hr' });

/**
 * @param {String} id - the row's id
 * @param {Object} data - makeContextMenu row data, without its name
 * @param {String} html - the row's words, as HTML
 * @param {String} [shownBy] - the visibility id that decides it (default 'menu.<id>')
 * @returns {Object} a section entry
 */
function row(id, data, html, shownBy = menuRowId('menu', id)) {
	return item(shownBy, { ...data, name: rowHTML(id, html) });
}

/**
 * Stand-ins: the rows Simple keeps until the rows of a later B replace them.
 * id -> (shown) => Boolean
 */
const STAND_INS = Object.freeze({
	'stand-in.font-otf': (shown) => shown('file.font-otf') && !shown('menu.make-font-file'),
	'stand-in.font-folder': (shown) => shown('file.font-folder') && !shown('menu.make-font-file'),
	'stand-in.help-page': (shown) => shown('help.help-page') && !shown('menu.help-how'),
});

/**
 * @param {Object} editor - ProjectEditor
 * @param {{isOn?: (name: String) => Boolean}} [options]
 * @returns {Array<Object>} makeContextMenu rows
 */
export function menuRows(editor, { isOn = isFeatureOn } = {}) {
	const target = () => editor || getCurrentProjectEditor();
	const go = (page) => () => {
		const ed = target();
		ed.nav.page = page;
		ed.navigate();
	};
	const otfKey = fontFileKeyFormat('otf', { mode: 'simple', isOn }) === 'otf';
	const folder = exportFolderName();
	const dark = getCanvasTheme() === 'dark';

	const entries = [
		groupHeading('topbar.menu.file'),
		row(
			'save',
			{ icon: 'command_save', note: ['Ctrl', 's'], onClick: () => save(target()) },
			words('term.save')
		),
		row(
			'save-as',
			{ icon: 'command_save', onClick: () => save(target(), true) },
			words('menu.saveAs')
		),
		row(
			'open-font',
			{
				icon: 'command_newTab',
				note: ['Ctrl', 'o'],
				onClick: () => openFontCommand({ editor: target() }),
			},
			words('menu.openSavedFont')
		),
		row(
			'new-font',
			{ icon: 'command_newTab', onClick: () => openDoor(NEW_FONT_EVENT, { cause: 'menu' }) },
			words('topbar.menu.newFont')
		),
		row(
			'make-font-file',
			{ icon: 'command_export', note: ['Ctrl', 'e'], onClick: () => openUseInWord('menu') },
			words('topbar.menu.makeFontFile')
		),
		row(
			'font-otf',
			{
				icon: 'command_export',
				note: otfKey ? ['Ctrl', 'e'] : false,
				onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportOTF),
			},
			word('menu.makeFontFile', { type: quoteHTML(word('menu.typeOtf')) }),
			'stand-in.font-otf'
		),
		row(
			'font-folder',
			{ icon: 'command_export', onClick: chooseFolder },
			folder
				? word('menu.fontFolder', { folder: quoteHTML(word('menu.fileName', { name: folder })) })
				: words('menu.chooseFontFolder'),
			'stand-in.font-folder'
		),
		separator(),
		groupHeading('topbar.menu.font'),
		row(
			'font-details',
			{ icon: 'command_info', onClick: () => openDoor(FONT_DETAILS_EVENT, { cause: 'menu' }) },
			words('topbar.menu.fontDetails')
		),
		row(
			'move-guide-lines',
			{ icon: 'command_horizontalBar', onClick: () => openDoor(MOVE_GUIDE_LINES_EVENT, {}) },
			words('topbar.menu.moveGuideLines')
		),
		separator(),
		groupHeading('topbar.menu.view'),
		row(
			'dark-paper',
			{
				icon: dark ? 'selected' : 'notSelected',
				note: word(dark ? 'topbar.menu.on' : 'topbar.menu.off'),
				onClick: () => toggleCanvasTheme(),
			},
			words('topbar.menu.darkPaper')
		),
		row(
			'more-tools',
			{ icon: 'more', onClick: () => turnOnMoreTools({ editor: target() }) },
			words('term.moreTools')
		),
		separator(),
		groupHeading('topbar.menu.help'),
		row(
			'help-how',
			{ icon: 'command_help', onClick: () => openDoor(HELP_EVENT, { section: 'how' }) },
			words('topbar.menu.helpHow')
		),
		row(
			'help-photo',
			{ icon: 'command_help', onClick: () => openDoor(HOW_CARD_EVENT, { cause: 'menu' }) },
			words('topbar.menu.helpPhoto')
		),
		row(
			'help-words',
			{ icon: 'command_help', onClick: () => openDoor(HELP_EVENT, { section: 'words' }) },
			words('topbar.menu.helpWords')
		),
		row(
			'help-word',
			{ icon: 'command_help', onClick: () => openDoor(HELP_EVENT, { section: 'word' }) },
			words('topbar.menu.helpWord')
		),
		row(
			'help-keys',
			// B16: command_help like its neighbors; upstream's 'keyboard' is drawn in 50 units and
			// spilled over the next row in makeIcon's 20 by 20 box
			{ icon: 'command_help', onClick: () => openDoor(HELP_EVENT, { section: 'keys' }) },
			words('topbar.menu.helpKeys')
		),
		row(
			'help-page',
			{ icon: 'command_help', onClick: go('Help') },
			words('topbar.menu.helpPage'),
			'stand-in.help-page'
		),
		row(
			'tips-again',
			{ icon: 'command_help', onClick: showTipsAgain },
			words('topbar.menu.tipsAgain')
		),
		row(
			'install',
			{ icon: 'command_newTab', onClick: () => promptInstall() },
			words('topbar.menu.install'),
			'install'
		),
		row('about', { icon: 'command_info', onClick: go('About') }, words('topbar.menu.about')),
	];

	const shownRow = (id) => isShown('menuRow', id, { mode: 'simple', isOn });
	const shown = (id) => {
		if (STAND_INS[id]) return STAND_INS[id](shownRow);
		if (id === 'install') return shownRow('menu.install') && canInstall();
		return shownRow(id);
	};
	return keepShown(entries, shown).map((entry) => entry.value);
}

/**
 * Save or Save as..., in the click (pickers keep the gesture), failures in the error box.
 * @param {Object} editor
 * @param {Boolean} [asCopy]
 */
function save(editor, asCopy = false) {
	return runFileCommand(() => (asCopy ? editor.saveProjectFile(true) : editor.saveProjectFile()));
}

/** Choose where font files go (until B14's Use in Word asks for its folder itself). */
function chooseFolder() {
	return runFileCommand(async () => {
		const choice = await chooseExportFolder();
		if (choice.status === 'picked') {
			toast(
				'menu.fontFolderPicked',
				{ folder: choice.dir.name },
				{ quotes: ['folder'], group: 'export' }
			);
		}
		if (choice.status === 'needsClick') toast('menu.fontFolderClickAgain', {}, { group: 'export' });
	});
}

/** Show tips again (4.0 "Tips"): the coach forgets the tips seen (prefs 'tipsSeen'), and says so. */
function showTipsAgain() {
	resetTips();
	toast('topbar.toast.tipsAgain');
}

/**
 * A press on a working row (one with data-anyink-row, not disabled) takes the menu out of the
 * page now, with no fade; the row's own click still runs (the event's path is already set).
 * Headings and rules are left to upstream's close.
 * @param {HTMLElement} menu
 * @param {Event} event
 */
function closeAtOnce(menu, event) {
	const target = /** @type {Element} */ (event.target);
	const box = [...menu.children].find((child) => child.contains(target));
	if (!box || box.hasAttribute('disabled') || !box.querySelector('[data-anyink-row]')) return;
	menu.getAnimations?.().forEach((animation) => animation.cancel());
	menu.remove();
}

/**
 * @param {HTMLElement} button - the Menu button
 * @param {Object} [editor]
 * @returns {HTMLElement} the menu
 */
export function openSimpleMenu(button, editor) {
	closeEveryTypeOfDialog();
	const rect = button.getBoundingClientRect();
	const doc = button.ownerDocument || document;
	const menu = makeContextMenu(menuRows(editor), rect.x, rect.y + rect.height);
	menu.dataset.anyinkMenu = 'simple';
	menu.setAttribute('aria-label', word('topbar.menu'));
	button.setAttribute('aria-expanded', 'true');
	button.after(menu);
	// As wide as its rows; its right edge under the button's, and never off the window
	const width = menu.getBoundingClientRect().width;
	const room = doc.documentElement?.clientWidth || globalThis.innerWidth || 0;
	const left = Math.max(EDGE, Math.min(rect.right - width, room - width - EDGE));
	menu.style.left = `${Math.round(left)}px`;
	menu.style.borderRadius = 'var(--radius) 0 var(--radius) var(--radius)';
	// A row takes the Menu away at once, before its own click opens a dialog: upstream's 120 ms
	// fade left the faded rows showing behind a dialog that answers at once (B14 + B15 fix pass)
	menu.addEventListener('click', (event) => closeAtOnce(menu, event), { capture: true });
	const closed = new MutationObserver(() => {
		if (menu.isConnected) return;
		button.setAttribute('aria-expanded', 'false');
		closed.disconnect();
	});
	closed.observe(menu.parentNode || doc.body, { childList: true });
	return menu;
}
