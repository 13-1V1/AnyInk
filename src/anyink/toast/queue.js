// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: the one toast queue (UX-BEGINNER.md 4.0 Toasts). Pure: it only decides which toast
	shows; toast_view.js draws it and toast.js runs the two together.

	One toast shows at a time. Kinds, highest priority first: undo/redo ("Undid: traced B
	[Redo]"), destructive ("Cleared B [Undo]"), automatic ("Made shape 2 a hole [Make it
	solid]"), info. When a toast arrives while another shows:
	  - toasts of one stream never queue behind each other: the newer one takes the older one's
	    place, waiting or showing. A stream is a group ('merge': "Merging the shapes..." then
	    "Merged the shapes"; 'file', 'drop', 'export', 'toolSwitch'), or, for toasts with no
	    group and no button, the same words again ("That shape was too small" twice);
	  - otherwise the one showing stays when its kind is higher, and info toasts wait their turn
	    ("a toast with a button is never replaced by an info toast; info toasts wait their
	    turn"), so an error toast is never wiped by the next note; the new one waits;
	  - a newer undo, destructive or automatic toast takes the place of one of its own kind (the
	    newer press, the newer state), and a higher kind takes the place of a lower one at once.
	An offer, an info toast with a button ("Couldn't save a backup copy [Save]", the export
	check's [Show me]), stays good until it is pressed or its time is up: pushed aside by a
	higher kind it waits for its turn again, and clear({ keepOffers }) keeps it. The button of
	an undo, destructive or automatic toast belongs to the newest change, so a newer toast that
	takes its place ends it.
	Waiting toasts come out highest kind first, oldest first. At most MAX_WAITING wait; past
	that one is dropped: a toast with no button and no warning first, then a warning, a toast
	with a button last; among those the lowest kind, then the oldest.

	  createQueue({ maxWaiting, isLive })   { current, waiting, add(entry), done(entry), clear() }
	    isLive(entry)  false: the toast is over before its turn (an offer whose font is gone,
	                 B4 + B5 finalize): it never shows from the line and a clear takes it
	    add(entry)   -> { show, hide, dropped }  show: draw it now; hide: take that one down
	    done(entry)  -> { show }  its time ran out, its button was pressed, or it was closed
	    clear({ keepOffers })  -> { hide, show, dropped }  closeAllToasts: everything goes, or,
	                 with keepOffers (Simple), everything but the offers
	  An entry is any object with kind ('undo' | 'destructive' | 'automatic' | 'info'), and
	  optionally action (a button), group, text and tone ('warning'); the queue adds seq.
	  keepsPlace(current, incoming), isSameStream(a, b), isOffer(entry), rankOf(kind)
*/

/** 4.0's kinds, highest priority first */
export const KINDS = Object.freeze(['undo', 'destructive', 'automatic', 'info']);

/** At most this many toasts wait their turn. */
export const MAX_WAITING = 4;

/**
 * @param {String} kind
 * @returns {Number} 3 for undo down to 0 for info (and for anything unknown)
 */
export function rankOf(kind) {
	const index = KINDS.indexOf(kind);
	return index < 0 ? 0 : KINDS.length - 1 - index;
}

/**
 * @param {Object} a
 * @param {Object} b
 * @returns {Boolean} true when the newer of the two takes the older one's place: one group,
 *   or the same words again with no group and no button
 */
export function isSameStream(a, b) {
	if (a.group || b.group) return !!a.group && a.group === b.group;
	if (a.action || b.action) return false;
	return typeof a.text === 'string' && a.text !== '' && a.text === b.text && a.kind === b.kind;
}

/**
 * @param {Object} entry
 * @returns {Boolean} true for an offer: an info toast with a button, good until it is pressed
 */
export function isOffer(entry) {
	return !!entry?.action && rankOf(entry.kind) === 0;
}

/**
 * @param {Object} current - the toast showing
 * @param {Object} incoming - the toast that just arrived
 * @returns {Boolean} true when the one showing stays and the new one waits
 */
export function keepsPlace(current, incoming) {
	if (isSameStream(current, incoming)) return false;
	const held = rankOf(current.kind);
	const coming = rankOf(incoming.kind);
	if (held !== coming) return held > coming;
	// Info toasts wait their turn; a newer toast of a higher kind is the newer state
	return held === 0;
}

/** Highest kind first, then oldest first. */
function byTurn(a, b) {
	return rankOf(b.kind) - rankOf(a.kind) || a.seq - b.seq;
}

/** 0: no button and no warning (dropped first), 1: a warning, 2: a button (dropped last). */
function keepWeight(entry) {
	if (entry.action) return 2;
	return entry.tone === 'warning' ? 1 : 0;
}

/** Which of two waiting toasts is dropped first when the line is too long. */
function dropsFirst(a, b) {
	return keepWeight(a) - keepWeight(b) || rankOf(a.kind) - rankOf(b.kind) || a.seq - b.seq;
}

/**
 * @param {{maxWaiting?: Number, isLive?: (entry: Object) => Boolean}} [options]
 */
export function createQueue({ maxWaiting = MAX_WAITING, isLive = () => true } = {}) {
	let current = null;
	let waiting = [];
	let seq = 0;

	/** Drops waiting toasts, the least needed first, until the line fits. */
	function trim(dropped) {
		while (waiting.length > maxWaiting) {
			const first = waiting.reduce((a, b) => (dropsFirst(a, b) <= 0 ? a : b));
			waiting = waiting.filter((entry) => entry !== first);
			dropped.push(first);
		}
	}

	/** The next toast in line that is still good; the ones that aren't leave the line. */
	function nextLive() {
		while (waiting.length) {
			const next = waiting.shift();
			if (isLive(next)) return next;
		}
		return null;
	}

	/** Puts a toast in the line, in its turn. */
	function wait(entry, dropped) {
		waiting.push(entry);
		waiting.sort(byTurn);
		trim(dropped);
	}

	return {
		/** @returns {Object | null} the toast showing */
		get current() {
			return current;
		},
		/** @returns {Array<Object>} the toasts waiting, in the order they will show */
		get waiting() {
			return [...waiting];
		},

		/**
		 * @param {Object} entry
		 * @returns {{show: Object | null, hide: Object | null, dropped: Array<Object>}}
		 */
		add(entry) {
			entry.seq = ++seq;
			const dropped = [];
			waiting = waiting.filter((other) => {
				if (!isSameStream(other, entry)) return true;
				dropped.push(other);
				return false;
			});
			if (!current) {
				current = entry;
				return { show: entry, hide: null, dropped };
			}
			if (keepsPlace(current, entry)) {
				wait(entry, dropped);
				return { show: null, hide: null, dropped };
			}
			const hide = current;
			current = entry;
			// An offer a higher kind pushed aside waits for its turn again
			if (isOffer(hide) && !isSameStream(hide, entry)) wait(hide, dropped);
			return { show: entry, hide, dropped };
		},

		/**
		 * @param {Object} entry - a toast whose time is over (or that was closed)
		 * @returns {{show: Object | null}} the next one to draw
		 */
		done(entry) {
			if (entry !== current) {
				waiting = waiting.filter((other) => other !== entry);
				return { show: null };
			}
			current = nextLive();
			return { show: current };
		},

		/**
		 * closeAllToasts.
		 * @param {{keepOffers?: Boolean}} [options] - true (Simple): offers stay, showing or waiting
		 * @returns {{hide: Object | null, show: Object | null, dropped: Array<Object>}}
		 */
		clear({ keepOffers = false } = {}) {
			const keep = (entry) => keepOffers && isOffer(entry) && isLive(entry);
			const hide = current && !keep(current) ? current : null;
			if (hide) current = null;
			const dropped = waiting.filter((entry) => !keep(entry));
			waiting = waiting.filter(keep);
			let show = null;
			if (!current && waiting.length) {
				current = nextLive();
				show = current;
			}
			return { hide, show, dropped };
		},
	};
}
