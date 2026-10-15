// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md section 10 B5 "with no flag the visible controls equal today's"): All
// tools, with no feature flag, shows exactly what it showed before B5 wired the Simple filters
// into the screens. today_controls.json was written by this file (ANYINK_WRITE_TODAY=1) from the
// code before the wiring, through the real screens (controls_probe.js). The only differences
// allowed are the ones 7.6 makes in both modes, listed in KEY_CHANGES.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMode } from '../mode.js';
import { probeControls } from './controls_probe.js';
import today from './today_controls.json';

const here = dirname(fileURLToPath(import.meta.url));

/** 7.6, both modes: P picks the Point pen and E picks Edit points (upstream: Edit points, Add a point) */
const KEY_CHANGES = { p: 'newPath', e: 'pathEdit' };

let warn;
let error;
beforeEach(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	error = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
	error.mockRestore();
	document.body.innerHTML = '';
});

describe("All tools with no flag shows today's controls", () => {
	it('every area, read off the real screens, matches the snapshot taken before the wiring', () => {
		expect(getMode()).toBe('all');
		const now = probeControls();
		if (process.env.ANYINK_WRITE_TODAY === '1') {
			writeFileSync(join(here, 'today_controls.json'), `${JSON.stringify(now, null, '\t')}\n`);
			return;
		}
		const { toolKeys, ...rest } = now;
		const { toolKeys: todayKeys, ...todayRest } = today;
		expect(rest).toEqual(todayRest);
		expect(toolKeys).toEqual({ ...todayKeys, ...KEY_CHANGES });
	});

	it('the snapshot is not empty: it holds the controls 6.2 talks about', () => {
		expect(today.topMenus).toEqual(['File', 'Projects', 'Help']);
		expect(today.pages.Characters.nav).toEqual(['l1', 'l2', 'l3']);
		expect(today.pages.Characters.panelChooser).toHaveLength(9);
		expect(today.pages.Characters.tools).toHaveLength(6);
		expect(today.pages.Characters.pageChooser.length).toBeGreaterThan(10);
		expect(today.fileMenu.fileSystem).toContain('font-svg');
		expect(today.settings.font.length).toBeGreaterThan(30);
		expect(today.toolKeys).toMatchObject({ p: 'pathEdit', e: 'pathAddPoint', u: 'pathAddPoint' });
		expect(today.hideUI).toBe(true);
	});
});
