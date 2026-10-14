// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Font check test fixtures: projects opened in a real ProjectEditor, the way a user
	opens them. Each call builds a fresh project, because an export can add letters
	(missing ligature sources) to the project it exports.
*/
import { setCurrentProjectEditor } from '../../../app/main.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import OBLEGG_TEXT from '../../../samples/oblegg.gs2?raw';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';

/** A closed 4-point square from (x, y), size s. */
export function square(x = 100, y = 0, s = 400) {
	return {
		name: 'Square',
		pathPoints: [
			{ p: { coord: { x, y } } },
			{ p: { coord: { x: x + s, y } } },
			{ p: { coord: { x: x + s, y: y + s } } },
			{ p: { coord: { x, y: y + s } } },
		],
	};
}

/** A closed 2-point shape (the font file can't hold it well). */
export function twoPointShape(x = 100, y = 0) {
	return {
		name: 'Two points',
		pathPoints: [{ p: { coord: { x, y } } }, { p: { coord: { x: x + 300, y: y + 300 } } }],
	};
}

/** A curved 4-point shape with handles and fractional coordinates. */
export function roundShape() {
	return {
		name: 'Round',
		pathPoints: [
			{
				p: { coord: { x: 300.4, y: 0.6 } },
				h1: { coord: { x: 150.25, y: 0.6 } },
				h2: { coord: { x: 450.75, y: 0.6 } },
				type: 'symmetric',
			},
			{
				p: { coord: { x: 600.5, y: 300.5 } },
				h1: { coord: { x: 600.5, y: 150.2 } },
				h2: { coord: { x: 600.5, y: 450.8 } },
				type: 'symmetric',
			},
			{
				p: { coord: { x: 300.4, y: 600.49 } },
				h1: { coord: { x: 450.75, y: 600.49 } },
				h2: { coord: { x: 150.25, y: 600.49 } },
				type: 'symmetric',
			},
			{
				p: { coord: { x: 0.2, y: 300.5 } },
				h1: { coord: { x: 0.2, y: 450.8 } },
				h2: { coord: { x: 0.2, y: 150.2 } },
				type: 'symmetric',
			},
		],
	};
}

/**
 * The edge project: every path through the exporter's list of letters.
 * - Basic Latin on, Latin-1 Supplement off (é has ink but is not exported)
 * - A, B (fractional width and points), D (curves), an empty C, b made of a component
 *   instance of A, a ligature f+i whose source letters don't exist yet, one kern pair
 * @param {Object} [overrides] - merged into settings.project / settings.app
 * @returns {Object} project JSON
 */
export function edgeProjectJSON({ project = {}, app = {} } = {}) {
	return {
		settings: {
			project: {
				name: 'Check Edge',
				latestVersion: '2.10.5',
				initialVersion: '2.10.5',
				id: 'g2_FONTCHECKEDGE',
				characterRanges: [
					{ name: 'Basic Latin', begin: '0x20', end: '0x7F', enabled: true },
					{ name: 'Latin-1 Supplement', begin: '0x80', end: '0xFF', enabled: false },
				],
				...project,
			},
			font: {
				family: 'Check Edge',
				style: 'Regular',
				upm: 2048,
				ascent: 1550,
				descent: -440,
				capHeight: 1400,
				xHeight: 1100,
			},
			app: { exportLigatures: true, exportKerning: true, exportUneditedItems: true, ...app },
		},
		glyphs: {
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 1200, shapes: [square(100, 0, 1000)] },
			'glyph-0x42': {
				id: 'glyph-0x42',
				advanceWidth: 654.338,
				shapes: [square(50.4, 0.5, 500.3)],
			},
			'glyph-0x43': { id: 'glyph-0x43', advanceWidth: 0, shapes: [] },
			'glyph-0x44': { id: 'glyph-0x44', advanceWidth: 700, shapes: [roundShape()] },
			'glyph-0x62': {
				id: 'glyph-0x62',
				advanceWidth: 1300,
				shapes: [{ link: 'glyph-0x41', translateX: 50, translateY: 0 }],
			},
			'glyph-0xE9': { id: 'glyph-0xE9', advanceWidth: 600, shapes: [square()] },
		},
		ligatures: {
			'liga-0x66-0x69': { id: 'liga-0x66-0x69', advanceWidth: 900, shapes: [square(0, 0, 800)] },
		},
		components: {},
		kerning: {
			'kern-0': { id: 'kern-0', leftGroup: ['0x41'], rightGroup: ['0x42'], value: -50 },
		},
	};
}

/**
 * Opens project JSON (or .gs2 text) in a fresh editor and makes it current.
 * @param {Object | String} json
 * @returns {ProjectEditor}
 */
export function openProject(json) {
	setCurrentProjectEditor(new ProjectEditor());
	const text = typeof json === 'string' ? json : JSON.stringify(json);
	const project = importGlyphrProjectFromText(text);
	const editor = new ProjectEditor({ project });
	setCurrentProjectEditor(editor);
	return editor;
}

export const openSimpleExample = () => openProject(structuredClone(simpleExampleProject));
export const openOblegg = () => openProject(OBLEGG_TEXT);
export const openEdge = (overrides) => openProject(edgeProjectJSON(overrides));
