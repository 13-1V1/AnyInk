// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B11: the checks on one letter (UX-BEGINNER.md 4.2 "Ready" and "Needs a look", 7.2, section 10
	B11). Pure and read-only: no editor, no DOM, nothing written to the letter. Font units, y-up,
	the writing line at 0; every share is of the letter box (settings.font.upm, 2,048 at the
	default settings). The five lines come from placement/classes.js guideLines, the letter's
	pieces of ink from spacing/outline.js, so the checks see the same ink spacing and placement do.

	Each problem is { id, fix, args } (findChecks), then in words { id, reason, short, fix,
	fixLabel, action, args } (describeChecks): reason is one sentence that starts with the
	letter's name (the Next line's rule 7), short the same without the name (a tile's tooltip,
	the card's chip), fix the fix's id and fixLabel its button's words (the fixes track's
	'fixes.button.<fix>'), action 'fixLetter' and args { fix, ... } for the coach's button.
	They come in this order, so the first one is the one to show:
	  inkNoWidth  ink, and a width that rounds to 0                          [Fit spacing]
	  fontFile    the B1 font check named this letter (its own sentence)     [Fix it]
	  specks      pieces smaller than a quarter of (stroke estimate) squared
	              that don't sit directly above or below another piece; never
	              the biggest piece; the dots of i j ! ? : ; never, even
	              drifted to the side by up to 0.3 of the tallest piece. On a
	              letter or number with no dot or mark of its own, a dot of the
	              pen beside it is a speck too (a Brush tap: about round, at most
	              2 strokes across, under a quarter of the biggest piece, clear
	              of the other pieces)                                       [Remove N specks]
	  offLine     the body's bottom more than 2 % off the writing line (round
	              letters may dip their 1.5 % below it); letters, numbers, .
	              and , only, never one with a mark under it. A Brush letter's
	              bottom is read at the pen's center line (half its nib above
	              the ink's bottom), so a stroke drawn to the line is on it. A
	              letter whose tail hangs (g j p q y, and Q J f once the ink
	              hangs 5 % under the line; under that, a short dip) only floats,
	              judged by its body (body_bottom.js: g p q Q's bowl with half a
	              stroke more room, y's joint with a stroke more; j J f by their
	              ink's bottom). A comma floats when all of it
	              is over 2 % above the line; one with a head (its half-width
	              row in its upper half) floats or sinks by that row, the row
	              Sit on the line seats; a small comma or a slash never sinks [Sit on the line]
	  size        the body more than 25 % taller or shorter than its line
	              (small letters the small-letter line, b d f h k l the top
	              line, t halfway, capitals, numbers, ? and ! the capitals
	              line; round letters with their 1.5 % over and under).
	              The body leaves out marks above it (the dots of i and j, an
	              accent) and specks; a tail's body stops at its bowl, joint or
	              head (body_bottom.js), j J f's at the writing line          [Move the line to
	              fit your writing] when 2 or more letters on that line are off the same way
	              (checkFont), else [Match size]
	  pokes       ink more than 5 % above the top line or below the tail line [Shrink to fit],
	              while POKES_IS_NOTE is false; it is true (see there): a soft note instead
	  hangs       ink more than 5 % past either edge of the letter's width, measured in the
	              slant the letter was spaced with (spacing/sides.js's frame), so a slanted
	              hand never hangs; never f, j or a letter with a tail          [Fit spacing]
	  width       the width outside B3's limits for its kind (spacing/letter_classes.js
	              widthProblem: i j l ! . , ' : ; - | are never too narrow)    [Fit spacing]
	  twoLetters  B16: traced from a photo part that may hold two touching letters
	              (photo_registry.js letterMayBeTwo; added by cache.js, which has the photo
	              list; second in the order, after the font file's own)            [Draw a box]
	              (the photo dialog on the letter, as Trace again opens it)

	  measureLetter(item, font, { slant })   the numbers the checks read (null with no ink):
	                                         { char, chars, stroke, pieces, specks, ink, frame,
	                                         tail, markBelow, body: { top, bottom }, seat,
	                                         penBottom, line: { key, height }, size, pokes }
	                                         (the fixes track's plans read body, ink, tail,
	                                         line and stroke; seat: which body_bottom.js rule
	                                         gave body.bottom, or null; penBottom: body.bottom
	                                         at the pen's center line)
	  findChecks(item, measures, { font, fontProblems })   -> [{ id, fix, args }]
	  fontFileCheck(item, fontProblems, found)   the font check's problem as a check, or null
	  orderChecks(checks)                    a list put in CHECK_ORDER, each id once
	  describeChecks(item, found)            -> the same with their words
	  checkLetter(item, { font, slant, fontProblems, sameWay })   both, for one letter
	  checkFont(project, { fontProblems, items })   Map id -> described checks for every letter
	                                         with ink, the size fix decided across letters
	  resolveSizeFix(found, counts)          moveLine or matchSize for one letter's size problem
	  sizeCounts(entries)                    how many letters on each line are off each way
	  spacingSlantOf(item, fontSlant)        the slant the letter's edges are measured in
	  speckPieces(item)                      the specks themselves (the fixes track's Remove
	                                         specks takes out the same ones)
	  hasLetterInk(item)                     true when the letter has a piece of ink
*/
import { guideLines, isRoundLetter, tailKind } from '../placement/classes.js';
import { baseLetter, widthProblem } from '../spacing/letter_classes.js';
import { inkPieces, isStrayPath, itemContours } from '../spacing/outline.js';
import { isAutomatic } from '../spacing/owner.js';
import { BODY_SHARE, MARK_SIZE, referenceHeight, slope } from '../spacing/sides.js';
import { fittedSlant, fontSlant } from '../spacing/slant.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { hasWord, word } from '../words/words.js';
import { bowlBottom, penAllowance, rasterBowlBottom, tailBottom } from './body_bottom.js';

/** The check ids (looks_fine.js stores them; the coach's skip keys carry them). */
export const CHECK = Object.freeze({
	inkNoWidth: 'inkNoWidth',
	fontFile: 'fontFile',
	specks: 'specks',
	offLine: 'offLine',
	size: 'size',
	pokes: 'pokes',
	hangs: 'hangs',
	width: 'width',
	twoLetters: 'twoLetters',
});

/** B16: the check for a letter traced from a part that may hold two touching letters */
export function twoLettersCheck() {
	return { id: CHECK.twoLetters, fix: FIX.drawBox, args: {} };
}

/** The order problems are shown in: the first one is the letter's reason. */
export const CHECK_ORDER = Object.freeze([
	CHECK.inkNoWidth,
	CHECK.fontFile,
	CHECK.twoLetters,
	CHECK.specks,
	CHECK.offLine,
	CHECK.size,
	CHECK.pokes,
	CHECK.hangs,
	CHECK.width,
]);

/** The fix ids (the fixes track's fixes.js runs them; 'fixes.button.<id>' is the label). */
export const FIX = Object.freeze({
	fitSpacing: 'fitSpacing',
	sitOnLine: 'sitOnLine',
	moveLine: 'moveLine',
	matchSize: 'matchSize',
	removeSpecks: 'removeSpecks',
	shrinkToFit: 'shrinkToFit',
	fixIt: 'fixIt',
	drawBox: 'drawBox',
});

/** Ink past an edge of the letter's width by more than this share of the letter box hangs. */
export const HANG_SHARE = 0.05;
/** A body bottom more than this share of the letter box off the writing line is off it. */
export const LINE_SHARE = 0.02;

/**
 * B10 + B11 finalize: a bowl (g p q Q) whose stroke stops short of closing by up to this many
 * strokes is still read as a bowl (body_bottom.js rasterBowlBottom's close).
 */
export const BOWL_GAP = 1;
/** A body more than this share taller or shorter than its line is the wrong size. */
export const SIZE_SHARE = 0.25;
/** Ink more than this share of the letter box past the top or tail line pokes. */
export const POKE_SHARE = 0.05;
/** A speck is smaller than this share of (stroke estimate) squared. */
export const SPECK_SHARE = 0.25;
/** A Q, J or f has a tail once its ink hangs this share of the letter box under the line. */
export const TAIL_SHOWS = 0.05;
/** A dot of i j ! ? : ; may drift this share of the tallest piece to the side. */
export const DOT_DRIFT = 0.3;
/** This many letters on one line off the same way: move the line, not the letters. */
export const MOVE_LINE_COUNT = 2;
/**
 * A pen-sized dot beside a plain letter is a speck too (B10 + B11 fix pass, the critic's Brush
 * tap beside small n): no more than DOT_STROKES strokes across either way, about round (its
 * long side at most DOT_ROUND times its short side), under DOT_AREA_SHARE of the letter's
 * biggest piece, and clear of every other piece by DOT_CLEAR of a stroke.
 */
export const DOT_STROKES = 2;
export const DOT_ROUND = 2;
export const DOT_AREA_SHARE = 0.25;
export const DOT_CLEAR = 0.25;
/** A comma has a head when its half-width row is in this share of it, from the bottom up. */
export const COMMA_HEAD_SHARE = 0.5;
/**
 * A tail letter's body bottom is found from its shape (body_bottom.js), so it floats only past
 * this many strokes more: half for a bowl (measured under its hole), one for a y's joint (an
 * estimate: a real traced y read 57 units over the line, the fixture y 29).
 */
export const SEAT_SLACK = Object.freeze({ bowl: 0.5, joint: 1, top: 1 });
/**
 * B10 + B11 finalize: a j whose tail reaches less than this share of the way down to the tail
 * line is judged by its top (the critic's j lifted 250 units: its hook still dipped under the
 * line, so it was Ready): its writing line is where its stem's top says, the small-letter line
 * under the top (lineAt).
 */
export const SHORT_TAIL_SHARE = 0.3;
/**
 * B10 + B11 finalize: a comma with no head (a slash of the pen) that sinks is put back with this
 * share of it over the writing line (Sit on the line seats it so: lineAt).
 */
export const COMMA_RISE = 0.25;
/** A Brush tap is a dot up to this many of its own nibs across (a fine pen's letter, a fat nib). */
export const DOT_NIBS = 1.5;
/**
 * Pokes past the top or tail line is a soft note, not a check (UX-BEGINNER 10 B11 and 8: "If
 * the section 8 fact-check shows Word doesn't cut it off, this becomes a soft note"; "If it cuts
 * it off, the exporter sets the font's clipping lines from the real highest and lowest ink ...
 * and the check becomes a soft note"). The second half is already true: the font file's
 * clipping lines (OS/2 usWinAscent / usWinDescent) are the highest and lowest ink of the whole
 * font (font-flux-js 2.9.0, dist/font-flux-js.js: usWinAscent = the font's yMax, usWinDescent =
 * its -yMin; font_export.js sets no other), so Windows and Word give ink past the lines more
 * room between lines instead of cutting it off (B9's step C note says the same: "lines of text
 * in your font will sit further apart"). As a check it turned 8 of 58 letters traced from a
 * neat whole-alphabet photo amber (g j p q y, k, ?: real tails run past the tail line). Set it
 * false to make it a check with [Shrink to fit] again (findChecks's pokesAsNote).
 */
export const POKES_IS_NOTE = true;
/** The font check's own name for ink with no width (fontcheck/validate.js PROBLEM). */
export const FONT_INK_NO_WIDTH = 'ink-no-width';

/** Letters whose dots are never specks. */
const DOTTED = new Set('ij!?:;');
/** Letters with a dot of their own beside the body: a pen-sized dot there is never a speck. */
const DOT_BESIDE = new Set('ŀĿ');
/** Letters judged by a bowl, found from their ink when no shape of theirs has a hole. */
const BOWL_LETTERS = new Set('gpqQ');
/** Letters with a tail that may be short, seated on their bowl (placement's 'counter' rule). */
const BOWL_SEATED = new Set('Q');
/** Letters whose edges may be hung past (B11: "not f, j or tails"). */
const MAY_HANG = new Set('fj');
/** The lines a size is judged by, and the house words for each in a sentence. */
const LINE_WORDS = Object.freeze({
	xHeight: 'checks.line.xHeight',
	capHeight: 'checks.line.capHeight',
	ascent: 'checks.line.ascent',
	between: 'checks.line.between',
});
/** Lines "Move the line to fit your writing" can move (t's has no line of its own). */
const MOVABLE_LINES = new Set(['xHeight', 'capHeight', 'ascent']);
const TALL = 'bdfhkl';
/** Combining marks that sit under a letter (cedilla, ogonek, dot below, ...). */
const MARK_BELOW = /[\u0316-\u0319\u031c-\u0333\u0339-\u033c\u0345\u0347-\u0349\u034d\u034e]/u;

// --------------------------------------------------------------
// Measuring
// --------------------------------------------------------------

/**
 * The numbers every check reads.
 * @param {Object} item - Glyph
 * @param {Object} font - settings.font
 * @param {{slant?: Number}} [options] - slant: degrees, the frame the edges are measured in
 * @returns {Object | null} null with no ink:
 *   { char, chars, stroke, pieces, specks, ink: {xMin, xMax, yMin, yMax}, frame: {xMin, xMax},
 *     tail, markBelow, body: {top, bottom}, seat: 'bowl' | 'joint' | 'width' | null,
 *     penBottom: Number, line: {key, height} | null, size: Number | null,
 *     pokes: 'top' | 'tail' | 'both' | null }
 */
export function measureLetter(item, font, { slant = 0 } = {}) {
	const pieces = inkPieces(itemContours(item));
	if (!pieces.length) return null;
	const chars = typeof item?.chars === 'string' ? item.chars : '';
	const char = [...chars].length === 1 ? chars : '';
	const lines = guideLines(font);
	const stroke = strokeOf(pieces);
	// The body bottom by the pen's center line: a Brush stroke's round end hangs half its nib
	// past where the pen stopped (body_bottom.js penAllowance)
	const allowance = penAllowance(item);
	const specks = specksAmong(pieces, stroke, char, allowance);
	const solid = pieces.filter((piece) => !specks.includes(piece));
	const ink = boxOf(solid);
	const frame = frameOf(solid, slope(slant), referenceHeight(font));
	const kind = tailKind(char);
	const tail = kind === 'always' || (kind === 'optional' && ink.yMin < -TAIL_SHOWS * lines.box);
	const markBelow = MARK_BELOW.test(char.normalize('NFD'));
	const line = char ? lineOf(char, lines) : null;
	const { top, bottom, kept } = bodyOf(solid, line ? line.height : lines.capitals, lines);
	const body = { top, bottom };
	let penBottom = Math.min(...kept.map((piece) => piece.yMin + allowance(piece)));
	let seat = null;
	if (markBelow) {
		body.bottom = Math.max(body.bottom, lines.writing);
	} else if (tail) {
		// A tail is judged by its body, never by its end: the bowl of g p q Q, the joint of y,
		// the head of , ; (body_bottom.js). B10 + B11 finalize: a bowl two Brush strokes make (a
		// stem and a bump) has no hole of its own, so it is found from the ink they make
		// together (rasterBowlBottom); a bowl or a joint is judged both ways (written low, it
		// sinks). j, and J f with their tail on, have neither: their body never reads under the
		// writing line (a guess that read low would make the letter look too tall)
		seat = tailBottom(char, solid, ink, { slope: slope(slant), stroke });
		if (!seat && BOWL_LETTERS.has(char)) {
			// B10 + B11 finalize: then a bowl that doesn't quite close (a bump that stops short
			// of its stem), bridged across BOWL_GAP strokes (verifier: the open p read "too tall")
			let bowl = rasterBowlBottom(solid, ink);
			if (bowl === null && stroke > 0) {
				bowl = rasterBowlBottom(solid, ink, { close: (BOWL_GAP * stroke) / 2 });
			}
			if (bowl !== null) seat = { bottom: bowl, from: 'bowl' };
		}
		if (seat) body.bottom = seat.bottom;
		else body.bottom = Math.max(body.bottom, lines.writing);
	} else if (BOWL_SEATED.has(char)) {
		// A Q whose tail dips less than TAIL_SHOWS still sits on its bowl, not on its tail's tip
		const bowl = bowlBottom(solid, ink);
		if (bowl !== null && bowl > body.bottom) {
			body.bottom = bowl;
			seat = { bottom: bowl, from: 'bowl' };
		}
	}
	penBottom = Math.max(penBottom, body.bottom);
	const size = line && line.height > 0 ? (body.top - body.bottom) / line.height : null;
	const pokes = pokesWay(ink, lines);
	const measures = {
		char,
		chars,
		stroke,
		pieces,
		specks,
		ink,
		frame,
		tail,
		markBelow,
		body,
		seat: seat ? seat.from : null,
		penBottom,
		line,
		size,
		pokes,
		lineAt: body.bottom,
	};
	const at = lineAtOf(measures, lines);
	measures.lineAt = at.y;
	if (at.from) measures.seat = at.from;
	return measures;
}

/**
 * B10 + B11 finalize: the height in the letter that belongs on the writing line, as the check
 * judges it and as Sit on the line puts it there (fix_shapes.js bodyBottom reads it), so a fix
 * always clears what the check says (principle 6; the critic's y that Sit on the line sank).
 * The body bottom, except: a j with a short tail is judged by its top (SHORT_TAIL_SHARE); a
 * comma with no head that sinks is seated with COMMA_RISE of it over the line.
 * @returns {{y: Number, from: String | null}}
 */
function lineAtOf(measures, lines) {
	const { char, ink, body, line, seat } = measures;
	if (char === 'j' && !seat && line && ink.yMin > SHORT_TAIL_SHARE * lines.tail) {
		const byTop = body.top - line.height;
		if (byTop > body.bottom) return { y: byTop, from: 'top' };
	}
	if (char === ',' && !commaHeaded(measures) && ink.yMax < -LINE_SHARE * lines.box) {
		return { y: ink.yMax - COMMA_RISE * (ink.yMax - ink.yMin), from: null };
	}
	return { y: body.bottom, from: null };
}

/** A comma has a head when its half-width row is in its upper half (body_bottom.js) */
function commaHeaded({ body, ink }) {
	return body.bottom >= ink.yMin + COMMA_HEAD_SHARE * (ink.yMax - ink.yMin);
}

/**
 * @param {Object} item - Glyph
 * @returns {Boolean} true when the letter has a piece of ink (spacing/outline.js's ink: a
 *   stray 1- or 2-point line and an empty shape hold none)
 */
export function hasLetterInk(item) {
	return inkPieces(itemContours(item)).length > 0;
}

/**
 * The specks of a letter (B11): pieces of ink smaller than a quarter of (stroke estimate)
 * squared that don't sit directly above or below another piece. Never the biggest piece (it
 * can't be: no shape's area is under a quarter of (2 x area / perimeter) squared). The dots of
 * i j ! ? : ; are never specks, drifted to the side by up to DOT_DRIFT of the tallest piece
 * (or a stroke) included. Biggest first.
 * @param {Object} item - Glyph
 * @returns {Array<Object>} spacing/outline.js pieces
 */
export function speckPieces(item) {
	const pieces = inkPieces(itemContours(item));
	const char = typeof item?.chars === 'string' && [...item.chars].length === 1 ? item.chars : '';
	return specksAmong(pieces, strokeOf(pieces), char, penAllowance(item));
}

/**
 * The slant a letter's edges are measured in: the one an automatic letter was spaced with, the
 * font's for any other (sides.js: every automatic letter keeps its ink inside its width in the
 * font's slant).
 * @param {Object} item - Glyph
 * @param {Number} slantOfFont - degrees (spacing/slant.js fontSlant)
 * @returns {Number} degrees
 */
export function spacingSlantOf(item, slantOfFont = 0) {
	return isAutomatic(item) ? fittedSlant(item) : Number(slantOfFont) || 0;
}

// --------------------------------------------------------------
// The checks
// --------------------------------------------------------------

/**
 * @param {Object} item - Glyph
 * @param {Object | null} measures - measureLetter
 * @param {{font?: Object, fontProblems?: Array<Object>, pokesAsNote?: Boolean,
 *   atFit?: Function}} [context] - fontProblems: the font check's last { itemId, problem,
 *   message } list ('fontCheck' topic); pokesAsNote: POKES_IS_NOTE (false: pokes is a check
 *   with [Shrink to fit]); atFit: (item) => true when the letter is automatic and at its fit
 *   (B10 + B11 finalize: its width is the one its ink gives, [Fit spacing] would do nothing,
 *   so a width problem isn't one)
 * @returns {Array<{id: String, fix: String | null, args: Object}>} in CHECK_ORDER
 */
export function findChecks(
	item,
	measures,
	{ font = {}, fontProblems = [], pokesAsNote = POKES_IS_NOTE, atFit = null } = {}
) {
	if (!item || !measures) return [];
	const found = [];
	const add = (id, fix, args = {}) => found.push({ id, fix, args });
	const lines = guideLines(font);
	const box = lines.box;
	const width = Math.round(Number(item.advanceWidth) || 0);

	const noWidth = width === 0;
	if (noWidth) add(CHECK.inkNoWidth, FIX.fitSpacing);

	const fontFile = fontFileCheck(item, fontProblems, found);
	if (fontFile) found.push(fontFile);

	if (measures.specks.length) {
		add(CHECK.specks, FIX.removeSpecks, { count: measures.specks.length });
	}

	const off = offLineWay(measures, lines);
	if (off) add(CHECK.offLine, FIX.sitOnLine, { way: off });

	const sized = sizeWay(measures);
	if (sized) add(CHECK.size, FIX.matchSize, { way: sized, line: measures.line.key });

	if (!pokesAsNote && measures.pokes) add(CHECK.pokes, FIX.shrinkToFit, { way: measures.pokes });

	if (!noWidth && width > 0) {
		const hang = hangsWay(measures, width, box);
		if (hang) add(CHECK.hangs, FIX.fitSpacing, { way: hang });
		const limit = Number(font?.upm) > 0 ? widthProblem(item, font) : null;
		if (limit && !(typeof atFit === 'function' && atFit(item))) {
			add(CHECK.width, FIX.fitSpacing, { way: limit });
		}
	}
	return found;
}

/**
 * The B1 font check's problem with this letter, as a check. Ink with no width is said once:
 * when the letter's own inkNoWidth is there, the font check's same problem is left out.
 * @param {Object} item - Glyph
 * @param {Array<{itemId: String, problem: String, message: String}>} fontProblems
 * @param {Array<{id: String}>} [found] - the letter's other checks
 * @returns {{id: String, fix: String, args: Object} | null}
 */
export function fontFileCheck(item, fontProblems, found = []) {
	if (!item || !Array.isArray(fontProblems)) return null;
	const noWidth = found.some((check) => check?.id === CHECK.inkNoWidth);
	const problem = fontProblems.find(
		(entry) => entry?.itemId === item.id && !(noWidth && entry.problem === FONT_INK_NO_WIDTH)
	);
	if (!problem) return null;
	return {
		id: CHECK.fontFile,
		// B10 + B11 finalize: [Fix it] only where it works (preview/fix_it.js canFixProblem's
		// rule): a point too far out has no safe fix, and its green [Fix it] did nothing for
		// good. Rule 6 shows that one with [Show me]; the letter keeps [Looks fine to me]
		fix: canFixFontFile(item, problem.problem) ? FIX.fixIt : null,
		args: { problem: String(problem.problem || ''), message: String(problem.message || '') },
	};
}

/** The font check's problems Fix it can fix (preview/fix_it.js FIXABLE, restated: importing the
 * font check here makes an import loop, spacing/outline.js's header) */
const FONT_FIXABLE = new Set(['ink-no-width', 'width-range', 'space-no-width', 'shape-points']);

/**
 * preview/fix_it.js canFixProblem's answer for one letter: a kind Fix it knows, and stray shapes
 * that are the letter's own.
 * @param {Object} item - Glyph
 * @param {String} problem - the font check's kind
 * @returns {Boolean}
 */
export function canFixFontFile(item, problem) {
	if (!FONT_FIXABLE.has(problem)) return false;
	if (problem === 'shape-points') return (item?.shapes || []).some((shape) => isStrayPath(shape));
	return true;
}

/**
 * @param {Array<{id: String}>} checks
 * @returns {Array<Object>} a new list in CHECK_ORDER (each id once, the first kept)
 */
export function orderChecks(checks) {
	const seen = new Set();
	return (checks || [])
		.filter((check) => {
			if (!check || seen.has(check.id) || !CHECK_ORDER.includes(check.id)) return false;
			seen.add(check.id);
			return true;
		})
		.sort((a, b) => CHECK_ORDER.indexOf(a.id) - CHECK_ORDER.indexOf(b.id));
}

/**
 * Size problems on one line, off the same way, move the line: the fix for one letter's size
 * problem.
 * @param {{id: String, fix: String, args: Object}} check
 * @param {Map<String, Number>} counts - sizeCounts
 * @returns {String} FIX.moveLine or FIX.matchSize (any other check keeps its fix)
 */
export function resolveSizeFix(check, counts) {
	if (check?.id !== CHECK.size) return check?.fix;
	const { line, way } = check.args || {};
	if (!MOVABLE_LINES.has(line)) return FIX.matchSize;
	const count = counts?.get?.(`${line}:${way}`) || 0;
	return count >= MOVE_LINE_COUNT ? FIX.moveLine : FIX.matchSize;
}

/**
 * @param {Iterable<Array<{id: String, args: Object}>>} entries - each letter's found checks
 * @returns {Map<String, Number>} 'line:way' -> how many letters are off that way on that line
 */
export function sizeCounts(entries) {
	const counts = new Map();
	for (const found of entries) {
		const check = (found || []).find((entry) => entry?.id === CHECK.size);
		if (!check) continue;
		const key = `${check.args.line}:${check.args.way}`;
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	return counts;
}

/**
 * The checks with their words.
 * @param {Object} item - Glyph
 * @param {Array<{id: String, fix: String, args: Object}>} found
 * @returns {Array<{id: String, reason: String, short: String, fix: String, fixLabel: String,
 *   action: String, args: Object}>}
 */
export function describeChecks(item, found) {
	const chars = typeof item?.chars === 'string' ? item.chars : '';
	const phrase = letterPhrase(chars);
	const letter = phrase ? sentenceStart(phrase) : word('check.aLetter');
	const n = [...chars].length > 1 ? 2 : 1;
	return (found || []).map((check) => {
		const { reason, short } = wordsFor(check, { letter, n });
		return {
			id: check.id,
			reason,
			short,
			fix: check.fix,
			fixLabel: fixLabel(check),
			action: 'fixLetter',
			args: { fix: check.fix, ...check.args },
		};
	});
}

/**
 * One letter's checks, with their words.
 * @param {Object} item - Glyph
 * @param {Object} [context]
 * @param {Object} [context.font] - settings.font
 * @param {Number} [context.slant] - the font's slant, degrees (spacing/slant.js fontSlant)
 * @param {Array<Object>} [context.fontProblems] - the font check's last list
 * @param {Map<String, Number>} [context.sameWay] - sizeCounts over the font; left out, a size
 *   problem is matched one letter at a time ([Match size])
 * @param {Boolean} [context.pokesAsNote] - POKES_IS_NOTE
 * @returns {Array<Object>} described checks; [] with no ink
 */
export function checkLetter(
	item,
	{ font = {}, slant = 0, fontProblems = [], sameWay, pokesAsNote = POKES_IS_NOTE, atFit } = {}
) {
	const measures = measureLetter(item, font, { slant: spacingSlantOf(item, slant) });
	const found = findChecks(item, measures, { font, fontProblems, pokesAsNote, atFit });
	if (sameWay) found.forEach((check) => (check.fix = resolveSizeFix(check, sameWay)));
	return describeChecks(item, found);
}

/**
 * Every letter with ink in the font, the size fix decided across letters.
 * @param {Object} project - GlyphrStudioProject
 * @param {{fontProblems?: Array<Object>, items?: Array<Object>, pokesAsNote?: Boolean}}
 *   [options] - items: the letters to check (default: every glyph in the font)
 * @returns {Map<String, Array<Object>>} item id -> described checks (letters with ink only)
 */
export function checkFont(project, { fontProblems = [], items, pokesAsNote = POKES_IS_NOTE } = {}) {
	const font = project?.settings?.font || {};
	const slant = fontSlant(project);
	const letters = items || Object.values(project?.glyphs || {});
	const found = new Map();
	letters.forEach((item) => {
		const measures = measureLetter(item, font, { slant: spacingSlantOf(item, slant) });
		if (!measures) return;
		found.set(item.id, {
			item,
			list: findChecks(item, measures, { font, fontProblems, pokesAsNote }),
		});
	});
	const counts = sizeCounts([...found.values()].map((entry) => entry.list));
	const result = new Map();
	found.forEach(({ item, list }, id) => {
		list.forEach((check) => (check.fix = resolveSizeFix(check, counts)));
		result.set(id, describeChecks(item, list));
	});
	return result;
}

// --------------------------------------------------------------
// One check each
// --------------------------------------------------------------

/** @returns {'above' | 'below' | null} */
function offLineWay(measures, lines) {
	const { char, ink, body, penBottom, tail, markBelow, lineAt } = measures;
	if (!char || markBelow) return null;
	const tolerance = LINE_SHARE * lines.box;
	if (char === ',') {
		// A comma's tail hangs. It floats when all of it is above the line; one with a head (its
		// half-width row in its upper half, body_bottom.js) floats or sinks by that head, the
		// way Sit on the line seats it, so the fix always clears what the check says. B10 + B11
		// finalize: one with no head (a small comma, a slash of the pen) sinks only when all of
		// it is under the line (lineAt seats it with COMMA_RISE of it above)
		const headed = commaHeaded(measures);
		if (ink.yMin > tolerance || (headed && body.bottom > tolerance)) return 'above';
		if (headed && body.bottom < -tolerance) return 'below';
		if (!headed && ink.yMax < -tolerance) return 'below';
		return null;
	}
	if (!(isLetter(char) || isNumber(char) || char === '.')) return null;
	// A tail's body is found from its shape (a bowl, a joint) or a j's top: it gets SEAT_SLACK
	// more room
	const slack = tail ? (SEAT_SLACK[measures.seat] || 0) * (measures.stroke || 0) : 0;
	if (lineAt > tolerance + slack) return 'above';
	if (tail) {
		// B10 + B11 finalize: a bowl or a joint written low sinks too (the critic: "a tail
		// letter written low is never judged"); a j, J or f with neither hangs by design
		const shaped = measures.seat === 'bowl' || measures.seat === 'joint';
		return shaped && lineAt < -tolerance - slack ? 'below' : null;
	}
	const below = -tolerance - (isRoundLetter(char) ? lines.overshoot : 0);
	// A Q, J or f may dip a short tail under the line (less than TAIL_SHOWS): placement seats it
	// on its body and lets the dip hang (D-034), so only floating is judged. A Brush letter is
	// judged by the pen's center line (penBottom)
	if (penBottom < below && tailKind(char) === 'never') return 'below';
	return null;
}

/** @returns {'big' | 'small' | null} */
function sizeWay(measures) {
	const { char, size, line } = measures;
	if (!char || !line || size === null) return null;
	if (!(isLetter(char) || isNumber(char) || char === '?' || char === '!')) return null;
	if (size > 1 + SIZE_SHARE) return 'big';
	if (size < 1 - SIZE_SHARE) return 'small';
	return null;
}

/** @returns {'top' | 'tail' | 'both' | null} */
function pokesWay(ink, lines) {
	const reach = POKE_SHARE * lines.box;
	const top = ink.yMax > lines.top + reach;
	const tail = ink.yMin < lines.tail - reach;
	if (top && tail) return 'both';
	if (top) return 'top';
	if (tail) return 'tail';
	return null;
}

/** @returns {'left' | 'right' | 'both' | null} */
function hangsWay(measures, width, box) {
	const { char, frame } = measures;
	if (!char || MAY_HANG.has(baseLetter(char)) || tailKind(char) !== 'never') return null;
	const reach = HANG_SHARE * box;
	const left = -frame.xMin > reach;
	const right = frame.xMax - width > reach;
	if (left && right) return 'both';
	if (left) return 'left';
	if (right) return 'right';
	return null;
}

// --------------------------------------------------------------
// Words
// --------------------------------------------------------------

/** @returns {{reason: String, short: String}} */
function wordsFor(check, { letter, n }) {
	const args = check.args || {};
	const pair = (name, vars = {}) => ({
		reason: word(`checks.reason.${name}`, { letter, ...vars }),
		short: word(`checks.short.${name}`, vars),
	});
	switch (check.id) {
		case CHECK.inkNoWidth:
			return {
				reason: word('check.inkNoWidth', { letter, n }),
				short: word('checks.short.inkNoWidth'),
			};
		case CHECK.fontFile:
			return {
				reason: args.message || word('checks.short.fontFile'),
				short: word('checks.short.fontFile'),
			};
		case CHECK.specks:
			return pair('specks', { count: args.count });
		case CHECK.offLine:
			return pair(args.way === 'above' ? 'floats' : 'sinks');
		case CHECK.size:
			return pair(args.way === 'big' ? 'tooTall' : 'tooShort', {
				line: word(LINE_WORDS[args.line] || LINE_WORDS.capHeight),
			});
		case CHECK.pokes:
			return pair(
				args.way === 'both' ? 'pokesBoth' : args.way === 'tail' ? 'pokesTail' : 'pokesTop'
			);
		case CHECK.hangs:
			return pair('hangs');
		case CHECK.width:
			return pair(args.way === 'wide' ? 'wide' : 'narrow');
		case CHECK.twoLetters:
			return pair('twoLetters');
		default:
			return { reason: '', short: '' };
	}
}

/**
 * The fix button's words: the fixes track's 'fixes.button.<fix>'; B1's "Fix it" for the font
 * file when that set has none; '' when no set names it (the button isn't shown).
 * @param {{fix: String, args: Object}} check
 * @returns {String}
 */
function fixLabel(check) {
	const key = `fixes.button.${check.fix}`;
	if (hasWord(key)) return word(key, { count: check.args?.count ?? 0, ...check.args });
	if (check.fix === FIX.fixIt) return word('check.fixIt');
	return '';
}

// --------------------------------------------------------------
// Pieces and shapes
// --------------------------------------------------------------

/** 2 x area / perimeter of the biggest piece (spacing/measure.js strokeEstimate) */
function strokeOf(pieces) {
	if (!pieces.length) return null;
	const biggest = pieces.reduce((best, piece) => (piece.area > best.area ? piece : best));
	if (!(biggest.area > 0) || !(biggest.perimeter > 0)) return null;
	return (2 * biggest.area) / biggest.perimeter;
}

/**
 * The specks among a letter's pieces (speckPieces). nibOf: half a Brush piece's nib
 * (body_bottom.js penAllowance). On a letter with no dot of its own (hasNoDots), B10 + B11
 * finalize (the critic's double tap, two taps one over the other beside n, a default-nib tap
 * beside a fine pen's n): dots of the pen that touch one another are one dot, so such a cluster
 * clear of the letter is specks; a dot is pen-sized by the letter's stroke or by its own nib;
 * and only a piece of the letter itself, no dot or speck, keeps a dot or a small piece over or
 * under it (B11: "doesn't sit directly above or below another piece").
 */
function specksAmong(pieces, stroke, char, nibOf = () => 0) {
	if (pieces.length < 2 || !(stroke > 0)) return [];
	const limit = SPECK_SHARE * stroke * stroke;
	const biggest = pieces.reduce((best, piece) => (piece.area > best.area ? piece : best));
	const tallest = Math.max(...pieces.map((piece) => piece.yMax - piece.yMin));
	const slack = DOTTED.has(char) ? Math.max(stroke, DOT_DRIFT * tallest) : 0;
	const sheltered = (piece, among) =>
		among.some((other) => other !== piece && overOrUnder(piece, other, slack));
	if (!hasNoDots(char)) {
		return pieces
			.filter((piece) => piece !== biggest && piece.area < limit && !sheltered(piece, pieces))
			.sort((a, b) => b.area - a.area);
	}
	const isDot = (piece) => isDotShape(piece, stroke, biggest, nibOf);
	const candidates = pieces.filter(
		(piece) => piece !== biggest && (piece.area < limit || isDot(piece))
	);
	const letterPieces = pieces.filter((piece) => !candidates.includes(piece));
	const clear = DOT_CLEAR * stroke;
	const near = (a, b) =>
		b.xMin - clear < a.xMax &&
		a.xMin < b.xMax + clear &&
		b.yMin - clear < a.yMax &&
		a.yMin < b.yMax + clear;
	const found = new Set();
	clustersOf(candidates, near).forEach((cluster) => {
		const alone = !letterPieces.some((other) => cluster.some((piece) => near(piece, other)));
		const free = !cluster.some((piece) => sheltered(piece, letterPieces));
		if (alone && free && cluster.some(isDot)) cluster.forEach((piece) => found.add(piece));
	});
	candidates.forEach((piece) => {
		if (piece.area < limit && !sheltered(piece, letterPieces)) found.add(piece);
	});
	return [...found].sort((a, b) => b.area - a.area);
}

/** Pieces in groups that touch (near) one another */
function clustersOf(pieces, near) {
	const parent = pieces.map((_, i) => i);
	const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
	for (let i = 0; i < pieces.length; i++) {
		for (let j = i + 1; j < pieces.length; j++) {
			if (near(pieces[i], pieces[j])) parent[find(i)] = find(j);
		}
	}
	const groups = new Map();
	pieces.forEach((piece, i) => {
		const key = find(i);
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(piece);
	});
	return [...groups.values()];
}

/**
 * True for a letter or number that has no dot or mark of its own (not i or j, nothing
 * accented, not a dotted l): any dot of the pen beside it is a slip.
 */
function hasNoDots(char) {
	if (!char || DOTTED.has(char) || DOT_BESIDE.has(char)) return false;
	if ([...char.normalize('NFD')].length !== 1) return false;
	return isLetter(char) || isNumber(char);
}

/**
 * A dot's shape: about round, no more than DOT_STROKES strokes (or DOT_NIBS of its own Brush nib)
 * across, under DOT_AREA_SHARE of the biggest piece. A dot of the pen must also be clear of the
 * letter (specksAmong): a short stroke that touches it, an r's flag or a t's bar, is part of it.
 */
function isDotShape(piece, stroke, biggest, nibOf) {
	const width = piece.xMax - piece.xMin;
	const height = piece.yMax - piece.yMin;
	const most = Math.max(DOT_STROKES * stroke, DOT_NIBS * 2 * (nibOf(piece) || 0));
	if (!(width > 0) || !(height > 0) || width > most || height > most) return false;
	if (Math.max(width, height) > DOT_ROUND * Math.min(width, height)) return false;
	return piece.area < DOT_AREA_SHARE * biggest.area;
}

/** True when piece sits directly above or below other (slack: how far to the side) */
function overOrUnder(piece, other, slack) {
	const sideways = piece.xMax + slack < other.xMin || piece.xMin - slack > other.xMax;
	const apart = piece.yMin >= other.yMax || piece.yMax <= other.yMin;
	return !sideways && apart;
}

/**
 * The letter's body: its pieces without the marks above it (sides.js's rule: a piece that
 * starts above the body's top, or a small one that isn't part of the body's main pieces).
 * @returns {{top: Number, bottom: Number, kept: Array<Object>}} kept: the body's pieces
 */
function bodyOf(pieces, lineHeight, lines) {
	const bottom = Math.min(...pieces.map((piece) => piece.yMin));
	const reach = bottom + BODY_SHARE * (lineHeight > 0 ? lineHeight : lines.capitals);
	const main = pieces.filter((piece) => piece.yMin < reach);
	const top = Math.max(...main.map((piece) => piece.yMax));
	const small = MARK_SIZE * (lines.small > 0 ? lines.small : lines.box / 2);
	const kept = pieces.filter(
		(piece) =>
			main.includes(piece) ||
			!(piece.yMin >= top || (piece.xMax - piece.xMin <= small && piece.yMax - piece.yMin <= small))
	);
	return {
		top: Math.max(...kept.map((piece) => piece.yMax)),
		bottom: Math.min(...kept.map((piece) => piece.yMin)),
		kept,
	};
}

/**
 * The line a letter's size is judged by.
 * @returns {{key: String, height: Number}}
 */
function lineOf(char, lines) {
	const base = baseLetter(char);
	const overshoot = isRoundLetter(char) ? 2 * lines.overshoot : 0;
	let key = 'capHeight';
	let height = lines.capitals;
	if (base === 't') {
		key = 'between';
		height = (lines.small + lines.top) / 2;
	} else if (TALL.includes(base)) {
		key = 'ascent';
		height = lines.top;
	} else if (/\p{Ll}/u.test(base)) {
		key = 'xHeight';
		height = lines.small;
	}
	return { key, height: height + overshoot };
}

/** The box round some pieces */
function boxOf(pieces) {
	return {
		xMin: Math.min(...pieces.map((piece) => piece.xMin)),
		xMax: Math.max(...pieces.map((piece) => piece.xMax)),
		yMin: Math.min(...pieces.map((piece) => piece.yMin)),
		yMax: Math.max(...pieces.map((piece) => piece.yMax)),
	};
}

/** The pieces' left and right ends with a slant taken out (sides.js's frame) */
function frameOf(pieces, k, turn) {
	if (!k) {
		const box = boxOf(pieces);
		return { xMin: box.xMin, xMax: box.xMax };
	}
	let xMin = Infinity;
	let xMax = -Infinity;
	pieces.forEach((piece) => {
		piece.contours.forEach(({ points }) => {
			points.forEach(([x, y]) => {
				const upright = x - k * (y - turn);
				if (upright < xMin) xMin = upright;
				if (upright > xMax) xMax = upright;
			});
		});
	});
	return { xMin, xMax };
}

const isLetter = (char) => /\p{L}/u.test(char);
const isNumber = (char) => /\p{Nd}/u.test(char);
