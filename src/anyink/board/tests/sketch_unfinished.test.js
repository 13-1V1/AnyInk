// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 fix pass (door-coach, written to fail first): a sketched letter plainly missing strokes is
	never Ready and never "looks done". Found in Chrome: Capital B's stem alone read Ready (1/58)
	with "Pull the thickness until Capital B matches the gray guide letter."; small i's stem alone
	gave "small i looks done. Next: Capital H.". The stand-in rule (until S5's missing parts) reads
	the built ink against the guide letter's box: too narrow, too short, or i / j with no dot.
	Real builds (sketch/build.js rebuildItem) on the build fixtures' font.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { deriveEditorState, letterFacts } from '../../coach/font_facts.js';
import { pickLine } from '../../coach/rules.js';
import { setLooksFine } from '../../checks/looks_fine.js';
import { flagsOn, resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { rebuildItem } from '../../sketch/build.js';
import { setSketch, sketchOf } from '../../sketch/model.js';
import {
	bCenter,
	flatStem,
	oOutline,
	sketchOfPieces,
	line,
	spline,
	vCenter,
} from '../../sketch/tests/fixtures/build_letters.js';
import { STORED_FONT, storedSketch } from '../../sketch/tests/fixtures/stored_sketches.js';
import { SKETCH_UNFINISHED, unfinishedLook, unfinishedReason } from '../sketch_unfinished.js';
import { tileStateOf } from '../tile_state.js';

const IDS = {
	B: 'glyph-0x42',
	n: 'glyph-0x6E',
	i: 'glyph-0x69',
	o: 'glyph-0x6F',
	v: 'glyph-0x76',
	A: 'glyph-0x41',
};
const SKETCH = flagsOn('sketch');

function makeEditor() {
	const glyphs = {};
	Object.values(IDS).forEach((id) => {
		glyphs[id] = { id, advanceWidth: 0, shapes: [] };
	});
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Unfinished',
				id: 'g2_UNFINISHED',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'Unfinished', ...STORED_FONT },
		},
		glyphs,
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	return editor;
}

function built(editor, char, sketch) {
	const item = editor.project.getItem(IDS[char]);
	item.shapes = [];
	setSketch(item, sketch);
	rebuildItem(item, { project: editor.project, force: true });
	item.advanceWidth = Math.round(item.maxes.xMax + 60);
	return item;
}

