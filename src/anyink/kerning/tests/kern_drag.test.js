// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import { KernGroup } from '../../../project_data/kern_group.js';
import {
	LINE_GRAB_PX,
	dragValue,
	getDragZone,
	isClassGroup,
	isPointerInDragZone,
	snapTo,
} from '../kern_drag.js';

describe('kern_drag: dragValue', () => {
	it('measures from the first pointer position so rounding never loses motion', () => {
		// dz = 0.4 px per unit: each pixel is 2.5 units, per-tick rounding would drift
		let value = -100;
		for (let x = 0; x <= 40; x++) value = dragValue(-100, 0, x, 0.4);
		expect(value).toBe(0); // 40 px / 0.4 = 100 units, exactly
		expect(dragValue(-100, 0, 1, 0.4)).toBe(-97); // -97.5 rounds toward +infinity
		expect(dragValue(-100, 0, 2, 0.4)).toBe(-95);
		expect(dragValue(-100, 0, 3, 0.4)).toBe(-92); // -92.5 -> -92, not -95 + round(2.5)
	});

	it('moves left for negative pointer deltas and rounds to whole units', () => {
		expect(dragValue(0, 100, 80, 1)).toBe(-20);
		expect(dragValue(0, 100, 80, 2)).toBe(-10);
		expect(dragValue(15, 0, 0, 1)).toBe(15);
		expect(dragValue('15', 0, 3, 1)).toBe(18);
	});

	it('Shift snaps the result to multiples of 10', () => {
		expect(dragValue(0, 0, 44, 1, true)).toBe(40);
		expect(dragValue(0, 0, 45, 1, true)).toBe(50);
		expect(dragValue(-3, 0, 0, 1, true)).toBe(0);
		expect(dragValue(0, 0, -26, 1, true)).toBe(-30);
	});

	it('tolerates a zero zoom', () => {
		expect(dragValue(0, 0, 10, 0)).toBe(10);
	});
});

describe('kern_drag: snapTo', () => {
	it('snaps to the step, default 10', () => {
		expect(snapTo(14)).toBe(10);
		expect(snapTo(15)).toBe(20);
		expect(snapTo(-14)).toBe(-10);
		expect(snapTo(7, 5)).toBe(5);
		expect(snapTo(7.4, 0)).toBe(7);
	});
});

describe('kern_drag: drag zone', () => {
	const group = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'], value: -100 });
	const zone = getDragZone(group, { rightWidth: 600, ascent: 800, descent: -200 });
	const view = { dx: 500, dy: 400, dz: 0.5 }; // em x=0 at px 500, baseline at px 400

	it('spans the right group ink from x = value to value + width, descent to ascent', () => {
		expect(zone).toEqual({ xMin: -100, xMax: 500, yMin: -200, yMax: 800, lineX: -100 });
	});

	it('is true inside the ink area', () => {
		// em (200, 300) -> px (600, 250)
		expect(isPointerInDragZone({ x: 600, y: 250 }, view, zone)).toBe(true);
		// on the baseline inside the ink
		expect(isPointerInDragZone({ x: 700, y: 400 }, view, zone)).toBe(true);
	});

	it('is false over the left glyph, above the ascent, or below the descent', () => {
		// em x = -300 (left glyph): px 350
		expect(isPointerInDragZone({ x: 350, y: 250 }, view, zone)).toBe(false);
		// above ascent: em y = 900 -> px -50
		expect(isPointerInDragZone({ x: 600, y: -50 }, view, zone)).toBe(false);
		// below descent: em y = -300 -> px 550
		expect(isPointerInDragZone({ x: 600, y: 550 }, view, zone)).toBe(false);
	});

	it('is true within the grab tolerance of the x = value line at any height', () => {
		// value line at em x -100 -> px 450
		expect(isPointerInDragZone({ x: 450, y: -300 }, view, zone)).toBe(true);
		expect(isPointerInDragZone({ x: 450 - LINE_GRAB_PX, y: 900 }, view, zone)).toBe(true);
		expect(isPointerInDragZone({ x: 450 - LINE_GRAB_PX - 1, y: 900 }, view, zone)).toBe(false);
		expect(isPointerInDragZone({ x: 450 + LINE_GRAB_PX + 1, y: 900 }, view, zone)).toBe(false);
	});

	it('handles missing arguments', () => {
		expect(isPointerInDragZone(undefined, view, zone)).toBe(false);
		expect(isPointerInDragZone({ x: 0, y: 0 }, undefined, zone)).toBe(false);
		expect(getDragZone(undefined)).toEqual({ xMin: 0, xMax: 0, yMin: 0, yMax: 0, lineX: 0 });
	});
});

describe('kern_drag: isClassGroup', () => {
	it('is true when either side has more than one member', () => {
		expect(isClassGroup(new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'] }))).toBe(false);
		expect(isClassGroup(new KernGroup({ leftGroup: ['0x41', '0x42'], rightGroup: ['0x56'] }))).toBe(true);
		expect(isClassGroup(new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56', '0x57'] }))).toBe(true);
		expect(isClassGroup(undefined)).toBe(false);
	});
});
