// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: drawing toasts. toast.js decides what shows; this file only puts it on the page.

	  showClassic(html, { duration, fancy, action, dismiss })
	      All tools: upstream's toast exactly as it has always looked and behaved. One #toast
	      element (reused while it shows), the message as HTML, the caller's time (3 s by
	      default), fancy kept. Each toast owns its timer (M7 finalize: upstream never cleared
	      the earlier toast's timer, so a 3 s hint removed the toast after it); a toast fading
	      out is marked data-leaving and the next one gets a fresh element. action: a button
	      { label, run } after the message, for a toast both modes share; dismiss: a plain
	      second button after it ("Not now").
	  renderSimple(entry, { onDone })
	      Simple: a fresh #toast marked data-anyink-toast="simple" (toast.css puts it bottom
	      right above the strip), role status, its words as text (or, for a message another
	      track still owns, its HTML), at most one outlined button and,
	      after it, one plain dismiss button ("Not now"). It lasts entry.ms; the
	      pointer over it pauses the time. onDone(entry) runs once when the time is up or the
	      button was pressed. An entry drawn again (an offer pushed aside comes back) is
	      timed by its newest element only.
	  leaveClassic()        B16: closeAllToasts marks the All tools toast leaving (its own fade
	                        follows), so a toast shown during that fade gets a fresh element
	  hideSimple(entry)     fades the entry's element out (data-leaving), stops its timer
	  fadeOut(element)      upstream's animateRemove: a 120 ms fade, then removed
	  writeDropLog(text)    Simple: the hidden record of a dropped message (toast.js)
	Every element is a #toast, so upstream's closeAllToasts and the banned-word scan's recorder
	(words/tests/banned_scan.js) see them all.
*/

/** The class of the hidden records of upstream messages Simple dropped (toast.js). */
export const DROP_LOG_ID = 'anyink-toast-dropped';
/** Dropped messages kept on the page. */
const DROP_LOG_SIZE = 20;

const timers = new WeakMap();

/**
 * Upstream's animateRemove (controls/dialogs/dialogs.js), here so this module never imports
 * the dialogs module that imports it.
 * @param {HTMLElement} element
 */
export function fadeOut(element) {
	const length = 120;
	element.animate?.(
		{ opacity: 0, transform: 'scale(0.98) translateY(-5px)' },
		{ duration: length }
	);
	(element.ownerDocument?.defaultView || window).setTimeout(() => {
		element.style.display = 'none';
		element.remove();
	}, length - 10);
}

/**
 * @param {{label: String, run: Function}} action
 * @param {Function} after - runs once the action ran
 * @param {String} [extraClass] - 'anyink-toast__dismiss' for the plain second button
 * @returns {HTMLButtonElement}
 */
const DISMISS_CLASS = 'anyink-toast__dismiss';

function makeButton(action, after, extraClass = '') {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = extraClass ? `anyink-toast__action ${extraClass}` : 'anyink-toast__action';
	button.textContent = action.label;
	let pressed = false;
	button.addEventListener('click', (event) => {
		event.stopPropagation();
		if (pressed) return;
		pressed = true;
		try {
			action.run?.();
		} finally {
			after();
		}
	});
	return button;
}

// --------------------------------------------------------------
// All tools
// --------------------------------------------------------------

/**
 * @param {String} html - the message (HTML, as upstream's showToast took it)
 * @param {{duration?: Number, fancy?: Boolean, action?: Object}} [options]
 */
export function showClassic(
	html,
	{ duration = 3000, fancy = false, action = null, dismiss = null } = {}
) {
	/** @type {HTMLElement} */
	let element = document.querySelector('#toast:not([data-leaving]):not([data-anyink-toast])');
	if (element) {
		window.clearTimeout(timers.get(element));
	} else {
		// B16: the newest replaces the last: one fading out goes at once, so a page changed many
		// times over (leaveClassic) never piles toasts up
		document
			.querySelectorAll('#toast[data-leaving]:not([data-anyink-toast])')
			.forEach((old) => old.remove());
		element = document.createElement('div');
		element.id = 'toast';
		element.setAttribute('tabindex', '-1');
		element.style.display = 'none';
		if (fancy) element.setAttribute('fancy', '');
		document.body.appendChild(element);
	}

	element.innerHTML = html;
	const leave = () => {
		window.clearTimeout(timers.get(element));
		timers.delete(element);
		element.setAttribute('data-leaving', '');
		fadeOut(element);
	};
	if (action) element.append(' ', makeButton(action, leave));
	if (dismiss) element.append(' ', makeButton(dismiss, leave, DISMISS_CLASS));
	element.style.display = 'block';
	const timer = window.setTimeout(leave, duration);
	timers.set(element, timer);
}

