// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B10 + B11 fix pass: the size check waits while the photo is still being traced (UX-BEGINNER.md
// 4.4 "One size for the whole photo", 4.2 "Ready"; the critic's IMG_5012 walk: mid-photo the
// wrong letters turned amber and the rail dropped, because the photo's scale still moved with
// every letter he named). A letter exactly as traced from a photo with free parts left and no
// "Done with this photo" has no size check yet; every other check still shows; Done, or the
// last part used, brings it (with no Undo step between: the cache sees the photo change); a
// letter he changed since is judged at once. Written to fail first: the size check showed
// mid-walk.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setPhotoFit } from '../../photo/photo_flow_fit.js';
import { addPhoto, markDone, skipPart, usePart } from '../../photo/photo_registry.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { CHECK } from '../checks.js';
import { photoWalkStamp, sizeWaits } from '../photo_walk.js';
import { AUTO, checksFont, letter, moved, plain, scaled, shapesFor } from './letters.js';

beforeEach(() => {
	resetChecksCacheForTests();
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
});
afterEach(() => {
	resetChecksCacheForTests();
	setModeForTests('all');
});

const ASSET = 'img-walk';

/**
 * A font whose n and H were traced from one photo of four parts, n written 40 % too tall (its
 * size check is due once the photo is used up) and H 15 % too low on the line (an offLine check
 * that never waits).
 */
function walkEditor() {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = checksFont({
		...plain('oae'),
		n: { shapes: scaled(shapesFor('n'), 1.4), anyink: { ...AUTO } },
		H: { shapes: moved(shapesFor('H'), 0, 300), anyink: { ...AUTO } },
	});
	editor.nav.page = 'Overview';
	const box = (i) => ({
		id: `p${i}`,
		left: 20 + i * 120,
		top: 20,
		right: 120 + i * 120,
		bottom: 140,
		row: 0,
	});
	const record = addPhoto(editor.project, {
		asset: ASSET,
		width: 800,
		height: 200,
		parts: [box(1), box(2), box(3), box(4)],
	});
	[
		['p1', 'n'],
		['p2', 'H'],
	].forEach(([part, char]) => {
		const item = letter(editor.project, char);
		usePart(record, part, { char, itemId: item.id });
		setPhotoFit(item, { asset: ASSET, part, shapes: item.shapes });
	});
	return { editor, record };
}

const ids = (editor, char) =>
	getChecksCache()
		.state(editor, letter(editor.project, char))
		.checks.map((check) => check.id);

describe('the size check waits for the photo', () => {
	it('mid-walk: n, traced 40 % too tall, has no size check and is Ready', () => {
		const { editor } = walkEditor();
		const n = letter(editor.project, 'n');
		expect(sizeWaits(n, editor.project)).toBe(true);
		expect(ids(editor, 'n')).toEqual([]);
		expect(getChecksCache().state(editor, n).ready).toBe(true);
	});

	it('every other check still shows: H, traced floating, floats', () => {
		const { editor } = walkEditor();
		expect(ids(editor, 'H')).toEqual([CHECK.offLine]);
	});

	it('Done with this photo brings the size check, with no step in between', () => {
		const { editor, record } = walkEditor();
		expect(ids(editor, 'n')).toEqual([]);
		markDone(record);
		expect(ids(editor, 'n')).toEqual([CHECK.size]);
	});

	it('the last free part used, or skipped, brings it too', () => {
		const { editor, record } = walkEditor();
		// a period never moves the photo's scale (placement/classes.js feedsScale)
		usePart(record, 'p3', { char: '.', itemId: 'glyph-0x2E' });
		expect(ids(editor, 'n')).toEqual([]);
		skipPart(record, 'p4');
		expect(ids(editor, 'n')).toEqual([CHECK.size]);
	});

	// B10 + B11 finalize: a part he never names (a stray dot, a smudge) no longer hides the size
	// check for good; from the fifth plain letter named the photo's scale holds (second pass: a
	// median of three called the wrong letter, the verifier's e H r B d a n walk)
	it('from the fifth plain letter named, the size shows with free parts left and no Done', () => {
		const { editor, record } = walkEditor();
		[5, 6].forEach((i) =>
			record.parts.push({
				id: `p${i}`,
				left: 20 + i * 120,
				top: 20,
				right: 120 + i * 120,
				bottom: 140,
				row: 0,
			})
		);
		expect(ids(editor, 'n')).toEqual([]);
		usePart(record, 'p3', { char: 'o', itemId: letter(editor.project, 'o').id });
		usePart(record, 'p4', { char: 'a', itemId: letter(editor.project, 'a').id });
		expect(ids(editor, 'n')).toEqual([]);
		usePart(record, 'p5', { char: 'e', itemId: letter(editor.project, 'e').id });
		expect(ids(editor, 'n')).toEqual([CHECK.size]);
		expect(sizeWaits(letter(editor.project, 'n'), editor.project)).toBe(false);
	});

	it('a letter he changed since he traced it is judged at once', () => {
		const { editor } = walkEditor();
		const n = letter(editor.project, 'n');
		n.shapes[0].pathPoints[0].p.x += 20;
		n.changed?.();
		expect(sizeWaits(n, editor.project)).toBe(false);
		expect(getChecksCache().refresh(editor, { force: true }).ran).toBe(true);
		expect(ids(editor, 'n')).toEqual([CHECK.size]);
	});

	it('a letter not traced from a photo, or a font with no photos, is judged as always', () => {
		const editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		editor.project = checksFont({ n: scaled(shapesFor('n'), 1.4) });
		expect(sizeWaits(letter(editor.project, 'n'), editor.project)).toBe(false);
		expect(photoWalkStamp(editor.project)).toBe('');
		expect(ids(editor, 'n')).toEqual([CHECK.size]);
	});

	it('the stamp changes when a part is skipped or the photo done; reading changes nothing', () => {
		const { editor, record } = walkEditor();
		const before = JSON.stringify(editor.project.settings.anyink.photos);
		const first = photoWalkStamp(editor.project);
		expect(sizeWaits(letter(editor.project, 'n'), editor.project)).toBe(true);
		expect(JSON.stringify(editor.project.settings.anyink.photos)).toBe(before);
		skipPart(record, 'p4');
		const second = photoWalkStamp(editor.project);
		expect(second).not.toBe(first);
		markDone(record);
		expect(photoWalkStamp(editor.project)).not.toBe(second);
	});
});
