// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	chooseExportFolder,
	exportFolderName,
	preloadExportFolder,
} from '../anyink/files/export_folder.js';
import { hasFileSystemAccess } from '../anyink/files/file_api.js';
import { openFontCommand } from '../anyink/files/open_font.js';
import { runFileCommand } from '../anyink/files/run_command.js';
import { exportWithFontCheck } from '../anyink/fontcheck/export_toast.js';
import { makeBand } from '../anyink/mode/band.js';
import { fontFileKeyFormat } from '../anyink/mode/keys.js';
import { toast } from '../anyink/toast/toast.js';
import { heading, item, keepShown, rule } from '../anyink/mode/sections.js';
import { isShown, menuRowId } from '../anyink/mode/visibility.js';
import { makeSimpleTopBar, useSimpleTopBar } from '../anyink/topbar/simple_top_bar.js';
import { QUOTE_CLASS } from '../anyink/words/banned.js';
import { word } from '../anyink/words/words.js';
import { addAsChildren, insertAfter, makeElement } from '../common/dom.js';
import logoHorizontal from '../common/graphics/anyink-wordmark-horizontal-small.svg?raw';
import {
	closeEveryTypeOfDialog,
	makeContextMenu,
	showModalDialog,
	showToast,
} from '../controls/dialogs/dialogs.js';
import {
	getPreferredExportFormat,
	ioFont_exportOTF,
	ioFont_exportTTF,
	ioFont_exportWOFF,
	ioFont_exportWOFF2,
} from '../formats_io/otf/font_export.js';
import { ioSVG_exportSVGfont } from '../formats_io/svg_font/svg_font_export.js';
import { makeFileName } from '../project_editor/file_io.js';
import { makePage_CrossProjectActions } from './cross_project_actions/cross_project_actions.js';
import { getCurrentProjectEditor, getGlyphrStudioApp } from './main.js';
import { makePage_OpenProject } from './open_project.js';

// --------------------------------------------------------------
// Top bar for the App
// --------------------------------------------------------------

/**
 * Makes the Top Bar for the App
 * ANY-INK (B5, UX-BEGINNER 6.2 Menus): only the menus the mode shows (Simple has no Projects
 * menu). Navigator.navigate puts makeAppBand() right under it.
 * @returns {Element}
 */
export function makeAppTopBar() {
	// ANY-INK (B6, UX-BEGINNER 4.0): Simple's own top bar once its flag ('coach') is on
	// (src/anyink/topbar/simple_top_bar.js); All tools, and Simple before B6, keep this one.
	if (useSimpleTopBar()) return makeSimpleTopBar();
	let topBar = makeElement({ tag: 'div', id: 'app__top-bar' });

	let logo = makeElement({ innerHTML: logoHorizontal, className: 'top-bar__logo' });

	let menus = makeElement({ className: 'top-bar__menus' });
	[makeMenu('File'), makeMenu('Projects'), makeMenu('Help')]
		.filter((entryPoint) => isShown('menu', entryPoint.dataset.anyinkMenu))
		.forEach((entryPoint) => menus.appendChild(entryPoint));

	addAsChildren(topBar, [logo, menus, document.createElement('anyink-save-status')]);

	return topBar;
}

/**
 * ANY-INK (B5, UX-BEGINNER 4.11, 6.3): the purple More tools band, drawn with the top bar on
 * every navigate (the landing rule has already run, at the top of Navigator.navigate). Only
 * when All tools was reached from Simple: as the launch default, All tools has no band.
 * @returns {HTMLElement | null}
 */
export function makeAppBand() {
	return makeBand();
}

/**
 * ANY-INK (B5, UX-BEGINNER 6.3): a menu's rows, only those the mode shows (visibility.js
 * 'menuRow', menuRowId(menu, id)). A row's id is its data-anyink-row mark (B4) or its anyinkRow
 * field; a row with a child and no id is a heading, kept only over a row that shows; 'hr' is a
 * rule. A row with no id is unknown: All tools shows it, Simple doesn't.
 * @param {String} menu - 'file', 'projects', 'help'
 * @param {Array<Object>} rows - makeContextMenu row data
 * @returns {Array<Object>} the rows to draw
 */
function rowsShown(menu, rows) {
	const entries = rows.map((row) => {
		if (row.name === 'hr') return rule(row);
		const mark = /data-anyink-row="([\w-]+)"/.exec(String(row.name || ''));
		const id = row.anyinkRow || mark?.[1];
		if (id) return item(menuRowId(menu, id), row);
		if (row.child) return heading(row);
		return item(menuRowId(menu, 'unknown'), row);
	});
	return keepShown(entries, (id) => isShown('menuRow', id)).map((entry) => entry.value);
}

