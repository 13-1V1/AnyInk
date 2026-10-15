// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-ui fix pass (finding 2, with photo-core's letter-aware guess): with the letter known
// ("Which part is your small z?") the green box, and so the close-up view, starts where
// photo_registry.js guessPart(record, { char }) says that letter most likely is; with the letter
// unknown the guess is the next part in reading order, as before. Written before startPart
// passed the letter (failed: guessPart was asked without it).
// The suite's setup loads the app shell, and with it the dialog, before a mock here applies, so
// the dialog and what it reads are loaded fresh after the mock (vi.resetModules).
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { photoFont } from './photo_dialog_fixture.js';

vi.mock('../photo_registry.js', async (importOriginal) => {
	const original = await importOriginal();
	return { ...original, guessPart: vi.fn(original.guessPart) };
});

let dialog;
let registry;
let mode;
let features;

beforeAll(async () => {
	vi.resetModules();
	registry = await import('../photo_registry.js');
	mode = await import('../../mode/mode.js');
	features = await import('../../mode/features.js');
	dialog = await import('../photo_dialog.js');
});

beforeEach(() => {
	mode.setModeForTests('simple');
	features.setFeaturesForTests({ photo: true });
	registry.guessPart.mockClear();
	dialog.closePhotoDialog();
	document.body.innerHTML = '';
});

describe('where the green box starts', () => {
	it('letter known: the guess for that letter', () => {
		const { record } = photoFont();
		dialog.startPart(record, { char: 'z' });
		expect(registry.guessPart).toHaveBeenLastCalledWith(record, { char: 'z' });
		expect(dialog.openPhotoDialog({ record, char: 'z' })).not.toBe(null);
		expect(registry.guessPart).toHaveBeenLastCalledWith(record, { char: 'z' });
	});

	it('letter unknown: the next part in reading order, as before', () => {
		const { record } = photoFont();
		expect(dialog.openPhotoDialog({ record })).not.toBe(null);
		expect(registry.guessPart.mock.calls.at(-1)).toEqual([record]);
	});

	it('a part he picked, or the one this letter used, still wins over any guess', () => {
		const { record } = photoFont();
		expect(dialog.startPart(record, { char: 'z', pick: 'p6' })).toBe('p6');
		registry.usePart(record, 'p4', { char: 'n', itemId: 'glyph-0x6e' });
		expect(dialog.startPart(record, { char: 'n', itemId: 'glyph-0x6e' })).toBe('p4');
		expect(registry.guessPart).not.toHaveBeenCalled();
	});
});
