// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: the checks, kept per letter (UX-BEGINNER.md 7.2 "Checks (B11) run per letter on release
	and are cached"; 4.2 "Ready"; section 10 B11 cache.js). The board's 58 tiles, the rail's ready
	count, the Next line (rules 7 and 9) and the letter card all ask on every draw; they get the
	kept answer, and the work is redone only for letters that changed, once per step.

	When: on release. A drag publishes a narrow topic per tick and records one Undo step when it
	is let go (CLAUDE.md); every step, Undo and Redo bumps the save status's revision
	(recovery markDirty, D-018). Between steps every question gets the kept answer, so the drag
	ticks never redo a check. The first question after a step runs one pass.
	Which letters: the pass stamps every letter (its points and curve handles, its width, and the
	slant its edges are spaced in: a quick number, no measuring) and redoes the measuring only for
	letters whose stamp changed: the letter the step was about, and the letters a whole-font step
	really changed (a moved guide line or a new slant redoes every letter, since every check reads
	them). A whole-font step names no letter (D-033), so the stamp, not the topic, is what says
	which letters changed; the font check's 'fontCheck' topic only brings its problems in.
	What each pass also does (cheap, no measuring): the font check's problem for each letter,
	"Looks fine to me" (looks_fine.js; a letter whose shapes changed since loses it), the size
	fix across letters (two or more on one line off the same way: move the line), Ready, and the
	soft notes (soft_notes.js, from the kept strokes).
	B10 + B11 fix pass: a letter still exactly as traced from a photo he is still tracing (free
	parts left, no "Done with this photo") has no size check yet (photo_walk.js sizeWaits): the
	photo's scale moves with every letter he names. A pass is due when a photo gains or loses a
	free part or is marked done (photoWalkStamp), since none of that is an Undo step. A letter's
	stamp holds its Brush strokes' tags and nibs too (the sink test reads the nib).
	B16: a letter traced from a photo part that may hold two touching letters needs a look
	(checks.js twoLetters, [Draw a box]), read from the photo list at every pass.
	B10 + B11 integration: [Move the line to fit your writing] is offered only on a line that
	the middle of his letters on it says is off the way this letter is (fit_lines_to_writing.js
	lineMoveWays, read here from the kept measures, so no letter is measured twice). Right after
	the line moved, the letters it flipped are off a line that now fits his writing: they get
	[Match size], never a button that could only resize them.

	A letter's state: { id, char, ink, checks, open, needsLook, ready, notes, looksFine }
	  checks     every problem, with words (checks.js describeChecks), in order
	  open       the ones he hasn't said look fine; needsLook is the first, or null
	  ready      ink, and nothing open (4.2)
	  notes      soft notes [{ id, text }] (never change ready)

	  makeChecksCache({ revisionOf, problemsOf })   one cache (tests make their own)
	    .state(editor, item)       the letter's state (a letter with no ink: ink false, ready false)
	    .states(editor)            Map id -> state for every letter with ink
	    .needsLook(item, { editor })   the coach's 'checks' source and the fixes track's
	                               useNeedsALook: the first open problem or null
	    .isReady(item, { editor }) / .notes(item, { editor })
	    .refresh(editor, { force })    runs a pass now when one is due (force: always);
	                               -> { ran, recomputed: [ids], became: [ids], cleared: [ids] }
	                               became: letters that were Ready and need a look now; cleared:
	                               the other way round
	    .watch(editor) / .unwatch(editor)   takes in the font check's problems ('fontCheck',
	                               subscriber 'anyink.checks.fontCheck'), and in Simple with
	                               'checks' on, runs the pass right after each step and says what
	                               flipped (window CHECKS_CHANGE_EVENT, detail { editor, became,
	                               cleared, recomputed }) for a toast to read
	    .setProblemsSource(fn)     fn(editor) -> the font check's last problems (e.g. font_check.js
	                               getLastFontCheck(editor)?.problems), read at every question;
	                               a pass is due only when what they say changed
	    .stats(editor)             { passes, recomputed } (tests)
	  getChecksCache()             the app's cache
	  checksSource(item, { editor })   the app cache's needsLook, for setCoachSource('checks', ...)
	  resetChecksCacheForTests()
