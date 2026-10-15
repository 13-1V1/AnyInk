// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 4.11 "More tools band", 6.1, 6.3): the purple band under the top bar and the
// hidden-page landing rule.
//   - More tools (All tools reached from Simple): "More tools: every Glyphr Studio tool is
//     showing, with Glyphr Studio's own words. [Back to simple]".
//   - Landing on a page Simple hides (an undo of a More tools change, a link row, an import) is
//     never blocked: the page renders, More tools turns on for that visit, and the band reads
//     "Undo took you to one of the More tools pages. [Back to my letters]".
//   - All tools as the launch default (until B16) shows no band: the app looks as it does today.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flagsOn } from '../features.js';
import { getMode, getVisit, setMode, setModeForTests } from '../mode.js';
import { PAGE_EVENT } from '../switch.js';
import {
	BAND_CLASS,
	arriveAt,
	backToSimple,
	bandState,
	makeBand,
	turnOnMoreTools,
	withLandingCause,
} from '../band.js';
import { scanDom } from '../../words/banned.js';
import { word } from '../../words/words.js';
import { shownIds } from '../visibility.js';

const NO_FLAGS = flagsOn();
const fakeEditor = (page = 'Characters') => ({ nav: { page }, navigate: vi.fn() });
const HIDDEN_PAGES = [
	'Ligatures',
	'Components',
	'Kerning',
	'Live preview',
	'Global actions',
	'Settings',
	'Import & export',
];

beforeEach(() => {
	document.body.innerHTML = '';
	window.dispatchEvent(
		new CustomEvent(PAGE_EVENT, { detail: { page: 'Characters', appLevel: false } })
	);
});
afterEach(() => setModeForTests('all'));

describe('bandState', () => {
	it('no band in Simple', () => {
		setModeForTests('simple');
		expect(bandState()).toBe(null);
	});

	it('no band at an All tools launch (until B16 the app opens as it does today)', () => {
		expect(getMode()).toBe('all');
		expect(bandState()).toBe(null);
	});

	it('More tools reached from Simple: the More tools band with [Back to simple]', () => {
		setMode('simple');
		setMode('all');
		expect(bandState()).toEqual({
			kind: 'moreTools',
			textKey: 'mode.band.moreTools',
			buttonKey: 'mode.band.backToSimple',
		});
		expect(word('mode.band.moreTools')).toBe(
			"More tools: every Glyphr Studio tool is showing, with Glyphr Studio's own words."
		);
		expect(word('mode.band.backToSimple')).toBe('Back to simple');
	});

	it('a visit: the landing band with [Back to my letters], in words for what took him there', () => {
		setMode('simple');
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		expect(bandState()).toEqual({
			kind: 'landed',
			textKey: 'mode.band.landedUndo',
			buttonKey: 'mode.band.backToLetters',
		});
		expect(word('mode.band.landedUndo')).toBe('Undo took you to one of the More tools pages.');
		expect(word('mode.band.backToLetters')).toBe('Back to my letters');
		setMode('all', { visit: { page: 'Kerning', cause: 'other' } });
		expect(bandState().textKey).toBe('mode.band.landed');
		expect(word('mode.band.landed')).toBe('This is one of the More tools pages.');
	});
});

