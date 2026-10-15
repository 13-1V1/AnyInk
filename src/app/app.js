// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getSaveStatus } from '../anyink/files/save_status.js';
import { isProjectFileHandle } from '../anyink/files/write_file.js';
import { peekProject } from '../anyink/recovery/snapshot.js';
import { makeElement } from '../common/dom.js';
import { countItems } from '../common/functions.js';
import { closeEveryTypeOfDialog } from '../controls/dialogs/dialogs.js';
import { parseSemVer } from '../formats_io/validate_file_input.js';
import { importGlyphrProjectFromText } from '../project_editor/import_project.js';
import { ProjectEditor } from '../project_editor/project_editor.js';
import boolTestProject from '../samples/boolean_tests.gs2?raw';
import obleggSampleProject from '../samples/oblegg.gs2?raw';
import simpleExampleProject from '../samples/simpleExampleProject.json';
/** @type {Object} */
import * as config from './app_config.json';
import { _DEV } from './dev_mode_includes.js';
import {
	addProjectEditorAndSetAsImportTarget,
	getGlyphrStudioApp,
	getProjectEditorImportTarget,
	setCurrentProjectEditor,
} from './main.js';
import { makePage_OpenProject } from './open_project.js';

/**
 * Creates a new Glyphr Studio Application
 */
export class GlyphrStudioApp {
	constructor() {
		// Settings
		this.settings = {
			dev: {
				// Internal Dev Stuff
				mode: config.devMode, // {bool} global switch for all the stuff below
				overwriteTitle: true, // {bool} Use a 'Dev Mode' window title
				sampleProject: false, // {true/false, 'oblegg', 'bool'} Load the sample project
				twoSampleProjects: false, // {bool} Load two sample projects
				currentPage: false, // {Sentence case page name} navigate straight to a page
				currentGlyphID: false, // {glyph id} select a glyph
				currentPanel: false, // {panel id, e.g. 'QualityChecks'; old names still work} open a panel
				currentTool: false, // {Tool name} select a tool
				stopPageNavigation: false, // {bool} overwrite project-level setting
				autoSave: false, // {bool} trigger auto saves
				selectFirstShape: false, // {bool} select the first shape
				selectFirstPoint: false, // {bool} select the first path point
				testActions: [], // {name: '', onClick: ()=>{}} adds test actions to the Glyph card
				testOnLoad: function () {}, // code to run on load
				testOnRedraw: function () {}, // code to run on Edit Canvas redraw
			},
		};

		// Version
		// `version` stays the upstream Glyphr Studio version: project files compare against it.
		this.version = config.version;
		this.versionDate = config.versionDate;
		this.anyinkVersion = config.anyinkVersion;
		const semVer = parseSemVer(config.version);
		this.upstreamVersionName = `Glyphr Studio ${semVer.major}.${semVer.minor}`;
		this.versionName = `ANY-INK ${config.anyinkVersion}`;

		// Project Editors
		this.projectEditors = [];
		this._selectedProjectEditor = undefined;

		// Current import target
		this._editorImportTarget = undefined;
		this.temp = {};
	}

	/**
	 * Starts up the app
	 */
	setUp() {
		// log(`GlyphrStudioApp.setUp`, 'start');
		let editor = addProjectEditorAndSetAsImportTarget();

		// Dev mode stuff
		const dev = this.settings.dev;
		if (dev.mode) {
			if (dev.overwriteTitle) document.title = '⡄⡆⡇🄳🄴🅅 🄼🄾🄳🄴⡇⡆⡄';
			// @ts-expect-error 'property does exist'
			window._DEV = _DEV;

			// Test Function
			if (dev.testOnLoad) dev.testOnLoad();

			// Navigation & selection
			if (dev.twoSampleProjects) {
				editor.project = importGlyphrProjectFromText(obleggSampleProject);
				addProjectEditorAndSetAsImportTarget();
				editor = getProjectEditorImportTarget();
				setCurrentProjectEditor(editor);
				editor.project = importGlyphrProjectFromText(simpleExampleProject);
				// editor.project = importGlyphrProjectFromText(obleggSampleProject);
				if (typeof dev.currentPage === 'string') editor.nav.page = dev.currentPage;
				updateWindowUnloadEvent();
			} else if (typeof dev.sampleProject === 'boolean' && dev.sampleProject) {
				importGlyphrProjectFromText(simpleExampleProject);
			} else if (typeof dev.sampleProject === 'string') {
				let proj;
				if (dev.sampleProject === 'oblegg') proj = obleggSampleProject;
				if (dev.sampleProject === 'bool') proj = boolTestProject;
				// if (dev.sampleProject === 'test') proj = test;
				editor.project = importGlyphrProjectFromText(proj);
			}
			if (typeof dev.currentGlyphID === 'string') editor.selectedGlyphID = dev.currentGlyphID;
			if (typeof dev.currentPage === 'string') editor.nav.page = dev.currentPage;
			if (typeof dev.currentPanel === 'string') editor.nav.panel = dev.currentPanel;
			if (dev.currentTool) editor.selectedTool = dev.currentTool;
			if (dev.selectFirstShape) editor.multiSelect.shapes.select(editor.selectedItem.shapes[0]);
			if (dev.selectFirstPoint)
				editor.multiSelect.points.select(editor.selectedItem.shapes[0].pathPoints[0]);
		}
		// log(editor);
		// log(editor.nav.page);

		// Load the Open Project page
		if (dev.mode && dev.currentPage) {
			editor.navigate();
		} else {
			this.appPageNavigate(makePage_OpenProject);
		}
		this.fadeOutLandingPage();

		// Final dev mode stuff
		if (dev.mode && (dev.selectFirstShape || dev.selectFirstPoint))
			editor.editCanvas.redraw('dev mode select first shape');
		console.log(this);
		// log(`GlyphrStudioApp.setUp`, 'end');
	}

