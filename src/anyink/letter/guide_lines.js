// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter view, the canvas side: Simple's guide lines (UX-BEGINNER.md 4.3 Canvas, 7.1 #3).
	In Simple with the letter view on, the five guide lines span the whole canvas and are labeled
	at the left in house words: top line, capitals line, small-letter line, writing line (drawn
	heavier) and tail line. The words are core.js's line.* entries. Labels never sit on top of
	each other or on another line: a label that has no room above its own line goes below it,
	and one with no room either way is left out (the writing line's label always stays: every
	letter sits on it).
	The lines stay locked in Simple (mode/locks.js, 7.6); this file only draws them. All tools,
	and Simple before the letter view's flag is on, keep edit_canvas.js's own drawing.

	  letterCanvasOn()                 Simple with the 'letterView' flag on: the canvas draws the
	                                   letter view (these lines, edges.js, guide_letter.js,
	                                   neighbors.js)
	  simpleGuideLines(font)           [{ key, wordKey, text, y, level, heavy }], top to bottom;
	                                   y in font units (the tail line always below 0)
	  placeLabels(lines, view, { size, gap, x, height })
	                                   [{ key, text, x, y, place }] top to bottom: y is the text's
	                                   baseline in canvas px, place 'above' or 'below' its line
	  drawSimpleGuideLines(ctx, view, font, { width, height, alpha, thickness })
	                                   the lines across the canvas, then their labels
	  labelColumnRight(ctx)            B15 fix: canvas x right of the widest label (and a gap);
	                                   the drag readout (metrics/overlay.js) starts there
*/
import { guideColorDark, guideLevelOpacity } from '../../project_editor/guide.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { guideLines } from '../placement/classes.js';
import { token, withAlpha } from '../theme/theme.js';
import { labelCase, word } from '../words/words.js';

/** The five lines, top to bottom: settings name, words key, strength, drawn heavier */
const LINES = Object.freeze([
	{ key: 'ascent', wordKey: 'line.ascent', level: 'medium', from: 'top' },
	{ key: 'capHeight', wordKey: 'line.capHeight', level: 'light', from: 'capitals' },
	{ key: 'xHeight', wordKey: 'line.xHeight', level: 'light', from: 'small' },
	{ key: 'baseline', wordKey: 'line.baseline', level: 'dark', from: 'writing', heavy: true },
	{ key: 'descent', wordKey: 'line.descent', level: 'medium', from: 'tail' },
]);

/** Which label gets its place first when the lines crowd together */
const LABEL_PRIORITY = Object.freeze(['baseline', 'xHeight', 'capHeight', 'ascent', 'descent']);

/** Label text: canvas px */
export const LABEL_SIZE = 12;
/** Space between a label and its line, canvas px */
export const LABEL_GAP = 4;
/** Labels start this far from the canvas's left edge, canvas px */
export const LABEL_X = 6;
const LABEL_FONT = `${LABEL_SIZE}px "Segoe UI", Tahoma, Verdana, sans-serif`;

/** @returns {Boolean} Simple, with B7's letter view on */
export function letterCanvasOn() {
	return isSimpleMode() && isFeatureOn('letterView');
}

/**
 * @param {Object} font - project.settings.font
 * @returns {Array<{key: String, wordKey: String, text: String, y: Number, level: String,
 *   heavy: Boolean}>} top to bottom
 */
export function simpleGuideLines(font) {
	const lines = guideLines(font);
	return LINES.map((line) => ({
		key: line.key,
		wordKey: line.wordKey,
		text: labelCase(word(line.wordKey)),
		y: lines[line.from],
		level: line.level,
		heavy: !!line.heavy,
	}));
}

/** Space between the label column and a readout beside it, canvas px */
const COLUMN_GAP = 12;

/**
 * B15 fix: where the line labels' column ends, so a readout never sits on a label.
 * @param {CanvasRenderingContext2D} ctx
 * @returns {Number} canvas x
 */