*/
import { getSaveStatus, SAVE_STATUS_EVENT } from '../files/save_status.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { sitsAtFit } from '../spacing/auto_space.js';
import { isAutomatic } from '../spacing/owner.js';
import { fontSlant } from '../spacing/slant.js';
import {
	CHECK,
	checkLetter,
	describeChecks,
	findChecks,
	FIX,
	fontFileCheck,
	hasLetterInk,
	measureLetter,
	orderChecks,
	resolveSizeFix,
	sizeCounts,
	spacingSlantOf,
	twoLettersCheck,
} from './checks.js';
import { letterMayBeTwo } from '../photo/photo_registry.js';
import {
	extraFromMeasures,
	impliedFromMeasures,
	lineName,
	waysFromValues,
} from './fit_lines_to_writing.js';
import { looksFineIds } from './looks_fine.js';
import { photoWalkStamp, sizeWaits } from './photo_walk.js';
import { unfinishedLook } from '../board/sketch_unfinished.js';
import { isOutlineSketched } from './sketch_top.js';
import { softNotes } from './soft_notes.js';

export const CHECKS_SUBSCRIBER_ID = 'anyink.checks.fontCheck';
export const CHECKS_CHANGE_EVENT = 'anyink-checks-change';
const FONT_CHECK_TOPIC = 'fontCheck';

/**
 * @param {Object} [options]
 * @param {Function} [options.revisionOf] - (editor) => a number that changes with every step
 * @param {Function | null} [options.problemsOf] - (editor) => the font check's problems
 * @returns {Object} the cache (see the header)
 */
