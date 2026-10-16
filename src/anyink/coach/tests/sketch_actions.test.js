// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S3: the Next line's sketch buttons (sketch_actions.js) and the line read again when a piece
	opens, gets a point or ends:
	  [Done] (rule 19)         Enter to the picked sketch tool; a tool that keeps the piece open
	                           has it ended by the Undo gate
	  [Looks good] (rule 24)   the letter's thickness becomes the font's, within its range
	  [Just this one] (25)     the line's own skip
	installSketchCoach installs them once, only with the 'sketch' flag on. Written to fail first
	(none of it existed).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { newSketch, setSketch, thicknessRange } from '../../sketch/model.js';
import { registerSketchTool } from '../../sketch/tools/tool_route.js';
import {
	isPieceOpen,
	resetUndoGateForTests,
	setOpenPiece,
	clearOpenPiece,
	SKETCH_PIECE_EVENT,
} from '../../sketch/tools/undo_gate.js';
import { hasCoachAction, runCoachAction } from '../actions.js';
import { getCoach, resetCoachForTests } from '../coach_state.js';
import {
	finishPiece,
	installSketchCoach,
	keepThickness,
	resetSketchCoachForTests,
	SKETCH_COACH_ACTIONS,
} from '../sketch_actions.js';

/** A piece the Undo gate holds open; finish / cancel end it there */
function openPiece() {
	const piece = {
		pointCount: () => 2,
		removeLastPoint() {},
		cancel: () => clearOpenPiece(piece),
		finish: vi.fn(() => clearOpenPiece(piece)),
	};
	setOpenPiece(piece);
	return piece;
}

let editor;
let forget = [];
beforeEach(() => {
	setModeForTests('simple');
	setFeaturesForTests({ letterView: true, sketch: true });
	editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	resetUndoGateForTests();
});
afterEach(() => {
	forget.forEach((undo) => undo());
	forget = [];
	resetSketchCoachForTests();
	resetUndoGateForTests();
	resetCoachForTests();
	resetFeaturesForTests();
	setModeForTests('all');
});

describe('[Done]', () => {
	it('Enter goes to the picked sketch tool, which finishes its piece', () => {
		const piece = openPiece();
		const key = vi.fn((press) => {
			if (press.key === 'enter') piece.finish();
			return true;
		});
		forget.push(registerSketchTool('sketchLine', { key }));
		editor.selectedTool = 'sketchLine';
		expect(finishPiece(null, { editor })).toBe(true);
		expect(key).toHaveBeenCalledWith(expect.objectContaining({ type: 'down', key: 'enter' }));
		expect(piece.finish).toHaveBeenCalledTimes(1);
		expect(isPieceOpen()).toBe(false);
	});

	it('a tool that keeps it open (or none): the Undo gate ends it', () => {
		const piece = openPiece();
		editor.selectedTool = 'resize';
		expect(finishPiece(null, { editor })).toBe(true);
		expect(piece.finish).toHaveBeenCalledTimes(1);
	});

	it('nothing open: nothing to do', () => {
		expect(finishPiece(null, { editor })).toBe(true);
	});
});

describe('[Looks good]', () => {
	it("the letter's thickness becomes the font's", () => {
		setSketch(editor.selectedGlyph, newSketch({ thickness: 60 }));
		expect(keepThickness({ thickness: 60 }, { editor })).toBe(60);
		expect(editor.project.settings.anyink.sketchThickness).toBe(60);
	});

	it("with no thickness given: the open letter's sketch; kept inside the font's range", () => {
		const { max } = thicknessRange(editor.project);
		setSketch(editor.selectedGlyph, newSketch({ thickness: max + 500 }));
		expect(keepThickness({}, { editor })).toBe(max);
		expect(keepThickness({}, {})).toBeNull();
	});
});

describe('installSketchCoach', () => {
	it('installs the three actions once, with the flag on', () => {
		expect(installSketchCoach()).toBe(true);
		expect(installSketchCoach()).toBe(true);
		SKETCH_COACH_ACTIONS.forEach((name) => expect(hasCoachAction(name)).toBe(true));
	});

	it('guard, the flag off: nothing installed', () => {
		setFeaturesForTests({ sketch: false });
		expect(installSketchCoach()).toBe(false);
		SKETCH_COACH_ACTIONS.forEach((name) => expect(hasCoachAction(name)).toBe(false));
	});

	it('the Next line is read again whenever the piece changes', () => {
		installSketchCoach();
		const refresh = vi.spyOn(getCoach(), 'refresh');
		globalThis.dispatchEvent(new CustomEvent(SKETCH_PIECE_EVENT));
		expect(refresh).toHaveBeenCalled();
	});

	it("the line's button runs it ([Looks good] through runCoachAction)", () => {
		installSketchCoach();
		setSketch(editor.selectedGlyph, newSketch({ thickness: 70 }));
		expect(runCoachAction('sketchThicknessOk', { thickness: 70 }, { editor })).toBe(true);
		expect(editor.project.settings.anyink.sketchThickness).toBe(70);
	});
});