	/**
	 * Returns the selected Project Editor
	 * @returns {ProjectEditor}
	 */
	get selectedProjectEditor() {
		if (!this._selectedProjectEditor) {
			if (this.projectEditors.length === 0) this.projectEditors[0] = new ProjectEditor();
			this.selectedProjectEditor = this.projectEditors[0];
		}

		return this._selectedProjectEditor;
	}

	/**
	 * Sets the selected Project Editor
	 * @param {ProjectEditor} editor
	 */
	set selectedProjectEditor(editor) {
		if (!editor) return;
		// Make sure the editor is tracked in the projectEditors list,
		// then select it. Previously this only worked for editors that
		// were already at index 0 or 1, silently ignoring any other editor.
		if (!this.projectEditors.includes(editor)) {
			this.projectEditors.push(editor);
		}
		this._selectedProjectEditor = editor;
	}

	/**
	 * Returns the selected Project Editor Import Target
	 * @returns {ProjectEditor}
	 */
	get editorImportTarget() {
		if (!this._editorImportTarget) {
			this._editorImportTarget = this.selectedProjectEditor;
		}

		return this._editorImportTarget;
	}

	/**
	 * Sets the selected Project Editor Import Target
	 * @param {ProjectEditor} editor
	 */
	set editorImportTarget(editor) {
		if (this.projectEditors[0] === editor) {
			this._editorImportTarget = this.projectEditors[0];
		}
		if (this.projectEditors[1] === editor) {
			this._editorImportTarget = this.projectEditors[1];
		}
	}

	/**
	 * Returns the project editor that isn't the selected project editor
	 * @returns {ProjectEditor}
	 */
	get otherProjectEditor() {
		if (this.selectedProjectEditor === this.projectEditors[0]) {
			return this.projectEditors[1];
		} else {
			return this.projectEditors[0];
		}
	}