export function makeChecksCache({ revisionOf = saveRevision, problemsOf = null } = {}) {
	/** @type {WeakMap<Object, Object>} editor -> its state */
	const editors = new WeakMap();
	let problemsSource = typeof problemsOf === 'function' ? problemsOf : null;
	let listening = false;
	const watched = new Set();

	function stateOf(editor) {
		let st = editors.get(editor);
		if (!st) {
			st = {
				key: null,
				context: '',
				letters: new Map(),
				view: new Map(),
				problems: [],
				passes: 0,
				recomputed: 0,
				seen: false,
			};
			editors.set(editor, st);
		}
		return st;
	}

	function problemsFor(editor, st) {
		let list = st.problems;
		if (problemsSource) {
			try {
				list = problemsSource(editor);
			} catch {
				list = st.problems;
			}
		}
		return Array.isArray(list) ? list : [];
	}

	/**
	 * The things that, when any differs, make a pass due. The font check's problems count by
	 * what they say, not by which list holds them (a source may hand over a new empty list on
	 * every question).
	 */
	function keyOf(editor, st) {
		const problems = problemsFor(editor, st);
		return [
			editor.project,
			editor.history,
			revisionOf(editor),
			problemsText(problems),
			photoWalkStamp(editor.project),
			problems,
		];
	}

	function isDue(editor, st) {
		const key = keyOf(editor, st);
		return !st.key || key.slice(0, 5).some((part, index) => part !== st.key[index]);
	}

	/**
	 * One pass: measure the letters whose stamp changed, then put every letter's state together.
	 * @returns {{ran: Boolean, recomputed: Array<String>, became: Array<String>,
	 *   cleared: Array<String>}}
	 */
	function pass(editor, st) {
		const key = keyOf(editor, st);
		const project = editor.project;
		const font = project?.settings?.font || {};
		const slant = fontSlant(project);
		const context = contextStamp(font, slant);
		if (context !== st.context) st.letters = new Map();
		st.context = context;
		const recomputed = [];
		const letters = new Map();
		Object.values(project?.glyphs || {}).forEach((item) => {
			if (!item?.id) return;
			const stamp = letterStamp(item);
			let kept = st.letters.get(item.id);
			if (!kept || kept.stamp !== stamp) {
				// A letter with no shapes at all (opening a letter makes its record) has nothing
				// to measure
				const blank = !item.shapes?.length;
				kept = blank
					? { stamp, ink: false, char: '', stroke: null, pokes: null, implied: null, found: [] }
					: null;
				kept = kept || measureOne(item, project, slant, stamp);
				if (!blank) recomputed.push(item.id);
			}
			letters.set(item.id, kept);
		});
		st.letters = letters;
		st.recomputed += recomputed.length;
		st.passes++;
		// Another font in the same editor (a new History, as save_status.js counts fonts) starts
		// with nothing to flip from; a whole-font Undo swaps the project but keeps the History
		if (st.key && st.key[1] !== key[1]) st.seen = false;
		const before = st.view;
		st.view = assemble(project, letters, key[5]);
		st.key = key;
		const flips = flipsBetween(before, st.view, st.seen);
		st.seen = true;
		return { ran: true, recomputed, ...flips };
	}

	function fresh(editor) {
		if (!editor?.project) return null;
		const st = stateOf(editor);
		if (isDue(editor, st)) pass(editor, st);
		return st;
	}

	function state(editor, item) {
		const st = fresh(editor);
		if (!st || !item?.id) return emptyState(item);
		const known = st.view.get(item.id);
		if (known) return known;
		if (editor.project?.glyphs?.[item.id]) return emptyState(item);
		// A letter outside the glyphs (joined letters, a part): measured on its own
		return loneState(item, editor.project, problemsFor(editor, st));
	}

	function refresh(editor, { force = false } = {}) {
		if (!editor?.project) return { ran: false, recomputed: [], became: [], cleared: [] };
		const st = stateOf(editor);
		if (!force && !isDue(editor, st))
			return { ran: false, recomputed: [], became: [], cleared: [] };
		if (force) st.letters = new Map();
		return pass(editor, st);
	}

	function onSaveStatus(event) {
		const editor = event?.detail?.editor;
		if (!editor || !watched.has(editor)) return;
		if (!isSimpleMode() || !isFeatureOn('checks')) return;
		queueMicrotask(() => announce(editor, refresh(editor)));
	}

	function announce(editor, result) {
		if (!result?.ran || (!result.became.length && !result.cleared.length)) return;
		globalThis.dispatchEvent?.(
			new CustomEvent(CHECKS_CHANGE_EVENT, {
				detail: {
					editor,
					became: result.became,
					cleared: result.cleared,
					recomputed: result.recomputed,
				},
			})
		);
	}

	function watch(editor) {
		if (!editor || watched.has(editor)) return;
		watched.add(editor);
		if (typeof editor.subscribe === 'function') {
			editor.subscribe({
				topic: FONT_CHECK_TOPIC,
				subscriberID: CHECKS_SUBSCRIBER_ID,
				callback: (data) => {
					stateOf(editor).problems = Array.isArray(data?.problems) ? data.problems : [];
					if (isSimpleMode() && isFeatureOn('checks')) {
						queueMicrotask(() => announce(editor, refresh(editor)));
					}
				},
			});
		}
		if (!listening) {
			globalThis.addEventListener?.(SAVE_STATUS_EVENT, onSaveStatus);
			listening = true;
		}
	}

	function unwatch(editor) {
		if (!watched.has(editor)) return;
		watched.delete(editor);
		if (typeof editor.unsubscribe === 'function') {
			editor.unsubscribe({ idToRemove: CHECKS_SUBSCRIBER_ID });
		}
		if (!watched.size && listening) {
			globalThis.removeEventListener?.(SAVE_STATUS_EVENT, onSaveStatus);
			listening = false;
		}
	}

	return {
		state,
		states(editor) {
			const st = fresh(editor);
			return st ? new Map(st.view) : new Map();
		},
		needsLook(item, { editor } = {}) {
			return state(editor, item).needsLook;
		},
		isReady(item, { editor } = {}) {
			return state(editor, item).ready;
		},
		notes(item, { editor } = {}) {
			return state(editor, item).notes;
		},
		refresh,
		watch,
		unwatch,
		setProblemsSource(fn) {
			const previous = problemsSource;
			problemsSource = typeof fn === 'function' ? fn : null;
			return previous;
		},
		stats(editor) {
			const st = editor ? editors.get(editor) : null;
			return { passes: st?.passes || 0, recomputed: st?.recomputed || 0 };
		},
		reset() {
			[...watched].forEach(unwatch);
		},
	};
}

