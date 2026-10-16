// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B5: what each mode shows (UX-BEGINNER.md 6.2), as data tables with a small query API. Screens
	filter only where they are drawn (6.3: the page and panel choosers, getActionData, the tool
	buttons, the menus, the settings rows, the strip), never in data or navigation, so every
	page stays reachable (band.js, the landing rule).

	Each table lists today's controls by the id the code itself uses, then what later Bs add:
	  page       the navigator's page names                     ('Kerning')
	  chooser    the left area's PAGE / EDITING / PANEL buttons ('page', 'item', 'panel')
	  panel      panel ids (navigator.js listOfPanels), plus B7's letter card ('letterCard')
	  action     getActionData icons, actionId(group, entry)    ('glyphActions.round')
	  tool       drawing tools (tools.js), plus the Brush       ('newRectangle', 'nib')
	  viewTool   the buttons under the canvas                   ('zoom1to1')
	  menu       top bar menus, plus B6's Menu (4.9)            ('projects', 'menu')
	  menuRow    menuRowId(menu, data-anyink-row id)            ('file.font-ttf', 'menu.open-font')
	  setting    Settings rows, 'tab.property'                  ('font.capHeight')
	  strip      the preview strip's controls                   ('realFont')
	  startPage  the Open Project page's tabs, plus B13's start screen
	Number fields, photo controls and point and shape cards are all inside panels, which Simple
	hides; B7's letter card brings back only what 4.3 lists.

	An entry: { id, all, simple, feature, replacedBy, place, why }
	  all, simple   shown in that mode (with flags off)
	  feature       the flag (or flags, all needed) that ships it, in whichever modes it shows
	  replacedBy    Simple only: hidden once this flag is on (what replaces it has landed)
	  place         where Simple keeps it once its screen exists: 'fineTune' (B7's closed
	                section), 'shapeOptions' (inside Fine-tune), 'topBar' (B6), 'fontDetails' (B15)
	  why           the spec line, for every control Simple hides or replaces

	  isShown(area, id, { mode, isOn })   an id the table doesn't know shows in All tools (never
	                                      hide upstream's) and not in Simple (never show it unseen;
	                                      mode/tests/inventory.test.js fails first)
	  shownIds / hiddenIds(area, opts)    in table order; hidden = today's controls not shown
	  todayIds(area)                      the controls that exist today (All tools, no flag)
	  entryOf, simplePlace, filterShown(area, list, idOf, opts), actionId, menuRowId
	  simpleHome(isOn)                    Simple's home page: the board once B10 lands, else the
	                                      letter view
	Defaults read the live mode (mode.js) and flags (features.js).
*/
import { isFeatureOn } from './features.js';
import { getMode } from './mode.js';

// --------------------------------------------------------------
// Entry makers
// --------------------------------------------------------------

/** Shown in both modes */
const both = (id, extra = {}) => ({ id, all: true, simple: true, ...extra });
/** Today's control that Simple hides */
const allOnly = (id, why, extra = {}) => ({ id, all: true, simple: false, why, ...extra });
/** A Simple control a later B builds */
const simpleOnly = (id, feature, extra = {}) => ({
	id,
	all: false,
	simple: true,
	feature,
	...extra,
});

const freezeAll = (entries) =>
	Object.freeze(
		entries.map((entry) =>
			Object.freeze({
				feature: null,
				replacedBy: null,
				place: null,
				why: '',
				...entry,
				...(Array.isArray(entry.feature) ? { feature: Object.freeze([...entry.feature]) } : {}),
			})
		)
	);

const WHY = {
	pages: '6.2 Pages: hidden in Simple (More tools only)',
	pageChooser:
		'6.2 Page chooser: the rail and "<- All letters" replace it (B6); until then Simple keeps ' +
		'it, listing its four pages, so Help and About are no dead end (7.1, fix track)',
	panels: '6.2 Panels: the panel chooser and all 9 panels (the letter card instead)',
	icons: '6.2 Attribute icons: hidden',
	components: '2.4 A: reusable parts (components) are hidden',
	shapeCard: '4.3: a picked shape gets only Solid / Hole (Delete key deletes, 7.6)',
	kerning: '6.2 Pages: the Kerning page is hidden (gap fixes live in Try it, B12)',
	layers: '6.2 Shapes / points: layer order arrows',
	booleans: '6.2 Shapes / points: boolean ops other than Merge',
	align: '4.3: no aligning on the letter card',
	points: '4.3 This point: only Smooth / Corner; "Add a point" is More tools only (2.4 D)',
	tools: '6.2 Tools: hidden in Simple',
	menus: '6.2 Menus: hidden in Simple',
	settings: '6.2 Settings: everything except font name, your name, copyright and Numbers & symbols',
	strip: '6.2 Strip: hidden in Simple',
	startPage: '6.2 Start page: behind "Other ways to start..." on the start screen (B13)',
};

