// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it, vi } from 'vitest';
import { publish, subscribe, unsubscribe } from '../../../project_editor/pub_sub.js';
import {
	FONT_ID,
	FONT_REBUILD_TOPICS,
	REDRAW_ID,
	REDRAW_TOPICS,
	makeEditorTracker,
	subscribeStrip,
} from '../subscriptions.js';

/** The smallest object upstream's pub/sub functions can run against. */
function fakeEditor() {
	const editor = {
		subscribers: {},
		selectedItem: undefined,
		multiSelect: {
			shapes: { clear() {}, length: 0, singleton: false },
			points: { clear() {}, singleton: false },
		},
	};
	editor.publish = publish;
	editor.subscribe = subscribe;
	editor.unsubscribe = unsubscribe;
	return editor;
}

describe('subscriber ids', () => {
	it('are anyink.previewStrip.* and neither is a substring of the other', () => {
		expect(REDRAW_ID.startsWith('anyink.previewStrip.')).toBe(true);
		expect(FONT_ID.startsWith('anyink.previewStrip.')).toBe(true);
		expect(REDRAW_ID.includes(FONT_ID)).toBe(false);
		expect(FONT_ID.includes(REDRAW_ID)).toBe(false);
	});

	it('font rebuild topics are a subset of the redraw topics', () => {
		FONT_REBUILD_TOPICS.forEach((topic) => expect(REDRAW_TOPICS).toContain(topic));
		expect(REDRAW_TOPICS).toEqual(
			expect.arrayContaining([
				'currentItem',
				'currentKernGroup',
				'kernPairs',
				'fontMetrics',
				'guides',
				'previewOptions',
				'whichGlyphIsSelected',
			])
		);
	});
});

describe('subscribeStrip with upstream pub/sub', () => {
	it('redraws on narrow topics and rebuilds the font only on font topics', () => {
		const editor = fakeEditor();
		const onRedraw = vi.fn();
		const onFontChange = vi.fn();
		subscribeStrip(editor, { onRedraw, onFontChange });

		editor.publish('previewOptions', { text: 'abc' });
		expect(onRedraw).toHaveBeenCalledTimes(1);
		expect(onFontChange).not.toHaveBeenCalled();

		editor.publish('guides', {});
		editor.publish('whichGlyphIsSelected', 'glyph-0x41');
		expect(onRedraw).toHaveBeenCalledTimes(3);
		expect(onFontChange).not.toHaveBeenCalled();

		editor.publish('fontMetrics', { xHeight: 500 });
		editor.publish('kernPairs', {});
		expect(onRedraw).toHaveBeenCalledTimes(5);
		expect(onFontChange).toHaveBeenCalledTimes(2);
	});

	it('unsubscribes both ids and nothing else', () => {
		const editor = fakeEditor();
		const other = vi.fn();
		editor.subscribe({ topic: 'fontMetrics', subscriberID: 'anyink.metrics.readout', callback: other });
		const onRedraw = vi.fn();
		const unsubscribeAll = subscribeStrip(editor, { onRedraw, onFontChange: vi.fn() });

		unsubscribeAll();
		editor.publish('fontMetrics', {});
		expect(onRedraw).not.toHaveBeenCalled();
		expect(other).toHaveBeenCalledTimes(1);
		expect(editor.subscribers.fontMetrics[REDRAW_ID]).toBeUndefined();
		expect(editor.subscribers.fontMetrics[FONT_ID]).toBeUndefined();
	});

	it('is a no-op without an editor', () => {
		expect(() => subscribeStrip(null, { onRedraw: vi.fn(), onFontChange: vi.fn() })()).not.toThrow();
	});
});

describe('makeEditorTracker', () => {
	it('moves the subscription when the current editor changes', () => {
		const first = fakeEditor();
		const second = fakeEditor();
		const onRedraw = vi.fn();
		const tracker = makeEditorTracker({ onRedraw, onFontChange: vi.fn() });

		expect(tracker.sync(first)).toBe(true);
		expect(tracker.sync(first)).toBe(false); // same editor: nothing to do
		expect(tracker.current()).toBe(first);
		first.publish('previewOptions', {});
		expect(onRedraw).toHaveBeenCalledTimes(1);

		expect(tracker.sync(second)).toBe(true);
		first.publish('previewOptions', {});
		expect(onRedraw).toHaveBeenCalledTimes(1); // the old editor no longer reaches us
		second.publish('previewOptions', {});
		expect(onRedraw).toHaveBeenCalledTimes(2);

		tracker.detach();
		second.publish('previewOptions', {});
		expect(onRedraw).toHaveBeenCalledTimes(2);
		expect(tracker.current()).toBe(null);
	});

	it('ignores a missing editor', () => {
		const tracker = makeEditorTracker({ onRedraw: vi.fn(), onFontChange: vi.fn() });
		expect(tracker.sync(undefined)).toBe(false);
		expect(tracker.current()).toBe(null);
	});
});
