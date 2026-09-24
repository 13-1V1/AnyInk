// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { noteImportedFontFile } from '../anyink/files/export_folder.js';
import {
	hasFileSystemAccess,
	noteProjectOpened,
	openProjectFromPicker,
} from '../anyink/files/project_files.js';
import { makeRecentFilesCard } from '../anyink/files/recents_ui.js';
import { runFileCommand } from '../anyink/files/run_command.js';
import { isProjectFileHandle } from '../anyink/files/write_file.js';
import { makeRecoverArea } from '../anyink/recovery/recovery_ui.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import logoVertical from '../common/graphics/anyink-wordmark-vertical.svg?raw';
import { closeEveryTypeOfDialog, showError, showToast } from '../controls/dialogs/dialogs.js';
import { makeProgressIndicator } from '../controls/progress-indicator/progress_indicator.js';
import { cancelDefaultEventActions } from '../edit_canvas/events.js';
import { ioFont_importFont } from '../formats_io/otf/font_import.js';
import { ioSVG_importSVGfont } from '../formats_io/svg_font/svg_font_import.js';
import { validateSingleFileInput } from '../formats_io/validate_file_input.js';
import { GlyphrStudioProject } from '../project_data/glyphr_studio_project.js';
import { importGlyphrProjectFromText } from '../project_editor/import_project.js';
import obleggExampleProject from '../samples/oblegg.gs2?raw';
import simpleExampleProject from '../samples/simpleExampleProject.json';
import { updateWindowUnloadEvent } from './app.js';
import {
	addProjectEditorAndSetAsImportTarget,
	getCurrentProjectEditor,
	getGlyphrStudioApp,
	getProjectEditorImportTarget,
	setCurrentProjectEditor,
} from './main.js';

/**
 * Page > Open Project
 * The first page you see when you open Glyphr Studio.
 */
let isSecondProject;

/**
 * Page Maker for the Open Project page
 * @param {Boolean} secondProjectFlag - true if it's not the currently selected project
 * @returns {Element}
 */
