// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6: the coach's state (UX-BEGINNER.md 4.0 "Next line"): it follows the editor through its
// topics (makeEditorTracker), reads the font (ink, the save status, the font check, photos),
// remembers this session's changes (since Try it, since the last font file), one turn per
// Try-it letter, "Something else", the hidden line, the facts other screens report, the tips of
// the drawing tools, and tells its listeners once per batch of changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSaveStatus } from '../../files/save_status.js';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { getPref, resetPrefsCache } from '../../prefs/prefs.js';
import { runFontCheckNow } from '../../fontcheck/font_check.js';
import { PROBLEM } from '../../fontcheck/validate.js';
import {
	B,
	R,
	traceInto,
	twoLetterEditor,
	twoLetterProject,
} from '../../history/tests/two_letters.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { Path } from '../../../project_data/path.js';
import { COACH_SUBSCRIBER_ID, COACH_TOPICS, makeCoach, makeEditorTracker } from '../coach_state.js';
import { TIPS_PREF } from '../tips.js';
import { word } from '../../words/words.js';
import { fakeState, flags } from './fake_state.js';

/** A schedule the test runs by hand */
function manualSchedule() {
	const queue = [];
	const schedule = (fn) => queue.push(fn);
	schedule.run = () => queue.splice(0).forEach((fn) => fn());
	schedule.size = () => queue.length;
	return schedule;
}

const quiet = () => ({ dialog: '', otherPrimary: false });
let coach = null;

function startCoach(options = {}) {
	coach = makeCoach({ probe: quiet, schedule: manualSchedule(), ...options });
	coach.start();
	return coach;
}

/** Opens a letter the way the letter page does (Simple makes its record with no step) */
function open(editor, id) {
	editor.nav.page = 'Characters';
	editor.selectedItemID = id;
}

/** The app's page change, as navigate() announces it */
function pageChange(editor, page) {
	editor.nav.page = page;
	window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page } }));
}

/** The autosave caught up: the work file holds the latest change */
const saved = (editor) => setSaveStatus(editor, { file: 'saved' });

/**
 * The Point pen in Simple: each click places a point and is its own Undo step (new_path.js);
 * the shape stays open (tool_addPath.newPath) until it is finished.
 * @returns {{click: Function, finish: Function, path: Path}}
 */
function pointPen(editor) {
	editor.selectedTool = 'newPath';
	editor.publish('whichToolIsSelected', 'newPath');
	let path = null;
	const tool = { newPath: false };
	editor.eventHandlers.tool_addPath = tool;
	return {
		click(x, y) {
			if (!path) {
				path = editor.selectedItem.addOneShape(new Path({ name: 'Path 1' }));
				tool.newPath = path;
			}
			path.addPathPoint({ p: { coord: { x, y } } });
			editor.history.addState(`New path: added point ${path.pathPoints.length}`);
		},
		finish() {
			tool.newPath = false;
			editor.selectedTool = 'pathEdit';
			editor.publish('whichToolIsSelected', 'pathEdit');
		},
		get path() {
			return path;
		},
	};
}

/** A change to an open letter that has a shape: its first point moves, one Undo step */
function nudge(editor, id, dx = 10) {
	const point = editor.project.glyphs[id].shapes[0].pathPoints[0];
	point.p.x += dx;
	editor.history.addState('moved a point');
}

beforeEach(() => {
	localStorage.clear();
	resetPrefsCache();
	setModeForTests('simple');
	// B8 + B9 finalize: the flags as the app ships them ('photo' on). The tests that follow the
	// Try-it letters (rule 15) on a new font call rule15First(): with photos on, a new font's line
	// is rule 11 ("First, write your letters...") before any of that (tested below)
	setFeaturesForTests({ coach: true });
});
afterEach(() => {
	coach?.stop();
	coach = null;
});

/** Rule 15's tests on a new font: photos off, so rule 11 doesn't take the line first */
const rule15First = () => setFeaturesForTests({ photo: false });

