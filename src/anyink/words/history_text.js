// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: Undo titles in plain words (UX-BEGINNER.md 2.2 "Undo titles, one rule", 2.4 G).
	Existing code keeps the titles it records (More tools' auto-trace still writes "Auto-traced
	N shapes (P points)", which apply.test checks); everything shown on screen goes through
	historyText(title), which maps each title upstream and ANY-INK record today by pattern. The
	words live in sets/history.js.

	  historyText(title, context)          the plain words, '' for a step that is never shown
	                                       (looking around), "your last change" for a title
	                                       no rule knows
	  describeHistoryTitle(title, context) { key, vars, hidden, text }: the words key it picked
	                                       (''  for a plain title passed through as it is)
	  isHiddenHistoryTitle(title)          true for looking around: "Navigated to ...",
	                                       "Automatically navigated to ...", the "Created <letter>"
	                                       step All tools records when a letter is opened, and
	                                       the whole-font pair's internal marker

	context: what the caller knows about the step, both optional:
	  chars    the letter it is about ('B', 'fi'); preferred to the name inside the title
	  project  the font, so a gap step can name its two letters

	Rules:
	- First match wins; specific patterns come before general ones.
	- A title that starts with a small letter is ANY-INK's own plain title (2.2: new actions write
	  plain titles) and passes through as it is, unless it says a banned word (banned.js).
	- Letters are named with letterPhrase ('small b', 'the number 7', 'the joined letters fi'),
	  from the context, an id in the title (glyph-0x63, liga-0x66-0x69) or upstream's Unicode
	  name ('Latin Small Letter B'); otherwise "this letter".
	- HTML in a title (upstream's cross-project titles carry <br>) and a final period are
	  dropped; numbers inside a title are never shown, except a count of shapes or points.
	- S1 (docs/SKETCH.md section 7): the sketch's Undo titles are written from their words
	  (sets/sketch.js 'sketch.step.*', "sketched a line on small n") and mapped back to their key,
	  with {letter} / {part} / {number} as vars, by rules made from those same words, so a title
	  and its rule never drift apart. They come right after B1's rules.
*/
import { getUnicodeName, getUnicodeShortName } from '../../lib/unicode/unicode_names.js';
import { WHOLE_PROJECT_POST_TITLE } from '../history/history_helpers.js';
import { findBanned } from './banned.js';
import { letterPhrase } from './letter_name.js';
import { SKETCH_STEPS } from './sets/sketch.js';
import { word, wordEntry } from './words.js';

/**
 * @typedef {Object} HistoryStep
 * @property {String} key - the words key ('' when the title passed through, or is internal)
 * @property {Object} vars - the values for the key's placeholders
 * @property {Boolean} hidden - looking around: never shown
 * @property {String} text - the plain words (filled even for a hidden step)
 */

// --------------------------------------------------------------
// Letters
// --------------------------------------------------------------

/** Unicode names of the Latin letters and signs a font usually holds, built on first use. */
let namedChars = null;

function charsByName() {
	if (namedChars) return namedChars;
	namedChars = { long: new Map(), short: new Map() };
	for (let code = 0x20; code <= 0x24f; code++) {
		const char = String.fromCodePoint(code);
		const hex = `0x${code.toString(16).toUpperCase()}`; // shortUnicodeNames' own keys
		const long = getUnicodeName(hex);
		if (long && !long.startsWith('U+') && !long.startsWith('<')) {
			namedChars.long.set(long.toLowerCase(), char);
		}
		const short = getUnicodeShortName(hex);
		if (short && !namedChars.short.has(short)) namedChars.short.set(short, char);
	}
	return namedChars;
}

/**
 * The characters a title's item name or id stands for.
 * @param {String} name - 'Latin Small Letter B', 'glyph-0x63', 'liga-0x66-0x69', 'g'
 * @returns {String} '' when it names nothing known
 */
function charsFromName(name) {
	const value = String(name ?? '').trim();
	if (!value) return '';
	const id = value.match(/^(?:glyph-)?0x([0-9a-f]+)$/i);
	if (id) return String.fromCodePoint(parseInt(id[1], 16));
	const liga = value.match(/^liga-(.+)$/i);
	if (liga) {
		return liga[1]
			.split('-')
			.map((part) =>
				/^0x[0-9a-f]+$/i.test(part) ? String.fromCodePoint(parseInt(part, 16)) : part
			)
			.join('');
	}
	const latin = value.match(/^Latin (Capital|Small) Letter ([A-Z])$/i);
	if (latin)
		return latin[1].toLowerCase() === 'capital' ? latin[2].toUpperCase() : latin[2].toLowerCase();
	const ligature = value.match(/^Ligature (.+)$/);
	if (ligature) return ligature[1].replaceAll('‌', '');
	const { long, short } = charsByName();
	return long.get(value.toLowerCase()) || short.get(value) || '';
}

/**
 * @param {String} [name] - the item name or id inside the title
 * @param {Object} [context]
 * @returns {String} 'small b', 'the period', or "this letter"
 */
function letterOf(name, context) {
	const chars = context?.chars || charsFromName(name);
	return (chars && letterPhrase(chars)) || word('history.thisLetter');
}

/**
 * Both letters of a gap fix with one letter on each side.
 * @param {Object} [project]
 * @param {String} id - 'kern-3'
 * @returns {{left: String, right: String} | null}
 */
function gapLetters(project, id) {
	const group = project?.kerning?.[id];
	const left = group?.leftGroup;
	const right = group?.rightGroup;
	if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 1 || right.length !== 1) {
		return null;
	}
	const named = (hex) => letterPhrase(Number(hex));
	return named(left[0]) && named(right[0])
		? { left: named(left[0]), right: named(right[0]) }
		: null;
}

