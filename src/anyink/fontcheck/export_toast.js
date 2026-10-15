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
	fallback).
	B4: the check's own words are keys of src/anyink/words (check.*). The file name and the
	folder in the destination words are exact Windows labels, so the toast shows them in
	.anyink-quote (words.js menu.fileName), the one place the banned-word scan lets ".otf"
	through. The toast track routes the toast itself through one queue.
	B4 integration: in Simple the toast goes into the one queue as words (toast.js toast) with
	[Show me] as its button, in the export's group, so it takes the place of "Exported ..." and
	its button can never be lost while it waits behind another toast. All tools is unchanged.
*/
import './export-toast.css';
import { getCurrentProject, getCurrentProjectEditor } from '../../app/main.js';
import { closeAllToasts, showToast } from '../../controls/dialogs/dialogs.js';
import { getLastExportDestination } from '../../formats_io/otf/font_export.js';
import { getLastExportMessage } from '../files/export_folder.js';
import { isSimpleMode } from '../mode/mode.js';
import { navigationTargetForId } from '../preview/hit_test.js';
import { showItem } from '../preview/show_item.js';
import { toast } from '../toast/toast.js';
import { QUOTE_CLASS } from '../words/banned.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { validateFont } from './validate.js';
import { kernSubject } from './validate_kerning.js';

export const EXPORT_TOAST_MS = 12000;
export const SHOW_ME = word('check.showMe');
const MAX_NAMED = 5;
const MADE = ['folder', 'download'];

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
	// This export's own words, never an older export's.
	const fresh = !!after && after !== before;
	const where = fresh ? after.message : '';
	if (!clause) {
		if (isSimpleMode()) sayNextStep(fresh ? exportRecord(where) : null);
		return result;
	}
	const first = problems.find(({ itemId }) => navigationTargetForId(itemId));
	if (isSimpleMode()) {
		simpleToast(fresh ? exportRecord(where) : null, clause, first);
		return result;
	}
	showToast(toastHTML(where, clause), EXPORT_TOAST_MS);
	offerShowMe(first);
	return result;
}

/**
 * Simple (B4 + B5 finalize, UX-BEGINNER.md 7.7 "Export jargon, no next step"): after a font file
 * lands in its folder with nothing to fix, the next step to Word, after "Exported ..." (an info
 * toast of its own, so it waits its turn). B14's Use in Word card takes its place.
 * @param {{result: String, fileName: String, folder: String | null} | null} record
 */
function sayNextStep(record) {
	if (record?.result !== 'folder' || !record.folder || !record.fileName) return;
	toast(
		'menu.fontFileNextStep',
		{ folder: record.folder, file: record.fileName },
		{ quotes: ['folder', 'file'] }
	);
}

/**
 * Simple: the export check as one toast in the queue, its [Show me] the toast's button.
 * @param {{result: String, fileName: String, folder: String | null} | null} record - where
 *   this export's file went (export_folder.js), or null when its words aren't known
 * @param {String} clause - 'small a needs fixing.'
 * @param {{itemId: String} | undefined} problem - the first problem with a letter to open
 */
function simpleToast(record, clause, problem) {
	// B4 + B5 finalize: [Show me] belongs to the font that was exported; once another font is open
	// (Ctrl+O puts it in the same editor), the toast goes and its button does nothing
	const editor = getCurrentProjectEditor();
	const project = editor?.project;
	const stillGood = () => getCurrentProjectEditor() === editor && editor?.project === project;
	const action = problem
		? {
				key: 'check.showMe',
				run: () => showItem(editor, problem.itemId),
		  }
		: undefined;
	const options = {
		group: 'export',
		tone: 'warning',
		ms: EXPORT_TOAST_MS,
		quotes: ['file', 'folder'],
		action,
		stillGood,
	};
	if (record?.result === 'folder' && record.folder) {
		toast(
			'check.exportedButNeedsFixing',
			{ file: record.fileName, folder: record.folder, clause },
			options
		);
	} else if (record?.result === 'download') {
		toast('check.downloadingButNeedsFixing', { file: record.fileName, clause }, options);
	} else {
		toast('check.butNeedsFixing', { where: word('check.madeAnyway'), clause }, options);
	}
}

/**
 * @param {String} whereHTML - the destination words this export showed
 * @returns {Object | null} export_folder.js's record of them, when it is this export's
 */
function exportRecord(whereHTML) {
	const record = getLastExportMessage();
	if (!record || !record.fileName) return null;
	return withoutPeriod(record.message) === withoutPeriod(whereHTML) ? record : null;
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
		shown.push(word(letters ? 'check.moreLetters' : 'check.moreThings', { count: rest.length }));
	}

	const list =
		shown.length === 1
			? shown[0]
			: word('check.andList', { names: shown.slice(0, -1).join(', '), last: shown.at(-1) });
	const plural = subjects.length > 1 || subjects[0].plural;
	return word('check.needsFixing', { list, count: plural ? 2 : 1 });
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
	return word('check.butNeedsFixing', {
		where: withoutPeriod(where) || word('check.madeAnyway'),
		clause,
	});
}

/**
 * How one problem's item is named inside a sentence.
 * @param {Object} project
 * @param {String} itemId
 * @returns {{text: String, plural: Boolean, letter: Boolean}}
 */
function subjectFor(project, itemId) {
	if (itemId.startsWith('kern-')) {
		const text = kernSubject(project, itemId) || word('check.someGap');
		return { text, plural: false, letter: false };
	}
	const chars = charsFor(project, itemId);
	return {
		text: letterPhrase(chars) || word('check.aLetter'),
		plural: [...chars].length > 1,
		letter: true,
	};
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
	const lead = quoteNames(withoutPeriod(whereHTML)) || escapeHTML(word('check.madeAnyway'));
	const sentence = word('check.butNeedsFixing', { where: lead, clause: escapeHTML(clause) });
	return (
		'<div class="anyink-export-check">' +
		`<p class="anyink-export-check__text">${sentence}</p>` +
		`<button type="button" class="anyink-export-check__show" hidden>${escapeHTML(
			SHOW_ME
		)}</button>` +
		'</div>'
	);
}

/**
 * The export's destination words with its file name and folder shown as quotes: exact Windows
 * labels (UX-BEGINNER.md 2.3), so ".otf" in "BrennanHand-Regular.otf" is never read as jargon.
 * The names come from the export writer's own record, when these are its words.
 * @param {String} whereHTML - the destination words, as the toast held them ('' for none)
 * @returns {String} HTML
 */
function quoteNames(whereHTML) {
	if (!whereHTML) return '';
	const record = getLastExportMessage();
	if (!record || withoutPeriod(record.message) !== whereHTML) return whereHTML;
	const names = [record.fileName, record.folder]
		.filter((name) => typeof name === 'string' && name.trim() !== '' && whereHTML.includes(name))
		.sort((a, b) => b.length - a.length);
	if (!names.length) return whereHTML;
	const literal = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(names.map(literal).join('|'), 'g');
	const quoted = new Set();
	return whereHTML.replace(pattern, (name) => {
		if (quoted.has(name)) return name; // each name once: the first time it is said
		quoted.add(name);
		return `<span class="${QUOTE_CLASS}">${word('menu.fileName', { name })}</span>`;
	});
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