// --------------------------------------------------------------
// One letter, and the whole font
// --------------------------------------------------------------

/** The letter's measures and its own checks (no font check, no size fix yet) */
function measureOne(item, project, slant, stamp) {
	const font = project?.settings?.font || {};
	const measures = measureLetter(item, font, { slant: spacingSlantOf(item, slant) });
	const char = typeof item.chars === 'string' ? item.chars : '';
	return {
		stamp,
		ink: !!measures,
		char,
		stroke: measures?.stroke ?? null,
		pokes: measures?.pokes || null,
		// where this letter says its line should be (fit_lines_to_writing.js impliedLine)
		// (B10 + B11 finalize: or the line it is judged by that no median counts, ? ! t)
		implied: measures
			? impliedFromMeasures(char, measures, font) || extraFromMeasures(char, measures)
			: null,
		found: measures
			? findChecks(item, measures, { font, fontProblems: [], atFit: atFitIn(project, slant) })
			: [],
	};
}

/**
 * Every letter's state from the kept measures.
 * @returns {Map<String, Object>}
 */
function assemble(project, letters, problems) {
	const withInk = [...letters.entries()].filter(([, kept]) => kept.ink);
	const lists = new Map();
	withInk.forEach(([id, kept]) => {
		const item = project.glyphs[id];
		const own = fontFileCheck(item, problems, kept.found);
		const found = waitForPhoto(item, project, kept.found);
		// B16: traced from a part that may hold two touching letters (read from the photo list
		// at every pass, since naming a part is no change to the letter)
		const two = mayBeTwo(project, id) ? [twoLettersCheck()] : [];
		// S3 finalize: a sketched letter plainly missing strokes (the Next line's look, here too)
		const unfinished = unfinishedCheck(item, kept.char, project);
		lists.set(id, orderChecks([...found, ...two, ...(own ? [own] : []), ...unfinished]));
	});
	const counts = sizeCounts(lists.values());
	const ways = waysFromValues(impliedByLine(withInk), project?.settings?.font || {});
	const view = new Map();
	withInk.forEach(([id, kept]) => {
		const item = project.glyphs[id];
		const list = lists.get(id).map((check) => ({ ...check, fix: sizeFixOf(check, counts, ways) }));
		view.set(id, letterState(item, kept, describeChecks(item, list)));
	});
	const notes = softNotes(
		withInk.map(([id, kept]) => ({
			id,
			char: kept.char,
			stroke: kept.stroke,
			ready: view.get(id).ready,
			pokes: kept.pokes,
			fixedStroke: isOutlineSketched(project.glyphs[id]),
		}))
	);
	notes.forEach((list, id) => {
		const known = view.get(id);
		if (known) view.set(id, Object.freeze({ ...known, notes: Object.freeze(list) }));
	});
	return view;
}

/**
 * @returns {Array<Object>} [] or the one sketchUnfinished check (board/sketch_unfinished.js)
 */
function unfinishedCheck(item, char, project) {
	try {
		const look = unfinishedLook(item, char || item?.chars || '', {
			font: project?.settings?.font || null,
		});
		if (!look) return [];
		return [
			{ id: CHECK.sketchUnfinished, fix: null, args: { reason: look.reason, short: look.short } },
		];
	} catch (error) {
		console.warn('ANY-INK checks: the unfinished look failed', error);
		return [];
	}
}

/**
 * The kept impliedLine entries, by line (from the kept measures). B10 + B11 finalize (the fixes
 * track's need): each with its body height and round flag, so a pushed line is judged as the
 * size check judges it, and ? ! t as extras no median counts.
 * @returns {{small: Array<Object>, capitals: Array<Object>, top: Array<Object>,
 *   between: Array<Object>}}
 */
function impliedByLine(withInk) {
	const values = { small: [], capitals: [], top: [], between: [] };
	withInk.forEach(([, kept]) => {
		if (kept.implied && values[kept.implied.line]) values[kept.implied.line].push(kept.implied);
	});
	return values;
}

