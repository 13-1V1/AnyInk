// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { notifyKernPairsChanged } from '../anyink/kerning/kern_lookup.js';
import { makeMemberChips, makeTilePicker } from '../anyink/kerning/tile_picker.js';
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';
import { hexesToChars, validateAsHex } from '../common/character_ids.js';
import { addAsChildren, makeElement, textToNode } from '../common/dom.js';
import { countItems, getFirstID } from '../common/functions.js';
import {
	closeAllInfoBubbles,
	closeEveryTypeOfDialog,
	showError,
	showModalDialog,
} from '../controls/dialogs/dialogs.js';
import { makeKernToolButton, makeViewToolsButtons } from '../edit_canvas/tools/tools.js';
import { getUnicodeName } from '../lib/unicode/unicode_names.js';
import { makeOneKernGroupRow } from '../panels/item_chooser.js';
import { makePanel, refreshPanel } from '../panels/panels.js';
import { KernGroup } from '../project_data/kern_group.js';
import {
	makeNavButton,
	makeNavButtonContent,
	toggleNavDropdown,
} from '../project_editor/navigator.js';

/**
 * Page > Kerning
 * Edit surface for Kerning, comprised of Panels of tools, and the Edit Canvas.
 * @returns {Element} - page content
 */
export function makePage_Kerning() {
	// log(`makePage_Kerning`, 'start');
	const editor = getCurrentProjectEditor();
	// log('current ProjectEditor');
	// log(editor);
	// log(editor.nav);
	// log(`editor.selectedKernGroupID: ${editor.selectedKernGroupID}`);
	// log(`editor.selectedItemID: ${editor.selectedItemID}`);
	// log(`editor.nav.panel: ${editor.nav.panel}`);

	const selectedKernGroupID = editor.selectedKernGroupID;

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
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'Kerning' })}
				</div>
				<div id="editor-page__panel"></div>
			</div>
			${selectedKernGroupID ? editingContent : firstRunContent}
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

	if (!selectedKernGroupID) {
		// Early return for project with zero Kern Groups
		addAsChildren(canvasArea, makeKerningFirstRunContent());
		navArea.style.display = 'block';
		l1.style.width = '100%';
		l1.style.borderRadius = '4px';
		// log(`makePage_Kerning`, 'end');
		return content;
	}

	const selectedKernGroup = editor.selectedKernGroup;
	const l2Button = makeNavButton({
		level: 'l2',
		superTitle: 'EDITING',
		title: selectedKernGroup.name,
	});
	const l3Button = makeNavButton({ level: 'l3', superTitle: 'PANEL', title: editor.nav.panel });

	navArea.appendChild(textToNode(l2Button));
	navArea.appendChild(textToNode(l3Button));

	const editCanvas = makeElement({
		tag: 'edit-canvas',
		id: 'editor-page__edit-canvas',
		attributes: { 'editing-item-id': editor.selectedKernGroupID },
	});

	canvasArea.appendChild(editCanvas);

	// Kern Selector
	let l2 = content.querySelector('#nav-button-l2');
	l2.addEventListener('click', function () {
		toggleNavDropdown(l2);
	});
	editor.subscribe({
		topic: 'whichKernGroupIsSelected',
		subscriberID: 'nav.kernChooserButton',
		callback: () => {
			if (editor.selectedKernGroup) {
				l2.innerHTML = makeNavButtonContent(editor.selectedKernGroup?.name, 'EDITING');
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
		topic: ['whichKernGroupIsSelected'],
		subscriberID: 'nav.panelChooserButton',
		callback: () => {
			refreshPanel();
		},
	});

	// Tools
	editor.selectedTool = 'kern';
	let toolsArea = content.querySelector('.editor-page__tools-area');
	toolsArea.innerHTML = '';
	let toolsButtons = makeKernToolButton();
	if (toolsButtons) addAsChildren(toolsArea, toolsButtons);

	let zoomArea = content.querySelector('.editor-page__zoom-area');
	zoomArea.innerHTML = '';
	let viewButtons = makeViewToolsButtons();
	if (viewButtons) addAsChildren(zoomArea, viewButtons);

	// Canvas
	editor.subscribe({
		topic: 'whichKernGroupIsSelected',
		subscriberID: 'editCanvas.selectedKernGroup',
		callback: (newKernID) => {
			// log(`Main Canvas subscriber callback`, 'start');
			// log(`new id ${newKernID} on the main canvas`);
			content.querySelector('#editor-page__edit-canvas').setAttribute('editing-item-id', newKernID);
			// log(`Main Canvas subscriber callback`, 'end');
		},
	});

	// log(`makePage_Kerning`, 'end');
	return content;
}

/**
 * Makes the first run / get started content
 * @returns {Element}
 */
function makeKerningFirstRunContent() {
	const content = makeElement({
		className: 'editor-page__first-run',
		innerHTML: `
			<h1>There are no kern pairs in your project</h1>
			<p>
				Kerning is an advanced feature of fonts that recognizes a pair of characters, then
				adjusts the spacing between them to some custom value. The default spacing between
				characters is zero - which is to say, the white space (side bearings) within each
				character are the only space shown.
			</p>
			<p>
				Some letter combinations, like <code>VA</code>
				as an example, if the default side bearing spacing
				is used, the letters visually look very far apart. Kerning can help the visual flow of
				character pairs look more well considered. Many character pairs may need either negative
				or positive kern values to make them "look right".
			</p>
			<h2>Class-based kerning</h2>
			<p>
				Font files encode kerning values as three pieces of information: a left character, a right
				character, and a horizontal adjustment value. Fonts with many characters can end up having
				a huge amount of kern pairs. ANY-INK uses a system called Class-based Kerning, where
				groups of characters with similar edges (like
					<code>V</code><code>v</code><code>W</code><code>w</code>
					)
				can be treated as a single left-hand group, and a group of right-hand characters (for example,
				<code>A</code><code>/</code>) can be treated as single group - which can be given a single value.
				When a font is exported, the permutations are saved as individual kern pairs. But, while
				editing, grouping common characters often simplifies the overall kerning process.
			</p>
		`,
	});

	const addOneKernButton = makeElement({
		tag: 'fancy-button',
		innerHTML: 'Create a new kern group',
		onClick: () => showAddEditKernGroupDialog(false),
	});

	content.appendChild(addOneKernButton);
	return content;
}

/**
 * New kern group dialog handler
 * @param {Array} leftGroup - left kern members
 * @param {Array} rightGroup - right kern members
 * @param {Number} value - kern value
 * @returns {KernGroup}
 */
function addKernGroup(leftGroup, rightGroup, value) {
	// log(`addKernGroup`, 'start');
	// log(leftGroup);
	// log(rightGroup);
	// log(value);
	// Finish up creating new ID and Kern
	const newID = makeKernGroupID();
	// log(`newID: ${newID}`);

	const project = getCurrentProject();

	project.addItemByType(
		new KernGroup({
			leftGroup: leftGroup,
			rightGroup: rightGroup,
			value: value,
		}),
		'KernGroup',
		newID
	);

	// log(`addKernGroup`, 'end');
	return project.kerning[newID];
}

/**
 * Makes a new Kern Group ID, without colliding with old ones.
 * @param {Object} kernGroups - current kern groups
 * @returns {String}
 */
export function makeKernGroupID(kernGroups = getCurrentProject().kerning) {
	// log(`makeKernGroupID`, 'start');
	let counter = countItems(kernGroups);
	while (kernGroups[`kern-${counter}`]) counter++;
	const newID = `kern-${counter}`;
	// log(`newID: ${newID}`);
	// log(`makeKernGroupID`, 'end');
	return newID;
}

/**
 * Shows an edit dialog for a given Kern Group - or, if
 * one is not provided, used as a 'create new' Kern Group dialog.
 * ANY-INK (audit B1 / B2): members are picked by clicking glyph tiles into chips, and the
 * value is a readout; it is set by dragging the right letter on the canvas.
 * @param {KernGroup | false =} kernGroup
 */
export function showAddEditKernGroupDialog(kernGroup) {
	// log(`showAddEditKernGroupDialog`, 'start');
	// log(`kernGroup`);
	// log(kernGroup);
	const project = getCurrentProject();
	const value = kernGroup ? kernGroup.value : 0;

	const content = makeElement({
		innerHTML: `
		<h2>${kernGroup ? 'Edit this' : 'Create a new'} kern group</h2>
		Click glyph tiles to put characters in the left-side group and the right-side group.
		Click a chip to take it back out. Every left character is kerned against every right character.
		<br><br>
		<div class="anyink-kern-dialog__columns">
			<div>
				<h3>Left group</h3>
				<div id="kerning__add-new-kern-group__left-group" class="anyink-kern-chips"></div>
				<div class="anyink-kern-dialog__left-picker"></div>
			</div>
			<div>
				<h3>Right group</h3>
				<div id="kerning__add-new-kern-group__right-group" class="anyink-kern-chips"></div>
				<div class="anyink-kern-dialog__right-picker"></div>
			</div>
		</div>
		<br>
		<h3>Value</h3>
		<span id="kerning__add-new-kern-group__value" class="anyink-kern-readout">${value}</span>
		<span class="anyink-kern-readout__hint">drag the right letter on the canvas to change it</span>
		<br><br>
		<fancy-button disabled id="kerning__add-new-kern-group__submit-button">
			${kernGroup ? 'Save changes' : 'Create kern group'}
		</fancy-button>
		`,
	});

	const submitButton = content.querySelector('#kerning__add-new-kern-group__submit-button');
	const leftChipsArea = content.querySelector('#kerning__add-new-kern-group__left-group');
	const rightChipsArea = content.querySelector('#kerning__add-new-kern-group__right-group');

	const leftPicker = makeTilePicker({
		project,
		selected: kernGroup ? kernGroup.leftGroup : [],
		onChange: refreshChips,
	});
	const rightPicker = makeTilePicker({
		project,
		selected: kernGroup ? kernGroup.rightGroup : [],
		onChange: refreshChips,
	});
	content.querySelector('.anyink-kern-dialog__left-picker').appendChild(leftPicker.element);
	content.querySelector('.anyink-kern-dialog__right-picker').appendChild(rightPicker.element);

	let submitBound = false;
	refreshChips();

	function refreshChips() {
		leftChipsArea.innerHTML = '';
		leftChipsArea.appendChild(
			makeMemberChips(leftPicker.getSelected(), {
				project,
				onRemove: (hex) => {
					leftPicker.toggle(hex);
				},
			})
		);
		rightChipsArea.innerHTML = '';
		rightChipsArea.appendChild(
			makeMemberChips(rightPicker.getSelected(), {
				project,
				onRemove: (hex) => {
					rightPicker.toggle(hex);
				},
			})
		);
		updateSubmitButton();
	}

	function updateSubmitButton() {
		const ready = leftPicker.getSelected().length > 0 && rightPicker.getSelected().length > 0;
		if (ready) {
			submitButton.removeAttribute('disabled');
			if (!submitBound) {
				submitButton.addEventListener('click', addEditDialogSubmit);
				submitBound = true;
			}
		} else {
			submitButton.setAttribute('disabled', '');
			if (submitBound) {
				submitButton.removeEventListener('click', addEditDialogSubmit);
				submitBound = false;
			}
		}
	}

	function addEditDialogSubmit() {
		// log(`showAddEditKernGroupDialog button click handler`, 'start');
		const editor = getCurrentProjectEditor();
		const leftNew = leftPicker.getSelected();
		const rightNew = rightPicker.getSelected();
		if (!leftNew.length || !rightNew.length) return;

		if (kernGroup) {
			// log(kernGroup.print());
			kernGroup.leftGroup = leftNew;
			kernGroup.rightGroup = rightNew;
			// log(kernGroup.print());
			editor.history.addState('Edited kern group: ' + editor.selectedKernGroupID);
			notifyKernPairsChanged(editor, { groupID: kernGroup.id, value: kernGroup.value });
			editor.publish('currentKernGroup', editor.selectedKernGroup);
			editor.navigate();
			closeEveryTypeOfDialog();
		} else {
			editor.history.addWholeProjectChangePreState('Created a new kern group');
			const result = addKernGroup(leftNew, rightNew, value);
			// log(`result: ${result}`);

			if (typeof result === 'string') {
				editor.history.discardLatestState();
				showError(result);
			} else {
				editor.history.addWholeProjectChangePostState();
				notifyKernPairsChanged(editor, { groupID: result.id, value: result.value, created: true });
				editor.selectedItemID = result.id;
				editor.navigate();
				closeEveryTypeOfDialog();
			}
		}
		// log(`showAddEditKernGroupDialog button click handler`, 'end');
	}

	showModalDialog(content, 900);
	// log(`showAddEditKernGroupDialog`, 'end');
}

/**
 * Two single-pick tile pickers for a letter pair (find / delete dialogs).
 * The picked hex ids are mirrored into hidden inputs that keep upstream's ids.
 * @param {Element} content - dialog content
 * @param {Function} onChange - called after either pick changes
 */
function mountPairPickers(content, onChange) {
	const project = getCurrentProject();
	/** @type {HTMLInputElement} */
	const leftInput = content.querySelector('#kerning__letter-pair__left-group');
	/** @type {HTMLInputElement} */
	const rightInput = content.querySelector('#kerning__letter-pair__right-group');
	const leftChips = content.querySelector('.anyink-kern-pair-pick__left-chip');
	const rightChips = content.querySelector('.anyink-kern-pair-pick__right-chip');

	const leftPicker = makeTilePicker({
		project,
		multi: false,
		onChange: (list) => {
			leftInput.value = list[0] || '';
			paint();
		},
	});
	const rightPicker = makeTilePicker({
		project,
		multi: false,
		onChange: (list) => {
			rightInput.value = list[0] || '';
			paint();
		},
	});
	content.querySelector('.anyink-kern-pair-pick__left-picker').appendChild(leftPicker.element);
	content.querySelector('.anyink-kern-pair-pick__right-picker').appendChild(rightPicker.element);

	function paint() {
		leftChips.innerHTML = '';
		leftChips.appendChild(
			makeMemberChips(leftInput.value ? [leftInput.value] : [], {
				project,
				emptyText: 'pick a left letter',
				onRemove: () => {
					leftPicker.setSelected([]);
					leftInput.value = '';
					paint();
				},
			})
		);
		rightChips.innerHTML = '';
		rightChips.appendChild(
			makeMemberChips(rightInput.value ? [rightInput.value] : [], {
				project,
				emptyText: 'pick a right letter',
				onRemove: () => {
					rightPicker.setSelected([]);
					rightInput.value = '';
					paint();
				},
			})
		);
		onChange();
	}
	paint();
}

const pairPickMarkup = `
	<div class="anyink-kern-pair-pick">
		<div>
			<div class="list__column-header">Left group letter</div>
			<div class="anyink-kern-pair-pick__left-chip"></div>
			<div class="anyink-kern-pair-pick__left-picker"></div>
		</div>
		<div>
			<div class="list__column-header">Right group letter</div>
			<div class="anyink-kern-pair-pick__right-chip"></div>
			<div class="anyink-kern-pair-pick__right-picker"></div>
		</div>
	</div>
	<input id="kerning__letter-pair__left-group" type="hidden" value="" />
	<input id="kerning__letter-pair__right-group" type="hidden" value="" />
`;

/**
 * Makes the content for the Find Single Letter Pair dialog, and shows it.
 * ANY-INK (audit B4): the pair is picked from two glyph tiles.
 */
export function showFindSingleLetterPairDialog() {
	const content = makeElement({
		innerHTML: `
		<h2>Find a letter pair</h2>
		Pick a left letter and a right letter below, and search will return all the Kern Groups
		that contain that pair. Clicking on a search result will select that Kern Group
		behind the dialog box.
		<br><br>
		It is good to not have duplicate values for a letter pair - the value that actually
		gets used may not be the expected one.
		<br><br>
		${pairPickMarkup}
		<br>

		<fancy-button disabled id="kerning__letter-pair__search-button">
			Search
		</fancy-button>
		<br><br>
		<hr/>
		<br>
		<div id="kerning__letter-pair__results">
			<i>Search results...</i>
		</div>
		`,
	});

	mountPairPickers(content, () => updateSearchButton(content));
	const searchButton = content.querySelector('#kerning__letter-pair__search-button');
	searchButton.addEventListener('click', searchForLetterPairs);
	showModalDialog(content, 900);
}

/**
 * Makes the content for the Delete Single Letter Pair dialog, and shows it.
 * ANY-INK (audit B4): the pair is picked from two glyph tiles.
 */
export function showDeleteSingleLetterPairDialog() {
	const content = makeElement({
		innerHTML: `
		<h2>Delete letter pairs</h2>
		Pick a left letter and a right letter below, and search will find and attempt to delete all
		the letter pairs from the applicable Kern Groups.
		<br><br>
		<b>Note</b>: This will only affect Kern Groups where either the left group or the right group has only one member. Kern Groups affect all possible permutations of left group / right group.
		Because of this, if a left group and a right group both have multiple members, including
		the specified letter pair, removing the letters from the letter pair would remove more
		than just the kern value for those two letters.
		<br><br>
		${pairPickMarkup}
		<br>

		<fancy-button disabled danger id="kerning__letter-pair__search-button">
			Find and delete
		</fancy-button>
		<div id="kerning__result-message"></div>
		`,
	});

	mountPairPickers(content, () => updateSearchButton(content));
	const searchButton = content.querySelector('#kerning__letter-pair__search-button');
	searchButton.addEventListener('click', deleteLetterPairs);
	showModalDialog(content, 900);
}

/**
 * Reads the picked pair (hex ids) out of the dialog.
 * @param {Element | Document} root
 * @returns {{leftHex: String, rightHex: String}}
 */
function getPickedPair(root = document) {
	/** @type {HTMLInputElement} */
	const leftInput = root.querySelector('#kerning__letter-pair__left-group');
	/** @type {HTMLInputElement} */
	const rightInput = root.querySelector('#kerning__letter-pair__right-group');
	return {
		leftHex: validateAsHex(leftInput?.value || '') || '',
		rightHex: validateAsHex(rightInput?.value || '') || '',
	};
}

/**
 * Enables or disables the search button based on the picked pair.
 * @param {Element | Document} root
 */
function updateSearchButton(root = document) {
	const { leftHex, rightHex } = getPickedPair(root);
	const searchButton = root.querySelector('#kerning__letter-pair__search-button');
	if (!searchButton) return;
	if (leftHex && rightHex) {
		searchButton.removeAttribute('disabled');
	} else {
		searchButton.setAttribute('disabled', '');
	}
}

/**
 * Kern group ids whose left group has leftHex and right group has rightHex.
 * @param {String} leftHex
 * @param {String} rightHex
 * @param {Object} groups - project.kerning
 * @returns {Array<String>}
 */
export function findGroupsWithPair(leftHex, rightHex, groups = getCurrentProject().kerning) {
	return Object.keys(groups).filter(
		(id) => groups[id].leftGroup.includes(leftHex) && groups[id].rightGroup.includes(rightHex)
	);
}

/**
 * Does the search for letter pairs
 */
function searchForLetterPairs() {
	// log(`searchForLetterPairs`, 'start');
	const { leftHex, rightHex } = getPickedPair();
	// log(`leftHex: ${leftHex} rightHex: ${rightHex}`);
	const results = findGroupsWithPair(leftHex, rightHex);

	// log(`\n⮟results⮟`);
	// log(results);
	const resultsArea = document.querySelector('#kerning__letter-pair__results');
	resultsArea.innerHTML = '';

	if (results.length) {
		const selectedKernGroupID = getCurrentProjectEditor().selectedKernGroupID;
		results.forEach((id) => {
			let row = makeOneKernGroupRow(id);
			row.addEventListener('click', () => {
				const editor = getCurrentProjectEditor();
				editor.selectedItemID = id;
				editor.history.addState(`Navigated to ${editor.project.getItemName(id, true)}`);
				let resultRows = document.querySelectorAll('.kern-group-chooser__row');
				resultRows.forEach((result) => result.removeAttribute('selected'));
				row.setAttribute('selected', '');
			});
			if (id === selectedKernGroupID) row.setAttribute('selected', '');
			resultsArea.appendChild(row);
		});
	} else {
		resultsArea.innerHTML = '<i>No Kern Groups exist with that letter pair</i>';
	}
	// log(`searchForLetterPairs`, 'end');
}

/**
 * Classifies how a pair can be removed from a group.
 * @param {KernGroup} group
 * @param {String} leftHex
 * @param {String} rightHex
 * @returns {'delete' | 'right' | 'left' | false} delete the group, splice a side, or impossible
 */
export function classifyPairRemoval(group, leftHex, rightHex) {
	if (!group.leftGroup.includes(leftHex) || !group.rightGroup.includes(rightHex)) return false;
	if (group.leftGroup.length === 1 && group.rightGroup.length === 1) return 'delete';
	if (group.leftGroup.length === 1) return 'right';
	if (group.rightGroup.length === 1) return 'left';
	return false;
}

/**
 * Deletes letter pairs
 * ANY-INK: one whole-project history entry for the whole operation, the lookup is
 * invalidated, and a deleted selected group falls back to the first remaining one.
 */
function deleteLetterPairs() {
	// log(`deleteLetterPairs`, 'start');
	const { leftHex, rightHex } = getPickedPair();
	const leftLetter = hexesToChars(leftHex) || leftHex;
	const rightLetter = hexesToChars(rightHex) || rightHex;
	const editor = getCurrentProjectEditor();
	const project = editor.project;

	const resultMessage = document.querySelector('#kerning__result-message');
	resultMessage.innerHTML = '';

	const groups = project.kerning;
	const errors = [];
	const success = [];
	const plan = [];

	Object.keys(groups).forEach((id) => {
		if (!groups[id].leftGroup.includes(leftHex) || !groups[id].rightGroup.includes(rightHex)) return;
		const how = classifyPairRemoval(groups[id], leftHex, rightHex);
		if (how) plan.push({ id, how });
		else errors.push(id);
	});

	if (plan.length) {
		editor.history.addWholeProjectChangePreState(
			`Deleted letter pair ${leftLetter}${rightLetter} from ${plan.length} kern group${
				plan.length > 1 ? 's' : ''
			}`
		);
		plan.forEach(({ id, how }) => {
			if (deleteLetterPair(leftHex, rightHex, id, how)) success.push(id);
			else errors.push(id);
		});
		if (!project.kerning[editor.selectedKernGroupID]) {
			editor.selectedKernGroupID = getFirstID(project.kerning) || false;
		}
		editor.history.addWholeProjectChangePostState();
		notifyKernPairsChanged(editor, { deleted: success });
	}

	// log(`After search`);
	// log(`success.toString(): ${success.toString()}`);
	// log(`errors.toString(): ${errors.toString()}`);

	if (errors.length) {
		resultMessage.innerHTML = `
			<br><br>
			<b>Warning</b><br>
			The following Kern Groups contain the specified letter pair, but
			the letters could not be removed because both the left group and
			the right group contain multiple members.
			<br><br>
			${errors.join(', ')}
			<br><br>
			<hr>
		`;
	}

	if (success.length > 0) {
		resultMessage.innerHTML += `
			<br>
			Successfully removed letter pair from Kern Group${success.length > 1 ? 's:' : ':'}
			<br><br>
			${success.join(', ')}
		`;
		editor.navigate();
	} else {
		if (!errors.length) {
			resultMessage.innerHTML += `
				<br>
				<i>No Kern Groups with the specified letter pair was found.</i>
			`;
		}
	}

	// log(`deleteLetterPairs`, 'end');
}

/**
 * Given a Kern ID, removes a letter pair from it. History is the caller's job.
 * @param {String} leftHex - left member id
 * @param {String} rightHex - right member id
 * @param {String} kernID - which Kern Group to use
 * @param {String =} how - from classifyPairRemoval; computed when omitted
 * @returns {Boolean} - successful or not
 */
function deleteLetterPair(leftHex = '', rightHex = '', kernID = '', how = '') {
	// log(`deleteLetterPair`, 'start');
	const project = getCurrentProject();
	const group = project.getItem(kernID);
	if (!group) return false;
	const action = how || classifyPairRemoval(group, leftHex, rightHex);
	if (!action) return false;

	if (action === 'delete') {
		// log(`Removing the Kern Group ${kernID}`);
		delete project.kerning[kernID];
	} else if (action === 'right') {
		// log(`Removing ${rightHex} from the right group`);
		group.rightGroup = group.rightGroup.filter((hex) => hex !== rightHex);
	} else if (action === 'left') {
		// log(`Removing ${leftHex} from the left group`);
		group.leftGroup = group.leftGroup.filter((hex) => hex !== leftHex);
	}

	// log(`deleteLetterPair`, 'end');
	return true;
}

/**
 * Makes a small collection of character 'chips' for half
 * of a kern group's membership (left or right).
 * ANY-INK: an optional click handler and representative marker let the kern group
 * card use the chips to pick which glyph the pair view shows.
 * @param {Array} group - list of character IDs
 * @param {Object =} options
 * @param {Function =} options.onClick - called with the chip's hex id
 * @param {String =} options.representative - hex id to mark as the shown glyph
 * @param {String =} options.title - extra tooltip line
 * @returns {Element}
 */
export function makeKernGroupCharChips(group, options = {}) {
	// log(`makeKernGroupCharChips`, 'start');
	// log(`group: ${group}`);

	const wrapper = makeElement();
	if (options.onClick) wrapper.classList.add('anyink-kern-card-chips');
	group.forEach((charID) => {
		// log(`charID: ${charID}`);
		wrapper.appendChild(makeCharChip(charID, options));
	});
	// log(`makeKernGroupCharChips`, 'end');
	return wrapper;
}

/**
 * Makes a small element that represents a single character.
 * @param {String} charID - char to make a chip for
 * @param {Object =} options - see makeKernGroupCharChips
 * @returns {Element}
 */
export function makeCharChip(charID, options = {}) {
	// log(`makeCharChip`, 'start');
	// log(`charID: ${charID}`);

	let char = hexesToChars(charID) || '';
	let name = getUnicodeName(charID);
	let title = charID;
	const exists = !!getCurrentProject().getItem(`glyph-${charID}`, false);
	if (name) title = `${name}\n${charID}`;
	if (options.title) title += `\n${options.title}`;
	// log(`char: ${char}`);
	// log(`name: ${name}`);
	// log(`title: ${title}`);

	let chip = makeElement({
		tag: 'code',
		innerHTML: char,
		attributes: { title: title },
	});
	chip.dataset.hex = charID;

	if (!exists) {
		chip.classList.add('warning');
		chip.setAttribute('title', `${title}\nWarning: This character does not exist in the project.`);
	}

	if (options.representative && options.representative === charID) {
		chip.dataset.representative = '';
	}
	if (options.onClick) {
		chip.addEventListener('click', () => options.onClick(charID, chip));
	}

	// log(`makeCharChip`, 'end');
	return chip;
}
