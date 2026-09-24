// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	<preview-strip> (Milestone 5, D-011): the always-visible sample-text strip fixed
	to the bottom of the window. It is mounted in index.html next to #app__wrapper,
	so page navigation never rebuilds it.

	- Sample text input, presets menu, points slider, 'Real font' and 'Metrics' toggles.
	- Canvas mode: a DisplayCanvas (flavor gs) redrawn once per animation frame from
	  the editor's pub/sub topics. Real-font mode: a FontPreview (OTF via font-flux-js)
	  rebuilt with a 400 ms trailing debounce, and only on the topics that change the font.
	- Follows the current editor: on every 'anyink-page-change' it re-subscribes when
	  getCurrentProjectEditor() changed, hides on app-level pages, shows otherwise.
	- Double-click a glyph in the strip to edit it.
	- Text, size and toggles live in app prefs (D-007) and go out as 'previewOptions'.
	Light DOM on purpose: upstream's keyboard handler already ignores keys typed in
	an <input>, and the app's resets style the controls.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { makeCrisp } from '../../common/functions.js';
import { closeAllContextMenus, makeContextMenu } from '../../controls/dialogs/dialogs.js';
import { FontPreview } from '../../controls/font-preview/font_preview.js';
import { DisplayCanvas } from '../../display_canvas/display_canvas.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { onThemeChange, token } from '../theme/theme.js';
import { findCharAtPoint, navigationTargetForChar } from './hit_test.js';
import { injectStyleOnce } from './inject_style.js';
import { centeringLineGap, nativeFirstLineView } from './layout.js';
import { metricLineYs } from './metric_lines.js';
import { makePointsSlider } from './points_slider.js';
import style from './preview-strip.css?inline';
import { DEFAULT_SAMPLE_TEXT, makePresetRows } from './sample_presets.js';
import { makeFrameCoalescer, makeTrailingDebounce } from './scheduling.js';
import { makeEditorTracker } from './subscriptions.js';
import { DEFAULT_PT, clampPt, ptToPx } from './units.js';

export const STRIP_HEIGHT = 150;
export const STRIP_HEIGHT_VAR = '--anyink-strip-height';
export const PAGE_CHANGE_EVENT = 'anyink-page-change';
export const FONT_REBUILD_MS = 400;
const PAGE_PADDING = 10;
const STYLE_ID = 'anyink-preview-strip-style';

export const PREF_KEYS = {
	text: 'previewText',
	pt: 'previewPt',
	realFont: 'previewRealFont',
	metrics: 'previewMetrics',
};

/**
 * Tell the layout how much room the strip takes (0 when hidden).
 * app.css sizes #app__wrapper with calc(100% - var(--anyink-strip-height)).
 * @param {Number} px
 * @param {Document} [doc]
 */
export function setStripHeight(px, doc = document) {
	doc.documentElement.style.setProperty(STRIP_HEIGHT_VAR, `${px}px`);
}

/**
 * Read the remembered strip options from app prefs.
 * @returns {{text: String, pt: Number, realFont: Boolean, metrics: Boolean}}
 */
export function readStripPrefs() {
	return {
		text: String(getPref(PREF_KEYS.text, DEFAULT_SAMPLE_TEXT) ?? ''),
		pt: clampPt(getPref(PREF_KEYS.pt, DEFAULT_PT)),
		realFont: !!getPref(PREF_KEYS.realFont, false),
		metrics: !!getPref(PREF_KEYS.metrics, false),
	};
}

export class PreviewStrip extends HTMLElement {
	constructor() {
		super();
		this.isBuilt = false;
		this.visible = false;
		this.options = readStripPrefs();
		/** @type {DisplayCanvas | FontPreview | null} */
		this.renderer = null;
		/** @type {HTMLCanvasElement | null} */
		this.overlay = null;
		this.needsResize = true;
		this.fontDirty = true;
		this.editor = null;
		this.unsubscribeThemeChange = null;

		this.tracker = makeEditorTracker({
			onRedraw: () => this.scheduleRedraw(),
			onFontChange: () => {
				this.fontDirty = true;
				if (this.options.realFont) this.scheduleFontRebuild();
			},
		});
		this.scheduleRedraw = makeFrameCoalescer(() => this.redrawNow());
		this.scheduleFontRebuild = makeTrailingDebounce(() => this.rebuildFontNow(), FONT_REBUILD_MS);

		this.handlePageChange = (event) => this.onPageChange(event?.detail || {});
		this.handleWindowResize = () => {
			this.needsResize = true;
			this.scheduleRedraw();
		};
		this.handleKeyDown = (event) => this.onKeyDown(event);
	}

