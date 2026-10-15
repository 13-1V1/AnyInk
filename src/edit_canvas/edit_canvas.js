// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { drawAutoTracePreview } from '../anyink/autotrace/preview_draw.js';
import { drawKernPairView } from '../anyink/kerning/pair_view.js';
import { onDisplayScaleChange } from '../anyink/metrics/display_scale.js';
import { guideLineLength, hasNoWidthYet } from '../anyink/metrics/guide_span.js';
import { systemGuideStroke } from '../anyink/metrics/guide_strength.js';
import { drawGuidesLayerOverlay, guidesLayerState } from '../anyink/metrics/guides_layer.js';
import { onThemeChange, token, withAlpha } from '../anyink/theme/theme.js';
import { onBitmapReady } from '../anyink/trace/bitmap_cache.js';
import { drawTraceAffordances, drawTraceImage } from '../anyink/trace/trace_draw.js';
import { isSimpleMode } from '../anyink/mode/mode.js';
import { labelCase, word } from '../anyink/words/words.js';
import { getCurrentProject, getCurrentProjectEditor } from '../app/main.js';
import { transparencyToAlpha } from '../common/colors.js';
import { makeElement } from '../common/dom.js';
import { clone } from '../common/functions.js';
import { drawGlyph, drawGlyphOutlineMode } from '../display_canvas/draw_paths.js';
import { kernGroupSideMaxWidth } from '../project_editor/cross_item_actions.js';
import { gridColor, guideColorDark, guideLevelOpacity } from '../project_editor/guide.js';
import { runQualityChecksForItem } from '../project_editor/quality_checks.js';
import {
	clearCanvasHotspots,
	drawCharacterKernExtra,
	drawContextCharacters,
} from './context_characters.js';
import {
	computeAndDrawBoundingBox,
	computeAndDrawBoundingBoxHandles,
	computeAndDrawDragToSelectBox,
	computeAndDrawPathPointHandles,
	computeAndDrawPathPoints,
	computeAndDrawRotationAffordance,
	drawAllHighlightedPoints,
	drawNewBasicPath,
	drawPathPointHover,
	drawSelectedPathOutline,
} from './draw_edit_affordances.js';
import { cancelDefaultEventActions, eventHandlerData, initEventHandlers } from './events.js';
import { handlePasteSVGonEditCanvas } from './events_drag_drop_paste.js';

/**
 * EditCanvas takes a string of glyphs and displays them on the canvas
 * And has a bunch of controls and interactions that allow for editing
 */
export class EditCanvas extends HTMLElement {
	/**
	 * Specify which attributes are observed and trigger attributeChangedCallback
	 */
	static get observedAttributes() {
		return ['editing-item-id'];
	}

