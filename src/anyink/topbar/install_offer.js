// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: Menu > Help > "Install ANY-INK as an app", shown only when it can work (UX-BEGINNER.md 4.9
	"Only if not installed", principle 8): Chrome has offered the install (its beforeinstallprompt
	event) and ANY-INK isn't running as the installed app. The row asks Chrome's own install box.
	Chrome lets an offer be asked once, so the row goes after it is pressed (or after the app is
	installed).
	B13: Chrome's offer is held by start/install_offer.js, which the install toast asks too, so
	whichever is pressed first uses it up and the other goes. This file only reads it from there.

	  canInstall()        true when the row may show
	  promptInstall()     Chrome's install box; resolves true when he installed
	  setInstallEventForTests(event)   stand in for Chrome's event (null: none)
*/
import {
	installEvent,
	isRunningInstalled,
	promptHeldInstall,
	setInstallEventForTests as setHeldEventForTests,
} from '../start/install_offer.js';

/** @returns {Boolean} */
export function canInstall() {
	return !!installEvent() && !isRunningInstalled();
}

/** @returns {Promise<Boolean>} true when he installed */
export async function promptInstall() {
	const { outcome } = await promptHeldInstall();
	return outcome === 'accepted';
}

/** @param {Object | null} event - a stand-in for beforeinstallprompt */
export function setInstallEventForTests(event) {
	setHeldEventForTests(event);
}