describe('makeEditorTracker', () => {
	it("subscribes to the spec's topics with one id, and moves with the editor", () => {
		expect(COACH_TOPICS).toEqual([
			'whichGlyphIsSelected',
			'currentItem',
			'traceLayer',
			'autoTrace',
			'projectFile',
			'kernPairs',
			'fontMetrics',
			'fontCheck',
			'whichToolIsSelected',
		]);
		expect(COACH_SUBSCRIBER_ID).toBe('anyink.coach.editor');
		const seen = [];
		const tracker = makeEditorTracker((topic) => seen.push(topic));
		const first = twoLetterEditor();
		expect(tracker.sync(first)).toBe(true);
		expect(tracker.sync(first)).toBe(false);
		COACH_TOPICS.forEach((topic) =>
			expect(Object.keys(first.subscribers[topic] || {})).toContain(COACH_SUBSCRIBER_ID)
		);
		first.publish('fontCheck', { problems: [] });
		expect(seen).toEqual(['fontCheck']);
		const second = twoLetterEditor();
		tracker.sync(second);
		expect(Object.keys(first.subscribers.fontCheck || {})).not.toContain(COACH_SUBSCRIBER_ID);
		expect(tracker.current()).toBe(second);
		tracker.detach();
		expect(Object.keys(second.subscribers.fontCheck || {})).not.toContain(COACH_SUBSCRIBER_ID);
	});

	it('its id is never a substring of another subscriber id, nor holds one', () => {
		const others = [
			'anyink.previewStrip.redraw',
			'anyink.previewStrip.font',
			'anyink.preview.fontCheck',
			'anyink.fontCheck.change',
			'anyink.recovery.glyphSwitch',
			'anyink.trace.panel',
			'anyink.autotrace.session',
			'anyink.metrics.readout',
		];
		others.forEach((id) => {
			expect(id.includes(COACH_SUBSCRIBER_ID)).toBe(false);
			expect(COACH_SUBSCRIBER_ID.includes(id)).toBe(false);
		});
	});
});

describe('the coach on a real font', () => {
	it('a new font names the first Try-it letter (the font name) on the board', () => {
		rule15First();
		twoLetterEditor({ page: 'Overview' });
		const line = startCoach().line();
		expect(line.rule).toBe(15);
		expect(line.sentence).toBe('Next: Capital T.');
		expect(line.button).toBe('Make T');
	});

	it('with the flags as shipped, a new font starts before the computer: rule 11', () => {
		twoLetterEditor({ page: 'Overview' });
		const line = startCoach().line();
		expect(line.rule).toBe(11);
		expect(line.sentence).toBe(word('coach.rule.firstPhoto'));
	});

	it('ink with no work file asks for Save; a font with a work file that saves does not', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		traceInto(editor);
		const line = coach.line();
		expect(line.rule).toBe(10);
		expect(line.sentence).toBe("Your work isn't saved yet.");
		expect(coach.state().letters.find((l) => l.char === 'B')).toMatchObject({
			ink: true,
			ready: true,
		});
	});

	it('reads the open letter by id, without making a record', () => {
		const editor = twoLetterEditor();
		open(editor, R);
		startCoach();
		const before = Object.keys(editor.project.glyphs).length;
		expect(coach.state().page).toBe('letter');
		expect(coach.state().letter).toMatchObject({ char: 'r', ink: false });
		expect(Object.keys(editor.project.glyphs).length).toBe(before);
	});

	it('the font check: its first problem, with Fix it when it has a safe fix', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		traceInto(editor);
		editor.project.glyphs[B].advanceWidth = 0;
		startCoach();
		runFontCheckNow(editor);
		const state = coach.state();
		expect(state.fontProblem).toMatchObject({
			itemId: B,
			problem: PROBLEM.inkNoWidth,
			fixable: true,
		});
		const line = coach.line();
		expect(line.rule).toBe(6);
		expect(line.sentence).toMatch(/^Capital B /);
		expect(line).toMatchObject({ button: 'Fix it', action: 'fixFontProblem' });
	});

	it('a letter set with numbers holds 80 letters', () => {
		const editor = twoLetterEditor({ page: 'Overview' });
		editor.project.settings.anyink.letterSet = 'quick+numbers';
		startCoach();
		expect(coach.state().letters).toHaveLength(80);
		expect(coach.state().numbersAdded).toBe(true);
	});
});

