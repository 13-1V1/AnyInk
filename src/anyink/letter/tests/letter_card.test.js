// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B7 letter card (UX-BEGINNER.md 4.3 "Letter card sections"): a section shows only when it
	applies, nothing is greyed out. An empty letter shows its name and "Empty" and no buttons
	(the canvas overlay holds them); a letter with shapes shows "Ready" and "Fine-tune this
	letter", closed by default. Until B8 and B9 turn on 'brush' and 'photo' the card has no
	[Draw over it] or [Trace again]. Inside Fine-tune: Shapes (a Solid / Hole switch on the picked
	shape; Shape options closed: Merge, Flip left-right, Flip upside-down, Clear letter),
	Spacing, This point (Edit points with one point picked) and "Open in More tools". Every
	change is one Undo step, named in plain words; Clear letter says so with [Undo] (7.3).
*/
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Path } from '../../../project_data/path.js';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests, flagsOn } from '../../mode/features.js';
import { getMode, setModeForTests } from '../../mode/mode.js';
import { getSpacingOwner } from '../../spacing/owner.js';
import { resetToastsForTests, toastLog } from '../../toast/toast.js';
import { word } from '../../words/words.js';
import {
	cardSections,
	fineTuneParts,
	letterCardState,
	mainButtons,
	makeLetterCard,
	resetLetterCardForTests,
	shapeKinds,
	shapeOptions,
} from '../letter_card.js';
import { pointKind } from '../point_kind.js';
import { isFineTuneOpen, resetLetterViewForTests, setFineTuneOpen } from '../view_switches.js';

/** A square path, x0..x0+size and y0..y0+size; reversed: the other way round. */
function squarePath(x0, y0, size, { reversed = false } = {}) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	const points = [
		corner(x0, y0),
		corner(x0 + size, y0),
		corner(x0 + size, y0 + size),
		corner(x0, y0 + size),
	];
	return new Path({ name: 'Square', pathPoints: reversed ? points.reverse() : points });
}

/** Capital B open in Simple with the letter view, with these shapes. */
function openB(shapes = [], { beforeB8 = false } = {}) {
	setModeForTests('simple');
	// B8 + B9 finalize: the flags as the app ships them ('brush' and 'photo' on); the Brush and
	// photo sections themselves are tested in photo/tests/b89_seams.test.js. beforeB8: the B7
	// card, for the one test of the flag gate itself
	setFeaturesForTests({ letterView: true, ...(beforeB8 ? { brush: false, photo: false } : {}) });
	const editor = twoLetterEditor();
	editor.selectedGlyphID = B;
	const item = editor.selectedGlyph;
	shapes.forEach((shape) => item.addOneShape(shape));
	editor.history.addState('set up the test letter');
	return { editor, item };
}

function mount(editor) {
	const card = makeLetterCard(editor);
	document.body.appendChild(card);
	return card;
}

const q = (selector) => document.querySelector(selector);
const qa = (selector) => [...document.querySelectorAll(selector)];
const sections = () => qa('[data-anyink-card]').map((el) => el.dataset.anyinkCard);
const fine = () => qa('[data-anyink-fine]').map((el) => el.dataset.anyinkFine);
const press = (selector) => q(selector).click();
const rows = () =>
	qa('[data-anyink-shape-row]').map((row) => row.textContent.replace(/\s+/g, ' ').trim());
const steps = (editor) => editor.history.queue.length;
const newestTitle = (editor) => editor.history.queue[0]?.title;

beforeEach(() => {
	resetLetterViewForTests();
	resetLetterCardForTests();
	resetToastsForTests();
});
afterEach(() => {
	document.body.innerHTML = '';
});

