// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import {
	chooseExportFolder,
	exportFolderName,
	preloadExportFolder,
} from '../anyink/files/export_folder.js';
import { hasFileSystemAccess } from '../anyink/files/file_api.js';
import { runFileCommand } from '../anyink/files/run_command.js';
import { exportWithFontCheck } from '../anyink/fontcheck/export_toast.js';
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
 * @returns {Element}
 */
export function makeAppTopBar() {
	let topBar = makeElement({ tag: 'div', id: 'app__top-bar' });

	let logo = makeElement({ innerHTML: logoHorizontal, className: 'top-bar__logo' });

	let menus = makeElement({ className: 'top-bar__menus' });
	menus.appendChild(makeMenu('File'));
	menus.appendChild(makeMenu('Projects'));
	menus.appendChild(makeMenu('Help'));

	addAsChildren(topBar, [logo, menus, document.createElement('anyink-save-status')]);

	return topBar;
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
				[
					{
						child: makeProjectPreviewRow(0),
						className: 'spanAll',
					},
					{
						child: makeProjectPreviewRow(1),
						className: 'spanAll',
					},
					{
						name: 'Cross-project actions',
						icon: 'command_crossProjectActions',
						onClick: () => {
							getGlyphrStudioApp().appPageNavigate(makePage_CrossProjectActions);
						},
						disabled: onlyOneOpen,
						note: onlyOneOpen ? 'Open another font first' : false,
					},
					{
						name: 'hr',
					},
					{
						name: 'Open a separate project in a new window',
						icon: 'command_newTab',
						onClick: () => {
							window.open(window.location.href, '_blank');
						},
					},
				],
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
					[
						{
							name: 'In-app help',
							icon: 'command_help',
							onClick: () => {
								let editor = getCurrentProjectEditor();
								editor.nav.page = 'Help';
								editor.navigate();
							},
						},
						{
							name: 'About ANY-INK',
							icon: 'command_info',
							onClick: () => {
								let editor = getCurrentProjectEditor();
								editor.nav.page = 'About';
								editor.navigate();
							},
						},
					],
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
 * @param {ProjectEditor} editor
 * @returns {Array} context menu row data
 */
function makeFileMenuData(editor) {
	/** @type {Array} */
	let fileMenuData = [];
	// Preferred font export format (the format that was imported, or 'otf'
	// for new projects) drives the file name preview and the Ctrl+E note.
	const preferredExportFormat = getPreferredExportFormat();
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
					content: projectDisplayName,
				}),
				className: 'spanAll',
			},
			{
				name: 'Save',
				icon: 'command_save',
				note: ['Ctrl', 's'],
				onClick: () => runFileCommand(() => editor.saveProjectFile()),
			},
			{
				name: 'Save as...',
				icon: 'command_save',
				note: ['Ctrl', 'Shift', 's'],
				onClick: () => runFileCommand(() => editor.saveProjectFile(true)),
			}
		);
	} else {
		fileMenuData.push(
			{
				child: makeElement({
					tag: 'h2',
					content: makeFileName('gs2', true),
				}),
				className: 'spanAll',
			},
			{
				name: 'Save project file (to downloads folder)',
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
				content:
					`${editor.project.settings.font.family}-${editor.project.settings.font.style}.${preferredExportFormat}`.replaceAll(
						' ',
						''
					),
			}),
			className: 'spanAll',
		},
		{
			name: 'Export OTF file',
			icon: 'command_export',
			note: preferredExportFormat === 'otf' ? ['Ctrl', 'e'] : false,
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportOTF),
		},
		{
			name: 'Export TTF file',
			icon: 'command_export',
			note: preferredExportFormat === 'ttf' ? ['Ctrl', 'e'] : false,
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportTTF),
		},
		{
			name: 'Export WOFF file',
			icon: 'command_export',
			note: preferredExportFormat === 'woff' ? ['Ctrl', 'e'] : false,
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportWOFF),
		},
		{
			name: 'Export WOFF2 file',
			icon: 'command_export',
			note: preferredExportFormat === 'woff2' ? ['Ctrl', 'e'] : false,
			onClick: () => runFileCommand(exportWithFontCheck, ioFont_exportWOFF2),
		},
	]);
	if (fileSystemAccess) {
		const folderName = exportFolderName();
		fileMenuData.push({
			name: folderName ? `Export folder: ${folderName}...` : 'Choose export folder...',
			icon: 'command_export',
			onClick: () =>
				runFileCommand(async () => {
					const choice = await chooseExportFolder();
					if (choice.status === 'picked') showToast(`Fonts will export to ${choice.dir.name}`);
					if (choice.status === 'needsClick') showToast('Click again to choose an export folder.');
				}),
		});
	}
	fileMenuData = fileMenuData.concat([
		{ name: 'hr' },
		{
			child: makeElement({
				tag: 'h2',
				content: makeFileName('svg'),
			}),
			className: 'spanAll',
		},
		{
			name: 'Export SVG font file',
			icon: 'command_export',
			note: ['Ctrl', 'g'],
			onClick: ioSVG_exportSVGfont,
		},
	]);
	return fileMenuData;
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
		title.innerHTML = 'Open another font'; // ANY-INK (B1): house words
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
