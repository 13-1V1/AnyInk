// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { metricLineYs } from '../anyink/preview/metric_lines.js';
import { placeholderKey } from '../anyink/preview/placeholder.js';
import { onThemeChange, token } from '../anyink/theme/theme.js';
import { word } from '../anyink/words/words.js';
import { getCurrentProject, getGlyphrStudioApp } from '../app/main.js';
import { makeElement } from '../common/dom.js';
import {
	caseCamelToKebab,
	caseKebabToCamel,
	clone,
	makeCrisp,
	round,
} from '../common/functions.js';
import style from './display-canvas.css?inline';
import { drawGlyph } from './draw_paths.js';
import { TextBlock } from './text_block.js';
import { TextBlockOptions } from './text_block_options.js';

// Extra padding (in canvas pixels) added above the text, on top of pagePadding.
// Kept at 0 so the 'gs' renderer's top inset matches the native OTF/TTF
// textarea (which uses pagePadding only), keeping the previews aligned.
const EXTRA_TOP_PADDING = 0;

/**
 * DisplayCanvas takes a string of glyphs and displays them on the canvas
 * No editing involved
 */
// const displayCanvas = {};
export class DisplayCanvas extends HTMLElement {
	/**
	 * Create an DisplayCanvas
	 * @param {Object} attributes - collection of key: value pairs to set as attributes
	 */
	constructor(attributes = {}) {
		// log(`DisplayCanvas.constructor`, 'start');
		super();

		this.isSetUp = false;
		this.initialAttributes = attributes;
		this.observedAttrs = [
			'text',
			'font-size',
			'line-gap',
			'page-padding',
			'show-page-extras',
			'show-line-extras',
			'show-character-extras',
			'show-placeholder-message',
			'width-adjustment',
			'show-metric-lines',
		];

		// ANY-INK: purple metric lines (ascender, cap height, x-height, baseline,
		// descender) across the canvas; the preview strip toggles this.
		this.showMetricLines = false;

		// log(`DisplayCanvas.constructor`, 'end');
	}

	/**
	 * Draw the canvas when it's loaded
	 */
	connectedCallback() {
		// log(`DisplayCanvas.connectedCallback`, 'start');

		// Firefox bug, custom element's prototype is lost when used across frames
		if (this.constructor.name !== 'DisplayCanvas') {
			this.__proto__ = customElements.get('display-canvas').prototype;
		}

		// Initialize passed attributes
		// log(`ATTRIBUTES: PASSED FROM CONSTRUCTOR`);
		// log('this.initialAttributes');
		// log(this.initialAttributes);
		this.textBlockOptions = new TextBlockOptions();
		Object.keys(this.initialAttributes).forEach((key) => {
			// log(`key: ${key}`);
			let value = this.initialAttributes[key];
			// log(`value: ${value} (${typeof value})`);
			if (key !== '_text') {
				if (key !== 'width' && key !== 'height') {
					this.setAttribute(caseCamelToKebab(key), value);
				}
				if (this.textBlockOptions[caseKebabToCamel(key)]) {
					this.textBlockOptions[caseKebabToCamel(key)] = value;
					// log(`this.textBlockOptions[${key}] = ${value}`);
				}
			} else {
				this.textBlockOptions.text = this.initialAttributes._text;
				this.setAttribute('text', this.textBlockOptions.text);
			}
		});

		// Pull attributes from element
		// log(`ATTRIBUTES: PULL FROM ELEMENTS`);
		// log(`\n⮟this.getAttributeNames()⮟`);
		// log(this.getAttributeNames());
		this.observedAttrs.forEach((key) => {
			if (this.hasAttribute(key)) {
				/** @type {String | Boolean | Number} */
				let value = this.getAttribute(key);
				if (key.startsWith('show')) {
					if (value === 'false') value = false;
					else value = true;
				} else if (key !== 'text') {
					value = parseFloat(value);
				}

				// show-metric-lines belongs to this element, not to TextBlockOptions
				if (key === 'show-metric-lines') this.showMetricLines = !!value;
				else this.textBlockOptions[caseKebabToCamel(key)] = value;
				// log(`this.textBlockOptions[${caseKebabToCamel(key)}] = ${value}`);
			}
		});

		// log(`\n⮟this.textBlockOptions⮟`);
		// log(this.textBlockOptions);

		// Put it all together
		const shadow = this.attachShadow({ mode: 'open' });
		const styles = makeElement({ tag: 'style', innerHTML: style });
		shadow.appendChild(styles);

		this.canvas = makeElement({ tag: 'canvas', id: 'mainDisplayCanvas' });
		shadow.appendChild(this.canvas);

		// @ts-expect-error 'property does exist'
		this.ctx = this.canvas.getContext('2d');
		this.drawCrisp = false;

		// Redraw when the canvas flips between paper and slate
		if (this.unsubscribeThemeChange) this.unsubscribeThemeChange();
		this.unsubscribeThemeChange = onThemeChange(() => this.redraw());

		// Finish
		this.isSetUp = true;
		if (this.resizeAndRedraw) this.resizeAndRedraw();
		else {
			console.warn(`${this.constructor.name}: Methods not available on connectedCallback`);
		}

		// log(`DisplayCanvas.connectedCallback`, 'end');
	}

