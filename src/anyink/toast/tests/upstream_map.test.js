// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: every message upstream's showToast is given, mapped to a words.js key (UX-BEGINNER.md 2.2
// "Toasts, one voice", 2.4 G, section 10 B4). Simple shows the key's words, or nothing for a
// message Simple never shows; an unmapped message is dropped in Simple. All tools shows the
// message as it came, except a toast both modes share, which says the house words in both (2.2).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { resetFeaturesForTests, setFeaturesForTests } from '../../mode/features.js';
import {
	CLIPBOARD_BLOCKED_HINT,
	DROP_HINT,
	NOT_TRACEABLE_HINT,
	PASTE_FILE_HINT,
	PASTE_TEXT_HINT,
} from '../../trace/paste_drop.js';
import { scanTexts } from '../../words/banned.js';
import { hasWord, word } from '../../words/words.js';
import { expectNoBanned } from '../../words/tests/banned_scan.js';
import { wordParts } from '../toast.js';
import {
	DROP_GROUP,
	TOAST_RULES,
	findToastRule,
	findWordsKey,
	mapUpstreamToast,
	toastText,
} from '../upstream_map.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../..');

const simple = (message, context) => mapUpstreamToast(message, { mode: 'simple', context });
const all = (message, context) => mapUpstreamToast(message, { mode: 'all', context });
/** What a decision puts on screen: house words, the message as it came, or nothing. */
const shown = (d) => (d.show ? d.text ?? d.html : null);

describe('toastText', () => {
	it('reads a message as text: tags out, spaces collapsed', () => {
		expect(toastText('Restored deleted item<br>Latin Small Letter C')).toBe(
			'Restored deleted item Latin Small Letter C'
		);
		expect(toastText("\n\t\tDeleted a.<br>\n\t\t(Don't worry)  ")).toBe("Deleted a. (Don't worry)");
		expect(toastText('Saved &lt;b&gt;')).toBe('Saved <b>');
		expect(toastText(undefined)).toBe('');
	});
});

describe('the main-path toasts of B4', () => {
	// [message, what Simple shows (null: nothing), what All tools shows]
	// prettier-ignore
	const MAIN_PATH = [
		// history.js
		['No more undo', null, 'No more undo'],
		['No more redo', null, 'No more redo'],
		['Restored deleted item<br>Latin Small Letter C', 'Brought back small c', 'Restored deleted item<br>Latin Small Letter C'],
		['Navigated without undo-ing', null, 'Navigated without undo-ing'],
		// events_keyboard.js (Ctrl+R) and the Attributes panel's round buttons
		['Values were rounded for the selected path points.', null, 'Values were rounded for the selected path points.'],
		['Values were rounded for the selected shapes.', null, 'Values were rounded for the selected shapes.'],
		['Values were rounded for all path points in this glyph.', null, 'Values were rounded for all path points in this glyph.'],
		// Merge (panels/actions.js -> project_editor/actions.js, then multiselect.js)
		['Uniting all glyph shapes... ', 'Merging the shapes...', 'Merging the shapes...'],
		['Combine shapes: unite complete!', 'Merged the shapes', 'Merged the shapes'],
		['Combine shapes: subtract complete!', null, 'Combine shapes: subtract complete!'],
		['Combine shapes error:<br>No shapes to combine', "Couldn't merge the shapes", 'Combine shapes error:<br>No shapes to combine'],
	];

	it.each(MAIN_PATH)('%s', (message, simpleText, allText) => {
		expect(shown(simple(message))).toBe(simpleText);
		expect(shown(all(message))).toBe(allText);
	});

	it('names the letter from what the caller knows, else from the name in the message', () => {
		const message = 'Restored deleted item<br>Ligature fi';
		expect(simple(message, { chars: 'fi' }).text).toBe('Brought back the joined letters fi');
		expect(simple('Restored deleted item<br>Latin Capital Letter Q').text).toBe(
			'Brought back Capital Q'
		);
		expect(simple('Restored deleted item<br>glyph-0x3F').text).toBe(
			'Brought back the question mark'
		);
		expect(simple('Restored deleted item<br>Component 1').text).toBe('Brought back this letter');
	});

	it('says which key it picked and why', () => {
		expect(simple('Uniting all glyph shapes... ')).toMatchObject({
			show: true,
			key: 'toast.merging',
			reason: 'key',
			group: 'merge',
		});
		expect(all('Uniting all glyph shapes... ')).toMatchObject({
			key: 'toast.merging',
			reason: 'shared',
		});
		expect(simple('No more undo')).toMatchObject({ show: false, key: null, reason: 'never' });
		expect(all('Restored deleted item<br>X')).toMatchObject({
			show: true,
			key: 'toast.broughtBack',
			reason: 'all-tools',
		});
	});
});

