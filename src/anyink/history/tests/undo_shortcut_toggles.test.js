// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 finalize (verdict "After touching the strip ... Ctrl+Z, Ctrl+S, Ctrl+E and tool keys do
// nothing", the All tools variant): a strip toggle (Real font, Guide lines) is a checkbox. Once it
// had focus, every app key was dead, because isTextEntryElement counted every <input> as a text
// field. A checkbox or a button types nothing, so the app keeps its keys (a range slider already
// did); text fields keep theirs.
import { describe, expect, it } from 'vitest';
import { isTextEntryElement } from '../undo_shortcut.js';

function input(type) {
	const element = document.createElement('input');
	element.type = type;
	return element;
}

describe('isTextEntryElement: inputs that type nothing', () => {
	it.each(['checkbox', 'button', 'submit', 'reset'])('a focused %s keeps the app keys live', (type) => {
		expect(isTextEntryElement(input(type))).toBe(false);
	});

	it.each(['text', 'search', 'number', 'email', 'url', 'password'])(
		'a %s field still owns its keys',
		(type) => {
			expect(isTextEntryElement(input(type))).toBe(true);
		}
	);

	it('an <input> with no type is a text field', () => {
		expect(isTextEntryElement(document.createElement('input'))).toBe(true);
	});
});
