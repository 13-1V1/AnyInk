// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 fix: some of a letter's own shapes made into one, the way "Merge overlapping shapes"
	joins them (upstream's unite, project_editor/boolean_combine.js). auto_hole.js uses it only
	where no way round alone can show a new shape's role: holes that overlap become one hole, and
	the ink shapes a new hole sits in become one shape so the hole can cancel their ink.

	  uniteShapes(item, shapes, sign)   the shapes' joined outline as one Path, in the place of
	                                    the first of them in the letter's list (the others leave
	                                    the list), running the way sign says (+1 counter-
	                                    clockwise, y-up), every point a whole number (principle
	                                    5), named after the first. null, and the letter left as
	                                    it was, when they don't join into one piece.
	B6 + B7 finalize: a join that rings an island (two holes, a U and an upside-down U across its
	arms, ring the ink between them) gives the outer outline and the island's: the island runs
	the other way, so what showed there before shows still (ink stays ink inside a joined hole,
	paper stays paper inside joined ink); it follows the outer one in the list as a shape of its
	own. An outline inside an island runs as the outer one does again. Pieces that don't touch
	(more than one outermost outline) are no join: null.
*/
import { combinePaths } from '../../project_editor/boolean_combine.js';
import { outlineOf, relation, signOf } from './outlines.js';

/**
 * @param {Object} item - Glyph (mutated)
 * @param {Array<Object>} shapes - two or more of its own Paths
 * @param {Number} sign - +1 or -1
 * @returns {Object | null} the joined Path, now in the letter
 */
export function uniteShapes(item, shapes, sign) {
	const list = item?.shapes;
	if (!Array.isArray(list) || !Array.isArray(shapes) || shapes.length < 2) return null;
	const places = shapes.map((shape) => list.indexOf(shape));
	if (places.some((place) => place < 0) || shapes.some((shape) => shape?.objType !== 'Path')) {
		return null;
	}
	let joined;
	try {
		joined = combinePaths(shapes, 'unite');
	} catch {
		return null;
	}
	if (!Array.isArray(joined) || !joined.length) return null;
	const pieces = nested(joined);
	if (!pieces) return null;
	pieces.forEach(({ path, depth }) => {
		const want = depth % 2 === 0 ? sign : -sign;
		if (signOf(outlineOf(path)) !== want) path.reverseWinding();
	});

	const first = Math.min(...places);
	const name = list[first].name;
	pieces.forEach(({ path }) => (path.name = name));
	// Out with the old, in at the first one's place (the list is the letter's own array)
	for (let index = list.length - 1; index >= 0; index--) {
		if (shapes.includes(list[index])) list.splice(index, 1);
	}
	const added = pieces.map(({ path }) => {
		const shape = item.addOneShape(path);
		list.splice(list.indexOf(shape), 1);
		return shape;
	});
	list.splice(first, 0, ...added);
	item.changed?.();
	return added[0];
}

/**
 * The joined outlines, rounded to whole numbers, each with how many of the others hold it,
 * outermost first.
 * @param {Array<Object>} paths
 * @returns {Array<{path: Object, depth: Number}> | null} null: no outline to keep, or pieces that
 *   don't touch (more than one outermost)
 */
function nested(paths) {
	const kept = paths
		.map((path) => {
			path.roundAll?.(0);
			return { path, outline: outlineOf(path) };
		})
		.filter((entry) => entry.outline !== null);
	if (!kept.length) return null;
	const pieces = kept.map((entry) => ({
		path: entry.path,
		area: Math.abs(entry.outline.area),
		depth: kept.filter(
			(other) => other !== entry && relation(entry.outline, other.outline) === 'inside'
		).length,
	}));
	if (pieces.filter((piece) => piece.depth === 0).length !== 1) return null;
	return pieces.sort((a, b) => a.depth - b.depth || b.area - a.area);
}
