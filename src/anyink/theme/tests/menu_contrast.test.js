// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 3 (UX-BEGINNER 7.1 #6): File menu and Presets menu rows were black text on dark grey
// because the menu is a <dialog> and the browser gives dialogs black text. These checks compute
// WCAG contrast straight from the token values in tokens.css and check that the menu CSS uses them.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const TOKENS_CSS = read('../tokens.css');
const MENU_CSS = read('../../../controls/dialogs/dialogs.css');

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Custom properties declared in the first plain `:root {` block (the chrome tokens). */
function rootTokens(css) {
	const body = stripComments(css).match(/:root\s*\{([^}]*)\}/)[1];
	const tokens = {};
	for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))
		tokens[name] = value.trim();
	return tokens;
}

const TOKENS = rootTokens(TOKENS_CSS);

function resolve(name, seen = new Set()) {
	if (seen.has(name)) throw new Error(`token loop at ${name}`);
	seen.add(name);
	const value = TOKENS[name];
	if (value === undefined) throw new Error(`missing token ${name}`);
	const ref = value.match(/^var\((--[\w-]+)\)$/);
	return ref ? resolve(ref[1], seen) : value;
}

/** @returns {{ r: number, g: number, b: number, a: number }} */
function parseColor(text) {
	const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (hex) {
		let digits = hex[1];
		if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
		const n = parseInt(digits, 16);
		return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
	}
	const rgb = text.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/
	);
	if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: rgb[4] === undefined ? 1 : +rgb[4] };
	throw new Error(`not a color: ${text}`);
}

/** A see-through color laid over an opaque one, as the screen shows it. */
function over(top, bottom) {
	const mix = (k) => Math.round(top[k] * top.a + bottom[k] * (1 - top.a));
	return { r: mix('r'), g: mix('g'), b: mix('b'), a: 1 };
}

