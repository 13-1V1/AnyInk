// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Where the app notices sit (B1 fix pass, until B6 decides where notices live): one line in the
	top bar's empty middle, just left of the save status, so a notice covers nothing on any page.
	The top bar is rebuilt on every page change (navigator.js), and the save status grows and
	shrinks as it changes, so the place is worked out again then.
	pwa.css reads two values this sets on the notices box:
	  --anyink-notice-right  from the window's right edge to just left of the save status
	  --anyink-notice-room   how wide a notice may be: back to just right of the menus
	With no top bar (the start page) both are cleared and the CSS fallbacks put the notice in the
	top right corner, which is empty there.
	B6 + B7 integration: Simple's top bar (B6) has no menus, and Undo and Redo sit just left of
	its status pill, so there the notice goes inside the bar's flexible gap between the rail and
	Undo (data-anyink-slot="notices"), centered on its row (--anyink-notice-top); its right end
	never passes the gap, so it covers no control. B16 final: a gap narrower than one short line
	(MIN_ROOM) puts it under the bar and the Next line, at the window's right.
*/

/** px kept clear between a notice and the menus or the save status. */
export const NOTICE_GAP = 12;
/** A notice never gets narrower than this; its sentence shortens with "...". */
const MIN_ROOM = 160;
/** A notice's height (pwa.css .anyink-pwa-notice), to center it on Simple's top bar row */
const NOTICE_HEIGHT = 32;

/**
 * @param {HTMLElement} container - the notices box (#anyink-pwa-notices)
 * @param {Document} [doc]
 * @param {{innerWidth: Number}} [win]
 */
export function placeNotices(container, doc = document, win = window) {
	if (!container) return;
	if (placeInSlot(container, doc, win)) return;
	container.style.removeProperty('--anyink-notice-top');
	const status = doc.querySelector('#app__top-bar anyink-save-status');
	const menus = doc.querySelector('#app__top-bar .top-bar__menus');
	const statusBox = status?.getBoundingClientRect();
	if (!statusBox || !(statusBox.width > 0)) {
		container.style.removeProperty('--anyink-notice-right');
		container.style.removeProperty('--anyink-notice-room');
		return;
	}
	const width = win.innerWidth;
	const right = Math.round(width - statusBox.left + NOTICE_GAP);
	const menusBox = menus?.getBoundingClientRect();
	const left = menusBox && menusBox.width > 0 ? menusBox.right + NOTICE_GAP : NOTICE_GAP;
	const room = Math.max(MIN_ROOM, Math.round(statusBox.left - NOTICE_GAP - left));
	container.style.setProperty('--anyink-notice-right', `${right}px`);
	container.style.setProperty('--anyink-notice-room', `${room}px`);
}

/**
 * Simple's top bar (B6): inside its notices gap.
 * @param {HTMLElement} container
 * @param {Document} doc
 * @param {{innerWidth: Number}} win
 * @returns {Boolean} true when the bar has the gap and the notice was placed in it
 */
function placeInSlot(container, doc, win) {
	const slot = doc.querySelector('#app__top-bar [data-anyink-slot="notices"]');
	const box = slot?.getBoundingClientRect();
	if (!box || !(box.width > 0)) return false;
	let right = Math.round(win.innerWidth - box.right + NOTICE_GAP);
	const room = Math.max(MIN_ROOM, Math.round(box.width - 2 * NOTICE_GAP));
	let top = Math.max(0, Math.round(box.top + (box.height - NOTICE_HEIGHT) / 2));
	if (box.width - 2 * NOTICE_GAP < MIN_ROOM) {
		// B16 final: a gap too narrow for one short line (every step's words kept at 1280 px):
		// under the bar and the Next line, at the window's right, where it covers no control
		const coach = doc.querySelector('anyink-coach')?.getBoundingClientRect();
		const under = Math.max(box.bottom, coach && coach.height > 0 ? coach.bottom : 0);
		top = Math.round(under + NOTICE_GAP / 2);
		right = NOTICE_GAP;
	}
	container.style.setProperty('--anyink-notice-right', `${right}px`);
	container.style.setProperty('--anyink-notice-room', `${room}px`);
	container.style.setProperty('--anyink-notice-top', `${top}px`);
	return true;
}

let watching = null;

/**
 * Keeps the notices box placed: on page changes, window resizes and save status changes.
 * Safe to call more than once; the newest box is the one placed.
 * @param {HTMLElement} container
 */
export function watchNoticePlace(container) {
	const place = () => placeNotices(container);
	if (watching) {
		watching.container = container;
		place();
		return;
	}
	watching = { container, observed: null, observer: null };
	const again = () => {
		placeNotices(watching.container);
		observeStatus();
	};
	const observeStatus = () => {
		if (typeof ResizeObserver !== 'function') return;
		// Simple's top bar: the gap itself, which the pill and the rail both resize
		const status =
			document.querySelector('#app__top-bar [data-anyink-slot="notices"]') ||
			document.querySelector('#app__top-bar anyink-save-status');
		if (!status || status === watching.observed) return;
		watching.observer?.disconnect();
		watching.observer = new ResizeObserver(() => placeNotices(watching.container));
		watching.observer.observe(status);
		watching.observed = status;
	};
	window.addEventListener('anyink-page-change', again);
	window.addEventListener('resize', again);
	again();
}
