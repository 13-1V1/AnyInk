// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 test fixture: "Brennan Hand", a Simple font with capital A and small a written, capital B
	opened but empty, and (optionally) a gap fix between A and a (kernRight: another right side,
	such as the empty B), or no letter written at all (empty: A and a opened but empty). Opened
	in a real ProjectEditor, the way a user opens it (fontcheck/tests/fixtures.js openProject).
*/
import { openProject, square, twoPointShape } from '../../fontcheck/tests/fixtures.js';

/**
 * @param {{gapFix?: Boolean, strayInA?: Boolean, name?: String, empty?: Boolean,
 *   kernRight?: String}} [options]
 * @returns {Object} project JSON
 */
export function brennanHandJSON({
	gapFix = false,
	strayInA = false,
	name = 'Brennan Hand',
	empty = false,
	kernRight = '0x61',
} = {}) {
	const json = {
		settings: {
			project: {
				name,
				latestVersion: '2.10.5',
				initialVersion: '2.10.5',
				id: 'g2_BRENNANHAND',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F', enabled: true }],
			},
			font: {
				family: name,
				style: 'Regular',
				upm: 2048,
				ascent: 1550,
				descent: -440,
				capHeight: 1400,
				xHeight: 1100,
			},
			app: { exportLigatures: true, exportKerning: true, exportUneditedItems: true },
		},
		glyphs: {
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 1200, shapes: [square(100, 0, 1000)] },
			'glyph-0x42': { id: 'glyph-0x42', advanceWidth: 0, shapes: [] },
			'glyph-0x61': {
				id: 'glyph-0x61',
				advanceWidth: 900,
				shapes: strayInA ? [square(100, 0, 700), twoPointShape()] : [square(100, 0, 700)],
			},
		},
		ligatures: {},
		components: {},
		kerning: gapFix
			? { 'kern-0': { id: 'kern-0', leftGroup: ['0x41'], rightGroup: [kernRight], value: -60 } }
			: {},
	};
	if (empty) {
		json.glyphs['glyph-0x41'].shapes = [];
		json.glyphs['glyph-0x61'].shapes = [];
	}
	return json;
}

/**
 * @param {Object} [options] - brennanHandJSON's
 * @returns {Object} the ProjectEditor, current
 */
export function openBrennanHand(options) {
	return openProject(brennanHandJSON(options));
}
