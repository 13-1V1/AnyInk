// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 integration: the strings the B4 tracks found still in Glyphr Studio's or the M6 / M14 code's
	own words, now house words (UX-BEGINNER.md 2.2, 2.4 G, 7.7):
	- the empty preview ("Project preview text will be shown here."), drawn in the strip and on
	  the Overview (display_canvas.js), a display point Simple shares: both modes;
	- why [Reload] couldn't get a new version ready (pwa/checkpoint.js, shown as the update
	  notice's sentence): "Recovery could not protect every project" and the rest: both modes;
	- the save status's "what went wrong" (a browser's or the file writer's own sentence, or
	  "Use Save to retry"): Simple says what to press instead; All tools keeps the detail.
*/
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { saveStatusText } from '../../files/save_status.js';
import { setModeForTests } from '../../mode/mode.js';
import { checkpoint, makeSafeReload } from '../../pwa/checkpoint.js';
import { findBanned } from '../banned.js';
import { word } from '../words.js';
import { scanSimpleScreen } from './banned_scan.js';

/** B4 + B5 fix pass: scanned strict (2.4 E and G too). */
const scanStrict = (name, build, options = {}) =>
	scanSimpleScreen(name, build, { strict: true, ...options });

beforeAll(() => {
	if (!customElements.get('display-canvas')) customElements.define('display-canvas', DisplayCanvas);
});
afterEach(() => {
	setModeForTests('all');
	document.body.innerHTML = '';
});

describe('the empty preview', () => {
	scanStrict('says the house words on the canvas', ({ canvas }) => {
		const display = new DisplayCanvas({ text: '', showPlaceholderMessage: true });
		document.body.appendChild(display);
		display.redraw();
		expect(canvas.texts).toContain(word('strip.nothingToShow'));
		expect(canvas.texts.join(' ')).not.toMatch(/Project preview/);
		return null;
	});
});

describe("why Reload couldn't get the new version ready", () => {
	const status = (extra = {}) => ({ started: true, generation: 1, sessions: [], ...extra });

	it('each reason is a words key, with no banned word and no "recovery" or "project"', async () => {
		const reasons = [];
		const catchMessage = async (promise) => {
			try {
				await promise;
			} catch (error) {
				reasons.push(error.message);
			}
		};
		await catchMessage(
			checkpoint({
				getEditors: () => [],
				getStatus: () => status({ started: false }),
				snapshot: async () => true,
			})
		);
		await catchMessage(
			checkpoint({
				getEditors: () => [{ history: { isRestoring: true } }],
				getStatus: () => status(),
				snapshot: async () => true,
			})
		);
		await catchMessage(
			checkpoint({ getEditors: () => [{}], getStatus: () => status(), snapshot: async () => false })
		);
		let generation = 1;
		await catchMessage(
			checkpoint({
				getEditors: () => [],
				getStatus: () => status({ generation: generation++ }),
				snapshot: async () => true,
			})
		);
		await catchMessage(
			makeSafeReload({
				protect: async () => () => false,
				activate: async () => {},
				reload: () => {},
			})()
		);
		expect(reasons).toEqual(
			[
				'notice.backupStarting',
				'notice.undoRunning',
				'notice.backupNotEvery',
				'notice.changedDuringBackup',
				'notice.changedBeforeReload',
			].map((key) => word(key))
		);
		expect(reasons.flatMap((reason) => findBanned(reason))).toEqual([]);
		reasons.forEach((reason) => expect(reason).not.toMatch(/recovery|project/i));
	});
});

describe('the save status after a failed write', () => {
	const failed = { revision: 1, file: 'failed', recovery: 'saved', error: 'NotAllowedError: path' };

	it("Simple says what to press, never the browser's sentence", () => {
		setModeForTests('simple');
		const text = saveStatusText(failed);
		// B4 + B5 fix pass (4.11): one of the four states, no backup copy; what to press is the
		// tooltip (files/tests/save_status_simple.test.js)
		expect(text).toBe(word('status.couldntSave'));
		expect(text).not.toMatch(/NotAllowedError/);
		expect(findBanned(text)).toEqual([]);
	});

	it('All tools keeps the detail', () => {
		expect(saveStatusText(failed)).toContain('NotAllowedError: path');
	});
});
