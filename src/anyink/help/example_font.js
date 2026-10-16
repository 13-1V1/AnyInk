// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 Help > More > "Look at an example font" (UX-BEGINNER.md 4.10): the Simple example font
	(src/samples/simpleExampleProject.json) in a new window, so the font he is making stays as it
	is in this one. The new window's address is this page's with ?ui=simple&example=1; at boot
	(main.js) openExampleIfAsked opens the example there, in Simple with 'help' on only.

	  EXAMPLE_PARAM                 'example'
	  exampleFontURL(href)          this page's address with ui=simple and example=1, no #
	  openExampleFont({ open })     opens it in a new window (window.open, '_blank')
	  isExampleAsked(search)        true when the address asks for the example
	  openExampleIfAsked({ search, isOn, simple, openExample })   at boot: opens the example when
	                                asked (openExample: openExampleProject by default); true when
	                                it did
	  openExampleProject()          the example through open_project.js's way in, loaded on first
	                                use (Help's page never pulls in the start screen)
*/
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';

export const EXAMPLE_PARAM = 'example';

/**
 * @param {String} [href] - defaults to this page's address
 * @returns {String}
 */
export function exampleFontURL(href = globalThis.location?.href || '') {
	const url = new URL(href, globalThis.location?.href || 'https://localhost/');
	url.searchParams.set('ui', 'simple');
	url.searchParams.set(EXAMPLE_PARAM, '1');
	url.hash = '';
	return url.toString();
}

/**
 * @param {{open?: Function}} [options]
 * @returns {Boolean} true when a window was asked for
 */
export function openExampleFont({ open = globalThis.open } = {}) {
	if (typeof open !== 'function') return false;
	open(exampleFontURL(), '_blank', 'noopener');
	return true;
}

/**
 * @param {String} [search] - defaults to this page's ?query
 * @returns {Boolean}
 */
export function isExampleAsked(search = globalThis.location?.search || '') {
	return new URLSearchParams(search).get(EXAMPLE_PARAM) === '1';
}

/** @returns {Promise<void>} the example font, opened the way the start page's examples are */
export async function openExampleProject() {
	const [{ importProjectDataAndNavigate }, sample] = await Promise.all([
		import('../../app/open_project.js'),
		import('../../samples/simpleExampleProject.json'),
	]);
	importProjectDataAndNavigate(sample.default || sample);
}

/** The example, with any failure said in the console only (the start screen stays) */
function openExampleQuietly() {
	openExampleProject().catch((error) =>
		console.warn('ANY-INK: the example font could not open', error)
	);
}

/**
 * @param {{search?: String, isOn?: Function, simple?: Boolean, openExample?: Function}} [options]
 * @returns {Boolean}
 */
export function openExampleIfAsked({
	search,
	isOn = isFeatureOn,
	simple = isSimpleMode(),
	openExample = openExampleQuietly,
} = {}) {
	if (!simple || !isOn('help') || !isExampleAsked(search)) return false;
	if (typeof openExample !== 'function') return false;
	openExample();
	return true;
}
