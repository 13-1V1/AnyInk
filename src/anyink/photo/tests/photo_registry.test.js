// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core: the photo registry, settings.anyink.photos (docs/UX-BEGINNER.md 4.4, section 10
// B9: "parts, which letter used which part, the scale, done; one image id per photo: the B3
// stand-in added the same photo twice and got two"; unit tests "the guess and the alphabet
// prefill; Skip and Done"). Written before photo_registry.js existed (failed on the missing
// module).
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { reconcilePhotoUses, setPhotoFit } from '../photo_flow_fit.js';
import { placePart } from '../../placement/fit_lines.js';
import { photoScale } from '../../placement/photo_scale.js';
import { photoRecords } from '../../coach/font_facts.js';
import { attachMasks, findInk, photoInk } from '../ink_parts.js';
import {
	MAX_LISTED_PHOTOS,
	addDrawnPart,
	addPhoto,
	carryPhotos,
	findPhotoByFingerprint,
	getPhoto,
	guessPart,
	listPhotos,
	markDone,
	normalizePhotoRecord,
	onlyPart,
	photoFingerprint,
	photoSummaries,
	photosOf,
	placementPhoto,
	prefillChar,
	releaseItem,
	releaseStaleUses,
	removePhoto,
	setLightInk,
	setPaper,
	setScale,
	setTail,
	skipPart,
	unusedParts,
	usePart,
	usedChar,
} from '../photo_registry.js';
import { loadPhotoFixture } from './fixture_image.js';

/** A bare project the way the app holds one (settings.anyink exists). */
const newProject = () => new GlyphrStudioProject();

/** Seven parts in one row, like "B r e n a H d" on the How card's first try. */
const ROW = Array.from({ length: 7 }, (_, i) => ({
	id: `p${i + 1}`,
	left: 100 + i * 150,
	top: 100,
	right: 200 + i * 150,
	bottom: 260,
	row: 0,
}));

const add = (project, asset = 'img-aaaa0001', extra = {}) =>
	addPhoto(project, { asset, width: 1500, height: 520, parts: ROW, paper: 'scan', ...extra });