describe('card sections per state (pure)', () => {
	const none = flagsOn();
	const state = (patch = {}) => ({
		hasShapes: true,
		hasPhoto: false,
		photoCardOpen: false,
		tool: 'resize',
		point: null,
		...patch,
	});

	it('an empty letter: only its name and "Empty" (the overlay holds the buttons)', () => {
		expect(cardSections(state({ hasShapes: false }), none)).toEqual(['header']);
	});

	it('a letter with shapes: its name and "Fine-tune this letter"', () => {
		expect(cardSections(state(), none)).toEqual(['header', 'fineTune']);
	});

	it('[Draw over it] waits for the brush and [Trace again] for photos (and a photo)', () => {
		expect(mainButtons(state(), none)).toEqual([]);
		expect(mainButtons(state(), flagsOn('brush'))).toEqual(['drawOver']);
		expect(mainButtons(state(), flagsOn('photo'))).toEqual([]);
		expect(mainButtons(state({ hasPhoto: true }), flagsOn('photo', 'brush'))).toEqual([
			'traceAgain',
			'drawOver',
		]);
		expect(cardSections(state(), flagsOn('brush'))).toEqual(['header', 'main', 'fineTune']);
	});

	it('no main buttons while the photo card runs; the card shows in their place', () => {
		const running = state({ hasPhoto: true, photoCardOpen: true });
		// B8 + B9 integration: the photo card's own section, between the header and Fine-tune
		expect(cardSections(running, flagsOn('photo', 'brush'))).toEqual([
			'header',
			'photo',
			'fineTune',
		]);
	});

	it('the Brush section while the Brush is picked (B8, 4.3), only once the Brush landed', () => {
		const brush = state({ tool: 'nib' });
		// [Draw over it] picks the Brush: with the Brush picked it has nothing to do, so it goes
		expect(mainButtons(brush, flagsOn('brush'))).toEqual([]);
		expect(cardSections(brush, flagsOn('brush'))).toEqual(['header', 'brush', 'fineTune']);
		expect(cardSections(brush, flagsOn())).toEqual(['header', 'fineTune']);
		expect(cardSections(state({ tool: 'nib', hasShapes: false }), flagsOn('brush'))).toEqual([
			'header',
			'brush',
		]);
		// the photo card is the one thing to do while it shows
		expect(
			cardSections(state({ tool: 'nib', photoCardOpen: true }), flagsOn('brush', 'photo'))
		).toEqual(['header', 'photo', 'fineTune']);
	});

	it('Fine-tune holds Shapes, Spacing and the way to More tools; This point only with one point picked in Edit points', () => {
		expect(fineTuneParts(state())).toEqual(['shapes', 'spacing', 'moreTools']);
		expect(fineTuneParts(state({ tool: 'pathEdit' }))).toEqual(['shapes', 'spacing', 'moreTools']);
		expect(fineTuneParts(state({ tool: 'pathEdit', point: { kind: 'corner' } }))).toEqual([
			'shapes',
			'spacing',
			'point',
			'moreTools',
		]);
		expect(fineTuneParts(state({ tool: 'resize', point: { kind: 'corner' } }))).toEqual([
			'shapes',
			'spacing',
			'moreTools',
		]);
	});

	it('Shape options: Merge only with two shapes or more', () => {
		expect(shapeOptions({ shapes: [{ kind: 'solid' }] })).toEqual([
			'flipLeftRight',
			'flipUpsideDown',
			'clear',
		]);
		expect(shapeOptions({ shapes: [{ kind: 'solid' }, { kind: 'hole' }] })).toEqual([
			'merge',
			'flipLeftRight',
			'flipUpsideDown',
			'clear',
		]);
	});
});

describe('solid or hole', () => {
	it('a shape inside another that goes the other way round is a hole; the same way, solid', () => {
		const outer = squarePath(0, 0, 600);
		const hole = squarePath(200, 200, 200, { reversed: true });
		const solid = squarePath(250, 250, 50);
		expect(shapeKinds({ shapes: [outer, hole] })).toEqual(['solid', 'hole']);
		expect(shapeKinds({ shapes: [outer, solid] })).toEqual(['solid', 'solid']);
		// a dot inside the hole, the outer way round again: solid
		expect(shapeKinds({ shapes: [outer, hole, solid] })).toEqual(['solid', 'hole', 'solid']);
	});

	it('shapes side by side are solid whichever way round they go', () => {
		const left = squarePath(0, 0, 100);
		const right = squarePath(300, 0, 100, { reversed: true });
		expect(shapeKinds({ shapes: [left, right] })).toEqual(['solid', 'solid']);
	});
});

