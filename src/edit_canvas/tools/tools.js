// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import '../../anyink/letter/tool_labels.css';
import { notePickedTool } from '../../anyink/nib/default_tool.js';
import { fineTuneShows, isLetterViewOn } from '../../anyink/letter/view_switches.js';
import { collectGuideLines, HIT_ZONE_PX, hitTestLines } from '../../anyink/metrics/hit_test.js';
import { toolKey } from '../../anyink/mode/keys.js';
import { toolTitle, viewToolTitle } from '../../anyink/mode/simple_labels.js';
import { entryOf, isShown, simplePlace } from '../../anyink/mode/visibility.js';
import { hasWord, word } from '../../anyink/words/words.js';
import { getCanvasTheme, toggleCanvasTheme } from '../../anyink/theme/theme.js';
import { refreshPanel } from '../../panels/panels.js';
import { getCurrentProject, getCurrentProjectEditor } from '../../app/main.js';
import { addAsChildren, makeElement } from '../../common/dom.js';
import { round, valuesAreClose } from '../../common/functions.js';
import { drawShape } from '../../display_canvas/draw_paths.js';
import { ComponentInstance } from '../../project_data/component_instance.js';
import { Glyph } from '../../project_data/glyph.js';
import { Path } from '../../project_data/path.js';
import { closePopOutWindow, openPopOutWindow } from '../../project_editor/pop_out_window.js';
import { updateCursor } from '../cursors.js';
import { cXsX, cYsY } from '../edit_canvas.js';
import { stopCreatingNewPath } from './new_path.js';

// --------------------------------------------------------------
// Making tool buttons
// --------------------------------------------------------------
/**
 * Makes the tools buttons
 * @returns {Array}
 */
export function makeEditToolsButtons() {
	// log('makeEditToolsButtons', 'start');
	const editor = getCurrentProjectEditor();

	if (!editor.nav.isOnEditCanvasPage) {
		// log('returning, !isOnEditCanvasPage');
		// log('makeEditToolsButtons', 'end');
		return [];
	}

	if (!editor.selectedItemID) {
		// log('returning, !selectedItemID');
		// log('makeEditToolsButtons', 'end');
		return [];
	}

	// ANY-INK (B5): a tool this mode hides can't stay picked (Add a point, after More tools)
	if (!toolShown(editor.selectedTool)) editor.selectedTool = 'resize';

	// All the various permutations of states
	// log(`editor.selectedTool: ${editor.selectedTool}`);

	// Button data
	let toolButtonData = {
		// ANY-INK (B8): the Brush, shown in both modes once 'brush' is on (visibility.js, 7.6)
		nib: { title: 'Brush', disabled: false },
		newRectangle: { title: 'New rectangle', disabled: false },
		newOval: { title: 'New oval', disabled: false },
		newPath: { title: 'New path', disabled: false },
		pathAddPoint: { title: 'Add path point', disabled: false },
		pathEdit: { title: 'Path edit', disabled: false },
		resize: { title: 'Resize', disabled: false },
	};

	// Disable pen and add path point buttons for certain conditions
	const hasComponentInstance = editor.multiSelect.shapes.contains('ComponentInstance');

	if (editor.selectedTool !== 'pathEdit' && hasComponentInstance) {
		toolButtonData.pathEdit.disabled = true;
	}

	if (editor.selectedTool !== 'pathAddPoint' && hasComponentInstance) {
		toolButtonData.pathAddPoint.disabled = true;
	}

	if (editor.multiSelect.shapes.count > 1) {
		toolButtonData.pathAddPoint.disabled = true;
	}

	// ANY-INK (B7, UX-BEGINNER 4.3 Tools): the Simple letter view labels each tool and groups
	// the ones inside Fine-tune; everywhere else the column is drawn as upstream draws it
	const labeled = isLabeledToolColumn(editor);

	// Make all the new buttons
	let toolButtonElements = {};

	Object.keys(toolButtonData).forEach((buttonName) => {
		// log(`buttonName: ${buttonName}`);

		let isSelected = editor.selectedTool === buttonName;

		let newToolButton = makeElement({
			tag: 'button',
			// ANY-INK (B4 + B5 integration): Simple says the tool's house word and key
			title: toolTitle(buttonName, toolButtonData[buttonName].title),
			className: labeled ? `editor-page__tool ${LABELED_CLASS}` : 'editor-page__tool',
			// ANY-INK: found by its id, never by its words (which differ by mode)
			attributes: {
				'data-anyink-tool': buttonName,
				...(labeled && isFineTuneTool(buttonName) ? { 'data-anyink-tool-group': 'fineTune' } : {}),
			},
			innerHTML: toolButtonContent(buttonName, {
				selected: isSelected,
				disabled: toolButtonData[buttonName].disabled,
				labeled,
			}),
		});

		newToolButton.addEventListener('click', () => selectTool(buttonName));

		if (isSelected) newToolButton.classList.add('editor-page__tool-selected');

		editor.subscribe({
			topic: 'whichToolIsSelected',
			subscriberID: `tools.${buttonName}`,
			callback: (newSelectedTool) => {
				let isSelected = newSelectedTool === buttonName;
				newToolButton.classList.toggle('editor-page__tool-selected', isSelected);
				newToolButton.innerHTML = toolButtonContent(buttonName, {
					selected: isSelected,
					labeled,
				});
			},
		});

		toolButtonElements[buttonName] = newToolButton;
	});

	if (labeled) return labeledToolColumn(editor, toolButtonElements);

	// Put it all together
	let content = [];

	const onGlyphEditPage = editor.nav.page === 'Characters';
	const onComponentPage = editor.nav.page === 'Components';
	const onLigaturesPage = editor.nav.page === 'Ligatures';
	const selectedItem = editor.selectedItem;

	if (onGlyphEditPage || onLigaturesPage) {
		content.push(toolButtonElements.newRectangle);
		content.push(toolButtonElements.newOval);
		content.push(toolButtonElements.newPath);
		// ANY-INK (B8): the Brush after upstream's drawing tools, so theirs keep their places
		// (hidden below while 'brush' is off)
		content.push(toolButtonElements.nib);
	}

	if (onComponentPage && selectedItem && !selectedItem.pathPoints) {
		content.push(toolButtonElements.newRectangle);
		content.push(toolButtonElements.newOval);
		content.push(toolButtonElements.newPath);
		content.push(toolButtonElements.nib);
	}

	if (onGlyphEditPage || onComponentPage || onLigaturesPage) {
		content.push(toolButtonElements.pathAddPoint);
		content.push(makeElement({ tag: 'div', style: 'height: 20px;' }));
		content.push(toolButtonElements.pathEdit);
		content.push(toolButtonElements.resize);
	}

	// ANY-INK (B5, UX-BEGINNER 6.2 Tools): only the tools the mode shows (Simple: no Add a point)
	const hidden = new Set(
		Object.keys(toolButtonElements)
			.filter((buttonName) => !isShown('tool', buttonName))
			.map((buttonName) => toolButtonElements[buttonName])
	);

	// log('makeEditToolsButtons', 'end');
	return content.filter((element) => !hidden.has(element));
}

// --------------------------------------------------------------
// ANY-INK (B7): the Simple letter view's tool column
// --------------------------------------------------------------
/*
	UX-BEGINNER.md 4.3 Tools: "icon with the word under it and the key in small print". The
	Brush (B8) and Select always show; Edit points, Point pen, Rectangle and Oval (visibility.js
	place 'fineTune') show while "Fine-tune this letter" is open (letter/view_switches.js
	fineTuneShows('tools'), which publishes 'editCanvasView' when it opens or closes). The tool
	that is picked always shows, so a key that picks a Fine-tune tool never picks something
	hidden. The Point pen says how it works under its word: "click to place points". Words come
	from words.js (tool.* and letterTools.caption.*), keys from keys.js; the look is
	letter/tool_labels.css. Upstream's order and icons stay everywhere else.
*/

