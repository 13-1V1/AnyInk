// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 6.2, 6.3): the visibility tables list today's controls by the ids the code
// itself uses (page names, panel ids, getActionData icons, tool names, data-anyink-row ids,
// settings properties). This reads them from the real code, so a control an upstream merge adds
// (or renames) fails here until the table says whether Simple shows it, instead of slipping into
// Simple unseen. visibility.js answers "not shown" in Simple for an id it doesn't know.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActionData } from '../../../panels/actions.js';
import { Navigator, panelForPage } from '../../../project_editor/navigator.js';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { DisplayCanvas } from '../../../display_canvas/display_canvas.js';
import { PreviewStrip } from '../../preview/preview_strip.js';
import { actionId, entryOf, todayIds } from '../visibility.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../..');
const source = (file) => readFileSync(join(SRC, file), 'utf8');
const sorted = (list) => [...list].sort();

let warn;
beforeEach(() => {
	document.body.innerHTML = '';
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe("today's controls, read from the code", () => {
	it("pages: the navigator's table of contents (subtitles are headings, not pages)", () => {
		const toc = new Navigator().tableOfContents;
		const pages = Object.keys(toc).filter((name) => toc[name].type !== 'subtitle');
		expect(todayIds('page')).toEqual(pages);
	});

	it('panels: the ones the Characters page offers, and no other', () => {
		const panels = todayIds('panel');
		panels.forEach((id) => expect(panelForPage('Characters', id), id).toBe(id));
		// the probe works: a panel the page doesn't offer falls back to Attributes
		expect(panelForPage('Characters', 'NotAPanel')).toBe('Attributes');
		const block = source('project_editor/navigator.js').match(/Characters:\s*\[([^\]]*)\]/)[1];
		const offered = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
		expect(panels).toEqual(offered);
	});

	it('drawing tools: makeEditToolsButtons, plus the Kerning tool', () => {
		const block = source('edit_canvas/tools/tools.js').match(
			/toolButtonData = \{([\s\S]*?)\n\t\};/
		)[1];
		const tools = [...block.matchAll(/\n\t\t(\w+): \{/g)].map((m) => m[1]);
		// B8 + B9 integration: the Brush (B8) is listed first; the column puts it after New path
		// S2: the sketch tools (Simple only, flag 'sketch') follow the Brush
		expect(tools).toEqual([
			'nib',
			'sketchLine',
			'sketchArc',
			'sketchSpline',
			'sketchCircle',
			'sketchRectangle',
			'newRectangle',
			'newOval',
			'newPath',
			'pathAddPoint',
			'pathEdit',
			'resize',
		]);
		expect(source('edit_canvas/tools/tools.js')).toMatch(/selectTool\('kern'\)/);
		// the snapshot of today's controls was taken before B8: the Brush is the one tool it lacks
		expect(sorted(todayIds('tool'))).toEqual(
			sorted([...tools.filter((tool) => tool !== 'nib' && !tool.startsWith('sketch')), 'kern'])
		);
	});

	it('view tools: makeViewToolsButtons, its zoom slider and the live preview pop-out', () => {
		const text = source('edit_canvas/tools/tools.js');
		const block = text.match(/viewButtonTitles = \{([^}]*)\}/)[1];
		const buttons = [...block.matchAll(/\n\t\t(\w+): '/g)].map((m) => m[1]);
		expect(buttons).toEqual([
			'displayMode',
			'canvasTheme',
			'pan',
			'zoom1to1',
			'zoomEm',
			'zoomIn',
			'zoomOut',
		]);
		expect(text).toMatch(/className: 'editor-page__zoom-slider'/);
		expect(text).toMatch(/id: 'editor-page__tool__open-live-preview-pop-out'/);
		expect(sorted(todayIds('viewTool'))).toEqual(
			sorted([...buttons, 'zoomSlider', 'livePreviewPopOut'])
		);
	});

	it('actions: every getActionData group, by the ids the table uses', () => {
		const groups = [
			'allActions',
			'addShapeActions',
			'glyphActions',
			'shapeActions',
			'componentInstanceActions',
			'kernGroupActions',
			'otherKernGroupActions',
			'layerActions',
			'alignShapeActions',
			'alignPointActions',
			'boolActions',
			'pointActions',
		];
		const editor = twoLetterEditor();
		const ids = new Set();
		// the Components page adds its "Link to Glyph" icon to allActions
		['Characters', 'Components'].forEach((page) => {
			editor.nav.page = page;
			groups.forEach((group) =>
				getActionData(group).forEach((entry) => ids.add(actionId(group, entry)))
			);
		});
		expect(sorted(todayIds('action'))).toEqual(sorted(ids));
		// and the table names no group getActionData doesn't have
		todayIds('action').forEach((id) => expect(groups, id).toContain(id.split('.')[0]));
	});

	it('File menu rows: their data-anyink-row ids (B4), with the three headings', () => {
		const text = source('app/menu.js');
		const rows = new Set([
			...[...text.matchAll(/rowHTML\(\s*'([\w-]+)'/g)].map((m) => `file.${m[1]}`),
			...[...text.matchAll(/fontFileRow\('(\w+)'/g)].map((m) => `file.font-${m[1]}`),
		]);
		const file = todayIds('menuRow').filter((id) => id.startsWith('file.'));
		// fix track: Simple's one row All tools lacks (Open a saved font, until B6's Menu)
		const simpleRows = ['file.open-font'];
		simpleRows.forEach((id) => expect(entryOf('menuRow', id)).toMatchObject({ all: false }));
		expect(sorted([...file.filter((id) => !id.startsWith('file.heading-')), ...simpleRows])).toEqual(
			sorted(rows)
		);
		expect(file.filter((id) => id.startsWith('file.heading-'))).toEqual([
			'file.heading-work-file',
			'file.heading-font-file',
			'file.heading-svg',
		]);
	});

	it('menus: File, Projects and Help, and the rows of the last two', () => {
		const text = source('app/menu.js');
		expect([...text.matchAll(/makeMenu\('(\w+)'\)/g)].map((m) => m[1].toLowerCase())).toEqual(
			todayIds('menu')
		);
		expect(text).toMatch(/makeProjectPreviewRow\(0\)/);
		expect(text).toMatch(/makeProjectPreviewRow\(1\)/);
		expect(text).toMatch(/name: 'Cross-project actions'/);
		expect(text).toMatch(/name: 'Open a separate project in a new window'/);
		expect(text).toMatch(/name: 'In-app help'/);
		expect(text).toMatch(/name: 'About ANY-INK'/);
		expect(todayIds('menuRow').filter((id) => !id.startsWith('file.'))).toEqual([
			'projects.preview-0',
			'projects.preview-1',
			'projects.cross-project-actions',
			'projects.new-window',
			'help.help-page',
			'help.about',
		]);
	});

	it('settings rows: every makeOneSettingsRow on the three tabs, plus their custom rows', () => {
		const rows = ['settings_project.js', 'settings_font.js', 'settings_app.js'].flatMap((file) =>
			[...source(`pages/${file}`).matchAll(/makeOneSettingsRow\('(\w+)', '(\w+)'/g)].map(
				(m) => `${m[1]}.${m[2]}`
			)
		);
		const custom = ['project.characterRanges', 'font.panose', 'app.forgetSnapshots'];
		expect(source('pages/settings_project.js')).toMatch(/Enabled character ranges/);
		expect(source('pages/settings_font.js')).toMatch(/makePanoseRow\(\)/);
		expect(source('pages/settings_app.js')).toMatch(/Forget crash-recovery snapshots/);
		expect(sorted(todayIds('setting'))).toEqual(sorted([...rows, ...custom]));
	});

	describe('preview strip', () => {
		beforeAll(() => {
			if (!Element.prototype.animate) Element.prototype.animate = () => ({});
			if (!customElements.get('preview-strip'))
				customElements.define('preview-strip', PreviewStrip);
			if (!customElements.get('display-canvas'))
				customElements.define('display-canvas', DisplayCanvas);
		});

		it('its controls: label, text, Samples, size, the two switches and the check line', () => {
			const strip = new PreviewStrip();
			strip.build();
			const toggles = strip.querySelectorAll('.preview-strip__toggle');
			const found = {
				title: strip.querySelector('.preview-strip__eyebrow'),
				text: strip.querySelector('.preview-strip__text'),
				samples: strip.querySelector('.preview-strip__presets'),
				size: strip.querySelector('.points-slider'),
				realFont: toggles[0],
				guideLines: toggles[1],
				checkLine: strip.querySelector('.preview-strip__check'),
			};
			expect(toggles.length).toBe(2);
			Object.entries(found).forEach(([id, element]) => expect(element, id).toBeTruthy());
			expect(todayIds('strip')).toEqual(Object.keys(found));
		});
	});

	it("start page: open_project.js's four tabs and the Recover banner above them", () => {
		const text = source('app/open_project.js');
		['new', 'load', 'recover', 'examples'].forEach((tab) =>
			expect(text).toMatch(new RegExp(`id: 'tab-content__${tab}'`))
		);
		expect(text).toMatch(/makeRecoverArea\(\{ banner: true \}\)/);
		expect(todayIds('startPage')).toEqual([
			'tab-new',
			'tab-load',
			'tab-recover',
			'tab-examples',
			'recover-banner',
		]);
	});
});
