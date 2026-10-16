// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 (UX-BEGINNER.md 4.1, acceptance T1): the start screen's name field. The suggested name
// ("My Font", "My Font 2") is picked whole on a click or a focus, so what he types replaces it,
// never "My FontBrennan Hand"; a name he typed is never picked; focusNameField takes the keyboard
// only when nothing else has it.
import { afterEach, describe, expect, it } from 'vitest';
import { focusNameField, wireNameField } from '../name_field.js';

afterEach(() => document.body.replaceChildren());

/** @returns {{input: HTMLInputElement, setSuggested: (name: String) => void}} */
function field(value = 'My Font') {
	let suggested = 'My Font';
	const input = document.createElement('input');
	input.type = 'text';
	input.value = value;
	document.body.append(input);
	wireNameField(input, { suggested: () => suggested });
	return { input, setSuggested: (name) => (suggested = name) };
}
const picked = (input) => [input.selectionStart, input.selectionEnd];
/** Typing over the selection, the way a key press does. */
const type = (input, text) => {
	input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
	input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('wireNameField', () => {
	it('a click on the suggested name picks it whole, so typing replaces it', () => {
		const { input } = field();
		input.setSelectionRange(7, 7);
		input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(picked(input)).toEqual([0, 7]);
		type(input, 'Brennan Hand');
		expect(input.value).toBe('Brennan Hand');
	});

	it('a press on the field that already has the keyboard picks the suggestion too (B16 verify: Chrome put the caret after the click)', () => {
		const { input } = field();
		input.focus();
		input.setSelectionRange(0, 7);
		const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
		input.dispatchEvent(down);
		// the press itself places no caret: the browser's caret placement is stopped
		expect(down.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(input);
		expect(picked(input)).toEqual([0, 7]);
		type(input, 'Brennan Hand');
		expect(input.value).toBe('Brennan Hand');
	});

	it('a press inside a name he typed places the caret as usual', () => {
		const { input } = field('Brennan Hand');
		input.focus();
		const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
		input.dispatchEvent(down);
		expect(down.defaultPrevented).toBe(false);
	});

	it('a focus (Tab, or the start screen) picks it whole too', () => {
		const { input } = field();
		input.setSelectionRange(7, 7);
		input.focus();
		expect(picked(input)).toEqual([0, 7]);
		type(input, 'Brennan Hand');
		expect(input.value).toBe('Brennan Hand');
	});

	it('follows the suggestion when it changes ("My Font 2")', () => {
		const { input, setSuggested } = field('My Font 2');
		setSuggested('My Font 2');
		input.setSelectionRange(9, 9);
		input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(picked(input)).toEqual([0, 9]);
	});

	it('a name he typed is left alone: a click places the caret', () => {
		const { input } = field('Brennan Hand');
		input.setSelectionRange(3, 3);
		input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		input.focus();
		expect(picked(input)).toEqual([3, 3]);
	});
});

describe('focusNameField', () => {
	it('takes the keyboard when nothing has it, with the suggested name picked', () => {
		const { input } = field();
		expect(focusNameField(input)).toBe(true);
		expect(document.activeElement).toBe(input);
		expect(picked(input)).toEqual([0, 7]);
	});

	it('never takes it from another control', () => {
		const { input } = field();
		const other = document.createElement('button');
		document.body.append(other);
		other.focus();
		expect(focusNameField(input)).toBe(false);
		expect(document.activeElement).toBe(other);
	});

	it('does nothing for a field not on the page', () => {
		const input = document.createElement('input');
		expect(focusNameField(input)).toBe(false);
	});
});