// --------------------------------------------------------------
// Menu
// --------------------------------------------------------------

/**
 * Makes one menu, with an entry point and a hidden dropdown
 * @param {String} menuName - Name for the menu entry point
 * @returns {Element}
 */
function makeMenu(menuName) {
	let entryPoint = makeElement({
		tag: 'button',
		innerHTML: menuName,
		className: 'menu-entry-point',
		// ANY-INK (B5): its id in visibility.js's 'menu' area
		attributes: { 'data-anyink-menu': menuName.toLowerCase() },
	});
	if (menuName === 'File') {
		// ANY-INK: the export-folder name is read from IndexedDB; warm it now so the
		// menu can label the item synchronously when it opens.
		preloadExportFolder();
		entryPoint.addEventListener('click', (event) => {
			// @ts-expect-error 'property does exist'
			let rect = event.target.getBoundingClientRect();
			closeEveryTypeOfDialog();
			// Built on every open (not once per top bar) so Save As, a new file handle,
			// or a new export folder show up without a page navigation.
			const fileMenuData = makeFileMenuData(getCurrentProjectEditor());
			insertAfter(entryPoint, makeContextMenu(fileMenuData, rect.x, rect.y + rect.height));
		});
	}

	if (menuName === 'Projects') {
		entryPoint.addEventListener('click', (event) => {
			// @ts-expect-error 'property does exist'
			let rect = event.target.getBoundingClientRect();
			closeEveryTypeOfDialog();
			// ANY-INK (B1, principle 6): a greyed-out row says why, beside it.
			const onlyOneOpen = getGlyphrStudioApp().projectEditors.length === 1;
			let menuRows = makeContextMenu(
				rowsShown('projects', [
					{
						child: makeProjectPreviewRow(0),
						className: 'spanAll',
						anyinkRow: 'preview-0',
					},
					{
						child: makeProjectPreviewRow(1),
						className: 'spanAll',
						anyinkRow: 'preview-1',
					},
					{
						anyinkRow: 'cross-project-actions',
						name: 'Cross-project actions',
						icon: 'command_crossProjectActions',
						onClick: () => {
							getGlyphrStudioApp().appPageNavigate(makePage_CrossProjectActions);
						},
						disabled: onlyOneOpen,
						note: onlyOneOpen ? word('menu.openAnotherFontFirst') : false,
					},
					{
						name: 'hr',
					},
					{
						anyinkRow: 'new-window',
						name: 'Open a separate project in a new window',
						icon: 'command_newTab',
						onClick: () => {
							window.open(window.location.href, '_blank');
						},
					},
				]),
				rect.x,
				rect.y + rect.height,
				500
			);

			insertAfter(entryPoint, menuRows);
		});
	}

	if (menuName === 'Help') {
		entryPoint.addEventListener('click', (event) => {
			// @ts-expect-error 'property does exist'
			let rect = event.target.getBoundingClientRect();
			closeEveryTypeOfDialog();
			insertAfter(
				entryPoint,
				makeContextMenu(
					rowsShown('help', [
						{
							anyinkRow: 'help-page',
							name: 'In-app help',
							icon: 'command_help',
							onClick: () => {
								let editor = getCurrentProjectEditor();
								editor.nav.page = 'Help';
								editor.navigate();
							},
						},
						{
							anyinkRow: 'about',
							name: 'About ANY-INK',
							icon: 'command_info',
							onClick: () => {
								let editor = getCurrentProjectEditor();
								editor.nav.page = 'About';
								editor.navigate();
							},
						},
					]),
					rect.x,
					rect.y + rect.height
				)
			);
		});
	}

	return entryPoint;
}

/**
 * Rows for the File menu, reflecting the editor's current file state.
 * With the File System Access API (D-012): Save writes in place through the open
 * handle (or asks where, the first time), Save as... always asks, and fonts export
 * into a remembered folder. Without it: upstream's download entries, unchanged.
 * Every file row runs through runFileCommand: called in the click (pickers keep
 * the activation), failures shown in the error box, no unhandled rejections.
 * ANY-INK (B4, UX-BEGINNER.md 2.2, 2.4 E): a display point Simple shares with More tools, so
 * every row says the house words in both modes (work file, font file), from
 * src/anyink/words; file names, folder names and file types are quotes (.anyink-quote). Each
 * row carries its id in data-anyink-row, so tests and later Bs find it without its words.
 * ANY-INK (B5): the rows the mode shows, by those ids (rowsShown).
 * ANY-INK (B5 fix track): the font file heading and the Ctrl+E note name the file Ctrl+E really
 * makes (keys.js fontFileKeyFormat): All tools' preferred format, Simple's .otf, never a format
 * Simple hides. Simple gets "Open a saved font... (Ctrl+O)" (open_font.js, the box and picker
 * Ctrl+O uses) until B6's Menu. A row has at most two key chips: the menu grid has two key
 * cells, and a third wrapped onto its own line (Save as).
 * @param {ProjectEditor} editor
 * @returns {Array} context menu row data
 */
