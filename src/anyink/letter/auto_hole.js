// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7: holes made automatically (UX-BEGINNER.md 7.1 #5, 4.3, 2.1 "hole"). In Simple only, a
	Rectangle, Oval or Point pen shape is made a hole or solid by what shows under it: drawn on
	ink it is a hole, drawn on paper it is solid. Where shapes sit neatly inside each other that
	is the spec's depth rule (odd depth = hole, even = solid): a shape inside an o is a hole, a
	dot inside that hole is solid again, a bullseye alternates, and a shape that only overlaps
	another stays solid. Brush strokes (B8) are always ink and are never changed here.

	How it works: the canvas and the font file fill by the nonzero rule, so a shape is a hole
	exactly when its direction cancels the ink of the shapes it sits inside (letter/outlines.js
	flattens each shape and says how two lie: apart, inside, around or crossing). The new shape
	keeps the direction it was drawn in when that already shows its role, and is turned round
	(Path.reverseWinding) when it doesn't. A solid that crosses solids on its own level takes
	their direction, so the overlap stays ink.

	B6 + B7 fix: deciding by counting the shapes around went wrong where shapes overlap or were
	drawn inside-out. Now, so the new shape shows its role exactly, everywhere inside it:
	  - holes that overlap become one hole (letter/unite_shapes.js), or the ink came back where
	    they crossed
	  - a hole drawn where solid shapes overlap (or inside a solid drawn inside a solid) sits on
	    ink counted twice, which no direction cancels: the shapes around it become one, but only
	    when that changes nothing that shows anywhere else; when it would, the new shape stays
	    solid, as drawn, and is reported as blocked
	  - a shape drawn around shapes already in the letter (the inside of an o drawn first) gives
	    each of them, outermost first, the role it now asks for, in the same Undo step
	The Solid / Hole switch (setShapeRole) only turns a shape round; canBeHole says when that
	shows a hole.

	Pure (no app state):
	  isBrushStroke(shape)          true for a brush stroke: B8 tags each stroke's shape with
	                                shape.anyink.strokeId (D-031: strokes stay separate shapes)
	  containersOf(item, shape)     the outlines the shape sits fully inside, outermost first:
	                                [{ path, contour }] (component parts count, stray lines don't)
	  nestingDepth(item, shape)     how many of them
	  roleForDepth(depth)           'hole' for an odd depth, 'solid' for an even one (what the
	                                nonzero rule gives where shapes nest neatly)
	  shapeRole(item, shape)        'hole' or 'solid': what the shape shows now
	  canBeHole(item, shape)        true when turning it round would make it a hole (it sits
	                                inside ink once over); a shape on its own can only be solid
	  setShapeRole(item, shape, role)   turns it round when that shows the role; true on a change
	  autoHole(item, shape)         gives a new shape its role, and the shapes inside it theirs:
	                                { role, depth, changed, number, shape, merged, blocked, also }
	                                  role     what the new shape shows now
	                                  shape    the Path that holds it now (a joined hole when
	                                           merged is 'holes')
	                                  number   its place in the letter's list, 1 first, as the
	                                           letter card counts
	                                  merged   'holes' | 'around' | null
	                                  blocked  true when it sits on ink no direction cancels and
	                                           the shapes around it couldn't be joined
	                                  also     [{ shape, number, role, changed }]: shapes inside
	                                           it that show another role now (changed: auto-
	                                           hole turned or joined it; else the new shape's
	                                           own direction did it)
	                                  changed  true when auto-hole changed anything in the letter
	                                  named    { number, role } | null: the change an Undo step
	                                           names (the new shape's, else the first shape
	                                           inside it that auto-hole changed)
	                                or null for anything that isn't a drawn shape with an area
	Simple glue (the tools call these; nothing happens in All tools or before 'letterView'):
	  autoHoleNewShape(editor, shape, { record })   autoHole on the open letter's new shape.
	                                The Rectangle and Oval call it before their "Added path"
	                                step, so all of it is that one Undo step; the Point pen calls
	                                it when the shape is finished, with record: true, which writes
	                                its own step ("made shape 2 a hole") when anything changed
	  sayMadeHole(editor, shape, result)   the automatic toast: "Made shape 2 a hole [Make it
	                                solid]" (the button makes it solid as one Undo step), "Made
	                                shape 2 a hole and merged the shapes around it [Make it
	                                solid]", "Made it a hole, merged with shape 2" (no button:
	                                Undo takes it back), or, blocked, "Shape 3 stays solid"