/** Capital B's stem alone: writing line to capitals line */
const bStem = () =>
	sketchOfPieces(
		'sk_u_Bstem',
		{
			foot: { x: 150, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			top: { x: 150, y: 1431, kind: 'corner', on: 'capitals', inset: 'edge' },
		},
		[{ use: 'center', closed: false, parts: [line('foot', 'top')] }]
	);

/** small i: its stem, and with dot: a one-point dot over the small-letter line */
const iSketch = ({ dot = false } = {}) =>
	sketchOfPieces(
		'sk_u_i',
		{
			foot: { x: 200, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			top: { x: 200, y: 1051, kind: 'corner', on: 'small', inset: 'edge' },
			...(dot ? { dot: { x: 200, y: 1340, kind: 'smooth' } } : {}),
		},
		[
			{ use: 'center', closed: false, parts: [line('foot', 'top')] },
			...(dot ? [{ use: 'center', closed: false, parts: [spline('dot')] }] : []),
		]
	);

const font = () => STORED_FONT;

afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('unfinishedReason: the guide letter box stand-in', () => {
	it("Capital B's stem alone is too narrow; the whole B is not", () => {
		const editor = makeEditor();
		expect(unfinishedReason(built(editor, 'B', bStem()), 'B', { font: font(), isOn: SKETCH })).toBe(
			'narrow'
		);
		expect(
			unfinishedReason(built(editor, 'B', bCenter()), 'B', { font: font(), isOn: SKETCH })
		).toBeNull();
	});

	it("small n's stem alone is too narrow; the stored n is not", () => {
		const editor = makeEditor();
		expect(
			unfinishedReason(built(editor, 'n', flatStem()), 'n', { font: font(), isOn: SKETCH })
		).toBe('narrow');
		expect(
			unfinishedReason(built(editor, 'n', storedSketch('n')), 'n', { font: font(), isOn: SKETCH })
		).toBeNull();
	});

	it("small i's stem alone needs its dot; with the dot it is not unfinished", () => {
		const editor = makeEditor();
		expect(
			unfinishedReason(built(editor, 'i', iSketch()), 'i', { font: font(), isOn: SKETCH })
		).toBe('dot');
		expect(
			unfinishedReason(built(editor, 'i', iSketch({ dot: true })), 'i', {
				font: font(),
				isOn: SKETCH,
			})
		).toBeNull();
	});

	it('finished sketches are never unfinished: o (outline), v, A', () => {
		const editor = makeEditor();
		expect(
			unfinishedReason(built(editor, 'o', oOutline()), 'o', { font: font(), isOn: SKETCH })
		).toBeNull();
		expect(
			unfinishedReason(built(editor, 'v', vCenter()), 'v', { font: font(), isOn: SKETCH })
		).toBeNull();
		expect(
			unfinishedReason(built(editor, 'A', storedSketch('A')), 'A', { font: font(), isOn: SKETCH })
		).toBeNull();
	});

	it('a short letter: a B squashed under the small-letter line', () => {
		const editor = makeEditor();
		const sketch = bCenter();
		Object.values(sketch.points).forEach((p) => {
			p.y = Math.round(p.y * 0.4);
			delete p.on;
			delete p.inset;
		});
		expect(unfinishedReason(built(editor, 'B', sketch), 'B', { font: font(), isOn: SKETCH })).toBe(
			'short'
		);
	});

	it('guards: the flag off, a sketch set aside, no built ink, "Looks fine to me"', () => {
		const editor = makeEditor();
		const item = built(editor, 'B', bStem());
		expect(unfinishedReason(item, 'B', { font: font(), isOn: flagsOn() })).toBeNull();
		sketchOf(item).setAside = true;
		expect(unfinishedReason(item, 'B', { font: font(), isOn: SKETCH })).toBeNull();
		sketchOf(item).setAside = false;
		expect(unfinishedLook(item, 'B', { font: font(), isOn: SKETCH })?.id).toBe(SKETCH_UNFINISHED);
		setLooksFine(item, SKETCH_UNFINISHED);
		expect(unfinishedLook(item, 'B', { font: font(), isOn: SKETCH })).toBeNull();
		const empty = editor.project.getItem(IDS.n);
		setSketch(empty, flatStem());
		expect(unfinishedReason(empty, 'n', { font: font(), isOn: SKETCH })).toBeNull();
	});
});

describe('every reader: not Ready, not "looks done", no thickness sentence', () => {
	function openLetter(char, sketch) {
		setModeForTests('simple');
		setFeaturesForTests({ sketch: true, letterView: true, coach: true, checks: true, board: true });
		const editor = makeEditor();
		built(editor, char, sketch);
		editor.selectedGlyphID = IDS[char];
		return editor;
	}

	it("B's stem alone: the coach's letter is not Ready and needs a look", () => {
		const editor = openLetter('B', bStem());
		const facts = letterFacts(editor.project.getItem(IDS.B), 'B', { editor });
		expect(facts).toMatchObject({ ink: true, ready: false, unfinished: true });
		expect(facts.needsLook).toMatchObject({ id: SKETCH_UNFINISHED });
		expect(facts.needsLook.reason).toBe(
			'Capital B looks unfinished: it is much narrower than the gray guide letter.'
		);
	});

	it("B's stem alone: the tile is not Ready (sketch on, checks off)", () => {
		const editor = openLetter('B', bStem());
		const info = tileStateOf(editor.project, 'B', { checksOn: false, editor });
		expect(info.state).toBe('needsLook');
		expect(info.reason).toBe('looks unfinished');
		const whole = makeEditor();
		built(whole, 'B', bCenter());
		expect(tileStateOf(whole.project, 'B', { checksOn: false, editor: whole }).state).toBe('ready');
	});

	it("B's stem alone: the Next line never says it matches the guide letter", () => {
		const editor = openLetter('B', bStem());
		const isOn = (f) => f !== 'photo';
		const state = { ...deriveEditorState(editor, { isOn }), isOn };
		const line = pickLine(state);
		expect(line.sentence).not.toMatch(/matches the gray guide letter/);
		expect(line.sentence).toMatch(/looks unfinished/);
		// past "Something else": still no thickness sentence while it is unfinished
		const skipped = pickLine({ ...state, skips: { [line.skipKey]: line.stamp } });
		expect(skipped.sentence).not.toMatch(/matches the gray guide letter/);
	});

	it('small i\'s stem alone: never "looks done"', () => {
		const editor = openLetter('i', iSketch());
		const isOn = (f) => f !== 'photo';
		const state = { ...deriveEditorState(editor, { isOn }), isOn };
		const lines = [pickLine(state)];
		lines.push(pickLine({ ...state, skips: { [lines[0].skipKey]: lines[0].stamp } }));
		lines.forEach((l) => expect(l.sentence).not.toMatch(/looks done/));
		expect(lines[0].sentence).toBe('small i still needs its dot.');
	});
});