	/**
	 * Create an EditCanvas
	 * @param {Object} attributes - collection of key: value pairs to set as attributes
	 */
	constructor(attributes = {}) {
		// log(`EditCanvas.constructor`, 'start');

		super();

		Object.keys(attributes).forEach((key) => this.setAttribute(key, attributes[key]));

		// element attributes
		this.editingItemID = this.getAttribute('editing-item-id') || '';
		this.width = this.getAttribute('width') || 2000;
		this.height = this.getAttribute('height') || 2000;

		// internal properties
		/** @type {HTMLCanvasElement} */
		this.canvas = document.createElement('canvas');
		this.ctx = this.canvas.getContext('2d');

		// Put it all together
		let shadow = this.attachShadow({ mode: 'open' });
		shadow.appendChild(this.canvas);

		this.canvas.height = Number(this.height);
		this.canvas.width = Number(this.width);

		const editor = getCurrentProjectEditor();

		// Need paste event listeners on both edit-canvas and canvas
		// for cross-browser compat
		this.canvas.setAttribute('contenteditable', 'true');
		this.canvas.addEventListener('paste', handlePasteSVGonEditCanvas, false);
		this.addEventListener('paste', handlePasteSVGonEditCanvas, false);

		// These are handled by the EditCanvas element, not the canvas in the Element
		// Fixes a FireFox default behavior that caused issues with dragging
		[
			'mousedown',
			'mousemove',
			'mouseup',
			'mouseover',
			'mouseout',
			'wheel',
			'drop',
			'dragenter',
			'dragover',
			'drag',
			'keydown',
			'keyup',
		].forEach((eventName) => {
			this.canvas.addEventListener(eventName, cancelDefaultEventActions);
		});

		const styles = makeElement({
			tag: 'style',
			innerHTML: `
				:focus-visible,
				:focus,
				canvas:focus-visible,
				canvas:focus {
					border: 0;
					border-image: none;
					outline: 0;
				}
				[contenteditable='true'] {
					caret-color: transparent;
				}
				::selection {
					background-color: transparent;
				}
				`,
		});
		shadow.appendChild(styles);

		initEventHandlers(this.canvas);
		if (editor.editCanvas?.unsubscribeThemeChange) editor.editCanvas.unsubscribeThemeChange();
		if (editor.editCanvas?.unsubscribeTraceBitmap) editor.editCanvas.unsubscribeTraceBitmap();
		if (editor.editCanvas?.unsubscribeDisplayScale) editor.editCanvas.unsubscribeDisplayScale();
		editor.editCanvas = this;

		// Redraw when the canvas flips between paper and slate
		this.unsubscribeThemeChange = onThemeChange(() => this.redraw('themeChange'));

		// ANY-INK (M7): redraw when a trace image finishes decoding (bitmap_cache.js)
		this.unsubscribeTraceBitmap = onBitmapReady(() => this.redraw('traceBitmapReady'));

		// ANY-INK (B1): guide lines are drawn for the display scale; redraw when it changes
		this.unsubscribeDisplayScale = onDisplayScaleChange(() => this.redraw('displayScale'));

		// Set up Subscriptions
		// ANY-INK (M7): '*' expands to pub_sub.js allTopics, which includes 'traceLayer',
		// so trace moves, resizes, and panel changes redraw here without a second subscriber.
		// ANY-INK (M8): allTopics also includes 'autoTrace', so the auto-trace preview redraws
		// here on every session change.
		editor.subscribe({
			topic: '*',
			subscriberID: `editCanvas-all`,
			callback: () => {
				this.redraw('subscription:editCanvas-all');
			},
		});
		// log(`EditCanvas.constructor`, 'end');
	}

	connectedCallback() {
		// log(`EditCanvas.connectedCallback`, 'start');
		// Auto-fit view
		this.setAttribute('contenteditable', 'true');
		const editor = getCurrentProjectEditor();
		editor.autoFitIfViewIsDefault();
		// log(`EditCanvas.connectedCallback`, 'end');
	}

	/**
	 * Listens for attribute changes on this element
	 * @param {String} attributeName - which attribute was changed
	 * @param {String} oldValue - value before the change
	 * @param {String} newValue - value after the change
	 */
	attributeChangedCallback(attributeName, oldValue, newValue) {
		// log(`EditCanvas.attributeChangeCallback`, 'start');
		// log(`Attribute ${attributeName} was ${oldValue}, is now ${newValue}`);

		switch (attributeName) {
			case 'editing-item-id':
				this.editingItemID = newValue;
				// getCurrentProjectEditor().autoFitIfViewIsDefault();
				this.redraw('attributeChangedCallback:editing-item-id');
				break;
		}
		// log(`EditCanvas.attributeChangeCallback`, 'end');
	}

