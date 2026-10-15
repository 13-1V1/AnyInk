// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Real-browser check helpers (B5 wiring): reach a screen the way each mode can, for the
	*.verify.mjs walkthroughs that run in Simple (?ui=simple). Since B5, Simple draws no page
	chooser, no panel chooser and no panel (UX-BEGINNER.md 6.2). The Bs that give Simple its own
	way there have not landed yet, so these stand in for them, through the editor itself:
	  toOverview(page)       The page chooser, in both modes (the B5 fix track keeps it in Simple
	                         until B6's rail, as "All letters"), found by its row's page id; with no
	                         chooser on screen (B6 on), the editor goes to the Overview, standing in
	                         for B10's "<- All letters".
	  showTracePanel(page)   All tools: the panel chooser, as before. Simple: the real Trace panel,
	                         put in the empty panel slot with nav.panel 'Trace', standing in for
	                         B9's photo card (auto-trace runs only while nav.panel is 'Trace').
	  pressInAllTools(page, group, iconName)   an icon Simple doesn't draw (Delete letter), its
	                         code run in the page's own mode, standing in for B7's Fine-tune row
	  moveGuideLines(page, on)   Simple locks the guide lines (7.6); this opens and closes the
	                         switch B15's Move the guide lines will (mode/locks.js), so the
	                         small-letter line drags and nudges again (the writing line stays locked)
	  nudgeWritingLine(page, step)   the writing line, locked in Simple even then: the step its
	                         arrow key makes (guides_layer.js nudgeLine), for a step that came from
	                         More tools
	Each takes the Playwright page of the dev app (served from src/, so modules are /app/...).
*/

/**
 * @param {import('@playwright/test').Page} page
 * @param {'PAGE' | 'PANEL'} [type] - which chooser
 * @returns {Promise<Boolean>} true when the mode draws that chooser (the page chooser in both
 *   modes until B6, the panel chooser in All tools)
 */
async function choosers(page, type = 'PAGE') {
	return page.locator(`button[data-nav-type="${type}"]`).isVisible();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Number} [settle] - ms to wait after
 */
export async function toOverview(page, settle = 400) {
	if (await choosers(page)) {
		await page.locator('button[data-nav-type="PAGE"]').click();
		// by its page id; a build from before the fix track has no id, and says "Overview"
		await page
			.locator(
				'.nav-dropdown__button[data-anyink-page="Overview"]:visible, ' +
					'.nav-dropdown__button:not([data-anyink-page]):has-text("Overview"):visible'
			)
			.first()
			.click();
	} else {
		await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			editor.nav.page = 'Overview';
			editor.navigate();
		});
	}
	await page.waitForTimeout(settle);
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function showTracePanel(page) {
	if (await choosers(page, 'PANEL')) {
		await page.locator('button[data-nav-type="PANEL"]').click();
		await page.locator('.nav-dropdown__button[data-panel-id="Trace"]:visible').click();
	} else {
		await page.evaluate(async () => {
			const editor = (await import('/app/main.js')).getCurrentProjectEditor();
			const { makePanel_Trace } = await import('/anyink/trace/trace_panel.js');
			editor.nav.panel = 'Trace';
			const slot = document.querySelector('#editor-page__panel');
			slot.innerHTML = '';
			makePanel_Trace().forEach((node) => slot.appendChild(node));
		});
	}
	await page.waitForTimeout(400);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {String} group - a getActionData name ('glyphActions')
 * @param {String} iconName - 'deleteGlyph'
 */
export async function pressInAllTools(page, group, iconName) {
	await page.evaluate(
		async ([groupName, icon]) => {
			const { getActionData } = await import('/panels/actions.js');
			const { getMode, setModeForTests } = await import('/anyink/mode/mode.js');
			const mode = getMode();
			setModeForTests('all');
			const action = getActionData(groupName).find((data) => data.iconName === icon);
			setModeForTests(mode);
			action.onClick();
		},
		[group, iconName]
	);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Boolean} on
 */
export async function moveGuideLines(page, on) {
	await page.evaluate(
		async (open) => (await import('/anyink/mode/locks.js')).setGuideLinesMoving(open),
		on
	);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {Number} step - font units, + is up
 */
export async function nudgeWritingLine(page, step) {
	await page.evaluate(async (units) => {
		const editor = (await import('/app/main.js')).getCurrentProjectEditor();
		const { nudgeLine } = await import('/anyink/metrics/guides_layer.js');
		nudgeLine(editor, { id: 'baseline', kind: 'baseline', orientation: 'h', value: 0 }, units);
	}, step);
}
