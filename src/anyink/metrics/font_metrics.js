// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK font metrics writes (Milestone 5, D-008 / D-009).
	The one place that writes project.settings.font vertical metrics and custom guide
	positions: validates and clamps, writes, publishes the narrow 'fontMetrics' or
	'guides' topic, and (when asked) records a settings history entry. The guides layer
	drag, the keyboard nudge, and the Settings and Guides panel readouts all route here.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import {
	clampBaselineDelta,
	clampFontMetric,
	isFontMetricKey,
	METRIC_LABELS,
	metricValue,
	shiftedMetricsForBaseline,
} from './metrics_math.js';

let warnedNoSettingsHistory = false;

/**
 * Records a lightweight settings history entry (D-018). History.addSettingsState is
 * implemented by the history track; until it lands, this warns once and does nothing.
 * @param {String} title - what the History panel shows
 * @returns {Boolean} true when an entry was recorded
 */
export function commitSettingsHistory(title) {
	const history = getCurrentProjectEditor()?.history;
	if (history && typeof history.addSettingsState === 'function') {
		history.addSettingsState(title);
		return true;
	}
	if (!warnedNoSettingsHistory) {
		console.warn('ANY-INK: History.addSettingsState is not available; settings edits are not undoable yet.');
		warnedNoSettingsHistory = true;
	}
	return false;
}

/**
 * Sets one font metric. Clamps so the lines keep their order, writes, publishes
 * 'fontMetrics' with { key, value, font }, and records history when asked.
 * Nothing is written or published when the clamped value equals the current one.
 * @param {String} key - settings.font key (see FONT_METRIC_KEYS)
 * @param {Number} value - requested value
 * @param {Object} [options]
 * @param {Boolean} [options.history=true] - record a settings history entry
 * @param {String} [options.verb='Set'] - first word of the history title ('Moved' for drags)
 * @returns {Number | false} the stored value, or false for an unknown key
 */
export function setFontMetric(key, value, { history = true, verb = 'Set' } = {}) {
	if (!isFontMetricKey(key)) return false;
	const editor = getCurrentProjectEditor();
	const font = editor.project.settings.font;
	const current = metricValue(font, key);
	const applied = clampFontMetric(font, key, value);
	if (applied === current) return applied;

	font[key] = applied;
	editor.publish('fontMetrics', { key, value: applied, font });
	if (history) commitSettingsHistory(`${verb} ${METRIC_LABELS[key] || key} to ${applied}`);
	return applied;
}

/**
 * Moves one custom guide. Publishes 'guides' with { index, guide, guides } and records
 * history when asked. Nothing happens when the value does not change.
 * @param {Number} index - position in settings.app.guides.custom
 * @param {Number} value - requested Em location
 * @param {Object} [options]
 * @param {Boolean} [options.history=true]
 * @returns {Number | false} the stored location, or false when the guide does not exist
 */
export function setCustomGuideLocation(index, value, { history = true } = {}) {
	const editor = getCurrentProjectEditor();
	const guides = editor.project.settings.app.guides;
	const guide = guides?.custom?.[index];
	if (!guide) return false;
	const v = Math.round(Number(value));
	const current = Math.round(Number(guide.location)) || 0;
	if (!Number.isFinite(v)) return current;
	if (v === current) return current;

	guide.location = v;
	editor.publish('guides', { index, guide, guides });
	if (history) commitSettingsHistory(`Moved ${guide.name} to ${v}`);
	return v;
}

/**
 * Calls fn for every Glyph, Ligature, and Component in a project.
 * @param {Object} project - GlyphrStudioProject
 * @param {Function} fn - (item, id) => void
 */
export function forEachProjectItem(project, fn) {
	['glyphs', 'ligatures', 'components'].forEach((collection) => {
		const items = project?.[collection] || {};
		Object.keys(items).forEach((id) => {
			if (items[id]) fn(items[id], id);
		});
	});
}

/**
 * Moves the Path shapes of one item straight up or down. ComponentInstances are left
 * alone on purpose: they follow their Component, whose own Paths move in the same pass,
 * so nothing moves twice.
 * @param {Object} item - Glyph-like item with shapes
 * @param {Number} dy - Em delta
 */
export function shiftItemPaths(item, dy) {
	if (!item?.shapes || !dy) return;
	item.shapes.forEach((shape) => {
		if (shape.objType === 'Path') {
			shape.updateShapePosition(0, dy);
			if (typeof shape.changed === 'function') shape.changed();
		} else if (shape.objType === 'ComponentInstance') {
			shape.cache = {};
		}
	});
	if (typeof item.changed === 'function') item.changed();
}

/**
 * Baseline drag (D-009): moves every outline by -delta and every horizontal metric line
 * by -delta, so the drawing and its lines stay where they were and only y = 0 moves.
 * Recorded as one whole-project history change. Publishes 'fontMetrics' and 'currentItem'.
 * @param {Number} deltaEm - how far the baseline was dragged (positive = up)
 * @returns {Number} the delta that was applied (0 when nothing moved)
 */
export function moveBaseline(deltaEm) {
	const editor = getCurrentProjectEditor();
	const project = editor.project;
	const font = project.settings.font;
	const delta = clampBaselineDelta(font, deltaEm);
	if (!delta) return 0;

	editor.history.addWholeProjectChangePreState('Moved baseline');
	forEachProjectItem(project, (item) => shiftItemPaths(item, -delta));
	Object.assign(font, shiftedMetricsForBaseline(font, delta));
	editor.history.addWholeProjectChangePostState();

	editor.publish('fontMetrics', { key: 'baseline', value: delta, font });
	const item = editor.selectedItem;
	if (item) editor.publish('currentItem', item);
	return delta;
}