describe('drops and pastes (fix track)', () => {
	afterEach(() => resetFeaturesForTests());

	// [message, what Simple says]. B8 + B9 integration: B9's photo card landed, so the
	// drawings-only words Simple said until then (withoutPhoto) are gone, with or without the flag
	// prettier-ignore
	const HINTS = [
		[DROP_HINT, 'toast.dropHint'],
		[PASTE_TEXT_HINT, 'toast.pasteTextHint'],
		[PASTE_FILE_HINT, 'toast.pasteFileHint'],
		[NOT_TRACEABLE_HINT, 'toast.openLetterFirst'],
		[CLIPBOARD_BLOCKED_HINT, 'toast.clipboardBlocked'],
	];

	it.each(HINTS)('%s: Simple says it in house words; All tools as it came', (message, key) => {
		expect(simple(message)).toMatchObject({ show: true, key, text: word(key) });
		setFeaturesForTests({ photo: false });
		expect(simple(message)).toMatchObject({ show: true, key });
		expect(all(message)).toMatchObject({ show: true, html: message, reason: 'all-tools' });
	});

	it('the retired photo-free words are gone from the words and the map', () => {
		['toast.photoNotYet', 'toast.dropDrawingHint', 'toast.pasteDrawingHint'].forEach((key) => {
			expect(hasWord(key)).toBe(false);
		});
		expect(TOAST_RULES.some((rule) => 'withoutPhoto' in rule)).toBe(false);
	});

	it('the drag hint, what the drop or paste did, and the photo toasts are one stream', () => {
		// "info toasts wait their turn" (4.0): the drag-over hint must give way to the drop's own
		// toast at once, never hold it up for 6 s
		const groups = [
			DROP_HINT,
			PASTE_TEXT_HINT,
			PASTE_FILE_HINT,
			NOT_TRACEABLE_HINT,
			CLIPBOARD_BLOCKED_HINT,
			'Imported 2 shapes from drawing.svg',
			'Pasted 3 shapes<br>from the ANY-INK clipboard',
			'Pasted from the ANY-INK clipboard',
		].map((message) => simple(message).group);
		expect(new Set(groups)).toEqual(new Set([DROP_GROUP]));
	});

	it('the work file toasts (open, save, recent fonts) are one stream: the newer says the newer state', () => {
		const groups = TOAST_RULES.filter((rule) =>
			/^anyink\/files\/(project_files|recents_ui)/.test(rule.from)
		).map((rule) => simple(rule.example).group);
		expect(groups.length).toBeGreaterThanOrEqual(9);
		expect(new Set(groups)).toEqual(new Set(['file']));
	});
});

describe('messages with no mapping', () => {
	it('are dropped in Simple and shown as they came in All tools', () => {
		const message = 'Something <b>new</b> from upstream';
		expect(findToastRule(message)).toBeNull();
		expect(simple(message)).toMatchObject({ show: false, key: null, reason: 'unmapped' });
		expect(all(message)).toMatchObject({ show: true, html: message, reason: 'all-tools' });
	});
});

describe('messages that already are house words', () => {
	it('show as they came in Simple, by the key whose text they are', () => {
		const message = word('toast.broughtBack', { letter: 'small c' });
		expect(findToastRule(message)).toBeNull();
		expect(findWordsKey(message)).toBe('toast.broughtBack');
		expect(simple(message)).toMatchObject({
			show: true,
			key: 'toast.broughtBack',
			html: message,
			reason: 'words',
		});
		expect(all(message)).toMatchObject({ show: true, html: message, reason: 'all-tools' });
	});

	it('only texts with enough words of their own count ("{size} pt" would match anything)', () => {
		expect(findWordsKey('36 pt')).toBe('');
		expect(findWordsKey('Something new')).toBe('');
		expect(findWordsKey('')).toBe('');
	});
});

