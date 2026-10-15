// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5 wiring: reads the controls a person can see off the real screens, in jsdom. The pages are
	drawn into #app__wrapper by the real Navigator, the menus by the real top bar, the settings
	tabs by their real makers, and the tool keys are pressed through the real key handler. Nothing
	here reads visibility.js: it records what the screens show, so a test can hold All tools to the
	snapshot taken before B5 wired the filters in (today_controls.json), and hold Simple to 6.2.

	  probeControls()   { topMenus, fileMenu, projectsMenu, helpMenu, pages, actions, settings,
	                      toolKeys, hideUI }
	  isVisible(element)   false inside anything hidden (the hidden attribute or display: none)
*/
import { getActionData } from '../../../panels/actions.js';
import { makeAppTopBar } from '../../../app/menu.js';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { makeSettingsTabContentApp } from '../../../pages/settings_app.js';
import { makeSettingsTabContentFont } from '../../../pages/settings_font.js';
import { makeSettingsTabContentProject } from '../../../pages/settings_project.js';
import { createComponent } from '../../../pages/components.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { actionId } from '../visibility.js';

export const PAGES = [
	'Overview',
	'Characters',
	'Ligatures',
	'Components',
	'Kerning',
	'Live preview',
	'Global actions',
	'Settings',
	'Help',
	'About',
];

export const ACTION_GROUPS = [
	'allActions',
	'addShapeActions',
	'glyphActions',
	'shapeActions',
	'componentInstanceActions',
	'kernGroupActions',
	'otherKernGroupActions',
	'layerActions',
	'alignShapeActions',
	'alignPointActions',
	'boolActions',
	'pointActions',
];

/**
 * @param {Element | null} element
 * @returns {Boolean} false when it or an ancestor is hidden
 */
export function isVisible(element) {
	for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
		if (node.hidden || node.hasAttribute?.('hidden')) return false;
		if (node.style?.display === 'none') return false;
	}
	return !!element;
}

const text = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
const firstLine = (title) => String(title || '').split('\n')[0];

/** A fresh editor on the sample font, current; the elements the pages draw are defined. */
export function sampleEditor() {
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	return editor;
}

/**
 * @param {ProjectEditor} editor
 * @param {String} page
 */
function openPage(editor, page) {
	document.body.innerHTML = '<div id="app__wrapper"></div>';
	editor.nav.page = page;
	editor.nav.panel = 'Attributes';
	editor.navigate();
	// jsdom has no <edit-canvas> element; the key handler and the page redraw it
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	if (!editor.eventHandlers.tool_addPath) editor.eventHandlers.tool_addPath = {};
	if (!editor.eventHandlers.tool_pan)
		editor.eventHandlers.tool_pan = { mousedown() {}, mouseup() {} };
}

/** The rows of the open context menu, as row ids, headings and rules. */
function contextRows() {
	const menu = document.querySelector('#context-menu');
	if (!menu) return null;
	return [...menu.children].filter(isVisible).map((row) => {
		const mark = row.querySelector('[data-anyink-row]');
		if (mark) return mark.dataset.anyinkRow;
		if (row.querySelector('hr') || row.tagName === 'HR' || row.classList.contains('hr'))
			return 'hr';
		if (row.querySelector('h2')) return 'heading';
		return text(row).slice(0, 40) || row.className;
	});
}

/**
 * Opens one top bar menu and reads its rows.
 * @param {String} name - 'File', 'Projects', 'Help'
 * @returns {Array<String> | null} null when the menu isn't in the top bar
 */
function menuRows(name) {
	document.body.innerHTML = '';
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	const entry = [...topBar.querySelectorAll('.menu-entry-point')].find(
		(button) => text(button) === name && isVisible(button)
	);
	if (!entry) return null;
	entry.click();
	return contextRows();
}

/** @returns {Array<String>} the top bar's menus */
function topMenus() {
	document.body.innerHTML = '';
	const topBar = makeAppTopBar();
	document.body.appendChild(topBar);
	return [...topBar.querySelectorAll('.menu-entry-point')].filter(isVisible).map(text);
}

/** The File menu with and without the File System Access pickers. */
function fileMenu() {
	const result = {};
	resetFileApi();
	result.download = menuRows('File');
	setFileApi({ showOpenFilePicker() {}, showSaveFilePicker() {}, showDirectoryPicker() {} });
	result.fileSystem = menuRows('File');
	resetFileApi();
	return result;
}

/**
 * What one page shows: its chooser buttons and their dropdowns, tools, view tools, the panel.
 * @param {ProjectEditor} editor
 * @param {String} page
 */
