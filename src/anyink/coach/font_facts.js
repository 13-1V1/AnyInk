// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6: what the coach reads from the open font (UX-BEGINNER.md 4.0, 4.2). Pure functions over an
	editor and its font; reading never changes the font (a letter's record is looked up, never
	made). coach_state.js adds what happened this session (changes, Try it, skips) and what is on
	screen (dialogs, the photo card).

	  pageOf(editor, appLevel)       'board' (Overview), 'letter' (Characters), 'other', 'start'
	  letterItem(project, char)      the letter's record, or null (never makes one)
	  charOfItem(item)               the letter a record is for ('glyph-0x61' -> 'a'), or ''
	  hasInk(item, { open })         board/letter_set.js's rule: finished shapes with an area,
	                                 never the shape the Point pen is still drawing (4.2's stub
	                                 until B11: a letter is Ready when it has ink)
	  letterFacts(item, char, { checks, checksOn, editor, open })
	                                 { char, ink, shapes, ready, needsLook, drawing }; shapes:
	                                 it has a finished shape (a stray line only: shapes, no ink,
	                                 neither empty nor Ready); needsLook comes from B11's checks
	                                 (sources.checks), only while 'checks' is on; drawing is null
	                                 here (deriveEditorState sets it)
	  fontNameOf(project)            the font's name
	  defaultTryItText(project)      the Try-it text: what he typed in the strip, else the
	                                 font's name (4.0: it starts as the font name)
	  photoRecords(project)          [{ id, unused, done }] from settings.anyink.photos: B9's
	                                 registry's own reader (photo_registry.js photoSummaries)
	  hasAnyPhoto(project)           a letter holds a photo, or a photo record exists
	  firstProblem(editor, payload)  the font check's first problem: { itemId, problem, text,
	                                 fixable } or null
	  allProblems(editor, payload)   every problem, the same way, in the check's order
	  saveStateOf(editor)            Simple's save status: 'saved', 'saving', 'not-saved',
	                                 'failed'
	  letterFingerprint(item)        a number that changes when the letter's ink or width does
	  fontFingerprint(project)       a number that changes when the gap fixes or the guide lines
	                                 do (what a font file holds beside its letters); null for no
	                                 font
	  deriveEditorState(editor, { isOn, sources, appLevel })   the rules' state for the font
	B6 + B7 fix pass: in the letter view the state also says which tool is picked (tool), and
	the open letter whose Point pen shape is still open (open_shape.js) is drawing: { points },
	never ready, until the shape is finished.
	B6 + B7 finalize: the open shape is left out of every letter's ink on every page (the board
	too), by the rule the rail and the letter card read (board/letter_set.js), and the state
	lists every problem of the last font check (fontProblems), so a skip of one letter's problem
	lasts while another letter's problem shows first.
*/
import { charToHex, hexesToChars } from '../../common/character_ids.js';
import { getSaveStatus, saveStatusWords } from '../files/save_status.js';
import { isProjectFileHandle } from '../files/write_file.js';
import { getLastFontCheck } from '../fontcheck/font_check.js';
import { isFeatureOn } from '../mode/features.js';
import { isOpeningBrush } from '../nib/default_tool.js';
import { photoSummaries } from '../photo/photo_registry.js';
import { getPref } from '../prefs/prefs.js';
import { canFixProblem } from '../preview/fix_it.js';
import { firstCheckProblem } from '../preview/font_status.js';
import { collectReferencedAssetIds } from '../trace/trace_model.js';
import { hasInk, isEmptyLetter } from '../board/letter_set.js';
import { getBoardFilter } from '../board/filters.js';
import { lettersInSet } from './letter_order.js';
import { openPathOf, openShapeOf } from './open_shape.js';

/** The strip's own pref for the Try-it text (preview_strip.js PREF_KEYS.text) */
export const TRY_IT_TEXT_PREF = 'previewText';

const PAGES = Object.freeze({ Overview: 'board', Characters: 'letter' });

/**
 * @param {Object} editor - ProjectEditor
 * @param {Boolean} [appLevel] - the app's own page (the open page) is showing
 * @returns {'board' | 'letter' | 'other' | 'start'}
 */
export function pageOf(editor, appLevel = false) {
	if (appLevel || !editor?.project) return 'start';
	return PAGES[editor.nav?.page] || 'other';
}

