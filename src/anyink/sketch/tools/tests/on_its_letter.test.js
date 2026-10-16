// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 integration: on_its_letter.js. A piece finished after the view moved is stored as a step of
	its own letter, and the view comes back exactly as it was; a letter is looked up as the font
	holds it now; a letter from a font that was swapped out is gone. Written with the module.
*/
import { describe, expect, it } from 'vitest';
import { isGoneFromFont, liveItemOf, onItsLetter } from '../on_its_letter.js';

function editorWith() {
	const n = { id: 'glyph-0x6E' };
	const o = { id: 'glyph-0x6F' };
	const project = { glyphs: { 'glyph-0x6E': n, 'glyph-0x6F': o }, ligatures: {}, components: {} };
	const editor = {
		project,
		nav: { page: 'Overview' },
		_selectedGlyphID: 'glyph-0x6F',
		get selectedItem() {
			return this.nav.page === 'Characters' ? this.project.glyphs[this._selectedGlyphID] : false;
		},
	};
	return { editor, n, o };
}

describe('onItsLetter', () => {
	it('runs with the letter open, then puts the view back', () => {
		const { editor, n } = editorWith();
		let seen = null;
		const out = onItsLetter(editor, n, () => {
			seen = editor.selectedItem;
			return 'done';
		});
		expect(out).toBe('done');
		expect(seen).toBe(n);
		expect(editor.nav.page).toBe('Overview');
		expect(editor._selectedGlyphID).toBe('glyph-0x6F');
	});

	it('puts the view back when the step throws', () => {
		const { editor, n } = editorWith();
		expect(() =>
			onItsLetter(editor, n, () => {
				throw new Error('no');
			})
		).toThrow('no');
		expect(editor.nav.page).toBe('Overview');
	});

	it('the letter already open: runs as is', () => {
		const { editor, o } = editorWith();
		editor.nav.page = 'Characters';
		let seen = null;
		onItsLetter(editor, o, () => (seen = editor.selectedItem));
		expect(seen).toBe(o);
	});
});

describe('the letter as the font holds it now', () => {
	it('an Undo wrote a new object for the letter: the new one', () => {
		const { editor, n } = editorWith();
		const fresh = { id: n.id };
		editor.project.glyphs[n.id] = fresh;
		expect(liveItemOf(editor, n, editor.project)).toBe(fresh);
		expect(isGoneFromFont(editor, n)).toBe(true);
		expect(isGoneFromFont(editor, fresh)).toBe(false);
	});

	it('the font was swapped, or the letter deleted: none', () => {
		const { editor, n } = editorWith();
		const started = editor.project;
		editor.project = { glyphs: { [n.id]: { id: n.id } } };
		expect(liveItemOf(editor, n, started)).toBe(null);
		delete editor.project.glyphs[n.id];
		expect(liveItemOf(editor, n)).toBe(null);
	});

	it('a stand-in editor with no font: the letter itself', () => {
		const item = { id: 'glyph-0x6E' };
		expect(liveItemOf({}, item)).toBe(item);
		expect(isGoneFromFont({}, item)).toBe(false);
	});
});
