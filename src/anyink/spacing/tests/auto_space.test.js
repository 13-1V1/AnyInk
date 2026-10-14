// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 (UX-BEGINNER 10, B3 and 4.6): the gap rule, fitSpacing, fitAllAutomatic and the
// letter-spacing extra, at the 1,000 and 2,048 grid sizes. Pure: no editor, no Undo step (the
// hooks track wires them into History).
import { describe, expect, it } from 'vitest';
import { ComponentInstance } from '../../../project_data/component_instance.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import {
	dependentsOffFit,
	fitAllAutomatic,
	fitDependents,
	fitSpacing,
	setExtra,
	sideKinds,
	sitsAtFit,
} from '../auto_space.js';
import { appliedExtra, extraRange, getExtra } from '../extra.js';
import { gapUnit, sideGap } from '../gap_rule.js';
import { inkBounds } from '../measure.js';
import { isWhole } from '../round.js';
import { GRIDS, letter, oval, photoUnder, rect, spacingProject } from './fixtures.js';

const AUTO = { spacing: 'auto' };
const MANUAL = { spacing: 'manual' };

/** Left space, right space and width, as the font file will have them */
function sides(item) {
	const ink = inkBounds(item);
	return {
		left: ink.xMin,
		right: item.advanceWidth - ink.xMax,
		width: item.advanceWidth,
	};
}

function allCoords(item) {
	return item.shapes.flatMap((shape) =>
		shape.pathPoints.flatMap((point) => [point.p.x, point.p.y])
	);
}

describe.each([1000, 2048])('the gap rule at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = font.xHeight * 0.08;

	it('G is 8% of the small-letter height (88 at the default 1,100)', () => {
		expect(gapUnit(font)).toBeCloseTo(G, 9);
		if (grid === 2048) expect(gapUnit(font)).toBeCloseTo(88, 9);
		if (grid === 1000) expect(gapUnit(font)).toBeCloseTo(40, 9);
	});

	it('straight sides get G, round 0.6 G, open 0.4 G, punctuation 0.6 G, in whole units', () => {
		expect(sideGap('S', font)).toBe(Math.round(G));
		expect(sideGap('R', font)).toBe(Math.round(0.6 * G));
		expect(sideGap('O', font)).toBe(Math.round(0.4 * G));
		expect(sideGap('S', font, { punctuation: true })).toBe(Math.round(0.6 * G));
		expect(sideGap('O', font, { punctuation: true })).toBe(Math.round(0.6 * G));
	});

	it('the letter-spacing extra runs from -G to +G', () => {
		expect(extraRange(font)).toEqual({ min: -Math.round(G), max: Math.round(G) });
	});
});