	// --------------------------------------------------------------
	// Lifecycle
	// --------------------------------------------------------------

	connectedCallback() {
		injectStyleOnce(STYLE_ID, style, this.ownerDocument);
		if (!this.isBuilt) this.build();
		this.hidden = true;
		this.visible = false;
		window.addEventListener(PAGE_CHANGE_EVENT, this.handlePageChange);
		window.addEventListener('resize', this.handleWindowResize);
		this.addEventListener('keydown', this.handleKeyDown);
		if (this.unsubscribeThemeChange) this.unsubscribeThemeChange();
		this.unsubscribeThemeChange = onThemeChange(() => this.scheduleRedraw());
		this.syncToApp();
	}

	disconnectedCallback() {
		window.removeEventListener(PAGE_CHANGE_EVENT, this.handlePageChange);
		window.removeEventListener('resize', this.handleWindowResize);
		this.removeEventListener('keydown', this.handleKeyDown);
		if (this.unsubscribeThemeChange) {
			this.unsubscribeThemeChange();
			this.unsubscribeThemeChange = null;
		}
		this.scheduleFontRebuild.cancel();
		this.tracker.detach();
		this.editor = null;
		this.visible = false;
		setStripHeight(0, this.ownerDocument);
	}

	/** Builds the light-DOM controls once. */
	build() {
		this.isBuilt = true;
		this.classList.add('preview-strip');

		// Left column: eyebrow, text, presets + size, toggles
		const controls = makeElement({ className: 'preview-strip__controls' });
		controls.appendChild(makeElement({ className: 'preview-strip__eyebrow', content: 'Preview' }));

		this.textInput = /** @type {HTMLInputElement} */ (
			makeElement({
				tag: 'input',
				className: 'preview-strip__text',
				attributes: {
					type: 'text',
					placeholder: 'Sample text',
					spellcheck: 'false',
					autocomplete: 'off',
					'aria-label': 'Preview sample text',
				},
			})
		);
		this.textInput.value = this.options.text;
		this.textInput.addEventListener('input', () => this.setText(this.textInput.value));
		controls.appendChild(this.textInput);

		const sizeRow = makeElement({ className: 'preview-strip__row' });
		this.presetsButton = makeElement({
			tag: 'button',
			className: 'preview-strip__presets',
			content: 'Presets &#9662;',
			attributes: { type: 'button', title: 'Sample text presets' },
		});
		this.presetsButton.addEventListener('click', () => this.openPresets());
		this.slider = makePointsSlider({
			value: this.options.pt,
			onInput: (pt) => this.setPoints(pt, { persist: false }),
			onChange: (pt) => this.setPoints(pt),
			doc: this.ownerDocument,
		});
		sizeRow.appendChild(this.presetsButton);
		sizeRow.appendChild(this.slider.element);
		controls.appendChild(sizeRow);

		const toggles = makeElement({ className: 'preview-strip__toggles' });
		this.realFontToggle = this.makeToggle('Real font', this.options.realFont, (on) =>
			this.setRealFont(on)
		);
		this.metricsToggle = this.makeToggle('Metrics', this.options.metrics, (on) =>
			this.setMetrics(on)
		);
		toggles.appendChild(this.realFontToggle.label);
		toggles.appendChild(this.metricsToggle.label);
		controls.appendChild(toggles);
		this.appendChild(controls);

		// Right: the sheet
		this.canvasWrapper = makeElement({ className: 'preview-strip__canvas-wrapper' });
		this.canvasWrapper.addEventListener('dblclick', (event) => this.onDoubleClick(event));
		this.canvasWrapper.addEventListener('mousemove', (event) => this.onMouseMove(event));
		this.canvasWrapper.addEventListener('mouseleave', () =>
			this.canvasWrapper.classList.remove('is-over-glyph')
		);
		this.appendChild(this.canvasWrapper);
	}

	/**
	 * @param {String} text
	 * @param {Boolean} checked
	 * @param {Function} onChange - (Boolean)
	 * @returns {{label: HTMLElement, input: HTMLInputElement}}
	 */
	makeToggle(text, checked, onChange) {
		const label = makeElement({ tag: 'label', className: 'preview-strip__toggle' });
		const input = /** @type {HTMLInputElement} */ (
			makeElement({ tag: 'input', attributes: { type: 'checkbox' } })
		);
		input.checked = !!checked;
		input.addEventListener('change', () => onChange(input.checked));
		label.appendChild(input);
		label.appendChild(makeElement({ content: text }));
		return { label, input };
	}

