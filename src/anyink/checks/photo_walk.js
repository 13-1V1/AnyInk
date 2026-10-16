// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 fix pass: a letter's size is judged once its photo is used up (UX-BEGINNER.md 4.4
	"One size for the whole photo", 4.2 "Ready", 7.2). While he is still tracing the letters of
	one photo, its scale moves with every letter he names (placement/photo_scale.js), and the
	letters traced from it so far follow (applyFollow): a size judged mid-walk turns the wrong
	letters amber and drops the rail (the critic's IMG_5012 walk: B and d "too short" while the
	e and H he wrote too big were Ready, then the other way round two letters later). So the size
	check waits on a letter that is still exactly as traced from a photo (photo_flow_fit.js
	isAsTraced) while that photo has free parts left (photo_registry.js unusedParts) and he
	hasn't pressed "Done with this photo". Every other check still shows, and a letter he has
	changed since is judged like any other.
	B10 + B11 finalize (the critic's "a partly traced photo hides its letters' size problems
	indefinitely": a stray dot left as a part, or letters he never names, kept a 1.6 times too
	big e Ready for good): the wait lasts only while the photo's scale can still move a lot, that
	is while fewer than SETTLED_LETTERS plain letters (a to z, A to Z: the ones its median reads,
	placement/classes.js feedsScale) are named from it. From the third on, the median of three
	holds against one letter written off, so a size problem shows, Done or not.
	B10 + B11 finalize, second pass (the verifier's walk e H r B d a n: e and H, the two letters
	written too big, came first, so after the third the median of three called the r "too short"
	with a green [Match size], and two letters later the verdict flipped back): a median holds
	against fewer than half its letters written off, so the wait lasts to SETTLED_LETTERS 5 (two
	off-size letters among the first five still leave the right verdict). Done with this photo,
	or the photo used up, still ends it at once, and the Next line's rule 12 asks for those.

	  sizeWaits(item, project)   true while the letter's size check waits for its photo
	  photoWalkStamp(project)    a short text that changes when any photo gains or loses a free
	                             part or is marked done (the checks cache's pass key: none of it
	                             is an Undo step of its own)
*/
import { isAsTraced } from '../photo/photo_flow_fit.js';
import { feedsScale } from '../placement/classes.js';
import { photosOf, unusedParts } from '../photo/photo_registry.js';

/** From this many plain letters named from a photo, its scale holds and sizes are judged. */
export const SETTLED_LETTERS = 5;

/**
 * @param {Object} item - Glyph
 * @param {Object} project - GlyphrStudioProject
 * @returns {Boolean}
 */
export function sizeWaits(item, project) {
	const asset = item?.anyink?.photoFit?.asset;
	if (typeof asset !== 'string' || !asset || !project) return false;
	const photos = photosOf(project);
	// read as it is (getPhoto would repair a damaged record in place: the checks change nothing)
	const record = photos && Object.hasOwn(photos, asset) ? photos[asset] : null;
	if (!record || typeof record !== 'object' || record.done === true) return false;
	if (!isAsTraced(item, asset)) return false;
	if (namedLetters(record) >= SETTLED_LETTERS) return false;
	return unusedParts(record).length > 0;
}

/** @returns {Number} the plain letters named from a photo (its scale's median reads them) */
function namedLetters(record) {
	const used = record.used && typeof record.used === 'object' ? record.used : {};
	return Object.values(used).filter((use) => feedsScale(use?.char)).length;
}

/**
 * @param {Object} project - GlyphrStudioProject
 * @returns {String}
 */
export function photoWalkStamp(project) {
	const photos = photosOf(project);
	if (!photos) return '';
	return Object.keys(photos)
		.sort()
		.map((asset) => {
			const record = photos[asset];
			if (!record || typeof record !== 'object') return asset;
			const parts = Array.isArray(record.parts) ? record.parts.length : 0;
			const used = record.used && typeof record.used === 'object' ? record.used : {};
			const uses = Object.keys(used)
				.sort()
				.map((part) => `${part}=${used[part]?.itemId || ''}`)
				.join(',');
			const skipped = Array.isArray(record.skipped) ? record.skipped.length : 0;
			return `${asset}:${parts}:${uses}:${skipped}:${record.done ? 1 : 0}`;
		})
		.join('|');
}
