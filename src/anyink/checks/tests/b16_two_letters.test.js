// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16 acceptance (impatient run): two touching letters ("na") named n and Used anyway made a
// Ready small n that was really "na"; nothing ever said so. A letter traced from a part that may
// hold two touching letters (photo_registry.js letterMayBeTwo) now needs a look, "small n may be
// two letters that touch.", with [Draw a box] (the photo dialog on the letter, as Trace again
// opens it), and "Looks fine to me" for a letter that really is one. An m or w named for a part
// only a little wide is one letter. Written to fail before the check existed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { TRACE_AGAIN_EVENT } from '../../letter/letter_card.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { setPhotoFit } from '../../photo/photo_flow_fit.js';
import { addPhoto, usePart } from '../../photo/photo_registry.js';
import { getChecksCache, resetChecksCacheForTests } from '../cache.js';
import { CHECK, FIX } from '../checks.js';
import { applyFix } from '../fixes.js';
import { checksFont, letter, plain } from './letters.js';

beforeEach(() => {
	resetChecksCacheForTests();
	setModeForTests('simple');
	setFeaturesForTests({ checks: true });
});
afterEach(() => {
	resetChecksCacheForTests();
	setModeForTests('all');
});

const ASSET = 'img-two';

/** A photo of four letter-wide parts and one wider part p5 (wide px) named `char` */
function twoEditor(char, wide) {
	const editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = checksFont(plain('oaenm'));
	editor.nav.page = 'Overview';
	const box = (i, w = 100) => ({
		id: `p${i}`,
		left: 20 + i * 300,
		top: 20,
		right: 20 + i * 300 + w,
		bottom: 140,
		row: 0,
	});
	const record = addPhoto(editor.project, {
		asset: ASSET,
		width: 2000,
		height: 200,
		parts: [box(1), box(2), box(3), box(4), box(5, wide)],
	});
	const item = letter(editor.project, char);
	usePart(record, 'p5', { char, itemId: item.id });
	setPhotoFit(item, { asset: ASSET, part: 'p5', shapes: item.shapes });
	item.anyink.trace = { asset: ASSET, x: 0, y: 0, scale: 1, width: 2000, height: 200 };
	return { editor, item };
}

const stateOf = (editor, item) => getChecksCache().state(editor, item);

describe('a letter traced from two touching letters needs a look', () => {
	it('"na" named n: small n may be two letters that touch, [Draw a box], not Ready', () => {
		const { editor, item } = twoEditor('n', 260);
		const state = stateOf(editor, item);
		expect(state.ready).toBe(false);
		expect(state.needsLook).toMatchObject({
			id: CHECK.twoLetters,
			fix: FIX.drawBox,
			reason: 'small n may be two letters that touch.',
			fixLabel: 'Draw a box',
		});
	});

	it('an m written a little wide is one letter', () => {
		const { editor, item } = twoEditor('m', 180);
		expect(stateOf(editor, item).checks.map((c) => c.id)).not.toContain(CHECK.twoLetters);
	});

	it('[Draw a box] opens the photo dialog on that letter (Trace again), no step', () => {
		const { editor, item } = twoEditor('n', 260);
		const heard = vi.fn();
		window.addEventListener(TRACE_AGAIN_EVENT, heard);
		const steps = editor.history.queue.length;
		applyFix(editor, item.id, FIX.drawBox);
		window.removeEventListener(TRACE_AGAIN_EVENT, heard);
		expect(heard).toHaveBeenCalledTimes(1);
		expect(heard.mock.calls[0][0].detail).toEqual({ itemId: item.id });
		expect(editor.history.queue.length).toBe(steps);
	});
});