	// --------------------------------------------------------------
	// Redraw the canvas
	// --------------------------------------------------------------
	/**
	 * Redraw the canvas
	 * @param {String =} _caller - who is calling redraw
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	redraw(_caller = 'unknown') {
		// log(`EditCanvas.redraw \\ ${_caller}`, 'start');
		const editor = getCurrentProjectEditor();
		const project = getCurrentProject();
		const view = editor.view;
		// log(`view: ${view.dx}, ${view.dy}, ${view.dz}`);
		const ctx = this.ctx;
		const width = Number(this.width);
		const height = Number(this.height);
		const currentItemID = this.editingItemID;
		const currentItem = project.getItem(currentItemID);
		runQualityChecksForItem(currentItem);
		// log(`currentItemID: ${currentItemID}`);
		const advanceWidth = currentItem?.advanceWidth || 0;
		const itemXMax = Math.max(advanceWidth, currentItem?.maxes?.xMax || 0);

		if (currentItemID.startsWith('kern-')) {
			if (requestAnimationFrame) requestAnimationFrame(redrawKernEdit);
			else redrawKernEdit();
		} else {
			if (requestAnimationFrame) requestAnimationFrame(redrawGlyphEdit);
			else redrawGlyphEdit();
		}

		// log(`EditCanvas.redraw \\ ${_caller}`, 'end');

		function redrawGlyphEdit() {
			// log(`EditCanvas.redrawGlyphEdit`, 'start');
			editor.autoFitIfViewIsDefault();
			ctx.clearRect(0, 0, width, height);
			// ANY-INK (M7): the trace image goes under everything else
			drawTraceImage(ctx, view, currentItem, editor);
			const ehd = eventHandlerData;

			// Guides
			const guidesSettings = editor.project.settings.app.guides;
			if (!guidesSettings.drawGuidesOnTop) {
				// if (guidesSettings.systemShowGuides) drawSystemGuidelines(!shouldDrawContextCharacters());
				if (guidesSettings.gridShow) drawGrid();
				if (guidesSettings.systemShowGuides) drawSystemGuidelines();
				if (guidesSettings.customShowGuides) drawCustomGuidelines();
			}

			// Draw glyphs
			if (project.settings.app.canvasDisplayModeFilled) {
				drawGlyph(currentItem, ctx, view);
			} else {
				drawGlyphOutlineMode(currentItem, ctx, view);
			}

			// Draw selected shape
			const editMode = editor.selectedTool;
			// log(`editMode: ${editMode}`);
			// log(`ehd.handle: ${ehd.handle}`);
			if (editMode === 'resize') {
				drawSelectedPathOutline(ctx, view);
				if (ehd.handle === 'rotate') {
					computeAndDrawRotationAffordance(ctx);
				} else {
					computeAndDrawBoundingBox(ctx);
					computeAndDrawBoundingBoxHandles(ctx);
				}
			} else if (editMode === 'pathEdit') {
				drawSelectedPathOutline(ctx, view);
				if (ehd.selecting) {
					computeAndDrawPathPoints(ctx, true);
					// testDrawAllPathPointHandles(ctx);
				} else {
					computeAndDrawPathPointHandles(ctx);
					computeAndDrawPathPoints(ctx);
					// drawPathPointHover(ctx, ehd.hoverPoint);
				}
			} else if (editMode === 'pathAddPoint') {
				drawSelectedPathOutline(ctx, view);
				computeAndDrawPathPoints(ctx);
				if (ehd.hoverPoint) {
					drawPathPointHover(ctx, ehd.hoverPoint);
				}
			} else if (editMode === 'newPath') {
				computeAndDrawPathPointHandles(ctx);
				computeAndDrawPathPoints(ctx);
			}

			// Draw temporary new paths
			if (eventHandlerData?.newBasicPath?.objType) {
				drawNewBasicPath(ctx, ehd.newBasicPath, view);
			}

			// Guides (if draw on top)
			if (guidesSettings.drawGuidesOnTop) {
				// if (guidesSettings.systemShowGuides) drawSystemGuidelines(!shouldDrawContextCharacters());
				if (guidesSettings.gridShow) drawGrid();
				if (guidesSettings.systemShowGuides) drawSystemGuidelines();
				if (guidesSettings.customShowGuides) drawCustomGuidelines();
			}

			const contextCharacterSettings = editor.project.settings.app.contextCharacters;
			// Context characters
			// ANY-INK (B4 + B5 fix pass): never in Simple, even when More tools turned them on: their
			// labels are Glyphr Studio's words ("kern: -40", item names) and their names are links
			// into pages Simple hides (UX-BEGINNER 2.3, 6.2)
			if (contextCharacterSettings.showCharacters && !isSimpleMode()) {
				drawContextCharacters(ctx);
			} else {
				// B4 + B5 finalize: their names are links only while they are drawn; an earlier
				// draw's links must not stay as invisible traps (a click jumping to another letter)
				clearCanvasHotspots();
			}

			// ANY-INK guides layer: hover / drag highlights and live metric labels
			drawGuidesLayerOverlay(ctx, view, currentItem);

			// ANY-INK (M7): trace image box and corner handles (Trace panel open only)
			drawTraceAffordances(ctx, view, currentItem, editor);

			// ANY-INK (M8): auto-trace preview (only while a session has a result for this item)
			drawAutoTracePreview(ctx, view, currentItem, editor);

			// Highlighted points
			drawAllHighlightedPoints(ctx);

			// Drag to select box
			if (ehd.selecting) {
				computeAndDrawDragToSelectBox(ctx, eventHandlerData);
			}
			// log(`EditCanvas.redrawGlyphEdit`, 'end');
		}

		function redrawKernEdit() {
			// log(`EditCanvas.redraw.redrawKernEdit`, 'start');
			// log(`currentItemID: ${currentItemID}`);
			editor.autoFitIfViewIsDefault();
			ctx.clearRect(0, 0, width, height);
			let kernGroup = project.getItem(currentItemID);
			// log(kernGroup);

			if (kernGroup) {
				// ANY-INK: horizontal metric lines are visible in the pair view too
				if (editor.project.settings.app.guides.systemShowGuides) drawSystemGuidelines(false);
				ctx.fillStyle = token('--canvas-guide-muted');
				const gridPad = 100 * view.dz;
				const visibleLeftWidth = kernGroupSideMaxWidth(kernGroup.leftGroup) * view.dz;
				const visibleRightWidth = kernGroupSideMaxWidth(kernGroup.rightGroup) * view.dz;
				const visibleValue = kernGroup.value * view.dz;
				ctx.fillRect(
					view.dx - gridPad - visibleLeftWidth + visibleValue,
					Math.ceil(view.dy),
					gridPad * 2 + visibleLeftWidth + visibleRightWidth - visibleValue,
					1
				);

				ctx.fillStyle = token('--canvas-kern');
				drawEmVerticalLine(ctx, 0, view);
				drawEmVerticalLine(ctx, kernGroup.value, view);
				drawCharacterKernExtra(ctx, kernGroup.value, view.dx, view.dz);

				let drawItem;
				// Draw right hand group
				// log(`Drawing right-hand group`);
				let rightAlpha = Math.max(0.25, 1 / kernGroup.rightGroup.length);
				kernGroup.rightGroup.forEach((id) => {
					drawItem = project.getItem(`glyph-${id}`, false);
					// log(drawItem);
					if (drawItem) {
						let thisView = clone(view);
						thisView.dx += kernGroup.value * thisView.dz;
						// log(thisView);
						drawGlyph(drawItem, ctx, thisView, rightAlpha);
					}
				});

				// Draw left hand group
				// log(`Drawing left-hand group`);
				let leftAlpha = Math.max(0.25, 1 / kernGroup.leftGroup.length);
				kernGroup.leftGroup.forEach((id) => {
					drawItem = project.getItem(`glyph-${id}`, false);
					// log(drawItem);
					if (drawItem) {
						let thisView = clone(view);
						thisView.dx -= drawItem.advanceWidth * thisView.dz;
						// log(thisView);
						drawGlyph(drawItem, ctx, thisView, leftAlpha);
					}
				});

				// ANY-INK: sample-word context and drag affordance for the pair (D-010)
				drawKernPairView(ctx, view, kernGroup);
				drawGuidesLayerOverlay(ctx, view, kernGroup);
			}

			// log(`EditCanvas.redraw.redrawKernEdit`, 'end');
		}

		function drawSystemGuidelines(drawVerticals = true) {
			// log(`drawSystemGuidelines`, 'start');
			// ANY-INK (B1): strong enough that the writing line reaches 3:1 at the default setting,
			// on the screen itself when the display is scaled above 100% (thickness 1 or 2 px)
			const { alpha, thickness } = systemGuideStroke(
				project.settings.app.guides.systemTransparency,
				guideColorDark(),
				token('--canvas-bg'),
				globalThis.devicePixelRatio || 1
			);
			const showLabels = project.settings.app.guides.systemShowLabels;
			// ANY-INK (B1): a letter with no width yet gets lines at least the default letter width
			const lineLength = guideLineLength(currentItem, itemXMax, project.defaultAdvanceWidth);
			// Horizontals
			let deltaY = 0;

			// capHeight
			if (editor.systemGuides.capHeight) {
				// log(`drawing capHeight...`);
				deltaY = project.settings.font.capHeight;
				setSystemGuideColor('light', alpha);
				drawEmHorizontalLine(ctx, deltaY, lineLength, view, thickness);
				if (showLabels) drawGuideLabel(guideLabel('line.capHeight'), deltaY, true, alpha);
			}
			// ascent
			if (editor.systemGuides.ascent) {
				// log(`drawing ascent...`);
				deltaY = project.settings.font.ascent;
				setSystemGuideColor('medium', alpha);
				drawEmHorizontalLine(ctx, deltaY, lineLength, view, thickness);
				if (showLabels) drawGuideLabel(guideLabel('line.ascent'), deltaY, true, alpha);
			}
			// xHeight
			if (editor.systemGuides.xHeight) {
				// log(`drawing xHeight...`);
				deltaY = project.settings.font.xHeight;
				setSystemGuideColor('light', alpha);
				drawEmHorizontalLine(ctx, deltaY, lineLength, view, thickness);
				if (showLabels) drawGuideLabel(guideLabel('line.xHeight'), deltaY, true, alpha);
			}
			// descent
			if (editor.systemGuides.descent) {
				// log(`drawing descent...`);
				deltaY = project.settings.font.descent;
				setSystemGuideColor('medium', alpha);
				drawEmHorizontalLine(ctx, deltaY, lineLength, view, thickness);
				if (showLabels) drawGuideLabel(guideLabel('line.descent'), deltaY, true, alpha);
			}

			// baseline
			if (editor.systemGuides.baseline) {
				// log(`drawing baseline...`);
				deltaY = 0;
				setSystemGuideColor('dark', alpha);
				drawEmHorizontalLine(ctx, deltaY, lineLength, view, thickness);
				if (showLabels) drawGuideLabel(guideLabel('line.baseline'), 0, true, alpha);
			}

			// Verticals
			if (drawVerticals) {
				// ANY-INK: the always-active guides layer owns side bearing hover / drag
				/** @type {String | false} */
				let sbHover = false;
				const layerLine = guidesLayerState.dragging || guidesLayerState.hover;
				if (layerLine === 'lsb' || layerLine === 'rsb') sbHover = layerLine;