describe('the font file toasts (File menu > Make a font file)', () => {
	it('say house words in Simple, the file and folder names as quotes (2.3)', () => {
		const made = simple('Exported BrennanHand-Regular.otf to Fonts');
		expect(made).toMatchObject({
			key: 'toast.fontFileExported',
			text: 'Exported BrennanHand-Regular.otf to Fonts',
			vars: { file: 'BrennanHand-Regular.otf', folder: 'Fonts' },
			quotes: ['file', 'folder'],
			group: 'export',
		});
		expect(simple('Exporting OTF font file...').text).toBe('Making the font file...');
		expect(simple('Exporting<br>Latin Capital Letter A').text).toBe('Making the font file...');
		expect(simple('Export cancelled').text).toBe('No font file was made');
		expect(all('Exported BrennanHand-Regular.otf to Fonts').html).toBe(
			'Exported BrennanHand-Regular.otf to Fonts'
		);
	});

	it("the export check toast is the display-points track's words: shown as it came", () => {
		const message =
			'<div class="anyink-export-check"><p class="anyink-export-check__text">Exported <span class="anyink-quote">A.otf</span> to <span class="anyink-quote">Fonts</span>, but small a needs fixing.</p></div>';
		const rule = findToastRule(message).rule;
		expect(rule.asIs).toBe('B4 display-points track');
		expect(simple(message)).toMatchObject({ show: true, html: message, reason: 'as-is' });
		expect(all(message)).toMatchObject({ show: true, html: message, reason: 'all-tools' });
	});
});

describe('the rules', () => {
	it('each names where it is raised, and an example message it was written for', () => {
		TOAST_RULES.forEach((rule) => {
			expect(rule.match, rule.example).toBeInstanceOf(RegExp);
			expect(typeof rule.from, rule.example).toBe('string');
			expect(rule.from.trim(), rule.example).not.toBe('');
			expect(typeof rule.example).toBe('string');
		});
	});

	it("each rule's example is caught by that rule, not an earlier one", () => {
		TOAST_RULES.forEach((rule) => {
			expect(findToastRule(rule.example)?.rule, rule.example).toBe(rule);
		});
	});

	it('a key exists in words.js; no key says why Simple never shows it; as-is names its track', () => {
		TOAST_RULES.forEach((rule) => {
			if (rule.asIs) {
				expect(rule.asIs, rule.example).toMatch(/track/);
				expect(rule.key ?? null, rule.example).toBeNull();
			} else if (rule.key === null) {
				expect(rule.why, rule.example).toBeTruthy();
			} else {
				expect(hasWord(rule.key), rule.key).toBe(true);
				expect(rule.key, rule.example).toMatch(/^toast\./);
			}
			if (rule.shared) expect(rule.key, rule.example).toBeTruthy();
		});
	});

	it("no rule's Simple words say a banned word (UX-BEGINNER 2.3; a quoted name is exempt)", () => {
		const texts = TOAST_RULES.filter((rule) => rule.key).map((rule) => {
			const decision = simple(rule.example);
			expect(decision.text, rule.example).toBeTruthy();
			return wordParts(decision.key, decision.vars, decision.quotes)
				.map((part) => (part.quote ? '"…"' : part.text))
				.join('');
		});
		expectNoBanned(scanTexts(texts, 'toast'));
	});

	it('kinds and groups are the queue ones', () => {
		TOAST_RULES.forEach((rule) => {
			if (rule.kind) expect(['undo', 'destructive', 'automatic', 'info']).toContain(rule.kind);
		});
	});
});

// --------------------------------------------------------------
// Inventory: every showToast call in the app is known
// --------------------------------------------------------------

/** Every .js file under src, tests folders and the vendored libraries left out. */
function sourceFiles(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) {
			return ['tests', 'lib', 'node_modules'].includes(name) ? [] : sourceFiles(path);
		}
		return name.endsWith('.js') ? [path] : [];
	});
}

/**
 * The first argument of every showToast( call: a literal (template parts read as '2') or the
 * expression as written. Commented-out calls are left out.
 * @param {String} text - a source file
 * @returns {Array<{line: Number, literal?: String, expression?: String}>}
 */