describe('a photo record', () => {
	it('lives at settings.anyink.photos[assetId] with its parts (no masks), paper and size', () => {
		const project = newProject();
		const withMasks = ROW.map((p) => ({ ...p, mask: new Uint8Array(4) }));
		const record = addPhoto(project, {
			asset: 'img-aaaa0001',
			width: 1500,
			height: 520,
			parts: withMasks,
			paper: 'photo',
			fingerprint: 'fnv:10:abc',
		});
		expect(project.settings.anyink.photos['img-aaaa0001']).toBe(record);
		expect(record.asset).toBe('img-aaaa0001');
		expect(record.paper).toBe('photo');
		expect(record.width).toBe(1500);
		expect(record.parts).toHaveLength(7);
		expect(record.parts[0]).toEqual({
			id: 'p1',
			left: 100,
			top: 100,
			right: 200,
			bottom: 260,
			row: 0,
		});
		expect(record.used).toEqual({});
		expect(record.skipped).toEqual([]);
		expect(record.done).toBe(false);
		expect(record.scale).toBe(null);
		// how the parts were found, kept apart from his picks in Adjust
		expect(record.lightInk).toBe(false);
		expect(record.find).toEqual({ paper: 'photo', lightInk: false });
		// plain JSON: survives a save and a load of the work file
		const again = new GlyphrStudioProject(JSON.parse(JSON.stringify(project.save())));
		expect(again.settings.anyink.photos['img-aaaa0001']).toEqual(
			JSON.parse(JSON.stringify(record))
		);
	});

	it('one image id per photo: the same photo added again gives back its record', () => {
		const project = newProject();
		const bytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
		const fingerprint = photoFingerprint(bytes);
		const first = add(project, 'img-aaaa0001', { fingerprint });
		usePart(first, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(
			findPhotoByFingerprint(project, photoFingerprint(new Uint8Array([1, 2, 3, 4, 5, 6])))
		).toBe(first);
		// the flow asks before adding a second image; asked to add it anyway, the first record stays
		const second = add(project, 'img-bbbb0002', { fingerprint });
		expect(second).toBe(first);
		expect(Object.keys(project.settings.anyink.photos)).toEqual(['img-aaaa0001']);
		expect(first.used.p1.char).toBe('B');
		// the same asset id again: the same record, nothing reset
		expect(add(project, 'img-aaaa0001')).toBe(first);
		expect(first.used.p1.char).toBe('B');
	});

	it('photoFingerprint: the same bytes give the same print, other bytes another', () => {
		const a = photoFingerprint(new Uint8Array([9, 8, 7, 6, 5]));
		expect(a).toBe(photoFingerprint(new Uint8Array([9, 8, 7, 6, 5]).buffer));
		expect(a).not.toBe(photoFingerprint(new Uint8Array([9, 8, 7, 6, 4])));
		expect(a).not.toBe(photoFingerprint(new Uint8Array([9, 8, 7, 6, 5, 0])));
		expect(a).toMatch(/^fnv:5:[0-9a-f]{16}$/);
	});

	it('getPhoto and removePhoto (Cancel removes the photo the card added)', () => {
		const project = newProject();
		add(project);
		expect(getPhoto(project, 'img-aaaa0001')).toBeTruthy();
		expect(getPhoto(project, 'img-nope')).toBe(null);
		expect(removePhoto(project, 'img-aaaa0001')).toBe(true);
		expect(getPhoto(project, 'img-aaaa0001')).toBe(null);
		expect(removePhoto(project, 'img-aaaa0001')).toBe(false);
		expect(getPhoto(null, 'x')).toBe(null);
	});

	it('listPhotos: newest first, at most six (the photo card\'s "Photos in this font")', () => {
		const project = newProject();
		for (let i = 1; i <= 8; i++) add(project, `img-photo000${i}`);
		const listed = listPhotos(project);
		expect(MAX_LISTED_PHOTOS).toBe(6);
		expect(listed.map((r) => r.asset)).toEqual([
			'img-photo0008',
			'img-photo0007',
			'img-photo0006',
			'img-photo0005',
			'img-photo0004',
			'img-photo0003',
		]);
		expect(listPhotos(project, { limit: 2 })).toHaveLength(2);
		expect(listPhotos(newProject())).toEqual([]);
	});

	it('scale, tail and paper are kept with the photo', () => {
		const project = newProject();
		const record = add(project);
		setScale(record, 2.3456);
		expect(record.scale).toBe(2.3456);
		setScale(record, -1);
		expect(record.scale).toBe(2.3456);
		usePart(record, 'p6', { char: 'Q', itemId: 'glyph-0x51' });
		setTail(record, 'p6', true);
		expect(record.used.p6.tail).toBe(true);
		setTail(record, 'p6', null);
		expect('tail' in record.used.p6).toBe(false);
		expect(setTail(record, 'p2', true)).toBe(false);
		setPaper(record, 'photo');
		expect(record.paper).toBe('photo');
		setPaper(record, 'film');
		expect(record.paper).toBe('photo');
		expect(setLightInk(record, true)).toBe(true);
		expect(record.lightInk).toBe(true);
		expect(setLightInk(record, 'yes')).toBe(false);
		// the parts were found on Flat scan with dark ink, and stay that way
		expect(record.find).toEqual({ paper: 'scan', lightInk: false });
	});
});

describe('which letter used which part', () => {
	it('usePart names a part; its letter tags it; a letter holds one part of a photo', () => {
		const project = newProject();
		const record = add(project);
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(usedChar(record, 'p1')).toBe('B');
		expect(usedChar(record, 'p2')).toBe('');
		// B traced again from another part of the same photo: the first part is free again
		usePart(record, 'p3', { char: 'B', itemId: 'glyph-0x42' });
		expect(usedChar(record, 'p1')).toBe('');
		expect(usedChar(record, 'p3')).toBe('B');
		// an unknown part or a bad letter changes nothing
		expect(usePart(record, 'p99', { char: 'r', itemId: 'glyph-0x72' })).toBe(null);
		expect(usePart(record, 'p2', { char: '', itemId: 'glyph-0x72' })).toBe(null);
		expect(usePart(record, 'p2', { char: 'rr', itemId: 'glyph-0x72' })).toBe(null);
	});

	it('releaseItem: a letter traced from another photo lets go of its part in this one', () => {
		const project = newProject();
		const one = add(project, 'img-aaaa0001');
		const two = add(project, 'img-bbbb0002');
		usePart(one, 'p2', { char: 'r', itemId: 'glyph-0x72' });
		usePart(two, 'p5', { char: 'r', itemId: 'glyph-0x72' });
		expect(releaseItem(project, 'glyph-0x72', { except: 'img-bbbb0002' })).toBe(1);
		expect(usedChar(one, 'p2')).toBe('');
		expect(usedChar(two, 'p5')).toBe('r');
	});

	it('releaseStaleUses: a use whose letter no longer holds this photo is let go (an Undo of Use it)', () => {
		const project = newProject();
		const record = add(project);
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		usePart(record, 'p2', { char: 'r', itemId: 'glyph-0x72' });
		const items = {
			'glyph-0x42': { anyink: { trace: { asset: 'img-aaaa0001' } } },
			'glyph-0x72': { anyink: {} },
		};
		expect(releaseStaleUses(project, (id) => items[id] || null)).toBe(1);
		expect(usedChar(record, 'p1')).toBe('B');
		expect(usedChar(record, 'p2')).toBe('');
	});
});

describe('the guess and the alphabet prefill', () => {
	it('the guess is the first unused part in reading order', () => {
		const record = add(newProject());
		expect(guessPart(record)).toBe('p1');
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(guessPart(record)).toBe('p2');
		usePart(record, 'p3', { char: 'e', itemId: 'glyph-0x65' });
		expect(guessPart(record)).toBe('p2');
		// reading order is rows top to bottom, then left to right, whatever order parts are stored in
		const project = newProject();
		const mixed = addPhoto(project, {
			asset: 'img-mixed001',
			width: 900,
			height: 900,
			parts: [
				{ id: 'p3', left: 10, top: 400, right: 60, bottom: 480, row: 1 },
				{ id: 'p2', left: 300, top: 100, right: 360, bottom: 180, row: 0 },
				{ id: 'p1', left: 10, top: 100, right: 60, bottom: 180, row: 0 },
			],
		});
		expect(guessPart(mixed)).toBe('p1');
		usePart(mixed, 'p1', { char: 'a', itemId: 'glyph-0x61' });
		expect(guessPart(mixed)).toBe('p2');
	});

	it('when the last two letters named were next to each other in the alphabet, the next one is filled in', () => {
		const record = add(newProject());
		expect(prefillChar(record, 'p1')).toBe('');
		usePart(record, 'p1', { char: 'a', itemId: 'glyph-0x61' });
		expect(prefillChar(record, 'p2')).toBe('');
		usePart(record, 'p2', { char: 'b', itemId: 'glyph-0x62' });
		expect(prefillChar(record, 'p3')).toBe('c');
		usePart(record, 'p3', { char: 'c', itemId: 'glyph-0x63' });
		expect(prefillChar(record, 'p4')).toBe('d');
		// the naming order counts, not the parts' order: c then e breaks the run
		usePart(record, 'p4', { char: 'e', itemId: 'glyph-0x65' });
		expect(prefillChar(record, 'p5')).toBe('');
	});

	it('capitals and numbers run too; nothing after z, Z or 9; mixed case is not a run', () => {
		const run = (...chars) => {
			const record = add(newProject());
			chars.forEach((char, i) =>
				usePart(record, `p${i + 1}`, { char, itemId: `glyph-${char.codePointAt(0)}` })
			);
			return prefillChar(record, `p${chars.length + 1}`);
		};
		expect(run('X', 'Y')).toBe('Z');
		expect(run('Y', 'Z')).toBe('');
		expect(run('y', 'z')).toBe('');
		expect(run('3', '4')).toBe('5');
		expect(run('8', '9')).toBe('');
		expect(run('a', 'B')).toBe('');
		expect(run('b', 'a')).toBe('');
		expect(run('.', '/')).toBe('');
	});

	it('the next letter is not filled in when that letter was already named from this photo', () => {
		const record = add(newProject());
		usePart(record, 'p1', { char: 'c', itemId: 'glyph-0x63' });
		usePart(record, 'p2', { char: 'a', itemId: 'glyph-0x61' });
		usePart(record, 'p3', { char: 'b', itemId: 'glyph-0x62' });
		expect(prefillChar(record, 'p4')).toBe('');
	});

	it('filled in only on the part right after the last one named, in reading order (first-timer: n became e)', () => {
		// two rows, as the notebook's abcdefghi over jklmnopqr
		const top = Array.from({ length: 5 }, (_, i) => ({
			id: `p${i + 1}`,
			left: 100 + i * 150,
			top: 100,
			right: 200 + i * 150,
			bottom: 260,
			row: 0,
		}));
		const under = Array.from({ length: 5 }, (_, i) => ({
			id: `p${i + 6}`,
			left: 100 + i * 150,
			top: 400,
			right: 200 + i * 150,
			bottom: 560,
			row: 1,
		}));
		const twoRows = (asset, parts = [...top, ...under]) =>
			addPhoto(newProject(), { asset, width: 900, height: 700, parts });
		const record = twoRows('img-rows0001');
		usePart(record, 'p3', { char: 'c', itemId: 'glyph-0x63' });
		usePart(record, 'p4', { char: 'd', itemId: 'glyph-0x64' });
		// the green box on the n under them: no e for it
		expect(prefillChar(record, 'p10')).toBe('');
		expect(prefillChar(record, 'p2')).toBe('');
		// on the part right after the d: e (by id or as the part itself)
		expect(prefillChar(record, 'p5')).toBe('e');
		expect(prefillChar(record, record.parts[4])).toBe('e');
		// B10 + B11 finalize: a letter-sized part he skipped between them breaks the run (it may be
		// a letter he passed over: the critic's U, VW skipped, X filled in as "V"); no guess then
		usePart(record, 'p5', { char: 'e', itemId: 'glyph-0x65' });
		usePart(record, 'p6', { char: 'f', itemId: 'glyph-0x66' });
		skipPart(record, 'p7');
		expect(prefillChar(record, 'p8')).toBe('');
		// at the end of a row, the next row's first part follows it
		const wrap = twoRows('img-rows0002');
		usePart(wrap, 'p4', { char: 'h', itemId: 'glyph-0x68' });
		usePart(wrap, 'p5', { char: 'i', itemId: 'glyph-0x69' });
		expect(prefillChar(wrap, 'p6')).toBe('j');
		expect(prefillChar(wrap, 'p7')).toBe('');
		// a box he is drawing right after the last one named
		const third = twoRows('img-rows0003', top.slice(0, 4));
		usePart(third, 'p3', { char: 'c', itemId: 'glyph-0x63' });
		usePart(third, 'p4', { char: 'd', itemId: 'glyph-0x64' });
		const drawing = { id: 'drawn', left: 860, top: 100, right: 890, bottom: 260 };
		expect(prefillChar(third, drawing)).toBe('e');
		expect(prefillChar(third, { ...drawing, left: 10, right: 40 })).toBe('');
		// nothing boxed: nothing filled in
		expect(prefillChar(third)).toBe('');
	});
});

describe('the guess when the letter is known, and the junk it never picks', () => {
	/** The single-g photo: one big g, and a scrap of shadow at the photo's left edge. */
	const singleG = (project = newProject()) =>
		addPhoto(project, {
			asset: 'img-gggg0001',
			width: 1500,
			height: 2000,
			parts: [
				{ id: 'p1', left: 0, top: 1535, right: 50, bottom: 1557, row: 0 },
				{ id: 'p2', left: 351, top: 543, right: 705, bottom: 1441, row: 0 },
			],
		});

	it("never a part touching the photo's edge while another is left (first-timer: the g photo)", () => {
		const project = newProject();
		const record = singleG(project);
		expect(guessPart(record, { char: 'g' })).toBe('p2');
		expect(guessPart(record)).toBe('p2');
		// not one of "more letters" either (rule 12)
		expect(unusedParts(record)).toEqual(['p2']);
		expect(photoSummaries(project)).toEqual([{ id: 'img-gggg0001', unused: 1, done: false }]);
		// a lone letter cut by the photo's edge is still guessed
		const lone = addPhoto(newProject(), {
			asset: 'img-edge0001',
			width: 400,
			height: 600,
			parts: [{ id: 'p1', left: 100, top: 0, right: 300, bottom: 500, row: 0 }],
		});
		expect(guessPart(lone, { char: 'i' })).toBe('p1');
	});

	it('onlyPart: the one part a letter can be (the photo opens at the result)', () => {
		expect(onlyPart(singleG(), { char: 'g' })).toBe('p2');
		expect(onlyPart(add(newProject()), { char: 'r' })).toBe(null);
		expect(onlyPart(null)).toBe(null);
	});

	it('the letter before it in a to z, named from this photo, puts the guess on its right-hand neighbour', () => {
		const record = add(newProject());
		usePart(record, 'p3', { char: 'e', itemId: 'glyph-0x65' });
		expect(guessPart(record, { char: 'f' })).toBe('p4');
		// the letter after it: its left-hand neighbour
		const other = add(newProject());
		usePart(other, 'p5', { char: 'G', itemId: 'glyph-0x47' });
		expect(guessPart(other, { char: 'F' })).toBe('p4');
		// that neighbour already used: the first part left in reading order
		usePart(record, 'p4', { char: 'x', itemId: 'glyph-0x78' });
		expect(guessPart(record, { char: 'f' })).toBe('p1');
	});

	it('a part far smaller than the letters is never the guess for a letter, and is for a period', () => {
		const record = addPhoto(newProject(), {
			asset: 'img-dots0001',
			width: 1200,
			height: 400,
			parts: [
				{ id: 'p1', left: 50, top: 230, right: 66, bottom: 246, row: 0 },
				{ id: 'p2', left: 120, top: 100, right: 200, bottom: 250, row: 0 },
				{ id: 'p3', left: 260, top: 160, right: 330, bottom: 250, row: 0 },
				{ id: 'p4', left: 380, top: 236, right: 394, bottom: 250, row: 0 },
				{ id: 'p5', left: 450, top: 100, right: 530, bottom: 250, row: 0 },
			],
		});
		expect(guessPart(record, { char: 'a' })).toBe('p2');
		expect(guessPart(record, { char: '.' })).toBe('p1');
		usePart(record, 'p1', { char: '.', itemId: 'glyph-0x2E' });
		expect(guessPart(record, { char: ',' })).toBe('p4');
		// the letter unknown: reading order, marks too (a whole page of . , ' ? ! -)
		expect(guessPart(record)).toBe('p2');
	});

	it("with the photo's size known, the first part in reading order whose height fits the letter", () => {
		const record = addPhoto(newProject(), {
			asset: 'img-size0001',
			width: 1200,
			height: 400,
			parts: [
				// a capital (100 px), a small letter (75 px), a tall one with a tail (140 px)
				{ id: 'p1', left: 100, top: 100, right: 170, bottom: 200, row: 0 },
				{ id: 'p2', left: 220, top: 125, right: 280, bottom: 200, row: 0 },
				{ id: 'p3', left: 330, top: 95, right: 380, bottom: 235, row: 0 },
			],
		});
		// 14.8 font units a pixel: capitals (1480 units) are 100 px, small letters (1100) 74 px
		setScale(record, 14.8);
		expect(guessPart(record, { char: 'x' })).toBe('p2');
		expect(guessPart(record, { char: 'H' })).toBe('p1');
		// g's bowl and tail: 1100 + 396 units, 101 px
		expect(guessPart(record, { char: 'g' })).toBe('p1');
		// f with a tail of its own reaches 140 px; written without one it is 105 px
		expect(guessPart(record, { char: 'f' })).toBe('p1');
		// nothing fits well (a hyphen): the one that fits best
		const marks = addPhoto(newProject(), {
			asset: 'img-size0002',
			width: 1200,
			height: 400,
			parts: [
				{ id: 'p1', left: 100, top: 100, right: 170, bottom: 200, row: 0 },
				{ id: 'p2', left: 220, top: 160, right: 280, bottom: 180, row: 0 },
			],
		});
		setScale(marks, 14.8);
		expect(guessPart(marks, { char: '-' })).toBe('p2');
	});
});

describe('the photo list is outside Undo, as the images are (carryPhotos)', () => {
	afterEach(() => setModeForTests(null));

	it('carryPhotos puts the live list on the font a whole-font Undo or Redo brings back', () => {
		const live = newProject();
		const record = add(live);
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		const older = newProject();
		add(older, 'img-older001');
		expect(carryPhotos(live, older)).toBe(true);
		expect(Object.keys(photosOf(older))).toEqual(['img-aaaa0001']);
		expect(getPhoto(older, 'img-aaaa0001')).toEqual(record);
		// a copy: the two never share a record
		expect(getPhoto(older, 'img-aaaa0001')).not.toBe(record);
		// no list in the live font: none in the one brought back
		expect(carryPhotos(newProject(), older)).toBe(true);
		expect(photosOf(older)).toBe(null);
		expect(carryPhotos(null, older)).toBe(false);
		expect(carryPhotos(live, null)).toBe(false);
	});

	it('a whole-font step, a new photo, a traced letter, Undo twice and Redo twice: the photo stays one record', () => {
		setModeForTests('simple');
		const editor = new ProjectEditor({ project: new GlyphrStudioProject() });
		setCurrentProjectEditor(editor);
		editor.nav.page = 'Characters';
		editor.selectedGlyphID = 'glyph-0x42';
		const history = editor.history;
		/** Undo and Redo as the app must run them: the photo list carried, the uses refreshed. */
		const press = (action) => {
			const before = editor.project;
			history[action]();
			carryPhotos(before, editor.project);
			reconcilePhotoUses(editor.project);
		};
		// 1. a whole-font step (the letter-spacing slider)
		history.addWholeProjectChangePreState('moved the letter spacing');
		editor.project.settings.font.descent = -460;
		history.addWholeProjectChangePostState();
		// 2. a photo comes in (no step); B is traced from its first part, a whole-font step as
		// Use it is when it resizes letters traced before
		const fingerprint = photoFingerprint(new Uint8Array([7, 7, 7, 1, 2, 3]));
		const record = add(editor.project, 'img-qqqq0001', { fingerprint });
		skipPart(record, 'p7');
		history.addWholeProjectChangePreState('traced B');
		const B = editor.project.getItem('glyph-0x42');
		setTrace(B, { asset: 'img-qqqq0001', width: 1500, height: 520, x: 0, y: 900, scale: 3 });
		setPhotoFit(B, { asset: 'img-qqqq0001', part: 'p1', shapes: B.shapes });
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		history.addWholeProjectChangePostState();

		press('restoreState');
		expect(getPhoto(editor.project, 'img-qqqq0001')?.used).toEqual({});
		press('restoreState');
		expect(editor.project.settings.font.descent).not.toBe(-460);
		const kept = getPhoto(editor.project, 'img-qqqq0001');
		expect(kept).toBeTruthy();
		expect(kept.skipped).toEqual(['p7']);
		press('redoState');
		press('redoState');
		expect(getTrace(editor.project.getItem('glyph-0x42'))?.asset).toBe('img-qqqq0001');
		const again = getPhoto(editor.project, 'img-qqqq0001');
		expect(again.used.p1).toMatchObject({ char: 'B', itemId: 'glyph-0x42' });
		expect(again.skipped).toEqual(['p7']);
		// the same file again finds its record: one image id per photo
		expect(findPhotoByFingerprint(editor.project, fingerprint)).toBe(again);
		// "Done with this photo", then an Undo of an older step: still there, still done
		markDone(again);
		press('restoreState');
		press('restoreState');
		expect(getPhoto(editor.project, 'img-qqqq0001')?.done).toBe(true);
	});
});

describe('Skip this part, Done with this photo, and what rule 12 reads', () => {
	it('a skipped part is not guessed again and is not one of "more letters"', () => {
		const project = newProject();
		const record = add(project);
		skipPart(record, 'p1');
		expect(guessPart(record)).toBe('p2');
		expect(unusedParts(record)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p7']);
		expect(photoSummaries(project)).toEqual([{ id: 'img-aaaa0001', unused: 6, done: false }]);
		// naming a skipped part un-skips it
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(record.skipped).toEqual([]);
		expect(skipPart(record, 'p99')).toBe(false);
	});

	it('every part used or skipped: no guess', () => {
		const record = add(newProject());
		ROW.forEach((part, i) =>
			i % 2
				? skipPart(record, part.id)
				: usePart(record, part.id, { char: 'abcdefg'[i], itemId: `glyph-${i}` })
		);
		expect(guessPart(record)).toBe(null);
		expect(unusedParts(record)).toEqual([]);
	});

	it('Done with this photo stops rule 12 for it; the unused parts stay usable', () => {
		const project = newProject();
		const record = add(project);
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		markDone(record);
		expect(record.done).toBe(true);
		expect(photoSummaries(project)).toEqual([{ id: 'img-aaaa0001', unused: 6, done: true }]);
		expect(guessPart(record)).toBe('p2');
		markDone(record, false);
		expect(record.done).toBe(false);
	});

	it("the coach's own reader (font_facts photoRecords) agrees with the record as stored", () => {
		const project = newProject();
		const record = add(project);
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		usePart(record, 'p2', { char: 'r', itemId: 'glyph-0x72' });
		expect(photoRecords(project)).toEqual([{ id: 'img-aaaa0001', unused: 5, done: false }]);
		expect(photoSummaries(project)).toEqual(photoRecords(project));
	});

	it('a box he drew covers the parts inside it: they are not guessed or counted', () => {
		const project = newProject();
		const record = add(project);
		const box = addDrawnPart(record, { left: 245, top: 90, right: 505, bottom: 270 });
		expect(box.id).toBe('b1');
		expect(box.row).toBe(0);
		expect(box.drawn).toBe(true);
		// not used yet: the drawn box covers nothing, and is itself the next guess only when picked
		expect(guessPart(record)).toBe('p1');
		usePart(record, 'b1', { char: 'm', itemId: 'glyph-0x6d' });
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		// p2 (250..350) and p3 (400..500) lie inside the used box
		expect(guessPart(record)).toBe('p4');
		expect(unusedParts(record)).toEqual(['p4', 'p5', 'p6', 'p7']);
		expect(addDrawnPart(record, { left: 1, top: 1, right: 1, bottom: 9 })).toBe(null);
		expect(addDrawnPart(record, { left: 10, top: 10, right: 40, bottom: 40 }).id).toBe('b2');
	});
});

describe('normalizePhotoRecord: a damaged record from a file is cleaned, never thrown on', () => {
	it('drops parts with no size, uses of unknown parts, bad letters and stray fields', () => {
		const clean = normalizePhotoRecord(
			{
				asset: 'img-wrong',
				width: '1500',
				height: 520,
				parts: [
					{ id: 'p1', left: 0, top: 0, right: 10, bottom: 10, row: 0, mask: [1, 2] },
					{ id: 'p2', left: 5, top: 5, right: 5, bottom: 9 },
					{ id: 'p1', left: 0, top: 0, right: 20, bottom: 20 },
					null,
					'nope',
				],
				used: { p1: { char: 'a', itemId: 'glyph-0x61', seq: 3 }, p9: { char: 'b' }, p2: 5 },
				skipped: ['p1', 'p8', 4],
				done: 'yes',
				scale: 'big',
				paper: 'cloth',
				extra: { a: 1 },
			},
			'img-aaaa0001'
		);
		expect(clean.asset).toBe('img-aaaa0001');
		expect(clean.width).toBe(0);
		expect(clean.parts).toEqual([{ id: 'p1', left: 0, top: 0, right: 10, bottom: 10, row: 0 }]);
		expect(clean.used).toEqual({ p1: { char: 'a', itemId: 'glyph-0x61', seq: 3 } });
		expect(clean.skipped).toEqual([]);
		expect(clean.done).toBe(false);
		expect(clean.scale).toBe(null);
		expect(clean.paper).toBe('scan');
		expect(clean.lightInk).toBe(false);
		expect(clean.find).toEqual({ paper: 'scan', lightInk: false });
		const found = normalizePhotoRecord(
			{ paper: 'photo', lightInk: true, find: { paper: 'scan', lightInk: false } },
			'img-b'
		);
		expect([found.paper, found.lightInk, found.find]).toEqual([
			'photo',
			true,
			{ paper: 'scan', lightInk: false },
		]);
		expect('extra' in clean).toBe(false);
		expect(normalizePhotoRecord(null, 'img-x').parts).toEqual([]);
	});

	it('reading a project whose photos entry is not an object finds no photos', () => {
		const project = newProject();
		project.settings.anyink.photos = 'broken';
		expect(listPhotos(project)).toEqual([]);
		expect(photoSummaries(project)).toEqual([]);
		expect(getPhoto(project, 'img-aaaa0001')).toBe(null);
		// adding one repairs the map
		expect(add(project).asset).toBe('img-aaaa0001');
		expect(Object.keys(project.settings.anyink.photos)).toEqual(['img-aaaa0001']);
	});
});

describe('placementPhoto: the record as B3 placement reads it', () => {
	let fixture;
	beforeAll(async () => {
		fixture = await loadPhotoFixture('brennan-hand');
	});

	it('the B r e n a H d row: parts kept without masks get them back, and placement sizes and seats every letter', () => {
		const { image, key } = fixture;
		const { mask, width, height } = photoInk(image, { paper: 'scan' });
		const found = findInk(mask, width, height);
		const project = newProject();
		const record = addPhoto(project, {
			asset: 'img-brennan1',
			width,
			height,
			parts: found.parts,
			paper: 'scan',
		});
		// the work file is saved and opened again: the masks are not in it
		const reopened = new GlyphrStudioProject(JSON.parse(JSON.stringify(project.save())));
		const stored = getPhoto(reopened, 'img-brennan1');
		expect(stored).toEqual(JSON.parse(JSON.stringify(record)));
		key.letters.forEach((letter, i) =>
			usePart(stored, `p${i + 1}`, { char: letter.char, itemId: `item-${i}` })
		);
		// the photo's ink again, the way its parts were found (not as Adjust may say now)
		setPaper(stored, 'photo');
		const again = photoInk(image, stored.find);
		expect(Array.from(again.mask)).toEqual(Array.from(mask));
		const photo = placementPhoto(stored, attachMasks(stored.parts, again.mask, width, height));
		expect(photo.asset).toBe('img-brennan1');
		expect(Object.keys(photo.uses)).toHaveLength(7);
		expect(photo.uses.p1).toEqual({ char: 'B', itemId: 'item-0' });
		const font = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
		const info = photoScale(photo, font);
		expect(info.scale).toBeGreaterThan(0);
		setScale(stored, info.scale);
		// the same scale as from the freshly found parts with their masks
		const fresh = placementPhoto(
			{ ...stored, parts: found.parts.map((p) => ({ ...p })) },
			found.parts
		);
		expect(photoScale(fresh, font).scale).toBeCloseTo(info.scale, 9);
		for (const id of Object.keys(photo.uses)) {
			expect(placePart(photo, id, font, { info })).toBeTruthy();
		}
	});

	it('first try: the e sits on the writing line by its own ink, never by the smudge under it', async () => {
		// first-timer: the smudge joined the e's part, and the traced e floated 430 units up
		const { image, key } = await loadPhotoFixture('first-try-phone');
		const { mask, width, height } = photoInk(image, { paper: 'photo' });
		const found = findInk(mask, width, height);
		const project = newProject();
		const record = addPhoto(project, { asset: 'img-first001', width, height, parts: found.parts });
		const inside = (p, [x, y]) => x >= p.left && x < p.right && y >= p.top && y < p.bottom;
		const partOf = (char) =>
			found.parts.find((p) => inside(p, key.letters.find((l) => l.char === char).center));
		// named as he did: B, r, then e
		['B', 'r', 'e'].forEach((char) =>
			usePart(record, partOf(char).id, { char, itemId: `glyph-${char}` })
		);
		const photo = placementPhoto(record, attachMasks(record.parts, mask, width, height));
		const font = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
		const placed = placePart(photo, partOf('e').id, font);
		// the bottom of the e's box in the key (just past its ink), in font units: on the line,
		// within B11's 2 % of the letter box above it (an e is round: 1.5 % below is its seat)
		const keyBottom = placed.y - key.letters[2].box[3] * placed.scale;
		expect(key.letters[2].char).toBe('e');
		expect(keyBottom).toBeLessThan(0.02 * 2048);
		expect(keyBottom).toBeGreaterThan(-0.06 * 2048);
	});

	it("a leftover at the photo's edge stays out of placement's rows, unless he named it", () => {
		const record = add(newProject(), 'img-aaaa0001', {
			parts: [...ROW, { id: 'p8', left: 1400, top: 240, right: 1500, bottom: 520, row: 0 }],
		});
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(placementPhoto(record).parts.map((p) => p.id)).not.toContain('p8');
		usePart(record, 'p8', { char: 'd', itemId: 'glyph-0x64' });
		expect(placementPhoto(record).parts.map((p) => p.id)).toContain('p8');
	});

	it('a use carries its tail choice through to placement; a used drawn box takes part', () => {
		const record = add(newProject());
		usePart(record, 'p1', { char: 'Q', itemId: 'glyph-0x51' });
		setTail(record, 'p1', false);
		const box = addDrawnPart(record, { left: 1000, top: 100, right: 1100, bottom: 260 });
		usePart(record, box.id, { char: 'd', itemId: 'glyph-0x64' });
		const photo = placementPhoto(record);
		expect(photo.uses.p1).toEqual({ char: 'Q', itemId: 'glyph-0x51', tail: false });
		expect(photo.parts.map((p) => p.id)).toContain('b1');
		// parts covered by a used box stay out of placement (they are not his letters)
		expect(photo.parts.map((p) => p.id)).not.toContain('p7');
	});
});

// B8 + B9 finalize (second hostile pass, the real dialog in Chrome on IMG_4131, IMG_4127 and
// IMG_6008): the alphabet prefill trusted a part that holds two touching letters, so l came from
// "lm", m from n and n from o; after n and a were each boxed and used, the green box went back to
// the "na" part; a dot left alone on a photo whose letter the edge cut was taken as the letter.
// Written to fail on the registry before the pass.
describe('finalize: touching letters, boxes that share a part, a lone dot', () => {
	// one row: j k [lm] n o, the "lm" part twice as wide as a letter
	const ROW2 = [
		{ id: 'p1', left: 100, top: 100, right: 160, bottom: 200, row: 0 },
		{ id: 'p2', left: 220, top: 100, right: 280, bottom: 200, row: 0 },
		{ id: 'p3', left: 340, top: 100, right: 500, bottom: 200, row: 0 },
		{ id: 'p4', left: 560, top: 120, right: 620, bottom: 200, row: 0 },
		{ id: 'p5', left: 680, top: 120, right: 740, bottom: 200, row: 0 },
		{ id: 'p6', left: 800, top: 185, right: 812, bottom: 197, row: 0 },
	];
	const page = () =>
		addPhoto(newProject(), { asset: 'img-lmlm0001', width: 900, height: 300, parts: ROW2 });

	it('no prefill on a part that may hold two touching letters, nor on the part after it', () => {
		const record = page();
		usePart(record, 'p1', { char: 'j', itemId: 'glyph-0x6A' });
		usePart(record, 'p2', { char: 'k', itemId: 'glyph-0x6B' });
		// the green box on "lm": he types the letter himself
		expect(prefillChar(record, 'p3')).toBe('');
		// he names it l (a box he drew would be better): the n after it is no m
		usePart(record, 'p3', { char: 'l', itemId: 'glyph-0x6C' });
		expect(prefillChar(record, 'p4')).toBe('');
		// named right again (m, n): the run goes on (o)
		usePart(record, 'p4', { char: 'n', itemId: 'glyph-0x6E' });
		const fresh = page();
		usePart(fresh, 'p4', { char: 'm', itemId: 'glyph-0x6D' });
		usePart(fresh, 'p5', { char: 'n', itemId: 'glyph-0x6E' });
		expect(prefillChar(fresh, 'p6')).toBe('');
	});

	it('no prefill on a skipped part, or one far smaller than a letter', () => {
		const record = add(newProject());
		usePart(record, 'p1', { char: 'a', itemId: 'glyph-0x61' });
		usePart(record, 'p2', { char: 'b', itemId: 'glyph-0x62' });
		expect(prefillChar(record, 'p3')).toBe('c');
		skipPart(record, 'p3');
		expect(prefillChar(record, 'p3')).toBe('');
		const tiny = addPhoto(newProject(), {
			asset: 'img-tiny0001',
			width: 1500,
			height: 520,
			parts: [...ROW.slice(0, 2), { id: 'p3', left: 410, top: 240, right: 420, bottom: 250, row: 0 }],
		});
		usePart(tiny, 'p1', { char: 'a', itemId: 'glyph-0x61' });
		usePart(tiny, 'p2', { char: 'b', itemId: 'glyph-0x62' });
		expect(prefillChar(tiny, 'p3')).toBe('');
	});

	it('boxes he drew round each of two touching letters together cover their shared part', () => {
		// "na" as one part 300..440; he boxed n (296..372) and a (368..444)
		const record = addPhoto(newProject(), {
			asset: 'img-nana0001',
			width: 900,
			height: 300,
			parts: [
				{ id: 'p1', left: 100, top: 100, right: 160, bottom: 200, row: 0 },
				{ id: 'p2', left: 300, top: 100, right: 440, bottom: 200, row: 0 },
				{ id: 'p3', left: 560, top: 100, right: 620, bottom: 200, row: 0 },
			],
		});
		const n = addDrawnPart(record, { left: 296, top: 96, right: 372, bottom: 204 });
		const a = addDrawnPart(record, { left: 368, top: 96, right: 444, bottom: 204 });
		usePart(record, n.id, { char: 'n', itemId: 'glyph-0x6E' });
		expect(unusedParts(record)).toEqual(['p1', 'p2', 'p3']);
		usePart(record, a.id, { char: 'a', itemId: 'glyph-0x61' });
		expect(unusedParts(record)).toEqual(['p1', 'p3']);
		expect(guessPart(record, { char: 'b' })).not.toBe('p2');
	});

	it("a lone pen dot is no letter: not the only part, not the guess (the g the edge cut)", () => {
		const record = addPhoto(newProject(), {
			asset: 'img-dotg0001',
			width: 1500,
			height: 2000,
			pen: 30,
			parts: [{ id: 'p1', left: 700, top: 300, right: 760, bottom: 358, row: 0 }],
		});
		expect(record.pen).toBe(30);
		expect(onlyPart(record, { char: 'y' })).toBe(null);
		expect(guessPart(record, { char: 'y' })).toBe(null);
		// a period may be just that
		expect(onlyPart(record, { char: '.' })).toBe('p1');
		// a letter-sized part alone is still the only one
		const g = addPhoto(newProject(), {
			asset: 'img-gggg0002',
			width: 1500,
			height: 2000,
			pen: 30,
			parts: [{ id: 'p1', left: 351, top: 543, right: 705, bottom: 1441, row: 0 }],
		});
		expect(onlyPart(g, { char: 'g' })).toBe('p1');
		// a record from before the pen was kept reads as before
		expect(normalizePhotoRecord({ parts: [] }, 'img-old').pen).toBe(0);
	});
});