				// ANY-INK (B4 + B5 fix pass, D-035): pointed at or dragged, an edge has one label, the
				// drag readout by the pointer (metrics/overlay.js, "left space 0"); its own label
				// at the top goes, so nothing says the same thing twice
				if (editor.systemGuides.leftSide) {
					setSystemGuideColor('dark', sbHover === 'lsb' ? 0.8 : alpha);
					drawEmVerticalLine(ctx, 0, view, sbHover === 'lsb', thickness);
					if (showLabels && sbHover !== 'lsb') {
						drawGuideLabel(guideLabel('canvas.leftEdge'), 0, false, alpha);
					}
				}

				if (editor.systemGuides.rightSide && advanceWidth && currentItem.objType !== 'Component') {
					setSystemGuideColor('dark', sbHover === 'rsb' ? 0.8 : alpha);
					drawEmVerticalLine(ctx, advanceWidth, view, sbHover === 'rsb', thickness);
					if (showLabels && sbHover !== 'rsb') {
						drawGuideLabel(guideLabel('canvas.rightEdge'), advanceWidth, false, alpha);
					}
				} else if (
					editor.systemGuides.rightSide &&
					hasNoWidthYet(currentItem) &&
					currentItem.objType !== 'Component'
				) {
					// ANY-INK (B1): a letter with no width yet gets a faint right edge at the default
					// width, so it is clear where the letter goes. A hint only: it can't be dragged.
					setSystemGuideColor('light', alpha);
					drawEmVerticalLine(ctx, project.defaultAdvanceWidth, view, false, thickness);
				}
			}

			// log(`drawSystemGuidelines`, 'end');
		}

		function setSystemGuideColor(level = 'medium', alpha) {
			const levelOpacity = guideLevelOpacity[level] ?? guideLevelOpacity.medium;
			const fill = withAlpha(guideColorDark(), alpha * levelOpacity);
			// log(`fill: ${fill}`);
			ctx.fillStyle = fill;
		}

		function drawCustomGuidelines() {
			const guides = getCurrentProject().settings.app.guides;

			if (guides.custom) {
				let alpha = transparencyToAlpha(guides.customTransparency);
				// ANY-INK (B1): custom lines span as far as the system lines do
				const lineLength = guideLineLength(currentItem, itemXMax, project.defaultAdvanceWidth);
				guides.custom.forEach((guide) => {
					if (guide.visible) {
						// Guide.color is ignored on purpose (audit C6): every guide follows the canvas theme.
						let fill = withAlpha(token('--canvas-guide'), alpha);
						ctx.fillStyle = fill;
						if (guide.angle === 90) {
							drawEmHorizontalLine(ctx, guide.location, lineLength, view);
							if (guides.customShowLabels) {
								drawGuideLabel(guide.name, guide.location, true, alpha);
							}
						} else {
							drawEmVerticalLine(ctx, guide.location, view);
							if (guides.customShowLabels) {
								drawGuideLabel(guide.name, guide.location, false, alpha);
							}
						}
					}
				});
			}
		}

		function drawGrid() {
			const gridSquareSize =
				editor.project.settings.font.upm / editor.project.settings.app.guides.gridDivisions;
			let x0 = Math.floor(cXsX(0) / gridSquareSize) * gridSquareSize;
			let x1 = Math.ceil(cXsX(width) / gridSquareSize) * gridSquareSize;
			let y0 = Math.floor(cYsY(height) / gridSquareSize) * gridSquareSize;
			let y1 = Math.ceil(cYsY(0) / gridSquareSize) * gridSquareSize;

			// log(`fill: ${fill}`);
			let alpha = transparencyToAlpha(editor.project.settings.app.guides.gridTransparency);
			const fill = withAlpha(gridColor(), alpha);
			ctx.fillStyle = fill;
			for (let x = x0; x <= x1; x += gridSquareSize) {
				ctx.fillRect(Math.floor(sXcX(x)), 0, 1, height);
			}
			for (let y = y0; y <= y1; y += gridSquareSize) {
				ctx.fillRect(0, Math.floor(sYcY(y)), width, 1);
			}
		}

		function drawGuideLabel(name, location, isHorizontal, alpha = 1) {
			let deltaX = 4;
			let deltaY = -4;
			let x, y;
			// The short leader line keeps the guide's own color; the text uses the label token
			const lineFill = ctx.fillStyle;
			if (isHorizontal) {
				x = 5;
				y = sYcY(location) + deltaY;
				y = location > 0 ? Math.floor(y) : Math.ceil(y);
				ctx.fillRect(0, y - deltaY, 60, 1);
			} else {
				x = sXcX(location) + deltaX;
				x = Math.floor(x);
				y = 12;
				ctx.fillRect(x - deltaX, 0, 1, 20);
			}
			ctx.font = '10px Tahoma, Verdana, sans-serif';
			ctx.fillStyle = withAlpha(token('--canvas-guide-label'), alpha);
			ctx.fillText(name, x, y);
			ctx.fillStyle = lineFill;
		}
	}
}