const ALIGN_SIDES = ['left', 'center', 'right', 'top', 'middle', 'bottom'];

// --------------------------------------------------------------
// The tables
// --------------------------------------------------------------

const PAGES = [
	both('Overview', { why: '6.2: kept, as the letter board (B10)' }),
	both('Characters', { why: '6.2: kept, as the letter view (B7)' }),
	allOnly('Ligatures', WHY.pages),
	allOnly('Components', WHY.pages),
	allOnly('Kerning', WHY.pages),
	allOnly('Live preview', WHY.pages),
	allOnly('Global actions', WHY.pages),
	allOnly('Settings', `${WHY.pages} (Font details instead, B15)`),
	allOnly(
		'Import & export',
		'6.2: the dead "Import & export" entry (it has no page; the chooser skips it)'
	),
	both('Help'),
	both('About'),
];

const CHOOSERS = [
	both('page', { replacedBy: 'coach', why: WHY.pageChooser }),
	both('item', {
		replacedBy: 'letterView',
		why: '4.3: the letter header ("<- All letters", the name, "< A" / "C >") replaces it',
	}),
	allOnly('panel', WHY.panels),
];

const PANELS = [
	...[
		'Attributes',
		'Layers',
		'Trace',
		'ContextCharacters',
		'Transforms',
		'History',
		'Guides',
		'CharacterInfo',
		'QualityChecks',
	].map((id) => allOnly(id, WHY.panels)),
	simpleOnly('letterCard', 'letterView', {
		why: '4.3: the letter card takes the panel slot; nav.panel stays Attributes or Trace',
	}),
];

