// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 finalize: the critic's IMG_5012 (stray-dot-phone: "B r e n a H d", e written 1.62
// times too big, the a dipping, a stray pen dot under the row between r and e), through the
// real parts finder, the flow (placement, the fake tracer of flow_fakes.js) and the checks.
// Written to fail on the code before the finalize: the dot joined the r above it, so the r's
// part reached down to the dot, the row split in two (H d read first, the green box on the
// 6th letter) and the r was traced 751 units above the writing line.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { checksSource, getChecksCache, resetChecksCacheForTests } from '../../checks/cache.js';
import { useNeedsALook } from '../../checks/fix_step.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { findInk, photoInk } from '../ink_parts.js';
import {
	addPhotoFile,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { getPhoto, guessPart, markDone } from '../photo_registry.js';
import { listOf } from '../photo_flow_use.js';
import { loadPhotoFixture } from './fixture_image.js';
import { fakeDecoder, fakeTrace } from './flow_fakes.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

let photo;
let editor;

beforeEach(async () => {
	photo ||= await loadPhotoFixture('stray-dot-phone');
	document.body.innerHTML = '';
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
	resetChecksCacheForTests();
	resetToastsForTests();
	useNeedsALook(checksSource);
	resetPhotoFlowForTests();
	fakeTrace.calls.length = 0;
	setDecoderForTests(fakeDecoder({ 'IMG_5012.jpg': photo.image }));
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
});

afterEach(() => {
	useNeedsALook(null);
	resetToastsForTests();
	setDecoderForTests(null);
	resetPhotoFlowForTests();
	resetChecksCacheForTests();
	setModeForTests('all');
});

const ID = (char) => `glyph-0x${char.codePointAt(0).toString(16).toUpperCase()}`;

/** The key letter whose middle a part's box holds */
function charOf(part) {
	const hit = photo.key.letters.find(({ center: [x, y] }) => {
		return x >= part.left && x < part.right && y >= part.top && y < part.bottom;
	});
	return hit?.char || null;
}

/** Walks the photo with the green box, naming each part as the key says, `count` letters (or
 * the letters of `order`, each part picked by clicking it) */
async function walk(count, order = null) {
	const added = await addPhotoFile(
		new File([photo.bytes], 'IMG_5012.jpg', { type: 'image/jpeg' }),
		{ editor }
	);
	expect(added.ok).toBe(true);
	const named = [];
	for (let i = 0; i < count; i++) {
		const record = getPhoto(editor.project, added.asset);
		const partId = order
			? record.parts.find((p) => charOf(p) === order[i]).id
			: guessPart(record);
		const char = charOf(record.parts.find((p) => p.id === partId));
		expect(char, `part ${partId}`).toBeTruthy();
		await startPart({ editor, asset: added.asset, partId, char });
		await whenFlowSettled(editor);
		expect((await useIt(editor)).ok, char).toBe(true);
		named.push(char);
	}
	return { asset: added.asset, named };
}

const state = (char) => getChecksCache().state(editor, editor.project.getItem(ID(char)));
const checkIds = (char) => state(char).checks.map((check) => `${check.id}:${check.args.way}`);

describe('a stray pen dot under the row (the critic IMG_5012)', () => {
	it("is no part of the r, and the row stays one row read B r e n a H d", () => {
		const { mask } = photoInk(photo.image, { paper: 'photo' });
		const found = findInk(mask, photo.image.width, photo.image.height);
		const letters = found.parts.filter((part) => charOf(part));
		expect(letters.map(charOf)).toEqual(['B', 'r', 'e', 'n', 'a', 'H', 'd']);
		expect(new Set(letters.map((part) => part.row)).size).toBe(1);
		const dot = photo.key.specks.find((s) => s.where === 'under the row').center;
		const r = letters.find((part) => charOf(part) === 'r');
		expect(r.bottom).toBeLessThan(dot[1] - 10);
	});

	it('the walk starts on the B, and no traced letter floats or sinks', async () => {
		const { named } = await walk(7);
		expect(named).toEqual(['B', 'r', 'e', 'n', 'a', 'H', 'd']);
		for (const char of named) {
			expect(checkIds(char).filter((id) => id.startsWith('offLine')), char).toEqual([]);
		}
		const sized = named.filter((char) => checkIds(char).some((id) => id.startsWith('size')));
		expect(sized).toEqual(['e', 'H']);
	});

	it('Done after five letters: only the e, written far too big, needs a look for its size', async () => {
		const { asset, named } = await walk(5);
		markDone(getPhoto(editor.project, asset));
		const sized = named.filter((char) => checkIds(char).some((id) => id.startsWith('size')));
		expect(sized).toEqual(['e']);
		expect(checkIds('e')).toContain('size:big');
	});

	// H is written 1.4 times as tall as the d beside it (the critic: 1.34 times too big)
	it("Done after the critic's order H d B r e: the e and the H, never B, d or r", async () => {
		const order = ['H', 'd', 'B', 'r', 'e'];
		const { asset } = await walk(5, order);
		markDone(getPhoto(editor.project, asset));
		const report = Object.fromEntries(order.map((char) => [char, checkIds(char)]));
		const sized = order.filter((char) => report[char].some((id) => id.startsWith('size')));
		expect(sized, JSON.stringify(report)).toEqual(['H', 'e']);
	});
});

// B10 + B11 finalize (verifier: walk order e H r B d a n, "a median of 3 does not hold when 2 of
// the first 3 letters are written off-size"). Written to fail first: with SETTLED_LETTERS 3 the r
// turned amber "too short" after the third letter, with a green [Match size], then Ready again
// two letters later while e and H turned amber
it('walked e H r B d a n: no letter written right is ever called the wrong size mid-walk', async () => {
	const order = ['e', 'H', 'r', 'B', 'd', 'a', 'n'];
	const added = await addPhotoFile(
		new File([photo.bytes], 'IMG_5012.jpg', { type: 'image/jpeg' }),
		{ editor }
	);
	const seen = [];
	for (const char of order) {
		const record = getPhoto(editor.project, added.asset);
		const partId = record.parts.find((p) => charOf(p) === char).id;
		await startPart({ editor, asset: added.asset, partId, char });
		await whenFlowSettled(editor);
		expect((await useIt(editor)).ok, char).toBe(true);
		const named = order.slice(0, order.indexOf(char) + 1);
		const sized = named.filter((c) => checkIds(c).some((id) => id.startsWith('size')));
		seen.push(`${char}:${sized.join('')}`);
	}
	const wrong = seen.filter((step) => /[rBdan]/.test(step.split(':')[1]));
	expect(wrong, seen.join(' ')).toEqual([]);
	expect(seen.at(-1)).toBe('n:eH');
});

describe('the toast after Use it (one voice, 4.2)', () => {
	// the critic: "a trace that turns other letters amber says nothing about it"
	it('e traced first, then B r n a: the fifth letter settles the scale, and the toast says e needs a look', async () => {
		await walk(5, ['e', 'B', 'r', 'n', 'a']);
		const said = toastLog().at(-1);
		expect(said.key).toBe('photoFlow.saidAndFlipped');
		expect(said.text).toMatch(/^Traced small a\./);
		expect(said.text).toMatch(/small e needs a look now\.$/);
		expect(said.shown).toBe(true);
	});

	// the critic: "The 'Also resized ...' toast can list 11 letters on one trace"
	it('names at most two letters, then how many more', () => {
		const names = ['Capital A', 'Capital C', 'Capital E', 'Capital H', 'Capital K'];
		expect(listOf(names)).toBe('Capital A, Capital C and 3 other letters');
		expect(listOf(names.slice(0, 4))).toBe('Capital A, Capital C and 2 other letters');
		expect(listOf(names.slice(0, 3))).toBe('Capital A, Capital C and Capital E');
		expect(listOf(['Capital A'])).toBe('Capital A');
	});
});