describe('makeBand', () => {
	it('is nothing when there is no band', () => {
		expect(makeBand()).toBe(null);
	});

	it('draws the sentence and one outlined button that goes back', () => {
		setMode('simple');
		setMode('all');
		const onBack = vi.fn();
		const band = makeBand({ onBack });
		document.body.appendChild(band);
		expect(band.classList.contains(BAND_CLASS)).toBe(true);
		expect(band.dataset.anyinkBand).toBe('moreTools');
		expect(band.getAttribute('role')).toBe('region');
		expect(band.getAttribute('aria-label')).toBe(word('term.moreTools'));
		expect(band.querySelector(`.${BAND_CLASS}__text`).textContent).toBe(
			word('mode.band.moreTools')
		);
		const buttons = band.querySelectorAll('button');
		expect(buttons.length).toBe(1);
		expect(buttons[0].textContent).toBe('Back to simple');
		expect(buttons[0].type).toBe('button');
		// principle 1: the one green button belongs to the screen, never to the band
		expect(band.querySelector('.anyink-primary')).toBe(null);
		buttons[0].click();
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('the landing band says where he is and offers his letters', () => {
		setMode('simple');
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		const band = makeBand({ onBack: () => {} });
		expect(band.dataset.anyinkBand).toBe('landed');
		expect(band.textContent).toBe(
			'Undo took you to one of the More tools pages.Back to my letters'
		);
	});

	it('says no banned word (2.3)', () => {
		setMode('simple');
		setMode('all');
		document.body.appendChild(makeBand());
		setModeForTests('simple');
		setMode('all', { visit: { page: 'Kerning', cause: 'undo' } });
		document.body.appendChild(makeBand());
		expect(scanDom(document.body)).toEqual([]);
	});

	it('its button goes back to Simple by default', () => {
		setMode('simple');
		setMode('all');
		const editor = fakeEditor('Characters');
		makeBand({ editor }).querySelector('button').click();
		expect(getMode()).toBe('simple');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});
});

describe('the landing rule (arriveAt, run on every navigate before the page is drawn)', () => {
	it('Simple arriving on any page Simple hides: More tools turns on for that visit', () => {
		HIDDEN_PAGES.forEach((page) => {
			setModeForTests('simple');
			expect(arriveAt(page, { isOn: NO_FLAGS }), page).toBe('landed');
			expect(getMode(), page).toBe('all');
			expect(getVisit(), page).toEqual({ page, cause: 'other' });
			expect(bandState()?.kind, page).toBe('landed');
		});
	});

	it('Simple arriving on a page it shows: nothing changes', () => {
		shownIds('page', { mode: 'simple', isOn: NO_FLAGS }).forEach((page) => {
			setModeForTests('simple');
			expect(arriveAt(page, { isOn: NO_FLAGS }), page).toBe('stayed');
			expect(getMode(), page).toBe('simple');
		});
	});

	it('All tools at launch: never a visit, never a band (today’s app)', () => {
		HIDDEN_PAGES.forEach((page) => expect(arriveAt(page, { isOn: NO_FLAGS }), page).toBe('stayed'));
		expect(getVisit()).toBe(null);
		expect(bandState()).toBe(null);
	});

	it('More tools chosen on purpose stays on when he goes to a page Simple shows', () => {
		setMode('simple');
		setMode('all');
		expect(arriveAt('Characters', { isOn: NO_FLAGS })).toBe('stayed');
		expect(getMode()).toBe('all');
		expect(bandState().kind).toBe('moreTools');
	});

	it('a visit ends when he arrives back on a page Simple shows: Simple comes back', () => {
		setModeForTests('simple');
		arriveAt('Kerning', { isOn: NO_FLAGS });
		expect(arriveAt('Characters', { isOn: NO_FLAGS })).toBe('returned');
		expect(getMode()).toBe('simple');
		expect(getVisit()).toBe(null);
	});

	it('a visit carries on across hidden pages, keeping what started it', () => {
		setModeForTests('simple');
		withLandingCause('undo', () => arriveAt('Kerning', { isOn: NO_FLAGS }));
		expect(arriveAt('Ligatures', { isOn: NO_FLAGS })).toBe('stayed');
		expect(getVisit()).toEqual({ page: 'Ligatures', cause: 'undo' });
		expect(getMode()).toBe('all');
	});

	it('withLandingCause names what took him there, and only while it runs', () => {
		setModeForTests('simple');
		expect(withLandingCause('undo', () => arriveAt('Kerning', { isOn: NO_FLAGS }))).toBe('landed');
		expect(getVisit().cause).toBe('undo');
		setModeForTests('simple');
		arriveAt('Kerning', { isOn: NO_FLAGS });
		expect(getVisit().cause).toBe('other');
		setModeForTests('simple');
		expect(() =>
			withLandingCause('undo', () => {
				throw new Error('boom');
			})
		).toThrow('boom');
		arriveAt('Kerning', { isOn: NO_FLAGS });
		expect(getVisit().cause).toBe('other');
	});

	it('an explicit cause wins', () => {
		setModeForTests('simple');
		withLandingCause('undo', () => arriveAt('Kerning', { isOn: NO_FLAGS, cause: 'link' }));
		expect(getVisit().cause).toBe('link');
	});
});

describe('back and forth', () => {
	it('Back to my letters (a visit): Simple, on its home page', () => {
		setModeForTests('simple');
		arriveAt('Kerning', { isOn: NO_FLAGS });
		const editor = fakeEditor('Kerning');
		backToSimple({ editor, isOn: NO_FLAGS });
		expect(getMode()).toBe('simple');
		expect(getVisit()).toBe(null);
		expect(editor.nav.page).toBe('Characters');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
		expect(bandState()).toBe(null);
	});

	it('Back to my letters goes to the board once it lands', () => {
		setModeForTests('simple');
		arriveAt('Settings', { isOn: NO_FLAGS });
		const editor = fakeEditor('Settings');
		backToSimple({ editor, isOn: flagsOn('board') });
		expect(editor.nav.page).toBe('Overview');
	});

	it('Back to simple (More tools on purpose): stays on a page Simple shows', () => {
		setMode('simple');
		setMode('all');
		const editor = fakeEditor('Help');
		backToSimple({ editor, isOn: NO_FLAGS });
		expect(getMode()).toBe('simple');
		expect(editor.nav.page).toBe('Help');
	});

	it('turnOnMoreTools: All tools with the More tools band, same page', () => {
		setMode('simple');
		const editor = fakeEditor('Characters');
		turnOnMoreTools({ editor });
		expect(getMode()).toBe('all');
		expect(bandState().kind).toBe('moreTools');
		expect(editor.nav.page).toBe('Characters');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});
});