	// --------------------------------------------------------------
	// Visibility and the current editor
	// --------------------------------------------------------------

	/**
	 * Self-check: show when an editor page is on screen (or when there is no app
	 * wrapper at all, as on a test page), hide on app-level pages.
	 */
	syncToApp() {
		const wrapper = this.ownerDocument.querySelector('#app__wrapper');
		if (!wrapper) {
			this.show();
			this.attachEditor(getCurrentProjectEditor());
			return;
		}
		if (wrapper.querySelector('#app__top-bar')) {
			this.show();
			this.attachEditor(getCurrentProjectEditor());
		} else {
			this.hide();
		}
	}

	/**
	 * @param {{appLevel?: Boolean, page?: String}} detail - from 'anyink-page-change'
	 */
	onPageChange(detail) {
		if (detail.appLevel) {
			this.hide();
			return;
		}
		this.show();
		this.attachEditor(getCurrentProjectEditor());
		this.scheduleRedraw();
	}

	show() {
		if (this.visible) return;
		this.visible = true;
		this.hidden = false;
		setStripHeight(STRIP_HEIGHT, this.ownerDocument);
		this.needsResize = true;
		this.scheduleRedraw();
	}

	hide() {
		this.visible = false;
		this.hidden = true;
		setStripHeight(0, this.ownerDocument);
		this.scheduleFontRebuild.cancel();
	}

	/**
	 * Subscribe to an editor; unsubscribes from the previous one when it differs.
	 * @param {Object} editor - ProjectEditor
	 * @returns {Boolean} true when the editor changed
	 */
	attachEditor(editor) {
		const changed = this.tracker.sync(editor);
		this.editor = this.tracker.current();
		if (changed) {
			this.fontDirty = true;
			this.scheduleRedraw();
		}
		return changed;
	}

	// --------------------------------------------------------------
	// Options
	// --------------------------------------------------------------

	/** @returns {{text: String, pt: Number, px: Number, realFont: Boolean, metrics: Boolean}} */
	getOptions() {
		const { text, pt, realFont, metrics } = this.options;
		return { text, pt, px: ptToPx(pt), realFont, metrics };
	}

	get fontSizePx() {
		return ptToPx(this.options.pt);
	}

	/**
	 * @param {String} text
	 * @param {Object} [o]
	 * @param {Boolean} [o.persist=true] - write to app prefs
	 * @param {Boolean} [o.fromRenderer=false] - typed into the real-font textarea
	 */
	setText(text, { persist = true, fromRenderer = false } = {}) {
		const next = String(text ?? '');
		if (next === this.options.text) return;
		this.options.text = next;
		if (this.textInput && this.textInput.value !== next) this.textInput.value = next;
		if (persist) setPref(PREF_KEYS.text, next);
		// The real-font renderer already rebuilt itself when the text was typed into it.
		if (!fromRenderer) this.fontDirty = true;
		this.publishOptions();
		this.scheduleRedraw();
	}

	/**
	 * @param {Number} pt - points, clamped to 8..200
	 * @param {Object} [o]
	 * @param {Boolean} [o.persist=true]
	 */
	setPoints(pt, { persist = true } = {}) {
		const next = clampPt(pt);
		if (persist) setPref(PREF_KEYS.pt, next);
		if (next === this.options.pt) return;
		this.options.pt = next;
		if (this.slider) this.slider.set(next);
		this.publishOptions();
		this.scheduleRedraw();
	}

	/** @param {Boolean} on */
	setRealFont(on) {
		const next = !!on;
		if (this.realFontToggle) this.realFontToggle.input.checked = next;
		if (next === this.options.realFont) return;
		this.options.realFont = next;
		setPref(PREF_KEYS.realFont, next);
		this.fontDirty = true;
		this.needsResize = true;
		this.publishOptions();
		this.scheduleRedraw();
	}

	/** @param {Boolean} on */
	setMetrics(on) {
		const next = !!on;
		if (this.metricsToggle) this.metricsToggle.input.checked = next;
		if (next === this.options.metrics) return;
		this.options.metrics = next;
		setPref(PREF_KEYS.metrics, next);
		this.publishOptions();
		this.scheduleRedraw();
	}

	publishOptions() {
		if (this.editor && typeof this.editor.publish === 'function') {
			this.editor.publish('previewOptions', this.getOptions());
		}
	}

	// --------------------------------------------------------------
	// Rendering
	// --------------------------------------------------------------

	/**
	 * Line gap that centers one line in the sheet (see layout.js).
	 * @param {Number} px - font size in CSS px
	 * @returns {Number}
	 */
	lineGapFor(px) {
		const area = this.canvasWrapper?.clientHeight || STRIP_HEIGHT - 2 * 8;
		return centeringLineGap(area, PAGE_PADDING, px);
	}