describe('the card on screen', () => {
	it('an empty letter says its name and "Empty", with no buttons', () => {
		const { editor } = openB();
		const card = mount(editor);
		expect(sections()).toEqual(['header']);
		expect(q('[data-anyink-card="header"]').textContent).toContain('Capital B');
		expect(q('[data-anyink-state]').textContent.trim()).toBe(word('letter.state.empty'));
		expect(card.querySelectorAll('button, fancy-button').length).toBe(0);
	});

	it('a letter with ink says "Ready", and Fine-tune is closed', () => {
		const { editor } = openB([squarePath(100, 0, 400)]);
		mount(editor);
		expect(q('[data-anyink-state]').textContent.trim()).toBe(word('letter.state.ready'));
		// [Draw over it] on a ready letter (the Brush, B8); [Trace again] only with a photo
		expect(sections()).toEqual(['header', 'main', 'fineTune']);
		const toggle = q('[data-anyink-toggle="fineTune"]');
		expect(toggle.textContent).toContain(word('letter.fineTune'));
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(fine()).toEqual([]);
	});

	it('[Draw over it] and [Trace again] are not on the card before B8 and B9', () => {
		const { editor } = openB([squarePath(100, 0, 400)], { beforeB8: true });
		mount(editor);
		expect(q('[data-anyink-action="drawOver"]')).toBeNull();
		expect(q('[data-anyink-action="traceAgain"]')).toBeNull();
	});

	it('opening Fine-tune shows its parts and stays open for the next card', () => {
		const { editor } = openB([squarePath(100, 0, 400)]);
		mount(editor);
		press('[data-anyink-toggle="fineTune"]');
		expect(isFineTuneOpen()).toBe(true);
		expect(q('[data-anyink-toggle="fineTune"]').getAttribute('aria-expanded')).toBe('true');
		expect(fine()).toEqual(['shapes', 'spacing', 'moreTools']);
		expect(rows()).toEqual([
			`${word('letter.shape.row', { number: 1 })} · ${word('letterTools.role.solid')}`,
		]);
		document.body.innerHTML = '';
		mount(editor);
		expect(fine()).toEqual(['shapes', 'spacing', 'moreTools']);
	});

	it('no number fields in any state', () => {
		const { editor } = openB([squarePath(100, 0, 400)]);
		setFineTuneOpen(true, editor);
		mount(editor);
		press('[data-anyink-toggle="shapeOptions"]');
		expect(qa('input[type="number"], input-number').length).toBe(0);
	});
});