// --------------------------------------------------------------
// Guides
// --------------------------------------------------------------

/**
 * ANY-INK (B4, UX-BEGINNER.md 2.2, 2.4 B): a guide line's label in house words, in both modes
 * ('Writing line', 'Small-letter line', 'Left edge').
 * @param {String} key - a words.js key (line.*, canvas.leftEdge, canvas.rightEdge)
 * @returns {String}
 */
function guideLabel(key) {
	return labelCase(word(key));
}

/**
 * Draws a horizontal line, based on some Em values
 * @param {CanvasRenderingContext2D} ctx - canvas context
 * @param {Number} emY - y value, in Em space units (not pixels)
 * @param {Number} emLineWidth - width, in Em space units (not pixels)
 * @param {Object} view - view object (dx, dy, dz)
 * @param {Number} thickness - line thickness in canvas pixels (ANY-INK, B1)
 */
function drawEmHorizontalLine(ctx, emY = 0, emLineWidth, view, thickness = 1) {
	// log(`drawEmHorizontalLine`, 'start');
	let pad = 50 * view.dz;
	// if (shouldDrawContextCharacters()) pad = 0;
	let lineWidth = emLineWidth * view.dz;
	let lineX = view.dx - pad;
	let lineY = sYcY(emY);
	lineWidth += pad * 2;
	if (emY > 0) lineY = Math.floor(lineY);
	else lineY = Math.ceil(lineY);
	// log(`lineX: ${lineX}`);
	// log(`lineY: ${lineY}`);
	// log(`lineWidth: ${lineWidth}`);
	// ANY-INK (B1): `thickness` canvas px (2 on some scaled displays, guide_strength.js)
	ctx.fillRect(lineX, lineY, lineWidth, thickness);
	// log(`drawEmHorizontalLine`, 'end');
}

