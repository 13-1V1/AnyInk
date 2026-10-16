// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 finalize (written to fail first): Ctrl+S, Save As, a download and Use in Word finish an
	open sketch piece first (the Undo gate's endOpenPiece), so the file holds what he sees; the
	text is built after the piece's step.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setFeaturesForTests, resetFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import {
	isPieceOpen,
	resetUndoGateForTests,
	setOpenPiece,
} from '../../sketch/tools/undo_gate.js';
import { closeUseInWord, openUseInWord } from '../../install/use_in_word_dialog.js';
import { openBrennanHand } from '../../install/tests/install_fixture.js';
import { kvClear } from '../../storage/kv.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { resetFileApi, setFileApi } from '../file_api.js';
import { downloadProject, saveProject, saveProjectAs } from '../project_files.js';
import { clearDialogs, fakeApi, fakeEditor } from './fakes.js';

if (!Element.prototype.animate) Element.prototype.animate = () => ({});

/** An open piece that notes when it was finished, against the order of other events */
function openPieceWith(order) {
	const piece = {
		pointCount: () => 3,
		removeLastPoint() {},
		cancel() {},
		finish: vi.fn(() => order.push('finish')),
	};
	setOpenPiece(piece);
	return piece;
}

/** fakeEditor that notes when its text is built */
function editorWith(order) {
	const editor = fakeEditor('Sketch Save');
	const make = editor.makeProjectFileText;
	editor.makeProjectFileText = async () => {
		order.push('text');
		return make();
	};
	return editor;
}

beforeEach(async () => {
	await kvClear();
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
	resetToastsForTests();
	clearDialogs();
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	closeUseInWord();
	resetUndoGateForTests();
	resetFileApi();
	resetFeaturesForTests();
	setModeForTests('all');
	clearDialogs();
	vi.restoreAllMocks();
	document.body.innerHTML = '';
});

describe('a save finishes the open piece first', () => {
	for (const [name, save] of Object.entries({ saveProject, saveProjectAs, downloadProject })) {
		it(`${name}: the piece is one step before the text is built`, async () => {
			setFileApi(fakeApi({}));
			const order = [];
			const piece = openPieceWith(order);
			expect(await save(editorWith(order))).toBe(true);
			expect(piece.finish).toHaveBeenCalledTimes(1);
			expect(order).toEqual(['finish', 'text']);
			expect(isPieceOpen()).toBe(false);
		});
	}

	it('with no piece open nothing changes', async () => {
		setFileApi(fakeApi({}));
		const order = [];
		expect(await saveProject(editorWith(order))).toBe(true);
		expect(order).toEqual(['text']);
	});
});

describe('Use in Word finishes the open piece first', () => {
	it('opening the dialog ends the piece', () => {
		setModeForTests('simple');
		setFeaturesForTests({ useInWord: true, sketch: true });
		const editor = openBrennanHand();
		const order = [];
		const piece = openPieceWith(order);
		openUseInWord({ editor });
		expect(piece.finish).toHaveBeenCalledTimes(1);
		expect(isPieceOpen()).toBe(false);
	});
});