export function makePage_OpenProject(secondProjectFlag = false) {
	// log(`makePage_OpenProject`, 'start');
	// log(`secondProjectFlag: ${secondProjectFlag}`);
	isSecondProject = secondProjectFlag;
	const app = getGlyphrStudioApp();

	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
			<div id="open-project__page">
				<div id="open-project__left-area" vertical-align="middle">
					<div id="open-project__logo">${logoVertical}</div>
					<span class="open-project__version-name">${app.versionName}</span>
					<span class="open-project__version-number">A personal, purely visual font editor</span>
					<div class="open-project__blurb">
						Built on Glyphr Studio v2 by Matthew LaGrandeur, under the
						<a href="https://www.gnu.org/licenses/gpl.html" target="_blank">GNU General Public License</a>.
						See Help &gt; About for credits.
					</div>
				</div>
				<div id="open-project__right-area" vertical-align="middle"></div>
				<div id="open-project__drop-note"></div>
			</div>
		`,
	});

	// Tabs
	const tableRight = content.querySelector('#open-project__right-area');
	// ANY-INK (M6): unsaved work from a crashed or closed tab is offered right here,
	// above the tabs, so nobody has to go looking for the Recover tab.
	if (!isSecondProject) tableRight.appendChild(makeRecoverArea({ banner: true }));
	tableRight.appendChild(makeOpenProjectTabs());
	showDefaultTab(content);

	// Drag over handlers
	const page = content.querySelector('#open-project__page');
	page.addEventListener('dragenter', handleDragEnter);
	page.addEventListener('dragover', cancelDefaultEventActions);

	// Drop and Drag Leave handlers
	const dropNote = content.querySelector('#open-project__drop-note');

	dropNote.addEventListener('drop', (/** @type {DragEvent} */ event) => {
		cancelDefaultEventActions(event);
		handleOpenProjectPageFileInput(event?.dataTransfer?.items || []);
	});
	dropNote.addEventListener('dragleave', handleDragLeave);

	// log(`makePage_OpenProject`, 'end');
	return content;
}

/**
 * makeOpenProjectTabs creates all tab content as display:hidden
 * this function selects the default tab and content
 * @param {Document | HTMLElement} node - wrapper for the tab
 */
function showDefaultTab(node) {
	if (isSecondProject) {
		/** @type {HTMLElement} */
		const loadArea = node.querySelector('#tab-content__load');
		loadArea.style.display = 'block';
		node.querySelector('#open-project__tab-load').setAttribute('selected', '');
	} else {
		/** @type {HTMLElement} */
		const newArea = node.querySelector('#tab-content__new');
		newArea.style.display = 'block';
		node.querySelector('#open-project__tab-new').setAttribute('selected', '');
	}
}

/**
 * Import OTF/SVG/Project functions can call this if import fails and
 * the user needs a second try to specify how to start their project.
 */
export function resetOpenProjectTabs() {
	const tableRight = document.querySelector('#open-project__right-area');
	tableRight.innerHTML = '';
	if (!isSecondProject) tableRight.appendChild(makeRecoverArea({ banner: true }));
	tableRight.appendChild(makeOpenProjectTabs());
	showDefaultTab(document);
}

/**
 * Create the tabs for the load project page
 * @returns {Element} DOM node
 */
export function makeOpenProjectTabs() {
	// --------------------------------------------------------------
	// Make contents for each tab
	// --------------------------------------------------------------

	// Content for New Project tab
	const tabContentNew = makeElement({
		id: 'tab-content__new',
		className: 'open-project__tab-content',
		innerHTML: '<h2>Start a new project</h2>\nProject name: &nbsp;',
		style: 'display: none;',
	});

	const inputProjectName = makeElement({
		tag: 'input',
		id: 'input__new-project-name',
		attributes: { type: 'text', value: 'My Font', autofocus: 'true' },
	});

	const buttonStartNewProject = makeElement({
		tag: 'fancy-button',
		id: 'button__create-new-project',
		innerHTML: 'Create a new font from scratch',
		onClick: handleNewProject,
	});

	const br = makeElement({ tag: 'br' });
	addAsChildren(tabContentNew, [inputProjectName, br, br, buttonStartNewProject]);

	// Content for Load tab
	const tabContentLoad = makeElement({
		id: 'tab-content__load',
		className: 'open-project__tab-content',
		innerHTML: '<h2>Load a file</h2>\nDrag and drop one of the following:<br>',
		style: 'display: none;',
	});

	const dropTarget = makeElement({
		id: 'open-project__drop-target',
		innerHTML: `
			ANY-INK project &ensp;(.gs2, .txt)<br>
			Open Type, True Type, or WOFF&ensp;(.otf, .ttf, .woff)<br>
			SVG Font &ensp;(.svg)
		`,
	});

	// ANY-INK (M6, D-012): with the File System Access API the project picker keeps
	// the file handle (so Save writes in place), shows only .gs2 files and starts in
	// the last project's folder. Upstream's chooser stays for fonts and SVG files
	// (it still accepts a .gs2, which then goes through postValidationCallback).
	const fileSystemAccess = hasFileSystemAccess();
	const loadButtons = [];
	if (fileSystemAccess) {
		loadButtons.push(
			makeElement({
				tag: 'fancy-button',
				id: 'button__open-project-file',
				innerHTML: 'Open a project file...',
				// A picker or loader failure shows in the error box, not as an unhandled rejection.
				onClick: () => runFileCommand(() => openProjectFromPicker({ load: loadPickedProject })),
			})
		);
	}

	const openFileChooser = makeElement({
		tag: 'fancy-button',
		attributes: { dark: '' },
		innerHTML: fileSystemAccess ? 'or, import a font or SVG file...' : 'or, open file chooser...',
		onClick: async () => {
			getFilesFromFilePicker(handleOpenProjectPageFileInput);
		},
	});
	loadButtons.push(openFileChooser);

	addAsChildren(tabContentLoad, [dropTarget, ...loadButtons]);

	// ANY-INK (M6): recently opened project files (File System Access handles).
	// makeRecentFilesCard returns false when the browser has no picker API. The
	// loader honors isSecondProject like every other path on this page.
	const recentFilesCard = makeRecentFilesCard({ load: loadPickedProject });
	if (recentFilesCard) tabContentLoad.appendChild(recentFilesCard);

	// ANY-INK (M6): crash-recovery snapshots replace upstream's localStorage auto-saves.
	// The Recover tab lists dirty snapshots whose tab is gone; src/anyink/recovery owns them.
	const tabContentRecover = makeElement({
		id: 'tab-content__recover',
		className: 'open-project__tab-content',
		innerHTML: `<h2>Recover unsaved work</h2>`,
		style: 'display: none;',
	});
	if (!isSecondProject) tabContentRecover.appendChild(makeRecoverArea());

	// Content for Examples tab
	const tabContentExamples = makeElement({
		id: 'tab-content__examples',
		className: 'open-project__tab-content',
		innerHTML: `<h2>Load an example project</h2>`,
		style: 'display: none;',
	});

	const contentSimpleProject = makeElement({
		tag: 'div',
		innerHTML: `The Simple v2 Project has a few characters and things to show off basic functionality:<br><br>`,
	});

	const buttonSimpleProject = makeElement({
		tag: 'fancy-button',
		innerHTML: 'Simple v2 project',
		onClick: () => handleLoadSample('simpleProject'),
	});

	const contentOblegg = makeElement({
		tag: 'div',
		innerHTML: `Oblegg is the upstream sample project that exercises every editor feature:<br><br>`,
	});

	const buttonOblegg = makeElement({
		tag: 'fancy-button',
		innerHTML: 'Oblegg',
		onClick: () => handleLoadSample('oblegg'),
	});

	addAsChildren(tabContentExamples, [
		contentOblegg,
		buttonOblegg,
		contentSimpleProject,
		buttonSimpleProject,
	]);

	// --------------------------------------------------------------
	// Make tabs, hook it all up
	// --------------------------------------------------------------
	// Tabs
	const tabNew = makeElement({
		tag: 'button',
		id: 'open-project__tab-new',
		className: 'open-project__tab',
		innerHTML: 'New',
		onClick: () => {
			deselectAllTabs();
			tabNew.setAttribute('selected', '');
			tabContentNew.style.display = 'block';
		},
	});

	const tabLoad = makeElement({
		tag: 'button',
		id: 'open-project__tab-load',
		className: 'open-project__tab',
		innerHTML: 'Load',
		onClick: () => {
			deselectAllTabs();
			tabLoad.setAttribute('selected', '');
			tabContentLoad.style.display = 'block';
		},
	});

	const tabRecover = makeElement({
		tag: 'button',
		id: 'open-project__tab-recover',
		className: 'open-project__tab',
		innerHTML: 'Recover',
		onClick: () => {
			deselectAllTabs();
			tabRecover.setAttribute('selected', '');
			tabContentRecover.style.display = 'block';
		},
	});

	const tabExamples = makeElement({
		tag: 'button',
		id: 'open-project__tab-examples',
		className: 'open-project__tab',
		innerHTML: 'Examples',
		onClick: () => {
			deselectAllTabs();
			tabExamples.setAttribute('selected', '');
			tabContentExamples.style.display = 'block';
		},
	});

	const tabs = makeElement({ className: 'open-project__tabs' });
	let tabControls = [tabNew, tabLoad, tabExamples];
	if (!isSecondProject) tabControls.splice(2, 0, tabRecover);
	addAsChildren(tabs, tabControls);

	const tabWrapper = makeElement({ className: 'open-project__tab-wrapper' });
	let tabContents = [tabs, tabContentNew, tabContentLoad, tabContentExamples];
	if (!isSecondProject) tabContents.splice(3, 0, tabContentRecover);
	addAsChildren(tabWrapper, tabContents);
	return tabWrapper;
}

/**
 * Shows an OS File Picker, then returns the selected files
 * to a provided callback function.
 * @param {Function} callback - what to do with the files
 * @param {Object} pickerOptions - OS File Picker Options Object
 */
export async function getFilesFromFilePicker(callback, pickerOptions = {}) {
	// @ts-expect-error 'property does exist'
	if (window.showOpenFilePicker) {
		// @ts-expect-error 'property does exist'
		const files = await window.showOpenFilePicker(pickerOptions);
		callback(files);
	} else {
		// showError(`Can't open OS File Picker. Try dragging and dropping a file instead.`);
		/** @type {any} */
		const fallbackFileChooser = makeElement({ tag: 'input', attributes: { type: 'file' } });
		fallbackFileChooser.addEventListener('change', (event) => {
			// log(fallbackFileChooser.files);
			cancelDefaultEventActions(event);
			callback(fallbackFileChooser.files);
		});
		fallbackFileChooser.click();
	}
}

