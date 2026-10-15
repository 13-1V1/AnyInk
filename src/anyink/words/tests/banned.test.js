// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: the banned-word matcher (UX-BEGINNER.md 2.3) and its DOM walkers. Whole word, any case,
// plurals; two-word terms with a space or a hyphen; only the two marked exemptions.
import { afterEach, describe, expect, it } from 'vitest';
import {
	BANNED_TERMS,
	EXEMPT_SELECTOR,
	SURFACES,
	findBanned,
	findUppercase,
	formatHit,
	scanApplies,
	scanDom,
	scanTexts,
} from '../banned.js';

const terms = (text) => findBanned(text).map((hit) => hit.term);

afterEach(() => {
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-test]').forEach((s) => s.remove());
});

describe('BANNED_TERMS', () => {
	it('is the 2.3 list, in its order', () => {
		// prettier-ignore
		expect(BANNED_TERMS.map((t) => t.term)).toEqual([
			'glyph', 'character', 'item', 'path', 'subpath', 'contour', 'node', 'Bezier', 'winding',
			'clockwise', 'counter', 'kern', 'kerning', 'kern group', 'bearing', 'side bearing',
			'advance', 'em', 'UPM', 'ascent', 'ascender', 'descent', 'descender', 'x-height',
			'cap height', 'baseline', 'metrics', 'component', 'instance', 'ligature', 'Unicode', 'hex',
			'U+', '0x', 'code point', 'PANOSE', 'OpenType', 'TrueType', 'CFF', 'OTF', 'TTF', 'WOFF',
			'snapshot', 'upstream', 'threshold', 'glyph box', 'bounding box', 'transform', 'skew',
			'offset path',
		]);
	});

	it('every term finds itself', () => {
		BANNED_TERMS.forEach(({ term }) => {
			const sample = term === 'U+' ? 'U+0041' : term === '0x' ? '0x41' : term;
			expect(terms(`see ${sample} here`), term).toEqual([term]);
		});
	});
});

describe('findBanned', () => {
	it('matches whole words in any case, with plurals', () => {
		expect(terms('Glyph')).toEqual(['glyph']);
		expect(terms('GLYPHS and paths')).toEqual(['glyph', 'path']);
		expect(terms('3 items')).toEqual(['item']);
		expect(terms('both bearings')).toEqual(['bearing']);
		expect(terms('hexes')).toEqual(['hex']);
	});

	it('leaves words that only contain a banned word alone', () => {
		expect(terms('a pathway')).toEqual([]);
		expect(terms('them')).toEqual([]);
		expect(terms('Advanced')).toEqual([]);
		expect(terms('emphasis and gems')).toEqual([]);
		expect(terms('the writing line')).toEqual([]);
		expect(terms('1600x900')).toEqual([]);
		expect(terms('you+me')).toEqual([]);
	});

	it("catches upstream's spellings of two-word terms", () => {
		expect(terms('X height')).toEqual(['x-height']);
		expect(terms('x-height 1100')).toEqual(['x-height']);
		expect(terms('Cap height')).toEqual(['cap height']);
		expect(terms('capheight')).toEqual(['cap height']);
		expect(terms('Code points')).toEqual(['code point']);
	});

	it('reports only the longest of overlapping terms', () => {
		expect(terms('Nudged kern group kern-3')).toEqual(['kern group', 'kern']);
		expect(terms('Left side bearing: 40')).toEqual(['side bearing']);
		expect(terms('Counter-clockwise')).toEqual(['clockwise']);
		expect(terms('Only inside the glyph box')).toEqual(['glyph box']);
		expect(terms('Offset path for 2 shapes')).toEqual(['offset path']);
	});

	it('knows the special spellings', () => {
		expect(terms('Skew 2 shapes by 1em')).toEqual(['skew', 'em']);
		expect(terms('0.5em')).toEqual(['em']);
		expect(terms('Bézier curve')).toEqual(['Bezier']);
		expect(terms('Export WOFF2 file')).toEqual(['WOFF']);
		expect(terms('one metric')).toEqual(['metrics']);
		expect(terms('anticlockwise')).toEqual(['clockwise']);
		expect(terms('U+0041')).toEqual(['U+']);
		expect(terms('0x41')).toEqual(['0x']);
		expect(terms('Open Type')).toEqual(['OpenType']);
		expect(terms('BrennanHand-Test1.otf')).toEqual(['OTF']);
	});

	it('returns hits in reading order with the words as written', () => {
		expect(findBanned('Moved Baseline, then the ascender')).toEqual([
			{ term: 'baseline', match: 'Baseline', index: 6 },
			{ term: 'ascender', match: 'ascender', index: 25 },
		]);
	});

	it('reads anything as text', () => {
		expect(findBanned(null)).toEqual([]);
		expect(findBanned(undefined)).toEqual([]);
		expect(findBanned(42)).toEqual([]);
	});
});

describe('scanTexts', () => {
	it('names where each hit came from, once per string', () => {
		const hits = scanTexts(['Baseline', 'Baseline', 'writing line'], 'canvas');
		expect(hits).toEqual([{ term: 'baseline', match: 'Baseline', where: 'canvas', text: 'Baseline' }]);
		expect(formatHit(hits[0])).toBe('canvas: "Baseline" (baseline) in "Baseline"');
	});
});