/**
 * @param {Object} project
 * @param {String} char
 * @returns {Object | null} the letter's record; never makes one
 */
export function letterItem(project, char) {
	const hex = charToHex(char);
	if (!hex || typeof project?.getItem !== 'function') return null;
	return project.getItem(`glyph-${hex}`) || null;
}

/**
 * @param {Object} item - a Glyph
 * @returns {String} its letter, or '' for joined letters, parts and anything else
 */
export function charOfItem(item) {
	const match = /^glyph-(0x[0-9a-f]+)$/i.exec(String(item?.id || ''));
	return match ? hexesToChars(match[1]) || '' : '';
}

// B6 + B7 integration: the "has ink" stub is board/letter_set.js's, the one the rail counts with
export { hasInk };

/**
 * @param {Object | null} item
 * @param {String} char
 * @param {Object} [options]
 * @param {Function | null} [options.checks] - B11: (item, { char, editor }) => needsLook | null
 * @param {Boolean} [options.checksOn]
 * @param {Object} [options.editor]
 * @param {Object | null} [options.open] - the shape the Point pen is still drawing
 * @returns {{char: String, ink: Boolean, shapes: Boolean, ready: Boolean,
 *   needsLook: Object | null, drawing: null}}
 */
export function letterFacts(
	item,
	char,
	{ checks = null, checksOn = false, editor = null, open = null } = {}
) {
	const ink = hasInk(item, { open });
	const shapes = !isEmptyLetter(item, { open });
	let needsLook = null;
	if (ink && checksOn && typeof checks === 'function') {
		try {
			needsLook = checks(item, { char, editor }) || null;
		} catch (error) {
			console.warn('ANY-INK coach: a letter check failed', error);
		}
	}
	return { char, ink, shapes, ready: ink && !needsLook, needsLook, drawing: null };
}

/**
 * @param {Object} project
 * @returns {String}
 */
export function fontNameOf(project) {
	const settings = project?.settings || {};
	return String(settings.project?.name || settings.font?.family || '');
}

/**
 * @param {Object} project
 * @returns {String}
 */
export function defaultTryItText(project) {
	const typed = getPref(TRY_IT_TEXT_PREF, '');
	if (typeof typed === 'string' && typed.trim()) return typed;
	return fontNameOf(project);
}

/**
 * settings.anyink.photos[assetId] (B9's registry, photo/photo_registry.js): each photo with the
 * parts still to name, as rule 12 counts them. B8 + B9 integration: the registry's own reader,
 * so a part he skipped, or one under a box he drew, is never "more letters" (the reader here
 * counted parts minus used ones).
 * @param {Object} project
 * @returns {Array<{id: String, unused: Number, done: Boolean}>}
 */
export function photoRecords(project) {
	return photoSummaries(project);
}

/**
 * @param {Object} project
 * @returns {Boolean}
 */
export function hasAnyPhoto(project) {
	if (!project) return false;
	const records = project.settings?.anyink?.photos;
	if (records && typeof records === 'object' && Object.keys(records).length) return true;
	return collectReferencedAssetIds(project).size > 0;
}

/**
 * @param {Object} editor
 * @param {Object} [payload] - a 'fontCheck' result; default: the last one for this editor
 * @returns {{itemId: String | null, problem: String | null, text: String, fixable: Boolean} |
 *   null}
 */
export function firstProblem(editor, payload = getLastFontCheck(editor)) {
	const problems = Array.isArray(payload?.problems) ? payload.problems : null;
	const first = firstCheckProblem(
		problems ? { ...payload, problems: problems.filter((p) => !saysInkWithNone(editor, p)) } : payload
	);
	if (!first) return null;
	let fixable = false;
	try {
		fixable = canFixProblem(editor?.project, first);
	} catch {
		fixable = false;
	}
	return { itemId: first.itemId, problem: first.problem, text: first.text, fixable };
}

/**
 * B6 + B7 finalize: the font check counts a stray line (one or two clicked points) as ink, so a
 * letter that holds only one is "ink but no width" too. The Next line says the problem that is
 * true (its shape, whose Fix it takes the line away); "the next letter would sit on top of it"
 * is never true of a letter with no ink (board/letter_set.js). The check itself, and All tools,
 * are left as they are.
 * @param {Object} editor
 * @param {{itemId?: String, problem?: String}} problem
 * @returns {Boolean} true for an ink-no-width problem on a letter with no ink
 */
