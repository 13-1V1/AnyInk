// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B5 (UX-BEGINNER.md 6.2, 6.3, section 10 B5): which pages, choosers, panels, actions, tools, menu
// rows, settings rows, strip controls and start-page parts show per mode, as data with a small
// query API. The screens filter only where they are drawn (the wiring track), never in data or
// navigation. Checked here:
//   - All tools with no flag shows exactly today's controls (All tools looks as it does today);
//   - Simple with no flag shows today's controls minus the ones 6.2 hides: "with every feature flag
//     off, Simple is today's Characters page minus the hidden controls";
//   - each flag adds only its own controls, and a Simple control it replaces goes, in Simple only.
// The hidden lists below are written from the spec's words, apart from the table under test.
import { afterEach, describe, expect, it } from 'vitest';
import {
	flagsOn,
	isKnownFeature,
	resetFeaturesForTests,
	setFeaturesForTests,
} from '../features.js';
import { setModeForTests } from '../mode.js';
import {
	AREAS,
	VISIBILITY,
	actionId,
	entryOf,
	filterShown,
	hiddenIds,
	isShown,
	menuRowId,
	shownIds,
	simpleHome,
	simplePlace,
	todayIds,
} from '../visibility.js';

afterEach(() => {
	setModeForTests('all');
	resetFeaturesForTests();
});

const NO_FLAGS = flagsOn();
const simple = (isOn = NO_FLAGS) => ({ mode: 'simple', isOn });
const all = (isOn = NO_FLAGS) => ({ mode: 'all', isOn });
const minus = (list, gone) => list.filter((id) => !gone.includes(id));

/** Today's settings rows Simple keeps (6.2 "Settings": "Everything except font name, your name,
 * copyright and Numbers & symbols"), shown in Font details. */
const SETTINGS_KEPT = ['font.family', 'font.designer', 'font.copyright', 'project.characterRanges'];

