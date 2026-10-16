// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7, "The empty letter: one green door"): what the empty-letter box
	offers with the 'sketch' flag on. empty_overlay.js draws the box; this file says which doors it
	has, in which order, and what the two sketch doors do.

	  +-------------------- small n is empty --------------------+
	  |  [ Sketch it ]  (green)        L                         |
	  |      Lines, arcs and splines down the middle of the      |
	  |      stroke, then pick a thickness                       |
	  |  [ Use a photo ]                                         |
	  |      or drop a photo here                                |
	  |  or sketch the outline instead  [2-frame picture]        |
	  |  More ways >   (Draw with the brush..., No photo yet?)   |
	  +----------------------------------------------------------+

	Green stays put: [Sketch it] leads on every empty letter, unless a photo of the font has a part
	waiting (B16's T2 / T3: [Use the same photo] leads, [Sketch it] is outlined right under it). A
	photo he said he is done with never leads. The Brush and "No photo yet? How to take one" move
	under More ways; "Draw it with points" is gone. Parts ("Start from a part:") come with S5,
	when they have something to drop: no dead button before then.

	  doorButtons(isOn, { samePhoto, done })   the box's buttons, the first one green:
	      ['sketchIt', 'usePhoto'] | ['useSamePhoto', 'sketchIt', 'chooseAnother'] |
	      ['sketchIt', 'chooseAnother', 'useSamePhoto'] (done) | ['sketchIt'] (no photos)
	  moreWays(isOn)                 the quiet fold's links: 'brush', then 'how' with photos
	  setDoorWay(item, way, project) the letter's way, chosen at the door ('center' | 'outline'):
	      kept on its sketch (a new empty one when it has none) so the first piece is drawn that
	      way; a sketch with pieces, set aside or from a newer app is left alone. No history step:
	      nothing he sees changes until the first piece, which is its own step (and its Undo
	      takes the letter back to before the door).
	  openSketchDoor(editor, way, { pick })   setDoorWay on the open letter, then picks the Line
	      as his own pick (the door steps aside, as for any drawing tool he picks)
	  outlinePicture()               the outline link's 2-frame picture (loops, then the letter
	                                 filled with its hole), drawn in the link's own color
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { selectTool } from '../../edit_canvas/tools/tools.js';
import { isFeatureOn } from '../mode/features.js';
import { isNewerSketch, newSketch, setSketch, sketchOf, sketchThickness } from '../sketch/model.js';
import './sketch_door.css';

/** The ways a letter can be sketched (glyph.anyink.sketch.way) */
export const DOOR_WAYS = Object.freeze(['center', 'outline']);

/**
 * @param {(flag: String) => Boolean} [isOn]
 * @param {{samePhoto?: Boolean, done?: Boolean}} [options] - a photo of the font has parts not
 *   used yet; done: he said he is done with it
 * @returns {Array<'sketchIt' | 'usePhoto' | 'useSamePhoto' | 'chooseAnother'>}
 */
export function doorButtons(isOn = isFeatureOn, { samePhoto = false, done = false } = {}) {
	if (!isOn('photo')) return ['sketchIt'];
	if (!samePhoto) return ['sketchIt', 'usePhoto'];
	if (done) return ['sketchIt', 'chooseAnother', 'useSamePhoto'];
	return ['useSamePhoto', 'sketchIt', 'chooseAnother'];
}

/**
 * @param {(flag: String) => Boolean} [isOn]
 * @returns {Array<'brush' | 'how'>} More ways' links, in order
 */
export function moreWays(isOn = isFeatureOn) {
	const ways = [];
	if (isOn('brush')) ways.push('brush');
	if (isOn('photo')) ways.push('how');
	return ways;
}

/**
 * @param {Object} item - Glyph (or ligature / component)
 * @param {'center' | 'outline'} way
 * @param {Object} [project] - for a new sketch's thickness (the font's)
 * @returns {Boolean} true when the letter's way is now `way`
 */
export function setDoorWay(item, way, project) {
	if (!item || !DOOR_WAYS.includes(way)) return false;
	const stored = sketchOf(item);
	if (stored) {
		if (isNewerSketch(stored) || stored.setAside === true) return false;
		if (Array.isArray(stored.pieces) && stored.pieces.length > 0) return stored.way === way;
		stored.way = way;
		return true;
	}
	const thickness = project ? sketchThickness(project) : 0;
	setSketch(item, newSketch({ way, thickness }));
	return true;
}

/**
 * @param {Object} [editor]
 * @param {'center' | 'outline'} way
 * @param {{pick?: (tool: String) => void}} [options]
 * @returns {Boolean} true when the letter's way is set (or it has no letter to set it on)
 */
export function openSketchDoor(editor = getCurrentProjectEditor(), way = 'center', options = {}) {
	const pick = typeof options.pick === 'function' ? options.pick : selectTool;
	const id = editor?.selectedGlyphID;
	const item = id && typeof editor?.project?.getItem === 'function' ? editor.project.getItem(id) : null;
	const set = item ? setDoorWay(item, way, editor.project) : true;
	pick('sketchLine');
	return set;
}

const SVG = 'http://www.w3.org/2000/svg';

/**
 * Two small frames: two loops, one inside the other; then the same letter filled, its inside
 * loop a hole. Colors come from the link (currentColor), so the theme's tokens hold.
 * @param {Document} [doc]
 * @returns {SVGElement}
 */
export function outlinePicture(doc = globalThis.document) {
	const svg = doc.createElementNS(SVG, 'svg');
	svg.setAttribute('viewBox', '0 0 44 20');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('focusable', 'false');
	svg.setAttribute('class', 'anyink-empty-overlay__picture');
	const add = (tag, attributes) => {
		const node = doc.createElementNS(SVG, tag);
		Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
		svg.appendChild(node);
		return node;
	};
	// frame 1: the loops
	add('ellipse', { cx: 9, cy: 10, rx: 7, ry: 8, fill: 'none', stroke: 'currentColor' });
	add('ellipse', { cx: 9, cy: 10, rx: 3.5, ry: 4.5, fill: 'none', stroke: 'currentColor' });
	// between the frames
	add('path', { d: 'M19 10h5m-2 -2l2 2l-2 2', fill: 'none', stroke: 'currentColor' });
	// frame 2: filled, the inside loop a hole
	add('path', {
		d: 'M35 2a7 8 0 1 0 0.01 0zM35 5.5a3.5 4.5 0 1 1 -0.01 0z',
		fill: 'currentColor',
		'fill-rule': 'evenodd',
	});
	return svg;
}
