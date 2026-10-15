// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { makeBackToLettersButton } from '../anyink/mode/back_to_letters.js';
import { keysShown } from '../anyink/mode/keys.js';
import { makeElement, textToNode } from '../common/dom.js';
import { TabControl } from '../controls/tabs/tab_control.js';
import { cursors } from '../edit_canvas/cursors.js';
import { makeToolButtonSVG } from '../edit_canvas/tools/tools.js';
import { makeNavButton, toggleNavDropdown } from '../project_editor/navigator.js';
import { isSimpleMode } from '../anyink/mode/mode.js';
import { word } from '../anyink/words/words.js';

/**
 * Page > Help
 * Help content for Glyphr Studio.
 * @returns {Element} - page content
 */
export function makePage_Help() {
	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
		<div class="content__page">
			<div class="content-page__left-area">
				<div class="content-page__nav-area">
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'Help' })}
				</div>
				<div id="content-page__panel"></div>
			</div>
			<div class="content-page__right-area"></div>
		</div>
	`,
	});

	// Page Selector
	let l1 = content.querySelector('#nav-button-l1');
	l1.addEventListener('click', function () {
		toggleNavDropdown(l1);
	});

	const rightArea = content.querySelector('.content-page__right-area');
	const tabControl = new TabControl(rightArea);

	// ANY-INK (B4 + B5 finalize): Simple's Help is one "Help" tab in house words, with the keys
	// Simple has (UX-BEGINNER 4.10, until B15's Help page), and [Back to my letters]; Glyphr
	// Studio's key table says its own words (items, paths, kern groups), so it is All tools only
	const simple = isSimpleMode();
	const firstTab = simple ? word('help.title') : 'Overview';
	tabControl.registerTab(firstTab, simple ? makeSimpleHelp : makeHelpOverview);
	if (!simple) tabControl.registerTab('Keyboard shortcuts', makeKeyboardShortcutReference);
	tabControl.selectTab(firstTab);

	const panelArea = content.querySelector('#content-page__panel');
	panelArea.appendChild(tabControl.makeTabs());
	if (simple) panelArea.appendChild(makeBackToLettersButton());

	return content;
}

/**
 * ANY-INK (B4 + B5 finalize, UX-BEGINNER 4.10): Simple's Help in a few sentences, until B15:
 * pick a letter, the tools and their keys (keys.js: the keys Simple has), Undo, Save and Open,
 * the font file, and the full manual (Glyphr Studio's help site, said to use pro words).
 * @returns {Element}
 */
function makeSimpleHelp() {
	const content = document.createElement('div');
	const title = document.createElement('h1');
	title.textContent = word('help.title');
	content.appendChild(title);
	const tools = keysShown({ mode: 'simple' })
		.filter((key) => key.action === 'selectTool' && key.keys.length)
		.map((key) => word('help.toolKey', { tool: word(`tool.${key.tool}`), key: key.keys[0] }))
		.join(', ');
	[
		word('help.howPick'),
		word('help.howDraw', { tools }),
		word('help.howUndo'),
		word('help.howSave'),
		word('help.howFontFile'),
	].forEach((sentence) => {
		const paragraph = document.createElement('p');
		paragraph.textContent = sentence;
		content.appendChild(paragraph);
	});
	const manual = document.createElement('p');
	const link = document.createElement('a');
	link.href = 'https://www.glyphrstudio.com/help';
	link.target = '_blank';
	link.textContent = word('help.fullManual');
	manual.appendChild(link);
	content.appendChild(manual);
	return content;
}

/**
 * Makes the overview content
 * @returns {Element}
 */
function makeHelpOverview() {
	const content = makeElement({
		innerHTML: `
		<h1>Help</h1>
		<p>
			ANY-INK is built on Glyphr Studio v2, so the upstream help site still
			covers the shared editing features: pen and pointer tools, components,
			ligatures, import, and export.
			<br>
			<a href="https://www.glyphrstudio.com/help" target="_blank">glyphrstudio.com/help</a>
		</p>
		<br>

	`,
	});

	return content;
}

/**
 * Makes the keyboard shortcut table content
 * @returns {Element}
 */
export function makeKeyboardShortcutReference() {
	const outputMarkdownToConsole = true;
	let table = makeElement({ className: 'keyboardShortcutTable' });

	function makeOneRow(combo, description, options = {}) {
		let row = `<span>`;
		combo.forEach((key, i) => {
			if (options.spacer && i > 0) row += `<span class="spacer">${options.spacer}</span>`;
			if (options.classes && options.classes[i]) {
				row += `<code class="${options.classes[i]}">${key}</code>`;
			} else if (i === combo.length - 1 && options.toolIconAction) {
				// if (options.toolIconAction === 'rotate') {
				if (cursors[options.toolIconAction]) {
					row += `<img src='${cursors[options.toolIconAction].substring(
						5,
						cursors[options.toolIconAction].length - 19
					)}'/>`;
				} else {
					row += makeToolButtonSVG({ name: options.toolIconAction });
				}
				row += `<i>${key}</i>`;
			} else {
				row += `<code>${key}</code>`;
			}
		});
		row += `</span>`;

		if (options.toolIconDescription) {
			row += `<label>&emsp;`;
			row += makeToolButtonSVG({ name: options.toolIconDescription });
			row += description;
			row += `</label >`;
		} else {
			row += `<label>${description}</label>`;
		}

		table.innerHTML += row;
		if (outputMarkdownToConsole) makeOneMarkdownRow(combo, description, options);
	}

	function makeOneHeader(text) {
		table.appendChild(textToNode(`<h3>${text}</h3>`));
		if (outputMarkdownToConsole) makeOneMarkdownHeader(text);
	}

	// Project actions
	// ANY-INK (B5, UX-BEGINNER 7.6): Ctrl+O opens a saved project file in both modes
	makeOneHeader('Project actions');
	makeOneRow(['Ctrl', 'S'], 'Save the project file (.gs2)');
	makeOneRow(['Ctrl', 'E'], 'Export an OTF Font (.otf)');
	makeOneRow(['Ctrl', 'G'], 'Export an SVG Font (.svg)');
	makeOneRow(['Ctrl', 'O'], 'Open a saved project file (.gs2)');

	// Selecting and navigating
	makeOneHeader('Selecting and navigating');
	makeOneRow(
		['Ctrl', '.'],
		`Navigate to the next Item (Character, Ligature, Component, or Kern Group)`
	);
	makeOneRow(
		['Ctrl', ','],
		`Navigate to the previous Item (Character, Ligature, Component, or Kern Group)`
	);
	makeOneRow(['Ctrl', 'A'], `Resize (Arrow) tool: Select all shapes`);
	makeOneRow(['Ctrl', 'A'], `Path Edit (Pen) tool: Select all path points`);
	makeOneRow(['Ctrl', 'Shift', 'A'], `Clear all shape and path point selections`);
	makeOneRow([']'], `Select next shape`);
	makeOneRow(['Shift', ']'], `Add the next shape to the selection (multi-select)`);
	makeOneRow(['['], `Select previous shape`);
	makeOneRow(['Shift', '['], `Add the previous shape to the selection (multi-select)`);
	makeOneRow(
		['Ctrl', 'Click a shape'],
		`Toggle selection for that shape (multi-select)<br>Either on the edit canvas, or the layers panel`,
		{ toolIconAction: 'arrowSquare' }
	);
	makeOneRow(['Ctrl', '➝'], `Select the next Path Point`, { classes: [false, 'arrow-key'] });
	makeOneRow(['Ctrl', 'Shift', '➝'], `Add the next Path Point to the selection (multi-select)`, {
		classes: [false, false, 'arrow-key'],
	});
	makeOneRow(['Ctrl', '⭠'], `Select the previous Path Point`, { classes: [false, 'arrow-key'] });
	makeOneRow(
		['Ctrl', 'Shift', '⭠'],
		`Add the previous Path Point to the selection (multi-select)`,
		{ classes: [false, false, 'arrow-key'] }
	);
	makeOneRow(
		['Ctrl', 'Click a path point'],
		`Toggle selection for that path point (multi-select)`,
		{ toolIconAction: 'penSquare' }
	);

	makeOneRow(['Esc'], `Close all dialogs`);

	// View
	makeOneHeader('View');
	makeOneRow(['Space', 'Scroll wheel click'], `Toggle the pan tool`, { spacer: 'or' });
	makeOneRow(['Ctrl', 'Scroll wheel'], `Zoom in and out`);
	makeOneRow(['Ctrl', '+'], `Zoom in`);
	makeOneRow(['Ctrl', '-'], `Zoom out`);
	makeOneRow(['Ctrl', '0'], `Auto-fit glyph on the screen`);
	makeOneRow(['Ctrl', 'Space'], `Toggle distraction free preview mode`);

	// Editing
	makeOneHeader('Editing');
	makeOneRow(['Ctrl', 'C'], `Copy the selected shapes`);
	makeOneRow(
		['Ctrl', 'V'],
		`Paste the selected shapes (ANY-INK clipboard)<br>Paste to import copied SVG Code (Operating System Clipboard)`
	);
	makeOneRow(['Ctrl', 'Z'], `Undo the last action. If the previous action was on a different item, undo navigates to the previously changed item without undoing the change.`);
	makeOneRow(['Ctrl', 'Y'], `Redo (Undo the last Undo action)`);
	makeOneRow(['Ctrl', 'Shift', 'Z'], `Redo (Undo the last Undo action)`);
	makeOneRow(['Ctrl', ']'], `Move shape up`);
	makeOneRow(['Ctrl', '['], `Move shape down`);
	makeOneRow(['Ctrl', 'Shift', ']'], `Move shape to the top`);
	makeOneRow(['Ctrl', 'Shift', '['], `Move shape to the bottom`);
	makeOneRow(['Delete', 'Backspace'], `Delete the selected shapes or path points`, {
		spacer: 'or',
	});
	makeOneRow(
		['⭠', '⭡', '➝', '⭣'],
		`Nudge the selected shape or path point <span class="number">1em</span><br>Press <code>Shift</code> to nudge <span class="number">10em</span>`,
		{ classes: ['arrow-key', 'arrow-key', 'arrow-key', 'arrow-key'] }
	);
	makeOneRow(['Shift', 'Resize shape'], `Maintain aspect ratio`, {
		toolIconAction: 'arrow',
	});
	makeOneRow(['Shift', 'Drag shape'], `Snap shape movement to horizontal or vertical`, {
		toolIconAction: 'arrowSquare',
	});
	makeOneRow(['Shift', 'Drag path point'], `Snap point movement to horizontal or vertical`, {
		toolIconAction: 'penSquare',
	});
	makeOneRow(['Shift', 'Drag handle'], `Maintain original handle angle`, {
		toolIconAction: 'penCircle',
	});
	makeOneRow(['Ctrl', 'Shift', 'Drag handle'], `Snap handle movement to horizontal or vertical`, {
		toolIconAction: 'penCircle',
	});
	makeOneRow(['Shift', 'Shape Rotation handle'], 'Snap rotation degrees to whole numbers', {
		toolIconAction: 'rotate',
	});
	makeOneRow(
		['Ctrl', 'R'],
		'Round values for the current selection<br>(Whole Shapes for the Resize tool, Path Points + Handles for the Path Edit tool)'
	);
	makeOneRow(['Shift', 'Click'], `Snap the new point's coordinates to whole numbers`, {
		toolIconAction: 'newPath',
	});
	makeOneRow(['Shift', 'Click'], `Snap the new point's coordinates to whole numbers`, {
		toolIconAction: 'pathAddPoint',
	});
	makeOneRow(['Ctrl', 'Click'], 'Add the new point as a corner point with hidden handles', {
		toolIconAction: 'pathAddPoint',
	});

	// Tools
	// ANY-INK (B4 + B5 finalize, UX-BEGINNER 7.6): the tool keys as keys.js has them in All tools
	// (P is the New Path tool and E the Path Edit tool in both modes), in Glyphr Studio's words
	makeOneHeader('Tools');
	keysShown({ mode: 'all' })
		.filter((key) => key.action === 'selectTool' && TOOL_ROWS[key.tool])
		.sort((a, b) => TOOL_ORDER.indexOf(a.tool) - TOOL_ORDER.indexOf(b.tool))
		.forEach((key) =>
			makeOneRow(key.keys, TOOL_ROWS[key.tool], { spacer: 'or', toolIconDescription: key.tool })
		);

	if (outputMarkdownToConsole) console.log(markdownOutput);
	return table;
}