*/
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { inkPaths } from '../spacing/outline.js';
import { toast } from '../toast/toast.js';
import { word } from '../words/words.js';
import { outlineOf, relation, signOf, windingOf } from './outlines.js';
import { uniteShapes } from './unite_shapes.js';

/** The feature that ships automatic holes (B7) */
export const AUTO_HOLE_FEATURE = 'letterView';
/** The toast group, so a second hole's toast takes the place of the first */
const TOAST_GROUP = 'autoHole';
/** Joins in one go, at most (each one takes a shape out of the letter) */
const MAX_JOINS = 8;

// --------------------------------------------------------------
// Shapes as outlines
// --------------------------------------------------------------

/**
 * @param {Object} shape - Path, ComponentInstance, or anything
 * @returns {Boolean}
 */
export function isBrushStroke(shape) {
	const id = shape?.anyink?.strokeId;
	return id !== undefined && id !== null && id !== '' && id !== false;
}

/**
 * Every other outline of the letter that holds ink: its own shapes and the shapes of the parts
 * it is made from (spacing/outline.js inkPaths), each with how the shape lies against it.
 * @param {Object} item - Glyph
 * @param {Object} shape - Path, left out
 * @param {Object} own - the shape's outline
 * @returns {Array<{path: Object, contour: Object, lie: String}>} lie: relation(own, contour)
 */
function surroundings(item, shape, own) {
	return inkPaths(item)
		.filter((path) => path !== shape)
		.map((path) => ({ path, contour: outlineOf(path) }))
		.filter((entry) => entry.contour !== null)
		.map((entry) => ({ ...entry, lie: relation(own, entry.contour) }));
}

/** The ones the shape sits fully inside, outermost first */
const containersIn = (around) =>
	around
		.filter((entry) => entry.lie === 'inside')
		.sort((a, b) => Math.abs(b.contour.area) - Math.abs(a.contour.area));

/** The nonzero count just inside a shape, from the shapes it sits inside */
const inkUnder = (containers) => windingOf(containers.map((entry) => entry.contour));

/** What a shape with this direction shows over this much ink */
const roleWith = (under, sign) => (under !== 0 && under + sign === 0 ? 'hole' : 'solid');

/**
 * @param {Object} item - Glyph
 * @param {Object} shape - Path
 * @returns {Array<{path: Object, contour: Object}>} outermost first
 */
export function containersOf(item, shape) {
	const own = outlineOf(shape);
	if (!own) return [];
	return containersIn(surroundings(item, shape, own)).map(({ path, contour }) => ({ path, contour }));
}

/**
 * @param {Object} item
 * @param {Object} shape
 * @returns {Number}
 */
export function nestingDepth(item, shape) {
	return containersOf(item, shape).length;
}

/**
 * @param {Number} depth
 * @returns {'hole' | 'solid'}
 */
export function roleForDepth(depth) {
	return depth % 2 === 1 ? 'hole' : 'solid';
}

/**
 * @param {Object} item
 * @param {Object} shape
 * @returns {'hole' | 'solid'} what it shows now (a shape with no area counts as solid)
 */
export function shapeRole(item, shape) {
	const own = outlineOf(shape);
	if (!own) return 'solid';
	return roleWith(inkUnder(containersOf(item, shape)), signOf(own));
}

/**
 * @param {Object} item
 * @param {Object} shape
 * @returns {Boolean} true when one direction of the shape shows a hole
 */
export function canBeHole(item, shape) {
	if (isBrushStroke(shape) || !outlineOf(shape)) return false;
	return Math.abs(inkUnder(containersOf(item, shape))) === 1;
}

/**
 * Turns the shape round when that makes it show the role. Brush strokes never change.
 * @param {Object} item
 * @param {Object} shape - Path
 * @param {'hole' | 'solid'} role
 * @returns {Boolean} true when it changed
 */
export function setShapeRole(item, shape, role) {
	if (isBrushStroke(shape) || !outlineOf(shape)) return false;
	if (shapeRole(item, shape) === role) return false;
	turnRound(shape);
	if (shapeRole(item, shape) === role) return true;
	turnRound(shape);
	return false;
}