/**
 * A size problem's fix: [Move the line to fit your writing] when 2 or more letters on its line
 * are off the same way (checks.js resolveSizeFix) and the middle of his letters on that line is
 * off that way too (the line would really move), else [Match size].
 * @param {{id: String, fix: String, args: Object}} check
 * @param {Map<String, Number>} counts - sizeCounts
 * @param {{small: String | null, capitals: String | null, top: String | null}} ways
 * @returns {String}
 */
function sizeFixOf(check, counts, ways) {
	const fix = resolveSizeFix(check, counts);
	if (fix !== FIX.moveLine) return fix;
	const name = lineName(check.args?.line);
	return name && ways?.[name] === check.args?.way ? FIX.moveLine : FIX.matchSize;
}

/** @returns {Object} a frozen letter state */
function letterState(item, kept, checks) {
	const fine = looksFineIds(item);
	const open = checks.filter((check) => !fine.includes(check.id));
	return Object.freeze({
		id: item.id,
		char: kept.char,
		ink: true,
		checks: Object.freeze(checks),
		open: Object.freeze(open),
		needsLook: open[0] || null,
		ready: open.length === 0,
		notes: Object.freeze([]),
		looksFine: Object.freeze(fine.filter((id) => checks.some((check) => check.id === id))),
	});
}

/** A letter measured on its own (not in the font's glyphs): no size fix across letters */
function loneState(item, project, problems) {
	if (!hasLetterInk(item)) return emptyState(item);
	const font = project?.settings?.font || {};
	const slant = fontSlant(project);
	const checks = checkLetter(item, {
		font,
		slant,
		fontProblems: problems,
		atFit: atFitIn(project, slant),
	});
	const waits = sizeWaits(item, project);
	const two =
		item.id && mayBeTwo(project, item.id) ? describeChecks(item, [twoLettersCheck()]) : [];
	const all = two.length ? orderChecks([...checks, ...two]) : checks;
	const shown = waits ? all.filter((check) => check.id !== CHECK.size) : all;
	return letterState(item, { char: item.chars || '' }, shown);
}

/**
 * B10 + B11 finalize: an automatic letter at its fit has the width its ink gives (checks.js
 * findChecks atFit): a width problem there has no fix to offer.
 * @returns {(item: Object) => Boolean}
 */
function atFitIn(project, slant) {
	return (item) => isAutomatic(item) && sitsAtFit(item, project, spacingSlantOf(item, slant));
}

/** B16: the letter was traced from a photo part that may hold two touching letters */
function mayBeTwo(project, itemId) {
	try {
		return letterMayBeTwo(project, itemId);
	} catch (error) {
		console.warn('ANY-INK checks: could not read the photo list', error);
		return false;
	}
}

/**
 * The size check waits while the letter's photo is still being traced (photo_walk.js): it is
 * left out of the letter's list, and so out of the counts that move a line.
 * @returns {Array<Object>} found, or a new list without its size check
 */
function waitForPhoto(item, project, found) {
	if (!found.some((check) => check.id === CHECK.size)) return found;
	return sizeWaits(item, project) ? found.filter((check) => check.id !== CHECK.size) : found;
}

/** @returns {String} what the font check's problems say, one line each */
function problemsText(problems) {
	return problems.map((entry) => `${entry?.itemId}|${entry?.problem}|${entry?.message}`).join('\n');
}

/** @returns {Object} the state of a letter with no ink */
function emptyState(item) {
	return Object.freeze({
		id: item?.id || '',
		char: typeof item?.chars === 'string' ? item.chars : '',
		ink: false,
		checks: Object.freeze([]),
		open: Object.freeze([]),
		needsLook: null,
		ready: false,
		notes: Object.freeze([]),
		looksFine: Object.freeze([]),
	});
}

/**
 * Which letters flipped between two passes. The first pass on a font flips nothing (it is the
 * font as he opened it, not a change).
 * @returns {{became: Array<String>, cleared: Array<String>}}
 */
