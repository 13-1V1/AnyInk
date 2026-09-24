// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7 integration: the trace image is reference only. Only the edit canvas draws
// it; the glyph tiles, the preview strip (DisplayCanvas uses drawGlyph), the per-glyph
// SVG export and the glyph's own path data must come out exactly the same with or
// without a trace, and never mention the image.
import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { drawGlyph, drawGlyphOutlineMode } from '../../../display_canvas/draw_paths.js';
import { makeGlyphSVGforExport } from '../../../project_editor/cross_item_actions.js';
import { importGlyphrProjectFromText } from '../../../project_editor/import_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { makeTrace, setTrace } from '../trace_model.js';

const OBLEGG = fs.readFileSync(path.resolve(__dirname, '../../../samples/oblegg.gs2'), 'utf8');
const ASSET = 'img-isolate1';
const VIEW = { dx: 20, dy: 300, dz: 0.2 };

let editor;

function openOblegg() {
	setCurrentProjectEditor(new ProjectEditor());
	const project = importGlyphrProjectFromText(OBLEGG);
	const next = new ProjectEditor({ project });
	setCurrentProjectEditor(next);
	return next;
}

function traceOn(item) {
	const trace = makeTrace({ asset: ASSET, width: 600, height: 800 }, editor.project.settings.font);
	expect(setTrace(item, { ...trace, opacity: 1, invert: true })).toBe(true);
}

/** Everything a render produced, as comparable text. */
function renders(item) {
	const canvas = document.createElement('canvas');
	canvas.width = 400;
	canvas.height = 400;
	const ctx = canvas.getContext('2d');
	drawGlyph(item, ctx, { ...VIEW });
	drawGlyphOutlineMode(item, ctx, { ...VIEW });
	return {
		thumbnail: editor.project.makeItemThumbnail(item),
		svgExport: makeGlyphSVGforExport(item),
		pathData: item.svgPathData,
		canvas: JSON.stringify(ctx.__getEvents()),
		drawImage: ctx.__getEvents().filter((e) => e.type === 'drawImage').length,
	};
}

beforeEach(() => {
	editor = openOblegg();
	editor.assets.add(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), {
		id: ASSET,
	});
});

describe('the trace never leaves the edit canvas', () => {
	const cases = [
		['a glyph', () => editor.project.glyphs['glyph-0x41']],
		['a ligature', () => editor.project.ligatures['liga-f-i']],
		['a component', () => editor.project.components['comp-0']],
	];

	for (const [name, pick] of cases) {
		it(`draws ${name} the same in tiles, the strip renderer, and SVG export`, () => {
			const item = pick();
			expect(item, name).toBeTruthy();
			const before = renders(item);
			traceOn(item);
			item.cache = {};
			const after = renders(item);

			expect(after).toEqual(before);
			expect(after.drawImage).toBe(0);
			for (const text of [after.thumbnail, after.svgExport, after.pathData, after.canvas]) {
				expect(text).not.toContain(ASSET);
				expect(text).not.toContain('<image');
			}
		});
	}

	it('keeps a glyph that uses a traced component drawing only outlines', () => {
		const component = editor.project.components['comp-0'];
		const user = Object.values(editor.project.glyphs).find((glyph) =>
			glyph.shapes.some((shape) => shape.objType === 'ComponentInstance' && shape.link === 'comp-0')
		);
		expect(user, 'oblegg has a glyph that uses comp-0').toBeTruthy();
		const before = renders(user);
		traceOn(component);
		user.cache = {};
		const after = renders(user);
		expect(after).toEqual(before);
		expect(after.drawImage).toBe(0);
	});
});