function turnRound(shape) {
	shape.reverseWinding();
	shape.changed?.();
}

/**
 * @param {Object} item
 * @param {Object} path
 * @returns {Boolean} one of the letter's own shapes that auto-hole may change
 */
function isOwnShape(item, path) {
	return path?.objType === 'Path' && !isBrushStroke(path) && (item?.shapes || []).includes(path);
}

// --------------------------------------------------------------
// The new shape's role
// --------------------------------------------------------------

/**
 * The direction a solid takes: that of the solids it crosses on its own level (on paper, as
 * it is), so the overlap stays ink; when they disagree, the most of them; else as drawn.
 * @param {Object} item
 * @param {Array} around - surroundings of the new shape
 * @param {Number} drawn - +1 / -1
 * @returns {Number}
 */
function solidSign(item, around, drawn) {
	const votes = around
		.filter((entry) => entry.lie === 'cross')
		.filter((entry) => {
			const theirs = containersIn(surroundings(item, entry.path, entry.contour));
			const under = inkUnder(theirs);
			return under === 0 && roleWith(under, signOf(entry.contour)) === 'solid';
		})
		.reduce((sum, entry) => sum + signOf(entry.contour), 0);
	return votes === 0 ? drawn : Math.sign(votes);
}

/**
 * Joining shapes that all hold the new shape changes the ink count only where two or more of
 * them overlap (there it drops to one shape's). It is safe when nothing else changes how it
 * looks there: every other shape either stays clear of those overlaps or holds them all, and
 * those that hold them all never bring the count there to show paper before or after.
 * B6 + B7 finalize: any number of shapes, not only two (three solids overlapping, a hole drawn
 * where all three overlap: no pair could be joined, since the third crosses both).
 * @param {Array} around - surroundings of the new shape
 * @param {Object} own - the new shape's outline
 * @param {Array} group - two or more of its containers
 * @param {Number} sign - their direction
 * @returns {Boolean}
 */
function safeToJoin(around, own, group, sign) {
	let holding = 0;
	for (const entry of around) {
		if (group.includes(entry)) continue;
		// shapes inside the new one get their role again below
		if (relation(entry.contour, own) === 'inside') continue;
		const lies = group.map((member) => relation(entry.contour, member.contour));
		if (lies.every((lie) => lie === 'around')) {
			holding += signOf(entry.contour);
			continue;
		}
		// it reaches an overlap only through two members that overlap each other
		const touched = group.filter((_, k) => lies[k] !== 'apart');
		const reaches = touched.some((a, i) =>
			touched.slice(i + 1).some((b) => relation(a.contour, b.contour) !== 'apart')
		);
		if (reaches) return false;
	}
	for (let count = 1; count <= group.length; count++) {
		if (holding === -count * sign) return false;
	}
	return true;
}

/**
 * Joins the ink the new shape sits on until no more than one shape's ink is under it, when
 * that is safe (safeToJoin). Innermost pairs first.
 * @returns {Boolean} true when something was joined
 */
function joinInkAround(item, shape, own) {
	let joinedAny = false;
	for (let round = 0; round < MAX_JOINS; round++) {
		const around = surroundings(item, shape, own);
		const containers = containersIn(around);
		const under = inkUnder(containers);
		if (Math.abs(under) < 2) break;
		const sign = Math.sign(under);
		const same = containers.filter(
			(entry) => signOf(entry.contour) === sign && isOwnShape(item, entry.path)
		);
		let joined = false;
		for (let inner = same.length - 1; inner > 0 && !joined; inner--) {
			for (let outer = inner - 1; outer >= 0 && !joined; outer--) {
				const pair = [same[outer], same[inner]];
				if (!safeToJoin(around, own, pair, sign)) continue;
				joined = !!uniteShapes(
					item,
					pair.map((entry) => entry.path),
					sign
				);
			}
		}
		// B6 + B7 finalize: no pair alone can be joined (each pair's overlap is crossed by
		// another of them): all of them as one, when that is safe as a group
		if (!joined && same.length > 2 && safeToJoin(around, own, same, sign)) {
			joined = !!uniteShapes(
				item,
				same.map((entry) => entry.path),
				sign
			);
		}
		if (!joined) break;
		joinedAny = true;
	}
	return joinedAny;
}

