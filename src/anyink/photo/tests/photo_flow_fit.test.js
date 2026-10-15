// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow: "as traced" (photo_flow_fit.js). Use it marks a letter with the part it holds
// and a print of its ink (item.anyink.photoFit); the letter still counts as traced from the
// photo while the print matches (spacing only slides it sideways), so a later letter of the
// same photo can resize it (4.4), and never once he changed it. And the registry stays honest
// through Undo and Redo, which put letters back without the registry (settings.anyink).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { Path } from '../../../project_data/path.js';
import { setTrace } from '../../trace/trace_model.js';
import { addPhoto, getPhoto, usePart } from '../photo_registry.js';
import {
	inkPrint,
	isAsTraced,
	photoHeld,
	reconcilePhotoUses,
	setPhotoFit,
	tracedCopies,
} from '../photo_flow_fit.js';

function box(x0, y0, x1, y1) {
	const corner = (x, y) => ({ p: { coord: { x, y } } });
	return new Path({ pathPoints: [corner(x0, y0), corner(x1, y0), corner(x1, y1), corner(x0, y1)] });
}

function letter(id, shapes = [], trace = null) {
	const item = new Glyph({ id, shapes: shapes.map((s) => s.save()) });
	if (trace) setTrace(item, trace);
	return item;
}

const TRACE = { asset: 'img-fit00001', width: 800, height: 600, x: 0, y: 900, scale: 2 };

function slide(item, dx) {
	// Moving a point moves its handles with it (PathPoint.updatePathPointPosition)
	item.shapes.forEach((shape) => shape.pathPoints.forEach((pp) => (pp.p.x += dx)));
}

describe('inkPrint and tracedCopies', () => {
	it('the same ink slid sideways prints the same; a moved point or another shape does not', () => {
		const a = [box(10, 0, 110, 500), box(30, 100, 90, 300)];
		const b = [box(98, 0, 198, 500), box(118, 100, 178, 300)];
		expect(inkPrint(a)).toBe(inkPrint(b));
		expect(inkPrint([box(10, 0, 110, 500)])).not.toBe(inkPrint(a));
		expect(inkPrint([box(10, 0, 110, 501), box(30, 100, 90, 300)])).not.toBe(inkPrint(a));
		expect(inkPrint([])).toBe(inkPrint([]));
	});

	it('tracedCopies are whole-unit copies, as Use it puts them in', () => {
		const copies = tracedCopies([box(10.4, -0.6, 110.5, 500.2)]);
		expect(copies[0]).not.toBe(undefined);
		const coords = copies[0].pathPoints.flatMap((pp) => [pp.p.x, pp.p.y]);
		expect(coords.every(Number.isInteger)).toBe(true);
	});
});

describe('setPhotoFit / isAsTraced / photoHeld', () => {
	it('a letter marked as traced stays so through a sideways refit, and not once he changes it', () => {
		const item = letter('glyph-0x61', [box(10, 0, 110, 500)], TRACE);
		setPhotoFit(item, { asset: TRACE.asset, part: 'p3', shapes: item.shapes });
		expect(item.anyink.photoFit).toMatchObject({ asset: TRACE.asset, part: 'p3' });
		expect(isAsTraced(item, TRACE.asset)).toBe(true);
		slide(item, 88);
		expect(isAsTraced(item, TRACE.asset)).toBe(true);
		expect(isAsTraced(item, 'img-other001')).toBe(false);
		item.shapes[0].pathPoints[2].p.y = 640;
		expect(isAsTraced(item, TRACE.asset)).toBe(false);
	});

	it('with no shapes given (Add to my shapes) it holds the part but is never "as traced"', () => {
		const item = letter('glyph-0x62', [box(10, 0, 110, 500)], TRACE);
		setPhotoFit(item, { asset: TRACE.asset, part: 'p4' });
		expect(isAsTraced(item, TRACE.asset)).toBe(false);
		expect(photoHeld(item)).toEqual({ asset: TRACE.asset, part: 'p4' });
	});

	it('photoHeld only while the letter still shows that photo', () => {
		const item = letter('glyph-0x63', [box(10, 0, 110, 500)], TRACE);
		setPhotoFit(item, { asset: TRACE.asset, part: 'p1', shapes: item.shapes });
		setTrace(item, { ...TRACE, asset: 'img-other002' });
		expect(photoHeld(item)).toBeNull();
		expect(photoHeld(letter('glyph-0x64'))).toBeNull();
	});
});

describe('reconcilePhotoUses: the registry after Undo and Redo', () => {
	function font() {
		const glyphs = {};
		const project = { settings: { anyink: {} }, glyphs, getItem: (id) => glyphs[id] || null };
		const record = addPhoto(project, {
			asset: TRACE.asset,
			width: 800,
			height: 600,
			parts: [
				{ id: 'p1', left: 10, top: 10, right: 50, bottom: 60, row: 0 },
				{ id: 'p2', left: 70, top: 10, right: 110, bottom: 60, row: 0 },
			],
		});
		return { project, glyphs, record };
	}

	it('lets go of a part whose letter no longer shows the photo (Undo of Use it)', () => {
		const { project, glyphs, record } = font();
		glyphs['glyph-0x42'] = letter('glyph-0x42');
		usePart(record, 'p1', { char: 'B', itemId: 'glyph-0x42' });
		expect(reconcilePhotoUses(project)).toEqual({ released: 1, restored: 0 });
		expect(getPhoto(project, TRACE.asset).used).toEqual({});
	});

	it('takes the part back when Redo brings the letter back with its photo', () => {
		const { project, glyphs, record } = font();
		const b = letter('glyph-0x42', [box(0, 0, 100, 700)], TRACE);
		setPhotoFit(b, { asset: TRACE.asset, part: 'p1', shapes: b.shapes });
		glyphs['glyph-0x42'] = b;
		expect(reconcilePhotoUses(project)).toEqual({ released: 0, restored: 1 });
		expect(record.used.p1).toMatchObject({ char: 'B', itemId: 'glyph-0x42' });
	});

	it('never takes a part another letter holds now, and leaves out the letter being traced', () => {
		const { project, glyphs, record } = font();
		const b = letter('glyph-0x42', [box(0, 0, 100, 700)], TRACE);
		setPhotoFit(b, { asset: TRACE.asset, part: 'p1', shapes: b.shapes });
		const d = letter('glyph-0x64', [box(0, 0, 100, 700)], TRACE);
		glyphs['glyph-0x42'] = b;
		glyphs['glyph-0x64'] = d;
		usePart(record, 'p1', { char: 'd', itemId: 'glyph-0x64' });
		expect(reconcilePhotoUses(project)).toEqual({ released: 0, restored: 0 });
		expect(record.used.p1.char).toBe('d');

		const r = letter('glyph-0x72', [], { ...TRACE });
		glyphs['glyph-0x72'] = r;
		usePart(record, 'p2', { char: 'r', itemId: 'glyph-0x72' });
		setTrace(r, null);
		expect(reconcilePhotoUses(project, { skip: 'glyph-0x72' })).toEqual({
			released: 0,
			restored: 0,
		});
		expect(record.used.p2.char).toBe('r');
	});

	it('a font with no photos: nothing to do', () => {
		expect(reconcilePhotoUses({ settings: {} })).toEqual({ released: 0, restored: 0 });
	});
});