describe("this session's changes", () => {
	it('starts with nothing changed, even when the font already has ink', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		traceInto(editor);
		startCoach();
		const state = coach.state();
		expect(state.changedSinceTryIt).toBe(false);
		expect(state.fontFileBehind).toBe(false);
		expect(state.lettersChangedSinceFontFile).toBe(0);
	});

	it('a change to a letter: since Try it and since the font file; Try it and the file catch up', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		traceInto(editor);
		let state = coach.state();
		expect(state.changedSinceTryIt).toBe(true);
		expect(state.fontFileBehind).toBe(true);
		expect(state.lettersChangedSinceFontFile).toBe(1);
		coach.setFact('tryItOpen', true);
		expect(coach.state().changedSinceTryIt).toBe(false);
		coach.setFact('tryItOpen', false);
		open(editor, R);
		traceInto(editor);
		state = coach.state();
		expect(state.changedSinceTryIt).toBe(true);
		expect(state.lettersChangedSinceFontFile).toBe(2);
		coach.note('fontFileMade');
		state = coach.state();
		expect(state.fontFileBehind).toBe(false);
		expect(state.lettersChangedSinceFontFile).toBe(0);
	});

	it('looking around is never a change', () => {
		const editor = twoLetterEditor();
		startCoach();
		open(editor, B);
		open(editor, R);
		editor.nav.page = 'Overview';
		window.dispatchEvent(new CustomEvent('anyink-page-change', { detail: { page: 'Overview' } }));
		const state = coach.state();
		expect(state.changedSinceTryIt).toBe(false);
		expect(state.fontFileBehind).toBe(false);
	});

	it('a letter record that opening made is no change; only the traced letter counts', () => {
		const editor = twoLetterEditor();
		startCoach();
		open(editor, 'glyph-0x7A'); // small z: opening makes its empty record
		open(editor, B);
		traceInto(editor);
		expect(coach.state().lettersChangedSinceFontFile).toBe(1);
	});

	it('a gap or a guide line puts the font file behind, but is no letter change', () => {
		const editor = twoLetterEditor();
		startCoach();
		editor.history.addWholeProjectChangePreState('moved B and r closer');
		editor.project.kerning['kern-test'] = new KernGroup({
			leftGroup: [B],
			rightGroup: [R],
			value: -40,
		});
		editor.history.addWholeProjectChangePostState();
		editor.publish('kernPairs', {});
		const state = coach.state();
		expect(state.fontFileBehind).toBe(true);
		expect(state.lettersChangedSinceFontFile).toBe(0);
		expect(state.changedSinceTryIt).toBe(false);
	});

	// B6 + B7 fix pass (hostile probe_coach2): the changes only ever grew
	it('undoing a change takes it back off "since the font file" and "since Try it"', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		coach.note('fontFileMade');
		coach.note('tryItOpened');
		traceInto(editor);
		expect(coach.state()).toMatchObject({
			fontFileBehind: true,
			lettersChangedSinceFontFile: 1,
			changedSinceTryIt: true,
		});
		editor.history.restoreState();
		expect(editor.project.glyphs[B].shapes).toHaveLength(0);
		expect(coach.state()).toMatchObject({
			fontFileBehind: false,
			lettersChangedSinceFontFile: 0,
			changedSinceTryIt: false,
		});
		// redo: changed again
		editor.history.redoState();
		expect(coach.state()).toMatchObject({ fontFileBehind: true, lettersChangedSinceFontFile: 1 });
	});

	it('undoing a gap fix takes the font file back to up to date', () => {
		const editor = twoLetterEditor();
		startCoach();
		editor.history.addWholeProjectChangePreState('moved B and r closer');
		editor.project.kerning['kern-test'] = new KernGroup({
			leftGroup: [B],
			rightGroup: [R],
			value: -40,
		});
		editor.history.addWholeProjectChangePostState();
		editor.publish('kernPairs', {});
		expect(coach.state().fontFileBehind).toBe(true);
		editor.history.restoreState();
		editor.publish('kernPairs', {});
		expect(coach.state().fontFileBehind).toBe(false);
	});

	it('works on a fake font too: note("letterChanged") stands in for a real change', () => {
		const fake = { id: 'fake' };
		startCoach({ getEditor: () => fake, deriveState: () => ({ letters: [], page: 'board' }) });
		coach.note('letterChanged', { char: 'B', ink: true });
		expect(coach.state()).toMatchObject({ changedSinceTryIt: true, fontFileBehind: true });
	});
});