	/**
	 * Stop listening for theme changes once removed from the page
	 */
	disconnectedCallback() {
		if (this.unsubscribeThemeChange) {
			this.unsubscribeThemeChange();
			this.unsubscribeThemeChange = false;
		}
	}

	/**
	 * Updates the TextBlock, canvas size, and redraws everything
	 */
	resizeAndRedraw() {
		// log(`DisplayCanvas.resizeAndRedraw`, 'start');
		// log(`this.getAttribute('text'): ${this.getAttribute('text')}`);
		if (this.isSetUp) {
			this.updateTextBlock();
			this.updateCanvasSize();
			this.redraw();
		} else {
			// log('not set up!');
		}
		// log('DisplayCanvas.resizeAndRedraw', 'end');
	}

	/**
	 * Calculates and applies new canvas size
	 */
	updateCanvasSize() {
		// log(`updateCanvasSize`, 'start');
		// log(`this.textBlockOptions`);
		// log(this.textBlockOptions);
		// log(`this.parentElement`);
		// log(this.parentElement);
		// A parent with no layout box yet (display: none) yields no rect; size to 0 rather than throw.
		const clientRect = this?.parentElement?.getClientRects()[0] || { width: 0, height: 0 };
		// log(clientRect);
		const pageHeight = this.textBlockOptions.pageHeight;
		const pageWidth = this.textBlockOptions.pageWidth;
		// log(`pageHeight: ${pageHeight}`);
		// log(`pageWidth: ${pageWidth}`);

		let newHeight = 1000;
		let newWidth = 1000;

		// Heights
		if (pageHeight === 'auto') {
			newHeight = this.textBlock.pixelHeight;
			// Symmetric vertical padding (top + bottom), matching the native
			// font-preview textarea which uses pagePadding on every side. This
			// keeps the 'gs' and 'otf'/'ttf' previews the same element height.
			newHeight += this.textBlockOptions.pagePadding * 2 + EXTRA_TOP_PADDING;
		} else if (pageHeight === 'fit') {
			newHeight = clientRect.height;
		} else if (!isNaN(parseInt(pageHeight))) {
			newHeight = parseInt(pageHeight);
		}

		// Widths
		if (pageWidth === 'fit') {
			newWidth = clientRect.width;
		} else if (!isNaN(parseInt(pageWidth))) {
			newWidth = parseInt(pageWidth);
		}
		if (this.widthAdjustment) newWidth += this.widthAdjustment;

		// Assign new values
		// log(`newHeight: ${newHeight}`);
		// log(`newWidth: ${newWidth}`);
		this.height = newHeight;
		this.width = newWidth;

		// ANY-INK: with the hi-dpi attribute the backing store follows the device
		// pixel ratio while layout, text block math, and hit testing stay in CSS px.
		const dpr = this.hasAttribute('hi-dpi') ? window.devicePixelRatio || 1 : 1;
		// @ts-expect-error 'property does exist'
		this.canvas.height = Math.round(newHeight * dpr);
		// @ts-expect-error 'property does exist'
		this.canvas.width = Math.round(newWidth * dpr);
		if (dpr !== 1) {
			// @ts-expect-error 'property does exist'
			this.canvas.style.width = `${newWidth}px`;
			// @ts-expect-error 'property does exist'
			this.canvas.style.height = `${newHeight}px`;
		}
		// Resizing resets the context, so the scale goes on afterwards.
		if (this.ctx?.setTransform) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

		// log(this);
		// log(`updateCanvasSize`, 'end');
	}

