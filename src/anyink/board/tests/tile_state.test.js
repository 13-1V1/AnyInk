// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: tile states (UX-BEGINNER.md 4.2 Tiles, "Ready"; section 10 B10 "tile states").
	  Empty        no ink (no record, no shapes, or only a stray line): a faint outlined letter,
	               dashed border, "Empty"
	  Ready        his ink: "Ready", the tooltip says "from a photo" or "drawn"
	  Needs a look his ink and a check that fails (B11, only once 'checks' is on): amber, "!",
	               "Needs a look", the tooltip gives the reason
	  Last touched a green outline ring
	The tile is GlyphTile with its session-state grown into these states, a caption and a badge;
	a tile with no board attribute is upstream's, unchanged. Every word passes the banned-word scan.
	Written before tile_state.js existed and before GlyphTile knew the board states.
*/
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { tagStroke } from '../../nib/stroke_record.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import {
	lastTouchedChar,
	makeBoardTile,
	tileAttributes,
	tileStateOf,
	TILE_STATES,
	updateBoardTile,
} from '../tile_state.js';

beforeAll(() => {
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
});
afterEach(() => {
	document.body.innerHTML = '';
	setModeForTests('all');
});

const corner = (x, y) => ({ p: { coord: { x, y } } });
const square = (x = 0, size = 400) =>
	new Path({
		name: 'Ink',
		pathPoints: [corner(x, 0), corner(x + size, 0), corner(x + size, size), corner(x, size)],
	});
const line = () => new Path({ name: 'Line', pathPoints: [corner(0, 0), corner(300, 0)] });
const TRACE = { asset: 'img-0001', width: 100, height: 100, x: 0, y: 700, scale: 7 };