function saysInkWithNone(editor, problem) {
	if (problem?.problem !== 'ink-no-width' || typeof problem.itemId !== 'string') return false;
	const item = editor?.project?.getItem?.(problem.itemId);
	return !!item && !hasInk(item, { open: openPathOf(editor) });
}

/**
 * B6 + B7 finalize: every problem of the last font check, in its order (rule 6 shows the first
 * one not skipped, and every one holds its skip).
 * @param {Object} editor
 * @param {Object} [payload] - a 'fontCheck' result; default: the last one for this editor
 * @returns {Array<{itemId: String | null, problem: String | null, text: String,
 *   fixable: Boolean}>}
 */
export function allProblems(editor, payload = getLastFontCheck(editor)) {
	const problems = Array.isArray(payload?.problems) ? payload.problems : [];
	return problems
		.filter((p) => typeof p?.message === 'string' && p.message.trim() !== '')
		.filter((p) => !saysInkWithNone(editor, p))
		.map((p) => {
			const found = {
				itemId: typeof p.itemId === 'string' ? p.itemId : null,
				problem: typeof p.problem === 'string' ? p.problem : null,
				text: p.message,
			};
			let fixable = false;
			try {
				fixable = canFixProblem(editor?.project, found);
			} catch {
				fixable = false;
			}
			return { ...found, fixable };
		});
}

/**
 * @param {Object} editor
 * @returns {'saved' | 'saving' | 'not-saved' | 'failed' | ''}
 */
export function saveStateOf(editor) {
	if (!editor) return '';
	const words = saveStatusWords(getSaveStatus(editor), {
		simple: true,
		workFile: isProjectFileHandle(editor.loadedFileHandle),
	});
	return /** @type {any} */ (words.status || '');
}

/**
 * @param {Number} hash
 * @param {*} value
 * @returns {Number}
 */
function mix(hash, value) {
	const number = typeof value === 'number' ? value : String(value ?? '').length;
	const scaled = Number.isFinite(number) ? Math.round(number * 64) : 0;
	return (Math.imul(hash ^ scaled, 16777619) + 0x9e3779b9) | 0;
}

/**
 * Changes whenever the letter's ink or width changes; looking never changes it.
 * @param {Object | null} item - a Glyph
 * @returns {Number}
 */
export function letterFingerprint(item) {
	if (!item) return 0;
	let hash = mix(2166136261, Number(item.advanceWidth) || 0);
	(item.shapes || []).forEach((shape) => {
		hash = mix(hash, shape?.objType === 'Path' ? 1 : 2);
		if (shape?.objType === 'Path') {
			(shape.pathPoints || []).forEach((point) => {
				hash = mix(hash, point?.p?.x);
				hash = mix(hash, point?.p?.y);
				hash = mix(hash, point?.h1?.use ? point.h1.x : 0.5);
				hash = mix(hash, point?.h1?.use ? point.h1.y : 0.5);
				hash = mix(hash, point?.h2?.use ? point.h2.x : 0.5);
				hash = mix(hash, point?.h2?.use ? point.h2.y : 0.5);
			});
			hash = mix(hash, shape.winding);
		} else {
			hash = mix(hash, String(shape?.link || '').length);
			[shape?.translateX, shape?.translateY, shape?.resizeWidth, shape?.resizeHeight].forEach(
				(value) => (hash = mix(hash, Number(value) || 0))
			);
			hash = mix(hash, shape?.rotation);
			hash = mix(hash, shape?.isFlippedNS ? 1 : 0);
			hash = mix(hash, shape?.isFlippedEW ? 1 : 0);
		}
	});
	return hash;
}

/**
 * @param {Number} hash
 * @param {String} text
 * @returns {Number} the hash with every character of the text mixed in
 */
function mixText(hash, text) {
	const value = String(text ?? '');
	let next = mix(hash, value.length);
	for (let i = 0; i < value.length; i++) next = mix(next, value.charCodeAt(i));
	return next;
}

/** The guide lines a font file holds (settings.font) */
const LINE_SETTINGS = Object.freeze(['upm', 'ascent', 'descent', 'capHeight', 'xHeight', 'lineGap']);

