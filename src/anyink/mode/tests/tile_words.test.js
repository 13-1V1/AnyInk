// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 + B5 fix track (UX-BEGINNER.md principle 6 "never silently wrong", 2.2): in Simple a letter
// tile's tooltip says what the tile shows, from the letter's ink, not from upstream's session
// state. Upstream's 'new' means "made this session, not yet marked edited", and the Rectangle tool
// doesn't mark it, so a drawn letter said "Nothing drawn yet." Every empty letter, with a record
// or not, says the same "Not made yet. Click to start it."; a letter with ink made or changed this
// session says so; one with ink from the file says only its name. All tools keeps upstream's text.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { setModeForTests } from '../mode.js';
import { tileTitle } from '../simple_labels.js';
import { word } from '../../words/words.js';
import { sampleEditor } from './controls_probe.js';

const rectangle = (name = 'Rectangle') => ({
	name,
	objType: 'Path',
	pathPoints: [
		{ p: { coord: { x: 0, y: 0 } } },
		{ p: { coord: { x: 100, y: 0 } } },
		{ p: { coord: { x: 100, y: 100 } } },
		{ p: { coord: { x: 0, y: 100 } } },
	],
});

const NOT_MADE = word('tile.notMade');
const CHANGED = word('tile.changed');

let editor;
beforeEach(() => {
	editor = sampleEditor();
});
afterEach(() => {
	document.body.innerHTML = '';
});

/**
 * A letter record in the open font, with upstream's session state set
 * @param {String} id
 * @param {'new' | 'changed' | 'old'} state
 */
function letter(id, state) {
	editor.selectedGlyphID = id;
	const glyph = editor.selectedGlyph;
	glyph.wasCreatedThisSession = state === 'new';
	glyph.hasChangedThisSession = state === 'changed';
	return glyph;
}

/** The tooltip the real tile draws for one letter */
function tileTooltip(id) {
	const tile = new GlyphTile({ 'displayed-item-id': id });
	return tile.getAttribute('title');
}

describe('Simple: the tooltip follows the ink', () => {
	beforeEach(() => setModeForTests('simple'));

	it('a letter drawn this session that upstream still calls "new" says it changed, never "Nothing drawn yet."', () => {
		const glyph = letter('glyph-0x62', 'new');
		glyph.addOneShape(rectangle());
		glyph.hasChangedThisSession = false;
		expect(glyph.sessionState).toBe('new');
		expect(tileTooltip('glyph-0x62')).toBe(`small b\n\n${CHANGED}`);
	});

	it('an empty letter with a record says the same as one with none', () => {
		// Capital A on a new font: made this session, nothing drawn
		expect(letter('glyph-0x62', 'new').shapes).toHaveLength(0);
		expect(tileTooltip('glyph-0x62')).toBe(`small b\n\n${NOT_MADE}`);
		letter('glyph-0x64', 'changed');
		expect(tileTooltip('glyph-0x64')).toBe(`small d\n\n${NOT_MADE}`);
		expect(tileTooltip('glyph-0x63')).toBe(`small c\n\n${NOT_MADE}`);
	});

	it('a letter with ink from the file: its name only', () => {
		const glyph = editor.project.getItem('glyph-0x41');
		expect(glyph.shapes.length).toBeGreaterThan(0);
		glyph.hasChangedThisSession = false;
		expect(glyph.sessionState).toBe('old');
		expect(tileTooltip('glyph-0x41')).toBe('Capital A');
	});

	it('tileTitle takes the letter itself when the caller has it', () => {
		const empty = { shapes: [] };
		const inked = { shapes: [{}] };
		expect(tileTitle('a', 'new', 'upstream', empty)).toBe(`small a\n\n${NOT_MADE}`);
		expect(tileTitle('a', 'new', 'upstream', inked)).toBe(`small a\n\n${CHANGED}`);
		expect(tileTitle('a', 'changed', 'upstream', empty)).toBe(`small a\n\n${NOT_MADE}`);
		expect(tileTitle('a', 'old', 'upstream', inked)).toBe('small a');
		expect(tileTitle('a', 'notCreated', 'upstream', null)).toBe(`small a\n\n${NOT_MADE}`);
	});
});

describe('All tools: upstream text, as today', () => {
	it('keeps the id and the session words', () => {
		letter('glyph-0x62', 'new').addOneShape(rectangle());
		expect(tileTooltip('glyph-0x62')).toMatch(/glyph-0x62/);
		expect(tileTitle('a', 'new', 'upstream', { shapes: [{}] })).toBe('upstream');
	});
});

// B4 + B5 finalize (mode track's hand-off): a tile reads the ink of its own font's letter, not the
// open font's: the tiles of another font (the second font's chooser) say what that font holds.
describe("Simple: a tile of another font says that font's ink", () => {
	it('an empty letter in the other font is "Not made yet", though the open font has it', () => {
		setModeForTests('simple');
		const first = editor;
		expect(first.project.getItem('glyph-0x41').shapes.length).toBeGreaterThan(0);
		const other = sampleEditor().project;
		other.getItem('glyph-0x41').shapes = [];
		setCurrentProjectEditor(first); // the open font is the first one again
		const tile = new GlyphTile({ 'displayed-item-id': 'glyph-0x41', project: other });
		expect(tile.getAttribute('title')).toBe(`Capital A\n\n${NOT_MADE}`);
	});
});