	/**
	 * Updates TextBlock based on new canvas dimensions and text
	 */
	updateTextBlock() {
		// log(`DisplayCanvas.updateTextBlock`, 'start');
		// log(`this.textBlockOptions:`);
		// log(this.textBlockOptions);
		let pageMaxes = this.calculatePageMaxes();
		let proj = false;
		let editorID = parseInt(this.getAttribute('project-editor'));
		if (!isNaN(editorID)) {
			proj = getGlyphrStudioApp().projectEditors[editorID].project;
		}
		this.textBlock = new TextBlock({
			options: this.textBlockOptions,
			canvasMaxes: pageMaxes,
			ctx: this.ctx,
			drawPageExtras: this.drawDisplayPageExtras,
			drawLineExtras: this.drawDisplayLineExtras,
			drawCharacterExtras: this.drawDisplayCharacterExtras,
			drawCharacter: this.drawDisplayCharacter,
			project: proj,
		});
		// log(`\n⮟this.textBlock⮟`);
		// log(this.textBlock);
		// log(`DisplayCanvas.updateTextBlock`, 'end');
	}

	/**
	 * Calculates page maxes based on browser window and/or
	 * text block height and width settings.
	 * @returns {Object} - Maxes object for page dimensions
	 */
	calculatePageMaxes() {
		// log(`DisplayCanvas.calculatePageMaxes`, 'start');
		const clientRect = this?.parentElement?.getClientRects()[0] || { width: 0, height: 0 };
		const pagePadding = this.textBlockOptions.pagePadding;
		const pageHeight = this.textBlockOptions.pageHeight;
		const pageWidth = this.textBlockOptions.pageWidth;

		const maxes = {
			xMin: pagePadding,
			yMin: pagePadding + EXTRA_TOP_PADDING,
			xMax: 1000,
			yMax: 1000,
		};

		// Heights
		if (pageHeight === 'auto') {
			maxes.yMax = Infinity;
		} else if (pageHeight === 'fit') {
			maxes.yMax = clientRect.height - pagePadding;
		} else if (!isNaN(parseInt(pageHeight))) {
			maxes.yMax = parseInt(pageHeight);
		}

		// Widths
		if (pageWidth === 'fit') {
			maxes.xMax = clientRect.width - pagePadding;
		} else if (!isNaN(parseInt(pageWidth))) {
			maxes.xMax = parseInt(pageWidth);
		}

		if (this.widthAdjustment) maxes.xMax += this.widthAdjustment;

		// log(`DisplayCanvas.calculatePageMaxes`, 'end');
		return maxes;
	}

	/**
	 * Specify which attributes are observed and trigger attributeChangedCallback
	 */
	static get observedAttributes() {
		// @ts-expect-error 'property does exist'
		return this.observedAttrs;
	}

	/**
	 * Listens for attribute changes on this element
	 * @param {String} attributeName - which attribute was changed
	 * @param {String} oldValue - value before the change
	 * @param {String} newValue - value after the change
	 */
	attributeChangedCallback(attributeName, oldValue, newValue) {
		// log(`DisplayCanvas.attributeChangeCallback`, 'start');
		// log(`Attribute ${attributeName} was ${oldValue}, is now ${newValue}`);
		// log(this);

		if (this.constructor.name !== 'DisplayCanvas') return;

		if (attributeName === 'text') {
			this.textBlockOptions.text = newValue;
			this.resizeAndRedraw();
		}

		if (attributeName === 'font-size') {
			this.textBlockOptions.fontSize = Math.max(parseInt(newValue), 1);
			this.resizeAndRedraw();
		}

		if (attributeName === 'line-gap') {
			this.textBlockOptions.lineGap = Math.max(parseInt(newValue), 0);
			this.resizeAndRedraw();
		}

		if (attributeName === 'page-padding') {
			this.textBlockOptions.pagePadding = Math.max(parseInt(newValue), 0);
			this.resizeAndRedraw();
		}

		if (attributeName === 'show-page-extras') {
			this.textBlockOptions.showPageExtras = newValue === 'true';
			this.redraw();
		}

		if (attributeName === 'show-line-extras') {
			this.textBlockOptions.showLineExtras = newValue === 'true';
			this.redraw();
		}

		if (attributeName === 'show-character-extras') {
			this.textBlockOptions.showCharacterExtras = newValue === 'true';
			this.redraw();
		}

		if (attributeName === 'show-placeholder-message') {
			this.textBlockOptions.showPlaceholderMessage = newValue === 'true';
			this.redraw();
		}

		if (attributeName === 'width-adjustment') {
			this.widthAdjustment = parseInt(newValue);
			this.resizeAndRedraw();
		}

		if (attributeName === 'show-metric-lines') {
			this.showMetricLines = newValue === 'true' || newValue === '';
			this.redraw();
		}

		// log(`DisplayCanvas.attributeChangeCallback`, 'end');
	}