// --------------------------------------------------------------
// Guide lines
// --------------------------------------------------------------

/** Every label a line has had in a title: metrics_math's, the readouts', and the house word. */
const LINES = Object.freeze({
	ascent: { key: 'line.ascent', labels: ['Ascent'] },
	capHeight: { key: 'line.capHeight', labels: ['Cap height'] },
	xHeight: { key: 'line.xHeight', labels: ['X height', 'x-height'] },
	baseline: { key: 'line.baseline', labels: ['Baseline'] },
	descent: { key: 'line.descent', labels: ['Descent'] },
	lsb: { key: 'space.lsb', labels: ['Left side bearing'] },
	rsb: { key: 'space.rsb', labels: ['Right side bearing'] },
	upm: { key: '', labels: ['UPM', 'grid size'] },
	lineGap: { key: '', labels: ['Line gap', 'space between lines'] },
	overshoot: { key: '', labels: ['Overshoot'] },
});

/**
 * @param {String} label - as a title wrote it
 * @returns {String} a LINES key, or '' (a custom guide's own name)
 */
function lineFor(label) {
	const wanted = String(label).trim().toLowerCase();
	const found = Object.entries(LINES).find(([, { key, labels }]) =>
		[...labels, key ? word(key) : ''].some((l) => l && l.toLowerCase() === wanted)
	);
	return found ? found[0] : '';
}

/** The step for a moved line, by its LINES key ('' = a custom guide). */
function lineStep(line) {
	if (['ascent', 'capHeight', 'xHeight', 'baseline', 'descent'].includes(line)) {
		return ['history.lineMoved', { line: word(`line.${line}`) }];
	}
	if (line === 'lsb') return ['history.leftSpaceMoved'];
	if (line === 'rsb') return ['history.rightSpaceMoved'];
	if (line === 'upm') return ['history.gridChanged'];
	if (line === 'lineGap') return ['history.lineGapChanged'];
	if (line === 'overshoot') return ['history.guideLinesChanged'];
	return ['history.guideMoved'];
}

// --------------------------------------------------------------
// Rules: [pattern, key or (match, context) => [key, vars], hidden]
// --------------------------------------------------------------

const count = (n) => ({ count: n === 'a' ? 1 : Number(n) });
const LAYER_KEYS = {
	up: 'history.shapesForward',
	down: 'history.shapesBack',
	'to the top': 'history.shapesToFront',
	'to the bottom': 'history.shapesToBack',
};
const COMBINE_KEYS = {
	unite: 'history.shapesMerged',
	divide: 'history.shapesCutApart',
	subtract: 'history.shapeCutOut',
	exclude: 'history.keptNonOverlap',
	intersect: 'history.keptOverlap',
};

// --------------------------------------------------------------
// Sketch (S1): rules made from the Undo titles' own words
// --------------------------------------------------------------

/** What each placeholder of a sketch title may be: a number only for {number}. */
const SKETCH_HOLES = Object.freeze({ number: '(\\d+)' });

/**
 * One rule for a 'sketch.step.*' title: its words with each {name} as a capture.
 * @param {String} key
 * @returns {[RegExp, Function]}
 */