function makeFileMenuData(editor) {
	/** @type {Array} */
	let fileMenuData = [];
	// Preferred font export format (the format that was imported, or 'otf'
	// for new projects) drives the file name preview and the Ctrl+E note.
	// ANY-INK (B5 fix track): the format Ctrl+E makes in this mode (Simple: always 'otf'); with
	// no file from the key (Use in Word) the heading names the .otf and no row has the note.
	const keyFormat = fontFileKeyFormat(getPreferredExportFormat());
	const preferredExportFormat = keyFormat || 'otf';
	const keyNote = (format) => (keyFormat === format ? ['Ctrl', 'e'] : false);
	const fileSystemAccess = hasFileSystemAccess();
	if (fileSystemAccess) {
		let projectDisplayName = `${editor.project.settings.project.name}.gs2`;

		// @ts-expect-error 'property does exist'
		if (typeof editor?.loadedFileHandle?.name === 'string') {
			// @ts-expect-error 'property does exist'
			projectDisplayName = editor.loadedFileHandle.name;
		}

		fileMenuData.push(
			{
				child: makeElement({
					tag: 'h2',
					content: quoteHTML(projectDisplayName),
				}),
				className: 'spanAll',
			},
			{
				name: rowHTML('save', escapeText(word('term.save'))),
				icon: 'command_save',
				note: ['Ctrl', 's'],
				onClick: () => runFileCommand(() => editor.saveProjectFile()),
			},
			{
				name: rowHTML('save-as', escapeText(word('menu.saveAs'))),
				icon: 'command_save',
				// two chips: a third wrapped onto a line of its own
				note: ['Ctrl+Shift', 's'],
				onClick: () => runFileCommand(() => editor.saveProjectFile(true)),
			},
			{
				// Simple only, until B6's Menu (visibility.js 'file.open-font')
				name: rowHTML('open-font', escapeText(word('menu.openSavedFont'))),
				icon: 'command_newTab',
				note: ['Ctrl', 'o'],
				onClick: () => openFontCommand({ editor }),
			}
		);
	} else {
		fileMenuData.push(
			{
				child: makeElement({
					tag: 'h2',
					content: quoteHTML(makeFileName('gs2', true)),
				}),
				className: 'spanAll',
			},
			{
				name: rowHTML('save', escapeText(word('menu.saveDownload'))),
				icon: 'command_save',
				note: ['Ctrl', 's'],
				onClick: () => runFileCommand(() => editor.saveProjectFile()),
			}
		);
	}
	fileMenuData = fileMenuData.concat([
		{ name: 'hr' },
		{
			child: makeElement({
				tag: 'h2',
				content: quoteHTML(
					`${editor.project.settings.font.family}-${editor.project.settings.font.style}.${preferredExportFormat}`.replaceAll(
						' ',
						''
					)
				),
			}),
			className: 'spanAll',
		},
		{
			name: fontFileRow('otf', 'menu.makeFontFile', 'menu.typeOtf'),
			icon: 'command_export',
			note: keyNote('otf'),
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportOTF),
		},
		{
			name: fontFileRow('ttf', 'menu.makeFontFile', 'menu.typeTtf'),
			icon: 'command_export',
			note: keyNote('ttf'),
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportTTF),
		},
		{
			name: fontFileRow('woff', 'menu.makeWebFontFile', 'menu.typeWoff'),
			icon: 'command_export',
			note: keyNote('woff'),
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportWOFF),
		},
		{
			name: fontFileRow('woff2', 'menu.makeWebFontFile', 'menu.typeWoff2'),
			icon: 'command_export',
			note: keyNote('woff2'),
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportWOFF2),
		},
	]);
	if (fileSystemAccess) {
		const folderName = exportFolderName();
		fileMenuData.push({
			name: rowHTML(
				'font-folder',
				folderName
					? word('menu.fontFolder', { folder: quoteHTML(folderName) })
					: escapeText(word('menu.chooseFontFolder'))
			),
			icon: 'command_export',
			onClick: () =>
				runFileCommand(async () => {
					const choice = await chooseExportFolder();
					// B4 integration: house words through the one toast voice, the folder as a quote
					// B4 + B5 finalize: the font file's stream (group 'export'), so they take an export
					// toast's place at once instead of waiting behind it
					if (choice.status === 'picked') {
						toast(
							'menu.fontFolderPicked',
							{ folder: choice.dir.name },
							{ quotes: ['folder'], group: 'export' }
						);
					}
					if (choice.status === 'needsClick')
						toast('menu.fontFolderClickAgain', {}, { group: 'export' });
				}),
		});
	}
	fileMenuData = fileMenuData.concat([
		{ name: 'hr' },
		{
			child: makeElement({
				tag: 'h2',
				content: quoteHTML(makeFileName('svg')),
			}),
			className: 'spanAll',
		},
		{
			name: fontFileRow('svg', 'menu.makeFontFile', 'menu.typeSvg'),
			icon: 'command_export',
			note: ['Ctrl', 'g'],
			onClick: ioSVG_exportSVGfont,
		},
	]);
	// ANY-INK (B5, UX-BEGINNER 6.2 Menus): only the rows the mode shows (Simple: no TTF, WOFF,
	// WOFF2 or SVG font file, no export folder row; the headings over them go too)
	return rowsShown('file', fileMenuData);
}