describe('Fine-tune changes, each one Undo step', () => {
	const openFine = (shapes) => {
		const context = openB(shapes);
		setFineTuneOpen(true, context.editor);
		mount(context.editor);
		return context;
	};

	it('Solid / Hole on the picked shape', () => {
		const { editor, item } = openFine([squarePath(0, 0, 600), squarePath(200, 200, 200)]);
		expect(q('[data-anyink-kind-switch]')).toBeNull();
		press('[data-anyink-shape-row="1"]');
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[1]);
		const before = steps(editor);
		press('[data-anyink-kind="hole"]');
		expect(shapeKinds(editor.selectedItem)).toEqual(['solid', 'hole']);
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('letterTools.step.madeHole', { number: 2 }));
		expect(rows()[1]).toContain(word('letterTools.role.hole'));
		expect(q('[data-anyink-kind="hole"]').getAttribute('aria-pressed')).toBe('true');
		editor.history.restoreState();
		expect(shapeKinds(editor.selectedItem)).toEqual(['solid', 'solid']);
	});

	it('a row already picked stays picked when pressed again', () => {
		const { editor, item } = openFine([squarePath(0, 0, 600), squarePath(200, 200, 200)]);
		press('[data-anyink-shape-row="1"]');
		press('[data-anyink-shape-row="1"]');
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[1]);
		expect(q('[data-anyink-kind-switch]')).not.toBeNull();
	});

	// B6 + B7 integration (letter-tools track's hand-off): a shape with nothing around it can't
	// show a hole whichever way round it goes (auto_hole.js canBeHole), so [Hole] would do
	// nothing; it isn't offered (a section shows only when it applies, 4.3)
	it('a shape with nothing around it shows no Solid / Hole switch', () => {
		const { editor, item } = openFine([squarePath(0, 0, 600), squarePath(200, 200, 200)]);
		press('[data-anyink-shape-row="0"]');
		expect(editor.multiSelect.shapes.singleton).toBe(item.shapes[0]);
		expect(q('[data-anyink-kind-switch]')).toBeNull();
		expect(rows()[0]).toContain(word('letterTools.role.solid'));
		press('[data-anyink-shape-row="1"]');
		expect(q('[data-anyink-kind-switch="1"]')).not.toBeNull();
	});

	it('Shape options are closed until opened; Merge shows with two shapes', () => {
		openFine([squarePath(0, 0, 300), squarePath(200, 0, 300)]);
		expect(q('[data-anyink-action="merge"]')).toBeNull();
		press('[data-anyink-toggle="shapeOptions"]');
		expect(qa('[data-anyink-action]').map((b) => b.dataset.anyinkAction)).toEqual(
			expect.arrayContaining(['merge', 'flipLeftRight', 'flipUpsideDown', 'clear'])
		);
	});

	it('Flip left-right mirrors the letter in one named step', () => {
		const { editor } = openFine([
			new Path({
				name: 'Wedge',
				pathPoints: [
					{ p: { coord: { x: 100, y: 0 } } },
					{ p: { coord: { x: 500, y: 0 } } },
					{ p: { coord: { x: 100, y: 400 } } },
				],
			}),
		]);
		// spacing set by him, so the step's refit (B3) doesn't move the ink sideways
		editor.selectedItem.anyink = { ...(editor.selectedItem.anyink || {}), spacing: 'manual' };
		press('[data-anyink-toggle="shapeOptions"]');
		const was = editor.selectedItem.shapes[0].pathPoints.map((point) => ({
			x: point.p.x,
			y: point.p.y,
		}));
		const left = Math.min(...was.map((p) => p.x));
		const right = Math.max(...was.map((p) => p.x));
		const topX = was.find((p) => p.y === 400).x;
		const before = steps(editor);
		press('[data-anyink-action="flipLeftRight"]');
		const points = editor.selectedItem.shapes[0].pathPoints.map((point) => point.p);
		expect(Math.min(...points.map((p) => p.x))).toBe(left);
		expect(Math.max(...points.map((p) => p.x))).toBe(right);
		expect(points.find((p) => p.y === 400).x).toBe(left + right - topX);
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('letter.step.flipLeftRight', { name: 'Capital B' }));
	});

	it('Clear letter takes every shape off, says so with [Undo], and Undo brings them back', () => {
		const { editor } = openFine([squarePath(0, 0, 300), squarePath(400, 0, 300)]);
		press('[data-anyink-toggle="shapeOptions"]');
		const before = steps(editor);
		press('[data-anyink-action="clear"]');
		expect(editor.selectedItem.shapes.length).toBe(0);
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('letter.step.cleared', { name: 'Capital B' }));
		const said = toastLog().at(-1);
		expect(said.key).toBe('letter.toast.cleared');
		expect(said.text).toBe(word('letter.toast.cleared', { name: 'Capital B' }));
		// the card is the empty letter's now
		expect(sections()).toEqual(['header']);
		editor.history.restoreState();
		expect(editor.selectedItem.shapes.length).toBe(2);
	});

	it('Spacing: "Set by you" with [Back to automatic], one step that hands it back', () => {
		const { editor, item } = openFine([squarePath(100, 0, 400)]);
		item.anyink = { ...(item.anyink || {}), spacing: 'manual' };
		document.body.innerHTML = '';
		mount(editor);
		expect(q('[data-anyink-fine="spacing"]').textContent).toContain(word('letter.spacing.manual'));
		const before = steps(editor);
		press('[data-anyink-action="backToAuto"]');
		expect(getSpacingOwner(editor.selectedItem)).toBe('auto');
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('letter.step.backToAuto', { name: 'Capital B' }));
		expect(q('[data-anyink-fine="spacing"]').textContent).toContain(word('letter.spacing.auto'));
		expect(q('[data-anyink-action="backToAuto"]')).toBeNull();
	});

	it('This point: Smooth / Corner with Edit points and one point picked', () => {
		const { editor, item } = openFine([squarePath(100, 0, 400)]);
		const point = item.shapes[0].pathPoints[1];
		editor.selectedTool = 'pathEdit';
		editor.multiSelect.shapes.select(item.shapes[0]);
		editor.multiSelect.points.select(point);
		editor.publish('whichPathPointIsSelected', point);
		expect(fine()).toContain('point');
		expect(q('[data-anyink-point="corner"]').getAttribute('aria-pressed')).toBe('true');
		const before = steps(editor);
		press('[data-anyink-point="smooth"]');
		expect(pointKind(editor.selectedItem.shapes[0].pathPoints[1])).toBe('smooth');
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('history.pointSmooth'));
	});

	it('"Open in More tools" turns on All tools', () => {
		const { editor } = openFine([squarePath(100, 0, 400)]);
		editor.navigate = () => {};
		press('[data-anyink-action="moreTools"]');
		expect(getMode()).toBe('all');
	});
});

