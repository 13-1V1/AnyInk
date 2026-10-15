// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 wiring (UX-BEGINNER.md 6.2, 6.3, section 10 B5 "Stubs: with every feature flag off, Simple is
// today's Characters page minus the hidden controls"): the real screens, read the way
// controls_probe.js reads them, in Simple with no flag. The panel chooser and the panels are
// gone; the page chooser stays with Simple's four pages until B6's rail (fix track); the tools,
// view tools, menus, actions, settings rows and keys are 6.2's "Kept in Simple" list. A page Simple hides still opens (the landing rule): it draws with More
// tools' controls, and the next page Simple shows brings Simple back.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getMode, setModeForTests } from '../mode.js';
import { resetFeaturesForTests } from '../features.js';
import { probeControls } from './controls_probe.js';
import { noFlags } from './no_flags.js';
import today from './today_controls.json';

/** One probe for the whole file (the vitest setup puts 'all' back before each test). */
let simple;
let modeAfter;
beforeAll(() => {
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	setModeForTests('simple');
	noFlags(); // B6 + B7 turned 'coach' and 'letterView' on; this file pins B5's stub
	simple = probeControls();
	modeAfter = getMode();
	setModeForTests('all');
	resetFeaturesForTests();
	warn.mockRestore();
	error.mockRestore();
});
afterAll(() => {
	document.body.innerHTML = '';
});

describe('Simple with no flag: the top bar and its menus (6.2 Menus)', () => {
	it('File and Help; no Projects menu', () => {
		expect(simple.topMenus).toEqual(['File', 'Help']);
		expect(simple.projectsMenu).toBeNull();
		expect(simple.helpMenu).toEqual(today.helpMenu);
	});

	// B4 + B5 finalize: the folder row stays until Use in Word (B14) holds it
	it('File: Save, Save as, Open a saved font, the .otf font file and its folder; no TTF, WOFF, WOFF2 or SVG', () => {
		expect(simple.fileMenu.fileSystem).toEqual([
			'heading',
			'save',
			'save-as',
			'open-font',
			'hr',
			'heading',
			'font-otf',
			'font-folder',
		]);
		expect(simple.fileMenu.download).toEqual(['heading', 'save', 'hr', 'heading', 'font-otf']);
	});
});

describe("Simple with no flag: the letter page (today's Characters page, 6.2)", () => {
	it("Simple's page chooser, no panel chooser, no panel; the letter button stays", () => {
		const page = simple.pages.Characters;
		expect(page.nav).toEqual(['l1', 'l2']);
		expect(page.pageChooser).toEqual(['All letters', 'One letter', 'Help', 'About ANY-INK']);
		expect(page.panelChooser).toBeUndefined();
		expect(page.panel).toBe(false);
		expect(page.panelActions).toEqual([]);
	});

	// B4 + B5 integration: Simple's tooltips say the house words (mode/simple_labels.js)
	it('tools: Select, Edit points, Point pen, Rectangle, Oval; no Add a point', () => {
		expect(today.pages.Characters.tools.filter((title) => title !== 'Add path point')).toEqual([
			'New rectangle',
			'New oval',
			'New path',
			'Path edit',
			'Resize',
		]);
		expect(simple.pages.Characters.tools).toEqual([
			'Rectangle (R)',
			'Oval (O)',
			'Point pen (P)',
			'Edit points (E)',
			'Select (V)',
		]);
	});

	it('view tools: zoom and Fit letter, the two switches; no Pan button, Actual size or pop-out', () => {
		expect(simple.pages.Characters.viewTools).toEqual([
			'Zoom out',
			'Zoom level',
			'Zoom in',
			'Outline only',
			'Dark paper',
			'Fit letter',
		]);
	});

	it('Overview, Help and About keep their pages, with the page chooser (no dead end, 7.1)', () => {
		['Overview', 'Help', 'About'].forEach((page) => {
			expect(simple.pages[page].page, page).toBe(page);
			expect(simple.pages[page].nav, page).toEqual(['l1']);
			expect(simple.pages[page].pageChooser, page).toEqual(
				simple.pages.Characters.pageChooser
			);
		});
	});
});

describe('Simple: a page it hides still opens, with More tools on for the visit (6.3)', () => {
	it.each(['Ligatures', 'Components', 'Kerning', 'Live preview', 'Global actions', 'Settings'])(
		'%s draws exactly as in All tools',
		(page) => {
			expect(simple.pages[page]).toEqual(today.pages[page]);
		}
	);

	it('the next page Simple shows brings Simple back', () => {
		expect(modeAfter).toBe('simple');
		expect(simple.pages.Help.pageChooser).toEqual([
			'All letters',
			'One letter',
			'Help',
			'About ANY-INK',
		]);
	});
});

describe('Simple with no flag: getActionData (6.2 Attribute icons)', () => {
	it('keeps Undo, Redo, the two letter flips and Merge; nothing else', () => {
		const shown = Object.values(simple.actions.Characters).flat();
		expect(shown).toEqual([
			'allActions.undo',
			'allActions.redo',
			'glyphActions.flipHorizontal',
			'glyphActions.flipVertical',
			'boolActions.combine_unite',
		]);
		expect(Object.values(simple.actions.Components).flat()).toEqual(shown);
	});
});

describe('Simple with no flag: settings rows (6.2 Settings)', () => {
	it('font name, your name and copyright; headings only over them', () => {
		expect(simple.settings.font).toEqual(['Font family', 'h2: Links', 'Designer', 'Copyright']);
	});

	it('the letter sets stay (Numbers & symbols lives there); every other project row goes', () => {
		expect(simple.settings.project).toEqual(
			today.settings.project.filter((row) => !today.settings.project.slice(0, 6).includes(row))
		);
		expect(simple.settings.project[0]).toBe('h2: Character ranges');
	});

	it('the App tab has nothing', () => {
		expect(simple.settings.app).toEqual([]);
	});
});

describe('Simple with no flag: keys (7.6)', () => {
	it('tool keys as in All tools, except U (Add a point is More tools only) and B (the Brush, B8)', () => {
		expect(simple.toolKeys).toEqual({
			...today.toolKeys,
			p: 'newPath',
			e: 'pathEdit',
			u: null,
			b: null,
		});
	});

	it('Ctrl+Space does not hide the UI', () => {
		expect(simple.hideUI).toBe(false);
	});
});