/** What 6.2 hides in Simple, in its words (4.3 and 2.4 where 6.2 points to them). */
const SPEC_HIDDEN = {
	// "Ligatures, Components, Kerning, Live preview, Global actions, Settings, the dead
	// 'Import & export' entry"
	page: [
		'Ligatures',
		'Components',
		'Kerning',
		'Live preview',
		'Global actions',
		'Settings',
		'Import & export',
	],
	// "Panels: Panel chooser and all 9 panels". "Page chooser: Not shown at all" once B6's rail
	// replaces it: until then Simple keeps it (fix track: Help and About were dead ends)
	chooser: ['panel'],
	panel: [
		'Attributes',
		'Layers',
		'Trace',
		'ContextCharacters',
		'Transforms',
		'History',
		'Guides',
		'CharacterInfo',
		'QualityChecks',
	],
	action: [
		// "Attribute icons (16)": "Copy, paste, clear clipboard, add path, add component, get paths,
		// get paths from another project, round, unite (as an icon), delete glyph, export SVG,
		// import SVG"
		'allActions.copy',
		'allActions.paste',
		'allActions.clearClipboard',
		'addShapeActions.addShape.path',
		'addShapeActions.addShape.component',
		'addShapeActions.pastePathsFromAnotherGlyph',
		'addShapeActions.pastePathsFromAnotherProject',
		'glyphActions.round',
		'glyphActions.combine_unite',
		'glyphActions.deleteGlyph',
		'glyphActions.exportGlyphSVG',
		'glyphActions.importGlyphSVG',
		// 2.4 A: components are hidden (the Components page's own icon)
		'allActions.linkToGlyph',
		// a picked shape: 4.3 gives it only Solid / Hole (Delete key deletes, 7.6); copy, round and
		// components are hidden above
		'shapeActions.copy',
		'shapeActions.deleteShape',
		'shapeActions.switchPathComponent',
		'shapeActions.flipHorizontal',
		'shapeActions.flipVertical',
		'shapeActions.round',
		'componentInstanceActions.switchPathComponent',
		'componentInstanceActions.deleteShape',
		// the Kerning page is hidden
		'kernGroupActions.edit',
		'kernGroupActions.delete',
		'otherKernGroupActions.findSingleLetterPair',
		'otherKernGroupActions.deleteSingleLetterPair',
		// "Shapes / points": "layer order arrows"; "boolean ops other than Merge"
		'layerActions.moveLayerUp',
		'layerActions.moveLayerTop',
		'layerActions.moveLayerDown',
		'layerActions.moveLayerBottom',
		'boolActions.combine_divide',
		'boolActions.combine_subtract',
		'boolActions.combine_exclude',
		'boolActions.combine_intersect',
		// 4.3: no aligning on the letter card
		...['left', 'center', 'right', 'top', 'middle', 'bottom'].map(
			(s) => `alignShapeActions.align_shapes.${s}`
		),
		...['left', 'center', 'right', 'top', 'middle', 'bottom'].map(
			(s) => `alignPointActions.align_points.${s}`
		),
		// 4.3 "This point": only [Smooth] [Corner]; "Add a point" is More tools only (2.4 D)
		'pointActions.insertPathPoint',
		'pointActions.deletePathPoint',
		'pointActions.resetPathPoint',
		'pointActions.round',
		'pointActions.mergePathPoints',
		'pointActions.selectPreviousPathPoint',
		'pointActions.selectNextPathPoint',
	],
	// "Tools": "Add a point"; the Kerning tool goes with its page
	tool: ['pathAddPoint', 'kern'],
	// "Pan button; Actual size; live-preview pop-out"
	viewTool: ['pan', 'zoom1to1', 'livePreviewPopOut'],
	// "Menus": "Projects menu; TTF, WOFF, WOFF2, SVG font export; Choose export folder (moved into
	// Use in Word)": until B14's Use in Word holds it, Simple keeps the folder row (B4 + B5
	// finalize: a folder picked once could otherwise never be changed in Simple)
	menu: ['projects'],
	menuRow: [
		'file.font-ttf',
		'file.font-woff',
		'file.font-woff2',
		'file.heading-svg',
		'file.font-svg',
		'projects.preview-0',
		'projects.preview-1',
		'projects.cross-project-actions',
		'projects.new-window',
	],
	setting: null, // everything except SETTINGS_KEPT
	// "Strip": "Real font, Metrics, Presets name, font-check chip" (Presets is renamed Samples, B4;
	// the check line goes when the Next line carries it, B6)
	strip: ['realFont', 'guideLines'],
	// "Start page": moved behind "Other ways to start..." by the start screen (B13), so nothing goes
	// before it exists
	startPage: [],
};

const hiddenFor = (area) =>
	area === 'setting' ? minus(todayIds('setting'), SETTINGS_KEPT) : SPEC_HIDDEN[area];

describe('the tables', () => {
	it('cover the 6.2 areas', () => {
		expect(AREAS).toEqual([
			'page',
			'chooser',
			'panel',
			'action',
			'tool',
			'viewTool',
			'menu',
			'menuRow',
			'setting',
			'strip',
			'startPage',
		]);
		expect(Object.keys(VISIBILITY)).toEqual(AREAS);
	});

	it('every entry is well formed: unique id, both modes said, known flags', () => {
		AREAS.forEach((area) => {
			const ids = VISIBILITY[area].map((entry) => entry.id);
			expect(new Set(ids).size, area).toBe(ids.length);
			VISIBILITY[area].forEach((entry) => {
				const where = `${area} ${entry.id}`;
				expect(Object.isFrozen(entry), where).toBe(true);
				expect(typeof entry.all, where).toBe('boolean');
				expect(typeof entry.simple, where).toBe('boolean');
				expect(entry.all || entry.simple, where).toBe(true);
				[].concat(entry.feature || [], entry.replacedBy || []).forEach((flag) => {
					expect(isKnownFeature(flag), `${where}: ${flag}`).toBe(true);
				});
			});
		});
	});

	it('every control Simple hides says why (the spec line)', () => {
		AREAS.forEach((area) =>
			VISIBILITY[area]
				.filter((entry) => entry.all && (!entry.simple || entry.replacedBy))
				.forEach((entry) => expect(entry.why, `${area} ${entry.id}`).toMatch(/\w/))
		);
	});
});