function probePage(editor, page) {
	openPage(editor, page);
	const result = { page: editor.nav.page };
	const nav = ['l1', 'l2', 'l3'].filter((level) =>
		isVisible(document.querySelector(`#nav-button-${level}`))
	);
	result.nav = nav;
	const l1 = document.querySelector('#nav-button-l1');
	if (l1 && isVisible(l1)) {
		l1.click();
		const dropdown = document.querySelector('#nav-dropdown-page');
		result.pageChooser = dropdown
			? [...dropdown.querySelectorAll('h3, .nav-dropdown__button')]
					.filter(isVisible)
					.map((row) => (row.tagName === 'H3' ? `# ${text(row)}` : text(row)))
			: null;
		dropdown?.remove();
	}
	const l3 = document.querySelector('#nav-button-l3');
	if (l3 && isVisible(l3)) {
		l3.click();
		const dropdown = document.querySelector('#nav-dropdown-panel');
		result.panelChooser = dropdown
			? [...dropdown.querySelectorAll('.nav-dropdown__button')]
					.filter(isVisible)
					.map((row) => row.dataset.panelId)
			: null;
		dropdown?.remove();
	}
	const panel = document.querySelector('#editor-page__panel');
	if (panel) {
		result.panel = isVisible(panel) && panel.children.length > 0 && text(panel).length > 0;
		result.panelActions = [...panel.querySelectorAll('.action-button, button[title]')]
			.filter(isVisible)
			.map((button) => firstLine(button.getAttribute('title')))
			.filter(Boolean);
	}
	const tools = document.querySelector('.editor-page__tools-area');
	if (tools) {
		result.tools = [...tools.querySelectorAll('button')]
			.filter(isVisible)
			.map((button) => button.getAttribute('title'));
	}
	const zoom = document.querySelector('.editor-page__zoom-area');
	if (zoom) {
		result.viewTools = [...zoom.querySelectorAll('button, input')]
			.filter(isVisible)
			.map((control) => control.getAttribute('title'));
	}
	return result;
}

/** getActionData's ids per group, on the Characters and Components pages. */
function actions(editor) {
	const result = {};
	['Characters', 'Components'].forEach((page) => {
		editor.nav.page = page;
		result[page] = Object.fromEntries(
			ACTION_GROUPS.map((group) => [
				group,
				[].concat(getActionData(group)).map((entry) => actionId(group, entry)),
			])
		);
	});
	return result;
}

/** One settings tab: its headings and row labels, in order. */
function settingsTab(make) {
	document.body.innerHTML = '';
	const tab = make();
	document.body.appendChild(tab);
	return [...tab.querySelectorAll('h2, h3, .settings__label, label, fancy-button')]
		.filter(isVisible)
		.map((element) => {
			const tag = element.tagName.toLowerCase();
			if (tag === 'h2' || tag === 'h3') return `${tag}: ${text(element)}`;
			if (tag === 'fancy-button') return `button: ${text(element)}`;
			return text(element).replace(/:$/, '');
		})
		.filter(Boolean);
}

function press(type, key, options = {}) {
	const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...options });
	if (type === 'keydown') handleKeyPress(event);
	else handleKeyUp(event);
}

/** Every plain letter on a letter's canvas: the tool it picks (null: none). */
function toolKeys(editor) {
	openPage(editor, 'Characters');
	const result = {};
	'abcdefghijklmnopqrstuvwxyz'.split('').forEach((key) => {
		editor.selectedTool = 'none';
		press('keydown', key);
		press('keyup', key);
		result[key] = editor.selectedTool === 'none' ? null : editor.selectedTool;
	});
	editor.selectedTool = 'resize';
	return result;
}

/** Ctrl+Space on a letter's canvas: does the whole UI hide? */
function hideUI(editor) {
	openPage(editor, 'Characters');
	press('keydown', 'Control');
	press('keydown', ' ');
	const shown = !!document.getElementById('hideUI');
	press('keyup', ' ');
	press('keyup', 'Control');
	document.getElementById('hideUI')?.remove();
	eventHandlerData.isCtrlDown = false;
	eventHandlerData.isSpaceDown = false;
	eventHandlerData.isPanning = false;
	return shown;
}

/**
 * @returns {Object} everything a person can see, per area
 */
export function probeControls() {
	const editor = sampleEditor();
	createComponent('Probe');
	editor.selectedGlyphID = 'glyph-0x41';
	const result = {
		topMenus: topMenus(),
		fileMenu: fileMenu(),
		projectsMenu: menuRows('Projects'),
		helpMenu: menuRows('Help'),
		pages: {},
	};
	PAGES.forEach((page) => {
		result.pages[page] = probePage(editor, page);
	});
	result.actions = actions(editor);
	result.settings = {
		project: settingsTab(makeSettingsTabContentProject),
		font: settingsTab(makeSettingsTabContentFont),
		app: settingsTab(makeSettingsTabContentApp),
	};
	result.toolKeys = toolKeys(editor);
	result.hideUI = hideUI(editor);
	document.body.innerHTML = '';
	return result;
}
