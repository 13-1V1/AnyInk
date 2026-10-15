// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 in the banned-word scan (UX-BEGINNER.md 2.3; words/tests/banned_words.test.js names this as
// B5's screen): the More tools band and its button, the landing band, Back to simple, and the
// toast a tool key shows in Simple, recorded through the real toast module. The band shows while
// All tools is on, but every word on it is ANY-INK's, so it is scanned like a Simple screen.
import { describe, expect, it } from 'vitest';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { toast } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import { flagsOn } from '../features.js';
import { getMode, setMode } from '../mode.js';
import { arriveAt, makeBand } from '../band.js';
import { keyAction, keysShown } from '../keys.js';

const fakeEditor = (page = 'Characters') => ({ nav: { page }, navigate: () => {} });

describe('the mode switch says no banned word', () => {
	scanSimpleScreen('the More tools band and Back to simple', () => {
		document.body.innerHTML = '';
		setMode('all');
		const band = makeBand({ editor: fakeEditor() });
		document.body.append(band);
		const shown = document.body.cloneNode(true);
		band.querySelector('button').click();
		expect(getMode()).toBe('simple');
		return shown;
	});

	scanSimpleScreen('the landing band (an undo that lands on Kerning)', () => {
		document.body.innerHTML = '';
		arriveAt('Kerning', { isOn: flagsOn(), cause: 'undo' });
		const band = makeBand({ editor: fakeEditor('Kerning') });
		document.body.append(band);
		return band;
	});

	scanSimpleScreen('a tool key in Simple: "Switched to Rectangle (R)"', ({ toasts }) => {
		const result = keyAction(
			{ key: 'r', ctrl: false, shift: false, alt: false },
			{ where: 'canvas' }
		);
		toast(result.toast.key, result.toast.vars, result.toast.options);
		toasts.flush();
		expect(toasts.messages).toContain('Switched to Rectangle (R)');
		return null;
	});

	scanSimpleScreen('the tool names Help will list (keysShown)', () => ({
		root: null,
		texts: {
			keys: keysShown({ mode: 'simple', isOn: flagsOn('brush') })
				.filter((row) => row.tool)
				.map((row) => word(`tool.${row.tool}`)),
		},
	}));

	it('scans what it says it scans', () => {
		expect(word('tool.newRectangle')).toBe('Rectangle');
	});
});