/**
 * ANY-INK (M6): loader for the project picker and the recents card. Mirrors
 * postValidationCallback: a second project gets its own editor first, and the
 * handle is set before the navigate so the File menu shows the file name at once.
 * Only a .gs2 handle becomes the save target (a v1 .txt is never written back).
 * @param {Object} content - parsed project data
 * @param {FileSystemFileHandle | false} handle - the opened .gs2, or false
 * @returns {ProjectEditor} the editor that now holds the project
 */
function loadPickedProject(content, handle) {
	if (isSecondProject) addProjectEditorAndSetAsImportTarget();
	const editor = getProjectEditorImportTarget();
	editor.loadedFileHandle = isProjectFileHandle(handle) ? handle : false;
	importProjectDataAndNavigate(content);
	return getCurrentProjectEditor();
}

/**
 * Sets all the tabs to deselected and hides all the tab contents
 */
function deselectAllTabs() {
	const tabs = document.querySelectorAll('.open-project__tab');
	tabs.forEach((tab) => tab.removeAttribute('selected'));

	const tabContents = document.querySelectorAll('.open-project__tab-content');
	tabContents.forEach((/** @type {HTMLElement} */ content) => (content.style.display = 'none'));
}

/**
 * Handle file input or drop
 * @param {Object} files - event from drop, or fileHandle from showOpenFilePicker
 */
