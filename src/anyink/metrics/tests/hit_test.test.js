// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	collectGuideLines,
	HIT_ZONE_PX,
	hitTestLines,
	hitZoneEm,
	lineCanvasPosition,
} from '../hit_test.js';

const font = { upm: 1000, ascent: 800, descent: -200, capHeight: 790, xHeight: 580 };
const allOn = {
	ascent: true,
	capHeight: true,
	xHeight: true,
	baseline: true,
	descent: true,
	leftSide: true,
	rightSide: true,
};
const guides = {
	systemShowGuides: true,
	customShowGuides: true,
	custom: [
		{ name: 'Mid', angle: 90, location: 300, visible: true },
		{ name: 'Stem', angle: 0, location: 120, visible: true },
		{ name: 'Hidden', angle: 90, location: 400, visible: false },
	],
};
const glyph = { objType: 'Glyph', advanceWidth: 600 };
const view = { dx: 100, dy: 500, dz: 0.5 };
const ids = (lines) => lines.map((l) => l.id);

describe('collectGuideLines', () => {
	it('lists metrics, baseline, side bearings, and visible custom guides for a glyph', () => {
		const lines = collectGuideLines({ font, systemGuides: allOn, guides, item: glyph });
		expect(ids(lines)).toEqual([
			'ascent',
			'capHeight',
			'xHeight',
			'descent',
			'baseline',
			'lsb',
			'rsb',
			'guide:0',
			'guide:1',
		]);
		const rsb = lines.find((l) => l.id === 'rsb');
		expect(rsb.orientation).toBe('v');
		expect(rsb.value).toBe(600);
		const mid = lines.find((l) => l.id === 'guide:0');
		expect(mid.orientation).toBe('h');
		expect(mid.value).toBe(300);
		const stem = lines.find((l) => l.id === 'guide:1');
		expect(stem.orientation).toBe('v');
	});

	it('respects the system guide flags', () => {
		const some = { ...allOn, ascent: false, leftSide: false };
		const lines = collectGuideLines({ font, systemGuides: some, guides, item: glyph });
		expect(ids(lines)).not.toContain('ascent');
		expect(ids(lines)).not.toContain('lsb');
		expect(ids(lines)).toContain('rsb');
	});

	it('hides everything when the master switches are off', () => {
		const off = { systemShowGuides: false, customShowGuides: false, custom: guides.custom };
		expect(collectGuideLines({ font, systemGuides: allOn, guides: off, item: glyph })).toEqual([]);
	});

	it('skips the right side bearing for components and zero-width items', () => {
		const component = { objType: 'Component', advanceWidth: 600 };
		expect(ids(collectGuideLines({ font, systemGuides: allOn, guides, item: component }))).not.toContain('rsb');
		const empty = { objType: 'Glyph', advanceWidth: 0 };
		expect(ids(collectGuideLines({ font, systemGuides: allOn, guides, item: empty }))).not.toContain('rsb');
	});

	it('gives kern groups the horizontal metrics only', () => {
		const kern = { objType: 'KernGroup', value: -40 };
		const lines = collectGuideLines({ font, systemGuides: allOn, guides, item: kern });
		expect(ids(lines)).toEqual(['ascent', 'capHeight', 'xHeight', 'descent', 'baseline']);
	});

	it('returns nothing without an item', () => {
		const lines = collectGuideLines({ font, systemGuides: allOn, guides, item: false });
		expect(ids(lines)).toEqual(['ascent', 'capHeight', 'xHeight', 'descent', 'baseline', 'guide:0', 'guide:1']);
	});
});

describe('hit zone', () => {
	it('is 6 canvas pixels, which is 6 / dz in Em', () => {
		expect(HIT_ZONE_PX).toBe(6);
		expect(hitZoneEm({ dz: 0.5 })).toBe(12);
		expect(hitZoneEm({ dz: 2 })).toBe(3);
		expect(hitZoneEm({ dz: 0 })).toBe(6);
	});

	it('places lines with the view (y grows downward on the canvas)', () => {
		expect(lineCanvasPosition({ orientation: 'h', value: 580 }, view)).toBe(500 - 290);
		expect(lineCanvasPosition({ orientation: 'v', value: 600 }, view)).toBe(100 + 300);
	});
});

describe('hitTestLines', () => {
	const lines = collectGuideLines({ font, systemGuides: allOn, guides, item: glyph });

	it('finds a horizontal line inside the zone and misses outside it', () => {
		// xHeight 580 -> canvas y 210
		expect(hitTestLines(lines, 300, 210, view).id).toBe('xHeight');
		expect(hitTestLines(lines, 300, 216, view).id).toBe('xHeight');
		expect(hitTestLines(lines, 300, 217, view)).toBe(false);
	});

	it('finds vertical lines by x only', () => {
		// rsb at x = 400
		expect(hitTestLines(lines, 403, 50, view).id).toBe('rsb');
		expect(hitTestLines(lines, 100, 900, view).id).toBe('lsb');
		// custom vertical guide at 120 Em -> x 160
		expect(hitTestLines(lines, 158, 300, view).id).toBe('guide:1');
	});

	it('picks the nearest when two lines are within the zone', () => {
		// ascent 800 -> y 100, capHeight 790 -> y 105
		expect(hitTestLines(lines, 300, 101, view).id).toBe('ascent');
		expect(hitTestLines(lines, 300, 104, view).id).toBe('capHeight');
	});

	it('scales the zone with zoom', () => {
		const zoomed = { dx: 100, dy: 500, dz: 4 };
		// xHeight at y = 500 - 2320 = -1820; 6 px is only 1.5 Em now
		expect(hitTestLines(lines, 300, -1815, zoomed).id).toBe('xHeight');
		expect(hitTestLines(lines, 300, -1812, zoomed)).toBe(false);
	});

	it('honors a custom tolerance and bad input', () => {
		expect(hitTestLines(lines, 300, 230, view, 20).id).toBe('xHeight');
		expect(hitTestLines(null, 0, 0, view)).toBe(false);
		expect(hitTestLines(lines, 0, 0, null)).toBe(false);
	});
});