function sketchRule(key) {
	const text = wordEntry(key).text;
	const names = [];
	const source = text
		.split(/(\{[a-zA-Z][a-zA-Z0-9]*\})/)
		.map((part) => {
			const hole = part.match(/^\{([a-zA-Z][a-zA-Z0-9]*)\}$/);
			if (!hole) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			names.push(hole[1]);
			return SKETCH_HOLES[hole[1]] || '(.+)';
		})
		.join('');
	const mapping = (m) => [key, Object.fromEntries(names.map((name, i) => [name, m[i + 1]]))];
	return [new RegExp(`^${source}$`), mapping, text.replace(/\{[^}]*\}/g, '').length];
}

/** Longest fixed words first, so "made a piece an outline on" wins over "made {letter} an outline". */
const SKETCH_RULES = SKETCH_STEPS.map(sketchRule)
	.sort((a, b) => b[2] - a[2])
	.map(([pattern, mapping]) => [pattern, mapping]);

/** @type {Array<[RegExp, String | Function, Boolean?]>} */
// prettier-ignore
const RULES = [
	// Looking around: never shown
	[/^Navigated to (.+)$/, (m, c) => ['history.navigated', { letter: letterOf(m[1], c) }], true],
	[/^Automatically navigated to (.+)$/, (m, c) => ['history.navigated', { letter: letterOf(m[1], c) }], true],

	// B1 (Fix it)
	[/^gave (.+) a width$/, (m) => ['history.gaveWidth', { letter: m[1] }]],
	[/^fixed the width of (.+)$/, (m) => ['history.fixedWidth', { letter: m[1] }]],
	[/^removed (a|\d+) stray shapes? from (.+)$/, (m) => ['history.removedStray', { ...count(m[1]), letter: m[2] }]],
	[/^traced (.+)$/, (m) => ['history.traced', { letter: m[1] }]],

	// S1: the sketch (docs/SKETCH.md section 7)
	...SKETCH_RULES,

	// The photo
	[/^Added a trace image$/, 'history.photoAdded'],
	[/^Replaced the trace image$/, 'history.photoReplaced'],
	[/^Removed the trace image$/, 'history.photoRemoved'],
	[/^Moved the trace image$/, 'history.photoMoved'],
	[/^Resized the trace image$/, 'history.photoResized'],
	[/^Set trace opacity to [\d.]+%$/, 'history.photoFade'],
	[/^Showed the trace image$/, 'history.photoShown'],
	[/^Hid the trace image$/, 'history.photoHidden'],
	[/^Locked the trace image$/, 'history.photoLocked'],
	[/^Unlocked the trace image$/, 'history.photoUnlocked'],
	[/^Inverted the trace image colors$/, 'history.photoLightInk'],
	[/^Restored the trace image colors$/, 'history.photoDarkInk'],
	[/^Fit the trace image to the em$/, 'history.photoFitBox'],
	[/^Fit the trace image to the cap height$/, 'history.photoFitCapitals'],
	[
		/^Auto-traced [\d,]+ shapes? \([\d,]+ points?\)$/,
		(m, c) => (c?.chars ? ['history.traced', { letter: letterOf('', c) }] : ['history.tracedPhoto']),
	],

	// Shapes, points and curve handles
	[/^Deleted (\d+) paths$/, (m) => ['history.shapesDeleted', count(m[1])]],
	[/^Deleted path: /, () => ['history.shapesDeleted', count(1)]],
	[/^Deleted (\d+) path points$/, (m) => ['history.pointsDeleted', count(m[1])]],
	[/^Deleted path point: /, () => ['history.pointsDeleted', count(1)]],
	[/^Moved (\d+) path points$/, (m) => ['history.pointsMoved', count(m[1])]],
	[/^Moved path point: \d+ h[12]$/, 'history.handleMoved'],
	[/^Moved path point: \d+( p)?$/, () => ['history.pointsMoved', count(1)]],
	[/^Dragged the centerpoint of a curve/, 'history.curveBent'],
	[/^Added new path: /, 'history.shapeAdded'],
	[/^Added path: Rectangle\b/, 'history.rectangleAdded'],
	[/^Added path: Oval\b/, 'history.ovalAdded'],
	[/^Added path: /, 'history.shapeAdded'],
	[/^Added a default rectangle path$/, 'history.rectangleAdded'],
	[/^New path: added point \d+$/, 'history.pointAdded'],
	[/^Added point to path$/, 'history.pointAdded'],
	[/^Inserted a new path point at position \d+$/, 'history.pointAdded'],
	[/^Path edit tool$/, 'history.pointsChanged'],
	[/^Path resize tool$/, 'history.shapeChanged'],
	[/^Moved shape: /, () => ['history.shapesMoved', count(1)]],
	[/^Moved (\d+) shapes$/, (m) => ['history.shapesMoved', count(m[1])]],
	[/^Resized shape: /, () => ['history.shapesResized', count(1)]],
	[/^Resized (\d+) shapes$/, (m) => ['history.shapesResized', count(m[1])]],
	[/^Rotated shape(: .+)?$/, () => ['history.shapesTurned', count(1)]],
	[/^Rotated (\d+) shapes?( by .+)?$/, (m) => ['history.shapesTurned', count(m[1])]],
	[/^Skew (\d+) shapes? by .+$/, (m) => ['history.shapesSlanted', count(m[1])]],
	[/^Offset path for (\d+) shapes?$/, (m) => ['history.shapesThickness', count(m[1])]],
	[/^Nudged shape\(s\) by /, 'history.shapesNudged'],
	[/^Nudged path points by /, () => ['history.pointsNudged', count(2)]],
	[/^Nudged path point by /, () => ['history.pointsNudged', count(1)]],
	[/^Toggled path winding to Clockwise$/i, 'history.madeHole'],
	[/^Toggled path winding to Counter-clockwise$/i, 'history.madeSolid'],
	[/^Toggled path winding/, 'history.shapeChanged'],
	[/^Changed point \d+ to (symmetric|flat)$/, 'history.pointSmooth'],
	[/^Changed point \d+ to corner$/, 'history.pointCorner'],
	[/^Control Point: toggled handle \d on$/, 'history.handleOn'],
	[/^Control Point: toggled handle \d off$/, 'history.handleOff'],
	[/^Reset the handles for /, 'history.handlesReset'],
	[/^Merged path points$/, 'history.pointsMerged'],
	[/^(Left|Center|Right|Top|Middle|Bottom) aligned (\d+) shapes$/, (m) => ['history.shapesLinedUp', count(m[2])]],
	[/^(Left|Center|Right|Top|Middle|Bottom) aligned (\d+) points$/, (m) => ['history.pointsLinedUp', count(m[2])]],
	[/^Flipped all shapes in this glyph horizontally$/, (m, c) => ['history.letterFlippedLeftRight', { letter: letterOf('', c) }]],
	[/^Flipped all shapes in this glyph vertically$/, (m, c) => ['history.letterFlippedUpsideDown', { letter: letterOf('', c) }]],
	[/^Flipped shape .+ horizontally$/, 'history.shapeFlippedLeftRight'],
	[/^Flipped shape .+ vertically$/, 'history.shapeFlippedUpsideDown'],
	[/^Rounded .*position values\b/, 'history.pointsTidied'],
	[/^Moved (layers?) (up|down|to the top|to the bottom)$/, (m) => [LAYER_KEYS[m[2]], count(m[1] === 'layer' ? 1 : 2)]],
	[/^Combine: (unite|divide|subtract|exclude|intersect) - /, (m) => [COMBINE_KEYS[m[1]]]],
	[/^Turned a path into a component instance$/, 'history.madeLinkedCopy'],
	[/^Turned a component instance into a path$/, 'history.madeShapeFromCopy'],
	[/^Pasted shape$/, () => ['history.shapesPasted', count(1)]],
	[/^Pasted (\d+) shapes$/, (m) => ['history.shapesPasted', count(m[1])]],
	[/^Paths were copied from (.+)$/, (m, c) => ['history.shapesCopiedFrom', { letter: letterOf(m[1], c) }]],
	[/^\d+ paths were copied from .+ : .+$/, 'history.shapesFromOtherFont'],
	[/^Component instance was linked from (.+)$/, (m) => ['history.linkedCopyAdded', { letter: letterOf(m[1]) }]],
	[/^Component was linked to (.+)$/, (m) => ['history.partUsedIn', { letter: letterOf(m[1]) }]],
	[/^Imported SVG to glyph (.+)$/, (m, c) => ['history.drawingBroughtIn', { letter: letterOf(m[1], c) }]],

	// Letters, spaces and widths
	[/^Deleted (Glyph|Ligature) (\S+) : /, (m) => ['history.letterDeleted', { letter: letterOf(m[2]) }]],
	[/^Deleted Component /, 'history.partDeleted'],
	[/^Deleted Kern Group /i, 'history.gapFixRemoved'],
	[/^Auto-fit advance width$/, (m, c) => ['history.widthFitted', { letter: letterOf('', c) }]],
	[/^Changed advanceWidth for: (.+)$/, (m, c) => ['history.widthChanged', { letter: letterOf(m[1], c) }]],
	[/^Changed leftSideBearing for: /, 'history.leftSpaceMoved'],
	[/^Changed rightSideBearing for: /, 'history.rightSpaceMoved'],
	[/^Changed name for: /, 'history.shapeRenamed'],
	[/^Changed \S+ for: /, 'history.shapeChanged'],
	[/^Updated left side bearing$/, 'history.leftSpaceMoved'],
	[/^Updated right side bearing$/, 'history.rightSpaceMoved'],

	// Guide lines
	[/^Moved baseline$/, () => lineStep('baseline')],
	[/^Changed font metrics or guides$/, 'history.guideLinesChanged'],
	[/^(?:Set|Moved) (.+) to -?[\d.]+$/, (m) => lineStep(lineFor(m[1]))],
	[/^Dragged (.+)$/, (m) => lineStep(lineFor(m[1]))],

	// Gap fixes
	[
		/^Nudged kern group (\S+) by (-?[\d.]+)$/,
		(m, c) => {
			const closer = Number(m[2]) < 0;
			const pair = gapLetters(c?.project, m[1]);
			if (pair) return [closer ? 'history.gapCloser' : 'history.gapApart', pair];
			return [closer ? 'history.someGapCloser' : 'history.someGapApart'];
		},
	],
	[/^Kern group value: /, 'history.gapFixChanged'],
	[/^Edited kern group: /, 'history.gapFixChanged'],
	[/^Created a new kern group$/, 'history.gapFixAdded'],
	[
		/^Deleted letter pair (.+) from \d+ kern groups?$/,
		(m) => {
			const chars = [...m[1]];
			const left = chars.length === 2 && letterPhrase(chars[0]);
			const right = chars.length === 2 && letterPhrase(chars[1]);
			return left && right ? ['history.gapFixRemovedPair', { left, right }] : ['history.gapFixRemoved'];
		},
	],
	[/^Kern exception for pair /, 'history.gapFixOnePair'],

	// More tools pages
	[/^Created ligature (.+)$/, (m) => ['history.joinedMade', { letter: letterPhrase(m[1]) || word('history.thisLetter') }]],
	[/^Created (\d+) ligatures$/, (m) => ['history.joinedMadeMany', count(m[1])]],
	[/^Created component /, 'history.partMade'],
	[/^Created a component$/, 'history.partMade'],
	// All tools' creation-only step when a letter is opened: looking around
	[/^Created (.+)$/, (m, c) => ['history.opened', { letter: letterOf(m[1], c) }], true],
	[/^Global action: /, 'history.allLettersChanged'],
	[/^Deleted \d+ characters and removed character range: /, 'history.letterSetRemoved'],
	[/^Cross-project action: /, 'history.copiedFromOtherFont'],
];