describe('one turn per Try-it letter', () => {
	it('suggested, then he opens another letter: it drops back into the normal order', () => {
		rule15First();
		// B6 alone: with the letter view on (B7), the empty z's own rule 8 would speak instead
		setFeaturesForTests({ letterView: false });
		const editor = twoLetterEditor({ page: 'Overview' });
		startCoach();
		expect(coach.line().letter).toBe('T');
		open(editor, 'glyph-0x7A'); // small z
		expect(coach.state().turnsUsed).toEqual(['T']);
		const line = coach.line();
		expect(line.letter).toBe('w');
		expect(line.fromTryIt).toBe(true);
	});

	it('a suggestion he never saw (the line hidden) uses no turn', () => {
		rule15First();
		const editor = twoLetterEditor({ page: 'Overview' });
		startCoach();
		coach.hide();
		expect(coach.line().letter).toBe('T');
		open(editor, 'glyph-0x7A');
		expect(coach.state().turnsUsed).toEqual([]);
	});

	it('following the suggestion keeps its turn', () => {
		rule15First();
		const editor = twoLetterEditor({ page: 'Overview' });
		startCoach();
		expect(coach.line().letter).toBe('T');
		open(editor, 'glyph-0x54'); // Capital T
		expect(coach.state().turnsUsed).toEqual([]);
	});

	// B6 + B7 fix pass (first-timer 61, 62): four flips on B used up four Try-it letters
	it('suggestion T shown on B, three more changes to B: the suggestion is still T', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		traceInto(editor);
		saved(editor);
		expect(coach.line().sentence).toBe('Capital B looks done. Next: Capital T.');
		[1, 2, 3].forEach((n) => {
			nudge(editor, B);
			saved(editor);
			expect(coach.line().letter, `change ${n}`).toBe('T');
		});
		expect(coach.state().turnsUsed).toEqual([]);
		// opening a third letter is doing something else: T drops back into the normal order
		open(editor, 'glyph-0x7A');
		editor.publish('whichGlyphIsSelected', 'glyph-0x7A');
		expect(coach.state().turnsUsed).toEqual(['T']);
	});

	// B6 + B7 fix pass (hostile probe1): each Point pen click on small a used up a turn
	it('one letter drawn in many steps uses up no Try-it letter', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		traceInto(editor);
		saved(editor);
		expect(coach.line().letter).toBe('T');
		const pen = pointPen(editor);
		[
			[0, 0],
			[300, 0],
			[300, 300],
			[0, 300],
		].forEach(([x, y]) => {
			pen.click(x, y);
			saved(editor);
			coach.line();
		});
		pen.finish();
		editor.history.restoreState(); // and one Undo, still on B
		saved(editor);
		const line = coach.line();
		expect(coach.state().turnsUsed).toEqual([]);
		expect(line.sentence).toBe('Capital B looks done. Next: Capital T.');
	});
});

// B6 + B7 fix pass (first-timer 05, 17, 23, 24): a half-drawn letter was "Ready" and "looks done"
describe('a Point pen shape still open', () => {
	it('the letter is not ready; the line says how to finish it, never "looks done" or Save', () => {
		setFeaturesForTests({ letterView: true });
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		const pen = pointPen(editor);
		expect(coach.line().sentence).toBe('Click on the paper to drop your first point.');
		pen.click(0, 0);
		let state = coach.state();
		// B6 + B7 finalize: the open shape is no ink yet (board/letter_set.js, one rule with the
		// rail and the card)
		expect(state.letter).toMatchObject({ char: 'B', ink: false, ready: false });
		expect(state.letter.drawing).toEqual({ points: 1 });
		expect(state.letters.find((l) => l.char === 'B').ready).toBe(false);
		// no work file and ink: still not "Your work isn't saved yet." while the shape is open
		expect(coach.line()).toMatchObject({
			rule: 8,
			sentence: 'Keep clicking to drop points, then press Finish the shape.',
			button: '',
		});
		pen.click(300, 0);
		pen.click(300, 300);
		saved(editor);
		expect(coach.line()).toMatchObject({
			rule: 8,
			sentence: 'Click your first point, or press Finish the shape.',
			button: '',
			somethingElse: false,
		});
		pen.finish();
		state = coach.state();
		expect(state.letter.drawing).toBe(null);
		expect(state.letter.ready).toBe(true);
		expect(coach.line().sentence).toBe('Capital B looks done. Next: Capital T.');
	});

	it('only the letter the shape belongs to is being drawn', () => {
		setFeaturesForTests({ letterView: true });
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		const pen = pointPen(editor);
		pen.click(0, 0);
		open(editor, R);
		editor.publish('whichGlyphIsSelected', R);
		expect(coach.state().letter.drawing).toBe(null);
		pageChange(editor, 'Overview');
		expect(coach.state().letters.find((l) => l.char === 'B').drawing).toBe(null);
	});

	it('the picked tool is read from the editor, on the letter page only', () => {
		setFeaturesForTests({ letterView: true });
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		editor.selectedTool = 'newRectangle';
		editor.publish('whichToolIsSelected', 'newRectangle');
		expect(coach.line().sentence).toBe('Drag on the paper to draw a rectangle.');
		expect(coach.state().tool).toBe('newRectangle');
	});
});