describe('All tools', () => {
	it("with no flag on shows exactly today's controls (it looks as it does today)", () => {
		AREAS.forEach((area) => {
			expect(shownIds(area, all()), area).toEqual(todayIds(area));
			expect(hiddenIds(area, all()), area).toEqual([]);
		});
	});

	it('a flag that replaces a Simple control never hides anything in All tools', () => {
		const every = flagsOn('coach', 'letterView', 'tryIt', 'startScreen', 'useInWord', 'board');
		AREAS.forEach((area) => {
			const shown = shownIds(area, all(every));
			todayIds(area).forEach((id) => expect(shown, `${area} ${id}`).toContain(id));
		});
	});
});

describe('Simple with every flag off (the B5 stub)', () => {
	it("is today's controls minus what 6.2 hides, area by area", () => {
		AREAS.forEach((area) => {
			const expected = minus(todayIds(area), hiddenFor(area));
			// of today's controls (Simple's one extra row is the next test's)
			const today = new Set(todayIds(area));
			expect(
				shownIds(area, simple()).filter((id) => today.has(id)),
				area
			).toEqual(expected);
			expect(hiddenIds(area, simple()).sort(), area).toEqual([...hiddenFor(area)].sort());
		});
	});

	it("is today's Characters page minus the hidden controls", () => {
		// today's Characters page: its three choosers, the 9 panels it offers, its 6 drawing tools,
		// the view tools under the canvas, the top bar's menus and the strip
		const page = {
			chooser: ['page', 'item', 'panel'],
			panel: SPEC_HIDDEN.panel,
			tool: ['newRectangle', 'newOval', 'newPath', 'pathAddPoint', 'pathEdit', 'resize'],
			viewTool: todayIds('viewTool'),
			menu: ['file', 'projects', 'help'],
			strip: todayIds('strip'),
		};
		const shown = Object.fromEntries(
			Object.entries(page).map(([area, ids]) => [
				area,
				ids.filter((id) => isShown(area, id, simple())),
			])
		);
		expect(shown).toEqual({
			chooser: ['page', 'item'],
			panel: [],
			tool: ['newRectangle', 'newOval', 'newPath', 'pathEdit', 'resize'],
			viewTool: ['zoomOut', 'zoomSlider', 'zoomIn', 'displayMode', 'canvasTheme', 'zoomEm'],
			menu: ['file', 'help'],
			strip: ['title', 'text', 'samples', 'size', 'checkLine'],
		});
	});

	it('keeps Overview (as the board), Characters (as the letter view), Help and About', () => {
		expect(shownIds('page', simple())).toEqual(['Overview', 'Characters', 'Help', 'About']);
	});

	it('keeps of the 16 attribute icons only Undo / Redo and the two flips; Merge stays for picked shapes', () => {
		const kept = shownIds('action', simple());
		expect(kept).toEqual([
			'allActions.undo',
			'allActions.redo',
			'glyphActions.flipHorizontal',
			'glyphActions.flipVertical',
			'boolActions.combine_unite',
		]);
	});

	it('keeps File > Save, Save as and the one font file; Help > help and About', () => {
		expect(shownIds('menuRow', simple())).toEqual([
			'file.heading-work-file',
			'file.save',
			'file.save-as',
			'file.open-font',
			'file.heading-font-file',
			'file.font-otf',
			'file.font-folder',
			'help.help-page',
			'help.about',
		]);
	});

	it("Use in Word (B14) takes the folder row's place", () => {
		expect(isShown('menuRow', 'file.font-folder', { mode: 'simple', isOn: flagsOn('useInWord') })).toBe(
			false
		);
		expect(isShown('menuRow', 'file.font-folder', { mode: 'all', isOn: flagsOn('useInWord') })).toBe(
			true
		);
	});

	it('shows nothing a later B builds', () => {
		AREAS.forEach((area) =>
			VISIBILITY[area]
				.filter((entry) => !entry.all && entry.feature)
				.forEach((entry) =>
					expect(isShown(area, entry.id, simple()), `${area} ${entry.id}`).toBe(false)
				)
		);
	});

	it('its one control All tools lacks: File > Open a saved font (Ctrl+O), until B6', () => {
		const simpleOnly = AREAS.flatMap((area) =>
			VISIBILITY[area]
				.filter((entry) => !entry.all && isShown(area, entry.id, simple()))
				.map((entry) => `${area} ${entry.id}`)
		);
		expect(simpleOnly).toEqual(['menuRow file.open-font']);
	});
});