/**
 * The holes the new hole crosses that sit inside the very same shapes: they and it become one.
 * @param {Object} item
 * @param {Array} around
 * @param {Array} containers - the new shape's
 * @returns {Array<Object>} Paths
 */
function crossingHoles(item, around, containers) {
	const mine = new Set(containers.map((entry) => entry.path));
	return around
		.filter((entry) => entry.lie === 'cross' && isOwnShape(item, entry.path))
		.filter((entry) => {
			const theirs = containersIn(surroundings(item, entry.path, entry.contour));
			if (theirs.length !== mine.size || !theirs.every((other) => mine.has(other.path))) {
				return false;
			}
			return roleWith(inkUnder(theirs), signOf(entry.contour)) === 'hole';
		})
		.map((entry) => entry.path);
}

/**
 * The role for one shape, without the shapes inside it.
 * @returns {{role: String, depth: Number, changed: Boolean, shape: Object, merged: String | null,
 *   blocked: Boolean} | null}
 */
function settle(item, shape) {
	if (isBrushStroke(shape)) return null;
	const own = outlineOf(shape);
	if (!own) return null;
	const drawn = signOf(own);
	let merged = null;

	let around = surroundings(item, shape, own);
	if (Math.abs(inkUnder(containersIn(around))) >= 2 && joinInkAround(item, shape, own)) {
		merged = 'around';
		around = surroundings(item, shape, own);
	}
	const containers = containersIn(around);
	const under = inkUnder(containers);
	const blocked = Math.abs(under) >= 2;

	let sign;
	if (blocked) sign = drawn;
	else if (under !== 0) sign = -under;
	else sign = solidSign(item, around, drawn);
	const turned = sign !== drawn;
	if (turned) turnRound(shape);

	let result = shape;
	if (!blocked && under !== 0) {
		// Holes it crosses in the same shapes become one with it; again while the joined one
		// reaches more
		for (let round = 0; round < MAX_JOINS; round++) {
			const outline = outlineOf(result);
			const holes = crossingHoles(item, surroundings(item, result, outline), containers);
			if (!holes.length) break;
			const joined = uniteShapes(item, [...holes, result], sign);
			if (!joined) break;
			result = joined;
			merged = 'holes';
		}
	}
	return {
		role: roleWith(under, sign),
		depth: containers.length,
		changed: turned || merged !== null,
		shape: result,
		merged,
		blocked,
	};
}

/**
 * The letter's own shapes that sit inside this one, outermost first.
 * @returns {Array<Object>} Paths
 */
function shapesInside(item, shape) {
	const own = outlineOf(shape);
	if (!own) return [];
	return (item?.shapes || [])
		.filter((other) => other !== shape && isOwnShape(item, other))
		.map((path) => ({ path, contour: outlineOf(path) }))
		.filter((entry) => entry.contour && relation(entry.contour, own) === 'inside')
		.sort((a, b) => Math.abs(b.contour.area) - Math.abs(a.contour.area))
		.map((entry) => entry.path);
}

/**
 * What a shape showed before another one was drawn around it.
 * @param {Object} item
 * @param {Object} shape
 * @param {Object} newShape - left out
 * @returns {'hole' | 'solid'}
 */
function roleWithout(item, shape, newShape) {
	const own = outlineOf(shape);
	if (!own) return 'solid';
	const containers = containersIn(surroundings(item, shape, own)).filter(
		(entry) => entry.path !== newShape
	);
	return roleWith(inkUnder(containers), signOf(own));
}

/**
 * Gives a new shape its role, and the shapes inside it theirs.
 * @param {Object} item - Glyph (the letter the shape is in)
 * @param {Object} shape - Path
 * @returns {Object | null} see the header
 */
