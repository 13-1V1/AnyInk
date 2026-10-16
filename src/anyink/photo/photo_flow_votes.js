// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B16 photo fix: which letters of a photo say how big it was written (docs/UX-BEGINNER.md 4.4
	"One size for the whole photo"). Pure.

	The B16 acceptance run (first-try photo, B r e "na" H d): naming the touching "na" part n, and
	then the H he wrote far taller than the rest, moved the photo's one size each time, so the
	letters traced before them were resized behind his back ("Also resized small r and small e",
	then "small r needs a look now"). Such a part says nothing about his usual size, so it is
	left out of the photo's size (it is still placed, at the size the other letters give):
	- a part that may hold two letters written touching (photo_registry.js twoLettersFor: not when
	  it is named as a wide letter, m or w);
	- a letter far off the size of the other letters in its row (offSizeParts): its ratio more than
	  OFF_SIZE_SHARE off the median ratio of the row's named plain letters, once the row has at
	  least MIN_ROW_LETTERS of them. Only its own row is the yardstick, so a row written smaller
	  or bigger than the rest (photo_scale.js row sizes) never counts as off.
	When leaving them out leaves nothing to size the photo by, they count after all.

	  OFF_SIZE_SHARE (0.3), MIN_ROW_LETTERS (3)
	  offSizeParts(photo, font, info?, skip?) -> Set of part ids
	  votingFacts(record, photo, font) -> { photo, info, out }
	      photo: the photo as placement reads it with the left-out letters' names taken off (what
	      followPlan is handed); info: photoScale of that, with every named letter's tail and
	      ratio (so placePart(fullPhoto, id, font, { info }) seats a left-out letter too);
	      out: the left-out part ids
	  leftOutFollowers(photo, facts, font, { getItem, asset, except }) -> plan entries, as
	      fit_lines.js followPlan gives them, for left-out letters traced before: they follow the
	      photo's size like every other letter of it (one ink weight per photo)
*/
import { feedsScale, guideLines } from '../placement/classes.js';
import { RESEAT_SHARE, placePart } from '../placement/fit_lines.js';
import { FOLLOW_SHARE, isUntouched, photoScale, shouldFollow } from '../placement/photo_scale.js';
import { groupRows, median, partGeometry } from '../placement/seat.js';
import { getTrace } from '../trace/trace_model.js';
import { twoLettersFor } from './photo_registry.js';

/** A letter this share or more off its row's usual size is left out of the photo's size. */
export const OFF_SIZE_SHARE = 0.3;

/** A row says what size is usual only once it has this many named plain letters. */
export const MIN_ROW_LETTERS = 3;

/**
 * @param {Object} photo - { parts, uses } (placement/photo_scale.js)
 * @param {Object} font - project.settings.font
 * @param {Object} [info] - photoScale(photo, font), when already worked out
 * @param {Set<String>} [skip] - parts that are no yardstick (two letters touching)
 * @returns {Set<String>} the named letters far off their row's size
 */
export function offSizeParts(photo, font, info = photoScale(photo, font), skip = new Set()) {
	const out = new Set();
	const uses = photo?.uses || {};
	const limit = Math.log(1 + OFF_SIZE_SHARE);
	for (const row of groupRows(photo?.parts || [])) {
		const named = row.filter(
			(part) => !skip.has(part.id) && feedsScale(uses[part.id]?.char) && info.ratios?.[part.id] > 0
		);
		if (named.length < MIN_ROW_LETTERS) continue;
		const usual = median(named.map((part) => info.ratios[part.id]));
		for (const part of named) {
			if (Math.abs(Math.log(info.ratios[part.id] / usual)) > limit) out.add(part.id);
		}
	}
	return out;
}

/**
 * @param {Object} record - the photo's record (with or without this letter's use)
 * @param {Object} photo - photo_flow_data.js placementFor
 * @param {Object} font
 * @returns {{photo: Object, info: Object, out: Set<String>}} see the header
 */
export function votingFacts(record, photo, font) {
	const full = photoScale(photo, font);
	const uses = photo?.uses || {};
	const two = new Set(
		Object.entries(uses)
			.filter(([id, use]) => twoLettersFor(record, id, use?.char))
			.map(([id]) => id)
	);
	const out = new Set([...two, ...offSizeParts(photo, font, full, two)]);
	if (!out.size) return { photo, info: full, out };
	const voting = {
		...photo,
		uses: Object.fromEntries(Object.entries(uses).filter(([id]) => !out.has(id))),
	};
	const info = photoScale(voting, font);
	if (!(info.scale > 0)) return { photo, info: full, out: new Set() };
	return {
		photo: voting,
		info: { ...info, tails: { ...full.tails, ...info.tails }, ratios: { ...full.ratios } },
		out,
	};
}

/**
 * Left-out letters traced before follow the photo's size too (fit_lines.js followPlan's rule,
 * with the facts the other letters give).
 * @param {Object} photo - the whole photo (placementFor)
 * @param {{info: Object, out: Set<String>}} facts - votingFacts
 * @param {Object} font
 * @param {{getItem: Function, asset?: String, except?: String}} options
 * @returns {Array<Object>} plan entries { partId, itemId, char, from, to, resized, reseated }
 */
export function leftOutFollowers(photo, { info, out }, font, { getItem, asset, except } = {}) {
	const plan = [];
	if (typeof getItem !== 'function' || !(info?.scale > 0)) return plan;
	const box = guideLines(font).box;
	for (const partId of out || []) {
		const use = photo?.uses?.[partId];
		if (partId === except || !use?.itemId) continue;
		const item = getItem(use.itemId, partId);
		if (!isUntouched(item, asset)) continue;
		const from = getTrace(item);
		if (!from || (asset && from.asset !== asset)) continue;
		const g = partGeometry(photo.parts.find((part) => part?.id === partId));
		if (!g) continue;
		const target = info.scales?.[partId] ?? info.scale;
		const resized = shouldFollow(from.scale, target, FOLLOW_SHARE);
		const scale = resized ? target : from.scale;
		const placed = placePart(photo, partId, font, { scale, info });
		if (!placed) continue;
		const reseated = !resized && Math.abs(placed.y - from.y) > RESEAT_SHARE * box;
		if (!resized && !reseated) continue;
		const inkLeft = from.x + g.left * from.scale;
		const to = { ...from, x: Math.round(inkLeft - g.left * scale), y: placed.y, scale };
		plan.push({ partId, itemId: use.itemId, char: use.char, from, to, resized, reseated });
	}
	return plan;
}
