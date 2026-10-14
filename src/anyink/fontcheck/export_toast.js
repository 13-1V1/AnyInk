// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The File menu export's font check (B1). The export runs exactly as before. When it has
	made the font file and the check finds something, the export's own words about where
	the file went stay on screen and carry on into the check's:
	  "Exported BrennanHand-Regular.otf to Fonts, but small b needs fixing.  [Show me]"
	with the amber (warning) edge instead of the green one (export-toast.css) and a
	[Show me] that opens the first letter named. A clean export's toast is unchanged.

	  exportWithFontCheck(exportFont)               run exportFont() in the same tick (pickers
	                                                keep the click), return its result, then toast
	  exportProblemsClause(problems, project)       'small a and the space need fixing.', or ''
	  exportProblemsMessage(problems, project, where)  where + ', but ' + the clause, or ''
	The destination words come from font_export.js getLastExportDestination (what
	export_folder.js writeExport showed, including a "Keep both" name or a download
	fallback). B4 moves these words into src/anyink/words/words.js and the toast into one queue.
*/
import './export-toast.css';
import { getCurrentProject, getCurrentProjectEditor } from '../../app/main.js';
import { closeAllToasts, showToast } from '../../controls/dialogs/dialogs.js';
import { getLastExportDestination } from '../../formats_io/otf/font_export.js';
import { navigationTargetForId } from '../preview/hit_test.js';
import { showItem } from '../preview/show_item.js';
import { letterPhrase } from '../words/letter_name.js';
import { validateFont } from './validate.js';
import { kernSubject } from './validate_kerning.js';

export const EXPORT_TOAST_MS = 12000;
export const SHOW_ME = 'Show me';
const MAX_NAMED = 5;
const MADE = ['folder', 'download'];
const MADE_ANYWAY = 'The font file was made';

/**
 * Runs a File menu export, then names anything the font check found.
 * @param {Function} exportFont - () => Promise<String | false> (ioFont_exportOTF and friends)
 * @returns {Promise<*>} the export's own result
 */
export async function exportWithFontCheck(exportFont) {
	const project = getCurrentProject();
	const before = getLastExportDestination();
	const result = await exportFont();
	if (!MADE.includes(result)) return result;
	const after = getLastExportDestination();

	let problems = [];
	try {
		problems = validateFont(project);
	} catch (error) {
		console.warn('ANY-INK font check could not run after the export', error);
	}
	const clause = exportProblemsClause(problems, project);
	if (!clause) return result;

	// This export's own words, never an older export's.
	const where = after && after !== before ? after.message : '';
	showToast(toastHTML(where, clause), EXPORT_TOAST_MS);
	offerShowMe(problems.find(({ itemId }) => navigationTargetForId(itemId)));
	return result;
}

/**
 * @param {Array<{itemId: String}>} problems - from validateFont
 * @param {Object} project - to name joined letters and kern pairs
 * @returns {String} 'small a and the question mark need fixing.', or '' when all is well
 */
export function exportProblemsClause(problems, project) {
	const ids = [];
	(problems || []).forEach(({ itemId }) => {
		if (typeof itemId === 'string' && !ids.includes(itemId)) ids.push(itemId);
	});
	if (ids.length === 0) return '';

	const subjects = ids.map((id) => subjectFor(project, id));
	const shown = subjects.slice(0, MAX_NAMED).map(({ text }) => text);
	const rest = subjects.slice(MAX_NAMED);
	if (rest.length) {
		const letters = rest.every(({ letter }) => letter);
		const noun = letters ? (rest.length === 1 ? ' letter' : ' letters') : '';
		shown.push(`${rest.length} more${noun}`);
	}

	const list =
		shown.length === 1 ? shown[0] : `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`;
	const plural = subjects.length > 1 || subjects[0].plural;
	return `${list} ${plural ? 'need' : 'needs'} fixing.`;
}

/**
 * @param {Array<{itemId: String}>} problems - from validateFont
 * @param {Object} project
 * @param {String} [where] - where the font file went ('Exported A.otf to Fonts'), as text
 * @returns {String} one sentence, or '' when all is well
 */
export function exportProblemsMessage(problems, project, where = '') {
	const clause = exportProblemsClause(problems, project);
	if (!clause) return '';
	return `${withoutPeriod(where) || MADE_ANYWAY}, but ${clause}`;
}

/**
 * How one problem's item is named inside a sentence.
 * @param {Object} project
 * @param {String} itemId
 * @returns {{text: String, plural: Boolean, letter: Boolean}}
 */
function subjectFor(project, itemId) {
	if (itemId.startsWith('kern-')) {
		const text = kernSubject(project, itemId) || 'the gap between two letters';
		return { text, plural: false, letter: false };
	}
	const chars = charsFor(project, itemId);
	return { text: letterPhrase(chars) || 'a letter', plural: [...chars].length > 1, letter: true };
}

/**
 * The characters an item stands for, from the project or, for a glyph, its id.
 * @param {Object} project
 * @param {String} itemId
 * @returns {String}
 */
function charsFor(project, itemId) {
	const chars = project?.getItem ? project.getItem(itemId)?.chars : '';
	if (typeof chars === 'string' && chars) return chars;
	const glyph = /^glyph-0x([0-9a-f]+)$/i.exec(itemId);
	if (!glyph) return '';
	const code = parseInt(glyph[1], 16);
	return Number.isInteger(code) && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

/**
 * @param {String} whereHTML - the destination toast's HTML ('' when there was none)
 * @param {String} clause - plain text
 * @returns {String} the toast's HTML
 */
function toastHTML(whereHTML, clause) {
	const lead = withoutPeriod(whereHTML) || escapeHTML(MADE_ANYWAY);
	return (
		'<div class="anyink-export-check">' +
		`<p class="anyink-export-check__text">${lead}, but ${escapeHTML(clause)}</p>` +
		`<button type="button" class="anyink-export-check__show" hidden>${SHOW_ME}</button>` +
		'</div>'
	);
}

/**
 * Shows [Show me] when the first problem has a letter to open.
 * @param {{itemId: String} | undefined} problem
 */
function offerShowMe(problem) {
	const toast = document.querySelector('#toast:not([data-leaving])');
	const button = toast?.querySelector('.anyink-export-check__show');
	if (!button || !problem) return;
	button.hidden = false;
	button.addEventListener('click', () => {
		toast.setAttribute('data-leaving', ''); // the next toast gets a fresh element
		closeAllToasts();
		showItem(getCurrentProjectEditor(), problem.itemId);
	});
}

/**
 * @param {String} text
 * @returns {String} trimmed, with one period at the end taken off
 */
function withoutPeriod(text) {
	return String(text ?? '')
		.trim()
		.replace(/\.$/, '');
}

function escapeHTML(text) {
	return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
