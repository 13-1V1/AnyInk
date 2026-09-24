// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it } from 'vitest';
import {
	BASELINE_SHIFTED_KEYS,
	clampBaselineDelta,
	clampFontMetric,
	DRAGGABLE_METRIC_KEYS,
	FONT_METRIC_KEYS,
	isFontMetricKey,
	METRIC_LABELS,
	metricValue,
	shiftedMetricsForBaseline,
	snapToTen,
} from '../metrics_math.js';

const font = { upm: 1000, ascent: 800, descent: -200, capHeight: 790, xHeight: 580, overshoot: 20, lineGap: 100 };

describe('metric keys and labels', () => {
	it('knows the settings.font Em keys', () => {
		expect(FONT_METRIC_KEYS).toEqual(['upm', 'ascent', 'descent', 'capHeight', 'xHeight', 'overshoot', 'lineGap']);
		expect(isFontMetricKey('xHeight')).toBe(true);
		expect(isFontMetricKey('weight')).toBe(false);
	});

	it('has a label for every draggable line', () => {
		DRAGGABLE_METRIC_KEYS.forEach((key) => expect(typeof METRIC_LABELS[key]).toBe('string'));
		expect(METRIC_LABELS.baseline).toBe('Baseline');
		expect(METRIC_LABELS.lsb).toBe('Left side bearing');
	});

	it('reads metrics as integers and tolerates junk', () => {
		expect(metricValue(font, 'ascent')).toBe(800);
		expect(metricValue({ ascent: '800.4' }, 'ascent')).toBe(800);
		expect(metricValue({}, 'ascent')).toBe(0);
		expect(metricValue(undefined, 'ascent')).toBe(0);
	});
});

describe('snapToTen', () => {
	it('rounds to the unit without Shift', () => {
		expect(snapToTen(583.4, false)).toBe(583);
		expect(snapToTen(-12.6, false)).toBe(-13);
	});

	it('rounds to the nearest 10 with Shift', () => {
		expect(snapToTen(583.4)).toBe(580);
		expect(snapToTen(585, true)).toBe(590);
		expect(snapToTen(-12.6, true)).toBe(-10);
	});

	it('treats junk as zero', () => {
		expect(snapToTen('abc', true)).toBe(0);
	});
});

describe('clampFontMetric keeps descent < 0 < xHeight <= capHeight <= ascent', () => {
	it('rounds ordinary values', () => {
		expect(clampFontMetric(font, 'xHeight', 600.6)).toBe(601);
		expect(clampFontMetric(font, 'ascent', 850)).toBe(850);
	});

	it('xHeight stays between 1 and capHeight', () => {
		expect(clampFontMetric(font, 'xHeight', 900)).toBe(790);
		expect(clampFontMetric(font, 'xHeight', 0)).toBe(1);
		expect(clampFontMetric(font, 'xHeight', -50)).toBe(1);
	});

	it('capHeight stays between xHeight and ascent', () => {
		expect(clampFontMetric(font, 'capHeight', 10)).toBe(580);
		expect(clampFontMetric(font, 'capHeight', 5000)).toBe(800);
		expect(clampFontMetric(font, 'capHeight', 700)).toBe(700);
	});

	it('ascent never drops below capHeight', () => {
		expect(clampFontMetric(font, 'ascent', 100)).toBe(790);
		expect(clampFontMetric(font, 'ascent', 790)).toBe(790);
	});

	it('descent stays below zero', () => {
		expect(clampFontMetric(font, 'descent', 50)).toBe(-1);
		expect(clampFontMetric(font, 'descent', 0)).toBe(-1);
		expect(clampFontMetric(font, 'descent', -300)).toBe(-300);
	});

	it('upm positive, overshoot non-negative, lineGap free', () => {
		expect(clampFontMetric(font, 'upm', 0)).toBe(1);
		expect(clampFontMetric(font, 'upm', 2048)).toBe(2048);
		expect(clampFontMetric(font, 'overshoot', -5)).toBe(0);
		expect(clampFontMetric(font, 'lineGap', -40)).toBe(-40);
	});

	it('returns the current value for non-numbers', () => {
		expect(clampFontMetric(font, 'ascent', 'nope')).toBe(800);
		expect(clampFontMetric(font, 'xHeight', undefined)).toBe(580);
	});
});

describe('baseline drag arithmetic (D-009)', () => {
	it('clamps the delta so the shifted lines stay in order', () => {
		// up: xHeight - delta >= 1  ->  delta <= 579
		expect(clampBaselineDelta(font, 5000)).toBe(579);
		// down: descent - delta <= -1  ->  delta >= -199
		expect(clampBaselineDelta(font, -5000)).toBe(-199);
		expect(clampBaselineDelta(font, 40)).toBe(40);
		expect(clampBaselineDelta(font, 'x')).toBe(0);
	});

	it('shifts every metric line by -delta so they stay on the drawing', () => {
		expect(BASELINE_SHIFTED_KEYS).toEqual(['ascent', 'capHeight', 'xHeight', 'descent']);
		expect(shiftedMetricsForBaseline(font, 50)).toEqual({
			ascent: 750,
			capHeight: 740,
			xHeight: 530,
			descent: -250,
		});
		expect(shiftedMetricsForBaseline(font, -100)).toEqual({
			ascent: 900,
			capHeight: 890,
			xHeight: 680,
			descent: -100,
		});
	});

	it('shifted values obey the clamp at the limits', () => {
		const up = shiftedMetricsForBaseline(font, clampBaselineDelta(font, 5000));
		expect(up.xHeight).toBe(1);
		const down = shiftedMetricsForBaseline(font, clampBaselineDelta(font, -5000));
		expect(down.descent).toBe(-1);
	});
});