/** A font with: B traced from a photo, a drawn with the brush, c a stray line, e traced */
function seededFont() {
	const project = new GlyphrStudioProject();
	const add = (char, shapes, anyink = {}) => {
		const id = `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
		const glyph = new Glyph({ id, anyink });
		shapes.forEach((shape) => glyph.addOneShape(shape));
		project.glyphs[id] = glyph;
		return glyph;
	};
	add('B', [square(), square(500)], { trace: { ...TRACE } });
	const stroke = square(100, 200);
	tagStroke(stroke, 1);
	add('a', [stroke]);
	add('c', [line()]);
	add('e', [square()], { trace: { ...TRACE } });
	// a photo under it, but every shape is a brush stroke: he drew it himself
	const over = square(0, 300);
	tagStroke(over, 1);
	add('d', [over], { trace: { ...TRACE } });
	return project;
}

const B11 = {
	id: 'line',
	reason: 'small e floats above the writing line.',
	short: 'floats above the writing line',
	fixLabel: 'Sit on the line',
};

describe('tile states', () => {
	it('the states the board knows', () => {
		expect(TILE_STATES).toEqual(['empty', 'ready', 'needsLook', 'sheet']);
	});

	it('Empty: no record, or a record with no ink (a stray line is no ink)', () => {
		setModeForTests('simple');
		const project = seededFont();
		const none = tileStateOf(project, 'Q');
		expect(none).toMatchObject({ char: 'Q', itemId: 'glyph-0x51', state: 'empty', source: null });
		expect(none.caption).toBe('Empty');
		expect(none.title).toBe('Capital Q · Empty');
		// looking never makes a record
		expect(project.getItem('glyph-0x51')).toBeFalsy();
		expect(tileStateOf(project, 'c').state).toBe('empty');
	});

	it('Ready: from a photo, or drawn (a photo under brush strokes alone is drawn)', () => {
		setModeForTests('simple');
		const project = seededFont();
		const traced = tileStateOf(project, 'B');
		expect(traced).toMatchObject({ state: 'ready', source: 'photo', caption: 'Ready' });
		expect(traced.title).toBe('Capital B · Ready · from a photo');
		const drawn = tileStateOf(project, 'a');
		expect(drawn).toMatchObject({ state: 'ready', source: 'drawn' });
		expect(drawn.title).toBe('small a · Ready · drawn');
		expect(tileStateOf(project, 'd').source).toBe('drawn');
	});

	it('Needs a look comes only from B11\'s checks, and only once \'checks\' is on', () => {
		setModeForTests('simple');
		const project = seededFont();
		const asked = [];
		const checks = (item, { char }) => {
			asked.push(char);
			return char === 'e' ? B11 : null;
		};
		// the stub until B11: Ready = has ink
		expect(tileStateOf(project, 'e', { checks, checksOn: false }).state).toBe('ready');
		expect(asked).toEqual([]);

		const look = tileStateOf(project, 'e', { checks, checksOn: true });
		expect(look).toMatchObject({ state: 'needsLook', caption: 'Needs a look' });
		expect(look.title).toBe('small e · Needs a look: floats above the writing line');
		expect(look.look).toBe(B11);
		expect(tileStateOf(project, 'B', { checks, checksOn: true }).state).toBe('ready');
		// an empty letter is never checked
		tileStateOf(project, 'Q', { checks, checksOn: true });
		expect(asked).not.toContain('Q');
		// with no short reason the sentence stands, without its final period
		const plain = tileStateOf(project, 'e', {
			checks: () => ({ id: 'x', reason: 'Thicker than the rest.' }),
			checksOn: true,
		});
		expect(plain.title).toBe('small e · Needs a look: Thicker than the rest');
		// the default follows the flag
		setFeaturesForTests({ checks: true });
		expect(tileStateOf(project, 'e', { checks }).state).toBe('needsLook');
	});

	it('the last touched letter: the one he had open, when the board shows it', () => {
		const project = seededFont();
		expect(lastTouchedChar({ project, selectedItemID: 'glyph-0x42' })).toBe('B');
		expect(lastTouchedChar({ project, selectedItemID: 'glyph-0x20' })).toBe('');
		expect(lastTouchedChar({ project, selectedItemID: 'liga-0x66-0x69' })).toBe('');
		expect(lastTouchedChar({ project, selectedItemID: false })).toBe('');
	});
});

describe('the tile itself (GlyphTile, grown)', () => {
	const parts = (tile) => ({
		wrapper: tile.shadowRoot.querySelector('.wrapper'),
		caption: tile.shadowRoot.querySelector('.caption'),
		mark: tile.shadowRoot.querySelector('.mark'),
		badge: tile.shadowRoot.querySelector('.badge'),
		standIn: tile.shadowRoot.querySelector('.stand-in'),
		svg: tile.shadowRoot.querySelector('.thumbnail svg'),
	});

	it('an empty tile: the faint letter, "Empty", a button named in words', () => {
		setModeForTests('simple');
		const project = seededFont();
		const tile = makeBoardTile(project, 'Q');
		document.body.appendChild(tile);
		const p = parts(tile);
		expect(tile.hasAttribute('board')).toBe(true);
		expect(tile.getAttribute('data-anyink-char')).toBe('Q');
		expect(p.wrapper.getAttribute('session-state')).toBe('empty');
		expect(p.caption.textContent).toBe('Empty');
		expect(p.standIn.textContent).toBe('Q');
		expect(p.svg).toBeNull();
		expect(tile.getAttribute('title')).toBe('Capital Q · Empty');
		expect(tile.getAttribute('role')).toBe('button');
		expect(tile.getAttribute('aria-label')).toBe('Capital Q · Empty');
		expect(tile.getAttribute('tabindex')).toBe('-1');
	});

	it('a ready tile: his ink and "Ready"; needs a look: amber "!" and the reason', () => {
		setModeForTests('simple');
		const project = seededFont();
		const ready = makeBoardTile(project, 'B');
		document.body.appendChild(ready);
		expect(parts(ready).svg).not.toBeNull();
		expect(parts(ready).standIn).toBeNull();
		expect(parts(ready).caption.textContent).toBe('Ready');
		expect(parts(ready).wrapper.getAttribute('session-state')).toBe('ready');

		const look = makeBoardTile(project, 'e', { checks: () => B11, checksOn: true });
		document.body.appendChild(look);
		expect(parts(look).wrapper.getAttribute('session-state')).toBe('needsLook');
		expect(parts(look).caption.textContent).toBe('Needs a look');
		expect(parts(look).mark.textContent).toBe('!');
		expect(look.getAttribute('title')).toBe('small e · Needs a look: floats above the writing line');
	});

	it('last touched: a green ring and the one tab stop; a badge shows only when given', () => {
		setModeForTests('simple');
		const project = seededFont();
		const tile = makeBoardTile(project, 'B', { lastTouched: true });
		document.body.appendChild(tile);
		expect(tile.hasAttribute('last-touched')).toBe(true);
		expect(tile.getAttribute('tabindex')).toBe('0');
		expect(parts(tile).badge.hidden).toBe(true);
		tile.setAttribute('badge', 'x3');
		expect(parts(tile).badge.hidden).toBe(false);
		expect(parts(tile).badge.textContent).toBe('x3');
	});

	it('updateBoardTile changes the same tile in place: Empty, then Ready once it has ink', () => {
		setModeForTests('simple');
		const project = seededFont();
		const tile = makeBoardTile(project, 'Q');
		document.body.appendChild(tile);
		const glyph = new Glyph({ id: 'glyph-0x51' });
		glyph.addOneShape(square());
		project.glyphs['glyph-0x51'] = glyph;
		const same = updateBoardTile(tile, tileStateOf(project, 'Q'));
		expect(same).toBe(tile);
		expect(parts(tile).wrapper.getAttribute('session-state')).toBe('ready');
		expect(parts(tile).caption.textContent).toBe('Ready');
		expect(parts(tile).svg).not.toBeNull();
		expect(parts(tile).standIn).toBeNull();
		expect(tile.getAttribute('title')).toBe('Capital Q · Ready · drawn');
		// and back
		project.glyphs['glyph-0x51'].shapes = [];
		updateBoardTile(tile, tileStateOf(project, 'Q'));
		expect(parts(tile).standIn.textContent).toBe('Q');
		expect(parts(tile).caption.textContent).toBe('Empty');
	});

	it('the attributes the board passes', () => {
		setModeForTests('simple');
		const info = tileStateOf(seededFont(), 'B');
		expect(tileAttributes(info, { lastTouched: true })).toEqual({
			board: '',
			'displayed-item-id': 'glyph-0x42',
			'data-anyink-char': 'B',
			'session-state': 'ready',
			caption: 'Ready',
			title: 'Capital B · Ready · from a photo',
			'aria-label': 'Capital B · Ready · from a photo',
			role: 'button',
			tabindex: '0',
			'last-touched': '',
		});
		expect(tileAttributes(info)).not.toHaveProperty('last-touched');
		expect(tileAttributes(info).tabindex).toBe('-1');
	});

	it('a tile with no board attribute is upstream\'s, as before: no caption, no stand-in', () => {
		const project = seededFont();
		const tile = new GlyphTile({ 'displayed-item-id': 'glyph-0x42', project });
		document.body.appendChild(tile);
		expect(tile.hasAttribute('board')).toBe(false);
		expect(tile.shadowRoot.querySelector('.caption')).toBeNull();
		expect(tile.shadowRoot.querySelector('.stand-in')).toBeNull();
		expect(tile.hasAttribute('role')).toBe(false);
		expect(tile.shadowRoot.querySelector('.name').textContent).toBe('B');
		expect(tile.getAttribute('title')).toContain('glyph-0x42');
	});
});

describe('words', () => {
	it('captions and tooltips come from the words file', () => {
		setModeForTests('simple');
		const project = seededFont();
		expect(tileStateOf(project, 'Q').caption).toBe(word('boardTile.caption.empty'));
		expect(tileStateOf(project, 'B').caption).toBe(word('boardTile.caption.ready'));
	});

	scanSimpleScreen('letter board tiles, every state', () => {
		setFeaturesForTests({ board: true, checks: true });
		const project = seededFont();
		const board = document.createElement('div');
		const checks = (item, { char }) => (char === 'e' ? B11 : null);
		['B', 'a', 'c', 'd', 'e', 'Q', '.', '?'].forEach((char) => {
			board.appendChild(makeBoardTile(project, char, { checks, lastTouched: char === 'B' }));
		});
		document.body.appendChild(board);
		return board;
	});
});