function luminance({ r, g, b }) {
	const lin = (v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const color = (name) => parseColor(resolve(name));
const menuBg = () => color('--menu-bg');
/** A cell background as painted over the menu. */
const surface = (name) => over(color(name), menuBg());

/** Declarations of the rule whose selector list holds exactly `selector`. */
function declarations(css, selector) {
	const found = [];
	for (const [, selectors, body] of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const list = selectors.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
		if (list.includes(selector)) found.push(body);
	}
	return found.join('\n');
}

describe('menu tokens (computed from tokens.css)', () => {
	it('defines every menu token as a color', () => {
		for (const name of [
			'--menu-bg',
			'--menu-text',
			'--menu-text-hover',
			'--menu-hint',
			'--menu-heading',
			'--menu-key-text',
			'--menu-key-bg',
			'--menu-row-hover-bg',
			'--menu-row-selected-bg',
			'--menu-disabled',
		]) {
			expect(() => color(name), name).not.toThrow();
		}
	});

	it('row labels are at least 4.5:1 on the menu without hover', () => {
		expect(contrast(color('--menu-text'), menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('group headings (the file names) are at least 4.5:1', () => {
		expect(contrast(color('--menu-heading'), menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('hints beside a row are at least 4.5:1 (they are small text)', () => {
		expect(contrast(color('--menu-hint'), menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('a greyed-out row is still readable at 4.5:1 and looks dimmer than a live one', () => {
		expect(contrast(color('--menu-disabled'), menuBg())).toBeGreaterThanOrEqual(4.5);
		expect(contrast(color('--menu-text'), color('--menu-disabled'))).toBeGreaterThanOrEqual(2);
	});

	it('shortcut keys are at least 3:1 on their key chip', () => {
		const chip = surface('--menu-key-bg');
		expect(contrast(color('--menu-key-text'), chip)).toBeGreaterThanOrEqual(3);
	});

	it('a hovered row keeps its label at 4.5:1 and its hint at 3:1', () => {
		const hover = surface('--menu-row-hover-bg');
		expect(contrast(color('--menu-text-hover'), hover)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(color('--menu-hint'), hover)).toBeGreaterThanOrEqual(3);
	});

	it('a hovered row looks different from a resting row', () => {
		expect(contrast(surface('--menu-row-hover-bg'), menuBg())).toBeGreaterThanOrEqual(1.25);
	});

	it('the picked row (Presets) keeps its label at 4.5:1', () => {
		const picked = surface('--menu-row-selected-bg');
		expect(contrast(color('--menu-text'), picked)).toBeGreaterThanOrEqual(4.5);
	});
});

describe('menu CSS uses the menu tokens', () => {
	it('the menu sets its own text color (a <dialog> otherwise gets black text)', () => {
		const menu = declarations(MENU_CSS, '#context-menu');
		expect(menu).toMatch(/(^|[\s;])color:\s*var\(--menu-text\)/);
		expect(menu).toMatch(/background-color:\s*var\(--menu-bg\)/);
	});

	it('hint text, key chips and group headings have their own colors', () => {
		expect(declarations(MENU_CSS, '.context-menu-row .row-notes span')).toMatch(
			/color:\s*var\(--menu-hint\)/
		);
		const keys = declarations(MENU_CSS, '.context-menu-row .row-notes code');
		expect(keys).toMatch(/(^|[\s;])color:\s*var\(--menu-key-text\)/);
		expect(keys).toMatch(/background-color:\s*var\(--menu-key-bg\)/);
		expect(declarations(MENU_CSS, '#context-menu .spanAll h2')).toMatch(
			/color:\s*var\(--menu-heading\)/
		);
	});

	it('hover and the picked row use the menu tokens', () => {
		const hover = declarations(MENU_CSS, '.context-menu-row:hover > .row-notes span');
		expect(hover).toMatch(/background-color:\s*var\(--menu-row-hover-bg\)/);
		expect(hover).toMatch(/(^|[\s;])color:\s*var\(--menu-text-hover\)/);
		expect(declarations(MENU_CSS, '.context-menu-row[selected] > .row-name')).toMatch(
			/background-color:\s*var\(--menu-row-selected-bg\)/
		);
	});

	it('the menu CSS holds no color literals', () => {
		expect(stripComments(MENU_CSS)).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
	});
});

// B1 fix pass: contrast as painted, counting every opacity the menu CSS declares on a row's parts.
// (Chrome ignores opacity on a display: contents box such as a row or its notes, so a declared
// fade there only made measuring tools report text dimmer than it is. The rule: no fades at all.)
describe('menu text as painted (opacity included)', () => {
	/** Opacity a rule declares, 1 when it declares none. */
	const opacityOf = (selector) => {
		const found = [...declarations(MENU_CSS, selector).matchAll(/(?:^|[\s;])opacity:\s*([\d.]+)/g)];
		return found.length ? Number(found.at(-1)[1]) : 1;
	};
	/** The token a rule sets `color` to (the last one wins, as in CSS). */
	const colorTokenOf = (selector) => {
		const found = [
			...declarations(MENU_CSS, selector).matchAll(/(?:^|[\s;])color:\s*var\((--[\w-]+)\)/g),
		];
		if (!found.length) throw new Error(`no color token set for ${selector}`);
		return found.at(-1)[1];
	};
	/** Text color faded by the given opacities, as the screen shows it on the menu. */
	const painted = (token, ...faders) => {
		const alpha = faders.reduce((product, selector) => product * opacityOf(selector), 1);
		return over({ ...color(token), a: alpha }, menuBg());
	};

	it('Presets and File menu hints are at least 4.5:1', () => {
		const hint = painted(
			colorTokenOf('.context-menu-row .row-notes span'),
			'.context-menu-row',
			'.context-menu-row .row-notes',
			'.context-menu-row .row-notes span'
		);
		expect(contrast(hint, menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('shortcut keys keep 3:1 on their chip', () => {
		const chip = surface('--menu-key-bg');
		const keys = over(
			{
				...color(colorTokenOf('.context-menu-row .row-notes code')),
				a: opacityOf('.context-menu-row .row-notes'),
			},
			chip
		);
		expect(contrast(keys, chip)).toBeGreaterThanOrEqual(3);
	});

	it('a greyed-out row (Projects > Cross-project actions) is at least 4.5:1', () => {
		expect(colorTokenOf('.context-menu-row[disabled]')).toBe('--menu-disabled');
		const label = painted(
			colorTokenOf('.context-menu-row[disabled]'),
			'.context-menu-row[disabled]'
		);
		expect(contrast(label, menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('the reason beside a greyed-out row is at least 4.5:1', () => {
		const reason = painted(
			colorTokenOf('.context-menu-row[disabled] > .row-notes span'),
			'.context-menu-row[disabled]',
			'.context-menu-row .row-notes'
		);
		expect(contrast(reason, menuBg())).toBeGreaterThanOrEqual(4.5);
	});

	it('a hint or reason stays on one line, so it never spills out of its 24 px row', () => {
		// The notes column is min-content: in a fixed-width menu (Projects, 500 px) a wrapping
		// "Open another font first" stood one word per line over the next row.
		expect(declarations(MENU_CSS, '.context-menu-row .row-notes span')).toMatch(
			/white-space:\s*nowrap/
		);
	});

	it('hovering a greyed-out row keeps it readable', () => {
		expect(colorTokenOf('.context-menu-row[disabled]:hover > .row-notes span')).toBe(
			'--menu-disabled'
		);
	});
});

// B1 fix pass: in the Projects menu, the "EDITING" label on the open font's card was the faint
// eyebrow color on the card's green tint: 3.76:1 measured in Chrome. Small text needs 4.5:1.
describe('Projects menu cards', () => {
	const APP_CSS = read('../../../app/app.css');
	const tinted = () => over(color('--touch-soft'), menuBg());

	it('the "Editing" label on the open font\'s (tinted) card is at least 4.5:1', () => {
		const rule = declarations(APP_CSS, '.project-preview__primary .project-preview__super-title');
		const token = rule.match(/(?:^|[\s;])color:\s*var\((--[\w-]+)\)/)?.[1];
		expect(token, 'the tinted card sets its own label color').toBeTruthy();
		expect(contrast(color(token), tinted())).toBeGreaterThanOrEqual(4.5);
	});

	it('the other cards\' labels are at least 4.5:1 on the menu', () => {
		const rule = declarations(APP_CSS, '.project-preview__super-title');
		const token = rule.match(/(?:^|[\s;])color:\s*var\((--[\w-]+)\)/)[1];
		expect(contrast(color(token), menuBg())).toBeGreaterThanOrEqual(4.5);
	});
});
