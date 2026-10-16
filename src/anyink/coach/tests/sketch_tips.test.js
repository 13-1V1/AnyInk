// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 undo-tips: the sketch tools' first-pick tips (docs/SKETCH.md section 2 Tips). The first time
	each sketch tool is picked the Next line shows its one-line tip, in SKETCH.md's words; like the
	Point pen's, a sketch tool's tip stays through his clicks while a piece is open (the Undo
	gate's isPieceOpen) and goes at his next action once it is finished. The Line tip comes back
	when Arc is picked right after a Line end (show(name, { again: true })), still inside the
	session's 3. With the 'sketch' flag off none shows. Also on the real coach: picking the tool
	(the 'whichToolIsSelected' topic) shows the tip.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPref, resetPrefsCache } from '../../prefs/prefs.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import {
	clearOpenPiece,
	resetUndoGateForTests,
	setOpenPiece,
} from '../../sketch/tools/undo_gate.js';
import { word } from '../../words/words.js';
import { TIPS, TIPS_PREF, TOOL_TIPS, makeTips, toolTipFor } from '../tips.js';

function manualDefer() {
	const queue = [];
	const defer = (fn) => queue.push(fn);
	defer.flush = () => queue.splice(0).forEach((fn) => fn());
	return defer;
}

const line = () => 'small n is empty. Sketch it.';
const sketchOn = (flag) => flag === 'sketch';

/** A piece with n clicks, open through the gate */
function openPiece(n = 2) {
	const piece = { n, pointCount: () => piece.n, removeLastPoint() {}, cancel() {}, finish() {} };
	setOpenPiece(piece);
	return piece;
}

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	resetUndoGateForTests();
	setFeaturesForTests({ sketch: true });
});
afterEach(() => {
	resetUndoGateForTests();
	resetFeaturesForTests();
});

const TOOLS = {
	sketchLine: 'Click, click. Double-click, right-click or Enter to finish. Drag once for a single line. Pull back over the last end for an arc.',
	sketchArc: word('sketch.tip.arc'),
	sketchSpline: 'Fewer points, smoother curve.',
	sketchCircle: word('sketch.tip.circle'),
	sketchRectangle: word('sketch.tip.rectangle'),
};

describe('each sketch tool has its tip', () => {
	it('the tools map to their tips, all shipped with the sketch flag', () => {
		Object.keys(TOOLS).forEach((tool) => {
			expect(TOOL_TIPS[tool]).toBe(tool);
			expect(TIPS[tool].feature).toBe('sketch');
			expect(TIPS[tool].key).toMatch(/^sketch\.tip\./);
		});
		expect(TIPS.sketchDots).toMatchObject({ key: 'sketch.tip.dots', feature: 'sketch' });
		// the tools B6 had keep theirs
		expect(TOOL_TIPS).toMatchObject({ nib: 'brush', newPath: 'pointPen' });
	});

	it("SKETCH.md's words; the three it leaves out are short and new", () => {
		expect(word('sketch.tip.arc')).toBe(
			// S3 fix: the bend click sets the arc; the piece stays open for more (critic 15-arc-done.png)
			'From an open end, one click sets where the arc ends. Or click the start, the end, then how far it bends. Press Enter or double-click to finish.'
		);
		expect(word('sketch.tip.circle')).toBe(
			'Click the center and drag the size. Or click one guide line, then another.'
		);
		expect(word('sketch.tip.rectangle')).toBe('Click one corner, then the other.');
	});

	Object.entries(TOOLS).forEach(([tool, text]) => {
		it(`${tool}: shows once, ever, at its first pick`, () => {
			const tips = makeTips({ isOn: sketchOn, defer: manualDefer(), getSentence: line });
			expect(tips.show(TOOL_TIPS[tool])).toBe(true);
			expect(tips.current().text).toBe(text);
			expect(getPref(TIPS_PREF)).toEqual([tool]);
			const later = makeTips({ isOn: sketchOn, defer: manualDefer(), getSentence: line });
			expect(later.show(TOOL_TIPS[tool])).toBe(false);
		});
	});

	it("with the 'sketch' flag off none shows", () => {
		const tips = makeTips({ isOn: () => false, defer: manualDefer(), getSentence: line });
		Object.keys(TOOLS).forEach((tool) => expect(tips.show(tool)).toBe(false));
		expect(tips.show('sketchDots')).toBe(false);
	});
});

describe('the tip stays while a piece is open, like the Point pen', () => {
	it('his clicks on an open piece keep it; the next action after the piece goes takes it', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: sketchOn, defer, getSentence: line });
		tips.show('sketchLine');
		defer.flush();
		const piece = openPiece(1);
		tips.noteAction();
		piece.n = 3;
		tips.noteAction();
		expect(tips.current()?.name).toBe('sketchLine');
		clearOpenPiece(piece);
		tips.noteAction();
		expect(tips.current()).toBeNull();
	});

	it('a tip that is not a drawing tool\'s goes at the next action, piece or not', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: sketchOn, defer, getSentence: line });
		openPiece(2);
		tips.show('sketchDots');
		defer.flush();
		tips.noteAction();
		expect(tips.current()).toBeNull();
	});

	it('the caller can still say how long (keeps), as the coach does for the Point pen', () => {
		const defer = manualDefer();
		const tips = makeTips({
			isOn: () => true,
			defer,
			getSentence: line,
			keeps: (name) => name === 'pointPen',
			drawing: () => false,
		});
		tips.show('pointPen');
		defer.flush();
		tips.noteAction();
		expect(tips.current()?.name).toBe('pointPen');
	});

	it('with the flag off an open piece keeps nothing', () => {
		setFeaturesForTests({ sketch: false });
		const defer = manualDefer();
		const tips = makeTips({ isOn: () => true, defer, getSentence: line });
		tips.show('pointPen');
		defer.flush();
		openPiece(2);
		tips.noteAction();
		expect(tips.current()).toBeNull();
	});
});

describe('the Line tip again when Arc is picked right after a Line end', () => {
	it('toolTipFor: Arc after a Line end is the Line tip, again, once the Arc tip is seen', () => {
		expect(toolTipFor('sketchArc', { afterLineEnd: true, seen: ['sketchArc'] })).toEqual({
			name: 'sketchLine',
			again: true,
		});
		expect(toolTipFor('sketchArc')).toEqual({ name: 'sketchArc', again: false });
		expect(toolTipFor('sketchLine', { afterLineEnd: true })).toEqual({
			name: 'sketchLine',
			again: false,
		});
		expect(toolTipFor('select')).toBeNull();
	});

	it('show(again) brings a seen Line tip back, within the 3 a session', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: sketchOn, defer, getSentence: line });
		expect(tips.show('sketchLine')).toBe(true);
		defer.flush();
		tips.noteAction();
		expect(tips.show('sketchLine')).toBe(false);
		expect(tips.show('sketchLine', { again: true })).toBe(true);
		expect(tips.current().name).toBe('sketchLine');
		expect(getPref(TIPS_PREF)).toEqual(['sketchLine']);
		expect(tips.shownCount()).toBe(2);
		tips.show('sketchSpline');
		expect(tips.show('sketchLine', { again: true })).toBe(false);
	});

	it('only a tip made to come back does', () => {
		const tips = makeTips({ isOn: sketchOn, defer: manualDefer(), getSentence: line });
		tips.show('sketchSpline');
		expect(tips.show('sketchSpline', { again: true })).toBe(false);
	});
});