export function labelColumnRight(ctx) {
	const texts = LINES.map((line) => labelCase(word(line.wordKey)));
	ctx.save();
	ctx.font = LABEL_FONT;
	const widest = Math.max(
		...texts.map((text) => (ctx.measureText ? ctx.measureText(text).width : 0) || text.length * 7)
	);
	ctx.restore();
	return Math.ceil(LABEL_X + widest + COLUMN_GAP);
}

/**
 * Where each label goes: above its line when there is room between it and the line above,
 * else below it (room between it and the line below), else nowhere. Never on top of another
 * label.
 * @param {Array<{key: String, text: String, y: Number}>} lines - simpleGuideLines
 * @param {{dy: Number, dz: Number}} view
 * @param {{size?: Number, gap?: Number, x?: Number, height?: Number}} [options]
 * @returns {Array<{key: String, text: String, x: Number, y: Number, place: 'above' | 'below'}>}
 *   top to bottom; y is the text's baseline
 */
export function placeLabels(lines, view, options = {}) {
	const { size = LABEL_SIZE, gap = LABEL_GAP, x = LABEL_X, height = Infinity } = options;
	const onScreen = lines
		.map((line) => ({ ...line, at: view.dy - line.y * view.dz }))
		.sort((a, b) => a.at - b.at);
	const placed = [];
	const free = (top, bottom) => placed.every((box) => bottom <= box.top || top >= box.bottom);
	const order = [...onScreen].sort(
		(a, b) => LABEL_PRIORITY.indexOf(a.key) - LABEL_PRIORITY.indexOf(b.key)
	);
	order.forEach((line) => {
		const index = onScreen.indexOf(line);
		const above = index > 0 ? onScreen[index - 1].at : -Infinity;
		const below = index < onScreen.length - 1 ? onScreen[index + 1].at : Infinity;
		const tries = [
			{ place: 'above', top: line.at - gap - size, bottom: line.at - gap },
			{ place: 'below', top: line.at + gap, bottom: line.at + gap + size },
		];
		const spot = tries.find(
			(box) =>
				box.top > above &&
				box.bottom < below &&
				box.top >= 0 &&
				box.bottom <= height &&
				free(box.top, box.bottom)
		);
		if (!spot) return;
		placed.push({ key: line.key, text: line.text, x, y: spot.bottom, place: spot.place, ...spot });
	});
	return placed
		.sort((a, b) => a.top - b.top)
		.map(({ key, text, x: left, y, place }) => ({ key, text, x: left, y, place }));
}

/**
 * Draws the five lines across the whole canvas and labels them at the left.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object} font - project.settings.font
 * @param {{width?: Number, height?: Number, alpha?: Number, thickness?: Number}} [options] -
 *   width / height of the canvas; alpha and thickness from guide_strength.js systemGuideStroke
 * @returns {Array<Object>} the lines drawn (simpleGuideLines)
 */
export function drawSimpleGuideLines(ctx, view, font, options = {}) {
	const { width = ctx.canvas?.width || 0, height = ctx.canvas?.height || 0 } = options;
	const { alpha = 1, thickness = 1 } = options;
	const lines = simpleGuideLines(font);
	// a view not fitted yet (zoom 0) has nowhere to put them
	if (!(Number(view?.dz) > 0)) return lines;
	const color = guideColorDark();
	lines.forEach((line) => {
		const at = view.dy - line.y * view.dz;
		const y = line.y > 0 ? Math.floor(at) : Math.ceil(at);
		const level = guideLevelOpacity[line.level] ?? guideLevelOpacity.medium;
		const weight = line.heavy ? thickness * 2 : thickness;
		ctx.fillStyle = withAlpha(color, alpha * level);
		ctx.fillRect(0, line.heavy ? y - Math.floor(weight / 2) : y, width, weight);
	});

	ctx.save();
	ctx.font = LABEL_FONT;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	placeLabels(lines, view, { height }).forEach((label) => {
		ctx.strokeStyle = token('--canvas-label-halo');
		ctx.strokeText(label.text, label.x, label.y);
		ctx.fillStyle = withAlpha(token('--canvas-guide-label'), Math.max(alpha, 0.85));
		ctx.fillText(label.text, label.x, label.y);
	});
	ctx.restore();
	return lines;
}
