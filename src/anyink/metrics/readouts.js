// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK metric readouts (Milestone 5, audit A1 / C5).
	Small helpers that turn a settings row or a Guides panel value into a live readout:
	the field still accepts a typed number (secondary readout), every write goes through
	font_metrics.js, and a 'fontMetrics' / 'guides' subscription refreshes the display.
	Subscriber ids are 'anyink.metrics.<panel>.<key>'; rebuilding a row re-subscribes with
	the same id, which replaces the old callback (same pattern as panels/cards.js).
*/
import { getCurrentProject, getCurrentProjectEditor } from '../../app/main.js';
import { makeElement } from '../../common/dom.js';
import { showToast } from '../../controls/dialogs/dialogs.js';
import { setFontMetric } from './font_metrics.js';
import { METRIC_LABELS, metricValue } from './metrics_math.js';

/**
 * Subscribes to 'fontMetrics' and hands the callback the current settings.font.
 * @param {String} subscriberID - 'anyink.metrics.<panel>.<key>'
 * @param {Function} callback - (font, data) => void
 */
export function subscribeToFontMetrics(subscriberID, callback) {
	getCurrentProjectEditor().subscribe({
		topic: 'fontMetrics',
		subscriberID,
		callback: (data) => callback(data?.font || getCurrentProject().settings.font, data),
	});
}

/**
 * Sets an input-number's shown value (property and attribute, like panels/cards.js).
 * @param {Element} input
 * @param {Number | String} value
 */
export function showInputValue(input, value) {
	// @ts-expect-error 'property does exist'
	input.value = value;
	input.setAttribute('value', `${value}`);
}

/**
 * Settings > Font: one Em row's input-number as a secondary readout. Typing a number
 * writes through setFontMetric (clamped, published, one history entry); drags on the
 * canvas refresh it through 'fontMetrics'.
 * @param {String} key - settings.font key
 * @returns {Element} input-number
 */
export function makeMetricSettingsInput(key) {
	const font = getCurrentProject().settings.font;
	const input = makeElement({
		tag: 'input-number',
		attributes: { value: metricValue(font, key) },
	});

	input.addEventListener('change', (event) => {
		// @ts-expect-error 'property does exist'
		const requested = parseInt(event.target.value);
		if (isNaN(requested)) {
			showToast(`Could not save value - needs to be a number.`);
			showInputValue(input, metricValue(getCurrentProject().settings.font, key));
			return;
		}
		const applied = setFontMetric(key, requested);
		if (applied !== requested) {
			showToast(`${METRIC_LABELS[key] || key} kept in order: set to ${applied}`);
		}
		showInputValue(input, applied);
	});

	subscribeToFontMetrics(`anyink.metrics.settingsRow.${key}`, (currentFont) => {
		showInputValue(input, metricValue(currentFont, key));
	});

	return input;
}

/**
 * Guides panel: keeps a text readout of one system metric current.
 * @param {Element} element - the value display
 * @param {String} key - 'ascent' | 'capHeight' | 'xHeight' | 'descent'
 */
export function bindSystemMetricReadout(element, key) {
	subscribeToFontMetrics(`anyink.metrics.guidesPanel.system.${key}`, (font) => {
		element.textContent = `${metricValue(font, key)}`;
	});
}

/**
 * Guides panel: keeps the right-side readout equal to the current item's advance width.
 * @param {Element} element - the value display
 */
export function bindAdvanceWidthReadout(element) {
	getCurrentProjectEditor().subscribe({
		topic: 'currentItem',
		subscriberID: 'anyink.metrics.guidesPanel.system.rightSide',
		callback: () => {
			const item = getCurrentProjectEditor().selectedItem;
			const advance = item?.advanceWidth;
			if (advance || advance === 0) element.textContent = `${advance}`;
		},
	});
}

/**
 * Guides panel: keeps one custom guide's location input in step with canvas drags.
 * @param {Element} input - input-number made by makeSingleInput
 * @param {Number} index - position in settings.app.guides.custom
 */
export function bindCustomGuideReadout(input, index) {
	getCurrentProjectEditor().subscribe({
		topic: 'guides',
		subscriberID: `anyink.metrics.guidesPanel.custom.${index}.location`,
		callback: () => {
			const guide = getCurrentProject().settings.app.guides?.custom?.[index];
			if (!guide) return;
			showInputValue(input, Math.round(Number(guide.location)) || 0);
		},
	});
}