/**
 * Draws a vertical line, based on some Em values
 * @param {CanvasRenderingContext2D} ctx - canvas context
 * @param {Number} emX - x value, in Em space units (not pixels)
 * @param {Object} view - view object (dx, dy, dz)
 * @param {Boolean} tall - extend further past the top and tail lines
 * @param {Number} thickness - line thickness in canvas pixels (ANY-INK, B1)
 */
export function drawEmVerticalLine(ctx, emX = 0, view, tall = false, thickness = 1) {
	// log(`drawEmVerticalLine`, 'start');
	const project = getCurrentProject();
	let pad = (tall ? 200 : 50) * view.dz;
	const lineTopY = sYcY(project.settings.font.ascent, view) - pad;
	let lineX = sXcX(emX);
	lineX = Math.floor(lineX);
	let lineHeight = project.totalVertical * view.dz;
	lineHeight += pad * 2;
	// log(`lineX: ${lineX}`);
	// log(`lineTopY: ${lineTopY}`);
	// log(`lineHeight: ${lineHeight}`);

	ctx.fillRect(lineX, lineTopY, thickness, lineHeight);

	// log(`drawEmVerticalLine`, 'end');
}

// --------------------------------------------------------------------------
// Convert between Saved values and Canvas values
// --------------------------------------------------------------------------

