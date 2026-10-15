// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4 (UX-BEGINNER.md 2.2, 2.4 B): the guide lines and side spaces are named with the house words
// wherever the canvas shows them, in both modes: the drag readouts (LIVE_LABELS, overlay.js
// labelText) and the labels Undo titles and readouts.js use (METRIC_LABELS). The words come from
// src/anyink/words (line.*, space.*, metric.*, canvas.readout); the tail line is never shown
// as a negative number.
import { describe, expect, it } from 'vitest';
import { findBanned } from '../../words/banned.js';
import { historyText } from '../../words/history_text.js';
import { labelCase, word } from '../../words/words.js';
import { LIVE_LABELS, METRIC_LABELS } from '../metrics_math.js';
import { labelText } from '../overlay.js';

const LINES = {
	ascent: 'line.ascent',
	capHeight: 'line.capHeight',
	xHeight: 'line.xHeight',
	baseline: 'line.baseline',
	descent: 'line.descent',
	lsb: 'space.lsb',
	rsb: 'space.rsb',
};

describe('LIVE_LABELS: the drag readouts', () => {
	it('name every line and side space with its house word', () => {
		expect(LIVE_LABELS).toEqual(
			Object.fromEntries(Object.entries(LINES).map(([line, key]) => [line, word(key)]))
		);
		expect(LIVE_LABELS.xHeight).toBe('small-letter line');
		expect(LIVE_LABELS.rsb).toBe('right space');
	});
});

describe('METRIC_LABELS: Undo titles and settings readouts', () => {
	it('start with a capital, in house words', () => {
		Object.entries(LINES).forEach(([line, key]) =>
			expect(METRIC_LABELS[line], line).toBe(labelCase(word(key)))
		);
		expect(METRIC_LABELS.capHeight).toBe('Capitals line');
		expect(METRIC_LABELS.upm).toBe(labelCase(word('metric.gridSize')));
		expect(METRIC_LABELS.lineGap).toBe(labelCase(word('metric.lineGap')));
		expect(METRIC_LABELS.overshoot).toBe(labelCase(word('metric.overshoot')));
	});

	it('say no banned word', () => {
		const said = [...Object.values(METRIC_LABELS), ...Object.values(LIVE_LABELS)];
		expect(
			said.flatMap((label) => findBanned(label).map((hit) => `${hit.match} in ${label}`))
		).toEqual([]);
	});

	it('keep Undo in plain words: a title with the new label reads like one with the old', () => {
		expect(historyText(`Moved ${METRIC_LABELS.xHeight} to 620`)).toBe(
			historyText('Moved X height to 620')
		);
		expect(historyText(`Set ${METRIC_LABELS.descent} to -1`)).toBe(
			historyText('Set Descent to -1')
		);
		expect(historyText(`Set ${METRIC_LABELS.upm} to 1000`)).toBe(historyText('Set UPM to 1000'));
		expect(historyText(`Moved ${METRIC_LABELS.xHeight} to 620`)).not.toBe(word('history.unknown'));
	});
});

describe('labelText: the readout beside the pointer', () => {
	const metric = (key) => ({ kind: 'metric', key, orientation: 'h' });
	const readout = (line, value) => word('canvas.readout', { label: LIVE_LABELS[line], value });

	it('names a guide line and where it is', () => {
		expect(labelText(metric('xHeight'), 1100, null, {})).toBe(readout('xHeight', 1100));
		expect(labelText(metric('xHeight'), 1100, null, {})).toBe('small-letter line 1100');
		expect(labelText(metric('capHeight'), 790, null, {})).toBe('capitals line 790');
		expect(labelText(metric('ascent'), 800, null, {})).toBe('top line 800');
	});

	it('never shows the tail line as a negative number', () => {
		expect(labelText(metric('descent'), -200, null, {})).toBe('tail line 200');
	});

	it('says the writing line, and how far a drag has moved it', () => {
		const line = { kind: 'baseline', orientation: 'h' };
		expect(labelText(line, 0, null, { dragging: false })).toBe('writing line 0');
		expect(labelText(line, 20, null, { dragging: 'baseline', baselineDelta: 20 })).toBe(
			'writing line +20'
		);
		expect(labelText(line, -15, null, { dragging: 'baseline', baselineDelta: -15 })).toBe(
			'writing line -15'
		);
	});

	it('says left space and right space at the side edges', () => {
		const item = { leftSideBearing: 12.345, rightSideBearing: 88 };
		const side = (s) => ({ kind: 'sideBearing', side: s, orientation: 'v' });
		expect(labelText(side('lsb'), 0, item, {})).toBe('left space 12.35');
		expect(labelText(side('rsb'), 0, item, {})).toBe('right space 88');
	});
});