/**
 * B16: closeAllToasts fades the All tools toast out with upstream's animateRemove, which marks
 * nothing; a toast shown before that fade ended reused the element and went with it 110 ms
 * later (the Trace panel's page change took "Added a trace image..."). toast.js clearToasts
 * runs first in closeAllToasts and calls this: the element is marked leaving and its timer
 * stopped, so the next toast gets a fresh element. Upstream's fade still removes this one.
 */
export function leaveClassic() {
	document.querySelectorAll('#toast:not([data-leaving]):not([data-anyink-toast])').forEach((el) => {
		window.clearTimeout(timers.get(el));
		timers.delete(el);
		el.setAttribute('data-leaving', '');
	});
}

// --------------------------------------------------------------
// Simple
// --------------------------------------------------------------

/**
 * @param {Array<{text: String, quote?: Boolean}>} parts - from toast.js wordParts
 * @returns {HTMLParagraphElement} the words as text; a quote in .anyink-quote
 */
function wordsElement(parts) {
	const paragraph = document.createElement('p');
	paragraph.className = 'anyink-toast__text';
	parts.forEach(({ text, quote }) => {
		if (!quote) {
			paragraph.append(text);
			return;
		}
		const name = document.createElement('span');
		name.className = 'anyink-quote';
		name.textContent = text;
		paragraph.append(name);
	});
	return paragraph;
}

/**
 * @param {Object} entry - { parts | html, kind, tone, ms, action }
 * @param {{onDone: (entry: Object) => void}} hooks
 * @returns {HTMLElement}
 */
export function renderSimple(entry, { onDone }) {
	const element = document.createElement('div');
	element.id = 'toast';
	element.dataset.anyinkToast = 'simple';
	element.dataset.kind = entry.kind || 'info';
	if (entry.tone) element.dataset.tone = entry.tone;
	element.setAttribute('role', 'status');
	element.setAttribute('aria-live', 'polite');
	element.setAttribute('tabindex', '-1');

	if (entry.html !== undefined) {
		element.innerHTML = entry.html; // a message already in house words, as it came
	} else {
		element.appendChild(wordsElement(entry.parts || [{ text: entry.text }]));
	}

	// An entry can be drawn again (an offer pushed aside comes back, queue.js): only the element
	// drawn last speaks for it, so an older one fading out never ends it
	const isLatest = () => entry.element === element && !element.hasAttribute('data-leaving');
	let finished = false;
	const finish = () => {
		if (finished) return;
		finished = true;
		if (entry.element !== element) return;
		window.clearTimeout(entry.timer);
		onDone(entry);
	};
	if (entry.action) element.append(' ', makeButton(entry.action, finish));
	if (entry.dismiss) element.append(' ', makeButton(entry.dismiss, finish, DISMISS_CLASS));

	// The time left; the pointer over the toast stops it (4.0: hover pauses them)
	entry.left = entry.ms;
	const start = () => {
		entry.startedAt = Date.now();
		entry.timer = window.setTimeout(finish, entry.left);
	};
	let hovered = false;
	element.addEventListener('mouseenter', () => {
		hovered = true;
		if (finished || !isLatest()) return;
		window.clearTimeout(entry.timer);
		entry.left = Math.max(0, entry.left - (Date.now() - entry.startedAt));
	});
	element.addEventListener('mouseleave', () => {
		hovered = false;
		if (!finished && isLatest()) start();
	});

	element.style.display = 'flex';
	document.body.appendChild(element);
	entry.element = element;
	entry.finish = finish;
	/** The same words again: a fresh full time (toast.js). */
	entry.refresh = (ms) => {
		if (finished || !isLatest()) return;
		window.clearTimeout(entry.timer);
		entry.left = ms;
		if (!hovered) start();
	};
	start();
	return element;
}

/**
 * @param {Object} entry - one renderSimple drew
 */
export function hideSimple(entry) {
	window.clearTimeout(entry?.timer);
	const element = entry?.element;
	if (!element || element.hasAttribute('data-leaving')) return;
	element.setAttribute('data-leaving', '');
	if (element.isConnected) fadeOut(element);
}

/**
 * Simple: records a dropped message in a hidden element marked for the scan's toast recorder
 * (one element each, so the recorder reads each message on its own), so a scripted Simple flow
 * that drops a message fails the banned-word scan. The newest DROP_LOG_SIZE are kept.
 * @param {String} text
 */
export function writeDropLog(text) {
	const record = document.createElement('div');
	record.className = DROP_LOG_ID;
	record.dataset.anyinkToast = 'dropped';
	record.hidden = true;
	record.setAttribute('aria-hidden', 'true');
	record.textContent = text;
	document.body.appendChild(record);
	const all = document.querySelectorAll(`.${DROP_LOG_ID}`);
	for (let i = 0; i < all.length - DROP_LOG_SIZE; i++) all[i].remove();
}
