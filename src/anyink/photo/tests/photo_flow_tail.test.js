// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: Fine-tune > Tail (UX-BEGINNER.md 4.3 "Tail (g j p q y, Q J f only)", 4.4
	"Fine-tune > Tail ([It has a tail] / [No tail]) re-seats the letter if the guess was wrong"):
	letter_tail.js says when it shows and what it says now; photo_flow_tail.js re-seats a traced
	letter in one Undo step, the photo moving with the ink; the letter card shows it inside
	Fine-tune and sends his press. On the whole-alphabet phone fixture, decoded with sharp, traced
	with flow_fakes.js as in photo_flow.test.js.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { Path } from '../../../project_data/path.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { makeLetterCard } from '../../letter/letter_card.js';
import { setFineTuneOpen } from '../../letter/view_switches.js';
import { setModeForTests } from '../../mode/mode.js';
import { guideLines } from '../../placement/classes.js';
import { inkBounds } from '../../spacing/measure.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { getTrace } from '../../trace/trace_model.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { TAIL_EVENT, letterTail } from '../letter_tail.js';
import { isAsTraced } from '../photo_flow_fit.js';
import {
	addPhotoFile,
	resetPhotoFlowForTests,
	setLetterTail,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { getPhoto } from '../photo_registry.js';
import { keyCenter, loadPhotoFixture } from './fixture_image.js';
import { fakeDecoder } from './flow_fakes.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

let editor;
let alphabet;
let asset;

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;
/** The Undo list as he reads it: a whole-font step's closing entry left out */
const titles = () =>
	editor.history.queue
		.map((entry) => entry.title)
		.filter((title) => title !== '_whole_project_change_post_state_');

/** Names the part where the answer key wrote char, traces it and presses Use it. */
async function trace(char) {
	const record = getPhoto(editor.project, asset);
	const [cx, cy] = keyCenter(alphabet.key.letters.find((letter) => letter.char === char));
	const part = record.parts.find((p) => cx >= p.left && cx < p.right && cy >= p.top && cy < p.bottom);
	await startPart({ editor, asset, partId: part.id, char });
	await whenFlowSettled(editor);
	const used = await useIt(editor);
	expect(used.ok).toBe(true);
	return editor.project.getItem(ID(char));
}

beforeAll(async () => {
	alphabet = await loadPhotoFixture('alphabet-loose-phone');
});

beforeEach(async () => {
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	setDecoderForTests(fakeDecoder({ 'alphabet.jpg': alphabet.image }));
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
	const added = await addPhotoFile(new File([alphabet.bytes], 'alphabet.jpg', { type: 'image/jpeg' }), {
		editor,
	});
	expect(added.ok).toBe(true);
	asset = added.asset;
});

afterEach(() => {
	setDecoderForTests(null);
	resetPhotoFlowForTests();
	document.body.innerHTML = '';
});

describe('when Fine-tune > Tail shows, and what it says (letter_tail.js)', () => {
	it('a traced g: it has a tail (his ink hangs below the line), not his pick yet', async () => {
		const g = await trace('g');
		expect(letterTail(editor.project, g)).toMatchObject({ kind: 'always', tail: true, chosen: false });
	});

	it('a letter that never hangs a tail, or one drawn without a photo: no Tail section', async () => {
		const a = await trace('a');
		expect(letterTail(editor.project, a)).toBe(null);
		editor.selectedGlyphID = ID('y');
		const y = editor.selectedItem;
		y.addOneShape(new Path({ name: 'Brush stroke 1', pathPoints: [] }));
		expect(letterTail(editor.project, y)).toBe(null);
	});
});

describe('[No tail] / [It has a tail] re-seat a traced letter in one step (photo_flow_tail.js)', () => {
	it('[No tail] sits the bottom of the g on the writing line; the photo moves with the ink', async () => {
		const g = await trace('g');
		const box = guideLines(editor.project.settings.font).box;
		const before = { ink: inkBounds(g), trace: getTrace(g), steps: editor.history.queue.length };
		expect(before.ink.yMin).toBeLessThan(-0.1 * box);
		const result = await setLetterTail(editor, ID('g'), false);
		expect(result).toMatchObject({ ok: true, moved: true });
		const after = { ink: inkBounds(g), trace: getTrace(g) };
		expect(Math.abs(after.ink.yMin) / box).toBeLessThanOrEqual(0.02);
		expect(after.trace.y - before.trace.y).toBe(Math.round(after.ink.yMin - before.ink.yMin));
		expect(after.trace.x).toBe(before.trace.x);
		expect(getPhoto(editor.project, asset).used[letterTail(editor.project, g).partId].tail).toBe(
			false
		);
		expect(letterTail(editor.project, g)).toMatchObject({ tail: false, chosen: true });
		expect(isAsTraced(g, asset)).toBe(true);
		// one whole-font step, in plain words
		expect(titles()[0]).toBe(word('letter.step.tailOff', { name: 'small g' }));
		const coords = g.shapes.flatMap((s) => s.pathPoints.flatMap((pp) => [pp.p.x, pp.p.y]));
		expect(coords.every(Number.isInteger)).toBe(true);
		expect(editor.history.queue.length).toBeGreaterThan(before.steps);
	});

	it('Undo puts the seat and his pick back in one press; [It has a tail] seats it as first traced', async () => {
		let g = await trace('g');
		const first = { yMin: inkBounds(g).yMin, y: getTrace(g).y };
		await setLetterTail(editor, ID('g'), false);
		editor.history.restoreState();
		g = editor.project.getItem(ID('g'));
		expect(Math.round(inkBounds(g).yMin)).toBe(Math.round(first.yMin));
		expect(letterTail(editor.project, g)).toMatchObject({ tail: true, chosen: false });
		await setLetterTail(editor, ID('g'), false);
		await setLetterTail(editor, ID('g'), true);
		g = editor.project.getItem(ID('g'));
		expect(Math.abs(getTrace(g).y - first.y)).toBeLessThanOrEqual(1);
		expect(letterTail(editor.project, g)).toMatchObject({ tail: true, chosen: true });
		expect(titles()[0]).toBe(word('letter.step.tailOn', { name: 'small g' }));
	});
});

describe('the letter card shows Tail inside Fine-tune (4.3)', () => {
	it('[It has a tail] pressed on a traced g; [No tail] sends his pick', async () => {
		await trace('g');
		editor.selectedGlyphID = ID('g');
		setFineTuneOpen(true, editor);
		document.body.appendChild(makeLetterCard(editor));
		const has = document.querySelector('[data-anyink-tail="has"]');
		const none = document.querySelector('[data-anyink-tail="none"]');
		expect(has.textContent).toBe(word('letter.tail.has'));
		expect(has.getAttribute('aria-pressed')).toBe('true');
		expect(none.getAttribute('aria-pressed')).toBe('false');
		const heard = vi.fn();
		window.addEventListener(TAIL_EVENT, heard);
		none.click();
		window.removeEventListener(TAIL_EVENT, heard);
		expect(heard.mock.calls[0][0].detail).toEqual({ itemId: ID('g'), tail: false });
		setFineTuneOpen(false, editor);
	});
});

scanSimpleScreen(
	'Fine-tune on a traced g, with Tail',
	async () => {
		await trace('g');
		editor.selectedGlyphID = ID('g');
		setFineTuneOpen(true, editor);
		const card = makeLetterCard(editor);
		document.body.appendChild(card);
		expect(card.querySelector('[data-anyink-fine="tail"]')).not.toBe(null);
		return card;
	},
	{ strict: true }
);