	/** Makes sure the right renderer for the current mode is in the sheet. */
	ensureRenderer() {
		const wantFont = this.options.realFont;
		const have = this.renderer;
		if (have && have.isConnected && have instanceof FontPreview === wantFont) return have;
		this.removeRenderer();
		const renderer = wantFont ? this.makeFontRenderer() : this.makeCanvasRenderer();
		this.renderer = renderer;
		this.canvasWrapper.appendChild(renderer); // connectedCallback draws it
		this.needsResize = false;
		this.fontDirty = false;
		if (wantFont) this.ensureOverlay();
		else this.removeOverlay();
		return renderer;
	}

	removeRenderer() {
		const old = this.renderer;
		if (!old) return;
		// @ts-expect-error font-preview keeps its FontFace on the element
		const face = old.currentFontFace;
		if (face && this.ownerDocument.fonts) this.ownerDocument.fonts.delete(face);
		old.remove();
		this.renderer = null;
	}

	makeCanvasRenderer() {
		const px = this.fontSizePx;
		const canvas = new DisplayCanvas({
			text: this.options.text,
			fontSize: px,
			lineGap: this.lineGapFor(px),
			pagePadding: PAGE_PADDING,
			pageWidth: 'fit',
			pageHeight: 'fit',
			showPlaceholderMessage: true,
		});
		canvas.setAttribute('hi-dpi', '');
		canvas.showMetricLines = this.options.metrics;
		return canvas;
	}

	makeFontRenderer() {
		const px = this.fontSizePx;
		const preview = new FontPreview({
			text: this.options.text,
			fontSize: px,
			lineGap: this.lineGapFor(px),
			pagePadding: PAGE_PADDING,
			previewFlavor: 'otf',
			enableLigatures: true,
			enableKerning: true,
		});
		preview.addEventListener('text-change', (event) => {
			// @ts-expect-error CustomEvent detail
			this.setText(event.detail.text, { fromRenderer: true });
		});
		return preview;
	}

	/** One redraw per frame; scheduled through this.scheduleRedraw. */
	redrawNow() {
		if (!this.visible || !this.isConnected) return;
		const renderer = this.ensureRenderer();
		const options = renderer.textBlockOptions;
		if (!options) return;
		const px = this.fontSizePx;
		options.text = this.options.text;
		options.fontSize = px;
		options.lineGap = this.lineGapFor(px);
		options.pagePadding = PAGE_PADDING;

		if (renderer instanceof FontPreview) {
			if (this.fontDirty) {
				this.fontDirty = false;
				renderer.rebuildAndRedraw();
			} else {
				renderer.redraw();
			}
			this.drawMetricsOverlay();
			return;
		}

		renderer.showMetricLines = this.options.metrics;
		if (this.needsResize) {
			this.needsResize = false;
			renderer.resizeAndRedraw();
		} else {
			renderer.updateTextBlock();
			renderer.redraw();
		}
	}

	/** Real-font mode: regenerate the OTF. Debounced through this.scheduleFontRebuild. */
	rebuildFontNow() {
		if (!this.visible || !this.options.realFont) return;
		const renderer = this.renderer;
		if (renderer instanceof FontPreview && renderer.isConnected) {
			this.fontDirty = false;
			renderer.rebuildAndRedraw();
		}
	}

	ensureOverlay() {
		if (!this.overlay) {
			this.overlay = /** @type {HTMLCanvasElement} */ (
				makeElement({ tag: 'canvas', className: 'preview-strip__metrics-overlay' })
			);
		}
		if (!this.overlay.isConnected) this.canvasWrapper.appendChild(this.overlay);
	}

	removeOverlay() {
		if (this.overlay) this.overlay.remove();
	}

	/** Purple metric lines over the native (real-font) text, or a clear overlay. */
	drawMetricsOverlay() {
		const canvas = this.overlay;
		if (!canvas || !canvas.isConnected) return;
		const width = this.canvasWrapper.clientWidth;
		const height = this.canvasWrapper.clientHeight;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		if (!this.options.metrics) return;
		const font = this.editor?.project?.settings?.font;
		if (!font) return;
		const px = this.fontSizePx;
		const view = nativeFirstLineView({
			fontSizePx: px,
			lineGap: this.lineGapFor(px),
			pagePadding: PAGE_PADDING,
			upm: font.upm,
			ascent: font.ascent,
			descent: font.descent,
		});
		ctx.strokeStyle = token('--canvas-guide-muted');
		ctx.lineWidth = 1;
		metricLineYs(view, font).forEach(({ y }) => {
			const cy = makeCrisp(y);
			ctx.beginPath();
			ctx.moveTo(0, cy);
			ctx.lineTo(width, cy);
			ctx.stroke();
		});
	}

