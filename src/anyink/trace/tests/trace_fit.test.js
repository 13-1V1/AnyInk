// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track C: placement helpers behind 'Fit to em', 'Fit to cap height', and
// 'Replace image' (src/anyink/trace/trace_fit.js). Pure functions, font units, y-up.
import { describe, expect, it } from 'vitest';
import { makeIcon } from '../../../common/graphics.js';
import {
	fitBands,
	fitTraceToBand,
	isUsableBand,
	keepPlacementForNewImage,
	placementSummary,
} from '../trace_fit.js';

const trace = {
	asset: 'img-aaaaaaaa',
	width: 400,
	height: 800,
	x: 35,
	y: 610,
	scale: 0.5,
	opacity: 0.6,
	visible: false,
	locked: true,
	invert: true,
};
const font = { ascent: 800, descent: -200, capHeight: 790 };

describe('fitBands', () => {
	it('em runs from the ascent to the descent, cap from the cap height to the baseline', () => {
		expect(fitBands(font)).toEqual({
			em: { top: 800, bottom: -200 },
			cap: { top: 790, bottom: 0 },
		});
	});

	it('treats missing metrics as 0 so the bands are never NaN', () => {
		const bands = fitBands({});
		expect(bands.em).toEqual({ top: 0, bottom: 0 });
		expect(isUsableBand(bands.em)).toBe(false);
		expect(isUsableBand(bands.cap)).toBe(false);
		expect(isUsableBand(fitBands(font).cap)).toBe(true);
	});
});

describe('fitTraceToBand', () => {
	it('fills the band height, top on the band top, left edge at 0, and keeps the rest', () => {
		const fitted = fitTraceToBand(trace, 800, -200);
		expect(fitted.scale).toBeCloseTo(1000 / 800, 12);
		expect(fitted.x).toBe(0);
		expect(fitted.y).toBe(800);
		expect(fitted.height * fitted.scale).toBeCloseTo(1000, 9);
		expect(fitted).toMatchObject({ asset: trace.asset, opacity: 0.6, invert: true });
		expect(trace.scale).toBe(0.5); // input untouched
	});

	it('fits the cap height band (baseline to cap height)', () => {
		const fitted = fitTraceToBand(trace, 790, 0);
		expect(fitted.y).toBe(790);
		expect(fitted.height * fitted.scale).toBeCloseTo(790, 9);
	});

	it('returns null for an empty or upside-down band, or a trace with no height', () => {
		expect(fitTraceToBand(trace, 0, 0)).toBeNull();
		expect(fitTraceToBand(trace, -200, 800)).toBeNull();
		expect(fitTraceToBand({ ...trace, height: 0 }, 800, -200)).toBeNull();
		expect(fitTraceToBand(null, 800, -200)).toBeNull();
	});
});

describe('keepPlacementForNewImage', () => {
	it('keeps the top-left corner and the height on the canvas, and shows the image', () => {
		const next = keepPlacementForNewImage(trace, {
			asset: 'img-bbbbbbbb',
			width: 300,
			height: 200,
		});
		expect(next.asset).toBe('img-bbbbbbbb');
		expect(next.width).toBe(300);
		expect(next.height).toBe(200);
		expect(next.x).toBe(35);
		expect(next.y).toBe(610);
		expect(next.height * next.scale).toBeCloseTo(trace.height * trace.scale, 9);
		expect(next).toMatchObject({ opacity: 0.6, locked: true, invert: true, visible: true });
	});

	it('returns null when a size is unusable', () => {
		expect(keepPlacementForNewImage(trace, { asset: 'img-b', width: 0, height: 10 })).toBeNull();
		expect(keepPlacementForNewImage(trace, { asset: 'img-b', width: 10, height: 0 })).toBeNull();
		expect(
			keepPlacementForNewImage({ ...trace, scale: 0 }, { asset: 'img-b', width: 1, height: 1 })
		).toBeNull();
		expect(keepPlacementForNewImage(null, { asset: 'img-b', width: 1, height: 1 })).toBeNull();
	});
});

describe('placementSummary', () => {
	it('rounds the corner and the drawn size to whole font units', () => {
		expect(placementSummary({ ...trace, x: 10.4, y: 799.6, scale: 1.2345 })).toEqual({
			x: 10,
			y: 800,
			width: 494,
			height: 988,
		});
		expect(placementSummary(null)).toBeNull();
	});
});

describe('panel_trace icon', () => {
	it('is its own 24 x 24 drawing, not the placeholder eye', () => {
		const trace = makeIcon({ name: 'panel_trace', color: 'currentColor' });
		const eye = makeIcon({ name: 'panel_view', color: 'currentColor' });
		expect(trace).not.toBe(eye);
		expect(trace).toContain('viewBox="0 0 24 24"');
		expect(trace.match(/<polygon /g)).toHaveLength(5);
		expect(trace).toContain('<circle ');
	});
});
