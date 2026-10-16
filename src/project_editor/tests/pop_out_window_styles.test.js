// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16: the Live Preview pop-out gets every stylesheet whole. Parsing CSS as HTML (innerHTML)
// cut tokens.css at the '<dialog>' in a comment, so the pop-out had no paper colour and drew
// dark letters on a near-black page.
import { afterEach, describe, expect, it, vi } from 'vitest';

// Vitest hands '?inline' CSS over as '', so the three stylesheets come from disk here. The
// setup file already loaded the app, so the test loads it again after resetModules.
const cssText = vi.hoisted(() => (relative) => {
	// eslint-disable-next-line no-undef
	const fs = require('node:fs');
	// eslint-disable-next-line no-undef
	const path = require('node:path');
	// eslint-disable-next-line no-undef
	return fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
});
vi.mock('../../anyink/theme/tokens.css?inline', () => ({
	default: cssText('../../anyink/theme/tokens.css'),
}));
vi.mock('../../common/resets.css?inline', () => ({
	default: cssText('../../common/resets.css'),
}));
vi.mock('../../controls/dialogs/dialogs.css?inline', () => ({
	default: cssText('../../controls/dialogs/dialogs.css'),
}));

function fakePopOutWindow() {
	const doc = document.implementation.createHTMLDocument('pop-out');
	return {
		document: doc,
		customElements: { define: () => {} },
		addEventListener: () => {},
		close: () => {},
	};
}

describe('Live Preview pop-out stylesheets', () => {
	afterEach(() => vi.restoreAllMocks());

	it('carries each stylesheet as its full text, tag-like words in comments included', async () => {
		vi.resetModules();
		const { setCurrentProjectEditor } = await import('../../app/main.js');
		const { openPopOutWindow } = await import('../pop_out_window.js');
		const { ProjectEditor } = await import('../project_editor.js');
		const editor = new ProjectEditor();
		setCurrentProjectEditor(editor);
		const popWindow = fakePopOutWindow();
		vi.spyOn(window, 'open').mockReturnValue(/** @type {any} */ (popWindow));

		openPopOutWindow();

		const styles = [...popWindow.document.head.querySelectorAll('style')].map(
			(style) => style.textContent
		);
		const tokens = cssText('../../anyink/theme/tokens.css');
		const resets = cssText('../../common/resets.css');
		const dialogs = cssText('../../controls/dialogs/dialogs.css');

		// The three files that hold a tag-like word in a comment, each arrives whole.
		expect(tokens).toMatch(/<dialog>/);
		expect(styles).toContain(tokens);
		expect(styles).toContain(resets);
		expect(styles).toContain(dialogs);
		expect(styles.join('\n')).toContain(":root[data-canvas='light']");
		// Nothing in the head was made out of CSS text.
		expect(popWindow.document.head.querySelector('dialog, button')).toBeNull();
	});
});
