// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
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
*/

/** px kept clear between a notice and the menus or the save status. */
export const NOTICE_GAP = 12;
/** A notice never gets narrower than this; its sentence shortens with "...". */
const MIN_ROOM = 160;

/**
 * @param {HTMLElement} container - the notices box (#anyink-pwa-notices)
 * @param {Document} [doc]
 * @param {{innerWidth: Number}} [win]
 */
export function placeNotices(container, doc = document, win = window) {
	if (!container) return;
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
		const status = document.querySelector('#app__top-bar anyink-save-status');
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