	/**
	 * Updates the canvas
	 */
	redraw() {
		// log('DisplayCanvas.redraw', 'start');
		if (!this.isSetUp) {
			// log('DisplayCanvas.redraw', 'end');
			return;
		}
		// log(`THIS CONTEXT`);
		// log(this.ctx);
		// @ts-expect-error 'property does exist'
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// log('this.textBlock');
		// log(this.textBlock);
		if (this.textBlock.hasDrawableCharacters) {
			this.textBlock.draw({
				showPageExtras: this.textBlockOptions.showPageExtras,
				showLineExtras: this.textBlockOptions.showLineExtras,
				showCharacterExtras: this.textBlockOptions.showCharacterExtras,
				showCharacter: true,
			});
			if (this.showMetricLines) this.drawDisplayMetricLines();
		}
		// ANY-INK (B4 integration): a display point Simple shares, in house words.
		// B4 + B5 fix pass: the sentence fits the sheet (preview/placeholder.js): "Type
		// something..." for an empty field, "Your letters show here as you make them." when
		// no made letter is on the sheet, so a sheet with text is never blank and unexplained
		const message = this.textBlockOptions.showPlaceholderMessage
			? placeholderKey(this.textBlockOptions.text, this.textBlock)
			: '';
		if (message) {
			this.ctx.fillStyle = token('--canvas-ink-faint');
			this.ctx.font = '14px sans-serif';
			this.ctx.textBaseline = 'middle';
			let x = this.textBlock.canvasMaxes.xMin;
			let y = this.height / 2;
			this.ctx.fillText(word(message), x, y);
		}

		// log('DisplayCanvas.redraw', 'end');
	}

	/**
	 * A function that makes it easy for external contexts to provide
	 * their own draw function that leverages all the layout computations
	 * from this TextBlock
	 * @param {Function} drawFunction - handles drawing based on passed item
	 */
	iterator(drawFunction) {
		const data = this.textBlock.data;
		for (let block = 0; block < data.length; block++) {
			for (let item = 0; item < data[block].length; item++) {
				drawFunction(data[block][item], this);
			}
		}
	}

	// --------------------------------------------------------------
	// Draw functions for individual pieces
	// --------------------------------------------------------------

	/**
	 * Draws page-specific things to a canvas
	 * @param {CanvasRenderingContext2D} ctx - canvas context
	 * @param {TextBlock} textBlock
	 */
	drawDisplayPageExtras(ctx, textBlock) {
		// log(`displayCanvas.drawDisplayPageExtras`, 'start');
		const canvasMaxes = textBlock.canvasMaxes;
		// log(textBlock);
		const top = canvasMaxes.yMin || 0;
		const bottom = canvasMaxes.yMax === Infinity ? textBlock.pixelHeight : canvasMaxes.yMax;
		const left = canvasMaxes.xMin || 0;
		const right = canvasMaxes.xMax || 1000;
		const width = right - left;
		const height = bottom - top;

		// log(`\t new t/b/l/r: ${top} / ${bottom} / ${left} / ${right}`);

		ctx.fillStyle = 'transparent';
		ctx.strokeStyle = token('--canvas-guide-muted');
		ctx.lineWidth = 1;

		ctx.strokeRect(makeCrisp(left), makeCrisp(top), round(width), round(height));

		// log(`displayCanvas.drawDisplayPageExtras`, 'end');
	}

