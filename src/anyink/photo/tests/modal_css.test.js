// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui fix pass (first-timer finding: "The Close (x) button on the photo dialog doesn't close
// it"). Found in Chrome: upstream's button resets (src/common/resets.css: `button:hover`,
// `button:focus`, `button:active`, specificity 0,1,1, linked after the bundled styles in a build)
// beat `.anyink-modal__close` (0,1,0), so on hover the x lost its `margin-left: auto` and jumped
// about 600 px to the left, out from under the pointer: the press landed on the dialog's head
// and the x never heard a click (with Escape and Cancel still working). jsdom matches no :hover,
// so this test reads the cascade itself: every rule the photo screens' CSS sets on one of their
// own buttons must beat upstream's button resets for every property those resets set, or the
// button changes size or place under the pointer. The buttons are found by building each
// screen, so a new button is checked too. Written before the fix (failed on the x).
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeHowCard, openHowCard } from '../how_card.js';
import { closePhotoCard, makePhotoCard, resetPhotoCardForTests } from '../photo_card.js';
import { closePhotoDialog, openPhotoDialog } from '../photo_dialog.js';
import { photoFont, photoOn } from './photo_dialog_fixture.js';

const css = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const OURS = {
	'photo_dialog.css': css('../photo_dialog.css'),
	'how_card.css': css('../how_card.css'),
	'photo_card.css': css('../photo_card.css'),
};
const RESETS = css('../../../common/resets.css');

/** @returns {Array<{selectors: Array<String>, props: Array<String>}>} every plain rule */
export function rulesOf(text) {
	const plain = text.replace(/\/\*[\s\S]*?\*\//g, '');
	const rules = [];
	for (const match of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = match[1]
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (selectors.some((s) => s.startsWith('@'))) continue;
		const props = match[2]
			.split(';')
			.map((d) => d.split(':')[0].trim().toLowerCase())
			.filter(Boolean);
		rules.push({ selectors, props });
	}
	return rules;
}

/**
 * Specificity of a simple selector (ids, classes / attributes / pseudo-classes, types), the way
 * Chrome counts it for the selectors these files use. :is() and :not() count their argument.
 * @param {String} selector
 * @returns {[Number, Number, Number]}
 */
export function specificity(selector) {
	let s = selector.replace(/::[\w-]+(\([^)]*\))?/g, ' ');
	const total = [0, 0, 0];
	s = s.replace(/:(?:is|not|where)\(([^()]*)\)/g, (whole, inner) => {
		if (whole.startsWith(':where')) return ' ';
		const best = inner
			.split(',')
			.map((part) => specificity(part.trim()))
			.sort(compare)
			.at(-1) || [0, 0, 0];
		best.forEach((n, i) => (total[i] += n));
		return ' ';
	});
	total[0] += (s.match(/#[\w-]+/g) || []).length;
	total[1] += (s.match(/\.[\w-]+/g) || []).length;
	total[1] += (s.match(/\[[^\]]*\]/g) || []).length;
	total[1] += (s.match(/:[\w-]+(\([^)]*\))?/g) || []).length;
	const types = s
		.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+(\([^)]*\))?/g, ' ')
		.split(/[\s>+~]+/)
		.filter((t) => t && t !== '*');
	total[2] += types.length;
	return total;
}

function compare(a, b) {
	return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** margin-left counts as margin, border-color as border: what a reset's shorthand overrides. */
const familyOf = (prop) => prop.split('-')[0];

/** Upstream's resets on every plain button, in any state but disabled: family -> specificity. */
function upstreamButtonResets() {
	const families = new Map();
	for (const rule of rulesOf(RESETS)) {
		for (const selector of rule.selectors) {
			if (!/^button(:(hover|active|focus|focus-visible|focus-within))*$/.test(selector)) continue;
			const weight = specificity(selector);
			for (const prop of rule.props) {
				const family = familyOf(prop);
				const was = families.get(family);
				if (!was || compare(weight, was) > 0) families.set(family, weight);
			}
		}
	}
	return families;
}

/** The classes on every button the three screens draw (their every state). */
function buttonClasses() {
	const classes = new Set();
	const take = () =>
		document.querySelectorAll('button').forEach((b) => b.classList.forEach((c) => classes.add(c)));
	openHowCard({ text: 'Brennan Hand' });
	take();
	closeHowCard();
	for (const char of ['', 'r']) {
		const { record, image, mask } = photoFont({ used: { p1: 'B' } });
		openPhotoDialog({ record, image, mask, char });
		take();
		closePhotoDialog();
	}
	const thumb = document.createElement('canvas');
	const pick = makePhotoCard({ step: 'pick', char: 'r', photos: [{ asset: 'a1', image: thumb }] });
	document.body.appendChild(pick.element);
	const result = makePhotoCard({ step: 'result', char: 'r', status: 'ready', replaces: 2 });
	document.body.appendChild(result.element);
	take();
	// shared state classes say nothing about which button; the screens' own classes do
	['anyink-primary', 'anyink-outlined'].forEach((c) => classes.delete(c));
	return classes;
}

beforeEach(() => {
	photoOn();
	resetPhotoCardForTests();
});
afterEach(() => {
	closePhotoCard();
	document.body.innerHTML = '';
});

describe('the cascade reader', () => {
	it('counts specificity the way Chrome does for these selectors', () => {
		expect(specificity('button')).toEqual([0, 0, 1]);
		expect(specificity('button:hover')).toEqual([0, 1, 1]);
		expect(specificity('.anyink-modal__close')).toEqual([0, 1, 0]);
		expect(specificity('.anyink-modal .anyink-modal__close:hover')).toEqual([0, 3, 0]);
		expect(specificity("x:is(*, #w) .a[aria-pressed='true']")).toEqual([1, 2, 1]);
	});

	it("finds upstream's button resets: margin, padding and border among them", () => {
		const resets = upstreamButtonResets();
		expect([...resets.keys()]).toEqual(expect.arrayContaining(['margin', 'padding', 'border']));
		expect(resets.get('margin')).toEqual([0, 1, 1]);
	});
});

describe("the photo screens' buttons never change place or size under the pointer", () => {
	it("every rule on one of their buttons beats upstream's hover, focus and active resets", () => {
		const resets = upstreamButtonResets();
		const classes = buttonClasses();
		expect(classes).toContain('anyink-modal__close');
		const losers = [];
		for (const [file, text] of Object.entries(OURS)) {
			for (const rule of rulesOf(text)) {
				for (const selector of rule.selectors) {
					const last = selector.split(/[\s>+~]+/).at(-1);
					const own = (last.match(/\.[\w-]+/g) || []).some((c) => classes.has(c.slice(1)));
					if (!own) continue;
					for (const prop of rule.props) {
						const beat = resets.get(familyOf(prop));
						if (beat && compare(specificity(selector), beat) <= 0) {
							losers.push(`${file}: ${selector} { ${prop} }`);
						}
					}
				}
			}
		}
		expect(losers).toEqual([]);
	});
});
