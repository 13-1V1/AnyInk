// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 fix pass: an app notice (Install, ready offline) first sat 80 px up from the bottom of the
// window, over the canvas zoom bar and the preview strip; moved above the strip, it then covered
// letter tiles on Overview and buttons on Settings. Until B6 decides where notices live, a notice
// is one line in the top bar's empty middle, just left of the save status, where it covers
// nothing on any page (the start page has no top bar, and its top is empty). Toasts still show
// over it while they last. tests/notices.verify.mjs checks the same thing with real boxes in
// Chrome on every page.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTICE_GAP, placeNotices } from '../notice_place.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const PWA_CSS = strip(read('../pwa.css'));
const APP_CSS = strip(read('../../../app/app.css'));
const DIALOGS_CSS = strip(read('../../../controls/dialogs/dialogs.css'));

const rule = (css, selector) => {
	const escaped = selector.replace(/[#.]/g, '\\$&');
	const match = css.match(new RegExp(`(?:^|[}\\s,])${escaped}\\s*\\{([^}]*)\\}`));
	if (!match) throw new Error(`no rule for ${selector}`);
	return match[1];
};
const value = (body, property) =>
	body.match(new RegExp(`(?:^|[\\s;])${property}:\\s*([^;]+);`))?.[1].trim();
const px = (text) => Number(String(text).match(/(-?[\d.]+)px/)?.[1]);

describe('where app notices sit (CSS)', () => {
	const box = rule(PWA_CSS, '#anyink-pwa-notices');
	const panel = rule(PWA_CSS, '.anyink-pwa-notice');
	const topBar = rule(APP_CSS, '#app__top-bar');
	const rows = value(rule(APP_CSS, '#app__wrapper'), 'grid-template-rows');

	it('stays fixed at the top, inside the top bar', () => {
		expect(value(box, 'position')).toBe('fixed');
		const barHeight = px(rows); // the first grid row: the top bar
		expect(barHeight).toBe(40);
		const top = px(value(box, 'top'));
		const height = px(value(panel, 'height'));
		expect(top).toBeGreaterThanOrEqual(0);
		expect(top + height).toBeLessThanOrEqual(barHeight);
	});

	it('is one line: the sentence shortens, the buttons never wrap', () => {
		const text = rule(PWA_CSS, '.anyink-pwa-notice p');
		expect(value(text, 'white-space')).toBe('nowrap');
		expect(value(text, 'text-overflow')).toBe('ellipsis');
		expect(value(rule(PWA_CSS, '.anyink-pwa-notice button'), 'white-space')).toBe('nowrap');
	});

	it('is drawn over the top bar but under toasts, which still show while they last', () => {
		const z = Number(value(box, 'z-index'));
		expect(z).toBeGreaterThan(Number(value(topBar, 'z-index').replace('!important', '')));
		const toast = DIALOGS_CSS.match(/#toast,\s*#error\s*\{([^}]*)\}/)[1];
		expect(z).toBeLessThan(Number(value(toast, 'z-index')));
	});

	it('takes its right edge and its room from placeNotices, with safe fallbacks', () => {
		expect(value(box, 'right')).toMatch(/^var\(--anyink-notice-right,\s*\d+px\)$/);
		expect(value(box, 'max-width')).toMatch(/^var\(--anyink-notice-room,/);
	});
});

describe('placeNotices', () => {
	let container;
	const rect =
		(left, right, top = 8, bottom = 32) =>
		() => ({
			left,
			right,
			top,
			bottom,
			width: right - left,
			height: bottom - top,
		});

	beforeEach(() => {
		document.body.innerHTML = '';
		container = document.createElement('aside');
		document.body.append(container);
	});
	afterEach(() => {
		document.body.innerHTML = '';
	});

	/** A top bar like menu.js makeAppTopBar's, with boxes as Chrome lays it out at this width. */
	function topBar({ menusRight = 311, statusLeft = 1350 } = {}) {
		const bar = document.createElement('div');
		bar.id = 'app__top-bar';
		const menus = document.createElement('div');
		menus.className = 'top-bar__menus';
		menus.getBoundingClientRect = rect(161, menusRight);
		const status = document.createElement('anyink-save-status');
		status.getBoundingClientRect = rect(statusLeft, 1589);
		bar.append(menus, status);
		document.body.prepend(bar);
	}

	const vars = () => ({
		right: container.style.getPropertyValue('--anyink-notice-right'),
		room: container.style.getPropertyValue('--anyink-notice-room'),
	});

	it('sits just left of the save status, with room back to the menus', () => {
		topBar();
		placeNotices(container, document, { innerWidth: 1600 });
		expect(vars()).toEqual({
			right: `${1600 - 1350 + NOTICE_GAP}px`,
			room: `${1350 - NOTICE_GAP - (311 + NOTICE_GAP)}px`,
		});
	});

	it('follows a longer save status ("Recovery copy saved · File changes pending")', () => {
		topBar({ statusLeft: 1100 });
		placeNotices(container, document, { innerWidth: 1600 });
		expect(vars().right).toBe(`${1600 - 1100 + NOTICE_GAP}px`);
	});

	it('on the start page (no top bar) it takes the empty top right corner', () => {
		placeNotices(container, document, { innerWidth: 1600 });
		expect(vars()).toEqual({ right: '', room: '' });
	});

	it('never gets less room than one short line', () => {
		topBar({ menusRight: 311, statusLeft: 400 });
		placeNotices(container, document, { innerWidth: 1024 });
		expect(parseInt(vars().room, 10)).toBeGreaterThanOrEqual(160);
	});

	// B6 + B7 integration (topbar track's hand-off): Simple's top bar (B6) has no menus, and
	// just left of its status pill sit Undo and Redo. Its flexible gap between the rail and Undo
	// is marked data-anyink-slot="notices": a notice sits inside it and covers no control.
	/** Simple's top bar: the rail ends at 520, the gap runs to 980, Undo starts at 980 */
	function simpleBar({ slotLeft = 520, slotRight = 980 } = {}) {
		const bar = document.createElement('header');
		bar.id = 'app__top-bar';
		const slot = document.createElement('span');
		slot.dataset.anyinkSlot = 'notices';
		slot.getBoundingClientRect = rect(slotLeft, slotRight, 6, 46);
		const undo = document.createElement('button');
		undo.getBoundingClientRect = rect(slotRight, slotRight + 70, 6, 46);
		const status = document.createElement('anyink-save-status');
		status.getBoundingClientRect = rect(1150, 1240, 6, 46);
		bar.append(slot, undo, status);
		document.body.prepend(bar);
	}

	it('Simple (B6): inside the gap between the rail and Undo, centered on the row', () => {
		simpleBar();
		placeNotices(container, document, { innerWidth: 1280 });
		expect(vars()).toEqual({
			right: `${1280 - 980 + NOTICE_GAP}px`,
			room: `${980 - 520 - 2 * NOTICE_GAP}px`,
		});
		// the 32 px notice in the middle of the 40 px row
		expect(container.style.getPropertyValue('--anyink-notice-top')).toBe(`${6 + (40 - 32) / 2}px`);
	});

	it('Simple: a narrow gap still never puts the notice over Undo', () => {
		simpleBar({ slotLeft: 900, slotRight: 980 });
		placeNotices(container, document, { innerWidth: 1280 });
		// B16 final: too narrow for a notice, it goes under the bar, off Undo's row
		const top = parseInt(container.style.getPropertyValue('--anyink-notice-top'), 10);
		expect(top).toBeGreaterThanOrEqual(46);
	});

	// B16 final (the board track: with every step's words kept at 1280, the gap can be 83 px; a
	// notice is never narrower than 160 px, so it would cover "3 Use in Word"). Written to fail
	// first: the notice stayed in the gap, its left end over the rail.
	it('Simple: a gap too narrow for a notice puts it under the bar and the Next line, at the right', () => {
		simpleBar({ slotLeft: 897, slotRight: 980 });
		const coach = document.createElement('anyink-coach');
		coach.getBoundingClientRect = rect(0, 1280, 46, 84);
		document.body.append(coach);
		placeNotices(container, document, { innerWidth: 1280 });
		const top = parseInt(container.style.getPropertyValue('--anyink-notice-top'), 10);
		expect(top).toBeGreaterThanOrEqual(84);
		expect(vars().right).toBe(`${NOTICE_GAP}px`);
		coach.remove();
	});

	it('All tools after Simple: the top is the CSS fallback again', () => {
		simpleBar();
		placeNotices(container, document, { innerWidth: 1280 });
		document.querySelector('#app__top-bar').remove();
		topBar();
		placeNotices(container, document, { innerWidth: 1600 });
		expect(container.style.getPropertyValue('--anyink-notice-top')).toBe('');
	});
});
