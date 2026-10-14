// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 integration: the font check (src/anyink/fontcheck) must start when the app boots,
	or the preview strip's "[Show me]" line never appears in the real app.
	B1 fix pass: the leave-site check was only installed when a project was opened through the
	open page (or a Settings change), so a font file dropped on the Load tab (font_import.js)
	or an SVG font never got it: new ink, close the tab, no prompt. The handler decides when
	the page closes, so it is installed once, at start.
*/
import { afterEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.js has already loaded main.js, so start a fresh module graph with the
// check stubbed. main.js and the preview strip use only these two names.
vi.resetModules();
vi.doMock('../../anyink/fontcheck/font_check.js', () => ({
	initFontCheck: vi.fn(),
	getLastFontCheck: () => null,
}));

const { initFontCheck } = await import('../../anyink/fontcheck/font_check.js');
const { getGlyphrStudioApp, glyphrStudioOnLoad } = await import('../main.js');

afterEach(() => {
	vi.restoreAllMocks();
	window.onbeforeunload = null;
});

describe('App boot', () => {
	// One boot per module graph: a second one would define the custom elements twice.
	it('starts the font check once, after the app is set up, and installs the leave-site check', () => {
		vi.spyOn(console, 'info').mockImplementation(() => {});
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = getGlyphrStudioApp();
		const setUp = vi.spyOn(app, 'setUp').mockImplementation(() => {});
		window.onbeforeunload = null;

		glyphrStudioOnLoad();

		expect(error).not.toHaveBeenCalled();
		expect(setUp).toHaveBeenCalledTimes(1);
		expect(initFontCheck).toHaveBeenCalledTimes(1);
		expect(setUp.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(initFontCheck).mock.invocationCallOrder[0]
		);
		// whatever opens a font later (the open page, a dropped font file, an SVG font)
		expect(window.onbeforeunload).toBeTypeOf('function');
	});
});
