// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';
import { charToHex } from '../common/character_ids.js';
import { addAsChildren, makeElement, textToNode } from '../common/dom.js';
import {
	closeAllInfoBubbles,
	closeEveryTypeOfDialog,
	showError,
	showModalDialog,
} from '../controls/dialogs/dialogs.js';
import { removeStopCreatingNewPathButton } from '../edit_canvas/tools/new_path.js';
import { makeEditToolsButtons, makeViewToolsButtons } from '../edit_canvas/tools/tools.js';
import { makePanel, refreshPanel } from '../panels/panels.js';
import { Glyph } from '../project_data/glyph.js';
import {
	makeNavButton,
	makeNavButtonContent,
	toggleNavDropdown,
} from '../project_editor/navigator.js';

/**
 * Page > Ligatures
 * Edit surface for Ligatures, comprised of Panels of tools, and the Edit Canvas.
 * @returns {Element} - page content
 */
export function makePage_Ligatures() {
	// log(`makePage_Ligatures`, 'start');
	const editor = getCurrentProjectEditor();
	// log('current ProjectEditor');
	// log(editor);
	// log(editor.nav);
	// log(`editor.selectedLigatureID: ${editor.selectedLigatureID}`);
	// log(`editor.selectedItemID: ${editor.selectedItemID}`);
	// log(`editor.nav.panel: ${editor.nav.panel}`);

	const selectedLigatureID = editor.selectedLigatureID;

	const editingContent = `
		<div class="editor-page__tools-area"></div>
		<div class="editor-page__edit-canvas-wrapper"></div>
		<div class="editor-page__zoom-area"></div>
	`;

	const firstRunContent = `<div class="editor-page__edit-canvas-wrapper" style="grid-column: span 2; overflow-y: scroll;"></div>`;

	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
		<div class="editor__page">
			<div class="editor-page__left-area">
				<div class="editor-page__nav-area">
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'Ligatures' })}
				</div>
				<div id="editor-page__panel"></div>
			</div>
			${selectedLigatureID ? editingContent : firstRunContent}
		</div>
	`,
	});

	if (editor.showPageTransitions) content.classList.add('app__page-animation');

	// Page Selector
	/** @type {HTMLElement} */
	let l1 = content.querySelector('#nav-button-l1');
	l1.addEventListener('click', function () {
		toggleNavDropdown(l1);
	});

	/** @type {HTMLElement} */
	const navArea = content.querySelector('.editor-page__nav-area');
	const canvasArea = content.querySelector('.editor-page__edit-canvas-wrapper');

	if (!selectedLigatureID) {
		// Early return for project with zero ligatures
		addAsChildren(canvasArea, makeLigaturesFirstRunContent());
		navArea.style.display = 'block';
		l1.style.width = '100%';
		l1.style.borderRadius = '4px';
		// log(`makePage_Ligatures`, 'end');
		return content;
	}

	const selectedLigature = editor.selectedLigature;
	const l2Button = makeNavButton({
		level: 'l2',
		superTitle: 'EDITING',
		title: selectedLigature.name,
	});
	const l3Button = makeNavButton({ level: 'l3', superTitle: 'PANEL', title: editor.nav.panel });

	navArea.appendChild(textToNode(l2Button));
	navArea.appendChild(textToNode(l3Button));

	const editCanvas = makeElement({
		tag: 'edit-canvas',
		id: 'editor-page__edit-canvas',
		attributes: { 'editing-item-id': editor.selectedLigatureID },
	});

	canvasArea.appendChild(editCanvas);

	// Ligature Selector
	let l2 = content.querySelector('#nav-button-l2');
	l2.addEventListener('click', function () {
		toggleNavDropdown(l2);
	});
	editor.subscribe({
		topic: 'whichLigatureIsSelected',
		subscriberID: 'nav.ligatureChooserButton',
		callback: () => {
			if (editor.selectedLigature) {
				l2.innerHTML = makeNavButtonContent(editor.selectedLigature?.name, 'EDITING');
			}
		},
	});

	// Panel Selector
	let l3 = content.querySelector('#nav-button-l3');
	l3.addEventListener('click', function () {
		toggleNavDropdown(l3);
	});

	// Panel
	const panel = content.querySelector('#editor-page__panel');
	panel.appendChild(makePanel());
	panel.addEventListener('scroll', closeAllInfoBubbles);
	editor.subscribe({
		topic: ['whichLigatureIsSelected', 'whichShapeIsSelected'],
		subscriberID: 'nav.panelChooserButton',
		callback: () => {
			refreshPanel();
		},
	});

	// Tools
	if (editor.selectedTool === 'kern') editor.selectedTool = 'resize';
	let toolsArea = content.querySelector('.editor-page__tools-area');
	toolsArea.innerHTML = '';
	let toolsButtons = makeEditToolsButtons();
	if (toolsButtons) addAsChildren(toolsArea, toolsButtons);

	let zoomArea = content.querySelector('.editor-page__zoom-area');
	zoomArea.innerHTML = '';
	let viewButtons = makeViewToolsButtons();
	if (viewButtons) addAsChildren(zoomArea, viewButtons);

	// Canvas
	editor.subscribe({
		topic: 'whichLigatureIsSelected',
		subscriberID: 'editCanvas.selectedLigature',
		callback: (newLigatureID) => {
			// log(`Main Canvas subscriber callback`, 'start');
			removeStopCreatingNewPathButton();
			// log(`new id ${newLigatureID} on the main canvas`);
			content
				.querySelector('#editor-page__edit-canvas')
				.setAttribute('editing-item-id', newLigatureID);
			// log(`Main Canvas subscriber callback`, 'end');
		},
	});

	editor.subscribe({
		topic: 'whichShapeIsSelected',
		subscriberID: 'editCanvas.selectedPath',
		callback: () => {
			removeStopCreatingNewPathButton();
			editor.editCanvas.redraw('subscription:whichShapeIsSelected');
		},
	});

	editor.subscribe({
		topic: 'whichPathPointIsSelected',
		subscriberID: 'editCanvas.selectedPathPoint',
		callback: () => {
			editor.editCanvas.redraw('subscription:whichPathPointIsSelected');
		},
	});

	// log(`makePage_Ligatures`, 'end');
	return content;
}

/**
 * Makes the first run / get started content
 * @returns {Element}
 */
function makeLigaturesFirstRunContent() {
	let commonLigatureTable = '';
	ligaturesWithCodePoints.forEach((lig) => {
		commonLigatureTable += `
			<span class="first-run__example-wrapper">
					<pre>${lig.display}</pre>
					<span> ➞ </span>
					<pre>&#${parseInt(lig.point)};</pre>
			</span>
		`;
	});

	const content = makeElement({
		className: 'editor-page__first-run',
		innerHTML: `
			<h1>There are no ligatures in your project</h1>
			<p>
				Ligatures are a feature of fonts where a specified sequence of characters
				is recognized and replaced with a single new character that you design.
				In Latin, there are some common ligatures:
				<div class="first-run__examples-table">
				${commonLigatureTable}
				</div>
			</p>
			<p>
				These are just some examples. <strong>Ligatures can have any sequence of two
				or more characters.</strong> In a text editing program that has ligatures enabled,
				this sequence of characters is recognized, then replaced with the custom ligature
				character that you design.
			</p>
		`,
	});

	const addOneLigatureButton = makeElement({
		tag: 'fancy-button',
		innerHTML: 'Create a new ligature',
		onClick: showAddLigatureDialog,
	});

	const addCommonLigaturesButton = makeElement({
		tag: 'fancy-button',
		innerHTML: 'Add the common Latin ligatures to your project',
		attributes: { secondary: '' },
		onClick: addCommonLigaturesToProject,
	});

	content.appendChild(addOneLigatureButton);
	content.appendChild(addCommonLigaturesButton);
	return content;
}

// The 'display' property intentionally have zero-width
// invisible characters between the 'chars' to prevent
// triggering a ligature
const ligaturesWithCodePoints = [
	{ chars: 'ae', display: 'ae', point: '0xE6' },
	{ chars: 'AE', display: 'AE', point: '0xC6' },
	{ chars: 'ff', display: 'f‌f', point: '0xFB00' },
	{ chars: 'fi', display: 'f‌i', point: '0xFB01' },
	{ chars: 'fl', display: 'f‌l', point: '0xFB02' },
	{ chars: 'oe', display: 'oe', point: '0x153' },
	{ chars: 'OE', display: 'OE', point: '0x152' },
	{ chars: 'st', display: 'st', point: '0xFB06' },
	{ chars: 'ffi', display: 'f‌f‌i', point: '0xFB03' },
	{ chars: 'ffl', display: 'f‌f‌l', point: '0xFB04' },
];

/**
 * Adds the list of common ligatures to the current project
 */
function addCommonLigaturesToProject() {
	createLigatures(
		ligaturesWithCodePoints.map((lig) => lig.chars),
		'Added the common Latin ligatures'
	);
	const editor = getCurrentProjectEditor();
	editor.nav.page = 'Ligatures';
	editor.navigate();
}

/**
 * ANY-INK: Checks a ligature sequence before anything is created.
 * Plain characters only (audit B6): no U+ or 0x notation.
 * @param {String} sequence - characters that make up this Ligature
 * @returns {String | false} - error message, or false when the sequence is fine
 */
export function validateLigatureSequence(sequence = '') {
	// Use spread operator to count actual characters, not code units (for surrogate pairs)
	if ([...sequence].length < 2) {
		return 'Ligature sequences need to be two or more characters.';
	}
	const newID = makeLigatureID(sequence);
	if (newID === false) {
		return 'Characters could not be read for the ligature sequence.';
	}
	if (getCurrentProject().ligatures[newID]) {
		return 'Ligature already exists.';
	}
	return false;
}

/**
 * ANY-INK: Creates one or more ligatures as a single undoable step
 * (whole-project pre state before, post state after) and selects the last one.
 * Sequences that fail validation never touch the history.
 * @param {Array<String>} sequences - character sequences, one per ligature
 * @param {String} title - History panel title (optional)
 * @returns {Object} { created: Array<Glyph>, errors: Array<String> }
 */
export function createLigatures(sequences = [], title = '') {
	const editor = getCurrentProjectEditor();
	const errors = [];
	const created = [];

	// Validate first, so a failed dialog leaves the undo queue untouched
	const seen = new Set();
	const valid = sequences.filter((sequence) => {
		if (seen.has(sequence)) {
			errors.push(`Ligature ${sequence} was listed more than once.`);
			return false;
		}
		seen.add(sequence);
		const problem = validateLigatureSequence(sequence);
		if (problem) errors.push(`${sequence}: ${problem}`);
		return !problem;
	});

	if (valid.length) {
		const historyTitle =
			title ||
			(valid.length === 1 ? `Created ligature ${valid[0]}` : `Created ${valid.length} ligatures`);
		editor.history.addWholeProjectChangePreState(historyTitle);
		valid.forEach((sequence) => {
			const result = addLigature(sequence);
			if (typeof result === 'string') {
				errors.push(`${sequence}: ${result}`);
			} else {
				result.hasChangedThisSession = false;
				result.wasCreatedThisSession = true;
				created.push(result);
			}
		});
		if (created.length) {
			editor.selectedLigatureID = created.at(-1).id;
			editor.history.addWholeProjectChangePostState();
		} else {
			editor.history.discardLatestState();
		}
	}

	return { created, errors };
}

/**
 * Given a text sequence of characters, creates a Ligature object,
 * and adds it to the current project.
 * @param {String} sequence - characters that make up this Ligature
 * @returns {String | Glyph}
 */
function addLigature(sequence) {
	// log(`addLigature`, 'start');
	const problem = validateLigatureSequence(sequence);
	if (problem) {
		// log(`addLigature`, 'end');
		return problem;
	}

	// Finish up creating new ID and Ligature
	const newID = makeLigatureID(sequence);
	// log(`newID: ${newID}`);

	const project = getCurrentProject();
	project.addItemByType(
		new Glyph({
			id: newID,
			parent: project,
			objType: 'Ligature',
			// Use spread operator to correctly handle surrogate pairs
			gsub: [...sequence].map((char) => char.codePointAt(0)),
		}),
		'Ligature',
		newID
	);

	// log(`addLigature`, 'end');
	return project.ligatures[newID];
}

/**
 * Given an input sequence of ligature source characters, creates a
 * new unique ligature project id.
 * @param {String} sequence - characters that make up this ligature
 * @returns {String | false}
 */
export function makeLigatureID(sequence = '') {
	// log(`makeLigatureID`, 'start');
	// log(`sequence: ${sequence}`);
	if (sequence === '') return false;
	let newID = 'liga';
	// Use spread operator to correctly handle surrogate pairs
	let chars = [...sequence];
	chars.forEach((char) => {
		// If basic latin letter, use the letter
		// Use codePointAt instead of charCodeAt to handle surrogate pairs
		let code = char.codePointAt(0);
		if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) {
			newID += '-' + char;
		} else {
			newID += '-' + charToHex(char);
		}
	});
	// log(`newID: ${newID}`);

	// log(`makeLigatureID`, 'end');
	return newID;
}

/**
 * Makes the Add Ligature dialog and shows it.
 */
export function showAddLigatureDialog() {
	const content = makeElement({
		innerHTML: `
			<h2 id="ligatures__new-ligature-title">Create a new ligature</h2>
			Type the two or more characters this ligature replaces, for example <code>ff</code> or <code>fi</code>.
			<br>
			<div class="panel__card no-card">
				<input type="checkbox" id="ligatures__multi-input-checkbox" style="margin: 0 0 15px 0;"/>
				<label for="ligatures__multi-input-checkbox" style="grid-column-start: 2;">Create many ligatures at once with a comma separated list.<br>Ligatures cannot contain commas or spaces if you use this option.</label>
			</div>
			<input id="ligatures__new-ligature-input" type="text" style="width: 90%;"
				autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
			/>
			<br><br>
			<fancy-button disabled id="ligatures__add-new-ligature-button">Create ligature</fancy-button>
		`,
	});

	/** @type {HTMLElement} */
	const submitButton = content.querySelector('#ligatures__add-new-ligature-button');
	/** @type {HTMLInputElement} */
	const newLigatureInput = content.querySelector('#ligatures__new-ligature-input');
	/** @type {HTMLInputElement} */
	const multiLigatureCheckbox = content.querySelector('#ligatures__multi-input-checkbox');
	/** @type {HTMLInputElement} */
	const title = content.querySelector('#ligatures__new-ligature-title');

	newLigatureInput.addEventListener('keyup', () => {
		// Use spread operator to count actual characters, not code units (for surrogate pairs)
		if ([...newLigatureInput.value].length < 2) {
			submitButton.setAttribute('disabled', '');
		} else {
			submitButton.removeAttribute('disabled');
		}
	});

	multiLigatureCheckbox.addEventListener('change', () => {
		if (multiLigatureCheckbox.checked) {
			title.innerHTML = 'Create new ligatures';
			submitButton.innerHTML = 'Create ligatures';
		} else {
			title.innerHTML = 'Create a new ligature';
			submitButton.innerHTML = 'Create ligature';
		}
	});

	submitButton.addEventListener('click', () => {
		// log(`showAddLigatureDialog button click handler`, 'start');
		let sequences;
		if (multiLigatureCheckbox.checked) {
			const sanitizedString = newLigatureInput.value.replaceAll(' ', '');
			sequences = sanitizedString.split(',').filter((input) => input.length);
		} else {
			sequences = [newLigatureInput.value];
		}

		const { created, errors } = createLigatures(sequences);
		// log(`created: ${created.length}, errors: ${errors.length}`);

		if (created.length) {
			getCurrentProjectEditor().navigate();
			closeEveryTypeOfDialog();
		}
		if (errors.length) {
			const intro = created.length
				? 'Some ligatures could not be created:<br><br>'
				: 'The ligature could not be created:<br><br>';
			showError(intro + errors.join('<br><br>'));
		}
		// log(`showAddLigatureDialog button click handler`, 'end');
	});

	showModalDialog(content, 500);
}