const ACTIONS = [
	// the 16 attribute icons (allActions, addShapeActions, glyphActions)
	allOnly('allActions.copy', WHY.icons),
	allOnly('allActions.paste', WHY.icons),
	allOnly('allActions.clearClipboard', WHY.icons),
	both('allActions.undo', {
		place: 'topBar',
		why: '6.2: kept, as the Undo button in the top bar (B6)',
	}),
	both('allActions.redo', {
		place: 'topBar',
		why: '6.2: kept, as the Redo button in the top bar (B6)',
	}),
	allOnly('allActions.linkToGlyph', `${WHY.components} (the Components page's icon)`),
	allOnly('addShapeActions.addShape.path', WHY.icons),
	allOnly('addShapeActions.addShape.component', WHY.icons),
	allOnly('addShapeActions.pastePathsFromAnotherGlyph', WHY.icons),
	allOnly('addShapeActions.pastePathsFromAnotherProject', WHY.icons),
	both('glyphActions.flipHorizontal', {
		place: 'shapeOptions',
		why: '6.2: kept, "Flip left-right" in Shape options',
	}),
	both('glyphActions.flipVertical', {
		place: 'shapeOptions',
		why: '6.2: kept, "Flip upside-down" in Shape options',
	}),
	allOnly('glyphActions.round', `${WHY.icons} (ANY-INK rounds on every write)`),
	allOnly(
		'glyphActions.combine_unite',
		`${WHY.icons}: unite as an icon (Merge stays in Shape options, B7)`
	),
	allOnly('glyphActions.deleteGlyph', WHY.icons),
	allOnly('glyphActions.exportGlyphSVG', WHY.icons),
	allOnly('glyphActions.importGlyphSVG', WHY.icons),
	// a picked shape or component
	allOnly('shapeActions.copy', WHY.shapeCard),
	allOnly('shapeActions.deleteShape', WHY.shapeCard),
	allOnly('shapeActions.switchPathComponent', WHY.components),
	allOnly('shapeActions.flipHorizontal', WHY.shapeCard),
	allOnly('shapeActions.flipVertical', WHY.shapeCard),
	allOnly('shapeActions.round', WHY.shapeCard),
	allOnly('componentInstanceActions.switchPathComponent', WHY.components),
	allOnly('componentInstanceActions.deleteShape', WHY.components),
	// the Kerning page
	allOnly('kernGroupActions.edit', WHY.kerning),
	allOnly('kernGroupActions.delete', WHY.kerning),
	allOnly('otherKernGroupActions.findSingleLetterPair', WHY.kerning),
	allOnly('otherKernGroupActions.deleteSingleLetterPair', WHY.kerning),
	// layer order, booleans, aligning
	allOnly('layerActions.moveLayerUp', WHY.layers),
	allOnly('layerActions.moveLayerTop', WHY.layers),
	allOnly('layerActions.moveLayerDown', WHY.layers),
	allOnly('layerActions.moveLayerBottom', WHY.layers),
	...ALIGN_SIDES.map((side) => allOnly(`alignShapeActions.align_shapes.${side}`, WHY.align)),
	...ALIGN_SIDES.map((side) => allOnly(`alignPointActions.align_points.${side}`, WHY.align)),
	both('boolActions.combine_unite', {
		place: 'shapeOptions',
		why: '6.2: Merge is kept ("Merge overlapping shapes")',
	}),
	allOnly('boolActions.combine_divide', WHY.booleans),
	allOnly('boolActions.combine_subtract', WHY.booleans),
	allOnly('boolActions.combine_exclude', WHY.booleans),
	allOnly('boolActions.combine_intersect', WHY.booleans),
	// a picked point
	allOnly('pointActions.insertPathPoint', WHY.points),
	allOnly('pointActions.deletePathPoint', WHY.points),
	allOnly('pointActions.resetPathPoint', WHY.points),
	allOnly('pointActions.round', WHY.points),
	allOnly('pointActions.mergePathPoints', WHY.points),
	allOnly('pointActions.selectPreviousPathPoint', WHY.points),
	allOnly('pointActions.selectNextPathPoint', WHY.points),
];

const TOOLS = [
	both('nib', {
		feature: 'brush',
		why: '4.3: the Brush, always shown once B8 lands (both modes, 7.6)',
	}),
	both('resize', { why: '4.3: Select, always shown' }),
	both('pathEdit', { place: 'fineTune', why: '4.3: Edit points, inside Fine-tune' }),
	both('newPath', { place: 'fineTune', why: '4.3: Point pen, inside Fine-tune' }),
	both('newRectangle', { place: 'fineTune', why: '4.3: Rectangle, inside Fine-tune' }),
	both('newOval', { place: 'fineTune', why: '4.3: Oval, inside Fine-tune' }),
	allOnly('pathAddPoint', `${WHY.tools}: "Add a point" (More tools only)`),
	allOnly('kern', `${WHY.kerning}: its tool goes with it`),
];

const VIEW_TOOLS = [
	allOnly('pan', `${WHY.tools}: the Pan button (Space-drag still pans)`),
	both('zoomOut'),
	both('zoomSlider'),
	both('zoomIn'),
	// B6 + B7 integration: the letter view's own switches (letter/view_switches.js) replace them
	both('displayMode', {
		place: 'fineTune',
		replacedBy: 'letterView',
		why: '4.3: the "Outline only" switch, inside Fine-tune',
	}),
	both('canvasTheme', {
		place: 'fineTune',
		replacedBy: 'letterView',
		why: '4.3: the "Dark paper" switch, inside Fine-tune',
	}),
	allOnly('zoom1to1', `${WHY.tools}: Actual size`),
	both('zoomEm', { why: '4.3: "Fit letter", always shown' }),
	allOnly('livePreviewPopOut', `${WHY.tools}: the live-preview pop-out`),
];

const MENUS = [
	both('file', { replacedBy: 'coach', why: '4.9: the Simple top bar has one Menu (B6)' }),
	allOnly('projects', `${WHY.menus}: the Projects menu`),
	both('help', { replacedBy: 'coach', why: '4.9: the Simple top bar has one Menu (B6)' }),
	simpleOnly('menu', 'coach', { why: '4.9: Menu' }),
];