function flipsBetween(before, after, seen) {
	if (!seen) return { became: [], cleared: [] };
	const became = [];
	const cleared = [];
	after.forEach((now, id) => {
		const was = before.get(id);
		if (was?.ready && !now.ready) became.push(id);
		if (was && !was.ready && now.ready) cleared.push(id);
	});
	return { became, cleared };
}

// --------------------------------------------------------------
// Stamps
// --------------------------------------------------------------

/** What every letter's checks read from the font: the lines, the box and the slant */
function contextStamp(font, slant) {
	return ['upm', 'ascent', 'descent', 'capHeight', 'xHeight']
		.map((key) => String(Number(font?.[key])))
		.concat(String(slant))
		.join(',');
}

/**
 * A quick stamp of what a letter's own checks read: its points and curve handles (an eighth of
 * a unit), its shapes' kinds, its width, and how its edges are spaced (the spacing owner and
 * slant: hangs reads them). Letters made from other letters stamp those letters' shapes too.
 * @param {Object} item - Glyph
 * @returns {String}
 */
export function letterStamp(item) {
	let a = 0x811c9dc5;
	let b = 0x9747b28c;
	const mix = (value) => {
		const n = Number.isFinite(value) ? Math.round(value * 8) | 0 : 0x7ffffff;
		a = Math.imul(a ^ n, 0x01000193);
		b = Math.imul(b ^ n, 0x5bd1e995);
		b ^= b >>> 13;
	};
	const mixPaths = (shapes) => {
		(shapes || []).forEach((shape) => {
			if (!shape) return;
			if (shape.objType === 'ComponentInstance') {
				mix(-2);
				mixText(shape.link, mix);
				['translateX', 'translateY', 'resizeWidth', 'resizeHeight', 'rotation'].forEach((key) =>
					mix(Number(shape[key]))
				);
				mix(shape.isFlippedEW ? 1 : 0);
				mix(shape.isFlippedNS ? 1 : 0);
				mixPaths(shape.transformedGlyph?.shapes);
				return;
			}
			const points = shape.pathPoints || [];
			mix(-1);
			mix(points.length);
			// a Brush stroke's tag (the checks read its nib: body_bottom.js penAllowance)
			mixText(shape.anyink?.strokeId ?? '', mix);
			mixText(shape.anyink?.strokeKey ?? '', mix);
			for (const point of points) {
				mix(point?.p?.x);
				mix(point?.p?.y);
				mix(point?.h1?.x);
				mix(point?.h1?.y);
				mix(point?.h2?.x);
				mix(point?.h2?.y);
			}
		});
	};
	mix(Number(item?.advanceWidth));
	mixPaths(item?.shapes);
	const strokes = item?.anyink?.nib?.strokes;
	(Array.isArray(strokes) ? strokes : []).forEach((record) => {
		mixText(record?.id ?? '', mix);
		mixText(record?.key ?? '', mix);
		mix(Number(record?.size));
	});
	const spacing = item?.anyink?.spacing ?? '';
	const slant = item?.anyink?.spacingSlant ?? '';
	return `${a >>> 0}.${b >>> 0}.${spacing}.${slant}`;
}

function mixText(text, mix) {
	const value = String(text ?? '');
	mix(value.length);
	for (let i = 0; i < value.length; i++) mix(value.charCodeAt(i));
}

/** Changes with every Undo step, undo and redo (save_status.js revision, D-018) */
function saveRevision(editor) {
	return getSaveStatus(editor).revision;
}

// --------------------------------------------------------------
// The app's cache
// --------------------------------------------------------------

let appCache = null;

/** @returns {Object} the app's checks cache */
export function getChecksCache() {
	if (!appCache) appCache = makeChecksCache();
	return appCache;
}

/**
 * The coach's 'checks' source (coach_state.js setSource('checks', ...)) and the fixes track's
 * useNeedsALook: the letter's first open problem, or null.
 * @param {Object} item - Glyph
 * @param {{editor?: Object}} [context]
 * @returns {Object | null}
 */
export function checksSource(item, { editor } = {}) {
	return getChecksCache().needsLook(item, { editor });
}

/** Lets go of every editor and starts a new app cache. */
export function resetChecksCacheForTests() {
	appCache?.reset();
	appCache = null;
}
