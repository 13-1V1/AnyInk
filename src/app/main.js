// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/* Web Components */
import { PreviewStrip } from '../anyink/preview/preview_strip.js';
import { SaveStatusElement } from '../anyink/files/save_status_element.js';
import { CoachElement } from '../anyink/coach/coach_element.js';
import { initRecovery } from '../anyink/recovery/recovery.js';
import { initFontCheck } from '../anyink/fontcheck/font_check.js';
import { initPhotos } from '../anyink/photo/photo_app.js';
import { FancyButton } from '../controls/fancy-button/fancy_button.js';
import { FontPreview } from '../controls/font-preview/font_preview.js';
import { GlyphTile } from '../controls/glyph-tile/glyph_tile.js';
import { InfoBubble } from '../controls/info-bubble/info_bubble.js';
import { InputNumber } from '../controls/input-number/input_number.js';
import { OptionChooser } from '../controls/option-chooser/option_chooser.js';
import { OptionToggle } from '../controls/option-toggle/option_toggle.js';
import { DisplayCanvas } from '../display_canvas/display_canvas.js';
import { EditCanvas } from '../edit_canvas/edit_canvas.js';
import { handleKeyPress, handleKeyUp } from '../edit_canvas/events_keyboard.js';

/* Other stuff */
import asciiLogo from '../common/graphics/anyink-ascii-wordmark.txt?raw';
import { closeAllInfoBubbles, closeAllOptionChoosers } from '../controls/dialogs/dialogs.js';
import { GlyphrStudioProject } from '../project_data/glyphr_studio_project.js';
import { closeAllNavMenus } from '../project_editor/navigator.js';
import { ProjectEditor } from '../project_editor/project_editor.js';
import { GlyphrStudioApp, showAppErrorPage, updateWindowUnloadEvent } from './app.js';

/**
 * First function to run when the browser starts
 */
export function glyphrStudioOnLoad() {
	// Plain console output: no color literals live outside tokens.css.
	console.info(`${asciiLogo}\n`);
	try {
		const app = getGlyphrStudioApp();
		if (app.version) {
			console.info(`App Version ${app.version}\n`);
		}
		// log(`glyphrStudioOnLoad`, 'start');
		// let favIcon = makeElement({
		// 	tag: 'link',
		// 	attributes: { rel: 'shortcut icon', href: '../common/graphics/logo-icon-color.ico' },
		// });
		// document.head.appendChild(favIcon);

		if (passPreChecks()) {
			registerCustomComponents();
			addGlobalEventListeners();
			// Load project
			app.setUp();
			// ANY-INK (M6): crash recovery follows the current project from here on
			initRecovery();
			// ANY-INK (B1): the font check follows the current project from here on
			initFontCheck();
			// ANY-INK (B8 + B9 integration): the photo screens follow the current project, the Next
			// line's photo buttons work, and a photo dropped on a letter in Simple goes to them
			initPhotos();
			// ANY-INK (B1): the leave-site check decides when the page closes, so it is set once,
			// here, for every way a font gets opened (the open page, a dropped font file, an SVG)
			updateWindowUnloadEvent();
			// log(app);
		} else {
			// log('did NOT pass pre-checks');
		}
		// log(`glyphrStudioOnLoad`, 'end');
	} catch (e) {
		showAppErrorPage('ANY-INK failed to load!', e);
		console.error(e);
	}
}

/**
 * Does some checking against new-ish HTML/JavaScript features
 * @returns {Boolean}
 */
function passPreChecks() {
	let pass = true;
	// Templates
	const template = document.createElement('template');
	if (!template.content) {
		console.error('Browser does not support HTML Templates');
		pass = false;
	}
	return pass;
}

/**
 * Registers all the custom Web Components to the current document
 */
function registerCustomComponents() {
	const data = [
		{ fileName: 'anyink-save-status', className: SaveStatusElement },
		{ fileName: 'option-chooser', className: OptionChooser },
		{ fileName: 'option-toggle', className: OptionToggle },
		{ fileName: 'display-canvas', className: DisplayCanvas },
		{ fileName: 'fancy-button', className: FancyButton },
		{ fileName: 'font-preview', className: FontPreview },
		{ fileName: 'glyph-tile', className: GlyphTile },
		{ fileName: 'info-bubble', className: InfoBubble },
		{ fileName: 'input-number', className: InputNumber },
		{ fileName: 'edit-canvas', className: EditCanvas },
		// ANY-INK: after display-canvas and font-preview, which it constructs
		{ fileName: 'preview-strip', className: PreviewStrip },
		// ANY-INK (B6): the Next line under Simple's top bar (src/anyink/coach)
		{ fileName: 'anyink-coach', className: CoachElement },
	];

	data.forEach((control) => {
		customElements.define(control.fileName, control.className);
	});
}

/**
 * Events added to window, no matter what Project Editor is running
 */
function addGlobalEventListeners() {
	// if (!getGlyphrStudioApp().settings.dev.mode) {
	window.addEventListener('mouseup', (event) => {
		let navElement = document.querySelector('nav');

		// @ts-expect-error 'property does exist'
		if (!(navElement && navElement.contains(event.target))) {
			closeAllNavMenus();
			closeAllOptionChoosers();
			closeAllInfoBubbles();
		}
	});
	window.addEventListener('resize', () => {
		closeAllNavMenus();
		closeAllOptionChoosers();
		closeAllInfoBubbles();
	});
	// ANY-INK: Ctrl+Z / Ctrl+Y must work on every page (Settings, Overview) before the
	// first edit canvas exists. initEventHandlers adds the same function references
	// later, so the second addEventListener is a no-op.
	document.addEventListener('keydown', handleKeyPress, false);
	document.addEventListener('keyup', handleKeyUp, false);
	// @ts-expect-error 'property does exist'
	window.getShipDate = getShipDate;
	// }
}