const MENU_ROWS = [
	// File (makeFileMenuData; each row's data-anyink-row id, B4)
	both('file.heading-work-file'),
	both('file.save'),
	both('file.save-as'),
	{
		id: 'file.open-font',
		all: false,
		simple: true,
		why:
			'4.9: "Open a saved font... (Ctrl+O)" in the File menu Simple keeps until the B6 Menu ' +
			'(fix track: the Projects menu is hidden, so nothing else on screen opens a font)',
	},
	both('file.heading-font-file'),
	both('file.font-otf', {
		replacedBy: 'useInWord',
		why: '4.9: "Make my font file..." opens Use in Word once B14 lands',
	}),
	allOnly('file.font-ttf', `${WHY.menus}: TTF font export`),
	allOnly('file.font-woff', `${WHY.menus}: WOFF font export`),
	allOnly('file.font-woff2', `${WHY.menus}: WOFF2 font export`),
	both('file.font-folder', {
		replacedBy: 'useInWord',
		why:
			'6.2 Menus: Choose export folder moves into Use in Word (B14); until then Simple keeps ' +
			'it, or a folder picked once could never be changed (B4 + B5 finalize)',
	}),
	allOnly('file.heading-svg', `${WHY.menus}: SVG font export`),
	allOnly('file.font-svg', `${WHY.menus}: SVG font export`),
	// Projects
	allOnly('projects.preview-0', `${WHY.menus}: the Projects menu`),
	allOnly('projects.preview-1', `${WHY.menus}: the Projects menu`),
	allOnly('projects.cross-project-actions', `${WHY.menus}: the Projects menu`),
	allOnly('projects.new-window', `${WHY.menus}: the Projects menu`),
	// Help
	both('help.help-page'),
	both('help.about'),
	// B6's Menu (4.9): each row also needs its own feature
	simpleOnly('menu.save', 'coach'),
	simpleOnly('menu.save-as', 'coach'),
	simpleOnly('menu.open-font', 'coach', { why: '4.9: Open a saved font... (Ctrl+O)' }),
	simpleOnly('menu.new-font', ['coach', 'startScreen'], {
		why: '4.9: Start a new font... (the start screen)',
	}),
	simpleOnly('menu.make-font-file', ['coach', 'useInWord'], {
		why: '4.9: Make my font file... (Ctrl+E)',
	}),
	simpleOnly('menu.font-details', ['coach', 'fontDetails'], { why: '4.9 Font: Font details...' }),
	simpleOnly('menu.move-guide-lines', ['coach', 'fontDetails'], {
		why: '4.9 Font: Move the guide lines...',
	}),
	simpleOnly('menu.dark-paper', 'coach', { why: '4.9 View: Dark paper (switch)' }),
	simpleOnly('menu.more-tools', 'coach', { why: '4.9 View: More tools' }),
	simpleOnly('menu.help-how', ['coach', 'help'], { why: '4.9 Help: How to make a font' }),
	simpleOnly('menu.help-photo', ['coach', 'photo'], {
		why: '4.9 Help: How to photograph your letters',
	}),
	simpleOnly('menu.help-words', ['coach', 'help'], { why: '4.9 Help: What these words mean' }),
	simpleOnly('menu.help-word', ['coach', 'help', 'useInWord'], { why: '4.9 Help: Use your font in Word' }),
	simpleOnly('menu.help-keys', ['coach', 'help'], { why: '4.9 Help: Keyboard keys' }),
	simpleOnly('menu.tips-again', 'coach', { why: '4.9 Help: Show tips again' }),
	simpleOnly('menu.install', 'coach', {
		why: '4.9 Help: Install ANY-INK as an app (only if not installed)',
	}),
	simpleOnly('menu.about', 'coach', { why: '4.9 Help: About ANY-INK' }),
];

/** Kept in Simple, shown in Font details (B15) */
const fontDetails = (id, why) => both(id, { place: 'fontDetails', why });

