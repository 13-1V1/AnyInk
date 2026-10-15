// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B6 + B7 finalize (UX-BEGINNER.md principle 1; verdict: "Two green buttons show when a dialog
	opens over the overlay ... Menu > About shows the Next line's green 'Make B' and the page's
	green 'Back to my letters' together"): the screen probe counts every green button the screen
	shows, ANY-INK's own (.anyink-primary) and upstream's green fancy-button (a fancy-button that
	isn't secondary, minimal, danger or disabled draws in the accent green), so the Next line's
	button turns outlined beside either.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { hasOtherPrimary } from '../dom_probe.js';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('the green buttons the probe counts', () => {
	it('a plain fancy-button (upstream green) counts', () => {
		document.body.innerHTML = '<fancy-button>Back to my letters</fancy-button>';
		expect(hasOtherPrimary(document)).toBe(true);
	});

	it.each(['secondary', 'minimal', 'danger', 'disabled'])('a %s fancy-button does not', (kind) => {
		document.body.innerHTML = `<fancy-button ${kind}>Cancel</fancy-button>`;
		expect(hasOtherPrimary(document)).toBe(false);
	});

	it('a hidden one, or one inside the Next line, does not', () => {
		document.body.innerHTML =
			'<div hidden><fancy-button>Go</fancy-button></div><anyink-coach><fancy-button>Go</fancy-button></anyink-coach>';
		expect(hasOtherPrimary(document)).toBe(false);
	});

	it('.anyink-primary counts, as before', () => {
		document.body.innerHTML = '<button class="anyink-primary">Draw it with points</button>';
		expect(hasOtherPrimary(document)).toBe(true);
	});
});