/** The class of a labeled tool button (letter/tool_labels.css) */
const LABELED_CLASS = 'anyink-tool--labeled';
/** The tools that always show in the letter view, in order (the Brush comes with B8) */
const ALWAYS_TOOLS = Object.freeze(['nib', 'resize']);
/** Fine-tune's tools, in the order 4.3 lists them */
const FINE_TUNE_TOOLS = Object.freeze(['pathEdit', 'newPath', 'newRectangle', 'newOval']);

/**
 * @param {Object} editor - ProjectEditor
 * @returns {Boolean} true on the Simple letter view (once 'letterView' has landed)
 */
function isLabeledToolColumn(editor) {
	return isLetterViewOn() && editor?.nav?.page === 'Characters';
}

/**
 * @param {String} tool
 * @returns {Boolean} true for a tool Simple keeps inside Fine-tune
 */
function isFineTuneTool(tool) {
	return simplePlace('tool', tool) === 'fineTune';
}

/**
 * A tool button's inside: upstream's icon, and in the letter view its word, the Point pen's
 * caption and its key.
 * @param {String} tool
 * @param {Object} options
 * @param {Boolean} [options.selected]
 * @param {Boolean} [options.disabled]
 * @param {Boolean} [options.labeled]
 * @returns {String} HTML
 */
function toolButtonContent(tool, { selected = false, disabled = false, labeled = false } = {}) {
	const icon = makeToolButtonSVG({ name: tool, selected, disabled });
	if (!labeled || !hasWord(`tool.${tool}`)) return icon;
	const caption = hasWord(`letterTools.caption.${tool}`)
		? `<span class="anyink-tool__caption">${escapeText(word(`letterTools.caption.${tool}`))}</span>`
		: '';
	const key = toolKey(tool);
	const keyPrint = key ? `<span class="anyink-tool__key">${escapeText(key)}</span>` : '';
	return `${icon}<span class="anyink-tool__word">${escapeText(word(`tool.${tool}`))}</span>${caption}${keyPrint}`;
}

/**
 * @param {String} text
 * @returns {String} safe inside HTML
 */
