// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: tips (UX-BEGINNER.md 4.0 Tips): a quiet "Tip:" line under the sentence, at most 3 in the
// first session, never one that repeats the sentence above it, each gone after his next action;
// seen tips are kept in prefs (tipsSeen) and Menu > Help > "Show tips again" resets them.
import { beforeEach, describe, expect, it } from 'vitest';
import { getPref, resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { MAX_TIPS_PER_SESSION, TIPS, TIPS_PREF, TOOL_TIPS, makeTips } from '../tips.js';

/** A defer the test runs by hand: the press that showed a tip doesn't take it away */
function manualDefer() {
	const queue = [];
	const defer = (fn) => queue.push(fn);
	defer.flush = () => queue.splice(0).forEach((fn) => fn());
	return defer;
}

const allOn = () => true;
/** The Next line showing a sentence for the tip to sit under */
const line = () => 'Capital B is empty. Draw it with points.';

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
});

describe('tips', () => {
	it('each tip names a words key and a feature flag; tools map to tips', () => {
		Object.values(TIPS).forEach((tip) => {
			expect(tip.key).toMatch(/^coach\.tip\./);
			expect(typeof tip.feature).toBe('string');
		});
		expect(TOOL_TIPS).toEqual({
			nib: 'brush',
			pathEdit: 'editPoints',
			newPath: 'pointPen',
			newRectangle: 'shapes',
			newOval: 'shapes',
		});
		expect(MAX_TIPS_PER_SESSION).toBe(3);
	});

	it('shows a tip once, ever: it is kept in prefs as seen', () => {
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(tips.show('pointPen')).toBe(true);
		expect(tips.current()?.text).toBe(
			'Click to drop points. Hold and drag to bend the curve. Click the first point to finish.'
		);
		expect(getPref(TIPS_PREF)).toEqual(['pointPen']);
		const nextSession = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(nextSession.show('pointPen')).toBe(false);
		expect(nextSession.current()).toBe(null);
	});

	it('at most 3 tips in a session', () => {
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(['pointPen', 'editPoints', 'shapes'].map((name) => tips.show(name))).toEqual([
			true,
			true,
			true,
		]);
		expect(tips.show('brush')).toBe(false);
		expect(tips.current().name).toBe('shapes');
		expect(getPref(TIPS_PREF)).toEqual(['pointPen', 'editPoints', 'shapes']);
	});

	it('a tip whose feature flag is off never shows (principle 8)', () => {
		const tips = makeTips({ isOn: (flag) => flag === 'coach', defer: manualDefer(), getSentence: line });
		expect(tips.show('brush')).toBe(false);
		expect(tips.show('photoStays')).toBe(false);
		expect(tips.show('pointPen')).toBe(true);
		expect(tips.show('nothing')).toBe(false);
	});

	it('never a tip that repeats the sentence above it (not counted, not seen)', () => {
		const sentence = 'Drag to draw. Draw one inside another to cut a hole.';
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: () => sentence });
		expect(tips.show('shapes')).toBe(false);
		expect(getPref(TIPS_PREF, [])).toEqual([]);
		expect(tips.shownCount()).toBe(0);
	});

	// B6 + B7 fix pass (hostile probe_tips): with the line hidden ("x"), or emptied by a dialog,
	// a tip was marked seen and counted, and never shown
	it('never shows, and is never used up, while the line is hidden or has no sentence', () => {
		[() => '', () => null, () => undefined].forEach((getSentence) => {
			const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence });
			expect(tips.show('pointPen')).toBe(false);
			expect(tips.current()).toBe(null);
			expect(tips.shownCount()).toBe(0);
		});
		expect(getPref(TIPS_PREF, [])).toEqual([]);
		// the line back: the tip shows the first time it is wanted
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(tips.show('pointPen')).toBe(true);
	});

	it('with no sentence to read, there is nowhere for a tip', () => {
		expect(makeTips({ isOn: allOn, defer: manualDefer() }).show('pointPen')).toBe(false);
	});

	it('goes after his next action, but not the one that showed it', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: allOn, defer, getSentence: line });
		tips.show('editPoints');
		tips.noteAction(); // the key or click that picked the tool
		expect(tips.current()?.name).toBe('editPoints');
		defer.flush();
		tips.noteAction(); // his next press
		expect(tips.current()).toBe(null);
	});

	it('"Show tips again" forgets the seen tips and the session count', () => {
		setPref(TIPS_PREF, ['pointPen', 'editPoints', 'shapes']);
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(tips.show('pointPen')).toBe(false);
		tips.reset();
		expect(getPref(TIPS_PREF)).toEqual([]);
		expect(tips.show('pointPen')).toBe(true);
	});

	it('tells its listeners when the tip line changes', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: allOn, defer, getSentence: line });
		let calls = 0;
		const stop = tips.subscribe(() => calls++);
		tips.show('pointPen');
		defer.flush();
		tips.noteAction();
		expect(calls).toBe(2);
		stop();
		tips.reset();
		expect(calls).toBe(2);
	});

	it('a broken tipsSeen pref is read as none seen', () => {
		setPref(TIPS_PREF, 'pointPen');
		const tips = makeTips({ isOn: allOn, defer: manualDefer(), getSentence: line });
		expect(tips.show('pointPen')).toBe(true);
		expect(getPref(TIPS_PREF)).toEqual(['pointPen']);
	});
});

// B6 + B7 finalize (letter card verdict: "Edit points tip talks about round handles a clicked
// shape doesn't have"; "the Point pen tip should stay until the shape is finished")
describe('the drawing tips', () => {
	it('Edit points: drag a point, press Smooth to round a corner (a clicked shape has no handles)', async () => {
		const { word } = await import('../../words/words.js');
		expect(word('coach.tip.editPoints')).toBe('Drag a point to reshape it. Press Smooth to round a corner.');
	});

	it('the Point pen tip stays while its shape is being drawn, and goes after the next press once it is finished', () => {
		const defer = manualDefer();
		let drawing = false;
		const tips = makeTips({
			isOn: allOn,
			getSentence: line,
			defer,
			keeps: (name) => name === 'pointPen' && drawing,
		});
		expect(tips.show('pointPen')).toBe(true);
		defer.flush();
		drawing = true; // his first click opened a shape
		tips.noteAction();
		tips.noteAction(); // more clicks
		expect(tips.current()?.name).toBe('pointPen');
		drawing = false; // closed, or Finish the shape
		tips.noteAction();
		expect(tips.current()).toBe(null);
	});

	it('any other tip goes after the next press, drawing or not', () => {
		const defer = manualDefer();
		const tips = makeTips({ isOn: allOn, getSentence: line, defer, keeps: () => false });
		tips.show('shapes');
		defer.flush();
		tips.noteAction();
		expect(tips.current()).toBe(null);
	});
});