// B6 + B7 fix pass (hostile probe_coach, probe_coach2): Ctrl+O loads a font into the same editor
describe('a font opened into the same editor', () => {
	it("starts fresh: none of the last font's skips, turns or changes", () => {
		rule15First();
		const editor = twoLetterEditor({ page: 'Overview' });
		startCoach();
		expect(coach.line().letter).toBe('T');
		coach.skip();
		expect(coach.line().letter).toBe('w');
		open(editor, B);
		traceInto(editor);
		expect(coach.state().fontFileBehind).toBe(true);
		// open_font.js loadInto: the picked font is imported into this editor
		editor.project = twoLetterProject();
		pageChange(editor, 'Overview');
		const state = coach.state();
		expect(state.skips).toEqual({});
		expect(state.turnsUsed).toEqual([]);
		expect(state.fontFileBehind).toBe(false);
		expect(state.lettersChangedSinceFontFile).toBe(0);
		expect(state.changedSinceTryIt).toBe(false);
		expect(coach.line()).toMatchObject({ rule: 15, sentence: 'Next: Capital T.' });
	});

	it('a whole-font Undo (the same font) keeps its memory', () => {
		rule15First();
		const editor = twoLetterEditor({ page: 'Overview' });
		startCoach();
		coach.skip();
		editor.history.addWholeProjectChangePreState('moved B and r closer');
		editor.project.kerning['kern-test'] = new KernGroup({ leftGroup: [B], rightGroup: [R] });
		editor.history.addWholeProjectChangePostState();
		editor.history.restoreState();
		expect(coach.state().skips).toEqual({ 'next:T': 'empty' });
	});
});

// B6 + B7 fix pass (hostile probe_coach): "Something else" lasted the whole session
describe('a skip ends once the state behind it changes', () => {
	it('"Your work isn\'t saved yet": skipped, saved, then a new change asks again', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		traceInto(editor);
		expect(coach.line().rule).toBe(10);
		coach.skip();
		expect(coach.line().rule).not.toBe(10);
		saved(editor);
		expect(coach.line().rule).not.toBe(10);
		open(editor, R);
		traceInto(editor);
		expect(coach.state().save).toBe('not-saved');
		expect(coach.line().rule).toBe(10);
	});

	it('next letter c: skipped, filled, cleared, then suggested again', () => {
		let state = fakeState({ ready: 'ab', flags: flags() });
		coach = makeCoach({
			getEditor: () => null,
			deriveState: () => state,
			probe: quiet,
			schedule: manualSchedule(),
			listen: false,
		});
		expect(coach.line().letter).toBe('c');
		coach.skip();
		expect(coach.line().letter).toBe('d');
		state = fakeState({ ready: 'abc', flags: flags() });
		coach.refresh();
		expect(coach.line().letter).toBe('d');
		state = fakeState({ ready: 'ab', flags: flags() });
		coach.refresh();
		expect(coach.line().letter).toBe('c');
	});
});