describe('the card follows the letter', () => {
	it('drawing the first shape turns "Empty" into "Ready" without a new card', () => {
		const { editor, item } = openB();
		const card = mount(editor);
		item.addOneShape(squarePath(100, 0, 400));
		editor.history.addState('drew a shape');
		editor.publish('currentItem', item);
		expect(card.isConnected).toBe(true);
		expect(q('[data-anyink-state]').textContent.trim()).toBe(word('letter.state.ready'));
		expect(sections()).toEqual(['header', 'main', 'fineTune']);
	});

	it('a tool key that opens Fine-tune opens it on the card', () => {
		const { editor } = openB([squarePath(100, 0, 400)]);
		mount(editor);
		setFineTuneOpen(true, editor);
		expect(fine()).toEqual(['shapes', 'spacing', 'moreTools']);
	});

	it('the state it draws from (solid or hole only while Fine-tune is open)', () => {
		const { editor } = openB([squarePath(100, 0, 400)]);
		expect(letterCardState(editor).shapes).toEqual([
			{ index: 0, kind: '', picked: false, fixed: false, holeable: false },
		]);
		setFineTuneOpen(true, editor);
		const state = letterCardState(editor);
		expect(state).toMatchObject({
			char: 'B',
			name: 'Capital B',
			status: 'ready',
			hasShapes: true,
			hasPhoto: false,
			photoCardOpen: false,
			shapes: [{ index: 0, kind: 'solid', picked: false }],
		});
	});
});

// --------------------------------------------------------------
// B6 + B7 fix pass (letter-card track): what the first-timer and the hostile probes found
// --------------------------------------------------------------

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const stateChip = () => q('[data-anyink-state]').textContent.trim();
const lastToast = () => toastLog().at(-1);

/** A shape by its corners, in the order given (font units, y up) */
function polygonPath(corners, name = 'Shape') {
	return new Path({ name, pathPoints: corners.map(([x, y]) => ({ p: { coord: { x, y } } })) });
}

/** A line of two points: no area, so no ink (spacing/outline.js isStrayPath) */
const strayLine = () =>
	polygonPath([
		[100, 100],
		[300, 100],
	]);