describe.each([1000, 2048])('fitSpacing at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = font.xHeight * 0.08;
	const S = Math.round(G);
	const R = Math.round(0.6 * G);
	const O = Math.round(0.4 * G);

	it('H (straight both sides): G on each side, ink plus 2 G wide', () => {
		const project = spacingProject(grid, { H: { anyink: AUTO } });
		const item = letter(project, 'H');
		const inkWidth = inkBounds(item).xMax - inkBounds(item).xMin;
		const result = fitSpacing(item, project);
		expect(result.changed).toBe(true);
		expect(result.left).toBe(S);
		expect(result.right).toBe(S);
		expect(sides(item)).toEqual({ left: S, right: S, width: inkWidth + 2 * S });
		expect(result.kinds).toMatchObject({ left: 'S', right: 'S', source: 'table' });
	});

	it('o, r and a get their table sides', () => {
		const project = spacingProject(grid, { o: {}, r: {}, a: {} });
		['o', 'r', 'a'].forEach((char) => fitSpacing(letter(project, char), project));
		expect(sides(letter(project, 'o'))).toMatchObject({ left: R, right: R });
		expect(sides(letter(project, 'r'))).toMatchObject({ left: S, right: O });
		expect(sides(letter(project, 'a'))).toMatchObject({ left: R, right: S });
	});

	it('punctuation gets 0.6 G on both sides, whatever its table kind', () => {
		const project = spacingProject(grid, { '!': {}, "'": {}, '.': {} });
		['!', "'", '.'].forEach((char) => {
			fitSpacing(letter(project, char), project);
			expect(sides(letter(project, char)), char).toMatchObject({ left: R, right: R });
		});
		expect(sideKinds(letter(project, '!'), font)).toMatchObject({
			left: 'S',
			right: 'S',
			punctuation: true,
		});
	});

	it('a letter the table does not know is measured: a ring is round, a block with stems straight', () => {
		const project = spacingProject(grid, { ø: {}, Ħ: {} });
		const ring = letter(project, 'ø');
		const block = letter(project, 'Ħ');
		expect(fitSpacing(ring, project).kinds).toMatchObject({
			left: 'R',
			right: 'R',
			source: 'measured',
		});
		expect(sides(ring)).toMatchObject({ left: R, right: R });
		fitSpacing(block, project);
		expect(sides(block)).toMatchObject({ left: S, right: S });
	});

	it('an accented letter is spaced like its base letter', () => {
		const project = spacingProject(grid, { é: { shapes: [rect(0, 0, 300, font.xHeight)] } });
		const item = letter(project, 'é');
		expect(fitSpacing(item, project).kinds).toMatchObject({
			left: 'R',
			right: 'O',
			source: 'table',
		});
		expect(sides(item)).toMatchObject({ left: R, right: O });
	});

	it('writes whole numbers only, even from a letter with fractional points', () => {
		const project = spacingProject(grid, {
			o: { shapes: [oval(333.3, 250.7, 211.45, 249.9)], advanceWidth: 512.75 },
		});
		const item = letter(project, 'o');
		fitSpacing(item, project);
		allCoords(item).forEach((value) => expect(isWhole(value), String(value)).toBe(true));
		expect(isWhole(item.advanceWidth)).toBe(true);
		expect(Math.abs(sides(item).left - R)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(sides(item).right - R)).toBeLessThanOrEqual(0.5);
	});

	it('a second fit changes nothing', () => {
		const project = spacingProject(grid, { n: {} });
		const item = letter(project, 'n');
		fitSpacing(item, project);
		const fitted = JSON.stringify(item.save());
		expect(fitSpacing(item, project).changed).toBe(false);
		expect(JSON.stringify(item.save())).toBe(fitted);
	});

	it('leaves a letter with no ink alone', () => {
		const project = spacingProject(grid, { n: { shapes: [], advanceWidth: 0 } });
		const item = letter(project, 'n');
		expect(fitSpacing(item, project)).toMatchObject({ changed: false, dx: 0 });
		expect(item.advanceWidth).toBe(0);
	});

	it('moves the photo with the shapes', () => {
		const project = spacingProject(grid, { n: {} });
		const item = letter(project, 'n');
		setTrace(item, photoUnder(item, 30));
		const photoX = getTrace(item).x;
		const result = fitSpacing(item, project);
		expect(result.dx).not.toBe(0);
		expect(getTrace(item).x).toBe(photoX + result.dx);
		expect(inkBounds(item).xMin - getTrace(item).x).toBe(30);
	});

	it('gives a letter a width above 0 even when the extra makes both sides 0', () => {
		const project = spacingProject(grid, {
			l: { shapes: [rect(100, 0, 100.4, 500)], anyink: AUTO },
		});
		setExtra(project, -1000);
		expect(letter(project, 'l').advanceWidth).toBeGreaterThan(0);
	});
});

describe.each([1000, 2048])('fitAllAutomatic at %i units', (grid) => {
	it('fits automatic letters only, and says which ones moved', () => {
		const project = spacingProject(grid, {
			H: { anyink: AUTO },
			o: { anyink: AUTO },
			n: { anyink: MANUAL, advanceWidth: 999 },
			r: { advanceWidth: 777 },
		});
		const manualBefore = JSON.stringify(letter(project, 'n').save());
		const oldBefore = JSON.stringify(letter(project, 'r').save());
		const moved = fitAllAutomatic(project);
		expect(moved.map((entry) => entry.id).sort()).toEqual(
			[letter(project, 'H').id, letter(project, 'o').id].sort()
		);
		expect(JSON.stringify(letter(project, 'n').save())).toBe(manualBefore);
		expect(JSON.stringify(letter(project, 'r').save())).toBe(oldBefore);
		expect(fitAllAutomatic(project)).toEqual([]);
	});

	it('refits a letter made from an automatic letter after that letter moved', () => {
		// m comes first, so it is fitted before the letter it is made from moves
		const project = spacingProject(grid, { m: { shapes: [], anyink: AUTO }, n: { anyink: AUTO } });
		const n = letter(project, 'n');
		const m = letter(project, 'm');
		m.shapes.push(new ComponentInstance({ link: n.id, parent: m }));
		fitAllAutomatic(project);
		const S = Math.round(GRIDS[grid].xHeight * 0.08);
		expect(sides(n).left).toBe(S);
		expect(sides(m).left).toBe(S);
		expect(fitAllAutomatic(project)).toEqual([]);
	});
});

