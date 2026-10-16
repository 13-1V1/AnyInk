// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance (impatient run): on the first-try photo (B r e "na" H d, the n and a touching,
// the H written tall) he names the "na" part n, presses Use it, then traces H and d. Found:
// - "Traced small n. Also resized small r and small e to match the photo." and "Traced Capital
//   H. Also resized small r, small e and small n ... small r needs a look now.": the wide part
//   and the over-tall H moved the photo's one size, so earlier letters changed behind his back;
// - after Use it on the "na" part, the dialog said every letter had a name, so the a was never
//   asked for.
// Written to fail on the code before the B16 photo fixes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import { toastLog } from '../../toast/toast.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { getTrace } from '../../trace/trace_model.js';
import { loadPhotoFixture } from './fixture_image.js';
import { fakeDecoder, fakeTrace } from './flow_fakes.js';
import {
	addPhotoFile,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { getPhoto, guessPart, mayBeTwoLetters, unusedParts } from '../photo_registry.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

let editor;
let photo;
const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

beforeEach(async () => {
	photo ||= await loadPhotoFixture('first-try-phone');
	document.body.innerHTML = '';
	setModeForTests('simple');
	resetPhotoFlowForTests();
	fakeTrace.calls.length = 0;
	setDecoderForTests(fakeDecoder({ 'first-try.webp': photo.image }));
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
});

afterEach(() => {
	setDecoderForTests(null);
	resetPhotoFlowForTests();
});

async function addFirstTry() {
	const f = new File([photo.bytes], 'first-try.webp', { type: 'image/webp' });
	const added = await addPhotoFile(f, { editor });
	expect(added.ok).toBe(true);
	return added.asset;
}

/** Parts in reading order: B r e (na) H d */
function partsOf(asset) {
	const record = getPhoto(editor.project, asset);
	return [...record.parts].sort((a, b) => a.left - b.left).map((p) => p.id);
}

async function trace(asset, partId, char) {
	await startPart({ editor, asset, partId, char });
	await whenFlowSettled(editor);
	return useIt(editor);
}

describe('the first-try photo, traced in order by an impatient first-timer', () => {
	it('finds the touching "na" as one part, wider than two letters', async () => {
		const asset = await addFirstTry();
		const ids = partsOf(asset);
		expect(ids).toHaveLength(6);
		expect(mayBeTwoLetters(getPhoto(editor.project, asset), ids[3])).toBe(true);
	});

	it('the "na" part and the tall H never resize the letters traced before them', async () => {
		const asset = await addFirstTry();
		const [B, r, e, na, H, d] = partsOf(asset);
		await trace(asset, B, 'B');
		await trace(asset, r, 'r');
		await trace(asset, e, 'e');
		const scales = () => ['B', 'r', 'e'].map((c) => getTrace(editor.project.getItem(ID(c))).scale);
		const before = scales();
		const n = await trace(asset, na, 'n');
		expect(n.ok).toBe(true);
		expect(n.resized).toEqual([]);
		expect(scales()).toEqual(before);
		const h = await trace(asset, H, 'H');
		expect(h.ok).toBe(true);
		expect(h.resized).toEqual([]);
		expect(scales()).toEqual(before);
		const said = toastLog()
			.map((t) => t.text)
			.join(' | ');
		expect(said).not.toMatch(/needs a look now/);
		// d is an ordinary letter: it may move the photo's size (the median of four letters, not
		// three), and then the toast says so in plain words, never that a letter "needs a look now"
		await trace(asset, d, 'd');
		expect(
			toastLog()
				.map((t) => t.text)
				.join(' | ')
		).not.toMatch(/needs a look now/);
	});

	it('after the "na" part is used for n, the photo still asks for its a', async () => {
		const asset = await addFirstTry();
		const [B, , , na] = partsOf(asset);
		await trace(asset, B, 'B');
		await trace(asset, na, 'n');
		const record = getPhoto(editor.project, asset);
		expect(unusedParts(record)).toContain(na);
		// a part named m is one wide letter, never offered again
		record.used[na].char = 'm';
		expect(unusedParts(record)).not.toContain(na);
		record.used[na].char = 'n';
		expect(guessPart(record)).toBe(partsOf(asset)[1]);
	});
});
