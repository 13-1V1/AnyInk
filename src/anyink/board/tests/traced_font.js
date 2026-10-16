// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Test helper (B10 board-tiles): a 58-letter traced font with its Undo list at its fullest, for
	the backup write time (UX-BEGINNER.md 7.3: "B10 and B12 measure the backup write time on a
	58-letter traced font with the list at its fullest against D-026's 100 ms point"; D-033's
	limits: 200 steps, 30 whole-font steps, 30 "Navigated to" entries; D-041: such a font holds
	about 5,000 points). Used by board_backup.test.js (jsdom) and tests/board_tiles.verify.mjs
	(real Chrome, real IndexedDB), so both measure the same font. Not shipped.

	  tracedLetter(char, { asset, points })   a Glyph like a traced letter: two closed curves
	                                          (outside and a hole), every point with handles,
	                                          whole units, its photo under it (item.anyink.trace)
	  buildTracedFont(editor, options)        every board letter traced, one photo for all of
	                                          them in editor.assets and in the photo list
	                                          (settings.anyink.photos); returns { asset, points }
	  fillUndoList(editor, { steps, wholeFont, navigation })   the list as full as the limits
	                                          let it be: item steps on the letters in turn, then
	                                          whole-font steps (the letter spacing) mixed in;
	                                          navigation: All tools' "Navigated to" entries
	  undoListSize(history)                   { steps, wholeFont, navigation, entries }
*/
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { QUICK_SET } from '../letter_set.js';

/** Points per letter: 58 letters x 86 = 4,988, D-041's "about 5,000" */
export const POINTS_PER_LETTER = 86;

/** The size of a stored photo (a capped 2000 px WebP of a phone photo) */
export const PHOTO_BYTES = 650000;

/**
 * A closed curve of n points round (cx, cy), every point smooth with both handles.
 * @returns {Path}
 */
function curve(cx, cy, rx, ry, n, { reversed = false, name = 'Shape' } = {}) {
	const points = [];
	for (let i = 0; i < n; i++) {
		const a = ((reversed ? -1 : 1) * 2 * Math.PI * i) / n;
		const x = Math.round(cx + rx * Math.cos(a));
		const y = Math.round(cy + ry * Math.sin(a));
		// handles along the tangent, a third of the way to the neighbors
		const tx = Math.round(((-rx * Math.sin(a) * 2 * Math.PI) / n / 3) * (reversed ? -1 : 1));
		const ty = Math.round(((ry * Math.cos(a) * 2 * Math.PI) / n / 3) * (reversed ? -1 : 1));
		points.push({
			p: { coord: { x, y } },
			h1: { coord: { x: x - tx, y: y - ty } },
			h2: { coord: { x: x + tx, y: y + ty } },
			type: 'smooth',
		});
	}
	return new Path({ name, pathPoints: points });
}

/**
 * @param {String} char
 * @param {{asset: String, points?: Number}} options
 * @returns {Glyph}
 */
export function tracedLetter(char, { asset, points = POINTS_PER_LETTER }) {
	const id = `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
	const outside = Math.ceil(points * 0.58);
	const glyph = new Glyph({
		id,
		advanceWidth: 1100,
		anyink: {
			trace: {
				asset,
				width: 2000,
				height: 1500,
				x: -420 - char.charCodeAt(0),
				y: 1900,
				scale: 1.9,
				opacity: 0.25,
				locked: true,
			},
			spacing: 'auto',
		},
	});
	glyph.addOneShape(curve(550, 700, 450, 690, outside, { name: 'Shape 1' }));
	glyph.addOneShape(curve(550, 700, 230, 400, points - outside, { reversed: true, name: 'Shape 2' }));
	return glyph;
}

/**
 * @param {Object} editor - ProjectEditor
 * @param {{letters?: Array<String>, points?: Number, photoBytes?: Number}} [options]
 * @returns {{asset: String, points: Number}}
 */
export function buildTracedFont(
	editor,
	{ letters = QUICK_SET, points = POINTS_PER_LETTER, photoBytes = PHOTO_BYTES } = {}
) {
	const bytes = new Uint8Array(photoBytes);
	for (let i = 0; i < bytes.length; i += 97) bytes[i] = i % 251;
	const asset = editor.assets.add(new Blob([bytes], { type: 'image/webp' }));
	const project = editor.project;
	const parts = [];
	const used = {};
	letters.forEach((char, i) => {
		const glyph = tracedLetter(char, { asset, points });
		project.glyphs[glyph.id] = glyph;
		const id = `p${i + 1}`;
		const left = 40 + (i % 10) * 190;
		const top = 40 + Math.floor(i / 10) * 240;
		parts.push({ id, left, top, right: left + 150, bottom: top + 200, row: Math.floor(i / 10) });
		used[id] = { char, itemId: glyph.id, seq: i + 1 };
	});
	project.settings.anyink.photos = {
		[asset]: {
			asset,
			width: 2000,
			height: 1500,
			paper: 'photo',
			lightInk: false,
			find: { paper: 'photo', lightInk: false },
			fingerprint: 'f0f0f0f0-0f0f0f0f',
			added: 1,
			pen: 9,
			parts,
			used,
			skipped: [],
			done: true,
			scale: 1.9,
		},
	};
	return { asset, points: letters.length * points };
}

/**
 * The Undo list as full as the limits let it be (undo_cap.js: 200 steps, 30 whole-font steps;
 * All tools also 30 "Navigated to" entries).
 * @param {Object} editor
 * @param {{steps?: Number, wholeFont?: Number, navigation?: Number, letters?: Array<String>}} [o]
 */
export function fillUndoList(
	editor,
	{ steps = 200, wholeFont = 30, navigation = 0, letters = QUICK_SET } = {}
) {
	const history = editor.history;
	const itemSteps = steps - wholeFont;
	const every = Math.max(1, Math.floor(itemSteps / Math.max(1, wholeFont)));
	let font = 0;
	let nav = 0;
	editor.nav.page = 'Characters';
	for (let i = 0; i < itemSteps; i++) {
		const char = letters[i % letters.length];
		editor.selectedGlyphID = `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
		if (nav < navigation) {
			history.addState(`Navigated to ${editor.project.getItemName(editor.selectedGlyphID, true)}`);
			nav++;
		}
		const point = editor.selectedGlyph.shapes[0].pathPoints[i % 10];
		point.p.x += 1;
		history.addState(`traced ${char}`);
		if ((i + 1) % every === 0 && font < wholeFont) {
			history.addWholeProjectChangePreState('moved all letters closer', { itemID: null });
			letters.forEach((c) => {
				const glyph = editor.project.getItem(
					`glyph-0x${c.codePointAt(0).toString(16).toUpperCase()}`
				);
				glyph.advanceWidth += 1;
			});
			history.addWholeProjectChangePostState();
			font++;
		}
	}
}

/**
 * @param {Object} history
 * @returns {{steps: Number, wholeFont: Number, navigation: Number, entries: Number}}
 */
export function undoListSize(history) {
	const queue = history.queue || [];
	const navigation = queue.filter((e) => /^Navigated to /.test(e.title || '')).length;
	const posts = queue.filter((e) => e.title === '_whole_project_change_post_state_').length;
	const items = queue.filter(
		(e) => !e.wholeProjectSave && !e.settingsSave && !/^Navigated to /.test(e.title || '')
	).length;
	return { steps: items + posts, wholeFont: posts, navigation, entries: queue.length };
}