	/**
	 * App Pages are 'above' Project Editor Pages, so we need a custom navigation
	 * handler for Open Project and Cross Project Actions pages
	 * @param {Function} pageMaker - function that creates app page content
	 */
	appPageNavigate(pageMaker) {
		const mainContent = makeElement({
			tag: 'div',
			id: 'app__main-content',
		});
		mainContent.appendChild(pageMaker());
		const wrapper = document.querySelector('#app__wrapper');
		wrapper.innerHTML = '';
		wrapper.appendChild(mainContent);
		// ANY-INK: app-level pages (open project, cross-project) have no preview strip
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'app-level', appLevel: true } }));
	}

	/**
	 * Fades out the initial load screen to show the App
	 * @param {Number} delay - override default fadeout time
	 */
	fadeOutLandingPage(delay = 700) {
		/** @type {HTMLElement} */
		const landingPage = document.querySelector('#app__landing-page');
		if (landingPage) {
			landingPage.style.opacity = '0';

			setTimeout(function () {
				// landingPage.style.visibility = 'hidden';
				// landingPage.style.display = 'none';
				document.body.removeChild(landingPage);
			}, delay);
		}
	}

	// --------------------------------------------------------------
	// Local Storage and Auto-saves
	// --------------------------------------------------------------

	/**
	 * Wrapper for getting the Glyphr Studio area of local storage
	 * @returns {Object} - current data
	 */
	getLocalStorage() {
		// log(`GlyphrStudioApp.getLocalStorage`, 'start');
		if (!window.localStorage.getItem('GlyphrStudio')) {
			window.localStorage.setItem('GlyphrStudio', '{}');
		}
		const jsonData = window.localStorage.getItem('GlyphrStudio');
		let data = {};
		if (jsonData) data = JSON.parse(jsonData);
		// log(`\n⮟data⮟`);
		// log(data);
		// log(`GlyphrStudioApp.getLocalStorage`, 'end');
		return data;
	}

	/**
	 * Wrapper to write a key/value pair to the
	 * Glyphr Studio area of local storage
	 * @param {String} key - what part to set
	 * @param {String} newData - value to set
	 */
	setLocalStorage(key, newData) {
		// log(`GlyphrStudioApp.setLocalStorage`, 'start');
		// log(`key: ${key}`);
		// log(`\n⮟data⮟`);
		// log(newData);

		const data = this.getLocalStorage();
		data[key] = newData;
		try {
			window.localStorage.setItem('GlyphrStudio', JSON.stringify(data));
		} catch {
			// ANY-INK (M6): localStorage is full or blocked. Nothing important lives here any
			// more (crash recovery snapshots go to IndexedDB), so this is silent.
		}

		// log(`\n⮟window.localStorage⮟`);
		// log(window.localStorage);
		// log(`GlyphrStudioApp.setLocalStorage`, 'end');
	}

	/**
	 * Counts how many projects are saved locally
	 * @returns {Number}
	 */
	countLocalStorageProjects() {
		const data = this.getLocalStorage();
		return countItems(data.autoSaves);
	}

	/**
	 * ANY-INK (M6, D-012): upstream wrote the whole project to localStorage on every
	 * edit. Crash recovery (src/anyink/recovery) replaced it with IndexedDB snapshots
	 * driven by History.updateAfterSaveState -> markDirty(). Kept as a no-op so any
	 * upstream caller merged later still resolves.
	 */
	addAutoSaveState() {
		// intentionally empty
	}
}

// --------------------------------------------------------------
// Window behavior
// --------------------------------------------------------------

/**
 * Sets the appropriate window unload event
 * ANY-INK (B1, UX-BEGINNER 7.5): the handler decides when the page is actually closing, so a
 * save, an autosave or an edit after this call is always taken into account. Callers that
 * still call this after a setting change or a project load just re-install the same handler.
 */
export function updateWindowUnloadEvent() {
	window.onbeforeunload = warnIfWorkWouldBeLost;
}

/**
 * onbeforeunload handler: asks Chrome for its "Leave site?" prompt only when work would be lost.
 * @param {Event} event - original event
 * @returns {String | undefined} - a message when warning, nothing otherwise
 */
function warnIfWorkWouldBeLost(event) {
	let warn;
	try {
		warn = shouldWarnBeforeLeaving();
	} catch (error) {
		console.warn('ANY-INK leave check failed; warning to be safe', error);
		warn = true;
	}
	if (!warn) return undefined;
	return showBeforeUnloadConfirmation(event);
}

/**
 * ANY-INK (B1): warn only when an open font has ink that isn't in its work file: its save status
 * (src/anyink/files/save_status.js) isn't 'saved' and some letter, ligature or component has
 * shapes. A font with no work file (an example, an imported font file, a font just made) warns
 * only when the font differs from what it was loaded as: ink, widths, gaps, settings, anything
 * its work file would hold. Looking around, opening letters included, loses nothing (upstream
 * records "Navigated to" undo entries, so the save status alone can't tell, and opening a
 * letter makes an empty record for it). The font's own "Warn about unsaved changes" setting,
 * when turned off, still turns the warning off. Dev mode keeps upstream's override: its own
 * stopPageNavigation switch decides alone.
 * @param {GlyphrStudioApp} app
 * @returns {Boolean}
 */
function shouldWarnBeforeLeaving(app = getGlyphrStudioApp()) {
	const dev = app.settings.dev;
	if (dev.mode) return !!dev.stopPageNavigation;
	return app.projectEditors.some(hasInkNotInItsFile);
}

/**
 * ANY-INK (B5): exported for Ctrl+O (src/anyink/files/open_font.js), which asks before another
 * font takes this one's place, by the same rule the leave-site check uses.
 * @param {ProjectEditor} editor
 * @returns {Boolean}
 */
export function hasInkNotInItsFile(editor) {
	// peekProject never builds an empty project for an editor that has none yet.
	const project = peekProject(editor);
	if (!project) return false;
	if (project.settings?.app?.stopPageNavigation === false) return false;
	if (getSaveStatus(editor).file === 'saved') return false;
	if (!projectHasInk(project)) return false;
	if (!isProjectFileHandle(editor.loadedFileHandle)) return changedSinceLoaded(editor, project);
	return true;
}

