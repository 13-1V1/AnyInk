// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 integration: Ctrl+E makes the font file the same way the File menu does, so it
	shows the same toast: where the file went, then the letters that need fixing.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventHandlerData } from '../../../edit_canvas/events.js';
import { handleKeyPress, handleKeyUp } from '../../../edit_canvas/events_keyboard.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi, toastText } from '../../files/tests/fakes.js';
import { kvClear } from '../../storage/kv.js';
import { edgeProjectJSON, openProject, square } from './fixtures.js';

// jsdom has no Web Animations API; upstream's toast close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

function key(type, value) {
	const event = new KeyboardEvent(type, { key: value, bubbles: true, cancelable: true });
	if (type === 'keydown') handleKeyPress(event);
	else handleKeyUp(event);
}

async function waitFor(check, ms = 8000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (check()) return true;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return false;
}

let warn;
beforeEach(async () => {
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
	key('keyup', 'Control');
	eventHandlerData.isCtrlDown = false;
	resetFileApi();
	clearDialogs();
	warn.mockRestore();
});

describe('Ctrl+E export', () => {
	it('makes the font file, then names the letter the font file cannot hold', async () => {
		const json = edgeProjectJSON();
		json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] };
		openProject(json);
		const api = fakeApi({});
		setFileApi(api);

		key('keydown', 'Control');
		key('keydown', 'e');

		expect(
			await waitFor(() => api.calls.download.length > 0 && toastText().includes('small a'))
		).toBe(true);
		const sentence = document.querySelector('#toast .anyink-export-check__text').textContent;
		expect(sentence).toBe('Downloading CheckEdge-Regular.otf, but small a needs fixing.');
	}, 15000);
});