// --------------------------------------------------------------
// Mapping
// --------------------------------------------------------------

/**
 * @param {*} title
 * @returns {String} tags dropped, whitespace collapsed, one final period dropped
 */
function normalize(title) {
	return String(title ?? '')
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\.$/, '');
}

/**
 * Which words a title becomes.
 * @param {*} title - as History recorded it
 * @param {{chars?: String, project?: Object}} [context]
 * @returns {HistoryStep}
 */
export function describeHistoryTitle(title, context = {}) {
	if (title === WHOLE_PROJECT_POST_TITLE) return { key: '', vars: {}, hidden: true, text: '' };
	const plain = normalize(title);
	for (const [pattern, mapping, hidden = false] of RULES) {
		const match = plain.match(pattern);
		if (!match) continue;
		const [key, vars = {}] = typeof mapping === 'function' ? mapping(match, context) : [mapping];
		return { key, vars, hidden, text: word(key, vars) };
	}
	if (/^\p{Ll}/u.test(plain) && findBanned(plain).length === 0) {
		return { key: '', vars: {}, hidden: false, text: plain };
	}
	return { key: 'history.unknown', vars: {}, hidden: false, text: word('history.unknown') };
}

/**
 * What the undo toast and the Undo / Redo tooltips say for a step.
 * @param {*} title - as History recorded it
 * @param {{chars?: String, project?: Object}} [context]
 * @returns {String} plain words; '' for a step that is never shown
 */
export function historyText(title, context = {}) {
	const step = describeHistoryTitle(title, context);
	return step.hidden ? '' : step.text;
}

/**
 * @param {*} title
 * @returns {Boolean} true for looking around (never shown, never an Undo step in Simple)
 */
export function isHiddenHistoryTitle(title) {
	return describeHistoryTitle(title).hidden;
}
