// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { makeEmptyOverlay } from '../anyink/letter/empty_overlay.js';
import '../anyink/letter/letter.css';
import { makeLetterHeader } from '../anyink/letter/letter_header.js';
import {
	isLetterViewOn,
	makeViewSwitches,
	noteLetterOpened,
	refreshViewSwitches,
} from '../anyink/letter/view_switches.js';
import { navItemTitle } from '../anyink/mode/simple_labels.js';
import { getCurrentProjectEditor } from '../app/main.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import { closeAllInfoBubbles } from '../controls/dialogs/dialogs.js';
import { EditCanvas } from '../edit_canvas/edit_canvas.js';
import { removeStopCreatingNewPathButton } from '../edit_canvas/tools/new_path.js';
import { makeEditToolsButtons, makeViewToolsButtons } from '../edit_canvas/tools/tools.js';
import { makePanel, refreshPanel } from '../panels/panels.js';
import {
	makeNavButton,
	makeNavButtonContent,
	toggleNavDropdown,
} from '../project_editor/navigator.js';
import { ProjectEditor } from '../project_editor/project_editor.js';

/**
 * Page > Characters
 * The main edit surface for Glyphr Studio, comprised of Panels of tools, and the Edit Canvas.
 * @returns {Element} - page content
 */
export function makePage_Characters() {
	// log(`makePage_Characters`, 'start');
	/** @type {ProjectEditor} */
	const editor = getCurrentProjectEditor();
	// log('current ProjectEditor');
	// log(editor);
	// log(editor.nav);
	// log(`editor.selectedGlyphID: ${editor.selectedGlyphID}`);
	// log(`editor.selectedItemID: ${editor.selectedItemID}`);
	// log(`editor.nav.panel: ${editor.nav.panel}`);

	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
		<div class="editor__page">
			<div class="editor-page__left-area">
				<div class="editor-page__nav-area">
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'Characters' })}
					${makeNavButton({
						level: 'l2',
						superTitle: 'EDITING',
						title: letterButtonTitle(editor.selectedGlyphID),
					})}
					${makeNavButton({ level: 'l3', superTitle: 'PANEL', title: editor.nav.panel })}
				</div>
				<div id="editor-page__panel"></div>
			</div>
			<div class="editor-page__tools-area"></div>
			<div class="editor-page__edit-canvas-wrapper">
				<edit-canvas id="editor-page__edit-canvas" editing-item-id="${
					editor.selectedGlyphID
				}"></edit-canvas>
			</div>
			<div class="editor-page__zoom-area"></div>
		</div>
	`,
	});

	if (editor.showPageTransitions) content.classList.add('app__page-animation');

	// Page Selector
	let l1 = content.querySelector('#nav-button-l1');
	l1.addEventListener('click', function () {
		toggleNavDropdown(l1);
	});
	// Glyph Selector
	let l2 = content.querySelector('#nav-button-l2');
	l2.addEventListener('click', function () {
		toggleNavDropdown(l2);
	});
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: 'nav.glyphChooserButton',
		callback: (newGlyphID) => {
			l2.innerHTML = makeNavButtonContent(letterButtonTitle(newGlyphID), 'EDITING');
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
		topic: ['whichGlyphIsSelected', 'whichShapeIsSelected'],
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

	// ANY-INK (B7, UX-BEGINNER 4.3): the Simple letter view: the letter header in the left area,
	// the overlay on an empty letter's canvas, the view switches under it inside Fine-tune (the
	// panel slot's letter card is panels.js's). All tools draws the page exactly as before.
	if (isLetterViewOn()) addLetterView(content, editor);

	// Canvas
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: 'editCanvas.selectedGlyph',
		callback: (newGlyphID) => {
			// log(`Main Canvas subscriber callback`, 'start');
			removeStopCreatingNewPathButton();
			// log(`new id ${newGlyphID} on the main canvas`);
			content
				.querySelector('#editor-page__edit-canvas')
				.setAttribute('editing-item-id', newGlyphID);
			// log(`Main Canvas subscriber callback`, 'end');
		},
	});

	const simpleRedraws = ['whichShapeIsSelected', 'whichPathPointIsSelected', 'qualityChecks'];

	simpleRedraws.forEach((topic) => {
		editor.subscribe({
			topic: topic,
			subscriberID: `editCanvas.${topic}`,
			callback: () => {
				/** @type {EditCanvas} */
				const canvas = editor.editCanvas;
				if (canvas.redraw) canvas.redraw('subscription:simpleRedraws');
			},
		});
	});

	// log(`makePage_Characters`, 'end');
	return content;
}

/**
 * ANY-INK (B7, UX-BEGINNER 4.3): the Simple letter view's parts of the page. The left area's
 * letter and panel buttons are hidden already (visibility.js: the 'item' chooser is replaced by
 * 'letterView', the panel chooser is All tools only); the page button stays until B6's rail.
 *  - the letter header ("<- All letters", the name, "< A" / "C >") under the nav buttons
 *  - the empty-letter overlay, laid over the canvas's grid cell (letter.css)
 *  - the four view switches in the zoom area, shown while Fine-tune is open; the upstream
 *    outline and paper buttons go, since the switches do what they did
 * Every subscriber id here is 'anyink.letter.<purpose>' (the header, card and overlay add
 * their own).
 * @param {Element} content - the page
 * @param {ProjectEditor} editor
 */
function addLetterView(content, editor) {
	const page = content.querySelector('.editor__page');
	page.setAttribute('data-anyink-letter-view', '');

	content.querySelector('.editor-page__nav-area').after(makeLetterHeader(editor));
	page.appendChild(makeEmptyOverlay(editor));

	// a letter opened: a visit of its own for the guide letter (view_switches.js)
	noteLetterOpened(editor.project.getItem(editor.selectedGlyphID));
	editor.subscribe({
		topic: 'whichGlyphIsSelected',
		subscriberID: 'anyink.letter.visit',
		callback: (id) => noteLetterOpened(editor.project.getItem(id)),
	});

	const zoomArea = content.querySelector('.editor-page__zoom-area');
	zoomArea
		.querySelectorAll('[data-anyink-view-tool="displayMode"], [data-anyink-view-tool="canvasTheme"]')
		.forEach((button) => button.remove());
	const switches = makeViewSwitches(editor);
	zoomArea.appendChild(switches);
	editor.subscribe({
		// a view change (Fine-tune, a switch), another letter, or a letter's first ink
		topic: ['editCanvasView', 'whichGlyphIsSelected', 'currentItem'],
		subscriberID: 'anyink.letter.switches',
		callback: () => {
			if (switches.isConnected) refreshViewSwitches(switches);
		},
	});
}

/**
 *
 * @param {String | false} itemID - ID of the item
 * @returns {String} - name of the item
 */
/**
 * ANY-INK (B4 + B5 integration): the letter button's title. Simple names the letter in words
 * ("small a", UX-BEGINNER 2.2); All tools keeps the item's name.
 * @param {String} itemID
 * @returns {String}
 */
function letterButtonTitle(itemID) {
	const upstream = getItemNameWithFallback(itemID);
	return navItemTitle(getCurrentProjectEditor()?.project, itemID, upstream);
}

export function getItemNameWithFallback(itemID) {
	// log(`getItemNameWithFallback`, 'start');
	// log(`itemID: ${itemID}`);
	if(!itemID) return '[no id]';
	const editor = getCurrentProjectEditor();
	let charName = editor.project.getItemName(itemID, true);

	// log(`charName: ${charName}`);
	// log(`getItemNameWithFallback`, 'end');
	return charName;
}
