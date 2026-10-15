// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow, fix pass: step C's photo placement is never saved (docs/UX-BEGINNER.md 4.4
	"Cancel ... puts back the previous photo and its position", 7.3, 7.5).

	While step C runs, the photo sits on the letter where placement put it, locked, with no Undo
	step: it is a look, not a change. But a save during it wrote that look into the work file and
	the status said "Saved"; Cancel then put the earlier photo back in memory only, so the file
	kept a stray locked photo (and lost the earlier one) while still saying "Saved", and a crash
	snapshot taken then brought the same back. Every saved copy of the font goes through the
	letter's own save() (the work file and a crash snapshot through project.save(), an Undo step,
	the leave warning's comparison), so while the flow holds the letter, its save() gives the
	letter with the photo it had before step C. The hold asks the flow each time (isLive): once the
	flow ends, Use it is being put in (its Undo step must hold the new photo), or the letter is no
	longer the font's, it gives the letter as it is, so a hold left behind changes nothing.

	  holdSavedTrace(item, { before, isLive })   before: the trace to save instead (null: none)
	  releaseSavedTrace(item)                    takes the hold off again
	  isHeld(item)                               true while a hold is on
*/

/** Marks the save() a hold put on a letter. */
const HOLD = Symbol('anyink.photo.hold');

/**
 * @param {Object} item - Glyph
 * @param {{before: Object | null, isLive: () => Boolean}} hold
 */
export function holdSavedTrace(item, { before = null, isLive = () => false } = {}) {
	if (!item || typeof item.save !== 'function') return;
	releaseSavedTrace(item);
	const own = Object.getOwnPropertyDescriptor(item, 'save') || null;
	const original = item.save;
	const kept = before ? structuredClone(before) : null;
	function save(...args) {
		const saved = original.apply(this, args);
		let live = false;
		try {
			live = !!isLive();
		} catch {
			live = false;
		}
		return live ? withTrace(saved, kept) : saved;
	}
	save[HOLD] = { own };
	Object.defineProperty(item, 'save', {
		value: save,
		configurable: true,
		writable: true,
		enumerable: false,
	});
}

/**
 * @param {Object} item - Glyph
 */
export function releaseSavedTrace(item) {
	if (!item) return;
	const held = Object.getOwnPropertyDescriptor(item, 'save')?.value?.[HOLD];
	if (!held) return;
	if (held.own) Object.defineProperty(item, 'save', held.own);
	else delete item.save;
}

/**
 * @param {Object} item
 * @returns {Boolean}
 */
export function isHeld(item) {
	return !!(item && Object.getOwnPropertyDescriptor(item, 'save')?.value?.[HOLD]);
}

/** The saved letter with `trace` as its photo (none when null). */
function withTrace(saved, trace) {
	if (!saved || typeof saved !== 'object') return saved;
	const anyink = saved.anyink && typeof saved.anyink === 'object' ? { ...saved.anyink } : {};
	if (trace) anyink.trace = structuredClone(trace);
	else delete anyink.trace;
	const out = { ...saved };
	if (Object.keys(anyink).length) out.anyink = anyink;
	else delete out.anyink;
	return out;
}