/**
 * An epoch date number that looks nice
 * @param {Number} dayOffset - how many days to add to the result
 * @returns {Number} - nice number for the day a version was shipped
 */
export function getShipDate(dayOffset = 0) {
	const shipDate = new Date();
	shipDate.setDate(shipDate.getDate() + dayOffset);
	shipDate.setHours(12, 0, 0, 0);
	const result = shipDate.getTime();
	console.log(new Date(result).toString());
	return result;
}

// --------------------------------------------------------------
// Getting root objects (App, Editor, Project / Current, Import Target)
// --------------------------------------------------------------

/**
 * Returns the overall App object
 * @returns {GlyphrStudioApp}
 */

// The main app object
let GSApp;
export function getGlyphrStudioApp() {
	if (!GSApp) {
		GSApp = new GlyphrStudioApp();
	}
	return GSApp;
}

/**
 * Returns the project that is currently being edited
 * @returns {GlyphrStudioProject}
 */
export function getCurrentProject() {
	return getCurrentProjectEditor().project;
}

/**
 * Returns the current Project Editor
 * @returns {ProjectEditor}
 */
export function getCurrentProjectEditor() {
	const app = getGlyphrStudioApp();
	return app.selectedProjectEditor;
}

/**
 * Sets the current Project Editor
 * @param {ProjectEditor} newEditor - one to set
 */
export function setCurrentProjectEditor(newEditor) {
	const app = getGlyphrStudioApp();
	app.selectedProjectEditor = newEditor;
}

/**
 * Gets the Project Editor that is available for importing an new project
 * @returns {ProjectEditor}
 */
export function getProjectEditorImportTarget() {
	// log(`getProjectEditorImportTarget`, 'start');
	const app = getGlyphrStudioApp();
	// log(`getProjectEditorImportTarget`, 'end');
	return app.editorImportTarget;
}

/**
 * Adds a new Project Editor and gets it ready for importing
 * @returns {ProjectEditor}
 */
export function addProjectEditorAndSetAsImportTarget() {
	// log(`addProjectEditorAndSetAsImportTarget`, 'start');
	const app = getGlyphrStudioApp();
	app.projectEditors.push(new ProjectEditor());
	app.editorImportTarget = app.projectEditors.at(-1);
	// log(`addProjectEditorAndSetAsImportTarget`, 'end');
	return getProjectEditorImportTarget();
}

// --------------------------------------------------------------
// Fancy Logging
// --------------------------------------------------------------

let depth = 0;
/**
 * Wrapper for console.log that does some extra fancy stuff, and
 * also adheres to a global switch in settings.
 * Console styling is token-free: no color literals live outside tokens.css, so
 * start / end pills are set apart by weight, padding, and a currentColor border.
 * @param {String} message - message to show in the console
 * @param {String =} type - 'start', 'end', or undefined
 */
export function log(message, type) {
	let dev = getGlyphrStudioApp().settings.dev;
	// if (!dev.mode) return;

	if (dev.mode) {
		if (typeof message === 'string') {
			message = message.replace(/&lt;/gi, '<');
			message = message.replace(/&gt;/gi, '>');

			const common = `
				font-weight:bold;
				position: relative;
				left: -20px;
				border-top: 1px solid;
				border-bottom: 1px solid;
				padding: 6px 0px 6px 0px;
				margin: 0px;
			`;

			const startCommon = `padding-bottom: 4px; margin-top: 10px; margin-bottom: -2px;`;
			const endCommon = ` margin-bottom: 20px; margin-top: -3px`;

			const startLeft = `
				${common}
				font-weight: normal;
				border-left: 1px solid;
				padding-left: 12px;
				border-radius: 12px 0px 0px 2px;
				${startCommon}
			`;
			const startMid = `
				${common}
				font-weight: normal;
				padding-left: 0px;
				${startCommon}
			`;
			const startRight = `
				${common}
				border-right: 1px solid;
				padding-right: 12px;
				border-radius: 0px 12px 2px 0px;
				${startCommon}
			`;

			const endLeft = `
				${common}
				font-weight: normal;
				border-left: 1px solid;
				padding-left: 12px;
				border-radius: 2px 0px 0px 12px;
				${endCommon}
			`;
			const endMid = `
				${common}
				font-weight: normal;
				padding-left: 0px;
				${endCommon}
			`;
			const endRight = `
				${common}
				border-right: 1px solid;
				padding-right: 12px;
				border-radius: 0px 2px 12px 0px;
				${endCommon}
			`;

			const indent = `
				font-size: 1.2em;
			`;
			let ch = '･ ';

			if (type === 'start' || type === 'end') {
				let message1 = '';
				let message2 = message;
				if (message.split('.').length > 1) {
					message1 = message.split('.')[0] + '.';
					message2 = message.split('.')[1];
				}

				if (type === 'start') {
					console.log(
						`%c${ch.repeat(depth)}%cSTART %c${message1}%c${message2}`,
						indent,
						startLeft,
						startMid,
						startRight
					);
					depth++;
				} else if (type === 'end') {
					depth--;
					depth = Math.max(depth, 0);
					console.log(
						`%c${ch.repeat(depth)}%cEND   %c${message1}%c${message2}`,
						indent,
						endLeft,
						endMid,
						endRight
					);
				}
			} else {
				console.log(`%c${ch.repeat(depth)}%c${message}`, indent, 'border-radius: 4px;');
			}
		} else if (typeof message === 'object') {
			// console.table(message);
			console.log(message);
		} else {
			console.log(message);
		}
	}
}