	// --------------------------------------------------------------
	// Presets menu
	// --------------------------------------------------------------

	openPresets() {
		const { char, stored } = currentGlyphInfo(this.editor);
		const rows = [];
		let lastGroup = null;
		makePresetRows({ currentChar: char, storedContext: stored }).forEach((row) => {
			if (lastGroup && row.group !== lastGroup) rows.push({ name: 'hr' });
			lastGroup = row.group;
			rows.push({
				name: escapeHTML(row.name),
				note: escapeHTML(row.note),
				icon: row.text === this.options.text ? 'selected' : 'notSelected',
				onClick: () => this.setText(row.text),
			});
		});

		closeAllContextMenus();
		const rect = this.presetsButton.getBoundingClientRect();
		const menu = makeContextMenu(rows, rect.left, rect.top);
		this.ownerDocument.body.appendChild(menu);
		// resets.css transitions every property; the menu must jump into place, not slide.
		menu.style.transition = 'none';
		// Open upward so the menu never sits under the strip.
		const room = Math.max(0, rect.top - 8);
		if (menu.offsetHeight > room) menu.style.maxHeight = `${room}px`;
		menu.style.top = `${Math.max(0, rect.top - menu.offsetHeight - 4)}px`;
		menu.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') closeAllContextMenus();
		});
		menu.focus(); // makeContextMenu focuses before the menu is in the document
	}

	// --------------------------------------------------------------
	// Pointer and keyboard
	// --------------------------------------------------------------

	/**
	 * @param {MouseEvent} event
	 * @returns {Object|false} charData under the pointer (canvas mode only)
	 */
	hitTest(event) {
		const renderer = this.renderer;
		if (!(renderer instanceof DisplayCanvas) || !renderer.textBlock || !renderer.canvas) return false;
		// @ts-expect-error canvas is an HTMLCanvasElement
		const rect = renderer.canvas.getBoundingClientRect();
		const font = renderer.textBlock.project?.settings?.font;
		return findCharAtPoint(
			renderer.textBlock.data,
			event.clientX - rect.left,
			event.clientY - rect.top,
			font
		);
	}

	/** @param {MouseEvent} event */
	onMouseMove(event) {
		const over = !!navigationTargetForChar(this.hitTest(event));
		this.canvasWrapper.classList.toggle('is-over-glyph', over);
	}

	/** Double-click a glyph in the strip to go edit it. @param {MouseEvent} event */
	onDoubleClick(event) {
		const target = navigationTargetForChar(this.hitTest(event));
		const editor = this.editor;
		if (!target || !editor) return;
		editor.nav.page = target.page;
		editor.selectedItemID = target.id;
		editor.navigate();
	}

	/**
	 * Keys typed into the strip belong to the strip: stop them before the app's
	 * canvas shortcuts see them (the real-font textarea lives in a shadow root, so
	 * upstream's activeElement check would not recognise it). Ctrl+Z is left to the
	 * browser. Escape leaves the text field.
	 * @param {KeyboardEvent} event
	 */
	onKeyDown(event) {
		if (event.key === 'Escape') {
			if (event.target === this.textInput) this.textInput.blur();
			// @ts-expect-error font-preview exposes its textarea
			else if (event.target === this.renderer && this.renderer?.textElement) {
				// @ts-expect-error font-preview exposes its textarea
				this.renderer.textElement.blur();
			}
		}
		event.stopPropagation();
	}
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * Character and stored context string of the glyph being edited.
 * Reads project data only; never creates a glyph.
 * @param {Object} editor
 * @returns {{char: String, stored: String}}
 */
export function currentGlyphInfo(editor) {
	const none = { char: '', stored: '' };
	if (!editor) return none;
	const id = editor.selectedGlyphID;
	if (typeof id !== 'string' || !id.startsWith('glyph-')) return none;
	const item = editor.project?.getItem ? editor.project.getItem(id) : false;
	let char = item?.char || '';
	if (!char) {
		try {
			const code = parseInt(id.slice('glyph-'.length), 16);
			if (Number.isFinite(code)) char = String.fromCodePoint(code);
		} catch {
			char = '';
		}
	}
	return { char, stored: item?.contextCharacters || '' };
}

/**
 * @param {String} text
 * @returns {String} safe for innerHTML
 */
export function escapeHTML(text) {
	return String(text ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