const INK_COLLECTIONS = ['glyphs', 'ligatures', 'components'];

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {Boolean} true when any glyph, ligature or component has at least one shape
 */
function projectHasInk(project) {
	return INK_COLLECTIONS.some((name) =>
		Object.values(project[name] || {}).some((item) => item?.shapes?.length > 0)
	);
}

/**
 * Compares the font with the copy History made when it was loaded (History.initialize:
 * initialProject; a restored backup copy brings its own), as its work file would hold it.
 * @param {ProjectEditor} editor
 * @param {Object} project - GlyphrStudioProject
 * @returns {Boolean} true when anything differs (ink, a width, a gap, a setting, a photo), or
 *   the loaded copy is missing (then it may have changed, so it counts as changed)
 */
function changedSinceLoaded(editor, project) {
	const loaded = editor.history?.initialProject;
	if (typeof loaded?.save !== 'function') return true;
	const before = loaded.save();
	const now = project.save();
	// History made that copy by loading the font's data into a new project, which keeps only
	// the settings a project knows (an imported font file brings extra ones, like a font name
	// field), so only the settings that copy has are compared.
	now.settings = sameKeys(now.settings, before.settings);
	return workPrint(now) !== workPrint(before);
}

/**
 * @param {*} value - from the font now
 * @param {*} like - the same place in the copy made when it was loaded
 * @returns {*} value, with every plain object cut down to the keys `like` has there
 */
function sameKeys(value, like) {
	const plain = (v) => v && typeof v === 'object' && !Array.isArray(v);
	if (!plain(value) || !plain(like)) return value;
	return Object.fromEntries(
		Object.keys(like)
			.filter((key) => key in value)
			.map((key) => [key, sameKeys(value[key], like[key])])
	);
}

/**
 * @param {Object} saved - a GlyphrStudioProject's save() data
 * @returns {String} that data, keys in order, without the empty letter records opening a
 *   letter makes (a record with nothing but its id)
 */
function workPrint(saved) {
	for (const [id, glyph] of Object.entries(saved.glyphs || {})) {
		if (Object.keys(glyph).every((key) => key === 'id')) delete saved.glyphs[id];
	}
	return JSON.stringify(saved, (key, value) =>
		value && typeof value === 'object' && !Array.isArray(value)
			? Object.fromEntries(Object.keys(value).sort().map((k) => [k, value[k]]))
			: value
	);
}

/**
 * handler for onBeforeUnload
 * @param {Event} event - original event
 * @returns {String} - message to show
 */
function showBeforeUnloadConfirmation(event) {
	// console.log(`event.type: ${event.type}`);
	event.preventDefault();
	event.stopPropagation();
	let message = 'Are you sure you want to exit? Any unsaved data may be lost.';
	return message;
}

// --------------------------------------------------------------
// Issues
// --------------------------------------------------------------

/**
 * Catch an error and show this 'nice' page instead
 * @param {String} friendlyMessage - What human-readable message to show
 * @param {Object} errorObject - Error data
 */
export function showAppErrorPage(friendlyMessage = '', errorObject = { message: '', stack: '' }) {
	const wrapper = document.querySelector('#app__wrapper');
	closeEveryTypeOfDialog();
	let content = `
		<div id="app__landing-page">
		<div class="error-page__wrapper">
			<div class="error-page__table-flip">(╯°▢°）╯︵ ┻━┻</div>
				<h1>${friendlyMessage || 'ANY-INK ran into a problem'}</h1>
				<br>
				Reload the app to keep working. The details below help track down the cause.
				<br><br><br>
				<pre>${errorObject.stack.replaceAll('<', '&lt;')}</pre>
			</div>
		</div>
	`;

	wrapper.innerHTML = content;
}

/**
 * Makes a mailto link
 * @param {String} displayText - what text to show
 * @returns {String} - mailto link
 */
export function emailLink(displayText = 'ANY-INK') {
	// ANY-INK is a personal build with no support address; kept for upstream compatibility.
	return `<span class="mailto">${displayText}</span>`;
}

/**
 * Generates the content for the "email us" link
 * @returns {String}
 */
export function makeEmailContent() {
	const con = `Have a feature idea or ran into an issue%3F We'd be happy to help!
	%0A%0A%0A%0A___________________________________________%0A
	version %09ANY-INK ${getGlyphrStudioApp().anyinkVersion} (Glyphr Studio ${getGlyphrStudioApp().version}) %0A
	user agent %09 ${encodeURIComponent(navigator.userAgent)} %0A`;

	// log(con);
	return con;
}