/** The letter B as the first-timer drew it: an outer shape and two holes inside it */
const outerB = () => squarePath(0, 0, 700);
const topHole = () => squarePath(150, 400, 200, { reversed: true });
const bottomHole = () => squarePath(150, 100, 200, { reversed: true });

describe('Merge overlapping shapes (fix: the card said "Empty" and a merge that changed nothing was a step)', () => {
	const openFine = (shapes) => {
		const context = openB(shapes);
		setFineTuneOpen(true, context.editor);
		mount(context.editor);
		press('[data-anyink-toggle="shapeOptions"]');
		return context;
	};

	it('a B (outer shape and two holes): nothing overlaps, so no step, nothing moves, and it says so', async () => {
		const { editor, item } = openFine([outerB(), topHole(), bottomHole()]);
		const shapesBefore = [...item.shapes];
		const pointsBefore = JSON.stringify(item.shapes.map((shape) => shape.save()));
		const before = steps(editor);
		press('[data-anyink-action="merge"]');
		// upstream merged 200 ms later, inside a timer: wait it out
		await wait(300);
		expect(steps(editor)).toBe(before);
		expect(item.shapes).toEqual(shapesBefore);
		expect(JSON.stringify(item.shapes.map((shape) => shape.save()))).toBe(pointsBefore);
		expect(lastToast().key).toBe('letter.toast.nothingToMerge');
		expect(lastToast().text).toBe(word('letter.toast.nothingToMerge'));
		// the card never says "Empty" on a letter with ink
		expect(stateChip()).toBe(word('letter.state.ready'));
		expect(rows()).toHaveLength(3);
	});

	it('two overlapping shapes become one, at once, in one step named for the letter', () => {
		const { editor, item } = openFine([squarePath(0, 0, 300), squarePath(200, 0, 300)]);
		const before = steps(editor);
		press('[data-anyink-action="merge"]');
		// no timer: the merge, the step and the card all happen in the press
		expect(item.shapes).toHaveLength(1);
		expect(steps(editor)).toBe(before + 1);
		expect(newestTitle(editor)).toBe(word('letter.step.merged', { name: 'Capital B' }));
		expect(lastToast().key).toBe('letter.toast.merged');
		expect(lastToast().text).toBe(word('letter.toast.merged', { name: 'Capital B' }));
		expect(stateChip()).toBe(word('letter.state.ready'));
		expect(rows()).toHaveLength(1);
		// whole-number points (7.2)
		const numbers = item.shapes[0].pathPoints.flatMap((pp) => [
			pp.p.x,
			pp.p.y,
			pp.h1.x,
			pp.h1.y,
			pp.h2.x,
			pp.h2.y,
		]);
		numbers.forEach((n) => expect(Number.isInteger(n), String(n)).toBe(true));
		editor.history.restoreState();
		expect(editor.selectedItem.shapes).toHaveLength(2);
	});

	it('shapes that overlap off the grid merge onto whole numbers', () => {
		const { item } = openFine([
			squarePath(0, 0, 300),
			polygonPath([
				[150.5, 150.25],
				[450, 150.25],
				[450, 450],
				[150.5, 450],
			]),
		]);
		press('[data-anyink-action="merge"]');
		expect(item.shapes).toHaveLength(1);
		item.shapes[0].pathPoints.forEach((pp) => {
			expect(Number.isInteger(pp.p.x) && Number.isInteger(pp.p.y)).toBe(true);
		});
	});

	it('shapes side by side, whichever way round: nothing changes and no step', () => {
		const { editor } = openFine([
			squarePath(0, 0, 100),
			squarePath(300, 0, 100, { reversed: true }),
		]);
		const before = editor.history.queue[0];
		press('[data-anyink-action="merge"]');
		expect(editor.history.queue[0]).toBe(before);
		expect(lastToast().key).toBe('letter.toast.nothingToMerge');
	});

	it('Merge is offered only with two shapes that have ink (a stray line is not one)', () => {
		openFine([squarePath(0, 0, 300), strayLine()]);
		expect(q('[data-anyink-action="merge"]')).toBeNull();
		expect(shapeOptions({ shapes: [{}, {}], mergeable: 1 })).not.toContain('merge');
		expect(shapeOptions({ shapes: [{}, {}], mergeable: 2 })).toContain('merge');
	});
});