describe('scanDom', () => {
	it('reads visible text, title, aria-label, placeholder and alt', () => {
		document.body.innerHTML = `
			<div title="Glyph name">
				<button aria-label="Next item">Next</button>
				<input placeholder="Sample text with kerning" />
				<img alt="A bounding box" />
				<p>Pick a path</p>
			</div>`;
		const hits = scanDom(document.body);
		expect(hits.map((h) => `${h.where}:${h.term}`)).toEqual([
			'title:glyph',
			'aria-label:item',
			'placeholder:kerning',
			'alt:bounding box',
			'text:path',
		]);
		expect(hits[4].path).toBe('html > body > div > p');
	});

	it('skips the two exemptions and everything inside them', () => {
		document.body.innerHTML = `
			<p>writing line <span class="anyink-pro-word">(pro word: <b>baseline</b>)</span></p>
			<p>In Word, tick <span class="anyink-quote">"Kerning for fonts"</span></p>
			<p class="anyink-quote" title="glyph">BrennanHand-Test1.otf</p>`;
		expect(scanDom(document.body)).toEqual([]);
		expect(EXEMPT_SELECTOR).toBe('.anyink-pro-word, .anyink-quote');
	});

	it('skips what is not shown', () => {
		document.body.innerHTML = `
			<p hidden>glyph</p>
			<p style="display: none">path</p>
			<p style="visibility: hidden">node</p>
			<script>const glyph = 1;</script>
			<style>.glyph { color: red; }</style>
			<template><p>glyph</p></template>
			<dialog><p>glyph</p></dialog>
			<p>letter</p>`;
		expect(scanDom(document.body)).toEqual([]);
	});

	it("reads a menu dialog that a style shows without opening it (upstream's menus)", () => {
		document.body.innerHTML = '<dialog style="display: grid"><span>Export OTF file</span></dialog>';
		expect(scanDom(document.body).map((h) => h.term)).toEqual(['OTF']);
	});

	it('looks inside shadow roots', () => {
		const host = document.createElement('div');
		host.attachShadow({ mode: 'open' }).innerHTML = '<span title="Kern">x</span><em>Components</em>';
		document.body.appendChild(host);
		expect(scanDom(document.body).map((h) => `${h.where}:${h.term}`)).toEqual([
			'title:kern',
			'text:component',
		]);
	});

	it('takes a document, an element or a fragment', () => {
		document.body.innerHTML = '<p>Unicode</p>';
		expect(scanDom(document)).toHaveLength(1);
		expect(scanDom(document.body.firstElementChild)).toHaveLength(1);
		const fragment = document.createDocumentFragment();
		fragment.append('Snapshot saved');
		expect(scanDom(fragment).map((h) => h.term)).toEqual(['snapshot']);
		expect(scanDom(null)).toEqual([]);
	});
});

describe('findUppercase', () => {
	function css(text) {
		const style = document.createElement('style');
		style.dataset.test = '';
		style.textContent = text;
		document.head.appendChild(style);
	}

	it('finds text shown in capitals, set on the element or above it', () => {
		css('.eyebrow { text-transform: uppercase; } .keep { text-transform: none; }');
		document.body.innerHTML = `
			<h2 class="eyebrow">Preview</h2>
			<div class="eyebrow"><span>Photo of your small r</span><span class="keep">small r</span></div>
			<p>Sentence case</p>`;
		const hits = findUppercase(document.body);
		expect(hits.map((h) => h.text)).toEqual(['Preview', 'Photo of your small r']);
		expect(hits[0].where).toBe('text-transform');
	});

	it('ignores text with nothing to capitalize, and hidden or exempt text', () => {
		css('.caps { text-transform: uppercase; }');
		document.body.innerHTML = `
			<p class="caps">OK 12</p>
			<p class="caps" hidden>hidden</p>
			<p class="caps anyink-quote">"Show more options"</p>`;
		expect(findUppercase(document.body)).toEqual([]);
	});
});

describe('where the ban applies', () => {
	it('reads every surface in Simple', () => {
		Object.keys(SURFACES).forEach((id) => expect(scanApplies(id, 'simple'), id).toBe(true));
	});

	it("reads only the display points All tools shares with Simple, in All tools", () => {
		const shared = Object.keys(SURFACES).filter((id) => scanApplies(id, 'all'));
		expect(shared).toEqual(['words', 'canvas', 'fileMenu', 'saveStatus', 'strip', 'notices']);
	});

	it('knows no other surfaces', () => {
		expect(scanApplies('dialogs', 'simple')).toBe(false);
	});
});

// B4 + B5 finalize (toast track's verdict: "snapshotted" slipped past the plural-only scan): a
// banned word's -ed and -ing forms are the word too ("snapshotted", "kerned", "transforming").
// A word that merely ends like one ("Advanced") still isn't.
describe('findBanned: -ed and -ing forms', () => {
	it('catches the verb forms', () => {
		expect(terms('snapshotted')).toEqual(['snapshot']);
		expect(terms('Snapshotting your work')).toEqual(['snapshot']);
		expect(terms('kerned pairs')).toEqual(['kern']);
		expect(terms('transforming')).toEqual(['transform']);
		expect(terms('skewed')).toEqual(['skew']);
	});

	it('leaves look-alikes alone', () => {
		expect(terms('Advanced')).toEqual([]);
		expect(terms('itemize')).toEqual([]);
		expect(terms('pathetic')).toEqual([]);
	});
});