const SETTINGS = [
	// Settings > Project
	allOnly('project.name', `${WHY.settings} (the font name field writes it too)`),
	...[
		'latestVersion',
		'initialVersion',
		'id',
		'exportComponentsAsComposites',
		'importComponentsFromComposites',
	].map((property) => allOnly(`project.${property}`, WHY.settings)),
	fontDetails(
		'project.characterRanges',
		'6.2: only "Numbers & symbols", as one switch in Font details'
	),
	// Settings > Font
	fontDetails(
		'font.family',
		'6.2: the font name, in Font details (it writes the project name too)'
	),
	...[
		'style',
		'version',
		'description',
		'upm',
		'ascent',
		'descent',
		'capHeight',
		'xHeight',
		'overshoot',
		'lineGap',
	].map((property) => allOnly(`font.${property}`, WHY.settings)),
	...['weight', 'stretch', 'italicAngle', 'underlinePosition', 'underlineThickness'].map(
		(property) => allOnly(`font.${property}`, WHY.settings)
	),
	fontDetails('font.designer', '6.2: your name, in Font details'),
	...['designerURL', 'manufacturer', 'manufacturerURL', 'license', 'licenseURL'].map((property) =>
		allOnly(`font.${property}`, WHY.settings)
	),
	fontDetails('font.copyright', '6.2: copyright, in Font details'),
	...[
		'trademark',
		'panose',
		'variant',
		'stemv',
		'stemh',
		'slope',
		'strikethroughPosition',
		'strikethroughThickness',
		'overlinePosition',
		'overlineThickness',
	].map((property) => allOnly(`font.${property}`, WHY.settings)),
	// Settings > App
	...[
		'stopPageNavigation',
		'forgetSnapshots',
		'unlinkComponentInstances',
		'directlyDragCurves',
		'canvasDisplayModeFilled',
		'showNonCharPoints',
		'itemChooserPageSize',
		'previewText',
		'exportLigatures',
		'exportKerning',
		'exportUneditedItems',
		'moveShapesOnSVGDragDrop',
		'autoSideBearingsOnSVGDragDrop',
		'autoRightBearingOnFirstShape',
		'highlightPointsNearPoints',
		'highlightPointsNearHandles',
		'highlightPointsNearXZero',
		'highlightPointsNearYZero',
	].map((property) => allOnly(`app.${property}`, WHY.settings)),
];

const STRIP = [
	both('title'),
	both('text'),
	both('samples', { why: '6.2: the Presets name is hidden: the button says "Samples" (B4)' }),
	both('size'),
	allOnly('realFont', `${WHY.strip}: Real font`),
	allOnly('guideLines', `${WHY.strip}: Metrics ("Guide lines")`),
	both('checkLine', {
		replacedBy: 'coach',
		why: '6.2 Strip: the font-check chip; in Simple the Next line carries it (rule 6, B6)',
	}),
	simpleOnly('bigPreview', 'tryIt', { why: '4.0: Big preview opens Try it' }),
];

const START_PAGE = [
	...['tab-new', 'tab-load', 'tab-recover', 'tab-examples', 'recover-banner'].map((id) =>
		both(id, { replacedBy: 'startScreen', why: WHY.startPage })
	),
	simpleOnly('startScreen', 'startScreen', { why: '4.1: the start screen' }),
];

/** @type {Readonly<Object<String, ReadonlyArray<Readonly<Object>>>>} */
export const VISIBILITY = Object.freeze({
	page: freezeAll(PAGES),
	chooser: freezeAll(CHOOSERS),
	panel: freezeAll(PANELS),
	action: freezeAll(ACTIONS),
	tool: freezeAll(TOOLS),
	viewTool: freezeAll(VIEW_TOOLS),
	menu: freezeAll(MENUS),
	menuRow: freezeAll(MENU_ROWS),
	setting: freezeAll(SETTINGS),
	strip: freezeAll(STRIP),
	startPage: freezeAll(START_PAGE),
});

/** The areas, in the order 6.2 lists them */
export const AREAS = Object.freeze(Object.keys(VISIBILITY));

const INDEX = Object.fromEntries(
	AREAS.map((area) => [area, new Map(VISIBILITY[area].map((entry) => [entry.id, entry]))])
);

// --------------------------------------------------------------
// Queries
// --------------------------------------------------------------

/**
 * @param {String} area
 * @returns {Map<String, Object>}
 */
