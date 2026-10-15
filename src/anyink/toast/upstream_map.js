// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4: what each message given to upstream's showToast says (UX-BEGINNER.md 2.2 "Toasts, one
	voice", 2.4 G, section 10 B4). Every showToast goes through toast.js, which asks this table.

	A rule: { from, match, example, key, vars, quotes, kind, group, shared, why, asIs, matchHTML,
	          withoutPhoto }
	  from     where the message is raised (for review and the inventory test)
	  match    a RegExp against the message read as text (toastText: tags out, spaces collapsed);
	           matchHTML, when given, against the HTML as it came instead (the export check
	           toast, known by its class)
	  example  a real message the rule was written for (the tests run every example)
	  key      the words.js key Simple shows (sets/toasts.js); null: Simple never shows it, and
	           why says the spec's reason
	  vars     (match, context) => the key's {placeholders}; context is what the caller knows
	           (history.js passes the deleted letter's chars)
	  quotes   the vars shown as quotes (.anyink-quote, 2.3): file and folder names
	  kind     the queue kind (queue.js), default 'info'; group: one group never queues twice
	           (queue.js: info toasts wait their turn, so toasts that follow one another, like
	           the drag-over hint and what the drop did, share a group: DROP_GROUP, 'file')
	  withoutPhoto  the key Simple shows instead while it has no way to use a photo (until B9's
	           photo card turns feature 'photo' on; principle 8): the drop and paste hints
	           offer drawings only, and a photo gets "ANY-INK can't use photos yet" 
	  shared   the toast shows in both modes, so All tools says the house words too (2.2: the
	           display points More tools shares with Simple always use the house word);
	           without it All tools keeps the message as it came, Glyphr Studio's words
	  asIs     the track that words this message itself; it shows as it came in both modes
	           (the export check toast, already in house words with its names as quotes)
	Rules are tried in order and the first match wins. A message no rule knows is shown in Simple
	only when it already is house words: the text of a words.js entry with its placeholders
	filled (a track that calls showToast(word(key)) rather than toast(key)). Anything else is
	dropped in Simple (toast.js records it, and the banned-word scan fails on it); All tools
	shows it as it came. The inventory test (tests/upstream_map.test.js) reads every showToast
	call in src, so a toast upstream adds later fails until it is mapped here.

	  toastText(message)                     the message as plain text
	  findToastRule(message)                 { rule, match } | null
	  findWordsKey(message)                  the words.js key whose text it is, or ''
	  DROP_GROUP                             the group of the drop, paste and photo toasts
	  mapUpstreamToast(message, { mode, context })
	    -> { show, key, vars?, quotes?, text?, html?, kind, group, reason }
	       text: house words to show as text (vars and quotes: how it was filled, so the
	       names can show as quotes); html: the message as it came
	       reason: 'key' | 'shared' | 'as-is' | 'words' | 'all-tools' | 'never' | 'unmapped'
*/
import {
	CLIPBOARD_BLOCKED_HINT,
	DROP_HINT,
	NOT_TRACEABLE_HINT,
	PASTE_FILE_HINT,
	PASTE_TEXT_HINT,
} from '../trace/paste_drop.js';
import { isFeatureOn } from '../mode/features.js';
import { letterPhrase } from '../words/letter_name.js';
import { word, wordEntry, wordKeys } from '../words/words.js';

/** The track whose words the export check toast is (fontcheck/export_toast.js). */
const DISPLAY_TRACK = 'B4 display-points track';

const MORE_TOOLS = 'More tools only (UX-BEGINNER 6.2)';

/** File and folder names show as quotes (.anyink-quote, 2.3): exact Windows names. */
const QUOTED = Object.freeze(['file', 'folder']);

/**
 * The drop, paste and photo toasts (trace_import.js, drop_toasts.js and the hints here): the
 * hint shown while a file is dragged over the letter gives way at once to what the drop did.
 */
export const DROP_GROUP = 'drop';
/** The work file toasts (open, save, recent fonts): each says the newest state of one file. */
const FILE = Object.freeze({ group: 'file' });
const DROP = Object.freeze({ group: DROP_GROUP });

// --------------------------------------------------------------
// Reading a message
// --------------------------------------------------------------

const ENTITIES = {
	'&lt;': '<',
	'&gt;': '>',
	'&quot;': '"',
	'&#39;': "'",
	'&nbsp;': ' ',
	'&amp;': '&',
};

/**
 * @param {*} message - what showToast was given (HTML)
 * @returns {String} the words on screen: tags out, entities read, spaces collapsed
 */
export function toastText(message) {
	return String(message ?? '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(lt|gt|quot|#39|nbsp|amp);/g, (entity) => ENTITIES[entity])
		.replace(/\s+/g, ' ')
		.trim();
}

/** A rule for one exact message (a constant another module exports). */
function exactly(message) {
	return new RegExp(`^${toastText(message).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

// --------------------------------------------------------------
// Letters
// --------------------------------------------------------------

/**
 * The characters an item's name stands for: an id, or upstream's Latin letter name.
 * @param {String} name - 'Latin Small Letter C', 'glyph-0x63'
 * @returns {String} '' when the name says nothing this can read
 */
function charsFromName(name) {
	const value = String(name ?? '').trim();
	const id = /^(?:glyph-)?0x([0-9a-f]{1,6})$/i.exec(value);
	if (id) return String.fromCodePoint(parseInt(id[1], 16));
	const latin = /^Latin (Capital|Small) Letter ([A-Z])$/i.exec(value);
	if (!latin) return '';
	return latin[1].toLowerCase() === 'capital' ? latin[2].toUpperCase() : latin[2].toLowerCase();
}

/**
 * @param {String} name - the item name inside the message
 * @param {Object} [context] - { chars } from the caller, preferred
 * @returns {String} 'small c', 'the joined letters fi', or "this letter"
 */
function letterFor(name, context) {
	const chars = context?.chars || charsFromName(name);
	return (chars && letterPhrase(chars)) || word('history.thisLetter');
}

// --------------------------------------------------------------
// Rules
// --------------------------------------------------------------

const keyed = (from, match, example, key, extra = {}) => ({ from, match, example, key, ...extra });
const never = (from, match, example, why) => ({ from, match, example, key: null, why });
const asIs = (from, match, example) => ({ from, match, example, key: null, asIs: DISPLAY_TRACK });

/** @type {ReadonlyArray<Object>} */
// prettier-ignore
export const TOAST_RULES = Object.freeze([
	// ---- B4's main path (section 10 B4, 2.4 G) ----
	never('project_editor/history.js', /^No more (undo|redo)$/, 'No more undo',
		'B2 (D-033): in Simple an Undo or Redo press with nothing to do says nothing'),
	keyed('project_editor/history.js', /^Restored deleted item (.+)$/, 'Restored deleted item<br>Latin Small Letter C',
		'toast.broughtBack', { kind: 'undo', vars: (m, context) => ({ letter: letterFor(m[1], context) }) }),
	never('project_editor/history.js', /^Navigated without undo-ing$/, 'Navigated without undo-ing',
		'2.4 G: never shown (looking around is never an Undo step)'),
	never('edit_canvas/events_keyboard.js, panels/actions.js', /^Values were rounded for .+\.$/,
		'Values were rounded for the selected path points.', '2.4 G: never shown; ANY-INK rounds silently'),
	keyed('project_editor/actions.js (Merge, panels/actions.js)', /^Uniting all glyph shapes\.*$/,
		'Uniting all glyph shapes... ', 'toast.merging', { group: 'merge', shared: true }),
	keyed('project_editor/multiselect.js', /^Combine shapes: unite complete!$/, 'Combine shapes: unite complete!',
		'toast.merged', { group: 'merge', shared: true }),
	never('project_editor/multiselect.js', /^Combine shapes: \w+ complete!$/, 'Combine shapes: divide complete!',
		`Cut apart, Cut out and the two Keep ones are ${MORE_TOOLS}`),
	keyed('project_editor/multiselect.js', /^Combine shapes error: /, 'Combine shapes error:<br>No shapes',
		'toast.mergeFailed', { group: 'merge' }),
	never('project_editor/actions.js', /^Combine: \w+ - selected shapes\.*$/, 'Combine: unite - selected shapes... ',
		`combining picked shapes is ${MORE_TOOLS}; Simple merges a whole letter`),

	// ---- Other toasts Simple can reach today: its own words; All tools keeps its own ----
	keyed('project_editor/actions.js (Ctrl+V)', /^Pasted from the ANY-INK clipboard/, 'Pasted from the ANY-INK clipboard',
		'toast.pasted', { ...DROP, vars: () => ({ count: 1 }) }),
	keyed('project_editor/actions.js (Ctrl+V)', /^Pasted (\d+) shapes from the ANY-INK clipboard/,
		'Pasted 3 shapes<br>from the ANY-INK clipboard', 'toast.pasted', { ...DROP, vars: (m) => ({ count: Number(m[1]) }) }),
	keyed('edit_canvas/events_drag_drop_paste.js', /^Imported (\d+) shapes? from /, 'Imported 2 shapes from drawing.svg',
		'toast.drawingImported', { ...DROP, vars: (m) => ({ count: Number(m[1]) }) }),
	keyed('edit_canvas/tools/new_basic_path.js', /^New shape was too small\.$/, 'New shape was too small.',
		'toast.shapeTooSmall'),
	keyed('edit_canvas/events.js, events_drag_drop_paste.js, trace/trace_drop.js', exactly(DROP_HINT), DROP_HINT,
		'toast.dropHint', { ...DROP, withoutPhoto: 'toast.dropDrawingHint' }),
	keyed('edit_canvas/events_drag_drop_paste.js', exactly(PASTE_TEXT_HINT), PASTE_TEXT_HINT, 'toast.pasteTextHint',
		{ ...DROP, withoutPhoto: 'toast.pasteDrawingHint' }),
	keyed('edit_canvas/events_drag_drop_paste.js', exactly(PASTE_FILE_HINT), PASTE_FILE_HINT, 'toast.pasteFileHint',
		{ ...DROP, withoutPhoto: 'toast.pasteDrawingHint' }),
	keyed('edit_canvas/events_drag_drop_paste.js, trace/trace_drop.js', exactly(NOT_TRACEABLE_HINT), NOT_TRACEABLE_HINT,
		'toast.openLetterFirst', { ...DROP, withoutPhoto: 'toast.photoNotYet' }),
	keyed('edit_canvas/events_drag_drop_paste.js', exactly(CLIPBOARD_BLOCKED_HINT), CLIPBOARD_BLOCKED_HINT,
		'toast.clipboardBlocked', { ...DROP, withoutPhoto: 'toast.photoNotYet' }),
	keyed('anyink/trace/trace_panel.js', /^The image already fits the (em|cap height)\.$/, 'The image already fits the em.',
		'toast.photoAlreadyFits'),
	keyed('anyink/files/project_files.js', /^Click Open again to choose a project file\.$/,
		'Click Open again to choose a project file.', 'toast.pressOpenAgain', FILE),
	keyed('anyink/files/project_files.js', /^Click Save again to choose where to save\.$/,
		'Click Save again to choose where to save.', 'toast.pressSaveAgainWhere', FILE),
	keyed('anyink/files/project_files.js', /^Click Save again to write (.+)\.$/, 'Click Save again to write Brennan Hand.gs2.',
		'toast.pressSaveAgain', { ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/project_files.js', /^ANY-INK was not allowed to write (.+)\. Choose a new file\.$/,
		'ANY-INK was not allowed to write Brennan Hand.gs2. Choose a new file.', 'toast.saveNotAllowed',
		{ ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/project_files.js', /^(.+) is no longer where it was\. Choose where to save it\.$/,
		'Brennan Hand.gs2 is no longer where it was. Choose where to save it.', 'toast.fileMoved',
		{ ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/recents_ui.js', /^(.+) could not be found\. Removed from recent projects\.$/,
		'Old Font could not be found.<br>Removed from recent projects.', 'toast.recentMissing',
		{ ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/project_files.js', /^(.+) could not be found\.$/, 'Brennan Hand.gs2 could not be found.',
		'toast.fileMissing', { ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/project_files.js', /^ANY-INK was not allowed to read (.+)\.$/,
		'ANY-INK was not allowed to read Brennan Hand.gs2.', 'toast.openNotAllowed', { ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/recents_ui.js', /^Click once more to let ANY-INK open (.+)\.$/,
		'Click once more to let ANY-INK open Old Font.', 'toast.recentPressAgain', { ...FILE, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/recents_ui.js', /^Access to (.+) was refused\. Removed from recent projects\.$/,
		'Access to Old Font was refused.<br>Removed from recent projects.', 'toast.recentRefused',
		{ ...FILE, vars: (m) => ({ file: m[1] }) }),
	never('anyink/recovery/recovery_ui.js', /^(Crash-recovery snapshots were forgotten|Could not forget the snapshots)/,
		'Crash-recovery snapshots were forgotten for this browser.', `Settings > App is ${MORE_TOOLS}`),
	never('anyink/metrics/readouts.js, pages/settings.js', /^Could not save value - needs to be a number\.$/,
		'Could not save value - needs to be a number.', 'Simple has no number fields (principle 3)'),
	never('anyink/metrics/readouts.js', / kept in order: set to -?[\d.]+$/, 'Ascent kept in order: set to 800',
		'Simple has no number fields (principle 3)'),

	// ---- The font file (File menu > Make a font file; B14's Use in Word takes over in Simple) ----
	never('formats_io/svg_font/svg_font_export.js', /^Exported SVG Font File$/, 'Exported SVG Font File',
		`Ctrl+G and the SVG font are ${MORE_TOOLS}`),
	{ ...asIs('anyink/fontcheck/export_toast.js', /anyink-export-check/,
		'<div class="anyink-export-check"><p class="anyink-export-check__text">Exported <span class="anyink-quote">A.otf</span> to <span class="anyink-quote">Fonts</span>, but small a needs fixing.</p><button type="button" class="anyink-export-check__show" hidden>Show me</button></div>'),
	matchHTML: /class="anyink-export-check"/ },
	keyed('formats_io/otf/font_export.js', /^(Exporting \w+ font file|Exporting|Finalizing)\.*$/,
		'Exporting OTF font file...', 'toast.fontFileMaking', { group: 'export' }),
	keyed('formats_io/otf/font_export.js', /^Exporting .+$/, 'Exporting<br>Latin Capital Letter A',
		'toast.fontFileMaking', { group: 'export' }),
	keyed('anyink/files/export_folder.js', /^Exported (.+) to (.+)$/, 'Exported BrennanHand-Regular.otf to Fonts',
		'toast.fontFileExported', { group: 'export', quotes: QUOTED, vars: (m) => ({ file: m[1], folder: m[2] }) }),
	keyed('anyink/files/export_folder.js', /^Downloading (.+)$/, 'Downloading BrennanHand-Regular.otf',
		'toast.fontFileDownloading', { group: 'export', quotes: QUOTED, vars: (m) => ({ file: m[1] }) }),
	keyed('anyink/files/export_folder.js', /^ANY-INK is no longer allowed to write to (.+)\. Downloading (.+) instead\.$/,
		'ANY-INK is no longer allowed to write to Fonts.<br>Downloading A.otf instead.', 'toast.fontFileNoLongerAllowed',
		{ group: 'export', quotes: QUOTED, vars: (m) => ({ folder: m[1], file: m[2] }) }),
	keyed('anyink/files/export_folder.js', /^Could not write (.+) to (.+?): .* Downloading it instead\.$/,
		'Could not write F.otf to ReadOnly: the folder is read only.<br>Downloading it instead.', 'toast.fontFileWriteFailed',
		{ group: 'export', quotes: QUOTED, vars: (m) => ({ file: m[1], folder: m[2] }) }),
	keyed('anyink/files/export_folder.js', /^Click Export again to write to (.+)\.$/, 'Click Export again to write to Fonts.',
		'toast.fontFolderPressAgain', { group: 'export', quotes: QUOTED, vars: (m) => ({ folder: m[1] }) }),
	keyed('anyink/files/export_folder.js', /^Click Export again to choose an export folder\.$/,
		'Click Export again to choose an export folder.', 'toast.fontFolderChooseAgain', { group: 'export' }),
	keyed('anyink/files/export_folder.js', /^ANY-INK was not allowed to write to (.+)\. Choose an export folder\.$/,
		'ANY-INK was not allowed to write to Fonts. Choose an export folder.', 'toast.fontFolderRefused',
		{ group: 'export', quotes: QUOTED, vars: (m) => ({ folder: m[1] }) }),
	keyed('anyink/files/export_folder.js', /^Export cancelled$/, 'Export cancelled', 'toast.fontFileCancelled',
		{ group: 'export' }),

	// ---- More tools only: Simple never shows these pages, panels or menus ----
	never('app/cross_project_actions', /^No items selected\./, 'No items selected.<br>Use the checkboxes on each row',
		`copying between fonts is ${MORE_TOOLS}`),
	never('app/cross_project_actions', /^(Added \d+ (components|kern groups)|Copied shapes from \d+ items|Overwrote (settings for )?\d+ items)$/,
		'Added 3 kern groups', `copying between fonts is ${MORE_TOOLS}`),
	never('app/menu.js, app/open_project.js', /^Switched to /, 'Switched to<br>Other Font',
		`the Projects menu (two fonts open) is ${MORE_TOOLS}`),
	never('pages/global_actions', /^(Adding diacritical |Starting to assemble Diacritical Glyphs$|(.+ )?Done!$|.+ Starting\.\.\.$)/,
		'Starting to assemble Diacritical Glyphs', `Change all letters is ${MORE_TOOLS}`),
	never('pages/global_actions/font_types.js', /^Monospace width must be /, 'Monospace width must be<br>a number greater than zero',
		`Change all letters is ${MORE_TOOLS}`),
	never('pages/global_actions/move_and_resize.js', /^(Side Bearing values must be numbers|Tick a checkbox to enable Left and\/or Right Side Bearings)\.$/,
		'Side Bearing values must be numbers.', `Change all letters is ${MORE_TOOLS}`),
	never('pages/settings_project.js', /character range|Glyph range/i, 'Hid character range:<br>Basic Latin',
		`Settings are ${MORE_TOOLS}`),
	never('panels/actions.js', /^Only SVG files can be imported to a glyph\.$/, 'Only SVG files can be imported to a glyph.',
		`the import buttons are ${MORE_TOOLS}`),
	never('panels/actions.js', /^Deleted .+ \(Don't worry, this action can be undone\) Navigated to /,
		"Deleted Latin Small Letter A.<br>(Don't worry, this action can be undone)<br>Navigated to Latin Small Letter B",
		`the Delete buttons are ${MORE_TOOLS}; Simple clears a letter in Fine-tune (B7)`),
	never('project_editor/actions.js', /^(Item doesn't exist, or has no shapes\.|\d+ paths (were )?copied from |Component instance linked from |Component was linked to )/,
		'Component was linked to<br>Latin Capital Letter A', `reusable parts and copying shapes between letters are ${MORE_TOOLS}`),
	never('project_editor/cross_item_actions.js', /^A circular link was found/, "A circular link was found, components can't include links to themselves.",
		`reusable parts are ${MORE_TOOLS}`),
	never('project_editor/pop_out_window.js', /^Deleted live preview /, 'Deleted live preview<br>Pangram',
		`the live preview window is ${MORE_TOOLS}`),
]);

// --------------------------------------------------------------
// Lookup
// --------------------------------------------------------------

/**
 * @param {*} message
 * @returns {{rule: Object, match: RegExpExecArray} | null} the first rule that knows it
 */
export function findToastRule(message) {
	const html = String(message ?? '');
	const text = toastText(html);
	if (!text) return null;
	for (const rule of TOAST_RULES) {
		const match = rule.matchHTML ? rule.matchHTML.exec(html) : rule.match.exec(text);
		if (match) return { rule, match };
	}
	return null;
}

/** A words.js text needs this many letters of its own to be told apart from other messages. */
const MIN_OWN_LETTERS = 8;
/** [{ key, re }] built from words.js on first use */
let wordPatterns = null;

function patternsFromWords() {
	if (wordPatterns) return wordPatterns;
	wordPatterns = [];
	wordKeys().forEach((key) => {
		const parts = wordEntry(key).text.split(/\{[^{}]*\}/);
		const own = parts.join('').replace(/[^A-Za-z]/g, '');
		if (own.length < MIN_OWN_LETTERS) return;
		const escaped = parts.map((part) => toastText(part).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		const body = escaped.join('(.+?)').replace(/\s+/g, ' ');
		wordPatterns.push({ key, re: new RegExp(`^${body.trim()}$`) });
	});
	return wordPatterns;
}

/**
 * A message that is already house words: some words.js entry's text, its placeholders filled
 * (a track that calls showToast(word(key)) instead of toast(key)).
 * @param {*} message
 * @returns {String} that key, or ''
 */
export function findWordsKey(message) {
	const text = toastText(message);
	if (!text) return '';
	return patternsFromWords().find(({ re }) => re.test(text))?.key || '';
}

/**
 * @param {*} message - what showToast was given
 * @param {{mode?: 'all' | 'simple', context?: Object}} [options]
 * @returns {{show: Boolean, key: String | null, vars?: Object, quotes?: Array<String>,
 *   text?: String, html?: String, kind: String, group: String, reason: String}}
 */
export function mapUpstreamToast(message, { mode = 'all', context = null } = {}) {
	const found = findToastRule(message);
	const rule = found?.rule || null;
	// Simple with no way to use a photo yet says the rule's photo-free words (principle 8)
	const key =
		mode === 'simple' && rule?.withoutPhoto && !isFeatureOn('photo')
			? rule.withoutPhoto
			: rule?.key;
	const base = { key: key ?? null, kind: rule?.kind || 'info', group: rule?.group || '' };
	const words = () => {
		const vars = rule.vars ? rule.vars(found.match, context) : {};
		return { vars, quotes: rule.quotes || [], text: word(key, vars) };
	};
	const asSent = String(message ?? '');

	if (mode !== 'simple') {
		if (rule?.key && rule.shared) return { ...base, show: true, ...words(), reason: 'shared' };
		return { ...base, show: true, html: asSent, reason: 'all-tools' };
	}
	if (!rule) {
		const key = findWordsKey(message);
		if (key) return { ...base, key, show: true, html: asSent, reason: 'words' };
		return { ...base, show: false, reason: 'unmapped' };
	}
	if (rule.asIs) return { ...base, show: true, html: asSent, reason: 'as-is' };
	if (!rule.key) return { ...base, show: false, reason: 'never' };
	return { ...base, show: true, ...words(), reason: 'key' };
}