function escapeText(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * The letter view's column: the tools that always show, a rule, then Fine-tune's tools, each
 * shown or hidden as Fine-tune opens and closes and as the picked tool changes.
 * @param {Object} editor - ProjectEditor
 * @param {Object<String, HTMLElement>} toolButtonElements - by tool name
 * @returns {Array<HTMLElement>}
 */
function labeledToolColumn(editor, toolButtonElements) {
	const pick = (list) =>
		list.filter((tool) => toolButtonElements[tool] && isShown('tool', tool));
	const always = pick(ALWAYS_TOOLS).map((tool) => toolButtonElements[tool]);
	const fineTune = pick(FINE_TUNE_TOOLS.filter(isFineTuneTool)).map((tool) => [
		tool,
		toolButtonElements[tool],
	]);
	const rule = makeElement({
		tag: 'div',
		className: 'anyink-tool-rail__rule',
		attributes: { 'aria-hidden': 'true' },
	});

	const update = () => {
		const open = fineTuneShows('tools');
		let anyShown = false;
		fineTune.forEach(([tool, button]) => {
			const shown = open || editor.selectedTool === tool;
			button.hidden = !shown;
			anyShown = anyShown || shown;
		});
		rule.hidden = !anyShown;
	};
	update();

	editor.subscribe({
		topic: ['editCanvasView', 'whichToolIsSelected'],
		subscriberID: 'anyink.toolRail.fineTune',
		callback: update,
	});

	return [...always, rule, ...fineTune.map(([, button]) => button)];
}

/**
 * Makes the view control buttons
 * @returns {Array} - an array of Elements
 */
export function makeViewToolsButtons() {
	// log(`makeViewToolsButtons`, 'start');

	// Button data
	let viewButtonTitles = {
		displayMode: 'Toggle fill / outline display mode',
		canvasTheme: 'Paper / slate',
		pan: 'Pan the edit canvas',
		zoom1to1: 'Zoom so 1 pixel = 1 em',
		zoomEm: 'Zoom to fit a full Em',
		zoomIn: 'Zoom in 10%',
		zoomOut: 'Zoom out 10%',
	};

	let viewButtonElements = {};
	const editor = getCurrentProjectEditor();
	const displayMode = getCurrentProject().settings.app.canvasDisplayModeFilled;

	Object.keys(viewButtonTitles).forEach((buttonName) => {
		// log(`buttonName: ${buttonName}`);

		let isSelected = editor.selectedTool === buttonName;
		let buttonNameSVG = buttonName;
		if (buttonName === 'displayMode') {
			if (displayMode) buttonNameSVG = 'displayModeFilled';
			else buttonNameSVG = 'displayModeOutlined';
		}
		if (buttonName === 'canvasTheme') buttonNameSVG = canvasThemeIconName();
		let newToolButton = makeElement({
			tag: 'button',
			className: 'editor-page__tool',
			// ANY-INK (B4 + B5 integration): Simple says the switch's house word
			title: viewToolTitle(buttonName, viewButtonTitles[buttonName]),
			attributes: { 'data-anyink-view-tool': buttonName },
			innerHTML: makeToolButtonSVG({
				name: buttonNameSVG,
				selected: isSelected,
			}),
		});
		newToolButton.addEventListener('click', () => selectTool(buttonName));

		if (isSelected) newToolButton.classList.add('editor-page__tool-selected');

		if (buttonName === 'pan') {
			editor.subscribe({
				topic: 'whichToolIsSelected',
				subscriberID: `tools.${buttonName}`,
				callback: (newSelectedTool) => {
					let isSelected = newSelectedTool === buttonName;
					newToolButton.classList.toggle('editor-page__tool-selected', isSelected);
					newToolButton.innerHTML = makeToolButtonSVG({ name: buttonName, selected: isSelected });
				},
			});
		}

		if (buttonName === 'displayMode') {
			editor.subscribe({
				topic: 'editCanvasView',
				subscriberID: `tools.displayMode`,
				callback: () => {
					let buttonSVG = 'displayModeOutlined';
					const displayMode = getCurrentProject().settings.app.canvasDisplayModeFilled;
					if (displayMode) buttonSVG = 'displayModeFilled';
					newToolButton.innerHTML = makeToolButtonSVG({ name: buttonSVG, selected: false });
				},
			});
		}

		if (buttonName === 'canvasTheme') {
			editor.subscribe({
				topic: 'editCanvasView',
				subscriberID: `tools.canvasTheme`,
				callback: () => {
					newToolButton.innerHTML = makeToolButtonSVG({
						name: canvasThemeIconName(),
						selected: false,
					});
				},
			});
		}

		viewButtonElements[buttonName] = newToolButton;
	});

	// zoom slider with a small readout
	const zoomMin = 5;
	const zoomMax = 400;
	let zoomReadoutNumber = 100;
	let view = editor.view;
	if (view) zoomReadoutNumber = round(view.dz * 100, 2);

	let zoomReadout = makeElement({
		tag: 'span',
		className: 'editor-page__zoom-readout',
		title: 'Zoom level',
	});
	const zoomSlider = makeElement({
		tag: 'input',
		className: 'editor-page__zoom-slider',
		title: 'Zoom level',
		attributes: { type: 'range', min: `${zoomMin}`, max: `${zoomMax}`, step: '1' },
	});
	zoomSlider.setAttribute('value', `${zoomReadoutNumber}`);
	const zoomValue = makeElement({
		tag: 'span',
		className: 'editor-page__zoom-value',
		content: `${zoomReadoutNumber}%`,
	});
	addAsChildren(zoomReadout, [zoomSlider, zoomValue]);

	zoomSlider.addEventListener('input', () => {
		const editor = getCurrentProjectEditor();
		// @ts-expect-error 'property does exist'
		const percent = Math.max(zoomMin, Math.min(zoomMax, parseFloat(zoomSlider.value)));
		const currentZoom = editor.view.dz;
		const wrapper = editor.editCanvas?.parentElement;
		if (wrapper && currentZoom) {
			// Zoom about the middle of the visible canvas so the glyph stays put
			editor.updateViewZoom(percent / 100 / currentZoom, {
				x: wrapper.clientWidth / 2,
				y: wrapper.clientHeight / 2,
			});
		} else {
			editor.setViewZoom(percent);
		}
	});

	editor.subscribe({
		topic: 'editCanvasView',
		subscriberID: 'tools.zoomReadout',
		callback: (newView) => {
			let zoomReadoutNumber = round(newView.dz * 100, 2);
			zoomSlider.setAttribute('value', '' + zoomReadoutNumber);
			// @ts-expect-error 'property does exist'
			zoomSlider.value = `${zoomReadoutNumber}`;
			zoomValue.innerHTML = `${zoomReadoutNumber}%`;
		},
	});

	// Live Preview pop-out
	let isPoppedOut = editor.popOutWindow !== false;
	let livePreviewPopOut = makeElement({
		tag: 'button',
		className: 'editor-page__tool',
		id: 'editor-page__tool__open-live-preview-pop-out',
		title: 'Pop out a Live Preview window',
		innerHTML: makeToolButtonSVG({
			name: isPoppedOut ? 'closeLivePreview' : 'openLivePreview',
			selected: false,
		}),
	});
	livePreviewPopOut.addEventListener('click', () => {
		// log(`Live Preview Pop Out CLICK HANDLER`, 'start');
		// log(`editor.popOutWindow: ${editor.popOutWindow}`);
		if (editor.popOutWindow === false) openPopOutWindow();
		else closePopOutWindow();
		// log(`Live Preview Pop Out CLICK HANDLER`, 'end');
	});

	// ANY-INK (B5, UX-BEGINNER 6.2 Tools): only the view tools the mode shows (Simple: no Pan
	// button, Actual size or live preview pop-out; Space-drag still pans), by their ids in
	// visibility.js's 'viewTool' area
	const viewToolIDs = new Map(
		Object.entries(viewButtonElements).map(([buttonName, element]) => [element, buttonName])
	);
	viewToolIDs.set(zoomReadout, 'zoomSlider');
	viewToolIDs.set(livePreviewPopOut, 'livePreviewPopOut');
	const viewShown = (element) =>
		!viewToolIDs.has(element) || isShown('viewTool', viewToolIDs.get(element));

	// Put it all together
	let responsiveGroup = makeElement({ className: 'editor-page__responsive-group' });

	// Seven grid columns: the paper / slate toggle takes the leading spacer's slot
	addAsChildren(
		responsiveGroup,
		[
			viewButtonElements.zoomOut,
			zoomReadout,
			viewButtonElements.zoomIn,
			makeElement({ tag: 'div', content: '&emsp;' }),
			viewButtonElements.displayMode,
			viewButtonElements.canvasTheme,
			viewButtonElements.zoom1to1,
		].filter(viewShown)
	);

	// log(`makeViewToolsButtons`, 'end');
	return [
		viewButtonElements.pan,
		responsiveGroup,
		viewButtonElements.zoomEm,
		livePreviewPopOut,
	].filter(viewShown);
}

/**
 * Event handler for clicking a tool button
 * @param {String} tool - which tool was clicked
 */
export function selectTool(tool) {
	// log('selectTool', 'start');
	// ANY-INK (B5, UX-BEGINNER 6.3): a tool the mode hides can't be picked, however it is asked
	if (!toolShown(tool)) return;
	const editor = getCurrentProjectEditor();
	let viewTools = ['zoom1to1', 'zoomEm', 'zoomIn', 'zoomOut', 'displayMode', 'canvasTheme'];

	if (viewTools.includes(tool)) {
		if (tool === 'zoom1to1') editor.view = { dz: 1 };
		if (tool === 'zoomEm') editor.autoFitView();
		if (tool === 'zoomIn') editor.view = { dz: (editor.view.dz *= 1.1) };
		if (tool === 'zoomOut') editor.view = { dz: (editor.view.dz *= 0.9) };
		if (tool === 'displayMode') {
			const appSettings = getCurrentProject().settings.app;
			appSettings.canvasDisplayModeFilled = !appSettings.canvasDisplayModeFilled;
			// log(`canvasDisplayModeFilled: ${appSettings.canvasDisplayModeFilled}`);
		}
		if (tool === 'canvasTheme') {
			// Flips html[data-canvas]; the edit canvas also redraws through onThemeChange
			toggleCanvasTheme();
			// Guide swatches in the Guides panel are drawn from the canvas tokens; redraw them too.
			if (getCurrentProjectEditor().nav.panel === 'Guides') refreshPanel();
		}
		editor.publish('editCanvasView', editor.view);
	} else {
		switchToolTo(tool);
		updateCursor();
	}

	if (tool === 'resize') editor.multiSelect.points.clear();

	if (tool === 'newPath') {
		editor.multiSelect.points.clear();
		editor.multiSelect.shapes.clear();
	} else {
		stopCreatingNewPath();
	}

	// log('selectTool', 'end');
}

/**
 * ANY-INK (B5, UX-BEGINNER 6.2 Tools): the drawing tools (visibility.js 'tool' area: Add a
 * point and the Kerning tool are More tools only) are gated by the mode. Anything else selectTool
 * takes (the view buttons, 'pan' for Space-drag) is filtered where its button is drawn, so it
 * passes here.
 * @param {String} tool
 * @returns {Boolean}
 */
export function toolShown(tool) {
	return entryOf('tool', tool) ? isShown('tool', tool) : true;
}

/**
 * Which icon the paper / slate button shows: the surface the canvas is on now
 * @returns {String} - icon name
 */
function canvasThemeIconName() {
	return getCanvasTheme() === 'dark' ? 'canvasThemeSlate' : 'canvasThemePaper';
}

/**
 * Handle switching the tool on the current Editor
 * @param {String} newTool - which tool to switch to
 */
export function switchToolTo(newTool) {
	// log(`switchToolTo`, 'start');
	// log(`newTool: ${newTool}`);
	// ANY-INK (B5): the same gate as selectTool
	if (!toolShown(newTool)) return;

	const editor = getCurrentProjectEditor();
	editor.selectedTool = newTool;
	// ANY-INK (B8 + B9 integration): a pick of his own; the Brush a letter opened with is his
	// from now on (nib/default_tool.js), told before anyone hears the pick
	notePickedTool(editor);
	editor.publish('whichToolIsSelected', newTool);
	// log(`switchToolTo`, 'end');
}

/**
 * Makes the Kern Tool button
 * @returns {Element}
 */
export function makeKernToolButton() {
	// Kern
	const editor = getCurrentProjectEditor();
	const kernToolButton = makeElement({
		tag: 'button',
		className: 'editor-page__tool editor-page__tool-selected',
		title: 'Adjust kern value',
		innerHTML: makeToolButtonSVG({
			name: 'kern',
			selected: true,
		}),
	});

	kernToolButton.addEventListener('click', () => selectTool('kern'));

	editor.subscribe({
		topic: 'whichToolIsSelected',
		subscriberID: `tools.kern`,
		callback: (newSelectedTool) => {
			let isSelected = newSelectedTool === 'kern';
			kernToolButton.classList.toggle('editor-page__tool-selected', isSelected);
			kernToolButton.innerHTML = makeToolButtonSVG({ name: 'kern', selected: isSelected });
		},
	});
	return kernToolButton;
}

// --------------------------------------------------------------
// Button helper functions
// --------------------------------------------------------------

/**
 * Adds a given path to the current work item
 * @param {Path} newPath - Path to add
 * @returns {Path} - Path that was added, with updated properties
 */
export function addPathToCurrentItem(newPath) {
	// log(`addPathToCurrentItem`, 'start');
	// log(`name: ${ewPath.name}`);
	// log(`objType: ${ewPath?.objType}`);

	const editor = getCurrentProjectEditor();
	if (newPath) {
		if (newPath?.objType === 'ComponentInstance') {
			// log(`is a Component instance`);
			editor.selectedTool = 'pathEdit';
		} else if (newPath && editor.selectedTool === 'pathEdit') {
			// log(`triggered as true: newPath && editor.selectedTool == pathEdit \n\t NOT calling calcmaxes, okay?`);
		}
	} else {
		// log(`passed null, creating new path.`);
		newPath = new Path({});
		newPath.name = 'Rectangle ' + (editor.selectedItem.shapes.length * 1 + 1);
	}

	const result = editor.selectedItem.addOneShape(newPath);

	checkForFirstShapeAutoRSB();

	// log(`returns: ${result.name}`);
	// log(`addPathToCurrentItem`, 'end');
	return result;
}

/**
 * For projects that have 'autoRightBearingOnFirstShape' set,
 * check if the current item has one shape, and if so, set the
 * right side bearing to that value.
 */
export function checkForFirstShapeAutoRSB() {
	const editor = getCurrentProjectEditor();
	const selectedItem = editor.selectedItem;
	if (selectedItem?.objType === 'Glyph' || selectedItem?.objType === 'Ligature') {
		const autoRSB = editor.project.settings.app.autoRightBearingOnFirstShape;
		if (selectedItem.shapes.length === 1 && selectedItem.advanceWidth === 0 && autoRSB > -1) {
			selectedItem.rightSideBearing = autoRSB;
		}
	}
}

/**
 * Looks through the selected Item's shapes and returns
 * a shape (or false) at the coordinate location
 * @param {Number} cx - x coordinate in canvas units
 * @param {Number} cy - y coordinate in canvas units
 * @returns {Object | Boolean}
 */
export function getShapeAtLocation(cx, cy) {
	// log(`getShapeAtLocation`, 'start');
	// log('checking cx:' + cx + ' cy:' + cy);

	let shape;
	const editor = getCurrentProjectEditor();
	let sws = editor.selectedItem?.shapes;
	if (!sws) return false;
	// log(sws);
	for (let j = sws.length - 1; j >= 0; j--) {
		shape = sws[j];
		// log('Checking shape ' + j);
		if (isShapeHere(shape, cx, cy)) {
			// log(`getShapeAtLocation`, 'end');
			return shape;
		}
	}

	// clickEmptySpace();
	// log(`getShapeAtLocation`, 'end');
	return false;
}

/**
 * Returns a true if a clicked x/y is on a shape
 * @param {Path | ComponentInstance} shape - shape to check
 * @param {Number} cx - clicked x value
 * @param {Number} cy - clicked y value
 * @returns {Boolean}
 */
export function isShapeHere(shape, cx, cy) {
	// log(`isShapeHere`, 'start');
	// log(`cx: ${cx} / cy: ${cy}`);
	let sx = cXsX(cx);
	let sy = cYsY(cy);
	// log(`sx: ${sx} / sy: ${sy}`);

	if (!shape.maxes.isPointInside(sx, sy)) {
		// log(`Outside maxes for this shape`);
		// log(`isShapeHere`, 'end');
		return false;
	}

	let g1 = 100;
	let g2 = 200;
	let ghc = document.createElement('canvas');
	ghc.width = shape.maxes.width + g2;
	ghc.height = shape.maxes.height + g2;
	let ctx = ghc.getContext('2d', {
		alpha: false,
		willReadFrequently: true,
	});
	let view = { dx: shape.maxes.xMin * -1 + g1, dy: shape.maxes.yMax + g1, dz: 1 };

	ctx.fillStyle = '#fff'; // pixel hit test, not visible
	ctx.fillRect(0, 0, shape.maxes.width + g2, shape.maxes.height + g2);

	ctx.beginPath();
	drawShape(shape, ctx, view);
	ctx.closePath();

	ctx.fillStyle = '#000'; // pixel hit test, not visible
	ctx.fill();

	let xTest = sx + view.dx;
	let yTest = view.dy - sy;
	let imageData = ctx.getImageData(xTest, yTest, 1, 1);

	// Visually debug
	// ctx.strokeStyle = 'lime';
	// ctx.strokeAlign = 'outside';
	// ctx.lineWidth = 4;
	// ctx.strokeRect(xTest - 10, yTest - 10, 20, 20);

	// log('red = ' + imageData.data[0] + '  returning: ' + (imageData.data[0] < 255));
	// log(`isShapeHere`, 'end');
	return imageData.data[0] < 255;
}

/**
 * Returns a true if an x/y point is near the edge of a shape
 * @param {Path | ComponentInstance} shape - shape to check
 * @param {Number} cx - clicked x value
 * @param {Number} cy - clicked y value
 * @param {Number} thickness - how close to the edge returns true
 * @returns {Boolean}
 */
export function isPointNearShapeEdge(shape, cx, cy, thickness = 10) {
	// log(`isPointNearShapeEdge`, 'start');
	// log(`cx: ${cx} / cy: ${cy}`);
	let sx = cXsX(cx);
	let sy = cYsY(cy);
	let sThickness = thickness / getCurrentProjectEditor().view.dz;
	// log(`sx: ${sx} / sy: ${sy}`);

	if (!shape.maxes.isPointInside(sx, sy, sThickness)) {
		// log(`Outside maxes for this shape`);
		// log(`isPointNearShapeEdge`, 'end');
		return false;
	}

	let g1 = 100;
	let g2 = 200;
	let ghc = document.createElement('canvas');
	ghc.width = shape.maxes.width + g2;
	ghc.height = shape.maxes.height + g2;
	let ctx = ghc.getContext('2d', {
		alpha: false,
		willReadFrequently: true,
	});
	let view = { dx: shape.maxes.xMin * -1 + g1, dy: shape.maxes.yMax + g1, dz: 1 };

	ctx.fillStyle = '#fff'; // pixel hit test, not visible
	ctx.fillRect(0, 0, shape.maxes.width + g2, shape.maxes.height + g2);

	ctx.beginPath();
	drawShape(shape, ctx, view);
	ctx.closePath();

	ctx.strokeStyle = '#000'; // pixel hit test, not visible
	ctx.lineWidth = sThickness;
	ctx.fill();
	ctx.stroke();

	let xTest = sx + view.dx;
	let yTest = view.dy - sy;
	let imageData = ctx.getImageData(xTest, yTest, 1, 1);

	// log(`isPointNearShapeEdge`, 'end');
	return imageData.data[0] < 255;
}

/**
 * Detects if the mosue is over a side bearing
 * @param {Number} cx - canvas X value
 * @param {Number} cy - canvas Y value
 * @param {Glyph | Object} item - thing to get the side bearing from
 * @returns	{String | false} - 'lsb' or 'rsb'
 */
export function isSideBearingHere(cx, cy, item) {
	// log(`isSideBearingHere`, 'start');
	let sx = cXsX(cx);
	// let sy = cYsY(cy);
	// ANY-INK: the hit zone is HIT_ZONE_PX canvas pixels at any zoom (upstream used 7 Em)
	const target = HIT_ZONE_PX / getCurrentProjectEditor().view.dz;
	/** @type {String | false} */
	let result = false;

	if (Math.abs(sx) < target) result = 'lsb';
	if (item?.objType !== 'Component') {
		if (valuesAreClose(sx, item.advanceWidth, target)) result = 'rsb';
	}

	// log(`result: ${result}`);
	// log(`isSideBearingHere`, 'end');
	return result;
}

/**
 * ANY-INK (D-008): one hit test for every draggable line on the guides layer: the
 * horizontal metrics, the baseline, visible custom guides, and the two side bearings.
 * Same visibility rules and the same HIT_ZONE_PX zone the layer itself uses.
 * @param {Number} cx - canvas x in pixels
 * @param {Number} cy - canvas y in pixels
 * @param {Object} item - the item being edited (Glyph, Ligature, Component, or KernGroup)
 * @returns {String | false} line id ('ascent', 'xHeight', 'baseline', 'lsb', 'guide:0', ...) or false
 */
export function isMetricLineHere(cx, cy, item) {
	const editor = getCurrentProjectEditor();
	const lines = collectGuideLines({
		font: editor.project.settings.font,
		systemGuides: editor.systemGuides,
		guides: editor.project.settings.app.guides,
		item,
	});
	const hit = hitTestLines(lines, cx, cy, editor.view, HIT_ZONE_PX);
	return hit ? hit.id : false;
}

// --------------------------------------------------------------
// Tool button graphics
// --------------------------------------------------------------

let icons = {};

/**
 * Makes a SVG icon based on options
 * @param {Object} oa - options
 * @returns {String} - SVG code
 */
export function makeToolButtonSVG(oa) {
	// log(`makeToolButtonSVG`, 'start');
	// log(`oa.name: ${oa.name}`);
	// Outline pixels use currentColor; the svg sets color from a chrome token
	let colorOutline = 'var(--chrome-text-muted)';
	let colorFill = 'var(--chrome-bg-sunken)';
	let icon = icons[oa.name];

	if (oa.selected) {
		colorOutline = 'var(--touch)';
	} else if (oa.disabled) {
		colorOutline = 'var(--chrome-text-faint)';
		colorFill = 'transparent';
	}

	let innerHTML = '';
	if (icon.fill) {
		innerHTML += `
			<g pointer-events="none" style="fill: ${colorFill};">
			${icon.fill}
			</g>
		`;
	}

	innerHTML += `
		<g pointer-events="none" fill="currentColor">
		${icon.outline}
		</g>
	`;

	let content = `
		<svg
			version="1.1"
			xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
			x="0px" y="0px" width="20px" height="20px" viewBox="0 0 20 20"
			style="color: ${colorOutline};"
		>
			${innerHTML}
		</svg>
	`;

	// log(`makeToolButtonSVG`, 'end');
	return content;
}

// Arrow
icons.resize = {
	fill: `
		<rect x="11" y="14" width="1" height="4"></rect>
		<rect x="12" y="16" width="1" height="2"></rect>
		<rect x="9" y="12" width="1" height="2"></rect>
		<rect x="5" y="3" width="2" height="1"></rect>
		<rect x="10" y="7" width="1" height="9"></rect>
		<rect x="5" y="6" width="5" height="6"></rect>
		<rect x="12" y="9" width="1" height="3"></rect>
		<rect x="11" y="8" width="1" height="4"></rect>
		<rect x="14" y="11" width="1" height="1"></rect>
		<rect x="13" y="10" width="1" height="2"></rect>
		<rect x="5" y="15" width="1" height="1"></rect>
		<rect x="5" y="2" width="1" height="1"></rect>
		<rect x="5" y="14" width="2" height="1"></rect>
		<rect x="5" y="13" width="3" height="1"></rect>
		<rect x="5" y="4" width="3" height="1"></rect>
		<rect x="5" y="12" width="4" height="1"></rect>
		<rect x="5" y="5" width="4" height="1"></rect>
	`,
	outline: `
		<rect x="4" width="1" height="17"></rect>
		<rect x="5" y="1" width="1" height="1"></rect>
		<rect x="7" y="3" width="1" height="1"></rect>
		<rect x="6" y="2" width="1" height="1"></rect>
		<rect x="9" y="5" width="1" height="1"></rect>
		<rect x="8" y="4" width="1" height="1"></rect>
		<rect x="11" y="7" width="1" height="1"></rect>
		<rect x="10" y="6" width="1" height="1"></rect>
		<rect x="11" y="12" width="5" height="1"></rect>
		<rect x="12" y="8" width="1" height="1"></rect>
		<rect x="13" y="9" width="1" height="1"></rect>
		<rect x="14" y="10" width="1" height="1"></rect>
		<rect x="15" y="11" width="1" height="1"></rect>
		<rect x="11" y="18" width="2" height="1"></rect>
		<rect x="5" y="16" width="1" height="1"></rect>
		<rect x="6" y="15" width="1" height="1"></rect>
		<rect x="7" y="14" width="1" height="1"></rect>
		<rect x="8" y="13" width="1" height="1"></rect>
		<rect x="9" y="14" width="1" height="2"></rect>
		<rect x="10" y="16" width="1" height="2"></rect>
		<rect x="11" y="12" width="1" height="2"></rect>
		<rect x="12" y="14" width="1" height="2"></rect>
		<rect x="13" y="16" width="1" height="2"></rect>
	`,
};

// ANY-INK (B8): Brush, a felt-tip pen drawn on the same 20 px grid as upstream's icons
icons.nib = {
	fill: `
		<rect x="10" y="3" width="3" height="2"></rect>
		<rect x="9" y="5" width="4" height="2"></rect>
		<rect x="8" y="7" width="4" height="2"></rect>
		<rect x="7" y="9" width="4" height="2"></rect>
		<rect x="6" y="11" width="3" height="2"></rect>
	`,
	outline: `
		<rect x="11" y="1" width="3" height="1"></rect>
		<rect x="14" y="2" width="1" height="2"></rect>
		<rect x="13" y="4" width="1" height="3"></rect>
		<rect x="12" y="7" width="1" height="2"></rect>
		<rect x="11" y="9" width="1" height="2"></rect>
		<rect x="10" y="11" width="1" height="2"></rect>
		<rect x="9" y="13" width="1" height="1"></rect>
		<rect x="10" y="2" width="1" height="1"></rect>
		<rect x="9" y="3" width="1" height="2"></rect>
		<rect x="8" y="5" width="1" height="2"></rect>
		<rect x="7" y="7" width="1" height="2"></rect>
		<rect x="6" y="9" width="1" height="2"></rect>
		<rect x="5" y="11" width="1" height="2"></rect>
		<rect x="5" y="13" width="4" height="1"></rect>
		<rect x="4" y="14" width="2" height="2"></rect>
		<rect x="2" y="16" width="3" height="2"></rect>
		<rect x="1" y="17" width="2" height="2"></rect>
		<rect x="7" y="17" width="12" height="2"></rect>
	`,
};

// Pen Plus
icons.pathAddPoint = {
	fill: `
		<rect x="5" y="4" width="5" height="14"></rect>
		<rect x="10" y="8" width="2" height="6"></rect>
		<rect x="3" y="8" width="2" height="6"></rect>
	`,
	outline: `
		<rect id="MINUS_SHAPE" x="14" y="16" width="5" height="1"></rect>
		<rect id="PLUS_SHAPE" x="16" y="14" width="1" height="5"></rect>
		<rect x="4" y="16" width="1" height="3"></rect>
		<rect x="10" y="16" width="1" height="3"></rect>
		<rect x="7" y="1" width="1" height="12"></rect>
		<rect x="4" y="18" width="7" height="1"></rect>
		<rect x="4" y="16" width="7" height="1"></rect>
		<rect x="8" y="2" width="1" height="2"></rect>
		<rect x="9" y="4" width="1" height="2"></rect>
		<rect x="10" y="6" width="1" height="2"></rect>
		<rect x="3" y="8" width="1" height="2"></rect>
		<rect x="2" y="10" width="1" height="2"></rect>
		<rect x="12" y="10" width="1" height="2"></rect>
		<rect x="6" y="10" width="3" height="2"></rect>
		<rect x="3" y="12" width="1" height="2"></rect>
		<rect x="4" y="14" width="1" height="2"></rect>
		<rect x="6" y="2" width="1" height="2"></rect>
		<rect x="5" y="4" width="1" height="2"></rect>
		<rect x="4" y="6" width="1" height="2"></rect>
		<rect x="11" y="8" width="1" height="2"></rect>
		<rect x="11" y="12" width="1" height="2"></rect>
		<rect x="10" y="14" width="1" height="2"></rect>
	`,
};

// Pen Minus
icons.pathRemovePoint = {
	fill: `
		<rect x="5" y="4" width="5" height="14"></rect>
		<rect x="10" y="8" width="2" height="6"></rect>
		<rect x="3" y="8" width="2" height="6"></rect>
	`,
	outline: `
		<rect id="MINUS_SHAPE" x="14" y="16" width="5" height="1"></rect>
		<rect x="4" y="16" width="1" height="3"></rect>
		<rect x="10" y="16" width="1" height="3"></rect>
		<rect x="7" y="1" width="1" height="12"></rect>
		<rect x="4" y="18" width="7" height="1"></rect>
		<rect x="4" y="16" width="7" height="1"></rect>
		<rect x="8" y="2" width="1" height="2"></rect>
		<rect x="9" y="4" width="1" height="2"></rect>
		<rect x="10" y="6" width="1" height="2"></rect>
		<rect x="3" y="8" width="1" height="2"></rect>
		<rect x="2" y="10" width="1" height="2"></rect>
		<rect x="12" y="10" width="1" height="2"></rect>
		<rect x="6" y="10" width="3" height="2"></rect>
		<rect x="3" y="12" width="1" height="2"></rect>
		<rect x="4" y="14" width="1" height="2"></rect>
		<rect x="6" y="2" width="1" height="2"></rect>
		<rect x="5" y="4" width="1" height="2"></rect>
		<rect x="4" y="6" width="1" height="2"></rect>
		<rect x="11" y="8" width="1" height="2"></rect>
		<rect x="11" y="12" width="1" height="2"></rect>
		<rect x="10" y="14" width="1" height="2"></rect>
	`,
};

// Pen
icons.pathEdit = {
	fill: `
		<rect x="7" y="4" width="5" height="14"></rect>
		<rect x="12" y="8" width="2" height="6"></rect>
		<rect x="5" y="8" width="2" height="6"></rect>
	`,
	outline: `
		<rect x="6" y="16" width="1" height="3"></rect>
		<rect x="12" y="16" width="1" height="3"></rect>
		<rect x="9" y="1" width="1" height="12"></rect>
		<rect x="6" y="18" width="7" height="1"></rect>
		<rect x="6" y="16" width="7" height="1"></rect>
		<rect x="10" y="2" width="1" height="2"></rect>
		<rect x="11" y="4" width="1" height="2"></rect>
		<rect x="12" y="6" width="1" height="2"></rect>
		<rect x="5" y="8" width="1" height="2"></rect>
		<rect x="4" y="10" width="1" height="2"></rect>
		<rect x="14" y="10" width="1" height="2"></rect>
		<rect x="8" y="10" width="3" height="2"></rect>
		<rect x="5" y="12" width="1" height="2"></rect>
		<rect x="6" y="14" width="1" height="2"></rect>
		<rect x="8" y="2" width="1" height="2"></rect>
		<rect x="7" y="4" width="1" height="2"></rect>
		<rect x="6" y="6" width="1" height="2"></rect>
		<rect x="13" y="8" width="1" height="2"></rect>
		<rect x="13" y="12" width="1" height="2"></rect>
		<rect x="12" y="14" width="1" height="2"></rect>
	`,
};

// Square with handles
icons.pathResize = {
	fill: `
		<rect x="1" y="1" display="inline" width="4" height="4"></rect>
		<rect x="8" y="8" display="inline" width="4" height="4"></rect>
		<rect x="15" y="15" display="inline" width="4" height="4"></rect>
		<rect x="15" y="1" display="inline" width="4" height="4"></rect>
		<rect x="1" y="15" display="inline" width="4" height="4"></rect>
	`,
	outline: `
		<rect x="16" y="5" width="1" height="10"></rect>
		<rect x="5" y="16" width="10" height="1"></rect>
		<rect x="5" y="3" width="10" height="1"></rect>
		<rect x="3" y="5" width="1" height="10"></rect>
		<rect x="1" y="1" width="4" height="1"></rect>
		<rect x="1" y="4" width="4" height="1"></rect>
		<rect x="1" y="1" width="1" height="4"></rect>
		<rect x="4" y="1" width="1" height="4"></rect>
		<rect x="15" y="1" width="4" height="1"></rect>
		<rect x="15" y="4" width="4" height="1"></rect>
		<rect x="15" y="1" width="1" height="4"></rect>
		<rect x="18" y="1" width="1" height="4"></rect>
		<rect x="15" y="15" width="4" height="1"></rect>
		<rect x="15" y="18" width="4" height="1"></rect>
		<rect x="15" y="15" width="1" height="4"></rect>
		<rect x="18" y="15" width="1" height="4"></rect>
		<rect x="1" y="15" width="4" height="1"></rect>
		<rect x="1" y="18" width="4" height="1"></rect>
		<rect x="1" y="15" width="1" height="4"></rect>
		<rect x="4" y="15" width="1" height="4"></rect>
		<rect x="8" y="8" width="4" height="1"></rect>
		<rect x="8" y="11" width="4" height="1"></rect>
		<rect x="8" y="8" width="1" height="4"></rect>
		<rect x="11" y="8" width="1" height="4"></rect>
	`,
};

icons.newRectangle = {
	fill: `<rect x="2" y="2" width="12" height="12"></rect>
`,
	outline: `
		<rect x="1" y="1" width="13" height="1"></rect>
		<rect x="1" y="13" width="13" height="1"></rect>
		<rect x="14" y="16" width="5" height="1"></rect>
		<rect x="1" y="2" width="1" height="12"></rect>
		<rect x="13" y="2" width="1" height="12"></rect>
		<rect x="16" y="14" width="1" height="5"></rect>
	`,
};

icons.newOval = {
	fill: `
		<rect x="6" y="2" width="4" height="1"></rect>
		<rect x="6" y="12" width="4" height="1"></rect>
		<rect x="5" y="10.1" width="4" height="1"></rect>
		<rect x="2" y="6" width="1" height="3"></rect>
		<rect x="13" y="6" width="1" height="3"></rect>
		<rect x="11" y="5.1" width="1" height="3"></rect>
		<rect x="3" y="3" width="10" height="9"></rect>
	`,
	outline: `
		<rect x="6" y="1" width="4" height="1"></rect>
		<rect x="4" y="2" width="2" height="1"></rect>
		<rect x="6" y="13" width="4" height="1"></rect>
		<rect x="1" y="6" width="1" height="3"></rect>
		<rect x="2" y="4" width="1" height="2"></rect>
		<rect x="10" y="2" width="2" height="1"></rect>
		<rect x="13" y="4" width="1" height="2"></rect>
		<rect x="4" y="12" width="2" height="1"></rect>
		<rect x="2" y="9" width="1" height="2"></rect>
		<rect x="10" y="12" width="2" height="1"></rect>
		<rect x="13" y="9" width="1" height="2"></rect>
		<rect x="14" y="6" width="1" height="3"></rect>
		<rect x="14" y="16" width="5" height="1"></rect>
		<rect x="16" y="14" width="1" height="5"></rect>
		<rect x="12" y="3" width="1" height="1"></rect>
		<rect x="12" y="11" width="1" height="1"></rect>
		<rect x="3" y="11" width="1" height="1"></rect>
		<rect x="3" y="3" width="1" height="1"></rect>
	`,
};

icons.newPath = {
	fill: `
		<rect x="5" y="2" width="5" height="13"></rect>
		<rect x="10" y="4" width="2" height="11"></rect>
		<rect x="3" y="9" width="2" height="6"></rect>
		<rect x="6" y="15" width="3" height="1"></rect>
		<rect x="12" y="6" width="2" height="7"></rect>
		<rect x="2" y="2" width="3" height="1"></rect>
		<rect x="4" y="3" width="3" height="1"></rect>
	`,
	outline: `
		<rect x="14" y="16" width="5" height="1"></rect>
		<rect x="16" y="14" width="1" height="5"></rect>
		<rect x="8" y="2" width="2" height="1"></rect>
		<rect x="2" y="1" width="6" height="1"></rect>
		<rect x="6" y="16" width="3" height="1"></rect>
		<rect x="10" y="3" width="1" height="1"></rect>
		<rect x="11" y="4" width="1" height="1"></rect>
		<rect x="12" y="5" width="1" height="1"></rect>
		<rect x="1" y="1" width="1" height="2"></rect>
		<rect x="2" y="3" width="2" height="1"></rect>
		<rect x="4" y="4" width="1" height="1"></rect>
		<rect x="2" y="10" width="1" height="4"></rect>
		<rect x="3" y="9" width="1" height="1"></rect>
		<rect x="3" y="14" width="1" height="1"></rect>
		<rect x="5" y="5" width="1" height="3"></rect>
		<rect x="4" y="8" width="1" height="1"></rect>
		<rect x="12" y="13" width="1" height="1"></rect>
		<rect x="11" y="14" width="1" height="1"></rect>
		<rect x="9" y="15" width="2" height="1"></rect>
		<rect x="4" y="15" width="2" height="1"></rect>
		<rect x="13" y="11" width="1" height="2"></rect>
		<rect x="13" y="6" width="1" height="2"></rect>
		<rect x="14" y="8" width="1" height="3"></rect>
	`,
};

// View and Zoom

icons.zoomEm = {
	outline: `
		<polygon points="15,3 11,3 11,5 13,5 13,6 12,6 12,7 11,7 11,8 10,8 9,8 9,7 8,7 8,6 7,6 7,5 9,5 9,3 5,3 3,3 3,5 3,9 5,9 5,7 6,7 6,8 7,8 7,9 8,9 8,10 8,11 7,11 7,12 6,12 6,13 5,13 5,11 3,11 3,15 3,17 5,17 9,17 9,15 7,15 7,14 8,14 8,13 9,13 9,12 10,12 11,12 11,13 12,13 12,14 13,14 13,15 11,15 11,17 15,17 17,17 17,15 17,11 15,11 15,13 14,13 14,12 13,12 13,11 12,11 12,10 12,9 13,9 13,8 14,8 14,7 15,7 15,9 17,9 17,5 17,3"/>
		<rect x="18" y="1" width="1" height="18"></rect>
		<rect x="1" y="18" width="18" height="1"></rect>
		<rect x="1" y="1" width="18" height="1"></rect>
		<rect x="1" y="1" width="1" height="18"></rect>
	`,
};

icons.displayModeFilled = {
	outline: `
		<path d="M18,4v-1h-1v-1h-1v-1h-5v1h-1v1h-4v1h-1v1h-1v1h-1v1h-1v1h-1v6h1v1h1v1h1v1h1v1h0s1,0,1,0v1h6v-1h1v-1h1v-1h1v-1h1v-1h1v-4h1v-1h1v-5h-1ZM16,11h-5v-1h-1v-1h0s-1-0-1-0v-5h4v1h1v1h1v1h1v4Z"/>
	`,
};

icons.displayModeOutlined = {
	outline: `
		<rect x="1" y="8" width="1" height="6"/>
		<rect x="2" y="7" width="1" height="1"/>
		<rect x="5" y="4" width="1" height="1"/>
		<rect x="12" y="4" width="1" height="1"/>
		<rect x="15" y="7" width="1" height="1"/>
		<polygon points="17 8 16 8 16 11 11 11 11 12 16 12 16 14 17 14 17 10 18 10 18 9 17 9 17 8"/>
		<rect x="15" y="14" width="1" height="1"/>
		<rect x="12" y="17" width="1" height="1"/>
		<rect x="6" y="18" width="6" height="1"/>
		<rect x="5" y="17" width="1" height="1"/>
		<rect x="2" y="14" width="1" height="1"/>
		<rect x="11" y="1" width="5" height="1"/>
		<rect x="16" y="2" width="1" height="1"/>
		<rect x="17" y="3" width="1" height="1"/>
		<rect x="18" y="4" width="1" height="5"/>
		<rect x="10" y="10" width="1" height="1"/>
		<rect x="9" y="9" width="1" height="1"/>
		<polygon points="8 9 9 9 9 4 12 4 12 3 11 3 11 2 10 2 10 3 6 3 6 4 8 4 8 9"/>
		<rect x="14" y="15" width="1" height="1"/>
		<rect x="13" y="16" width="1" height="1"/>
		<rect x="3" y="15" width="1" height="1"/>
		<rect x="4" y="16" width="1" height="1"/>
		<rect x="3" y="6" width="1" height="1"/>
		<rect x="4" y="5" width="1" height="1"/>
		<rect x="14" y="6" width="1" height="1"/>
		<rect x="13" y="5" width="1" height="1"/>
	`,
};

// Paper: a light sheet with dark lines of text. Click to switch to slate.
icons.canvasThemePaper = {
	fill: `
		<rect x="3" y="2" width="14" height="16"></rect>
	`,
	outline: `
		<rect x="2" y="1" width="16" height="1"></rect>
		<rect x="2" y="18" width="16" height="1"></rect>
		<rect x="2" y="1" width="1" height="18"></rect>
		<rect x="17" y="1" width="1" height="18"></rect>
		<rect x="5" y="5" width="9" height="1"></rect>
		<rect x="5" y="8" width="7" height="1"></rect>
		<rect x="5" y="11" width="9" height="1"></rect>
	`,
};

// Slate: a dark sheet with light lines of text. Click to switch to paper.
icons.canvasThemeSlate = {
	fill: `
		<rect x="5" y="5" width="9" height="1"></rect>
		<rect x="5" y="8" width="7" height="1"></rect>
		<rect x="5" y="11" width="9" height="1"></rect>
	`,
	outline: `
		<rect x="2" y="1" width="16" height="4"></rect>
		<rect x="2" y="5" width="3" height="1"></rect>
		<rect x="14" y="5" width="4" height="1"></rect>
		<rect x="2" y="6" width="16" height="2"></rect>
		<rect x="2" y="8" width="3" height="1"></rect>
		<rect x="12" y="8" width="6" height="1"></rect>
		<rect x="2" y="9" width="16" height="2"></rect>
		<rect x="2" y="11" width="3" height="1"></rect>
		<rect x="14" y="11" width="4" height="1"></rect>
		<rect x="2" y="12" width="16" height="7"></rect>
	`,
};

icons.zoom1to1 = {
	outline: `
		<rect x="5" y="4" width="2" height="12"></rect>
		<rect x="14" y="4" width="2" height="12"></rect>
		<rect x="18" y="1" width="1" height="18"></rect>
		<rect x="1" y="1" width="1" height="18"></rect>
		<rect x="13" y="5" width="1" height="1"></rect>
		<rect x="4" y="5" width="1" height="1"></rect>
		<rect x="9" y="11" width="2" height="2"></rect>
		<rect x="9" y="7" width="2" height="2"></rect>
		<rect x="1" y="1" width="18" height="1"></rect>
		<rect x="1" y="18" width="18" height="1"></rect>
	`,
};

icons.zoomIn = {
	outline: `
		<rect x="9" y="3" width="2" height="14"></rect>
		<rect x="3" y="9" width="14" height="2"></rect>
	`,
};

icons.zoomOut = {
	outline: `<rect x="3" y="9" width="14" height="2"></rect>`,
};

icons.pan = {
	fill: `
		<rect x="9" y="1" width="2" height="18"></rect>
		<rect x="1" y="9" width="18" height="2"></rect>
		<rect x="2" y="7" width="2" height="6"></rect>
		<rect x="7" y="16" width="6" height="2"></rect>
		<rect x="16" y="7" width="2" height="6"></rect>
		<rect x="7" y="2" width="6" height="2"></rect>
	`,
	outline: `
		<rect x="8" y="4" width="1" height="5"></rect>
		<rect x="8" y="11" width="1" height="5"></rect>
		<rect x="11" y="4" width="1" height="5"></rect>
		<rect x="11" y="11" width="1" height="5"></rect>
		<rect x="4" y="8" width="4" height="1"></rect>
		<rect x="11" y="8" width="5" height="1"></rect>
		<rect x="4" y="11" width="4" height="1"></rect>
		<rect x="4" y="12" width="1" height="2"></rect>
		<rect x="4" y="6" width="1" height="2"></rect>
		<rect x="2" y="12" width="1" height="1"></rect>
		<rect x="1" y="11" width="1" height="1"></rect>
		<rect x="0" y="9" width="1" height="2"></rect>
		<rect x="1" y="8" width="1" height="1"></rect>
		<rect x="3" y="6" width="1" height="1"></rect>
		<rect x="2" y="7" width="1" height="1"></rect>
		<rect x="3" y="13" width="1" height="1"></rect>
		<rect x="11" y="11" width="5" height="1"></rect>
		<rect x="12" y="15" width="2" height="1"></rect>
		<rect x="6" y="15" width="2" height="1"></rect>
		<rect x="12" y="17" width="1" height="1"></rect>
		<rect x="13" y="16" width="1" height="1"></rect>
		<rect x="11" y="18" width="1" height="1"></rect>
		<rect x="9" y="19" width="2" height="1"></rect>
		<rect x="8" y="18" width="1" height="1"></rect>
		<rect x="7" y="17" width="1" height="1"></rect>
		<rect x="6" y="16" width="1" height="1"></rect>
		<rect x="15" y="6" width="1" height="2"></rect>
		<rect x="15" y="12" width="1" height="2"></rect>
		<rect x="17" y="7" width="1" height="1"></rect>
		<rect x="16" y="6" width="1" height="1"></rect>
		<rect x="18" y="8" width="1" height="1"></rect>
		<rect x="19" y="9" width="1" height="2"></rect>
		<rect x="18" y="11" width="1" height="1"></rect>
		<rect x="17" y="12" width="1" height="1"></rect>
		<rect x="16" y="13" width="1" height="1"></rect>
		<rect x="6" y="4" width="2" height="1"></rect>
		<rect x="12" y="4" width="2" height="1"></rect>
		<rect x="7" y="2" width="1" height="1"></rect>
		<rect x="6" y="3" width="1" height="1"></rect>
		<rect x="8" y="1" width="1" height="1"></rect>
		<rect x="9" y="0" width="2" height="1"></rect>
		<rect x="11" y="1" width="1" height="1"></rect>
		<rect x="12" y="2" width="1" height="1"></rect>
		<rect x="13" y="3" width="1" height="1"></rect>
	`,
};

icons.livePreview = {
	outline: `
		<polygon points="8 12 7 12 7 13 5 13 5 9 6 9 6 8 3 8 3 9 4 9 4 13 3 13 3 14 8 14 8 12"/>
		<rect x="8" y="10" width="1" height="1"/>
		<rect x="10" y="10" width="2" height="1"/>
		<rect x="12" y="11" width="1" height="2"/>
		<polygon points="12 13 10 13 10 11 9 11 9 15 8 15 8 16 10 16 10 14 12 14 12 13"/>
		<rect x="1" y="6" width="1" height="12"/>
		<rect x="14" y="8" width="1" height="10"/>
		<rect x="2" y="5" width="10" height="1"/>
		<polygon points="14 1 14 2 18 2 18 6 19 6 19 1 14 1"/>
		<rect x="15" y="4" width="1" height="1"/>
		<rect x="16" y="3" width="1" height="1"/>
		<rect x="14" y="5" width="1" height="1"/>
		<rect x="13" y="6" width="1" height="1"/>
		<rect x="17" y="2" width="1" height="1"/>
		<rect x="2" y="18" width="12" height="1"/>
	`,
};

icons.openLivePreview = {
	fill: `
	<rect data-name="Background" x="2" y="6" width="12" height="12"/>
	`,
	outline: `
		<g data-name="Lp">
			<polygon points="8 12 7 12 7 13 5 13 5 9 6 9 6 8 3 8 3 9 4 9 4 13 3 13 3 14 8 14 8 12"/>
			<rect x="8" y="10" width="1" height="1"/>
			<rect x="10" y="10" width="2" height="1"/>
			<rect x="12" y="11" width="1" height="2"/>
			<polygon points="12 13 10 13 10 11 9 11 9 15 8 15 8 16 10 16 10 14 12 14 12 13"/>
			<rect x="1" y="6" width="1" height="12"/>
			<rect x="14" y="8" width="1" height="10"/>
			<rect x="2" y="5" width="10" height="1"/>
			<rect x="2" y="18" width="12" height="1"/>
		</g>
		<g data-name="Launch">
			<polygon points="14 1 14 2 18 2 18 6 19 6 19 1 14 1"/>
			<rect x="15" y="4" width="1" height="1"/>
			<rect x="16" y="3" width="1" height="1"/>
			<rect x="14" y="5" width="1" height="1"/>
			<rect x="13" y="6" width="1" height="1"/>
			<rect x="17" y="2" width="1" height="1"/>
		</g>
	`,
};

icons.closeLivePreview = {
	fill: `
	<rect data-name="Background" x="2" y="6" width="12" height="12"/>
	`,
	outline: `
		<g data-name="Lp">
			<polygon points="8 12 7 12 7 13 5 13 5 9 6 9 6 8 3 8 3 9 4 9 4 13 3 13 3 14 8 14 8 12"/>
			<rect x="8" y="10" width="1" height="1"/>
			<rect x="10" y="10" width="2" height="1"/>
			<rect x="12" y="11" width="1" height="2"/>
			<polygon points="12 13 10 13 10 11 9 11 9 15 8 15 8 16 10 16 10 14 12 14 12 13"/>
			<rect x="1" y="6" width="1" height="12"/>
			<rect x="14" y="8" width="1" height="10"/>
			<rect x="2" y="5" width="10" height="1"/>
			<rect x="2" y="18" width="12" height="1"/>
		</g>
		<g data-name="Close">
			<rect x="15" y="4" width="1" height="1"/>
			<rect x="16" y="3" width="1" height="1"/>
			<rect x="14" y="5" width="1" height="1"/>
			<rect x="13" y="6" width="1" height="1"/>
			<rect x="13" y="0" width="1" height="1"/>
			<rect x="19" y="0" width="1" height="1"/>
			<rect x="19" y="6" width="1" height="1"/>
			<rect x="17" y="2" width="1" height="1"/>
			<rect x="18" y="1" width="1" height="1"/>
			<rect x="15" y="2" width="1" height="1"/>
			<rect x="14" y="1" width="1" height="1"/>
			<rect x="18" y="5" width="1" height="1"/>
			<rect x="17" y="4" width="1" height="1"/>
		</g>
	`,
};

icons.kern = {
	fill: `
		<rect x="1" y="9" width="18" height="2"></rect>
		<rect x="2" y="7" width="2" height="6"></rect>
		<rect x="16" y="7" width="2" height="6"></rect>
	`,
	outline: `
		<rect x="4" y="8" width="12" height="1"></rect>
		<rect x="4" y="11" width="12" height="1"></rect>
		<rect x="4" y="12" width="1" height="2"></rect>
		<rect x="4" y="6" width="1" height="2"></rect>
		<rect x="2" y="12" width="1" height="1"></rect>
		<rect x="1" y="11" width="1" height="1"></rect>
		<rect y="9" width="1" height="2"></rect>
		<rect x="1" y="8" width="1" height="1"></rect>
		<rect x="3" y="6" width="1" height="1"></rect>
		<rect x="2" y="7" width="1" height="1"></rect>
		<rect x="3" y="13" width="1" height="1"></rect>
		<rect x="15" y="6" width="1" height="2"></rect>
		<rect x="15" y="12" width="1" height="2"></rect>
		<rect x="17" y="7" width="1" height="1"></rect>
		<rect x="16" y="6" width="1" height="1"></rect>
		<rect x="18" y="8" width="1" height="1"></rect>
		<rect x="19" y="9" width="1" height="2"></rect>
		<rect x="18" y="11" width="1" height="1"></rect>
		<rect x="17" y="12" width="1" height="1"></rect>
		<rect x="16" y="13" width="1" height="1"></rect>
		<rect x="9" y="2" width="2" height="16"></rect>
	`,
};