export function autoHole(item, shape) {
	const result = settle(item, shape);
	if (!result) return null;
	const shapes = item?.shapes || [];
	const also = [];
	shapesInside(item, result.shape).forEach((inner) => {
		if (!shapes.includes(inner)) return; // joined into another on the way
		const before = roleWithout(item, inner, result.shape);
		const settled = settle(item, inner);
		// listed when auto-hole changed it, or when the new shape around it changed what it shows
		if (settled && (settled.changed || settled.role !== before)) {
			also.push({ shape: settled.shape, role: settled.role, changed: settled.changed });
		}
	});
	const inside = also
		.filter((entry) => shapes.includes(entry.shape))
		.map((entry) => ({ ...entry, number: shapes.indexOf(entry.shape) + 1 }));
	const number = shapes.indexOf(result.shape) + 1;
	// The change an Undo step names: the new shape's own when it is a hole or nothing inside it
	// was changed, else the first shape inside it that was ("made shape 1 a hole": the inside of
	// an o drawn first)
	const changedInside = inside.find((entry) => entry.changed);
	let named = null;
	if (result.changed && (result.role === 'hole' || !changedInside)) {
		named = { number, role: result.role };
	} else if (changedInside) {
		named = { number: changedInside.number, role: changedInside.role };
	}
	return { ...result, changed: named !== null, number, also: inside, named };
}

// --------------------------------------------------------------
// Simple glue
// --------------------------------------------------------------

/** @returns {Boolean} automatic holes are on: Simple, once the letter view has landed */
export function autoHoleIsOn() {
	return isSimpleMode() && isFeatureOn(AUTO_HOLE_FEATURE);
}

/**
 * @param {Object} shape
 * @returns {Object | null} the letter a shape is in, when that letter is the open one
 */
function openItemOf(editor, shape) {
	const item = editor?.selectedItem;
	if (!item || !Array.isArray(item.shapes) || !item.shapes.includes(shape)) return null;
	return item;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {Object} shape - the shape a tool just made in the open letter
 * @param {Object} [options]
 * @param {Boolean} [options.record] - write an Undo step when anything changed (the Point pen:
 *   its points were already steps of their own)
 * @returns {Object | null} autoHole's result; null when automatic holes are off or the shape
 *   isn't one they act on
 */
export function autoHoleNewShape(editor, shape, { record = false } = {}) {
	if (!autoHoleIsOn()) return null;
	const item = openItemOf(editor, shape);
	if (!item) return null;
	const result = autoHole(item, shape);
	if (!result) return null;
	if (record && result.named) {
		const { role, number } = result.named;
		const key = role === 'hole' ? 'letterTools.step.madeHole' : 'letterTools.step.madeSolid';
		editor.history.addState(word(key, { number }));
		editor.publish?.('currentPath', result.shape);
	}
	return result;
}

/**
 * The automatic toast for a new shape: what auto-hole made of it, or of a shape inside it.
 * @param {Object} editor
 * @param {Object} shape - the shape the tool made (gone when it was joined into a hole)
 * @param {Object | null} result - from autoHoleNewShape
 * @returns {Boolean} true when a toast was asked for
 */
export function sayMadeHole(editor, shape, result) {
	if (!result || !autoHoleIsOn()) return false;
	if (result.blocked) {
		toast('letterTools.stayedSolid', { number: result.number }, { kind: 'automatic', group: TOAST_GROUP });
		return true;
	}
	const target = result.role === 'hole' ? result : result.also.find((entry) => entry.role === 'hole');
	if (!target) return false;
	const item = openItemOf(editor, target.shape);
	if (!item) return false;
	const stillGood = () =>
		openItemOf(editor, target.shape) === item && shapeRole(item, target.shape) === 'hole';
	if (target === result && result.merged === 'holes') {
		toast(
			'letterTools.joinedHole',
			{ number: target.number },
			{ kind: 'automatic', group: TOAST_GROUP, stillGood }
		);
		return true;
	}
	const key =
		target === result && result.merged === 'around' ? 'letterTools.madeHoleJoined' : 'letterTools.madeHole';
	toast(
		key,
		{ number: target.number },
		{
			kind: 'automatic',
			group: TOAST_GROUP,
			stillGood,
			action: {
				key: 'letterTools.makeSolid',
				run: () => makeSolidAgain(editor, item, target.shape),
			},
		}
	);
	return true;
}

/**
 * The toast's button: the shape made solid, one Undo step.
 * @returns {Boolean} true when it changed
 */
function makeSolidAgain(editor, item, shape) {
	if (openItemOf(editor, shape) !== item) return false;
	if (!setShapeRole(item, shape, 'solid')) return false;
	const number = item.shapes.indexOf(shape) + 1;
	editor.history.addState(word('letterTools.step.madeSolid', { number }));
	editor.publish?.('currentPath', shape);
	editor.editCanvas?.redraw?.('anyink.autoHole.makeSolid');
	return true;
}