describe('the card shows what the letter is after every step (fix: it went stale)', () => {
	it('a step that tells no one (an upstream action) still shows on the card', () => {
		const { editor, item } = openB([squarePath(0, 0, 300)]);
		item.anyink = { ...(item.anyink || {}), spacing: 'manual' };
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(rows()).toHaveLength(1);
		item.addOneShape(squarePath(400, 0, 300));
		editor.history.addState('Added a shape somewhere else');
		expect(rows()).toHaveLength(2);
	});

	it('a press that changes more after it tells (closing a Point pen shape) shows its end state', async () => {
		const { editor, item } = openB([squarePath(0, 0, 300)]);
		editor.eventHandlers.tool_addPath = { newPath: item.shapes[0] };
		mount(editor);
		expect(stateChip()).toBe(word('letter.state.empty'));
		// the Point pen tells the editor it switched tools, then lets go of the shape
		editor.publish('whichToolIsSelected', 'pathEdit');
		editor.eventHandlers.tool_addPath.newPath = false;
		await Promise.resolve();
		expect(stateChip()).toBe(word('letter.state.ready'));
	});
});

describe('Ready waits for a finished shape with ink (fix: one Point pen click made the letter Ready)', () => {
	it('one point placed with the Point pen: still Empty, no Fine-tune section yet', () => {
		const { editor, item } = openB();
		const open = item.addOneShape(polygonPath([[100, 100]], 'Path 1'));
		editor.eventHandlers.tool_addPath = { newPath: open };
		mount(editor);
		expect(stateChip()).toBe(word('letter.state.empty'));
		expect(sections()).toEqual(['header']);
		expect(letterCardState(editor)).toMatchObject({
			status: 'empty',
			hasShapes: false,
			shapes: [],
		});
	});

	it('a second shape being drawn is not listed until it is finished', () => {
		const { editor, item } = openB([squarePath(0, 0, 300)]);
		const open = item.addOneShape(
			polygonPath(
				[
					[400, 0],
					[600, 0],
					[600, 200],
				],
				'Path 2'
			)
		);
		editor.eventHandlers.tool_addPath = { newPath: open };
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(stateChip()).toBe(word('letter.state.ready'));
		expect(rows()).toHaveLength(1);
	});

	it('a finished stray line (2 points, no area) is no ink: Empty, but listed so it can be cleared', () => {
		const { editor } = openB([strayLine()]);
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(stateChip()).toBe(word('letter.state.empty'));
		expect(sections()).toEqual(['header', 'main', 'fineTune']);
		expect(rows()).toHaveLength(1);
	});
});

describe('Spacing on a letter he has only just started (fix: it said "Set by you")', () => {
	it('no ink yet and no owner: "Automatic" (B3 makes it automatic at its first ink), no button', () => {
		const { editor, item } = openB([strayLine()]);
		// B6 + B7 finalize: Simple now starts a letter automatic at its first shape (D-037); a
		// letter with no owner and no ink (an old font's) still says "Automatic"
		if (item.anyink) delete item.anyink.spacing;
		expect(item.anyink?.spacing).toBeUndefined();
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(q('[data-anyink-fine="spacing"]').textContent).toContain(word('letter.spacing.auto'));
		expect(q('[data-anyink-action="backToAuto"]')).toBeNull();
	});

	it('an old letter with ink and no owner is still "Set by you" with [Back to automatic]', () => {
		const { editor, item } = openB([squarePath(100, 0, 400)]);
		delete item.anyink.spacing;
		setFineTuneOpen(true, editor);
		mount(editor);
		expect(q('[data-anyink-fine="spacing"]').textContent).toContain(word('letter.spacing.manual'));
		expect(q('[data-anyink-action="backToAuto"]')).not.toBeNull();
	});
});
