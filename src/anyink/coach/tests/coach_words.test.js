// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the banned-word scan (UX-BEGINNER.md 2.3, principle 2) on the Next line in every rule's
// state, with its Tip line, "Something else", the hide button and the Next chip: visible text,
// title and aria-label, sentence case (coach.css loaded so jsdom sees it), strict (2.4 E and G).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect } from 'vitest';
import { FEATURE_NAMES, setFeaturesForTests } from '../../mode/features.js';
import { resetPrefsCache } from '../../prefs/prefs.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { CoachElement, makeNextChip } from '../coach_element.js';
import { makeCoach } from '../coach_state.js';
import { fakeState } from './fake_state.js';
import { MORE_STATES } from './rule_states.js';

const here = dirname(fileURLToPath(import.meta.url));
const ALL_READY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,'?!-";
const floats = {
	id: 'seat',
	reason: 'Capital B floats above the writing line.',
	fixLabel: 'Sit on the line',
};

/** The state in which each rule speaks (all flags on) */
const STATES = {
	2: () => fakeState({ page: 'letter', current: 'r', photoCard: { step: 'pick', char: 'r' } }),
	3: () => fakeState({ page: 'letter', current: 'B', photoCard: { step: 'result', char: 'B' } }),
	4: () => fakeState({ ready: 'BrenaHd', tryItOpen: true, fontFileBehind: true }),
	5: () => fakeState({ tryItOpen: true }),
	6: () =>
		fakeState({
			ready: 'a',
			fontProblem: { itemId: 'glyph-0x61', problem: 'x', text: '', fixable: true },
		}),
	7: () => fakeState({ page: 'letter', current: 'B', needsLook: { B: floats } }),
	8: () => fakeState({ page: 'letter', current: 'B' }),
	9: () => fakeState({ ready: 'a', needsLook: { B: floats } }),
	10: () => fakeState({ ready: 'a', save: 'not-saved' }),
	11: () => fakeState({}),
	12: () => fakeState({ ready: 'B', hasPhoto: true, photos: [{ id: 'p', unused: 6 }] }),
	13: () => fakeState({ ready: 'BrenaHd', tryItText: 'Brennan Hand', changedSinceTryIt: true }),
	14: () => fakeState({ ready: 'BrenaHd', fontFileBehind: true, lettersChangedSinceFontFile: 12 }),
	15: () => fakeState({ page: 'letter', current: 'B', ready: 'B' }),
	16: () => fakeState({ ready: ALL_READY }),
	17: () => fakeState({ ready: ALL_READY + '0123456789:;"()&@#$%/*', numbers: true }),
};

function addStyles() {
	['../coach.css', '../../theme/tokens.css'].forEach((path) => {
		const style = document.createElement('style');
		style.dataset.scan = path;
		style.textContent = readFileSync(join(here, path), 'utf8');
		document.head.appendChild(style);
	});
}

/** The Next line on a fake font, in the document, with its chip */
function mountLine(state, { otherPrimary = false } = {}) {
	const coach = makeCoach({
		getEditor: () => null,
		deriveState: () => ({ ...state, otherPrimary }),
		probe: () => ({ dialog: '', otherPrimary: false }),
		schedule: () => {},
		listen: false,
	});
	const bar = document.createElement('div');
	const element = /** @type {CoachElement} */ (document.createElement('anyink-coach'));
	element.coach = coach;
	bar.append(element, makeNextChip(coach));
	document.body.appendChild(bar);
	return { bar, element, coach };
}

beforeAll(() => {
	if (!customElements.get('anyink-coach')) customElements.define('anyink-coach', CoachElement);
});
beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setFeaturesForTests(Object.fromEntries(FEATURE_NAMES.map((name) => [name, true])));
	addStyles();
});
afterEach(() => {
	document.body.innerHTML = '';
	document.head.querySelectorAll('style[data-scan]').forEach((style) => style.remove());
});

describe('the Next line says no banned word (B6)', () => {
	Object.keys(STATES).forEach((rule) => {
		scanSimpleScreen(`rule ${rule}`, () => {
			const { bar, element } = mountLine(STATES[rule]());
			expect(element.dataset.rule).toBe(rule);
			return bar;
		});
	});

	// B6 + B7 fix pass: rule 8 with a drawing tool picked or a shape still open, and rule 10
	// after a failed save
	Object.entries(MORE_STATES).forEach(([name, { rule, state }]) => {
		scanSimpleScreen(name, () => {
			const { bar, element } = mountLine(state());
			expect(element.dataset.rule).toBe(String(rule));
			return bar;
		});
	});

	scanSimpleScreen('a button outlined while a card holds the green one', () => {
		const { bar, element } = mountLine(STATES[10](), { otherPrimary: true });
		expect(element.querySelector('.anyink-coach__button--outlined')).not.toBe(null);
		return bar;
	});

	['photoStays', 'brush', 'editPoints', 'pointPen', 'shapes'].forEach((name) => {
		scanSimpleScreen(`the tip "${name}" under the sentence`, () => {
			const { bar, coach } = mountLine(STATES[15]());
			expect(coach.tips.show(name)).toBe(true);
			bar.querySelector('anyink-coach').render();
			expect(bar.querySelector('.anyink-coach__tip').hidden).toBe(false);
			return bar;
		});
	});

	scanSimpleScreen('the line hidden, with the Next chip showing', () => {
		const { bar, coach } = mountLine(STATES[10]());
		coach.hide();
		expect(bar.querySelector('.anyink-coach-chip').hidden).toBe(false);
		return bar;
	});
});
