// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: a photo as the flow reads it (docs/UX-BEGINNER.md 4.4): its pixels, its ink
	mask, its pen and each part's own mask, kept for the newest KEPT_PHOTOS photos of an editor (a
	whole page is read once, then each part is cut from memory), and the photo as placement reads
	it with one part named for one letter.

	Fix pass, 10/15/2026: a part's own mask holds only its letter's ink (photo_flow_ink.js): a box
	he drew without the cut ends of its neighbors (trimCutInk: the "la" his box round a got from
	the touching n), and no pieces no pen wrote (keepPenPieces: ruled-line bits, punch holes).
	Placement seats that ink, and the trace paints the rest out (photo_flow_pixels.js): all the
	photo's ink that isn't the part's, the ink photo-core's letter_ink.js left out of the parts
	included (photoInk's ink; its mask when it has none).

	  photoData(s, editor, record)   -> Promise<{ blob, image, mask, ink, findKey, stroke, masked:
	                                 Map(partId -> part with its own mask) }>; the masks are found
	                                 as when the parts were (record.find), whatever Adjust says now
	                                 (mask: the pen's ink the parts are cut from; ink: all of it);
	                                 stroke is the photo's pen in pixels (ink_parts.js findInk)
	  keepPixels(s, record, { blob, image, mask, ink, parts, stroke })   keeps pixels already read
	                                 (a photo just added), with the masks of the parts just found
	                                 and the pen they were found with (found again when not given)
	  placementFor(record, data, { partId, char, itemId })  the photo for placement/photo_scale.js
*/
import { attachMasks, findInk, photoInk } from './ink_parts.js';
import { keepPenPieces, trimCutInk } from './photo_flow_ink.js';
import { readPhotoPixels } from './photo_flow_pixels.js';
import { placementPhoto } from './photo_registry.js';

/** Pixels of at most this many photos are kept in memory per editor. */
export const KEPT_PHOTOS = 2;

/**
 * The photo's pixels, its ink mask (found as when its parts were, record.find) and each part
 * with its own mask.
 */
export async function photoData(s, editor, record) {
	const blob = editor.assets?.get?.(record.asset)?.blob;
	if (!blob) throw Object.assign(new Error('read-failed'), { code: 'read-failed' });
	let data = s.photos.get(record.asset);
	const findKey = `${record.find.paper}|${record.find.lightInk}`;
	if (!data || data.blob !== blob || data.findKey !== findKey) {
		const image = await readPhotoPixels(blob, record);
		const { mask, ink } = photoInk(image, record.find);
		data = keepPixels(s, record, { blob, image, mask, ink, parts: null });
	}
	const missing = record.parts.filter((part) => !sameBox(data.masked.get(part.id), part));
	if (missing.length) {
		const { width, height } = data.image;
		for (const part of attachMasks(missing, data.mask, width, height, { ink: data.ink }))
			data.masked.set(part.id, ownInk(part, data));
	}
	return data;
}

/** Keeps a photo's pixels (the newest KEPT_PHOTOS photos). */
export function keepPixels(s, record, { blob, image, mask, ink, parts, stroke }) {
	const data = {
		blob,
		image,
		mask,
		ink: ink instanceof Uint8Array && ink.length === mask.length ? ink : mask,
		findKey: `${record.find.paper}|${record.find.lightInk}`,
		stroke: Number(stroke) > 0 ? Number(stroke) : findInk(mask, image.width, image.height).stroke,
		masked: new Map(),
	};
	// The parts just found carry their masks already
	for (const part of parts || []) {
		const stored = record.parts.find((p) => p.id === part.id);
		if (stored && sameBox(part, stored)) {
			data.masked.set(part.id, ownInk({ ...stored, mask: part.mask }, data));
		}
	}
	s.photos.delete(record.asset);
	s.photos.set(record.asset, data);
	while (s.photos.size > KEPT_PHOTOS) s.photos.delete(s.photos.keys().next().value);
	return data;
}

/**
 * The part with only its letter's ink in its mask: a box he drew without the cut ends of its
 * neighbors, then without the pieces no pen wrote (photo_flow_ink.js). The box stays as stored.
 * @param {Object} part - { left, top, right, bottom, mask, drawn? }
 * @param {Object} data - the photo's kept pixels
 * @returns {Object} a new part
 */
function ownInk(part, data) {
	const w = part.right - part.left;
	const h = part.bottom - part.top;
	if (!(part.mask instanceof Uint8Array) || !(w > 0) || !(h > 0) || part.mask.length < w * h) {
		return part;
	}
	const { width, height } = data.image;
	// a box round ink the pen's mask lacks (lighter, another pen) reads all the ink: trim by it
	const photo = part.fullInk ? data.ink : data.mask;
	const trimmed = part.drawn
		? trimCutInk(part, photo, width, height, { stroke: data.stroke })
		: part.mask;
	return { ...part, mask: keepPenPieces(trimmed, w, h, { stroke: data.stroke }).mask };
}

function sameBox(a, b) {
	return (
		!!a &&
		!!b &&
		a.left === b.left &&
		a.top === b.top &&
		a.right === b.right &&
		a.bottom === b.bottom
	);
}

/**
 * The photo as placement reads it (placement/photo_scale.js), with this part named for this
 * letter: the part is in it even when it is a box he drew or a part he skipped before, and this
 * letter holds no other part of it (one part per letter).
 */
export function placementFor(record, data, { partId, char, itemId }) {
	const photo = placementPhoto(record, [...data.masked.values()]);
	const parts = photo.parts.some((part) => part.id === partId)
		? photo.parts
		: [...photo.parts, data.masked.get(partId)];
	const uses = {};
	for (const [id, use] of Object.entries(photo.uses)) {
		if (use.itemId !== itemId && id !== partId) uses[id] = use;
	}
	const old = record.used[partId];
	uses[partId] = { char, itemId };
	if (old?.char === char && typeof old.tail === 'boolean') uses[partId].tail = old.tail;
	return { asset: record.asset, parts, uses };
}
