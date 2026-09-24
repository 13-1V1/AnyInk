// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { getUndoRedoAction, isTextEntryElement } from '../undo_shortcut.js';

describe('getUndoRedoAction', () => {
	it('Ctrl+Z is undo, Ctrl+Y and Ctrl+Shift+Z are redo', () => {
		expect(getUndoRedoAction('z', { isCtrlDown: true })).toBe('undo');
		expect(getUndoRedoAction('y', { isCtrlDown: true })).toBe('redo');
		expect(getUndoRedoAction('z', { isCtrlDown: true, isShiftDown: true })).toBe('redo');
		expect(getUndoRedoAction('Z', { isCtrlDown: true, isShiftDown: true })).toBe('redo');
	});

	it('dedicated Undo / Redo keys need no modifier', () => {
		expect(getUndoRedoAction('Undo', {})).toBe('undo');
		expect(getUndoRedoAction('Redo', {})).toBe('redo');
	});

	it('ignores everything else', () => {
		expect(getUndoRedoAction('z', {})).toBe(false);
		expect(getUndoRedoAction('z', { isShiftDown: true })).toBe(false);
		expect(getUndoRedoAction('a', { isCtrlDown: true })).toBe(false);
		expect(getUndoRedoAction('s', { isCtrlDown: true })).toBe(false);
		expect(getUndoRedoAction(undefined)).toBe(false);
	});
});

describe('isTextEntryElement', () => {
	it('is true for text fields and the custom input elements', () => {
		['input', 'textarea', 'input-number', 'option-chooser', 'option-toggle'].forEach((tag) => {
			expect(isTextEntryElement(document.createElement(tag))).toBe(true);
		});
	});

	it('is true for contenteditable regions', () => {
		const div = document.createElement('div');
		div.setAttribute('contenteditable', 'true');
		expect(isTextEntryElement(div)).toBe(true);
		div.setAttribute('contenteditable', '');
		expect(isTextEntryElement(div)).toBe(true);
		div.setAttribute('contenteditable', 'plaintext-only');
		expect(isTextEntryElement(div)).toBe(true);
		div.setAttribute('contenteditable', 'false');
		expect(isTextEntryElement(div)).toBe(false);
	});

	it('is false for a range slider (it types nothing, and keeps focus after a drag)', () => {
		const range = document.createElement('input');
		range.type = 'range';
		expect(isTextEntryElement(range)).toBe(false);
		const text = document.createElement('input');
		text.type = 'text';
		expect(isTextEntryElement(text)).toBe(true);
	});

	it('is false for the edit canvas even though it is contenteditable', () => {
		const canvas = document.createElement('canvas');
		canvas.setAttribute('contenteditable', 'true');
		expect(isTextEntryElement(canvas)).toBe(false);
		const editCanvas = document.createElement('edit-canvas');
		editCanvas.setAttribute('contenteditable', 'true');
		expect(isTextEntryElement(editCanvas)).toBe(false);
	});

	it('is false for body, buttons, and nothing', () => {
		expect(isTextEntryElement(document.body)).toBe(false);
		expect(isTextEntryElement(document.createElement('button'))).toBe(false);
		expect(isTextEntryElement(null)).toBe(false);
		expect(isTextEntryElement(undefined)).toBe(false);
	});
});
