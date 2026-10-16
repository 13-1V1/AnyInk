// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	<preview-strip> (Milestone 5, D-011): the always-visible sample-text strip fixed
	to the bottom of the window. It is mounted in index.html next to #app__wrapper,
	so page navigation never rebuilds it.

	- Sample text input, Samples menu (presets), points slider, 'Real font' and 'Guide lines'
	  (metrics) toggles. B4: every label is a words key (src/anyink/words, strip.* and
	  line.guides), the same in both modes (UX-BEGINNER.md 2.4 B, 4.0), in sentence case.
	- Canvas mode: a DisplayCanvas (flavor gs) redrawn once per animation frame from
	  the editor's pub/sub topics. Real-font mode: a FontPreview (OTF via font-flux-js)
	  rebuilt with a 400 ms trailing debounce, and only on the topics that change the font.
	- Follows the current editor: on every 'anyink-page-change' it re-subscribes when
	  getCurrentProjectEditor() changed, hides on app-level pages, shows otherwise.
	- Double-click a glyph in the strip to edit it (opened like Show me, show_item.js).
	- Text, size and toggles live in app prefs (D-007) and go out as 'previewOptions'.
	- B1: one line on the sheet with the font check's first problem ('fontCheck' topic), how
	  many more letters need fixing, [Show me] and, when it has a safe fix, [Fix it] (fix_it.js;
	  the check runs again at once, so the line moves on without the 2 s wait). While it shows,
	  the corner of the sheet under it is cut out of the letters' page (clip-path), so it never
	  sits on a letter, and the letters never move when it comes or goes. It steps aside while
	  the real-font sheet already says the font can't be shown (<font-preview>'s
	  'font-status' event), so only one line ever speaks.
	Light DOM on purpose: upstream's keyboard handler already ignores keys typed in
	an <input>, and the app's resets style the controls.
	- B4 integration (UX-BEGINNER.md 6.2 Strip, B5's visibility.js 'strip' area): each toggle
	  carries its id (data-anyink-strip="realFont" / "guideLines"); a toggle the mode hides is
	  hidden, and what it turns on is off while it is hidden (the remembered pref is kept for
	  All tools), so Simple never shows a real-font sheet or guide lines it has no switch for.
	  The strip follows 'anyink-mode-change'.
	- B6 + B7 finalize (4.0 Preview strip): in Simple with the Next line on, the text starts as the
	  font's name until he types or picks a sample (followTryItText), as the coach reads it.
	- B12 (UX-BEGINNER.md 4.0, 4.6; Simple with 'tryIt'): the strip grows into Try it
	  (src/anyink/tryit/expand.js; the same element, sheet and letters, never rebuilt). Try it has
	  its own size (72 pt to start, pref 'tryItPt'), its Guide lines switch, one line centered or
	  wrapped lines (layout.js tryItLayout) and B1's check as one line (tryit/font_check_line.js)
	  instead of the corner line. [Big preview] opens it. Letters not made yet show as faint
	  outlined stand-ins (tryit/stand_ins.js): the sheet is laid out on a view of the font in which
	  they are a letter wide; a double-click opens one; a legend says "gray = not made yet" until 5
	  letters are ready. After each redraw of its letters the strip says STRIP_REDRAW_EVENT
	  { textBlock } on itself, for the gap handle.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { makeCrisp } from '../../common/functions.js';
import { closeAllContextMenus, makeContextMenu } from '../../controls/dialogs/dialogs.js';
import { FontPreview } from '../../controls/font-preview/font_preview.js';
import { DisplayCanvas } from '../../display_canvas/display_canvas.js';
import { TextBlock } from '../../display_canvas/text_block.js';
import { openPathOf } from '../coach/open_shape.js';
import { readyCount } from '../topbar/ready_count.js';
import { makeTryIt, TRY_IT_DEFAULT_PT, TRY_IT_PT_PREF } from '../tryit/expand.js';
import { fontCheckLineState, makeFontCheckLine } from '../tryit/font_check_line.js';
import {
	drawStandIns,
	legendShows,
	makeLayoutProject,
	makeMeasure,
	standInsWanted,
} from '../tryit/stand_ins.js';
import { defaultTryItText } from '../coach/font_facts.js';
import { SAVE_STATUS_EVENT } from '../files/save_status.js';
import { getLastFontCheck, runFontCheckNow } from '../fontcheck/font_check.js';
import { isFeatureOn } from '../mode/features.js';
import { HIDDEN_ATTRIBUTE } from '../mode/hide.js';
import { isSimpleMode, MODE_EVENT } from '../mode/mode.js';
import { isShown } from '../mode/visibility.js';
import { getPref, setPref } from '../prefs/prefs.js';
import { onThemeChange, token } from '../theme/theme.js';
import { labelCase, word, wordEntry } from '../words/words.js';
import { canFixProblem, fixProblem } from './fix_it.js';
import { firstCheckProblem, hintFor, isGapId, moreText } from './font_status.js';
import { findCharAtPoint, navigationTargetForChar } from './hit_test.js';
import { injectStyleOnce } from './inject_style.js';
import { stripLetterTooltip } from './letter_tooltip.js';
import {
	centeringLineGap,
	nativeFirstLineView,
	tryItLayout,
	writtenOffSheet,
} from './layout.js';
import { metricLineYs } from './metric_lines.js';
import { makePointsSlider } from './points_slider.js';
import style from './preview-strip.css?inline';
import { makeNoticeLine } from './notice_line.js';
import noticeStyle from './preview-notice.css?inline';
import { DEFAULT_SAMPLE_TEXT, makePresetRows } from './sample_presets.js';
import { makeFrameCoalescer, makeTrailingDebounce } from './scheduling.js';
import { isItemOpen, showItem } from './show_item.js';
import { makeEditorTracker } from './subscriptions.js';
import { stripOwnsKey } from './strip_keys.js';
import { DEFAULT_PT, clampPt, ptToPx } from './units.js';

export const STRIP_HEIGHT = 150;
export const STRIP_HEIGHT_VAR = '--anyink-strip-height';
export const PAGE_CHANGE_EVENT = 'anyink-page-change';
export const FONT_REBUILD_MS = 400;
/** B1: px of clear sheet kept around the font check line's corner (preview-strip.css). */
export const CHECK_GAP = 4;
/** B12: said on the strip after every redraw of its letters, detail { textBlock } */
export const STRIP_REDRAW_EVENT = 'anyink-strip-redraw';
const PAGE_PADDING = 10;
const STYLE_ID = 'anyink-preview-strip-style';
const NOTICE_STYLE_ID = 'anyink-preview-notice-style';

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
		/** B12: the sheet's height when the letters were last sized to it (see sheetHeight) */
		this.sheetArea = 0;
		this.fontDirty = true;
		this.editor = null;
		this.unsubscribeThemeChange = null;
		/** @type {{itemId: String|null, problem: String|null, text: String, more: Number}|null}
		 * the font check's first problem */
		this.checkProblem = null;
		/** true while the real-font sheet shows its own "Can't show your font yet" notice */
		this.sheetSaysCantShow = false;
		/** true while the corner under the check line is cut out of the letters' page */
		this.hasCheckCorner = false;
		/** B12: Try it's controller (tryit/expand.js), made in build() */
		this.tryIt = null;
		/** B12: the last 'fontCheck' result for this editor, null before the first */
		this.checkPayload = null;
		/** B12: how many stand-ins the last redraw drew */
		this.standInCount = 0;
		/** B12: true while Try it's words wrap onto more lines (layout.js tryItLayout) */
		this.tryItWraps = false;
		this.measureStandIn = makeMeasure(this.ownerDocument);

		this.tracker = makeEditorTracker({
			onRedraw: () => this.scheduleRedraw(),
			onFontChange: () => {
				this.fontDirty = true;
				if (this.realFontOn) this.scheduleFontRebuild();
			},
			onFontCheck: (payload) => {
				this.checkPayload = payload || null;
				this.setCheckProblem(firstCheckProblem(payload));
			},
		});
		this.scheduleRedraw = makeFrameCoalescer(() => this.redrawNow());
		this.scheduleFontRebuild = makeTrailingDebounce(() => this.rebuildFontNow(), FONT_REBUILD_MS);

		this.handlePageChange = (event) => this.onPageChange(event?.detail || {});
		this.handleWindowResize = () => {
			this.needsResize = true;
			this.measureCheckCorner();
			this.scheduleRedraw();
		};
		this.handleKeyDown = (event) => this.onKeyDown(event);
		this.handleModeChange = () => this.applyMode();
		// B4 + B5 finalize: every change (a History step, Undo, Redo) is heard by the save status;
		// the strip redraws on it too, since a shape added by the Rectangle or Oval tool publishes
		// nothing the strip subscribes to, and the empty sheet's sentence stayed over a made letter
		this.handleChange = (event) => {
			const changed = event?.detail?.editor;
			if (changed && changed === this.editor) this.scheduleRedraw();
		};
	}

	/** B4 integration: Real font is on, and the mode shows its switch (6.2 Strip). */
	get realFontOn() {
		return !!this.options.realFont && isShown('strip', 'realFont');
	}

	/** B4 integration: guide lines are on, and the mode shows their switch (6.2 Strip). */
	get metricsOn() {
		return !!this.options.metrics && this.guideLinesShown;
	}

	/** B12: Try it shows the Guide lines switch in Simple too (4.6) */
	get guideLinesShown() {
		return isShown('strip', 'guideLines') || this.tryItOpen;
	}

	/** B12: Try it is open */
	get tryItOpen() {
		return !!this.tryIt?.isOpen;
	}

	/** B12: letters not made yet are drawn as stand-ins (Simple, 'tryIt', the canvas sheet) */
	get standInsOn() {
		return standInsWanted() && !this.realFontOn;
	}

	/**
	 * B4 integration: shows the toggles the mode shows and redraws with what is on now.
	 */
	applyMode() {
		if (!this.isBuilt) return;
		this.followTryItText();
		[
			[this.realFontToggle, 'realFont'],
			[this.metricsToggle, 'guideLines'],
		].forEach(([toggle, id]) => {
			const hidden = id === 'guideLines' ? !this.guideLinesShown : !isShown('strip', id);
			toggle.label.toggleAttribute('hidden', hidden);
			toggle.label.toggleAttribute(HIDDEN_ATTRIBUTE, hidden);
		});
		// B12: [Big preview] opens Try it (Simple, 'tryIt'); not inside Try it itself
		const big = this.tryIt?.elements.bigPreview;
		if (big) {
			const hidden = !isShown('strip', 'bigPreview') || this.tryItOpen;
			big.hidden = hidden;
			big.toggleAttribute(HIDDEN_ATTRIBUTE, hidden);
		}
		this.updateCheckLine();
		this.fontDirty = true;
		this.needsResize = true;
		this.scheduleRedraw();
	}

	// --------------------------------------------------------------
	// Lifecycle
	// --------------------------------------------------------------

	connectedCallback() {
		injectStyleOnce(STYLE_ID, style, this.ownerDocument);
		injectStyleOnce(NOTICE_STYLE_ID, noticeStyle, this.ownerDocument);
		if (!this.isBuilt) this.build();
		this.hidden = true;
		this.visible = false;
		window.addEventListener(PAGE_CHANGE_EVENT, this.handlePageChange);
		window.addEventListener(MODE_EVENT, this.handleModeChange);
		window.addEventListener(SAVE_STATUS_EVENT, this.handleChange);
		window.addEventListener('resize', this.handleWindowResize);
		this.addEventListener('keydown', this.handleKeyDown);
		this.tryIt?.install();
		if (this.unsubscribeThemeChange) this.unsubscribeThemeChange();
		this.unsubscribeThemeChange = onThemeChange(() => this.scheduleRedraw());
		this.syncToApp();
	}

	disconnectedCallback() {
		this.tryIt?.close({ cause: 'gone' });
		this.tryIt?.uninstall();
		window.removeEventListener(PAGE_CHANGE_EVENT, this.handlePageChange);
		window.removeEventListener(MODE_EVENT, this.handleModeChange);
		window.removeEventListener(SAVE_STATUS_EVENT, this.handleChange);
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
		controls.appendChild(
			makeElement({ className: 'preview-strip__eyebrow', content: escapeHTML(word('strip.title')) })
		);

		this.textInput = /** @type {HTMLInputElement} */ (
			makeElement({
				tag: 'input',
				className: 'preview-strip__text',
				attributes: {
					type: 'text',
					placeholder: word('strip.textPlaceholder'),
					spellcheck: 'false',
					autocomplete: 'off',
					'aria-label': word('strip.textLabel'),
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
			content: `${escapeHTML(word('strip.samples'))} &#9662;`,
			attributes: { type: 'button', title: word('strip.samplesHint') },
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
		this.realFontToggle = this.makeToggle(word('strip.realFont'), this.options.realFont, (on) =>
			this.setRealFont(on)
		);
		this.metricsToggle = this.makeToggle(
			labelCase(word('line.guides')),
			this.options.metrics,
			(on) => this.setMetrics(on)
		);
		this.markToggle(this.realFontToggle, 'realFont', 'real-font');
		this.markToggle(this.metricsToggle, 'guideLines', 'guide-lines');
		toggles.appendChild(this.realFontToggle.label);
		toggles.appendChild(this.metricsToggle.label);
		controls.appendChild(toggles);
		// B12: Try it's own parts (shown only while it is open) and [Big preview]
		this.tryIt = makeTryIt(this, { doc: this.ownerDocument });
		toggles.appendChild(this.tryIt.elements.bigPreview);
		this.appendChild(this.tryIt.elements.head);
		this.appendChild(controls);

		// Right: the sheet
		this.canvasWrapper = makeElement({ className: 'preview-strip__canvas-wrapper' });
		this.canvasWrapper.addEventListener('dblclick', (event) => this.onDoubleClick(event));
		this.canvasWrapper.addEventListener('mousemove', (event) => this.onMouseMove(event));
		this.canvasWrapper.addEventListener('mouseleave', () => {
			this.canvasWrapper.classList.remove('is-over-glyph');
			this.canvasWrapper.removeAttribute('title');
		});
		this.canvasWrapper.addEventListener('font-status', (event) =>
			// @ts-expect-error CustomEvent detail
			this.onFontStatus(event.detail || {})
		);
		// The page the letters are laid out in; it stops short of the check line's band.
		this.page = makeElement({ className: 'preview-strip__page' });
		this.canvasWrapper.appendChild(this.page);

		// B1: the font check's first problem, one line on the sheet.
		this.checkLine = makeNoticeLine({
			doc: this.ownerDocument,
			onShowMe: (itemId) => showItem(this.editor, itemId),
			onFixIt: (problem) => this.fixCheckProblem(problem),
		});
		this.checkLine.element.classList.add('preview-strip__check');
		this.canvasWrapper.appendChild(this.checkLine.element);
		// B12: the layer over the letters for the gap handle, and the stand-ins' legend
		this.canvasWrapper.appendChild(this.tryIt.slots.sheet);
		this.legend = makeElement({
			className: 'anyink-standin-legend',
			content: escapeHTML(word('tryit.legend')),
			attributes: { title: wordHint('tryit.legend') },
		});
		this.legend.hidden = true;
		this.canvasWrapper.appendChild(this.legend);
		this.appendChild(this.canvasWrapper);
		// B12: Try it's lines under the sheet, then B1's check as one line
		this.appendChild(this.tryIt.elements.hint);
		['note', 'spacing', 'gaps'].forEach((name) => this.appendChild(this.tryIt.slots[name]));
		this.tryItCheck = makeFontCheckLine({
			doc: this.ownerDocument,
			onShowMe: (itemId) => showItem(this.editor, itemId),
			onFixIt: (problem) => this.fixCheckProblem(problem),
		});
		this.appendChild(this.tryItCheck.element);
		this.applyMode();
	}

	/**
	 * B4 integration: a toggle's id in visibility.js's 'strip' area, and a class of its own.
	 * @param {{label: HTMLElement}} toggle
	 * @param {String} id - 'realFont' | 'guideLines'
	 * @param {String} name - the class suffix
	 */
	markToggle(toggle, id, name) {
		toggle.label.dataset.anyinkStrip = id;
		toggle.label.classList.add(`preview-strip__toggle--${name}`);
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
		label.appendChild(makeElement({ content: escapeHTML(text) }));
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
		this.followTryItText();
		if (changed) {
			this.fontDirty = true;
			// The old font's problems are not this font's: show this font's last check, if any.
			this.checkPayload = getLastFontCheck(this.editor);
			this.setCheckProblem(firstCheckProblem(this.checkPayload));
			this.scheduleRedraw();
		}
		return changed;
	}

	/**
	 * B6 + B7 finalize (UX-BEGINNER.md 4.0 Preview strip: the Try-it text "Starts as the font
	 * name"): in Simple, once the Next line is on, the text is the font's name until he types or
	 * picks a sample, the rule the coach's letter order reads too (coach/font_facts.js
	 * defaultTryItText); it is not written to the prefs. All tools, and Simple before B6, keep
	 * the sample sentence. What he typed is never replaced.
	 */
	followTryItText() {
		if (!this.isBuilt) return;
		const typed = getPref(PREF_KEYS.text, '');
		if (typeof typed === 'string' && typed.trim()) return;
		const project = this.editor?.project;
		const byName = isSimpleMode() && isFeatureOn('coach') && !!project;
		const next = (byName && defaultTryItText(project)) || DEFAULT_SAMPLE_TEXT;
		if (next !== this.options.text) this.setText(next, { persist: false });
	}

	// --------------------------------------------------------------
	// Font check line (B1)
	// --------------------------------------------------------------

	/**
	 * @param {{itemId: String|null, problem: String|null, text: String, more: Number,
	 *   moreGaps: Number}|null} problem - from font_status.js firstCheckProblem
	 */
	setCheckProblem(problem) {
		this.checkProblem = problem || null;
		this.updateCheckLine();
	}

	/** @param {{ok?: Boolean}} detail - from <font-preview>'s 'font-status' event */
	onFontStatus(detail) {
		this.sheetSaysCantShow = detail.ok === false;
		this.updateCheckLine();
	}

	updateCheckLine() {
		if (!this.checkLine) return;
		// B6 + B7 integration: in Simple the Next line says the problem (rule 6, 4.0), so the
		// strip doesn't say it again (visibility.js strip.checkLine, replaced by 'coach')
		// B12: Try it says the check in its own line (tryit/font_check_line.js), never twice
		this.updateTryItCheck();
		const said = !this.sheetSaysCantShow && isShown('strip', 'checkLine') && !this.tryItOpen;
		const problem = said ? this.checkProblem : null;
		if (problem) {
			const fixable = canFixProblem(this.editor?.project, problem);
			this.checkLine.show({
				text: problem.text,
				itemId: problem.itemId,
				problem: problem.problem,
				more: moreText(problem.more, problem.moreGaps, isGapId(problem.itemId)),
				hint: hintFor(problem.problem, fixable),
				fixable,
			});
		} else {
			this.checkLine.hide();
		}
		this.setCheckCorner(!!problem);
	}

	/** B12: Try it's font check line, from the last check of this font */
	updateTryItCheck() {
		if (!this.tryItCheck) return;
		this.tryItCheck.update(
			fontCheckLineState(this.checkPayload, { project: this.editor?.project || null })
		);
	}

	/**
	 * B12: Try it opened or closed (tryit/expand.js calls this). Try it keeps its own size; the
	 * letters are laid out again for the sheet's new size, in the same renderer. Opening checks
	 * the font at once, so the line never waits 2 s with nothing to say.
	 * @param {Boolean} open
	 */
	onTryItChange(open) {
		const pt = open
			? clampPt(getPref(TRY_IT_PT_PREF, TRY_IT_DEFAULT_PT))
			: clampPt(getPref(PREF_KEYS.pt, DEFAULT_PT));
		this.options.pt = pt;
		if (this.slider) this.slider.set(pt);
		this.tryItWraps = false;
		this.needsResize = true;
		this.publishOptions();
		this.applyMode();
		this.updateLegend();
		if (open && this.editor) {
			this.checkPayload = runFontCheckNow(this.editor) || getLastFontCheck(this.editor);
			this.updateCheckLine();
		}
		this.scheduleRedraw();
	}

	/**
	 * Cuts the corner under the line out of the letters' page (preview-strip.css has-check), or
	 * gives it back. The letters keep the whole sheet and are never laid out again for it.
	 * @param {Boolean} on
	 */
	setCheckCorner(on) {
		if (!this.canvasWrapper) return;
		this.hasCheckCorner = on;
		this.canvasWrapper.classList.toggle('has-check', on);
		this.measureCheckCorner();
	}

	/** Sizes the cut-out corner to the line as it is drawn now, plus CHECK_GAP. */
	measureCheckCorner() {
		if (!this.hasCheckCorner || !this.page || !this.checkLine?.visible) return;
		const page = this.page.getBoundingClientRect();
		const line = this.checkLine.element.getBoundingClientRect();
		const px = (value) => `${Math.max(0, Math.ceil(value))}px`;
		this.canvasWrapper.style.setProperty(
			'--preview-check-cut-w',
			px(page.right - line.left + CHECK_GAP)
		);
		this.canvasWrapper.style.setProperty(
			'--preview-check-cut-h',
			px(page.bottom - line.top + CHECK_GAP)
		);
	}

	/**
	 * [Fix it]: fixes the letter (one Undo step), then checks the font again at once, so the line
	 * moves on; also when there was nothing left to fix (the line was up to 2 s old).
	 * @param {{itemId: String, problem: String}} problem
	 */
	fixCheckProblem(problem) {
		const editor = this.editor;
		if (!editor) return;
		fixProblem(editor, problem);
		runFontCheckNow(editor);
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
		// B12: the size picked in Try it is Try it's; the strip keeps its own
		if (persist) setPref(this.tryItOpen ? TRY_IT_PT_PREF : PREF_KEYS.pt, next);
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
		const area = this.sheetHeight() || STRIP_HEIGHT - 2 * 8;
		if (this.tryItOpen) return this.tryItLayoutFor(px, area).lineGap;
		return centeringLineGap(area, PAGE_PADDING, px);
	}

	/**
	 * B12: the height the letters are centered in. In Try it this is the sheet's height when the
	 * canvas was last sized to it (opening, a window resize, a new renderer), never the live
	 * height: a section opening under the sheet or a row settling never moves his letters, and
	 * the canvas, which keeps its size until then, stays the box they are centered in.
	 * @returns {Number}
	 */
	sheetHeight() {
		const live = this.page?.clientHeight || 0;
		if (this.tryItOpen && this.sheetArea > 0) return this.sheetArea;
		return live;
	}

	/** @returns {Number} the room around the letters on the sheet */
	get pagePadding() {
		return this.tryItOpen ? this.tryItLayoutFor(this.fontSizePx).pagePadding : PAGE_PADDING;
	}

	/**
	 * B12: Try it's layout: one line centered, or wrapped lines with an ordinary gap.
	 * @param {Number} px
	 * @param {Number} [area]
	 */
	tryItLayoutFor(px, area = this.sheetHeight() || STRIP_HEIGHT) {
		return tryItLayout({ areaHeight: area, fontSizePx: px, wraps: this.tryItWraps });
	}

	/** Makes sure the right renderer for the current mode is in the sheet. */
	ensureRenderer() {
		const wantFont = this.realFontOn;
		const have = this.renderer;
		if (have && have.isConnected && have instanceof FontPreview === wantFont) return have;
		this.removeRenderer();
		const renderer = wantFont ? this.makeFontRenderer() : this.makeCanvasRenderer();
		this.renderer = renderer;
		this.page.appendChild(renderer); // connectedCallback draws it
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
		// Its "Can't show your font yet" notice left with it.
		this.sheetSaysCantShow = false;
		this.updateCheckLine();
	}

	makeCanvasRenderer() {
		const px = this.fontSizePx;
		const canvas = new DisplayCanvas({
			text: this.options.text,
			fontSize: px,
			lineGap: this.lineGapFor(px),
			pagePadding: this.pagePadding,
			pageWidth: 'fit',
			pageHeight: 'fit',
			showPlaceholderMessage: true,
		});
		canvas.setAttribute('hi-dpi', '');
		canvas.showMetricLines = this.metricsOn;
		// B12: the layout knows the stand-ins' widths, and they are drawn after the letters
		canvas.updateTextBlock = () => this.layOutLetters(canvas);
		canvas.redraw = () => {
			DisplayCanvas.prototype.redraw.call(canvas);
			this.afterLettersDrawn(canvas);
		};
		return canvas;
	}

	/**
	 * B12: the DisplayCanvas's own layout, on the stand-ins' view of the font while they show;
	 * in Try it, a second pass with wrapped lines when one centered line leaves letters off.
	 * @param {DisplayCanvas} canvas
	 */
	layOutLetters(canvas) {
		const project = this.editor?.project;
		if (!this.standInsOn || !project) {
			DisplayCanvas.prototype.updateTextBlock.call(canvas);
		} else {
			const view = makeLayoutProject(project, {
				open: openPathOf(this.editor),
				measure: this.measureStandIn,
			});
			canvas.textBlock = new TextBlock({
				options: canvas.textBlockOptions,
				canvasMaxes: canvas.calculatePageMaxes(),
				ctx: canvas.ctx,
				drawPageExtras: canvas.drawDisplayPageExtras,
				drawLineExtras: canvas.drawDisplayLineExtras,
				drawCharacterExtras: canvas.drawDisplayCharacterExtras,
				drawCharacter: canvas.drawDisplayCharacter,
				project: view,
			});
		}
		if (this.tryItOpen && !this.tryItWraps && writtenOffSheet(canvas.textBlock)) {
			this.tryItWraps = true;
			canvas.textBlockOptions.lineGap = this.lineGapFor(this.fontSizePx);
			canvas.textBlockOptions.pagePadding = this.pagePadding;
			this.layOutLetters(canvas);
		}
	}

	/**
	 * B12: after the letters: the stand-ins and their legend, then the redraw is told.
	 * @param {DisplayCanvas} canvas
	 */
	afterLettersDrawn(canvas) {
		const block = canvas.textBlock;
		let drawn = 0;
		if (this.standInsOn && block && canvas.ctx) {
			drawn = drawStandIns(canvas.ctx, block, {
				color: token('--canvas-ink'),
				font: this.editor?.project?.settings?.font,
			});
		}
		this.standInCount = drawn;
		this.updateLegend();
		this.dispatchEvent(new CustomEvent(STRIP_REDRAW_EVENT, { detail: { textBlock: block } }));
	}

	/**
	 * B12: "gray = not made yet" while a stand-in shows and fewer than 5 letters are ready: at the
	 * small strip's right end, or in Try it as a sentence on the hint line under the sheet.
	 */
	updateLegend() {
		if (!this.legend) return;
		let show = false;
		if (this.standInsOn && this.standInCount > 0 && this.editor?.project) {
			const { ready } = readyCount(this.editor.project, { open: openPathOf(this.editor) });
			show = legendShows({ drawn: this.standInCount, ready });
		}
		// Try it says it as a sentence on its hint line, under the words he reads
		const inTryIt = !!this.tryIt?.isOpen;
		this.legend.hidden = !show || inTryIt;
		const line = this.tryIt?.elements?.legendLine;
		if (line) line.hidden = !show;
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
		this.measureCheckCorner(); // the sheet may have changed size since the line came
		// B12: the canvas is sized to the sheet now, so this is the height to center in
		if (this.needsResize || !this.renderer?.isConnected || !this.sheetArea)
			this.sheetArea = this.page?.clientHeight || 0;
		const renderer = this.ensureRenderer();
		const options = renderer.textBlockOptions;
		if (!options) return;
		const px = this.fontSizePx;
		if (this.tryItOpen) this.tryIt.measureTop(); // the Next line may have come or gone
		// a new text, size or sheet: try one centered line again
		if (options.text !== this.options.text || options.fontSize !== px || this.needsResize)
			this.tryItWraps = false;
		options.text = this.options.text;
		options.fontSize = px;
		options.lineGap = this.lineGapFor(px);
		options.pagePadding = this.pagePadding;
		// B12: stand-ins say it themselves; the sentence stays only for an empty field
		options.showPlaceholderMessage = !this.standInsOn || !String(this.options.text).trim();

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

		renderer.showMetricLines = this.metricsOn;
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
		if (!this.visible || !this.realFontOn) return;
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
		if (!this.overlay.isConnected) this.page.appendChild(this.overlay);
	}

	removeOverlay() {
		if (this.overlay) this.overlay.remove();
	}

	/** Purple metric lines over the native (real-font) text, or a clear overlay. */
	drawMetricsOverlay() {
		const canvas = this.overlay;
		if (!canvas || !canvas.isConnected) return;
		const width = this.page.clientWidth;
		const height = this.page.clientHeight;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		if (!this.metricsOn) return;
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
		if (!(renderer instanceof DisplayCanvas) || !renderer.textBlock || !renderer.canvas)
			return false;
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

	/**
	 * B4 + B5 fix pass (4.0): a letter that a double-click opens says so in its tooltip.
	 * @param {MouseEvent} event
	 */
	onMouseMove(event) {
		const hit = this.hitTest(event);
		const over = !!navigationTargetForChar(hit);
		this.canvasWrapper.classList.toggle('is-over-glyph', over);
		const tip = over ? stripLetterTooltip(hit, { editor: this.editor }) : '';
		if (!tip) this.canvasWrapper.removeAttribute('title');
		else if (this.canvasWrapper.getAttribute('title') !== tip) this.canvasWrapper.title = tip;
	}

	/**
	 * Double-click a glyph in the strip to go edit it. B1: opened the way Show me opens one
	 * (show_item.js), so upstream's undo keeps its "Navigated to" step.
	 * @param {MouseEvent} event
	 */
	onDoubleClick(event) {
		const target = navigationTargetForChar(this.hitTest(event));
		// The letter already open stays as it is (its view too)
		if (!target || !this.editor || isItemOpen(this.editor, target.id)) return;
		showItem(this.editor, target.id);
	}

	/**
	 * Keys typed into the strip belong to the strip: stop them before the app's
	 * canvas shortcuts see them (the real-font textarea lives in a shadow root, so
	 * upstream's activeElement check would not recognise it). Ctrl+Z is left to the
	 * browser. Escape leaves the text field.
	 * B4 + B5 fix pass: only the keys the strip's controls use stay here (strip_keys.js); a
	 * button, a toggle or the size slider with focus lets every other key reach the app, so
	 * Ctrl+Z after [Fix it] undoes it, and Ctrl+S, Ctrl+E and the tool keys work.
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
		const isTextTarget = (target) => target === this.textInput || target === this.renderer;
		if (stripOwnsKey(event, { isTextTarget })) event.stopPropagation();
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
 * @param {String} key
 * @returns {String} the words key's hint, '' for none
 */
function wordHint(key) {
	return wordEntry(key)?.hint || '';
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