describe.each([1000, 2048])('the letter-spacing extra at %i units', (grid) => {
	const font = GRIDS[grid];
	const G = Math.round(font.xHeight * 0.08);
	const S = G;
	const R = Math.round(0.6 * font.xHeight * 0.08);

	/** A font with an automatic H and o, a manual n set wide, and a hanging f */
	function font4() {
		const project = spacingProject(grid, {
			H: { anyink: AUTO },
			o: { anyink: AUTO },
			n: { anyink: MANUAL },
			f: { anyink: MANUAL },
			' ': { shapes: [], advanceWidth: Math.round(font.upm / 4) },
		});
		fitSpacing(letter(project, 'H'), project);
		fitSpacing(letter(project, 'o'), project);
		const n = letter(project, 'n');
		n.updateGlyphPosition(30 - inkBounds(n).xMin, 0);
		n.advanceWidth = inkBounds(n).xMax + 50;
		const f = letter(project, 'f');
		f.updateGlyphPosition(10 - inkBounds(f).xMin, 0);
		// The arm hangs 40 units past the right edge
		f.advanceWidth = inkBounds(f).xMax - 40;
		return project;
	}

	it('is stored as a whole number in settings.anyink.spacing.extra, held to -G..+G', () => {
		const project = font4();
		expect(getExtra(project)).toBe(0);
		expect(setExtra(project, 12.4).extra).toBe(12);
		expect(project.settings.anyink.spacing).toEqual({ extra: 12 });
		expect(setExtra(project, 10 * G).extra).toBe(G);
		expect(setExtra(project, -10 * G).extra).toBe(-G);
		expect(getExtra(project)).toBe(-G);
	});

	it('adds the same space to both sides of every letter, automatic or set by him', () => {
		const project = font4();
		const n = sides(letter(project, 'n'));
		setExtra(project, 10);
		expect(sides(letter(project, 'H'))).toMatchObject({ left: S + 10, right: S + 10 });
		expect(sides(letter(project, 'o'))).toMatchObject({ left: R + 10, right: R + 10 });
		expect(sides(letter(project, 'n'))).toMatchObject({ left: n.left + 10, right: n.right + 10 });
		expect(sides(letter(project, 'f')).right).toBe(-30);
	});

	it('stops at touching: no side goes below zero unless it already was (a hanging f)', () => {
		const project = font4();
		setExtra(project, -G);
		expect(sides(letter(project, 'H'))).toMatchObject({ left: 0, right: 0 });
		expect(sides(letter(project, 'o'))).toMatchObject({ left: 0, right: 0 });
		expect(sides(letter(project, 'n'))).toMatchObject({ left: 0, right: 50 - G > 0 ? 50 - G : 0 });
		expect(sides(letter(project, 'f'))).toMatchObject({ left: 0, right: -40 });
		// Any order of letters: neighbors' ink never overlaps
		const row = ['H', 'o', 'n', 'o', 'H'].map((char) => letter(project, char));
		let pen = 0;
		let lastInkEnd = -Infinity;
		row.forEach((item) => {
			const ink = inkBounds(item);
			expect(pen + ink.xMin).toBeGreaterThanOrEqual(lastInkEnd);
			lastInkEnd = pen + ink.xMax;
			pen += item.advanceWidth;
		});
	});

	it('Reset gives every letter back exactly the spacing it had', () => {
		const project = font4();
		const before = JSON.stringify(project.save().glyphs);
		setExtra(project, -G);
		setExtra(project, G);
		setExtra(project, 0);
		expect(JSON.stringify(project.save().glyphs)).toBe(before);
	});

	it('a drag of many small steps ends where one step does', () => {
		const dragged = font4();
		for (let value = 0; value >= -G; value -= 3) setExtra(dragged, value);
		setExtra(dragged, -G);
		const once = font4();
		setExtra(once, -G);
		expect(JSON.stringify(dragged.save().glyphs)).toBe(JSON.stringify(once.save().glyphs));
	});

	it('moves the photos with the shapes', () => {
		const project = font4();
		['H', 'n'].forEach((char) => {
			const item = letter(project, char);
			setTrace(item, photoUnder(item, 25));
		});
		setExtra(project, -G);
		setExtra(project, 7);
		['H', 'n'].forEach((char) => {
			const item = letter(project, char);
			expect(inkBounds(item).xMin - getTrace(item).x, char).toBe(25);
		});
	});

	it('leaves letters with no ink, and the space, alone', () => {
		const project = font4();
		const space = letter(project, ' ');
		setExtra(project, -G);
		expect(space.advanceWidth).toBe(Math.round(font.upm / 4));
		expect(space.anyink.spacingExtra).toBeUndefined();
	});

	it("keeps each letter's share of the extra with the letter, and none when it is 0", () => {
		const project = font4();
		setExtra(project, -G);
		const n = letter(project, 'n');
		expect(appliedExtra(n, getExtra(project))).toEqual({ left: -30, right: -Math.min(50, G) });
		setExtra(project, 0);
		expect(n.anyink.spacingExtra).toBeUndefined();
		expect(letter(project, 'H').anyink.spacingExtra).toBeUndefined();
	});

	it('a letter drawn by hand while the extra was set moves only by the change', () => {
		const project = font4();
		setExtra(project, -20);
		const project2 = new GlyphrStudioProject(project.save());
		project2.settings.anyink.spacing = { extra: -20 };
		const inkEnd = 100 + Math.round(font.xHeight * 0.6);
		const late = letter(spacingProject(grid, { u: { advanceWidth: inkEnd + 100 } }), 'u');
		project2.glyphs[late.id] = late;
		late.parent = project2;
		const before = sides(late);
		setExtra(project2, -21);
		expect(sides(late).left).toBe(Math.max(0, before.left - 1));
		expect(sides(late).right).toBe(Math.max(0, before.right - 1));
	});

	it('fits a new automatic letter with the extra already in it', () => {
		const project = font4();
		setExtra(project, 9);
		const project2 = spacingProject(grid, { H: { anyink: AUTO } });
		project2.settings.anyink.spacing = { extra: 9 };
		fitSpacing(letter(project2, 'H'), project2);
		expect(sides(letter(project2, 'H'))).toMatchObject({ left: S + 9, right: S + 9 });
	});
});

