// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 (docs/SKETCH.md section 7, "Ink rule"): a sketched letter's tile. Shapes built from a sketch
	are ink by the one rule, so a sketched letter with built ink is Ready; a sketch with no built ink
	yet is still Empty (the ink rule reads shapes, never the sketch). Built shapes are drawn, never
	"from a photo", even over a photo, as brush strokes are. Written to fail first on the
	"drawn" case (sourceOf counted any untagged-by-the-Brush shape as traced).
*/
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GlyphTile } from '../../../controls/glyph-tile/glyph_tile.js';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { addPiece, addPoint, newSketch, setSketch } from '../../sketch/model.js';
import { tagBuilt } from '../../sketch/sketch_record.js';
import { hasInk, isEmptyLetter } from '../letter_set.js';
import { tileStateOf } from '../tile_state.js';

beforeAll(() => {
	if (!customElements.get('glyph-tile')) customElements.define('glyph-tile', GlyphTile);
});
afterEach(() => setModeForTests('all'));

const corner = (x, y) => ({ p: { coord: { x, y } } });
const stem = () =>
	new Path({
		name: 'Built',
		pathPoints: [corner(250, 0), corner(350, 0), corner(350, 1050), corner(250, 1050)],
	});
const TRACE = { asset: 'img-0001', width: 100, height: 100, x: 0, y: 700, scale: 7 };

/** n's stem, sketched; built: its built shape on the letter, tagged */
function sketchedN({ built = true, trace = false } = {}) {
	const project = new GlyphrStudioProject();
	const id = 'glyph-0x6E';
	const glyph = new Glyph({ id, anyink: trace ? { trace: { ...TRACE } } : {} });
	const sketch = newSketch({ thickness: 99 });
	const a = addPoint(sketch, { x: 300, y: 50, kind: 'corner' });
	const b = addPoint(sketch, { x: 300, y: 1000, kind: 'corner' });
	const pieceId = addPiece(sketch, { parts: [{ type: 'line', from: a, to: b }] }).id;
	setSketch(glyph, sketch);
	if (built) {
		glyph.addOneShape(stem());
		tagBuilt(glyph.shapes[0], { id: pieceId, key: sketch.key });
	}
	project.glyphs[id] = glyph;
	return { project, glyph };
}

describe("a sketched letter's tile", () => {
	// S4 turned 'sketch' on: a stem alone is then plainly unfinished (sketch_unfinished.js, its own
	// tests); the ink rule is read here with the flag off, as written
	it('built ink: Ready, by the one ink rule', () => {
		setFeaturesForTests({ sketch: false });
		setModeForTests('simple');
		const { project, glyph } = sketchedN();
		expect(hasInk(glyph)).toBe(true);
		expect(tileStateOf(project, 'n', { checksOn: false })).toMatchObject({
			state: 'ready',
			source: 'drawn',
		});
	});

	it('a sketch with no built ink yet: Empty (the sketch is never ink)', () => {
		setModeForTests('simple');
		const { project, glyph } = sketchedN({ built: false });
		expect(isEmptyLetter(glyph)).toBe(true);
		expect(tileStateOf(project, 'n', { checksOn: false }).state).toBe('empty');
	});

	it('built over a photo: drawn, never "from a photo"', () => {
		setFeaturesForTests({ sketch: false });
		setModeForTests('simple');
		const { project } = sketchedN({ trace: true });
		const info = tileStateOf(project, 'n', { checksOn: false });
		expect(info.source).toBe('drawn');
		expect(info.title).toBe('small n · Ready · drawn');
	});

	it('guard: a traced shape beside the built one still makes it "from a photo"', () => {
		setModeForTests('simple');
		const { project, glyph } = sketchedN({ trace: true });
		glyph.addOneShape(stem());
		expect(tileStateOf(project, 'n', { checksOn: false }).source).toBe('photo');
	});
});
