// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 fixture: a font "Brennan Hand" with letters in every state the board knows (UX-BEGINNER.md
	4.2), for the board's unit tests and tests/board.html:
	  from a photo   B H r n d   (ink and a photo under it)
	  drawn          a           (one brush stroke)
	  stray line     c           (a shape of two points: no ink, so Empty, as the letter card says)
	  needs a look   e           (ink; B11's check, LOOK, says it floats, once 'checks' is on)
	  empty          every other letter (no record at all: looking never makes one)

	  SEED                 the letters by kind
	  LOOK                 the needsLook the checks stand-in gives small e
	  lookChecks(chars)    a B11 checks stand-in: LOOK for those letters (default: e)
	  square(x, size), line()   shapes
	  addLetter(project, char, shapes, anyink)   a letter's record with those shapes
	  boardProject({ name, seed })   the font (seed false: a new font, every letter empty)
	  boardEditor(options)  a ProjectEditor on it, current, on the Overview; glyph-tile defined
	  openPage(editor, page)   the real Navigator draws that page into #app__wrapper
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { charToHex } from '../../../common/character_ids.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { tagStroke } from '../../nib/stroke_record.js';

export const SEED = Object.freeze({
	photo: Object.freeze(['B', 'H', 'r', 'n', 'd']),
	drawn: Object.freeze(['a']),
	stray: Object.freeze(['c']),
	look: Object.freeze(['e']),
});

export const LOOK = Object.freeze({
	id: 'line',
	reason: 'small e floats above the writing line.',
	short: 'floats above the writing line',
	fixLabel: 'Sit on the line',
	action: 'fixLetter',
});

const TRACE = Object.freeze({ asset: 'img-0001', width: 100, height: 100, x: 0, y: 700, scale: 7 });

/**
 * @param {Array<String>} [chars]
 * @returns {(item: Object, context: {char: String}) => Object | null}
 */
export function lookChecks(chars = SEED.look) {
	return (_item, { char }) => (chars.includes(char) ? LOOK : null);
}

const corner = (x, y) => ({ p: { coord: { x, y } } });

/** A square sitting on the writing line */
export function square(x = 0, size = 400) {
	return new Path({
		name: 'Ink',
		pathPoints: [corner(x, 0), corner(x + size, 0), corner(x + size, size), corner(x, size)],
	});
}

/** Two points: a stray line, no ink */
export function line() {
	return new Path({ name: 'Line', pathPoints: [corner(0, 0), corner(300, 0)] });
}

/**
 * @param {Object} project
 * @param {String} char
 * @param {Array<Object>} shapes
 * @param {Object} [anyink]
 * @returns {Glyph}
 */
export function addLetter(project, char, shapes, anyink = {}) {
	const id = `glyph-${charToHex(char)}`;
	const glyph = new Glyph({ id, anyink: structuredClone(anyink), parent: project });
	shapes.forEach((shape) => glyph.addOneShape(shape));
	glyph.advanceWidth = shapes.length ? 500 : 0;
	project.glyphs[id] = glyph;
	return glyph;
}

/**
 * @param {{name?: String, seed?: Boolean}} [options]
 * @returns {GlyphrStudioProject}
 */
export function boardProject({ name = 'Brennan Hand', seed = true } = {}) {
	const project = new GlyphrStudioProject({
		settings: {
			project: {
				name,
				id: 'g2_BOARDFONT',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: name, upm: 1000, ascent: 800, descent: -200, capHeight: 700, xHeight: 500 },
		},
	});
	if (!seed) return project;
	SEED.photo.forEach((char) => addLetter(project, char, [square()], { trace: { ...TRACE } }));
	SEED.drawn.forEach((char) => {
		const stroke = square(100, 200);
		tagStroke(stroke, 1);
		addLetter(project, char, [stroke]);
	});
	SEED.stray.forEach((char) => addLetter(project, char, [line()]));
	SEED.look.forEach((char) => addLetter(project, char, [square()], { trace: { ...TRACE } }));
	return project;
}

/**
 * @param {{name?: String, seed?: Boolean, page?: String}} [options]
 * @returns {ProjectEditor} the current editor
 */
export function boardEditor({ page = 'Overview', ...options } = {}) {
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = boardProject(options);
	editor.nav.page = page;
	return editor;
}

/**
 * The real Navigator draws the page (the top bar, the band, the page).
 * @param {ProjectEditor} editor
 * @param {String} [page]
 * @returns {HTMLElement | null} the board, when the page has one
 */
export function openPage(editor, page = 'Overview') {
	if (!document.querySelector('#app__wrapper')) {
		document.body.innerHTML = '<div id="app__wrapper"></div>';
	}
	editor.nav.page = page;
	editor.nav.panel = 'Attributes';
	editor.navigate();
	// jsdom has no <edit-canvas>; the key handler and the letter page redraw it
	if (!editor.editCanvas?.redraw) editor.editCanvas = { redraw() {} };
	return document.querySelector('[data-anyink-board]');
}