async function handleOpenProjectPageFileInput(files) {
	// log('handleOpenProjectPageFileInput', 'start');
	// log(`\n⮟files⮟`);
	// log(files);

	/** @type {HTMLElement} */
	const dropNote = document.querySelector('#open-project__drop-note');
	dropNote.style.display = 'none';
	const rightArea = document.querySelector('#open-project__right-area');
	rightArea.innerHTML = '';
	rightArea.appendChild(makeProgressIndicator());

	let fileInput;
	let fileResult;
	if (files.length) {
		fileInput = files[0];
		// log(fileInput);
		if (fileInput.getAsFileSystemHandle) fileResult = await fileInput.getAsFileSystemHandle();
		else if (fileInput.getAsFile) fileResult = await fileInput.getAsFile();
		else fileResult = fileInput;
	} else {
		showError(`No files were found that could be imported.`);
	}

	// log(fileResult);
	if (!fileResult) {
		showError(`The file could not be read.`);
		resetOpenProjectTabs();
	} else {
		validateSingleFileInput(fileResult, postValidationCallback);
	}

	// log('handleOpenProjectPageFileInput', 'end');
}

/**
 * What to do after a file has been validated
 * @param {Object} validationResult - validation object
 */
function postValidationCallback(validationResult) {
	// log(`postValidationCallback`, 'start');
	if (isSecondProject) addProjectEditorAndSetAsImportTarget();
	if (validationResult.content) {
		if (validationResult.fileType === 'font') {
			// ANY-INK (M6): the imported font is a source from now on. If ANY-INK exported
			// it earlier, the next export over it asks before replacing it.
			noteImportedFontFile(validationResult.sourceHandle).catch((error) =>
				console.warn('ANY-INK: could not record the imported font', error)
			);
			ioFont_importFont(validationResult.content, false, validationResult.fileSuffix);
		} else if (validationResult.fileType === 'svg') {
			ioSVG_importSVGfont(validationResult.content);
		} else if (validationResult.fileType === 'project') {
			// ANY-INK: the import target, not the current editor: for a second project
			// they differ until importProjectDataAndNavigate selects the new one.
			// Only a .gs2 handle becomes the save target; a v1 .txt is never written back.
			const editor = getProjectEditorImportTarget();
			editor.loadedFileHandle = isProjectFileHandle(validationResult.fileHandle)
				? validationResult.fileHandle
				: false;
			importProjectDataAndNavigate(validationResult.content);
			// ANY-INK (M6): drag and drop and upstream's chooser feed recents too (a .gs2),
			// and a v1 .txt is remembered as where Save As starts. sourceHandle is false
			// without the File System Access API; that is ignored.
			noteProjectOpened(editor, validationResult.sourceHandle, validationResult.sourceFile).catch(
				(error) => console.warn('ANY-INK: could not record the opened project', error)
			);
		}
	} else {
		if (validationResult.errorMessage) {
			showError(validationResult.errorMessage);
		} else {
			showError(`Some unknown error happened when loading the file.`);
		}

		resetOpenProjectTabs();
	}
	// log(`postValidationCallback`, 'end');
}