describe.each([1000, 2048])('letters made from a letter that changed, at %i units', (grid) => {
	const S = Math.round(GRIDS[grid].xHeight * 0.08);

	/** n automatic and fitted; m automatic, made from n (a component), fitted after it */
	function made() {
		const project = spacingProject(grid, { m: { shapes: [], anyink: AUTO }, n: { anyink: AUTO } });
		const n = letter(project, 'n');
		const m = letter(project, 'm');
		m.shapes.push(new ComponentInstance({ link: n.id, parent: m }));
		fitAllAutomatic(project);
		return { project, n, m };
	}

	it('sitsAtFit says whether fitSpacing would move the ink or change the width', () => {
		const { project, n } = made();
		expect(sitsAtFit(n, project)).toBe(true);
		n.advanceWidth += 7;
		expect(sitsAtFit(n, project)).toBe(false);
		fitSpacing(n, project);
		n.updateGlyphPosition(5, 0);
		expect(sitsAtFit(n, project)).toBe(false);
		const before = JSON.stringify(n.save());
		sitsAtFit(n, project);
		expect(JSON.stringify(n.save())).toBe(before);
		expect(sitsAtFit(letter(spacingProject(grid, { o: { shapes: [] } }), 'o'), project)).toBe(
			false
		);
	});

	it('finds the automatic letters made from it whose spacing moved, and fits only those', () => {
		const { project, n, m } = made();
		expect(dependentsOffFit(n, project)).toEqual([]);
		// n gets wider: n is refit by its own step, m (made from it) is now too narrow
		n.shapes.push(new n.shapes[0].constructor(rect(S, 0, S + 1200, 50)));
		n.changed();
		fitSpacing(n, project);
		expect(dependentsOffFit(n, project)).toEqual([m]);
		const nBefore = JSON.stringify(n.save());
		expect(fitDependents(n, project).map((entry) => entry.id)).toEqual([m.id]);
		expect(JSON.stringify(n.save())).toBe(nBefore);
		expect(sides(m).left).toBe(S);
		expect(sitsAtFit(m, project)).toBe(true);
		expect(dependentsOffFit(n, project)).toEqual([]);
		expect(fitDependents(n, project)).toEqual([]);
	});

	it('leaves letters made from it alone when they are set by hand', () => {
		const { project, n, m } = made();
		m.anyink.spacing = 'manual';
		n.advanceWidth += 40;
		n.updateGlyphPosition(30, 0);
		expect(dependentsOffFit(n, project)).toEqual([]);
		const mBefore = JSON.stringify(m.save());
		expect(fitDependents(n, project)).toEqual([]);
		expect(JSON.stringify(m.save())).toBe(mBefore);
	});
});
