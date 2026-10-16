// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 step 12 (docs/SKETCH.md, D-047), written to fail first: the sketch's words.
	  - every house word, tip, toast, Next line and button SKETCH.md names is a key in
	    words/sets/sketch.js, word for word (a letter's name as {letter}, numbers as values)
	  - every one ships with the 'sketch' flag, so nothing shows while it is off
	  - every one passes the strict banned-word scan, filled with real values; no exclamation
	    marks; each sentence ends once
	  - the Undo titles of section 7 come back from historyText as they are, with their key
	  - the glossary lines of section 7 show in Help only with 'sketch' on
*/
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { isFeatureOn } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { sampleEditor } from '../../mode/tests/controls_probe.js';
import { makeHelpPage } from '../../help/help_page.js';
import { findBanned, formatHit, scanTexts } from '../banned.js';
import { describeHistoryTitle, historyText, isHiddenHistoryTitle } from '../history_text.js';
import { GLOSSARY } from '../sets/core.js';
import SKETCH, { SKETCH_GLOSSARY, SKETCH_STEPS } from '../sets/sketch.js';
import { glossary, wordEntry, wordKeys, word } from '../words.js';
import { scanSimpleScreen } from './banned_scan.js';

/** Flags on as shipped, plus 'sketch' (a flag the S1 flag track adds; off until S9). */
const withSketch = (flag) => flag === 'sketch' || isFeatureOn(flag);
/** S4: the flag is on as shipped; Help with it off still shows none of its words */
const withoutSketch = (flag) => flag !== 'sketch' && isFeatureOn(flag);
const sketchKeys = () => wordKeys().filter((key) => wordEntry(key).feature === 'sketch');

/** Real values for every placeholder the sketch's words use. */
const VALUES = Object.freeze({
	letter: 'small n',
	line: 'writing line',
	part: 'arch',
	where: "from the stem's top to the writing line on the right",
	count: 2,
	number: 1,
	length: '0.62',
	angle: '90',
	width: '0.07',
	// S2 fix track: Circle, Arc and Rectangle readouts
	size: '0.40',
	height: '0.75',
	radius: '0.40',
});

// --------------------------------------------------------------
// SKETCH.md's words, as the doc writes them
// --------------------------------------------------------------

/** [key, vars, the words SKETCH.md gives] */
// prettier-ignore
const NAMED = [
	// 2. The tools
	['sketch.rail.heading', {}, 'Sketch'],
	['sketch.tool.line', {}, 'Line'],
	['sketch.tool.arc', {}, 'Arc'],
	['sketch.tool.spline', {}, 'Spline'],
	['sketch.tool.circle', {}, 'Circle'],
	['sketch.tool.rectangle', {}, 'Rectangle'],
	['sketch.tip.line', {}, 'Click, click. Double-click, right-click or Enter to finish. Drag once for a single line. Pull back over the last end for an arc.'],
	['sketch.tip.spline', {}, 'Fewer points, smoother curve.'],
	['sketch.tip.dots', {}, 'Filled dot: stuck to a line or another piece. Hollow: free to move.'],
	['sketch.tip.tailLine', {}, 'tail line: where g, p and y hang to'],
	['sketch.tip.topLine', {}, 'top line: where b, d, h and l reach'],
	['sketch.readout.line', { length: '0.62', angle: '90' }, '0.62 in, 90°'],
	['sketch.label.helper', {}, 'helper line'],
	['sketch.label.gap', {}, 'gap: not filled yet'],
	['sketch.mirrorLine', {}, 'Mirror line'],
	['sketch.helperLine', {}, 'Helper line'],
	['sketch.more', {}, 'More'],
	['sketch.tag.letGoLevel', {}, 'let go of the level'],
	['sketch.tag.letGo', { line: 'writing line' }, 'let go of the writing line'],
	['sketch.tag.joins', {}, 'joins'],
	['sketch.tag.onPiece', { part: 'stem' }, 'on the stem'],
	['sketch.tag.onCurve', {}, 'on the curve'],

	// 3. Thickness and ends
	['sketch.thickness.label', {}, 'Thickness'],
	['sketch.thickness.thin', {}, 'thin'],
	['sketch.thickness.thick', {}, 'thick'],
	['sketch.thickness.readout', { width: '0.05' }, '0.05 in wide on 1 in capitals'],
	['sketch.thickness.useOnAll', {}, 'Use on all'],
	['sketch.thickness.justThisOne', {}, 'Just this one'],
	['sketch.thickness.rebuilding', {}, 'Rebuilding letters...'],
	['sketch.thickness.useOnAllLetters', {}, 'Use this thickness on all letters'],
	['sketch.ends.label', {}, 'Ends'],
	['sketch.ends.round', {}, 'Round'],
	['sketch.ends.flat', {}, 'Flat'],
	['sketch.ends.thisEnd', {}, 'This end'],

	// 4. Closed outline
	['sketch.next.outlineGap', { letter: 'small n' }, 'The outline of small n has a gap. Click its first point to close it.'],
	['sketch.next.closeIt', {}, 'Close it'],
	['sketch.next.loopCrosses', { letter: 'small n' }, 'A loop on small n crosses itself. Drag a point to untangle it.'],
	['sketch.card.insideLoop', {}, 'Inside loop'],
	['sketch.card.wall', { width: '0.06' }, 'wall 0.06 in'],
	['sketch.toast.insideLoopFree', { letter: 'small o' }, 'The inside loop of small o is on its own now.'],

	// 5. Editing afterwards
	['sketch.card.point', {}, 'Point'],
	['sketch.card.piece', {}, 'Piece'],
	['sketch.card.smooth', {}, 'Smooth'],
	['sketch.card.corner', {}, 'Corner'],
	['sketch.card.delete', {}, 'Delete'],
	['sketch.card.letItFlow', {}, 'Let it flow'],
	['sketch.card.redraw', {}, 'Redraw this piece'],
	['sketch.card.fewerPoints', {}, 'Fewer points'],
	['sketch.card.centerline', {}, 'Centerline'],
	['sketch.card.outline', {}, 'Outline'],
	['sketch.card.closeFirst', {}, 'Close it first'],
	['sketch.card.makeOutline', {}, 'Make it an outline'],
	['sketch.card.showCenterline', {}, 'Show where the centerline was'],
	['sketch.card.editSketch', {}, 'Edit sketch'],
	['sketch.card.newer', {}, 'This sketch was made by a newer ANY-INK.'],
	['sketch.next.bumpyBrush', { letter: 'small a' }, 'The stroke on small a is bumpy. Make it a sketch you can fix point by point.'],
	['sketch.next.makeSketch', {}, 'Make it a sketch'],
	['sketch.check.bumpy', {}, 'bumpy line'],

	// 6. Construction
	['sketch.toast.cantKeepBoth', { letter: 'small n', line: 'writing line' }, "Can't keep both: a point of small n let go of the writing line."],
	['sketch.next.loose', { letter: 'small n', count: 2 }, '2 points of small n are loose.'],
	['sketch.next.showMe', {}, 'Show me'],

	// 7. How it fits Simple
	['sketch.door.sketchIt', {}, 'Sketch it'],
	['sketch.door.sketchItLine', {}, 'Lines, arcs and splines down the middle of the stroke, then pick a thickness'],
	['sketch.door.outline', {}, 'or sketch the outline instead'],
	['sketch.door.moreWays', {}, 'More ways'],
	['sketch.door.brush', {}, 'Draw with the brush (freehand; you can clean it up after)'],
	['sketch.door.parts', {}, 'Start from a part:'],
	['sketch.part.stem', {}, 'stem'],
	['sketch.part.bowl', {}, 'bowl'],
	['sketch.part.arch', {}, 'arch'],
	['sketch.part.bar', {}, 'bar'],
	['sketch.part.dot', {}, 'dot'],
	['sketch.part.add', { part: word('sketch.partA.arch') }, 'Add an arch'],
	['sketch.next.pieceOpen', {}, 'Finish the line: double-click, press Enter, or click the first point to close it.'],
	['sketch.next.done', {}, 'Done'],
	['sketch.next.missingPartWhere', { letter: 'small n', part: 'arch', where: word('sketch.where.archToRight') }, "small n still needs its arch, from the stem's top to the writing line on the right."],
	['sketch.next.looksDone', {}, 'Looks done to me'],
	['sketch.next.thickness', { letter: 'small n' }, 'Pull the thickness until small n matches the gray guide letter.'],
	['sketch.next.looksGood', {}, 'Looks good'],
	['sketch.next.thicknessForAll', { count: 5 }, 'Use this thickness on all 5 sketched letters?'],
	['sketch.next.outlineTeach', {}, "Now drag a loop's inside to make some parts thinner."],
	['sketch.compare.lower', { part: 'arch', line: 'small-letter line' }, 'The arch sits lower than the small-letter line.'],
	['sketch.compare.shorter', { part: 'stem' }, "The stem is shorter than the guide's."],
	['sketch.compare.narrower', { part: 'bowl' }, "The bowl is narrower than the guide's."],
	['sketch.compare.leansLeft', { letter: 'small n' }, 'small n leans left.'],
	['sketch.compare.sides', { letter: 'small o' }, 'The two sides of small o are different sizes.'],
	['sketch.compare.close', { letter: 'small n' }, 'small n is close to the guide letter.'],
	['sketch.compare.seeInWords', {}, 'See it in words'],
	['sketch.undo.takeBack', {}, 'Take back the last point'],
	['sketch.undo.finishFirst', {}, 'Finish the line first'],
	['sketch.toast.setAside', { letter: 'small n' }, "small n's sketch is set aside. Your changes to the shapes are kept."],
];

/** Section 7's Undo titles, word for word ("made a point smooth / corner" as two titles). */
// prettier-ignore
const TITLES = [
	['sketch.step.line', 'sketched a line on small n'],
	['sketch.step.arc', 'sketched an arc on small n'],
	['sketch.step.spline', 'sketched a spline on small n'],
	['sketch.step.circle', 'sketched a circle on small n'],
	['sketch.step.rectangle', 'sketched a rectangle on small n'],
	['sketch.step.dot', 'put a dot on small n'],
	['sketch.step.closed', 'closed the outline of small n'],
	['sketch.step.pointMoved', 'moved a sketch point on small n'],
	['sketch.step.bent', 'bent a curve on small n'],
	['sketch.step.lineMoved', 'moved a line on small n'],
	['sketch.step.aimed', 'aimed a curve on small n'],
	['sketch.step.flow', 'let a curve flow on small n'],
	['sketch.step.smooth', 'made a point smooth on small n'],
	['sketch.step.corner', 'made a point a corner on small n'],
	['sketch.step.pointAdded', 'added a sketch point on small n'],
	['sketch.step.pointDeleted', 'deleted a sketch point on small n'],
	['sketch.step.pieceDeleted', 'deleted a piece of small n'],
	['sketch.step.partMoved', 'moved part of small n'],
	['sketch.step.partResized', 'resized part of small n'],
	['sketch.step.circleResized', 'resized a circle on small n'],
	['sketch.step.nudged', 'nudged sketch points on small n'],
	['sketch.step.thickness', 'changed the thickness of small n'],
	['sketch.step.endsRound', 'made the ends round on small n'],
	['sketch.step.endsFlat', 'made the ends flat on small n'],
	['sketch.step.endRound', 'made one end round on small n'],
	['sketch.step.endFlat', 'made one end flat on small n'],
	['sketch.step.outline', 'made small n an outline'],
	['sketch.step.insideLoop', 'added an inside loop to small o'],
	['sketch.step.fromBrush', 'made Brush stroke 1 a sketch'],
	['sketch.step.redrew', 'redrew a piece of small n'],
	['sketch.step.fewerPoints', 'used fewer points on small n'],
	['sketch.step.mirrorAdded', 'added a mirror line to small n'],
	['sketch.step.helperMade', 'made a helper line on small n'],
	['sketch.step.droppedPart', 'dropped a stem on small n'],
	['sketch.step.thicknessAll', 'set the thickness for every sketched letter'],
	['sketch.step.setAside', "set small n's sketch aside"],
];

/** Section 7's glossary words (point, smooth, corner and hole are B7's, already there). */
// prettier-ignore
const GLOSSARY_WORDS = [
	'Sketch', 'Line', 'Arc', 'Spline', 'Circle', 'Rectangle', 'Centerline', 'Outline',
	'See-through', 'Thickness', 'Ends', 'Round', 'Flat', 'Mirror line', 'Helper line',
	'Inside loop', 'wall', 'piece', 'point', 'smooth', 'corner', 'grip', 'bend', 'hole', 'loose',
	'joins',
];

/** The values a title's {placeholders} take, from its words. */
function fillTitle(key) {
	const vars = {};
	const text = wordEntry(key).text;
	if (text.includes('{letter}')) vars.letter = key === 'sketch.step.insideLoop' ? 'small o' : 'small n';
	if (text.includes('{number}')) vars.number = 1;
	if (text.includes('{part}')) vars.part = word('sketch.partA.stem');
	return vars;
}

// --------------------------------------------------------------
// Tests
// --------------------------------------------------------------

describe('the sketch word set (S1 step 12)', () => {
	it.each(NAMED.map(([key, vars, text]) => [key, vars, text]))('%s', (key, vars, text) => {
		expect(word(key, vars)).toBe(text);
	});

	it('ships every word with the sketch flag, so nothing shows while it is off', () => {
		Object.entries(SKETCH).forEach(([key, entry]) => {
			expect(key, key).toMatch(/^sketch\./);
			expect(entry.feature, key).toBe('sketch');
		});
		expect(sketchKeys().sort()).toEqual(Object.keys(SKETCH).sort());
	});

	it('every word passes the strict banned-word scan, filled with real values', () => {
		const hits = [];
		sketchKeys().forEach((key) => {
			const entry = wordEntry(key);
			const texts = [entry.text, entry.hint, entry.like].filter(Boolean);
			hits.push(...scanTexts(texts, `word:${key}`, { strict: true }));
			if (!entry.quote) {
				hits.push(...scanTexts([word(key, VALUES)], `filled:${key}`, { strict: true }));
			}
		});
		expect(hits.map(formatHit)).toEqual([]);
	});

	it('no exclamation marks, no doubled stops, no text in capitals but the app name', () => {
		sketchKeys().forEach((key) => {
			const { text, hint } = wordEntry(key);
			[text, hint].forEach((value) => {
				expect(value, key).not.toMatch(/!/);
				expect(value.replaceAll('...', ''), key).not.toMatch(/[.?]\./);
				expect(value.replace('ANY-INK', ''), key).not.toMatch(/\b[A-Z]{2,}\b/);
			});
		});
	});

	it('names every glossary word of section 7 with the flag on', () => {
		const shown = glossary(withSketch).map((entry) => entry.text.toLowerCase());
		GLOSSARY_WORDS.forEach((term) => expect(shown, term).toContain(term.toLowerCase()));
	});
});

describe('the sketch Undo titles (section 7)', () => {
	it('are exactly the titles SKETCH.md lists, one key each', () => {
		expect(SKETCH_STEPS.slice().sort()).toEqual(
			wordKeys().filter((key) => key.startsWith('sketch.step.'))
		);
		TITLES.forEach(([key]) => expect(SKETCH_STEPS, key).toContain(key));
	});

	it.each(TITLES)('%s reads "%s"', (key, title) => {
		expect(word(key, fillTitle(key))).toBe(title);
		const step = describeHistoryTitle(title);
		expect(step.key).toBe(key);
		expect(step.hidden).toBe(false);
		expect(historyText(title)).toBe(title);
		expect(isHiddenHistoryTitle(title)).toBe(false);
	});

	it('maps every title back to its own key, whatever the letter is called', () => {
		const letters = ['small n', 'Capital B', 'the joined letters fi', 'the question mark'];
		SKETCH_STEPS.forEach((key) => {
			letters.forEach((letter) => {
				const vars = { ...fillTitle(key), ...(wordEntry(key).text.includes('{letter}') ? { letter } : {}) };
				const title = word(key, vars);
				const step = describeHistoryTitle(title);
				expect(step.key, title).toBe(key);
				expect(step.vars, title).toEqual(
					Object.fromEntries(Object.entries(vars).map(([name, value]) => [name, String(value)]))
				);
				expect(historyText(title), title).toBe(title);
				expect(findBanned(title, { strict: true }), title).toEqual([]);
			});
		});
	});

	it("names Brush stroke 12's number and every part a sketch can drop", () => {
		expect(describeHistoryTitle('made Brush stroke 12 a sketch')).toMatchObject({
			key: 'sketch.step.fromBrush',
			vars: { number: '12' },
		});
		['stem', 'bowl', 'arch', 'bar', 'dot'].forEach((part) => {
			const title = word('sketch.step.droppedPart', {
				part: word(`sketch.partA.${part}`),
				letter: 'small n',
			});
			expect(describeHistoryTitle(title).key, title).toBe('sketch.step.droppedPart');
		});
	});

	it('leaves every title the app recorded before the sketch as it was', () => {
		expect(describeHistoryTitle('Moved 2 shapes').key).toBe('history.shapesMoved');
		expect(describeHistoryTitle('traced Capital B').key).toBe('history.traced');
		expect(describeHistoryTitle('drew a stroke on small n').key).toBe('');
		expect(historyText('Navigated to Latin Small Letter B')).toBe('');
	});
});

describe('the sketch glossary lines (Help shows no entry whose flag is off)', () => {
	it('sit in the glossary right after the brush, in their order', () => {
		const at = GLOSSARY.indexOf('term.brush');
		expect(GLOSSARY.slice(at + 1, at + 1 + SKETCH_GLOSSARY.length)).toEqual([...SKETCH_GLOSSARY]);
		SKETCH_GLOSSARY.forEach((key) => {
			expect(wordEntry(key).feature, key).toBe('sketch');
			expect(wordEntry(key).hint, key).not.toBe('');
			expect(wordEntry(key).pro, key).not.toBe('');
		});
	});

	it('are left out while the sketch flag is off, and all there when it is on', () => {
		const off = glossary(withoutSketch).map((entry) => entry.key);
		SKETCH_GLOSSARY.forEach((key) => expect(off).not.toContain(key));
		const on = glossary(withSketch).map((entry) => entry.key);
		SKETCH_GLOSSARY.forEach((key) => expect(on).toContain(key));
		expect(on.length).toBe(off.length + SKETCH_GLOSSARY.length);
	});

	it('the Outline line says what See-through is, so "outline" means one thing', () => {
		expect(wordEntry('sketch.term.outline').hint).toBe(
			'The letter drawn as its outside line; loops inside are holes. See-through only changes how the screen shows it.'
		);
	});
});

describe('Help with and without the sketch', () => {
	let quiet;
	beforeAll(() => {
		if (!Element.prototype.animate)
			Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
		if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
	});
	afterEach(() => {
		quiet?.forEach((spy) => spy.mockRestore());
		setModeForTests('all');
		document.body.innerHTML = '';
	});
	const hush = () =>
		(quiet = ['warn', 'error', 'log'].map((name) =>
			vi.spyOn(console, name).mockImplementation(() => {})
		));
	const terms = (root) =>
		[...root.querySelectorAll('[data-anyink-term]')].map((term) => term.dataset.anyinkTerm);
	const help = (isOn) => {
		hush();
		const root = makeHelpPage({ editor: sampleEditor(), isOn });
		document.body.appendChild(root);
		return root;
	};

	it('shows no sketch word while the flag is off', () => {
		setModeForTests('simple');
		const shown = terms(help(withoutSketch));
		SKETCH_GLOSSARY.forEach((key) => expect(shown).not.toContain(key));
	});

	it('shows every sketch word once the flag is on', () => {
		setModeForTests('simple');
		const shown = terms(help(withSketch));
		SKETCH_GLOSSARY.forEach((key) => expect(shown).toContain(key));
	});

	scanSimpleScreen('Help with the sketch words, strict', () => help(withSketch));
});