/**
 * Converts saved X value into a canvas pixel value, given
 * a specified view.
 * @param {Number} sx - Saved X value "sx"
 * @param {Object} view - view object (dx, dy, dz)
 * @returns {Number} - X value in Canvas units (pixels)
 */
export function sXcX(sx, view = getCurrentProjectEditor().view) {
	let canvasX = view.dx;
	canvasX += sx * view.dz;
	return canvasX || view.dx;
}

/**
 * Converts saved Y value into a canvas pixel value, given
 * a specified view.
 * @param {Number} sy - Saved Y value "sy"
 * @param {Object} view - view object (dx, dy, dz)
 * @returns {Number} - Y value in Canvas units (pixels)
 */
export function sYcY(sy, view = getCurrentProjectEditor().view) {
	let canvasY = view.dy;
	canvasY -= sy * view.dz;
	return canvasY || view.dy;
}

/**
 * Converts canvas pixel X value into Em units that are
 * saved to project data.
 * @param {Number} cx - Canvas X value "cx"
 * @param {Object} view - view object (dx, dy, dz)
 * @returns {Number} - X value in Save units (Em units)
 */
export function cXsX(cx, view = getCurrentProjectEditor().view) {
	return (cx - view.dx) / view.dz;
}

/**
 * Converts canvas pixel Y value into Em units that are
 * saved to project data.
 * @param {Number} cy - Canvas Y value "cy"
 * @param {Object} view - view object (dx, dy, dz)
 * @returns {Number} - Y value in Save units (Em units)
 */
export function cYsY(cy, view = getCurrentProjectEditor().view) {
	return (view.dy - cy) / view.dz;
}
