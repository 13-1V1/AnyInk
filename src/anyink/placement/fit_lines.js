// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK placement: the photo's x / y / scale so the picked part lands on its lines
	(UX-BEGINNER 4.4 "Placement", B3). Pure: no DOM, no editor, nothing written.

	The photo flow (B9 photo_flow.js) calls placePart when a part is named and writes the result
	into that letter's photo record (item.anyink.trace x, y, scale) before tracing, so the traced
	shapes land in place. Placement never runs inside applyAutoTrace. Then, in the same Undo
	step, followPlan lists the earlier letters from the same photo that follow the new scale,
	and photo_scale.js applyFollow resizes each.

	- placePart(photo, partId, font, { left = 0, scale }) -> { x, y, scale, seat, linePx,
	  bodyBottomPx, bodyFrom, tail, char } or null (an unknown or unnamed part, or a photo
	  nothing can size):
	    scale: the scale of the part's row (photo_scale.js: the photo's one scale, unless a
	       row was written at another size), or the scale asked for;
	    y: the body bottom on the class bottom (the writing line, round letters 1.5 % under),
	       wherever in its row the letter was written; the apostrophe's top on the capitals
	       line, the hyphen's middle on half the small-letter line (seat.js);
	    linePx: the row's writing line under the part (null without one); bodyBottomPx /
	       bodyFrom: where its body ends and which rule said so (bottom seat only);
	    x: the part's left ink edge at `left` font units (0: spacing fits it afterwards, B3
	       spacing, and moves the photo with the shapes);
	    x and y are whole font units; scale is not rounded (it is a ratio, not a position).
	- followPlan(photo, font, { getItem, asset = photo.asset, except, share = FOLLOW_SHARE })
	  -> [{ partId, itemId, char, from, to, resized, reseated }]: every letter named from this
	  photo (except the one just named) whose item getItem(itemId, partId) is still untouched
	  (photo_scale.js isUntouched) and either is more than 3 % off its row's scale (resized: it
	  takes that scale and seat) or, at its own scale, now seats more than 0.5 % of the letter
	  box off where it is (reseated: a row line or a tail guess moved as more parts were named).
	  A follower keeps its left ink edge where it is, so spacing that moved it is not undone.
*/
import { guideLines, lineTargets, tailKind } from './classes.js';
import { FOLLOW_SHARE, isUntouched, photoScale, shouldFollow } from './photo_scale.js';
import { bodyBottom, partGeometry, seatTraceY } from './seat.js';
import { getTrace } from '../trace/trace_model.js';

/** A follower whose seat moved more than this share of the letter box is moved back on. */
export const RESEAT_SHARE = 0.005;

/**
 * Where the photo goes so one of its parts lands on its lines.
 * @param {Object} photo - see photo_scale.js
 * @param {String} partId
 * @param {Object} font - project.settings.font
 * @param {{left?: Number, scale?: Number, info?: Object}} [options] - left: where the left ink
 *   edge goes (font units); scale: use this scale instead of its row's (a follower under
 *   3 %); info: a photoScale result to reuse
 * @returns {Object | null}
 */
export function placePart(photo, partId, font, { left = 0, scale, info } = {}) {
	const part = (photo?.parts || []).find((candidate) => candidate?.id === partId);
	const use = photo?.uses?.[partId];
	const g = partGeometry(part);
	if (!g || typeof use?.char !== 'string') return null;
	const facts = info || photoScale(photo, font);
	const s = scale > 0 ? scale : facts.scales?.[partId] ?? facts.scale;
	if (!(s > 0) || !(partId in facts.tails)) return null;

	const tail = facts.tails[partId];
	const targets = lineTargets(use.char, font, { tail });
	const linePx = facts.lines[partId] ?? null;
	let body = null;
	if (targets.seat === 'bottom') {
		body = bodyBottom(part, targets, {
			scale: s,
			fromOthers: facts.from.some((id) => id !== partId),
			linePx: linePx ?? undefined,
			partnerPx: facts.partners[partId] ?? undefined,
			slope: facts.slope || 0,
			box: guideLines(font).box,
			// Only a guessed tail: his [No tail] puts it on its ink bottom
			optional: tailKind(use.char) === 'optional' && typeof use.tail !== 'boolean',
			spreadPx: facts.spread || 0,
		});
	}
	const seated = seatTraceY(part, targets, { bodyBottomPx: body?.px, scale: s });
	const leftFU = Number.isFinite(Number(left)) ? Number(left) : 0;
	return {
		x: Math.round(leftFU - g.left * s),
		y: Math.round(seated.y),
		scale: s,
		seat: seated.seat,
		linePx,
		bodyBottomPx: body?.px ?? null,
		bodyFrom: body?.from ?? null,
		tail,
		char: use.char,
	};
}

/**
 * The earlier letters of a photo that follow its new scale or seat.
 * @param {Object} photo
 * @param {Object} font - project.settings.font
 * @param {{getItem: Function, asset?: String, except?: String, share?: Number}} options
 * @returns {Array<{partId: String, itemId: String, char: String, from: Object, to: Object,
 *   resized: Boolean, reseated: Boolean}>} from / to: the letter's trace before and after
 */
export function followPlan(
	photo,
	font,
	{ getItem, asset = photo?.asset, except, share = FOLLOW_SHARE } = {}
) {
	const plan = [];
	if (typeof getItem !== 'function') return plan;
	const info = photoScale(photo, font);
	if (!(info.scale > 0)) return plan;
	const box = guideLines(font).box;

	for (const [partId, use] of Object.entries(photo?.uses || {})) {
		if (partId === except || !use?.itemId) continue;
		const item = getItem(use.itemId, partId);
		if (!isUntouched(item, asset)) continue;
		const from = getTrace(item);
		if (!from || (asset && from.asset !== asset)) continue;
		const part = photo.parts.find((candidate) => candidate?.id === partId);
		const g = partGeometry(part);
		if (!g) continue;

		const target = info.scales?.[partId] ?? info.scale;
		const resized = shouldFollow(from.scale, target, share);
		const scale = resized ? target : from.scale;
		const placed = placePart(photo, partId, font, { scale, info });
		if (!placed) continue;
		const reseated = !resized && Math.abs(placed.y - from.y) > RESEAT_SHARE * box;
		if (!resized && !reseated) continue;

		// Keep the left ink edge where it is now (spacing may have moved it since Use it)
		const inkLeft = from.x + g.left * from.scale;
		const to = { ...from, x: Math.round(inkLeft - g.left * scale), y: placed.y, scale };
		plan.push({ partId, itemId: use.itemId, char: use.char, from, to, resized, reseated });
	}
	return plan;
}