describe('each flag adds only its own controls', () => {
	const gained = (area, isOn, mode = 'simple') =>
		minus(shownIds(area, { mode, isOn }), shownIds(area, { mode, isOn: NO_FLAGS }));
	const lost = (area, isOn, mode = 'simple') =>
		minus(shownIds(area, { mode, isOn: NO_FLAGS }), shownIds(area, { mode, isOn }));

	it('letterView: the letter card takes the panel slot and its header replaces the item chooser', () => {
		const isOn = flagsOn('letterView');
		expect(gained('panel', isOn)).toEqual(['letterCard']);
		expect(lost('chooser', isOn)).toEqual(['item']);
		expect(gained('panel', isOn, 'all')).toEqual([]);
		expect(lost('chooser', isOn, 'all')).toEqual([]);
	});

	it('brush: the Brush tool, in both modes (one tool-key map, 7.6)', () => {
		expect(gained('tool', flagsOn('brush'))).toEqual(['nib']);
		expect(gained('tool', flagsOn('brush'), 'all')).toEqual(['nib']);
	});

	it('coach: the Simple top bar Menu (4.9) replaces File and Help; the Next line carries the check', () => {
		const isOn = flagsOn('coach');
		expect(gained('menu', isOn)).toEqual(['menu']);
		expect(lost('menu', isOn)).toEqual(['file', 'help']);
		// the rail and "<- All letters" replace the page chooser Simple kept until then
		expect(lost('chooser', isOn)).toEqual(['page']);
		expect(gained('menuRow', isOn)).toEqual([
			'menu.save',
			'menu.save-as',
			'menu.open-font',
			'menu.dark-paper',
			'menu.more-tools',
			'menu.tips-again',
			'menu.install',
			'menu.about',
		]);
		expect(lost('strip', isOn)).toEqual(['checkLine']);
		['menu', 'menuRow', 'strip'].forEach((area) =>
			expect(lost(area, isOn, 'all'), area).toEqual([])
		);
	});

	it('a Menu row of a later B needs the Menu and its own flag', () => {
		expect(gained('menuRow', flagsOn('useInWord'))).toEqual([]);
		expect(gained('menuRow', flagsOn('coach', 'useInWord'))).toContain('menu.make-font-file');
		expect(gained('menuRow', flagsOn('coach', 'startScreen'))).toContain('menu.new-font');
		expect(gained('menuRow', flagsOn('coach', 'fontDetails'))).toEqual(
			expect.arrayContaining(['menu.font-details', 'menu.move-guide-lines'])
		);
		expect(gained('menuRow', flagsOn('coach', 'photo'))).toContain('menu.help-photo');
		expect(gained('menuRow', flagsOn('coach', 'help'))).toEqual(
			expect.arrayContaining([
				'menu.help-how',
				'menu.help-words',
				'menu.help-word',
				'menu.help-keys',
			])
		);
	});

	it('tryIt: Big preview on the strip', () => {
		expect(gained('strip', flagsOn('tryIt'))).toEqual(['bigPreview']);
	});

	it('startScreen: the start screen replaces the four tabs (they move behind "Other ways to start...")', () => {
		const isOn = flagsOn('startScreen');
		expect(gained('startPage', isOn)).toEqual(['startScreen']);
		expect(lost('startPage', isOn)).toEqual(todayIds('startPage'));
		expect(lost('startPage', isOn, 'all')).toEqual([]);
	});

	it('board: no new control here (the board draws the Overview page), but it becomes home', () => {
		AREAS.forEach((area) => expect(gained(area, flagsOn('board')), area).toEqual([]));
		expect(simpleHome(NO_FLAGS)).toBe('Characters');
		expect(simpleHome(flagsOn('board'))).toBe('Overview');
	});
});