	/**
	 * Draw line-specific things to a canvas
	 * @param {CanvasRenderingContext2D} ctx - canvas context
	 * @param {Object} charData - data for the first char of the line
	 * @param {TextBlock} textBlock
	 */
	drawDisplayLineExtras(ctx, charData, textBlock) {
		// log(`displayCanvas.drawDisplayLineExtras`, 'start');
		ctx.strokeStyle = token('--canvas-guide-muted');
		ctx.beginPath();
		ctx.moveTo(textBlock.canvasMaxes.xMin, charData.view.dy);
		ctx.lineTo(textBlock.canvasMaxes.xMax, charData.view.dy);
		ctx.closePath();
		ctx.stroke();
		// log(`displayCanvas.drawDisplayLineExtras`, 'end');
	}

	/**
	 * ANY-INK: draws the font's vertical metrics (ascender, cap height, x-height,
	 * baseline, descender) as muted purple hairlines across the canvas, once per
	 * line of text. Positions come from metric_lines.js; the font settings come
	 * from the project the text block was laid out with.
	 */
	drawDisplayMetricLines() {
		const ctx = this.ctx;
		const textBlock = this.textBlock;
		const font = textBlock?.project?.settings?.font;
		if (!ctx || !textBlock || !font) return;
		const right = this.width;
		ctx.strokeStyle = token('--canvas-guide-muted');
		ctx.lineWidth = 1;
		let currentLine = -1;
		textBlock.iterator((charData) => {
			if (!charData.isVisible || !charData.view || charData.lineNumber === currentLine) return;
			currentLine = charData.lineNumber;
			metricLineYs(charData.view, font).forEach(({ y }) => {
				const cy = makeCrisp(y);
				ctx.beginPath();
				ctx.moveTo(0, cy);
				ctx.lineTo(right, cy);
				ctx.stroke();
			});
		});
	}

	/**
	 * Draws char-specific things to a canvas
	 * @param {CanvasRenderingContext2D} ctx - canvas context
	 * @param {Object} charData - data for the char
	 */
	drawDisplayCharacterExtras(ctx, charData) {
		// log(`displayCanvas.drawDisplayCharacterExtras`, 'start');
		const project = getCurrentProject();
		const settings = project.settings.font;
		const scale = charData.view.dz;
		let drawWidth = charData.widths.advance * scale;
		let drawHeight = project.totalVertical * scale;
		let drawY = charData.view.dy - settings.ascent * scale;
		let drawX = charData.view.dx;
		const drawK = charData.widths.kern * scale * -1;

		// log(`\t drawing ${charData.char}`);

		if (charData.widths.kern) {
			// The tint tokens carry their own alpha
			ctx.fillStyle =
				charData.widths.kern > 0
					? token('--canvas-kern-positive')
					: token('--canvas-kern-negative');
			ctx.fillRect(drawX + drawWidth - drawK, drawY, drawK, drawHeight);
		}

		ctx.fillStyle = 'transparent';
		ctx.strokeStyle = token('--canvas-guide-muted');
		ctx.lineWidth = 1;

		if (this.drawCrisp) {
			drawX = makeCrisp(drawX);
			drawY = makeCrisp(drawY);
			drawWidth = round(drawWidth);
			drawHeight = round(drawHeight);
		}

		ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);

		// log(`displayCanvas.drawDisplayCharacterExtras`, 'end');
	}

	/**
	 * Draws a char to a canvas
	 * @param {CanvasRenderingContext2D} ctx - canvas context
	 * @param {Object} charData - data for the char
	 */
	drawDisplayCharacter(ctx, charData) {
		// log(`displayCanvas.drawDisplayCharacter`, 'start');
		// log(this);
		// log(charData);
		// log(`THIS CONTEXT`);
		// log(ctx);
		// const settings = getCurrentProject().settings.font;
		const item = charData.item;

		// log(`charData.view`);
		// log(`dx: ${charData.view.dx}, dy: ${charData.view.dy}, dz: ${charData.view.dz}`);
		const view = clone(charData.view);
		// log(`cloned view`);
		// log(`dx: ${view.dx}, dy: ${view.dy}, dz: ${view.dz}`);

		if (item) {
			ctx.fillStyle = token('--canvas-ink');
			ctx.strokeStyle = 'transparent';
			drawGlyph(item, ctx, view, 1, token('--canvas-ink'));
		}

		// log(`displayCanvas.drawDisplayCharacter`, 'end');
	}
}