/**
 * ANY-INK (B4): a File menu row's name, marked with its id.
 * @param {String} id - 'save', 'save-as', 'font-otf', 'font-folder', ...
 * @param {String} html - the row's words, as HTML
 * @returns {String} HTML for the row name
 */
function rowHTML(id, html) {
	return `<span data-anyink-row="${id}">${html}</span>`;
}

/**
 * ANY-INK (B4): a font file row: 'Make a font file (.otf)', the file type shown as a quote.
 * @param {String} type - 'otf', 'ttf', 'woff', 'woff2', 'svg'
 * @param {String} key - 'menu.makeFontFile' or 'menu.makeWebFontFile'
 * @param {String} typeKey - the quote entry for the file type ('menu.typeOtf')
 * @returns {String} HTML for the row name
 */
function fontFileRow(type, key, typeKey) {
	const quoted = `<span class="${QUOTE_CLASS}">${escapeText(word(typeKey))}</span>`;
	return rowHTML(`font-${type}`, word(key, { type: quoted }));
}

/**
 * ANY-INK (B4): a file or folder name, shown as a quote (an exact Windows label).
 * @param {String} name
 * @returns {String} HTML
 */
function quoteHTML(name) {
	return `<span class="${QUOTE_CLASS}">${escapeText(
		word('menu.fileName', { name: String(name) })
	)}</span>`;
}

/**
 * @param {String} text
 * @returns {String} safe inside HTML
 */
function escapeText(text) {
	return String(text ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/**
 * Makes a special row for a menu that displays a small
 * project preview
 * @param {Number} projectID - which project to show
 * @returns {Element}
 */
function makeProjectPreviewRow(projectID = 0) {
	// log(`makeProjectPreviewRow`, 'start');
	// log(`projectID: ${projectID}`);
	const app = getGlyphrStudioApp();
	const projectEditor = app.projectEditors[projectID];
	// log(`\n⮟projectEditor⮟`);
	// log(projectEditor);

	let rowWrapper = makeElement({ tag: 'div', className: 'project-preview__row-wrapper' });
	let superTitle;
	let title = makeElement({ tag: 'h3' });
	let thumbnail;

	if (projectEditor) {
		superTitle = makeElement({ className: 'project-preview__super-title' });
		if (getCurrentProjectEditor() === projectEditor) {
			superTitle.innerHTML = 'Editing';
			rowWrapper.classList.add('project-preview__primary');
		} else {
			superTitle.innerHTML = 'Switch to';
			rowWrapper.classList.add('project-preview__secondary');
			rowWrapper.addEventListener('click', () => {
				const app = getGlyphrStudioApp();
				app.selectedProjectEditor = projectEditor;
				app.selectedProjectEditor.navigate();
				showToast(`Switched to<br>${projectEditor.project.settings.project.name}`, 2000, true);
			});
		}
		title.innerHTML = projectEditor.project.settings.project.name;
		let previewText = projectEditor.project.settings.app.previewText || 'Aa Bb Cc Xx Yy Zz';
		thumbnail = makeElement({
			tag: 'display-canvas',
			attributes: {
				text: previewText,
				'font-size': '24',
				'project-editor': projectID,
				'show-placeholder-message': 'true',
			},
		});
	} else {
		title.textContent = word('menu.openAnotherFont'); // ANY-INK (B1, B4): house words
		rowWrapper.classList.add('project-preview__no-project');
		rowWrapper.addEventListener('click', () => {
			showModalDialog(makePage_OpenProject(true), 500, true);
		});
	}

	if (superTitle) addAsChildren(rowWrapper, superTitle);
	addAsChildren(rowWrapper, title);
	if (thumbnail) addAsChildren(rowWrapper, thumbnail);

	// log(`makeProjectPreviewRow`, 'end');
	return rowWrapper;
}