function toastCalls(text) {
	const calls = [];
	for (const m of text.matchAll(/\bshowToast\(/g)) {
		const lineStart = text.lastIndexOf('\n', m.index) + 1;
		const before = text.slice(lineStart, m.index).trim();
		if (before.startsWith('//') || before.startsWith('*') || before.startsWith('/*')) continue;
		const line = text.slice(0, m.index).split('\n').length;
		let i = m.index + m[0].length;
		while (/\s/.test(text[i])) i++;
		const quote = text[i];
		if (["'", '"', '`'].includes(quote)) {
			let j = i + 1;
			let literal = '';
			while (j < text.length && text[j] !== quote) {
				if (text[j] === '\\') {
					literal += text[j + 1];
					j += 2;
				} else if (quote === '`' && text[j] === '$' && text[j + 1] === '{') {
					let depth = 1;
					j += 2;
					while (j < text.length && depth) {
						if (text[j] === '{') depth++;
						if (text[j] === '}') depth--;
						j++;
					}
					literal += '2';
				} else {
					literal += text[j++];
				}
			}
			let k = j + 1;
			while (/\s/.test(text[k])) k++;
			if (text[k] === ',' || text[k] === ')') {
				calls.push({ line, literal });
				continue;
			}
		}
		let j = i;
		let depth = 0;
		let expression = '';
		while (j < text.length) {
			const c = text[j];
			if ('([{'.includes(c)) depth++;
			if (')]}'.includes(c)) {
				if (depth === 0) break;
				depth--;
			}
			if (c === ',' && depth === 0) break;
			expression += c;
			j++;
		}
		calls.push({ line, expression: expression.replace(/\s+/g, ' ').trim() });
	}
	return calls;
}

/**
 * Calls whose message is built at run time, by file. Their words are covered by rules whose
 * examples are those messages (or by the constants below). A new one fails the test: map its
 * messages (upstream_map.js), or call toast() with a key.
 */
const DYNAMIC = {
	'anyink/files/export_folder.js': [
		'clickAgainToWrite(remembered)',
		'clickAgainToWrite(dir)',
		'message',
	],
	'anyink/files/project_files.js': [
		'clickAgain',
		'notAllowedMessage(handle)',
		"name === 'NotFoundError' ? `${fileLabel(handle)} is no longer where it was. Choose where to save it.` : notAllowedMessage(handle)",
	],
	'anyink/files/recents_ui.js': ['message'],
	'anyink/fontcheck/export_toast.js': ['toastHTML(where, clause)'],
	'anyink/trace/trace_drop.js': ["kind === 'other' ? DROP_HINT : NOT_TRACEABLE_HINT"],
	'anyink/trace/trace_panel.js': [
		"which === 'em' ? 'The image already fits the em.' : 'The image already fits the cap height.'",
	],
	'edit_canvas/events.js': ['DROP_HINT'],
	'edit_canvas/events_drag_drop_paste.js': [
		'CLIPBOARD_BLOCKED_HINT',
		'PASTE_FILE_HINT',
		'PASTE_TEXT_HINT',
		'DROP_HINT',
		'NOT_TRACEABLE_HINT',
	],
	'formats_io/otf/font_export.js': ["'Exporting<br>' + glyph.name", "'Exporting<br>' + liga.name"],
	'pages/global_actions/page.js': [
		"title + '<br>' + currentItem.name",
		"title + '<br>Done!'",
		"title + '<br>Starting...'",
	],
	'pages/settings_project.js': ['message'],
	'project_editor/actions.js': ['toastMessage', 'title'],
};

describe('inventory', () => {
	const calls = sourceFiles(SRC)
		.map((path) => relative(SRC, path).replaceAll('\\', '/'))
		.filter((file) => !file.startsWith('anyink/toast/') && file !== 'controls/dialogs/dialogs.js')
		.flatMap((file) =>
			toastCalls(readFileSync(join(SRC, file), 'utf8')).map((call) => ({ file, ...call }))
		);

	it('finds the calls (the parser works)', () => {
		expect(calls.length).toBeGreaterThan(60);
		expect(calls).toContainEqual(
			expect.objectContaining({ file: 'project_editor/history.js', literal: 'No more redo' })
		);
		expect(toastCalls("showToast(`Added ${n} kern groups`);\n// showToast('x');")).toEqual([
			{ line: 1, literal: 'Added 2 kern groups' },
		]);
	});

	it('every message written in a showToast call has a rule', () => {
		const unknown = calls
			.filter((call) => call.literal !== undefined && !findToastRule(call.literal))
			.map((call) => `${call.file}:${call.line} ${JSON.stringify(call.literal)}`);
		expect(unknown).toEqual([]);
	});

	it('every message built at run time is a known call site, or house words (word(...))', () => {
		const unknown = calls
			.filter((call) => call.expression !== undefined)
			.filter((call) => !/\bword\(/.test(call.expression))
			.filter((call) => !(DYNAMIC[call.file] || []).includes(call.expression))
			.map((call) => `${call.file}:${call.line} ${call.expression}`);
		expect(unknown).toEqual([]);
	});

	it('the hint constants passed by name have rules', () => {
		[
			DROP_HINT,
			PASTE_TEXT_HINT,
			PASTE_FILE_HINT,
			NOT_TRACEABLE_HINT,
			CLIPBOARD_BLOCKED_HINT,
		].forEach((message) => expect(findToastRule(message), message).not.toBeNull());
	});
});
