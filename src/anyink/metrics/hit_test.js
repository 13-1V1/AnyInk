// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK guides layer hit test (Milestone 5, D-008).
	Pure: builds the list of draggable lines from plain data and finds the one under a
	canvas pixel. The hit zone is HIT_ZONE_PX canvas pixels, which is HIT_ZONE_PX / view.dz
	in Em units. Nothing here reads the editor or the DOM.

	Line descriptor: { id, kind, orientation, value, label, key?, index?, side? }
	- id: 'ascent' | 'capHeight' | 'xHeight' | 'descent' | 'baseline' | 'lsb' | 'rsb' | 'guide:N'
	- kind: 'metric' | 'baseline' | 'sideBearing' | 'guide'
	- orientation: 'h' (value is an Em y) | 'v' (value is an Em x)
*/
import { DRAGGABLE_METRIC_KEYS, LIVE_LABELS, metricValue } from './metrics_math.js';

/** Hit zone around a line, in canvas pixels. */
export const HIT_ZONE_PX = 6;

/**
 * The hit zone in Em units for a given zoom.
 * @param {Object} view - {dx, dy, dz}
 * @param {Number} px - zone in canvas pixels
 * @returns {Number}
 */
export function hitZoneEm(view, px = HIT_ZONE_PX) {
	const dz = Number(view?.dz) || 1;
	return px / dz;
}

/**
 * Lists every line the guides layer can grab, honoring visibility.
 * KernGroups get the horizontal metrics only (no side bearings, no custom guides).
 * @param {Object} arg
 * @param {Object} arg.font - project.settings.font
 * @param {Object} arg.systemGuides - editor.systemGuides flags
 * @param {Object} arg.guides - project.settings.app.guides
 * @param {Object | false} arg.item - Glyph, Ligature, Component, or KernGroup being edited
 * @returns {Array} line descriptors
 */
export function collectGuideLines({ font = {}, systemGuides = {}, guides = {}, item = false }) {
	const lines = [];
	const isKern = item?.objType === 'KernGroup';

	if (guides.systemShowGuides) {
		DRAGGABLE_METRIC_KEYS.forEach((key) => {
			if (systemGuides[key]) {
				lines.push({
					id: key,
					kind: 'metric',
					key,
					orientation: 'h',
					value: metricValue(font, key),
					label: LIVE_LABELS[key],
				});
			}
		});

		if (systemGuides.baseline) {
			lines.push({ id: 'baseline', kind: 'baseline', orientation: 'h', value: 0, label: 'baseline' });
		}

		if (item && !isKern) {
			if (systemGuides.leftSide) {
				lines.push({
					id: 'lsb',
					kind: 'sideBearing',
					side: 'lsb',
					orientation: 'v',
					value: 0,
					label: LIVE_LABELS.lsb,
				});
			}
			const advance = Number(item.advanceWidth) || 0;
			if (systemGuides.rightSide && advance && item.objType !== 'Component') {
				lines.push({
					id: 'rsb',
					kind: 'sideBearing',
					side: 'rsb',
					orientation: 'v',
					value: advance,
					label: LIVE_LABELS.rsb,
				});
			}
		}
	}

	if (!isKern && guides.customShowGuides && Array.isArray(guides.custom)) {
		guides.custom.forEach((guide, index) => {
			if (!guide || !guide.visible) return;
			lines.push({
				id: `guide:${index}`,
				kind: 'guide',
				index,
				orientation: guide.angle === 90 ? 'h' : 'v',
				value: Math.round(Number(guide.location)) || 0,
				label: guide.name || 'guide',
			});
		});
	}

	return lines;
}

/**
 * Canvas pixel position of a line for a view.
 * @param {Object} line - descriptor
 * @param {Object} view - {dx, dy, dz}
 * @returns {Number} canvas x (vertical line) or canvas y (horizontal line)
 */
export function lineCanvasPosition(line, view) {
	if (line.orientation === 'h') return view.dy - line.value * view.dz;
	return view.dx + line.value * view.dz;
}

/**
 * Finds the nearest line within the hit zone of a canvas pixel.
 * @param {Array} lines - from collectGuideLines
 * @param {Number} cx - canvas x in pixels
 * @param {Number} cy - canvas y in pixels
 * @param {Object} view - {dx, dy, dz}
 * @param {Number} tolerancePx - hit zone in canvas pixels
 * @returns {Object | false} the line descriptor, or false
 */
export function hitTestLines(lines, cx, cy, view, tolerancePx = HIT_ZONE_PX) {
	let best = false;
	let bestDistance = Infinity;
	if (!Array.isArray(lines) || !view) return false;

	lines.forEach((line) => {
		const at = lineCanvasPosition(line, view);
		const distance = line.orientation === 'h' ? Math.abs(at - cy) : Math.abs(at - cx);
		if (distance <= tolerancePx && distance < bestDistance) {
			best = line;
			bestDistance = distance;
		}
	});

	return best;
}
