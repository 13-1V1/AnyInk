// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: Menu > Help > "Install ANY-INK as an app", shown only when it can work (UX-BEGINNER.md 4.9
	"Only if not installed", principle 8): Chrome has offered the install (its beforeinstallprompt
	event, which pwa/register.js also hears for its one-time offer) and ANY-INK isn't running as
	the installed app. The row asks Chrome's own install box. Chrome lets an offer be asked once,
	so the row goes after it is pressed (or after the app is installed).

	  canInstall()        true when the row may show
	  promptInstall()     Chrome's install box; resolves true when he installed
	  setInstallEventForTests(event)   stand in for Chrome's event (null: none)
*/

/** Chrome's beforeinstallprompt event, while it can still be asked */
let offer = null;

globalThis.addEventListener?.('beforeinstallprompt', (event) => {
	offer = event;
});
globalThis.addEventListener?.('appinstalled', () => {
	offer = null;
});

/** @returns {Boolean} true while ANY-INK runs as the installed app */
function isInstalled() {
	try {
		if (globalThis.matchMedia?.('(display-mode: standalone)')?.matches) return true;
	} catch {
		// no matchMedia (tests): not installed
	}
	return globalThis.navigator?.standalone === true;
}

/** @returns {Boolean} */
export function canInstall() {
	return !!offer && typeof offer.prompt === 'function' && !isInstalled();
}

/** @returns {Promise<Boolean>} true when he installed */
export async function promptInstall() {
	const event = offer;
	if (!event) return false;
	offer = null; // Chrome answers one prompt per offer
	try {
		await event.prompt();
		const choice = await event.userChoice;
		return choice?.outcome === 'accepted';
	} catch (error) {
		console.warn('ANY-INK install: Chrome did not show its install box', error);
		return false;
	}
}

/** @param {Object | null} event - a stand-in for beforeinstallprompt */
export function setInstallEventForTests(event) {
	offer = event || null;
}