function indexOf(area) {
	const index = INDEX[area];
	if (!index) throw new Error(`visibility: no area "${area}" (${AREAS.join(', ')})`);
	return index;
}

/**
 * @param {String} area
 * @param {String} id
 * @returns {Readonly<Object> | undefined}
 */
export function entryOf(area, id) {
	return indexOf(area).get(id);
}

/**
 * @param {Readonly<Object>} entry
 * @param {'all' | 'simple'} mode
 * @param {(name: String) => Boolean} isOn
 * @returns {Boolean}
 */
function entryShown(entry, mode, isOn) {
	if (!(mode === 'simple' ? entry.simple : entry.all)) return false;
	const needs = [].concat(entry.feature || []);
	if (!needs.every((flag) => isOn(flag))) return false;
	if (mode === 'simple' && entry.replacedBy && isOn(entry.replacedBy)) return false;
	return true;
}

/**
 * @param {String} area - one of AREAS
 * @param {String} id
 * @param {Object} [options]
 * @param {'all' | 'simple'} [options.mode] - default: the current mode
 * @param {(name: String) => Boolean} [options.isOn] - default: the app's flags
 * @returns {Boolean}
 */
export function isShown(area, id, { mode = getMode(), isOn = isFeatureOn } = {}) {
	const entry = indexOf(area).get(id);
	if (!entry) return mode !== 'simple';
	return entryShown(entry, mode, isOn);
}

/**
 * @param {String} area
 * @param {Object} [options] - { mode, isOn }, as isShown
 * @returns {Array<String>} ids shown, in table order
 */
export function shownIds(area, options = {}) {
	indexOf(area);
	return VISIBILITY[area]
		.filter((entry) => isShown(area, entry.id, options))
		.map((entry) => entry.id);
}

/**
 * @param {String} area
 * @returns {Array<String>} today's controls: shown in All tools with no flag
 */
export function todayIds(area) {
	indexOf(area);
	return VISIBILITY[area].filter((entry) => entry.all && !entry.feature).map((entry) => entry.id);
}

/**
 * @param {String} area
 * @param {Object} [options] - { mode, isOn }, as isShown
 * @returns {Array<String>} today's controls the mode doesn't show
 */
export function hiddenIds(area, options = {}) {
	return todayIds(area).filter((id) => !isShown(area, id, options));
}

/**
 * @param {String} area
 * @param {String} id
 * @returns {String | null} where Simple keeps it once its screen exists
 */
export function simplePlace(area, id) {
	return entryOf(area, id)?.place || null;
}

/**
 * The filter a screen runs where it draws: keeps the order, drops what the mode hides.
 * @template T
 * @param {String} area
 * @param {Array<T>} list
 * @param {(item: T) => String} idOf
 * @param {Object} [options] - { mode, isOn }, as isShown
 * @returns {Array<T>}
 */
export function filterShown(area, list, idOf, options = {}) {
	indexOf(area);
	return list.filter((item) => isShown(area, idOf(item), options));
}

/**
 * The id the action table uses for one getActionData entry.
 * @param {String} group - the getActionData name ('glyphActions')
 * @param {{iconName: String, iconOptions?: any}} entry
 * @returns {String} 'group.iconName', plus the option where icons share a name
 */
export function actionId(group, entry) {
	const base = `${group}.${entry?.iconName}`;
	// the align icons share one name per group; the side is their option
	if (typeof entry?.iconOptions === 'string') return `${base}.${entry.iconOptions}`;
	// Add Path and Add Component Instance share 'addShape'; the component's icon option is true
	if (entry?.iconName === 'addShape') return `${base}.${entry.iconOptions ? 'component' : 'path'}`;
	return base;
}

/**
 * @param {String} menu - 'file', 'projects', 'help', 'menu'
 * @param {String} row - its data-anyink-row id ('font-ttf')
 * @returns {String} 'file.font-ttf'
 */
export function menuRowId(menu, row) {
	return `${menu}.${row}`;
}

/**
 * Simple's home: where "Back to my letters" and a switch away from a hidden page go.
 * @param {(name: String) => Boolean} [isOn]
 * @returns {String} a page name
 */
export function simpleHome(isOn = isFeatureOn) {
	return isOn('board') ? 'Overview' : 'Characters';
}
