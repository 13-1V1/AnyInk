// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: the font check runs 2 s after the last change to the font and publishes 'fontCheck'
	with { problems }. It follows the current editor, like the preview strip.
*/
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyKernPairsChanged } from '../../kerning/kern_lookup.js';
import { FONT_REBUILD_TOPICS } from '../../preview/subscriptions.js';
import {
	CHANGE_TOPICS,
	FONT_CHECK_DELAY_MS,
	FONT_CHECK_TOPIC,
	SUBSCRIBER_ID,
	getLastFontCheck,
	initFontCheck,
	runFontCheckNow,
	stopFontCheck,
} from '../font_check.js';
import { PROBLEM } from '../validate.js';
import { edgeProjectJSON, openProject, square } from './fixtures.js';

const PAGE_CHANGE = 'anyink-page-change';

/** The edge project with small a broken: ink, no width. */
function openBroken() {
	const json = edgeProjectJSON();
	json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
	return openProject(json);
}

/** Records every 'fontCheck' an editor publishes. */
function listen(editor) {
	const heard = [];
	editor.subscribe({
		topic: FONT_CHECK_TOPIC,
		subscriberID: 'anyink.testFontCheck.listen',
		callback: (payload) => heard.push(payload),
	});
	return heard;
}

let current = null;
let warn;
beforeEach(() => {
	vi.useFakeTimers();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	stopFontCheck();
	vi.useRealTimers();
	warn.mockRestore();
	current = null;
});

describe('the fontCheck topic', () => {
	it('is a known topic, so a "*" subscriber hears it', () => {
		const editor = openBroken();
		editor.subscribe({ topic: '*', subscriberID: 'anyink.testFontCheck.all', callback: () => {} });
		expect(Object.keys(editor.subscribers)).toContain('fontCheck');
		expect(FONT_CHECK_TOPIC).toBe('fontCheck');
	});

	it('listens to the same change topics as the preview strip font', () => {
		expect(CHANGE_TOPICS).toEqual(FONT_REBUILD_TOPICS);
	});

	it('its subscriber id is no substring of another ANY-INK id, and none is a substring of it', () => {
		const root = path.resolve(__dirname, '../../..');
		const ids = new Set();
		const walk = (dir) => {
			fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) return walk(full);
				if (!/\.js$/.test(entry.name) || /[\\/]tests[\\/]/.test(full)) return;
				const text = fs.readFileSync(full, 'utf8');
				for (const match of text.matchAll(/['"`](anyink\.[A-Za-z0-9_.-]+)['"`]/g))
					ids.add(match[1]);
			});
		};
		walk(root);
		ids.delete(SUBSCRIBER_ID);
		expect(ids.size).toBeGreaterThan(3);
		ids.forEach((id) => {
			expect(SUBSCRIBER_ID.includes(id), `${id} is inside ${SUBSCRIBER_ID}`).toBe(false);
			expect(id.includes(SUBSCRIBER_ID), `${SUBSCRIBER_ID} is inside ${id}`).toBe(false);
		});
	});
});

describe('runs 2 s after the last change', () => {
	it('checks the font it was attached to, 2 s after attaching', () => {
		current = openBroken();
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS - 1);
		expect(heard).toHaveLength(0);
		vi.advanceTimersByTime(1);
		expect(heard).toHaveLength(1);
		expect(heard[0].problems.map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x61', PROBLEM.inkNoWidth],
		]);
		expect(getLastFontCheck(current)).toBe(heard[0]);
	});

	it('a burst of changes is one check, 2 s after the last one', () => {
		current = openBroken();
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		heard.length = 0;

		const a = current.project.getItem('glyph-0x61');
		current.publish('currentItem', a);
		vi.advanceTimersByTime(1500);
		a.advanceWidth = 600; // fixed
		current.publish('currentItem', a);
		vi.advanceTimersByTime(1500);
		expect(heard).toHaveLength(0);
		vi.advanceTimersByTime(500);
		expect(heard).toHaveLength(1);
		expect(heard[0].problems).toEqual([]);
	});

	it('a guide line or kern change counts as a change too (the strip font topics)', () => {
		current = openBroken();
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		heard.length = 0;
		current.publish('fontMetrics', current.project.settings.font);
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		current.publish('kernPairs', {});
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		expect(heard).toHaveLength(2);
	});

	it('a kern value typed on the Kerning page is checked 2 s later', () => {
		current = openProject(edgeProjectJSON());
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		heard.length = 0;
		// what the Kerning page's value field does (card_kern_group.js): store, publish, tell
		const group = current.project.kerning['kern-0'];
		group.value = 40000;
		current.publish('currentKernGroup', group);
		notifyKernPairsChanged(current, { groupID: 'kern-0', value: group.value });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		expect(heard).toHaveLength(1);
		expect(heard[0].problems.map((p) => [p.itemId, p.problem])).toEqual([['kern-0', PROBLEM.kern]]);
	});

	it('a page change checks again (whole-font changes made on other pages)', () => {
		current = openBroken();
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		heard.length = 0;
		window.dispatchEvent(new CustomEvent(PAGE_CHANGE, { detail: { page: 'Overview' } }));
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		expect(heard).toHaveLength(1);
	});
});

describe('follows the current editor', () => {
	it('moves to a newly opened font and lets go of the old one', () => {
		const first = openBroken();
		current = first;
		initFontCheck({ getEditor: () => current });
		expect(first.subscribers.currentItem[SUBSCRIBER_ID]).toBeTypeOf('function');

		const second = openProject(edgeProjectJSON());
		const heardSecond = listen(second);
		current = second;
		window.dispatchEvent(new CustomEvent(PAGE_CHANGE, { detail: { page: 'Overview' } }));
		expect(first.subscribers.currentItem[SUBSCRIBER_ID]).toBeUndefined();
		expect(second.subscribers.currentItem[SUBSCRIBER_ID]).toBeTypeOf('function');
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS);
		expect(heardSecond).toEqual([{ problems: [] }]);
	});

	it('stopFontCheck lets go and cancels a waiting check', () => {
		current = openBroken();
		const heard = listen(current);
		initFontCheck({ getEditor: () => current });
		stopFontCheck();
		vi.advanceTimersByTime(FONT_CHECK_DELAY_MS * 2);
		expect(heard).toHaveLength(0);
		expect(current.subscribers.currentItem?.[SUBSCRIBER_ID]).toBeUndefined();
	});

	it('runFontCheckNow checks at once (the test page and the export use it)', () => {
		current = openBroken();
		const heard = listen(current);
		const result = runFontCheckNow(current);
		expect(heard).toEqual([result]);
		expect(result.problems).toHaveLength(1);
	});

	it('a check that throws is logged, never thrown into the editor', () => {
		current = openBroken();
		const heard = listen(current);
		current.project.settings.project.characterRanges = null;
		expect(runFontCheckNow(current)).toBeNull();
		expect(heard).toHaveLength(0);
		expect(warn).toHaveBeenCalled();
	});
});
