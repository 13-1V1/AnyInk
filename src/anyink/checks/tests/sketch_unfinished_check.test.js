// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3 finalize (door-coach verifier): the Next line and the rail said small i's stem alone "still
	needs its dot" (and Capital B's stem "looks unfinished"), but the letter card still said
	Ready: the card reads B11's checks cache,
	which had no such look. The stand-in look (board/sketch_unfinished.js) is now one of B11's
	checks (CHECK.sketchUnfinished, last in CHECK_ORDER, no fix button, "Looks fine to me" turns
	it off), so the card, the cache's flip toasts, the board's filters and the board's ready rule
	agree with the Next line. Only with 'sketch' on.
*/
import { afterEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { readyRuleFor } from '../../board/board_page.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { rebuildItem } from '../../sketch/build.js';
import { setSketch } from '../../sketch/model.js';
import { bCenter, line, sketchOfPieces } from '../../sketch/tests/fixtures/build_letters.js';
import { STORED_FONT } from '../../sketch/tests/fixtures/stored_sketches.js';
import { makeChecksCache } from '../cache.js';
import { CHECK, CHECK_ORDER } from '../checks.js';
import { setLooksFine } from '../looks_fine.js';

const B = 'glyph-0x42';
const I = 'glyph-0x69';

function editorWith(sketch, id = B) {
	const editor = new ProjectEditor();
	editor.project = new GlyphrStudioProject({
		settings: {
			project: {
				name: 'Unfinished',
				id: 'g2_UNFINISHEDCARD',
				characterRanges: [{ name: 'Basic Latin', begin: '0x20', end: '0x7F' }],
			},
			font: { family: 'Unfinished', ...STORED_FONT },
		},
		glyphs: { [id]: { id, advanceWidth: 0, shapes: [] } },
	});
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	const item = editor.project.getItem(id);
	setSketch(item, sketch);
	rebuildItem(item, { project: editor.project, force: true });
	item.advanceWidth = Math.round(item.maxes.xMax + 60);
	return { editor, item };
}

const bStem = () =>
	sketchOfPieces(
		'sk_uc_Bstem',
		{
			foot: { x: 150, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			top: { x: 150, y: 1431, kind: 'corner', on: 'capitals', inset: 'edge' },
		},
		[{ use: 'center', closed: false, parts: [line('foot', 'top')] }]
	);

/** small i's stem alone, no dot */
const iStem = () =>
	sketchOfPieces(
		'sk_uc_istem',
		{
			foot: { x: 200, y: 50, kind: 'corner', on: 'writing', inset: 'edge' },
			top: { x: 200, y: 1051, kind: 'corner', on: 'small', inset: 'edge' },
		},
		[{ use: 'center', closed: false, parts: [line('foot', 'top')] }]
	);

afterEach(() => {
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('the unfinished look is one of B11 checks', () => {
	it('last in the order, no fix', () => {
		expect(CHECK.sketchUnfinished).toBe('sketchUnfinished');
		expect(CHECK_ORDER.at(-1)).toBe(CHECK.sketchUnfinished);
	});

	it("small i's stem alone: the card's state needs a look, never Ready", () => {
		setModeForTests('simple');
		setFeaturesForTests({ checks: true, sketch: true });
		const { editor, item } = editorWith(iStem(), I);
		const state = makeChecksCache().state(editor, item);
		expect(state.ready).toBe(false);
		expect(state.needsLook.id).toBe(CHECK.sketchUnfinished);
		expect(state.needsLook.reason).toBe('small i still needs its dot.');
		expect(state.needsLook.fixLabel).toBe('');
		expect(readyRuleFor(editor)(item, 'i')).toBe(false);
	});

	it("Capital B's stem alone is never Ready either (B11's own look may come first)", () => {
		setModeForTests('simple');
		setFeaturesForTests({ checks: true, sketch: true });
		const { editor, item } = editorWith(bStem());
		const state = makeChecksCache().state(editor, item);
		expect(state.ready).toBe(false);
		expect(state.checks.map((check) => check.id)).toContain(CHECK.sketchUnfinished);
	});

	it('Looks fine to me turns it off; the whole B and the flag off are as before', () => {
		setModeForTests('simple');
		setFeaturesForTests({ checks: true, sketch: true });
		const stem = editorWith(iStem(), I);
		setLooksFine(stem.item, CHECK.sketchUnfinished);
		expect(makeChecksCache().state(stem.editor, stem.item).needsLook?.id).not.toBe(
			CHECK.sketchUnfinished
		);
		const whole = editorWith(bCenter());
		expect(makeChecksCache().state(whole.editor, whole.item).needsLook?.id).not.toBe(
			CHECK.sketchUnfinished
		);
		setFeaturesForTests({ checks: true, sketch: false });
		const off = editorWith(iStem(), I);
		expect(makeChecksCache().state(off.editor, off.item).needsLook?.id).not.toBe(
			CHECK.sketchUnfinished
		);
	});
});

describe("the board's ready rule reads the look itself", () => {
	it("checks off: small i's stem alone is still not counted Ready", () => {
		setModeForTests('simple');
		setFeaturesForTests({ checks: false, sketch: true });
		const { editor, item } = editorWith(iStem(), I);
		expect(readyRuleFor(editor)(item, 'i')).toBe(false);
	});
});