/** ANY-INK (B4 + B5 finalize): the Tools rows' words and order, as Glyphr Studio had them */
const TOOL_ROWS = {
	pathEdit: 'Select the Path Edit (Pen) tool',
	resize: 'Select the Resize (Arrow) tool',
	newRectangle: 'Select the New Rectangle tool',
	newOval: 'Select the New Oval tool',
	newPath: 'Select the New Path tool',
	pathAddPoint: 'Select the Path Add Point tool',
};
const TOOL_ORDER = Object.keys(TOOL_ROWS);

let markdownOutput = '';
function makeOneMarkdownRow(combo, description, options = {}) {
	let row = `| `;
	combo.forEach((key, i) => {
		if (options.spacer && i > 0) row += ` ${options.spacer} `;
		if (i === combo.length - 1 && options.toolIconAction) {
			row += `_\`${key}\`_ `;
		} else {
			row += `\` ${key} \` `;
		}
	});
	row += ` | `;
	if (options.toolIconAction) row += `[${toolNames[options.toolIconAction]}] `;
	row += ` ${description}`;
	row += ` |\n`;

	markdownOutput += row;
}

function makeOneMarkdownHeader(text, first = false) {
	if (!first) markdownOutput += `\n\n`;
	markdownOutput += `### ${text}\n`;
	markdownOutput += `| Key combination | Description |\n| --- | --- |\n`;
}

const toolNames = {
	resize: 'Resize (Arrow) Tool',
	arrow: 'Resize (Arrow) Tool',
	arrowSquare: 'Resize (Arrow) Tool - hovering over a shape',
	pathEdit: 'Path Edit (Pen) Tool',
	penCircle: 'Path Edit (Pen) Tool - hovering over a handle',
	penSquare: 'Path Edit (Pen) Tool - hovering over a path point',
	newPath: 'New Path Tool',
	pathAddPoint: 'Path Add Point Tool',
	rotate: 'Shape Rotate Handle',
};