describe('queries', () => {
	it('read the real flags and mode by default', () => {
		expect(isShown('panel', 'Attributes')).toBe(true);
		setModeForTests('simple');
		expect(isShown('panel', 'Attributes')).toBe(false);
		expect(isShown('panel', 'letterCard')).toBe(false);
		setFeaturesForTests({ letterView: true });
		expect(isShown('panel', 'letterCard')).toBe(true);
	});

	it('an id the table does not know shows in All tools and not in Simple', () => {
		expect(isShown('action', 'glyphActions.somethingNew', all())).toBe(true);
		expect(isShown('action', 'glyphActions.somethingNew', simple())).toBe(false);
		expect(entryOf('action', 'glyphActions.somethingNew')).toBeUndefined();
	});

	it('an area the table does not know is a mistake', () => {
		expect(() => isShown('panels', 'Attributes', all())).toThrow(/panels/);
		expect(() => shownIds('nope', all())).toThrow(/nope/);
	});

	it('filterShown keeps the order and drops what the mode hides', () => {
		const icons = [
			{ iconName: 'flipHorizontal' },
			{ iconName: 'round' },
			{ iconName: 'flipVertical' },
			{ iconName: 'deleteGlyph' },
		];
		const idOf = (entry) => actionId('glyphActions', entry);
		expect(filterShown('action', icons, idOf, all())).toEqual(icons);
		expect(filterShown('action', icons, idOf, simple())).toEqual([icons[0], icons[2]]);
	});

	it('actionId names an action the way the table does', () => {
		expect(actionId('glyphActions', { iconName: 'round' })).toBe('glyphActions.round');
		// the align icons share one icon name; their option tells them apart
		expect(actionId('alignShapeActions', { iconName: 'align_shapes', iconOptions: 'top' })).toBe(
			'alignShapeActions.align_shapes.top'
		);
		// Add Path and Add Component Instance share 'addShape'; iconOptions true is the component
		expect(actionId('addShapeActions', { iconName: 'addShape', iconOptions: false })).toBe(
			'addShapeActions.addShape.path'
		);
		expect(actionId('addShapeActions', { iconName: 'addShape', iconOptions: true })).toBe(
			'addShapeActions.addShape.component'
		);
		// a state flag (an empty clipboard greys the icon) is not part of the id
		expect(actionId('allActions', { iconName: 'paste', iconOptions: true })).toBe(
			'allActions.paste'
		);
	});

	it("menuRowId joins a menu and a row's data-anyink-row id", () => {
		expect(menuRowId('file', 'font-ttf')).toBe('file.font-ttf');
		expect(entryOf('menuRow', menuRowId('file', 'save'))).toBeDefined();
	});

	it('simplePlace says where Simple moves a kept control once its screen exists', () => {
		['pathEdit', 'newPath', 'newRectangle', 'newOval'].forEach((id) =>
			expect(simplePlace('tool', id), id).toBe('fineTune')
		);
		expect(simplePlace('tool', 'resize')).toBe(null);
		expect(simplePlace('tool', 'nib')).toBe(null);
		expect(simplePlace('viewTool', 'displayMode')).toBe('fineTune');
		expect(simplePlace('viewTool', 'canvasTheme')).toBe('fineTune');
		expect(simplePlace('viewTool', 'zoomEm')).toBe(null);
		SETTINGS_KEPT.forEach((id) => expect(simplePlace('setting', id), id).toBe('fontDetails'));
		expect(simplePlace('action', 'glyphActions.flipHorizontal')).toBe('shapeOptions');
		expect(simplePlace('action', 'boolActions.combine_unite')).toBe('shapeOptions');
		expect(simplePlace('action', 'allActions.undo')).toBe('topBar');
		expect(simplePlace('action', 'glyphActions.round')).toBe(null);
	});
});
