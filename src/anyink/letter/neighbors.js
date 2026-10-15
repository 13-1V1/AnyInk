// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter view, the canvas side: neighbors (UX-BEGINNER.md 4.3 Canvas). Only while Fine-tune is
	open and the Neighbors switch is on (view_switches.js fineTuneShows('neighbors'), the
	letter-card track's state, on by default), and only once his neighbor letter is ready: his n
	faintly on each side of a small letter or a mark, his H beside a capital or a number (numbers
	stand on the capitals line, like H). They sit where they would type: the letter's width, and
	any gap fix between the two, included. The first time they show in a session, each is labeled
	"Your small n, shown for comparing" until he leaves that letter.

	A view-only override of Glyphr Studio's context characters (edit_canvas/context_characters.js),
	which are set by writing item.contextCharacters and settings.app.contextCharacters into the
	font: this draws from the letters as they are and writes nothing, to the letter, the font,
	the Undo list or the work file's changed state. A neighbor holding a part that no longer
	exists is left undrawn, because drawing it (draw_paths.js drawGlyph) would delete that part.
	"Ready" is "has ink and a width" until B11's checks decide Ready. Which letter is his
	neighbor is neighbor_pick.js's (B6 + B7 integration: the Neighbors switch asks it too).

	  neighborChar, neighborItem, neighborsAvailable   neighbor_pick.js's, passed on
	  neighborsShown(item, project)
	  neighborLayout(item, neighbor, view, project)   { left: view, right: view }: the views to
	                                   draw the neighbor in on each side
	  drawNeighbors(ctx, view, item, project)   true when drawn
	  resetNeighborsForTests()
*/
import { drawGlyph } from '../../display_canvas/draw_paths.js';
import { kernOffsetFor } from '../kerning/kern_lookup.js';
import { token, withAlpha } from '../theme/theme.js';
import { letterName } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { letterVisit } from './guide_letter.js';
import { letterCanvasOn } from './guide_lines.js';
import { neighborChar, neighborItem, neighborsAvailable } from './neighbor_pick.js';
import { fineTuneShows } from './view_switches.js';

const LABEL_FONT = '12px "Segoe UI", Tahoma, Verdana, sans-serif';
/** The label sits this far under the tail line, font units, then 22 px lower (as upstream's) */
const LABEL_DROP = 60;

/** The visit the labels first showed on: number, or null; done once he left it */
let labels = { visit: null, done: false };

/**
 * @param {Object | false} item - the open letter
 * @param {Object} project
 * @returns {Boolean}
 */
export function neighborsShown(item, project) {
	if (!letterCanvasOn() || !fineTuneShows('neighbors')) return false;
	if (!item || item.objType !== 'Glyph' || !item.shapes?.length) return false;
	return neighborsAvailable(item, project);
}

/**
 * @param {Object} item - the open letter
 * @param {Object} neighbor - his n or H
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object} project
 * @returns {{left: Object, right: Object}} views for drawGlyph
 */
export function neighborLayout(item, neighbor, view, project) {
	const char = item.char;
	const other = neighborChar(char);
	const before = kernOffsetFor(project, other, char);
	const after = kernOffsetFor(project, char, other);
	const width = Number(neighbor.advanceWidth) || 0;
	return {
		left: { dx: view.dx - (width + before) * view.dz, dy: view.dy, dz: view.dz },
		right: { dx: view.dx + ((Number(item.advanceWidth) || 0) + after) * view.dz, dy: view.dy, dz: view.dz },
	};
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{dx: Number, dy: Number, dz: Number}} view
 * @param {Object | false} item - the open letter
 * @param {Object} project
 * @returns {Boolean} true when drawn
 */
export function drawNeighbors(ctx, view, item, project) {
	if (!(Number(view?.dz) > 0) || !neighborsShown(item, project)) return false;
	const neighbor = neighborItem(item, project);
	if (!safeToDraw(neighbor, project)) return false;
	const layout = neighborLayout(item, neighbor, view, project);
	const faint = token('--canvas-ink-faint');
	drawGlyph(neighbor, ctx, layout.left, 1, faint);
	drawGlyph(neighbor, ctx, layout.right, 1, faint);
	if (labelsNow(item, project)) {
		const text = word('letterCanvas.neighborLabel', { letter: letterName(neighbor.char) });
		const y = view.dy - (-Math.abs(Number(project.settings.font.descent) || 0) - LABEL_DROP) * view.dz + 22;
		const width = (Number(neighbor.advanceWidth) || 0) * view.dz;
		drawLabel(ctx, text, layout.left.dx, width, y);
		drawLabel(ctx, text, layout.right.dx, width, y);
	}
	return true;
}

/**
 * The first visit they show on keeps its labels; after he leaves it, none.
 * @param {Object} item
 * @param {Object} project
 * @returns {Boolean}
 */
function labelsNow(item, project) {
	if (labels.done) return false;
	const number = letterVisit(item, project).number;
	if (labels.visit === null) labels.visit = number;
	if (labels.visit !== number) labels.done = true;
	return !labels.done;
}

/**
 * Drawing a letter whose part (a component) no longer exists deletes that part
 * (draw_paths.js drawGlyph); a view must never change the font.
 * @param {Object} neighbor
 * @param {Object} project
 * @returns {Boolean}
 */
function safeToDraw(neighbor, project) {
	return (neighbor.shapes || []).every(
		(shape) => shape?.objType !== 'ComponentInstance' || !!project.getItem(shape.link)
	);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {String} text
 * @param {Number} x - the neighbor's left, canvas px
 * @param {Number} width - its width, canvas px
 * @param {Number} y - the text's baseline
 */
function drawLabel(ctx, text, x, width, y) {
	ctx.save();
	ctx.font = LABEL_FONT;
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	const textWidth = ctx.measureText ? ctx.measureText(text).width : text.length * 6;
	const left = x + (width - textWidth) / 2;
	ctx.lineWidth = 4;
	ctx.lineJoin = 'round';
	ctx.strokeStyle = token('--canvas-label-halo');
	ctx.strokeText(text, left, y);
	ctx.fillStyle = withAlpha(token('--canvas-guide-label'), 1);
	ctx.fillText(text, left, y);
	ctx.restore();
}

export { neighborChar, neighborItem, neighborsAvailable };

export function resetNeighborsForTests() {
	labels = { visit: null, done: false };
}
