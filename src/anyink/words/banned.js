// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: the words banned on the Simple main path (UX-BEGINNER.md 2.3) and the rules for where the
	ban applies. Pure, plus two DOM walkers that work in jsdom and in real Chrome, so the vitest
	scan (tests/banned_words.test.js) and a real-browser check share one rule.

	  BANNED_TERMS                  the 2.3 list, in its order, each with its matcher
	  findBanned(text)              [{ term, match, index }]: whole-word, case-insensitive hits
	  SURFACES / scanApplies(id, mode)
	                                which places are scanned in which mode (below)
	  EXEMPT_SELECTOR               '.anyink-pro-word, .anyink-quote': the only two exemptions
	  SCANNED_ATTRIBUTES            title, aria-label, placeholder, alt
	  scanDom(root)                 hits in the visible text and those attributes under root,
	                                shadow roots included, exempt subtrees left out
	  findUppercase(root)           elements whose text shows in capitals (text-transform:
	                                uppercase); 2.2 sentence case bans them in Simple
	  scanTexts(texts, where)       hits in a list of strings (canvas text, toasts, words)
	  formatHit(hit)                one line per hit, for test failures
	  NEVER_SHOWN_TERMS / findNeverShown(text)
	                                B4 + B5 fix pass: what 2.4 E and G say is never shown in
	                                Simple beyond the 2.3 list: Unicode block and letter names
	                                ("Basic Latin", "Latin Small Letter A", "General
	                                Punctuation"), "project" (the work file and the font are
	                                the house words), "JSON" and error codes ("[PF0]", "[SVG1]").
	                                findBanned(text, { strict: true }), scanDom(root, { strict })
	                                and scanTexts(texts, where, { strict }) add them; the vitest
	                                and Chrome scans of Simple run strict (banned_scan.js)

	Matching rules (2.3: every word is banned outright, a scanner can't tell nouns from verbs):
	- whole word, any case, its plural and (B4 + B5 finalize) its -ed and -ing forms: "glyphs",
	  "paths", "items", "bearings", "kerned" and "snapshotted" hit; "pathway", "them" and
	  "Advanced" don't;
	- terms of two words match with a space, a hyphen or nothing between ("x height",
	  "x-height", "xheight"), so upstream's 'X height' label is caught;
	- "em" also after a number ("1em", "0.5em"); "clockwise" with "counter" or "anti" in front;
	  "Bezier" with or without the accent; "WOFF" also as "WOFF2"; "metrics" also as "metric";
	- where terms overlap ("kern group" holds "kern"), only the longest is reported.
	The scan of a words.js entry covers its text, hint and like; an entry marked quote: true is
	an exact label from Windows or Word, or a file name, so its text is exempt (its hint isn't).
	The pro word (entry.pro) is shown only inside .anyink-pro-word and is never scanned.
*/
import { unicodeBlocksBMP } from '../../lib/unicode/unicode_blocks_0_bmp.js';

/**
 * One banned term. `pattern` is a source for a global, case-insensitive RegExp.
 * @param {String} term - as 2.3 writes it
 * @param {String} [pattern] - default: the whole word and its plural
 * @returns {{term: String, pattern: String}}
 */
function banned(term, pattern) {
	return Object.freeze({ term, pattern: pattern || `\\b${term}(?:s|es|ed|ing|ted|ting)?\\b` });
}

/** Two words with a space, a hyphen or nothing between them, and a plural on the last. */
const twoWords = (a, b, plural = 's') => `\\b${a}[-\\s]?${b}(?:${plural})?\\b`;

/** UX-BEGINNER.md 2.3, in its order. */
export const BANNED_TERMS = Object.freeze([
	banned('glyph'),
	banned('character'),
	banned('item'),
	banned('path'),
	banned('subpath'),
	banned('contour'),
	banned('node'),
	banned('Bezier', '\\bb[eé]ziers?\\b'),
	banned('winding'),
	banned('clockwise', '\\b(?:counter[-\\s]?|anti[-\\s]?)?clockwise\\b'),
	banned('counter'),
	// "kerning" is its own term; kern's -ing form is left to it
	banned('kern', '\\bkern(?:s|ed)?\\b'),
	banned('kerning'),
	banned('kern group', twoWords('kern', 'group')),
	banned('bearing'),
	banned('side bearing', twoWords('side', 'bearing')),
	banned('advance'),
	banned('em', '(?:\\b|(?<=\\d))ems?\\b'),
	banned('UPM'),
	banned('ascent'),
	banned('ascender'),
	banned('descent'),
	banned('descender'),
	banned('x-height', twoWords('x', 'height')),
	banned('cap height', twoWords('cap', 'height')),
	banned('baseline'),
	banned('metrics', '\\bmetrics?\\b'),
	banned('component'),
	banned('instance'),
	banned('ligature'),
	banned('Unicode'),
	banned('hex'),
	banned('U+', '\\bU\\+'),
	banned('0x', '\\b0x'),
	banned('code point', twoWords('code', 'point')),
	banned('PANOSE'),
	banned('OpenType', twoWords('open', 'type')),
	banned('TrueType', twoWords('true', 'type')),
	banned('CFF'),
	banned('OTF'),
	banned('TTF'),
	banned('WOFF', '\\bwoff2?\\b'),
	banned('snapshot'),
	banned('upstream'),
	banned('threshold'),
	banned('glyph box', twoWords('glyph', 'box', 'es')),
	banned('bounding box', twoWords('bounding', 'box', 'es')),
	banned('transform'),
	banned('skew'),
	banned('offset path', twoWords('offset', 'path')),
]);

/** A phrase of words, any spacing or hyphen between them, any case: 'Basic Latin'. */
const phrase = (words) =>
	`\\b${words
		.trim()
		.split(/[\s-]+/)
		.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('[-\\s]+')}\\b`;

/**
 * Unicode block names of more than one word (the Basic Multilingual Plane's, the ones a font
 * project enables). One-word names ("Arrows", "Cyrillic") are left out: they are everyday words
 * or a script's name, and "Latin" alone is its own term below.
 */
const BLOCK_NAMES = [
	...new Set(
		unicodeBlocksBMP
			.map(({ name }) => String(name || '').trim())
			.filter((name) => /[\s-]/.test(name) && !/\blatin\b/i.test(name))
	),
];

/**
 * UX-BEGINNER.md 2.4 E and G: never shown in Simple, beyond the 2.3 list (B4 + B5 fix pass).
 * A strict scan adds these; quotes and pro words stay exempt.
 */
export const NEVER_SHOWN_TERMS = Object.freeze([
	// "Basic Latin", "Latin-1 Supplement", "Latin Extended-A", "Latin Small Letter A"
	banned('Latin', '\\blatin\\b'),
	...BLOCK_NAMES.map((name) => banned(name, phrase(name))),
	// The work file and the font are the house words (2.1: "work file", pro word "project file")
	banned('project'),
	banned('JSON'),
	// Upstream's error codes: "[PF0]", "[SVG1]", "[ERR22]"
	banned('error code', '\\[[A-Z]{1,6}\\d{1,3}\\]'),
]);

const MATCHERS = BANNED_TERMS.map(({ term, pattern }) => ({
	term,
	re: new RegExp(pattern, 'giu'),
}));
const NEVER_SHOWN_MATCHERS = NEVER_SHOWN_TERMS.map(({ term, pattern }) => ({
	term,
	re: new RegExp(pattern, 'giu'),
}));

/**
 * Every never-shown term (2.4 E and G) in a piece of text.
 * @param {*} text
 * @returns {Array<{term: String, match: String, index: Number}>} in reading order
 */
export function findNeverShown(text) {
	return findWith(NEVER_SHOWN_MATCHERS, text);
}

/**
 * Every banned term in a piece of text.
 * @param {*} text - anything; non-strings are read as String(text), null as ''
 * @param {{strict?: Boolean}} [options] - strict: the never-shown terms too (2.4 E and G)
 * @returns {Array<{term: String, match: String, index: Number}>} in reading order
 */
export function findBanned(text, { strict = false } = {}) {
	return findWith(strict ? [...MATCHERS, ...NEVER_SHOWN_MATCHERS] : MATCHERS, text);
}

/**
 * @param {Array<{term: String, re: RegExp}>} matchers
 * @param {*} text
 * @returns {Array<{term: String, match: String, index: Number}>}
 */
function findWith(matchers, text) {
	const value = text === null || text === undefined ? '' : String(text);
	if (!value) return [];
	const found = [];
	matchers.forEach(({ term, re }) => {
		re.lastIndex = 0;
		for (const m of value.matchAll(re)) found.push({ term, match: m[0], index: m.index });
	});
	// Overlapping terms ("kern group" holds "kern"): keep the longest at each place
	found.sort((a, b) => a.index - b.index || b.match.length - a.match.length);
	const kept = [];
	found.forEach((hit) => {
		const inside = kept.some(
			(k) => hit.index >= k.index && hit.index + hit.match.length <= k.index + k.match.length
		);
		if (!inside) kept.push(hit);
	});
	return kept;
}

// --------------------------------------------------------------
// Where the ban applies
// --------------------------------------------------------------

/** The two exemptions (2.3), marked in the markup. */
export const PRO_WORD_CLASS = 'anyink-pro-word';
export const QUOTE_CLASS = 'anyink-quote';
export const EXEMPT_SELECTOR = `.${PRO_WORD_CLASS}, .${QUOTE_CLASS}`;

/** Attributes that put words on screen besides the text itself. */
export const SCANNED_ATTRIBUTES = Object.freeze(['title', 'aria-label', 'placeholder', 'alt']);

/** Elements whose text never shows. */
const NEVER_SHOWN = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/**
 * The places the scan reads, and the modes it reads them in (2.2, 2.3). Simple: all of them.
 * All tools (More tools) keeps Glyphr Studio's own wording, except at the display points it
 * shares with Simple, which always use the house word: the canvas text, the File menu, the
 * save status, the strip's labels and the app notices. Toasts: in Simple every toast is a
 * words.js key and an upstream message with no mapping isn't shown; in All tools a mapped
 * upstream message shows in house words and an unmapped one keeps Glyphr's wording, so the
 * toast scan runs in Simple only.
 */
export const SURFACES = Object.freeze({
	words: Object.freeze({ simple: true, all: true, what: 'every words.js entry' }),
	screen: Object.freeze({
		simple: true,
		all: false,
		what: 'visible text, title, aria-label, placeholder and alt of every Simple screen state',
	}),
	canvas: Object.freeze({
		simple: true,
		all: true,
		what: 'canvas text: guide labels, drag readouts, handle labels (fillText / strokeText)',
	}),
	fileMenu: Object.freeze({ simple: true, all: true, what: 'the File menu rows' }),
	saveStatus: Object.freeze({ simple: true, all: true, what: 'the save status text' }),
	strip: Object.freeze({ simple: true, all: true, what: "the preview strip's labels" }),
	notices: Object.freeze({ simple: true, all: true, what: 'the app notices (install, update)' }),
	toast: Object.freeze({ simple: true, all: false, what: 'every toast message' }),
});

/**
 * @param {String} surface - a SURFACES key
 * @param {'all' | 'simple'} mode
 * @returns {Boolean} true when the ban covers that place in that mode
 */
export function scanApplies(surface, mode) {
	const rule = SURFACES[surface];
	if (!rule) return false;
	return mode === 'simple' ? rule.simple : rule.all;
}

// --------------------------------------------------------------
// Scanning
// --------------------------------------------------------------

/**
 * @typedef {Object} BannedHit
 * @property {String} term - the 2.3 term
 * @property {String} match - the words as written
 * @property {String} where - 'text', 'title', 'aria-label', 'canvas', 'toast', 'word:<key>', ...
 * @property {String} text - the string it was found in
 * @property {String} [path] - for DOM hits, where the element sits
 */

/**
 * Hits in a list of strings.
 * @param {Iterable<*>} texts
 * @param {String} where - what the strings are ('canvas', 'toast')
 * @param {{strict?: Boolean}} [options] - strict: the never-shown terms too (2.4 E and G)
 * @returns {Array<BannedHit>} each string's hits once, however often it was drawn
 */
export function scanTexts(texts, where, { strict = false } = {}) {
	const hits = [];
	new Set([...(texts || [])].map((t) => collapse(t))).forEach((text) => {
		findBanned(text, { strict }).forEach(({ term, match }) =>
			hits.push({ term, match, where, text })
		);
	});
	return hits;
}

/**
 * Hits in the visible text and the scanned attributes of everything under root.
 * @param {Element | Document | ShadowRoot | DocumentFragment} root
 * @param {{strict?: Boolean}} [options] - strict: the never-shown terms too (2.4 E and G)
 * @returns {Array<BannedHit>}
 */
export function scanDom(root, { strict = false } = {}) {
	const hits = [];
	walk(root, (node, element) => {
		if (node.nodeType === 3) {
			addHits(hits, collapse(node.nodeValue), 'text', element, strict);
			return;
		}
		SCANNED_ATTRIBUTES.forEach((name) => {
			if (node.hasAttribute(name)) {
				addHits(hits, collapse(node.getAttribute(name)), name, node, strict);
			}
		});
	});
	return hits;
}

/**
 * Elements with text of their own that shows in capitals (2.2: sentence case everywhere).
 * Real browsers inherit text-transform in getComputedStyle; jsdom doesn't, so the walk
 * carries it down itself.
 * @param {Element | Document | ShadowRoot | DocumentFragment} root
 * @returns {Array<BannedHit>}
 */
export function findUppercase(root) {
	const hits = [];
	const transforms = new Map();
	walk(root, (node, element) => {
		if (node.nodeType === 1) {
			transforms.set(node, ownTransform(node, transforms.get(parentOf(node))));
			return;
		}
		const text = collapse(node.nodeValue);
		if (!text || !/\p{Ll}/u.test(text)) return;
		if (transforms.get(element) === 'uppercase') {
			hits.push({
				term: 'uppercase',
				match: text,
				where: 'text-transform',
				text,
				path: pathOf(element),
			});
		}
	});
	return hits;
}

/**
 * @param {BannedHit} hit
 * @returns {String} 'canvas: "baseline" in "baseline 0"'
 */
export function formatHit(hit) {
	const at = hit.path ? ` at ${hit.path}` : '';
	return `${hit.where}: "${hit.match}" (${hit.term}) in "${hit.text}"${at}`;
}

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

/**
 * Visits every shown element and text node under root, shadow roots included.
 * @param {Node} root
 * @param {(node: Node, element: Element | null) => void} visit - element: the text's parent
 */
function walk(root, visit) {
	if (!root) return;
	const start = root.nodeType === 9 ? root.documentElement : root;
	const visitNode = (node, parentElement) => {
		if (node.nodeType === 3) {
			visit(node, parentElement);
			return;
		}
		if (node.nodeType === 1) {
			if (isExempt(node) || isHidden(node)) return;
			visit(node, parentElement);
			if (node.shadowRoot) node.shadowRoot.childNodes.forEach((child) => visitNode(child, node));
			node.childNodes.forEach((child) => visitNode(child, node));
			return;
		}
		if (node.nodeType === 11) node.childNodes.forEach((child) => visitNode(child, parentElement));
	};
	visitNode(start, start?.nodeType === 1 ? parentOf(start) : null);
}

function isExempt(element) {
	return typeof element.matches === 'function' && element.matches(EXEMPT_SELECTOR);
}

/**
 * @param {Element} element
 * @returns {Boolean} true when the element and everything in it is not shown
 */
function isHidden(element) {
	if (NEVER_SHOWN.has(element.tagName)) return true;
	if (element.hidden) return true;
	// A closed dialog is hidden unless a style shows it (upstream's menus are dialogs shown with
	// an inline display: grid, never opened)
	if (element.tagName === 'DIALOG' && !element.open && !element.style?.display) return true;
	const style = computed(element);
	if (!style) return false;
	return (
		style.display === 'none' ||
		style.visibility === 'hidden' ||
		style.contentVisibility === 'hidden'
	);
}

function computed(element) {
	try {
		return element.ownerDocument?.defaultView?.getComputedStyle(element) || null;
	} catch {
		return null;
	}
}

/**
 * @param {Element} element
 * @param {String} [inherited] - the parent's transform
 * @returns {String} 'uppercase', 'none', ...
 */
function ownTransform(element, inherited = 'none') {
	const value = computed(element)?.textTransform || '';
	if (!value || value === 'inherit') return inherited;
	return value;
}

/** The element above, across a shadow root's edge. */
function parentOf(node) {
	if (node.parentElement) return node.parentElement;
	const parent = node.parentNode;
	return parent?.nodeType === 11 ? parent.host || null : null;
}

function addHits(hits, text, where, element, strict = false) {
	findBanned(text, { strict }).forEach(({ term, match }) =>
		hits.push({ term, match, where, text, path: pathOf(element) })
	);
}

/**
 * @param {Element | null} element
 * @returns {String} 'preview-strip > button.preview-strip__toggle'
 */
function pathOf(element) {
	const parts = [];
	let node = element;
	while (node && node.nodeType === 1 && parts.length < 4) {
		const id = node.id ? `#${node.id}` : '';
		const cls =
			!id && node.classList?.length ? `.${[...node.classList].slice(0, 2).join('.')}` : '';
		parts.unshift(`${node.tagName.toLowerCase()}${id}${cls}`);
		node = parentOf(node);
	}
	return parts.join(' > ');
}

/** Whitespace collapsed to single spaces, trimmed. */
function collapse(text) {
	return String(text ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}