describe('Something else, hide, facts and sources', () => {
	it('Something else moves on, and a Try-it letter loses its turn', () => {
		rule15First();
		twoLetterEditor({ page: 'Overview' });
		startCoach();
		expect(coach.line().letter).toBe('T');
		coach.skip();
		expect(coach.line().letter).toBe('w');
		expect(coach.state().turnsUsed).toContain('T');
	});

	it('"x" hides the line for the session; showing it again brings it back', () => {
		twoLetterEditor({ page: 'Overview' });
		startCoach();
		const seen = vi.fn();
		coach.subscribe(seen);
		coach.hide();
		expect(coach.isHidden()).toBe(true);
		coach.show();
		expect(coach.isHidden()).toBe(false);
		expect(seen).toHaveBeenCalledTimes(2);
	});

	it('an open dialog (a fact or the screen) empties the line: rule 1', () => {
		rule15First();
		twoLetterEditor({ page: 'Overview' });
		startCoach();
		coach.setFact('dialog', 'howCard');
		expect(coach.line()).toMatchObject({ rule: 1, sentence: '' });
		coach.setFact('dialog', null);
		expect(coach.line().rule).toBe(15);
		coach.stop();
		coach = makeCoach({ probe: () => ({ dialog: 'error', otherPrimary: false }) });
		coach.start();
		expect(coach.line().rule).toBe(1);
	});

	it('a green button elsewhere on screen makes the line outlined', () => {
		rule15First();
		twoLetterEditor({ page: 'Overview' });
		startCoach({ probe: () => ({ dialog: '', otherPrimary: true }) });
		const line = coach.line();
		expect(line.button).toBe('Make T');
		expect(line.primary).toBe(false);
	});

	it("B11's checks and B9's photos plug in as sources", () => {
		setFeaturesForTests({ letterView: true, checks: true, board: true, photo: true });
		const editor = twoLetterEditor();
		open(editor, B);
		traceInto(editor);
		startCoach();
		coach.setSource('checks', (item, { char }) =>
			char === 'B'
				? {
						id: 'seat',
						reason: 'Capital B floats above the writing line.',
						fixLabel: 'Sit on the line',
				  }
				: null
		);
		expect(coach.line()).toMatchObject({ rule: 7, button: 'Sit on the line' });
		coach.setSource('checks', null);
		coach.setSource('photos', () => [{ id: 'p1', unused: 4, done: false }]);
		// B has ink and no work file: rule 10 first; Something else goes on to the photo
		expect(coach.line().rule).toBe(10);
		coach.skip();
		expect(coach.line()).toMatchObject({ rule: 12, sentence: 'This photo has 4 more letters.' });
	});

	it('B6 + B7 (the flags as the app has them): rules whose flags are off never speak', () => {
		// B8 + B9 integration: the app has the Brush and photos on too; a new font with no ink
		// and no photo says rule 11, the photo's way in. B10 + B11 integration: the board and
		// the checks too (no letter needs a look on a font with no ink)
		resetFeaturesForTests();
		twoLetterEditor({ page: 'Overview' });
		startCoach();
		// B12 + B13 integration: Try it and the start screen too
		expect(coach.state().flags).toEqual(
			flags('letterView', 'brush', 'photo', 'board', 'checks', 'tryIt', 'startScreen')
		);
		expect(coach.line()).toMatchObject({ rule: 11, sentence: word('coach.rule.firstPhoto') });
		// before B9 (photo off) the same font says rule 15, as it did
		setFeaturesForTests({ photo: false });
		coach.refresh();
		coach.flush?.();
		expect(coach.line().rule).toBe(15);
	});
});

describe('tips and listeners', () => {
	it('picking a drawing tool in Simple shows its tip once', () => {
		const editor = twoLetterEditor();
		startCoach();
		editor.publish('whichToolIsSelected', 'newPath');
		expect(coach.tips.current()?.name).toBe('pointPen');
	});

	// B6 + B7 fix pass (hostile probe_tips)
	it('a tip is never shown or used up while the line is hidden or empty', () => {
		const editor = twoLetterEditor();
		open(editor, B);
		startCoach();
		coach.hide();
		editor.selectedTool = 'newPath';
		editor.publish('whichToolIsSelected', 'newPath');
		expect(coach.tips.current()).toBe(null);
		expect(coach.tips.shownCount()).toBe(0);
		expect(getPref(TIPS_PREF, [])).toEqual([]);
		coach.show();
		coach.setFact('dialog', 'howCard'); // rule 1: the line is empty
		editor.publish('whichToolIsSelected', 'newPath');
		expect(coach.tips.current()).toBe(null);
		coach.setFact('dialog', null);
		editor.publish('whichToolIsSelected', 'newPath');
		expect(coach.tips.current()?.name).toBe('pointPen');
		expect(getPref(TIPS_PREF, [])).toEqual(['pointPen']);
	});

	it('All tools shows no tips', () => {
		const editor = twoLetterEditor();
		startCoach();
		setModeForTests('all');
		editor.publish('whichToolIsSelected', 'pathEdit');
		expect(coach.tips.current()).toBe(null);
	});

	it('listeners hear once per batch of changes', () => {
		const schedule = manualSchedule();
		const editor = twoLetterEditor();
		startCoach({ schedule });
		const seen = vi.fn();
		coach.subscribe(seen);
		editor.publish('kernPairs', {});
		editor.publish('fontMetrics', {});
		editor.publish('currentItem', editor.project.glyphs[B]);
		expect(seen).not.toHaveBeenCalled();
		schedule.run();
		expect(seen).toHaveBeenCalledTimes(1);
	});

	it('stop() lets go of the editor and the page', () => {
		const editor = twoLetterEditor();
		startCoach();
		coach.stop();
		expect(Object.keys(editor.subscribers.fontCheck || {})).not.toContain(COACH_SUBSCRIBER_ID);
		coach = null;
	});
});
