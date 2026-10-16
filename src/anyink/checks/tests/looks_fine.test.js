// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B11 "Looks fine to me" (UX-BEGINNER.md 4.2: stored per letter and per check in
// glyph.anyink.checksOk, cleared only when the letter's shapes change). It persists through a
// save, an Undo copy and a work file reload; any change to a point, a handle or the shapes
// clears it; moving the whole drawing (automatic spacing, an edge drag, Sit on the line) does
// not; and Undo back to the shapes it was said for brings it back.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { fitSpacing } from '../../spacing/auto_space.js';
import { CHECK, checkLetter } from '../checks.js';
import {
	CHECKS_OK,
	clearLooksFine,
	isLooksFine,
	isStaleLooksFine,
	looksFineIds,
	openChecks,
	pruneLooksFine,
	setLooksFine,
	shapePrint,
} from '../looks_fine.js';
import { FONT, checksFont, letter, moved, rect, scaled, shapesFor } from './letters.js';

/** A small n floating above the writing line: one check, offLine */
function floatingN() {
	const project = checksFont({ n: moved(shapesFor('n'), 0, 200) });
	return { project, item: letter(project, 'n') };
}

describe('Looks fine to me', () => {
	it('is stored per letter and per check, and takes that check out of the open ones', () => {
		const { item } = floatingN();
		const checks = checkLetter(item, { font: FONT });
		expect(openChecks(item, checks).map((c) => c.id)).toEqual([CHECK.offLine]);
		expect(setLooksFine(item, CHECK.offLine)).toBe(true);
		expect(setLooksFine(item, CHECK.offLine)).toBe(false);
		expect(item.anyink[CHECKS_OK].ids).toEqual([CHECK.offLine]);
		expect(isLooksFine(item, CHECK.offLine)).toBe(true);
		expect(isLooksFine(item, CHECK.size)).toBe(false);
		expect(openChecks(item, checks)).toEqual([]);
		setLooksFine(item, CHECK.size);
		expect(looksFineIds(item)).toEqual([CHECK.offLine, CHECK.size]);
	});

	it('persists through save(), an Undo copy and a work file reload', () => {
		const { project, item } = floatingN();
		setLooksFine(item, CHECK.offLine);
		const copy = new Glyph(item.save());
		expect(isLooksFine(copy, CHECK.offLine)).toBe(true);
		const reloaded = new GlyphrStudioProject(JSON.parse(JSON.stringify(project.save())));
		expect(isLooksFine(letter(reloaded, 'n'), CHECK.offLine)).toBe(true);
	});

	it('clears when a point moves, a handle moves, or a shape is added or taken away', () => {
		const changes = [
			(item) => (item.shapes[0].pathPoints[1].p.x += 30),
			(item) => (item.shapes[0].pathPoints[0].h2.y += 15),
			(item) => item.addOneShape(rect(1400, 400, 1450, 450)),
			(item) => item.shapes.pop(),
		];
		changes.forEach((change, index) => {
			const { item } = floatingN();
			item.addOneShape(rect(1300, 300, 1320, 320));
			setLooksFine(item, CHECK.offLine);
			change(item);
			expect([index, isLooksFine(item, CHECK.offLine)]).toEqual([index, false]);
			expect(isStaleLooksFine(item)).toBe(true);
		});
	});

	it('stays when the whole drawing moves: spacing, an edge drag, Sit on the line', () => {
		const { project, item } = floatingN();
		setLooksFine(item, CHECK.offLine);
		const print = shapePrint(item);
		item.updateGlyphPosition(250, 0);
		expect(shapePrint(item)).toBe(print);
		item.updateGlyphPosition(0, -200);
		expect(isLooksFine(item, CHECK.offLine)).toBe(true);
		item.anyink.spacing = 'auto';
		fitSpacing(item, project);
		expect(isLooksFine(item, CHECK.offLine)).toBe(true);
	});

	it('clears when the drawing is resized or flipped (Match size, Shrink to fit)', () => {
		const project = checksFont({ n: scaled(shapesFor('n'), 1.4) });
		const item = letter(project, 'n');
		setLooksFine(item, CHECK.size);
		const resized = checksFont({ n: scaled(shapesFor('n'), 1.39) });
		const other = letter(resized, 'n');
		other.anyink[CHECKS_OK] = { ...item.anyink[CHECKS_OK] };
		expect(isLooksFine(other, CHECK.size)).toBe(false);
	});

	it('comes back with Undo to the shapes it was said for', () => {
		const { item } = floatingN();
		setLooksFine(item, CHECK.offLine);
		const said = item.save();
		item.shapes[0].pathPoints[2].p.y += 40;
		expect(isLooksFine(item, CHECK.offLine)).toBe(false);
		const undone = new Glyph(said);
		expect(isLooksFine(undone, CHECK.offLine)).toBe(true);
	});

	it('a new press after a change starts a new list (the old ids are gone)', () => {
		const { item } = floatingN();
		setLooksFine(item, CHECK.offLine);
		setLooksFine(item, CHECK.size);
		item.shapes[0].pathPoints[2].p.y += 40;
		setLooksFine(item, CHECK.hangs);
		expect(looksFineIds(item)).toEqual([CHECK.hangs]);
	});

	it('clear and prune take the record away; prune only a stale one', () => {
		const { item } = floatingN();
		setLooksFine(item, CHECK.offLine);
		expect(pruneLooksFine(item)).toBe(false);
		item.shapes[0].pathPoints[2].p.y += 40;
		expect(pruneLooksFine(item)).toBe(true);
		expect(item.anyink[CHECKS_OK]).toBeUndefined();
		setLooksFine(item, CHECK.offLine);
		expect(clearLooksFine(item)).toBe(true);
		expect(clearLooksFine(item)).toBe(false);
	});

	it('a letter with no shapes, a bad record or a bad id is never "looks fine"', () => {
		const empty = new Glyph({ id: 'glyph-0x6E', shapes: [] });
		expect(setLooksFine(empty, CHECK.offLine)).toBe(false);
		expect(shapePrint(empty)).toBe('');
		const { item } = floatingN();
		expect(setLooksFine(item, '')).toBe(false);
		item.anyink[CHECKS_OK] = { print: 42, ids: [CHECK.offLine] };
		expect(looksFineIds(item)).toEqual([]);
		item.anyink[CHECKS_OK] = 'yes';
		expect(looksFineIds(item)).toEqual([]);
	});
});
