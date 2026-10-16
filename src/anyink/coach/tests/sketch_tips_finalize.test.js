// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S2 finalize: the sketch tips the critic found starved (written to fail first).
	  - Arc picked right after a Line end is the path that needs the Arc tip (after a corner its
	    end click waits for a bend click): the Arc tip shows there while it is unseen; once seen,
	    the Line tip comes back as SKETCH.md section 2 Tips says.
	  - The sketch tips have their own 3 a session: tips seen earlier (the Brush, the photo) never
	    use up the sketch tools' tips, and the sketch tips never use up the others.
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPrefsCache, setPref } from '../../prefs/prefs.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { resetUndoGateForTests } from '../../sketch/tools/undo_gate.js';
import { MAX_TIPS_PER_SESSION, TIPS_PREF, makeTips, toolTipFor } from '../tips.js';

const line = () => 'small n is empty. Sketch it.';
const allOn = () => true;
const noDefer = () => {};

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

describe('the Arc tip on the path that needs it', () => {
	it('Arc after a Line end: the Arc tip while unseen, then the Line tip again', () => {
		expect(toolTipFor('sketchArc', { afterLineEnd: true, seen: [] })).toEqual({
			name: 'sketchArc',
			again: false,
		});
		expect(toolTipFor('sketchArc', { afterLineEnd: true, seen: ['sketchArc'] })).toEqual({
			name: 'sketchLine',
			again: true,
		});
	});

	it('reads the seen tips from prefs when not told', () => {
		expect(toolTipFor('sketchArc', { afterLineEnd: true }).name).toBe('sketchArc');
		setPref(TIPS_PREF, ['sketchLine', 'sketchArc']);
		expect(toolTipFor('sketchArc', { afterLineEnd: true })).toEqual({
			name: 'sketchLine',
			again: true,
		});
	});
});

describe('the sketch tips have their own allowance', () => {
	it('3 other tips this session leave the sketch tips their own 3', () => {
		const tips = makeTips({ isOn: allOn, defer: noDefer, getSentence: line });
		expect(tips.show('brush')).toBe(true);
		expect(tips.show('editPoints')).toBe(true);
		expect(tips.show('pointPen')).toBe(true);
		expect(tips.show('shapes')).toBe(false);
		expect(tips.show('sketchLine')).toBe(true);
		expect(tips.show('sketchArc')).toBe(true);
		expect(tips.show('sketchSpline')).toBe(true);
		expect(tips.show('sketchCircle')).toBe(false);
		expect(MAX_TIPS_PER_SESSION).toBe(3);
	});

	it('the sketch tips never use up the others', () => {
		const tips = makeTips({ isOn: allOn, defer: noDefer, getSentence: line });
		['sketchLine', 'sketchArc', 'sketchSpline'].forEach((name) => expect(tips.show(name)).toBe(true));
		expect(tips.show('brush')).toBe(true);
	});
});