/**
 * Do all the stuff necessary to import a text file and
 * get the UI to the right page.
 * @param {GlyphrStudioProject | Object} glyphrStudioProjectFile
 */
export function importProjectDataAndNavigate(glyphrStudioProjectFile) {
	// log(`importProjectDataAndNavigate`, 'start');
	closeEveryTypeOfDialog();
	const editor = getProjectEditorImportTarget();
	setCurrentProjectEditor(editor);
	// ANY-INK (M6, D-012): binary assets live on the editor, not in the project, so a
	// project that replaces another must not inherit its images. Loaders that bring
	// assets (the .gs2 importer's hand-off, crash recovery's loadBlobMap) refill the
	// store right after this.
	if (typeof editor.assets?.clear === 'function') editor.assets.clear();
	if (!glyphrStudioProjectFile) {
		editor.project = new GlyphrStudioProject({});
		/** @type {HTMLInputElement} */
		const nameInput = document.querySelector('#input__new-project-name');
		const name = nameInput?.value || 'My Font';
		editor.project.settings.project.name = name;
		editor.project.settings.font.family = name;
	} else {
		editor.project = importGlyphrProjectFromText(glyphrStudioProjectFile);
	}

	editor.project.resetSessionStateForAllItems();
	editor.nav.page = 'Overview';
	if (isSecondProject) showToast(`Switched to<br>${editor.project.settings.project.name}`);
	updateWindowUnloadEvent();
	editor.navigate();
	// log(`importProjectDataAndNavigate`, 'end');
}

/**
 * Handle Message event
 * @param {Object} event - event
 */
// TODO Paste handler on open project page
/*
function handleMessage(event) {
	const app = getGlyphrStudioApp();
	// assume strings are SVG fonts
	app.temp.droppedFileContent = event.data;

	if (typeof event.data === 'string') {
		// ioSVG_importSVGfont(false);
		// assume array buffers are otf fonts
	} else if (event.data instanceof ArrayBuffer) {
		// ioFont_importFont(false);
	}
}
*/
// --------------------------------------------------------------
// Drag Events
// --------------------------------------------------------------

/**
 * Handle DragOver event
 * @param {Object} event - event
 */
function handleDragEnter(event) {
	// log(`handleDragEnter`, 'start');
	// cancelDefaultEventActions(event);
	event.dataTransfer.dropEffect = 'copy';
	/** @type {HTMLElement} */
	const dropNote = document.querySelector('#open-project__drop-note');
	dropNote.style.animation = 'var(--animate-fade-in)';
	dropNote.style.opacity = '1';
	dropNote.innerHTML = `Drop it!`;
	dropNote.style.display = 'block';
	// log(`handleDragEnter`, 'end');
}

/**
 * Handle DragLeave event
 */
function handleDragLeave() {
	// log(`handleDragLeave`, 'start');
	// cancelDefaultEventActions(event);
	/** @type {HTMLElement} */
	const dropNote = document.querySelector('#open-project__drop-note');
	dropNote.style.animation = 'var(--animate-fade-out)';
	window.setTimeout(() => {
		dropNote.style.display = 'none';
		dropNote.style.opacity = '0';
	}, 170);
	// log(`handleDragLeave`, 'end');
}

// --------------------------------------------------------------
// Loading projects
// --------------------------------------------------------------

/**
 * Create a new project from scratch
 */
function handleNewProject() {
	if (isSecondProject) addProjectEditorAndSetAsImportTarget();
	setTimeout(importProjectDataAndNavigate, 10);
}

/**
 * Load a project sample
 * @param {String} name - which sample to load
 */
function handleLoadSample(name) {
	if (isSecondProject) addProjectEditorAndSetAsImportTarget();
	document.querySelector('#tab-content__examples').innerHTML =
		'<h2>Load an example project</h2>Loading example project...';

	let project = simpleExampleProject;
	if (name === 'oblegg') project = obleggExampleProject;
	setTimeout(function () {
		// log(`Loading sample project ${name}`);

		importProjectDataAndNavigate(project);
	}, 100);
}