/**
 * B6 + B7 fix pass: what a font file holds beside its letters, so a gap fix or a moved guide
 * line that is undone puts the font file back up to date, as a letter's does.
 * @param {Object} project - GlyphrStudioProject
 * @returns {Number | null} null when there is no font to read (a test page's fake font)
 */
export function fontFingerprint(project) {
	if (!project?.settings) return null;
	let hash = 2166136261;
	const font = project.settings.font || {};
	LINE_SETTINGS.forEach((name) => (hash = mix(hash, Number(font[name]) || 0)));
	const kerning = project.kerning && typeof project.kerning === 'object' ? project.kerning : {};
	Object.keys(kerning)
		.sort()
		.forEach((id) => {
			const group = kerning[id] || {};
			hash = mixText(hash, id);
			hash = mixText(hash, (group.leftGroup || []).join(' '));
			hash = mixText(hash, (group.rightGroup || []).join(' '));
			hash = mix(hash, Number(group.value) || 0);
		});
	return hash;
}

/**
 * The rules' state for an editor's font (rules.js), without this session's memory.
 * @param {Object} editor - ProjectEditor
 * @param {Object} [context]
 * @param {(flag: String) => Boolean} [context.isOn]
 * @param {Object} [context.sources] - { checks, photos, tryItText } from other Bs
 * @param {Boolean} [context.appLevel] - the app's own page shows
 * @returns {Object}
 */
export function deriveEditorState(
	editor,
	{ isOn = isFeatureOn, sources = {}, appLevel = false } = {}
) {
	const project = editor?.project;
	if (!project) return { page: 'start', letters: [] };
	const letterSet = project.settings?.anyink?.letterSet;
	// the shape the Point pen is still drawing is no ink on any page (B6 + B7 finalize)
	const openPath = openPathOf(editor);
	const options = {
		checks: sources.checks || null,
		checksOn: isOn('checks'),
		editor,
		open: openPath,
	};
	const letters = lettersInSet(letterSet).map((char) =>
		letterFacts(letterItem(project, char), char, options)
	);
	const page = pageOf(editor, appLevel);
	let letter = null;
	let tool = '';
	if (page === 'letter') {
		// by id: the selectedItem getter can make a record, and reading never changes the font
		const id = editor.selectedItemID;
		const item = id && typeof project.getItem === 'function' ? project.getItem(id) || null : null;
		const char = charOfItem(item || { id });
		if (char) letter = letters.find((l) => l.char === char) || letterFacts(item, char, options);
		tool = typeof editor.selectedTool === 'string' ? editor.selectedTool : '';
		// B8 + B9 integration: the Brush an empty letter opens with is no pick of his, so rule 8
		// still offers the photo and the brush (the overlay holds the green button)
		// B10 + B11 finalize: only while the letter is empty; once it has ink he is drawing with
		// it, so rule 15 says "When ... looks right" with its button outlined and rule 7 holds
		// its green fix (rules.js brushingOpen)
		if (isOpeningBrush(editor) && !letter?.ink) tool = '';
		// B6 + B7 fix pass: a Point pen shape still open is ink, but no letter yet (the Point pen
		// draws only in the letter view, on the open letter)
		const open = openShapeOf(editor);
		if (letter && open && open.itemId === id) {
			letter.drawing = { points: open.points };
			letter.ready = false;
		}
	}
	let photos = [];
	try {
		photos =
			typeof sources.photos === 'function' ? sources.photos(editor) || [] : photoRecords(project);
	} catch (error) {
		console.warn('ANY-INK coach: the photo records could not be read', error);
	}
	let tryItText = '';
	try {
		tryItText =
			typeof sources.tryItText === 'function'
				? String(sources.tryItText(editor) ?? '')
				: defaultTryItText(project);
	} catch {
		tryItText = fontNameOf(project);
	}
	return {
		page,
		tool,
		letter,
		letters,
		// B10 + B11 integration: what the board shows (on Needs a look rule 9 takes the letters one
		// at a time)
		boardFilter: page === 'board' ? getBoardFilter(editor) : 'all',
		numbersAdded: letterSet === 'quick+numbers',
		fontProblem: firstProblem(editor),
		fontProblems: allProblems(editor),
		save: saveStateOf(editor),
		hasPhoto: hasAnyPhoto(project) || photos.length > 0,
		photos,
		tryItText,
	};
}
