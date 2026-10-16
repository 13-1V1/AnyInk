// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK Use in Word (B14, UX-BEGINNER.md 4.7): the names a font file gets.

	A test build is family "<name> Test <n>" in file "<NameNoSpaces>-Test<n>.otf"; the final font
	("When you're happy with it") is family "<name>" in file "<NameNoSpaces>-Regular.otf". Windows
	keeps a family name to 31 characters, so a long name is shortened ONCE (familyBase), at a word
	boundary, to leave room for the longest test tail (" Test 999"): every test build and the card's
	and Help's "search <name> Test" use that one base (B14 + B15 fix pass). The final font keeps a
	name that fits 31 whole, and cuts a longer one at a word (finalFamily, B14 + B15 finalize), so
	two names that share a test base never make one font in Word.

	The test number n lives outside the font: in app storage (kv), keyed by the font name's base, and
	in the "Test<N>" files already in the chosen folder. n = 1 + the larger of the two. Two long names
	that shorten to the same base count up together, so Word never gets two fonts of one name.
	Per work file (settings.project.id, kv 'testBuilds:<id>') the newest test build of each base is
	remembered, so after a rename in Font details the card still names the old name's last test
	build to uninstall ("If you installed Brennan Hand Test 2 earlier ..."). It only counts up:
	an Undo, a backup copy put back or a deleted file never brings an old number back, because
	nothing about it is in the work file and the stored number is never lowered (7.3: "Make my font
	file; the test number" make no Undo step).

	  MAX_FAMILY_LENGTH               31
	  fontBaseName(name)              the name with spaces tidied, or 'My Font'
	  fitFamily(name, tail = '')      the name shortened so name + tail fits in 31 (UTF-16 units,
	                                  never splitting a letter), no space left where it was cut
	  TEST_TAIL_ROOM                  ' Test 999'.length
	  familyBase(name)                the one base every family and the search use: the tidied
	                                  name cut once, at a word boundary, to 31 - TEST_TAIL_ROOM (a
	                                  word is cut inside only when the boundary keeps under half)
	  finalFamily(name)               the final font's family: the tidied name when it fits 31, else
	                                  cut once at a word boundary
	  fileStem(name)                 "BrennanHand": no spaces, nothing Windows refuses in a file name
	  testBuildNames(name, n)         { number, family, fileName }
	  finalBuildNames(name)           { family, fileName }
	  testNumberInFileName(file, name)  N from "<stem>-Test<N>.otf" (also "... (2).otf" and .ttf),
	                                  any case; 0 for anything else
	  highestTestInFolder(dir, name)  the highest such N in the folder, 0 when it can't be read
	  testNumberKey(name)             the kv key: 'testNumber:' + familyBase(name) in lower case
	  storedTestNumber(name)          the stored number, 0 when none (or damaged)
	  testBuildsKey(workId)           the kv key of a work file's test builds
	  workTestBuilds(workId)          [{ base, number }] newest first, one per base; [] for none
	  nextTestBuild(name, dir, { workId })   { number, family, fileName, earlier: { number, family }
	                                  | null, renamedFrom: [base, ...] } without using the number up
	                                  (dir may be null: no folder yet). earlier: the newest test
	                                  build this work file made under another name when the newest
	                                  is under another name, else this name's last; renamedFrom:
	                                  the work file's other names with test builds, newest first
	  renamedTestNames(name, workId)  the work file's other names with test builds, newest first
	  noteTestBuilt(name, n, { workId })   after the file is written: stores the larger of the
	                                  stored number and n (nothing when the stored one can't be
	                                  read) and, with workId, puts the build first in the work
	                                  file's list; resolves the number now stored
*/

import { kvGet, kvGetStrict, kvSet } from '../storage/kv.js';

/** Windows' limit for a font family name (LF_FACESIZE 32, less the ending null). */
export const MAX_FAMILY_LENGTH = 31;

/** Used when the font has no name (the start screen always gives it one). */
const FALLBACK_NAME = 'My Font';
const KEY_PREFIX = 'testNumber:';
const BUILDS_PREFIX = 'testBuilds:';
/** How many names a work file's list keeps */
const MAX_BUILD_NAMES = 20;

/** The longest test tail a family gets (" Test 999"); a 1000th test is cut by fitFamily */
export const TEST_TAIL_ROOM = ' Test 999'.length;
/** What may be left hanging where a name was cut at a word boundary */
const HANGING = /[\s\-‐-―,;:&+/.]+$/u;
const FONT_FILE = /^(.*)-test(\d+)(?: \(\d+\))?\.(?:otf|ttf)$/i;

/**
 * @param {String} name - the font name
 * @returns {String} the name with runs of spaces made one and the ends trimmed, or 'My Font'
 */
export function fontBaseName(name) {
	return (
		String(name ?? '')
			.replace(/\s+/g, ' ')
			.trim() || FALLBACK_NAME
	);
}

/**
 * @param {String} name - the font name
 * @param {String} [tail] - what follows it, e.g. ' Test 3'
 * @returns {String} name + tail, the name shortened so the whole fits in MAX_FAMILY_LENGTH
 */
export function fitFamily(name, tail = '') {
	const base = fontBaseName(name);
	const room = MAX_FAMILY_LENGTH - tail.length;
	if (base.length <= room) return base + tail;
	let cut = '';
	for (const char of base) {
		if (cut.length + char.length > room) break;
		cut += char;
	}
	return cut.trimEnd() + tail;
}

/**
 * The one base every family name and the search use, cut once (B14 + B15 fix pass).
 * @param {String} name - the font name
 * @returns {String} the tidied name, at most MAX_FAMILY_LENGTH - TEST_TAIL_ROOM long
 */
export function familyBase(name) {
	return cutAtWord(fontBaseName(name), MAX_FAMILY_LENGTH - TEST_TAIL_ROOM);
}

/**
 * B14 + B15 finalize: the final font's family. A name that fits Windows' 31 characters stays
 * whole (two names that share a test base must not become one font in Word); a longer one is cut
 * once, at a word boundary, as familyBase cuts.
 * @param {String} name - the font name
 * @returns {String} at most MAX_FAMILY_LENGTH long
 */
export function finalFamily(name) {
	return cutAtWord(fontBaseName(name), MAX_FAMILY_LENGTH);
}

/**
 * @param {String} base - a tidied name
 * @param {Number} room - the most UTF-16 units it may keep
 * @returns {String} base when it fits; else cut at a word boundary (inside a word only when the
 *   boundary keeps under half the room), never splitting a letter or leaving a dash hanging
 */
function cutAtWord(base, room) {
	if (base.length <= room) return base;
	let cut = '';
	for (const char of base) {
		if (cut.length + char.length > room) break;
		cut += char;
	}
	// the next letter starts a new word: the cut is already at a word boundary
	if (/\s/.test(base.charAt(cut.length))) return trimHanging(cut) || cut.trimEnd();
	const space = cut.search(/\s\S*$/);
	const atWord = space > 0 ? trimHanging(cut.slice(0, space)) : '';
	return atWord.length >= room / 2 ? atWord : cut.trimEnd();
}

/** A cut name without the space, dash or comma it ended on */
function trimHanging(text) {
	return text.replace(HANGING, '');
}

/**
 * @param {String} name - the font name
 * @returns {String} the name with no spaces and no character Windows refuses in a file name
 */
export function fileStem(name) {
	const stem = [...fontBaseName(name)]
		.filter((char) => char.charCodeAt(0) >= 32 && !'\\/:*?"<>|'.includes(char) && !/\s/.test(char))
		.join('')
		.replace(/^\.+|\.+$/g, '');
	return stem || fileStem(FALLBACK_NAME);
}

/**
 * @param {String} name - the font name
 * @param {Number} number - the test number
 * @returns {{number: Number, family: String, fileName: String}}
 */
export function testBuildNames(name, number) {
	return {
		number,
		family: fitFamily(familyBase(name), ` Test ${number}`),
		fileName: `${fileStem(name)}-Test${number}.otf`,
	};
}

/**
 * @param {String} name - the font name
 * @returns {{family: String, fileName: String}} the font for keeps
 */
export function finalBuildNames(name) {
	return { family: finalFamily(name), fileName: `${fileStem(name)}-Regular.otf` };
}

/**
 * @param {String} fileName - a file in the folder
 * @param {String} name - the font name
 * @returns {Number} its test number when it is one of this font's test builds, else 0
 */
export function testNumberInFileName(fileName, name) {
	const match = FONT_FILE.exec(String(fileName || ''));
	if (!match || match[1].toLowerCase() !== fileStem(name).toLowerCase()) return 0;
	const number = Number(match[2]);
	return Number.isSafeInteger(number) ? number : 0;
}

/**
 * @param {Object} dir - a FileSystemDirectoryHandle (keys(), entries() or values())
 * @param {String} name - the font name
 * @returns {Promise<Number>} the highest test number among its files, 0 when none or unreadable
 */
export async function highestTestInFolder(dir, name) {
	if (!dir) return 0;
	let highest = 0;
	try {
		for await (const fileName of folderNames(dir)) {
			highest = Math.max(highest, testNumberInFileName(fileName, name));
		}
	} catch {
		// permission lapsed or the folder moved: the stored number still holds
	}
	return highest;
}

/** The file names in a folder, from whichever listing the handle has. */
async function* folderNames(dir) {
	if (typeof dir.keys === 'function') {
		yield* dir.keys();
	} else if (typeof dir.entries === 'function') {
		for await (const [fileName] of dir.entries()) yield fileName;
	} else if (typeof dir.values === 'function') {
		for await (const entry of dir.values()) yield entry?.name;
	}
}

/**
 * @param {String} name - the font name
 * @returns {String} the kv key holding its test number
 */
export function testNumberKey(name) {
	return KEY_PREFIX + familyBase(name).toLowerCase();
}

/**
 * @param {String} name - the font name
 * @returns {Promise<Number>} the highest test number stored for it, 0 when none
 */
export async function storedTestNumber(name) {
	return wholeNumber(await kvGet(testNumberKey(name)));
}

/** A stored value as a whole number of 0 or more (anything else is 0). */
function wholeNumber(value) {
	const number = Math.floor(Number(value));
	return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

/**
 * @param {String} workId - the work file's settings.project.id
 * @returns {String} the kv key of its test builds
 */
export function testBuildsKey(workId) {
	return BUILDS_PREFIX + String(workId);
}

/**
 * @param {String} [workId] - the work file's settings.project.id
 * @returns {Promise<Array<{base: String, number: Number}>>} its test builds, newest first, one per
 *   base; [] with no id, nothing stored, or a list that can't be read
 */
export async function workTestBuilds(workId) {
	if (!workId) return [];
	try {
		const list = await kvGet(testBuildsKey(workId));
		if (!Array.isArray(list)) return [];
		return list
			.filter((entry) => typeof entry?.base === 'string' && entry.base && wholeNumber(entry.number))
			.map((entry) => ({ base: entry.base, number: wholeNumber(entry.number) }));
	} catch {
		return [];
	}
}

/** Two bases are one name when they differ only in case */
function sameBase(a, b) {
	return a.toLowerCase() === b.toLowerCase();
}

/**
 * The next test build's names. Does not store anything: call noteTestBuilt once the file is written.
 * @param {String} name - the font name
 * @param {Object | null} dir - the folder font files go in, or null when none is picked yet
 * @param {{workId?: String}} [options] - workId: the work file's settings.project.id
 * @returns {Promise<{number: Number, family: String, fileName: String,
 *   earlier: {number: Number, family: String} | null, renamedFrom: Array<String>}>} earlier: the
 *   test build for the uninstall line in step 2 (after a rename, the old name's last one);
 *   renamedFrom: the work file's other names with test builds, newest first
 */
export async function nextTestBuild(name, dir, { workId = null } = {}) {
	const [stored, inFolder, builds] = await Promise.all([
		storedTestNumber(name),
		highestTestInFolder(dir, name),
		workTestBuilds(workId),
	]);
	const last = Math.max(stored, inFolder);
	const base = familyBase(name);
	const newest = builds[0];
	let earlier = last > 0 ? { number: last, family: testBuildNames(name, last).family } : null;
	if (newest && !sameBase(newest.base, base)) {
		earlier = { number: newest.number, family: testBuildNames(newest.base, newest.number).family };
	}
	return {
		...testBuildNames(name, last + 1),
		earlier,
		renamedFrom: builds.filter((entry) => !sameBase(entry.base, base)).map((entry) => entry.base),
	};
}

/**
 * B14 + B15 finalize: the work file's other names with test builds, for the final card's and
 * Help's clean-up lines after a rename.
 * @param {String} name - the font name now
 * @param {String} [workId] - the work file's settings.project.id
 * @returns {Promise<Array<String>>} bases, newest first; [] with no id or none
 */
export async function renamedTestNames(name, workId) {
	const base = familyBase(name);
	return (await workTestBuilds(workId))
		.filter((entry) => !sameBase(entry.base, base))
		.map((entry) => entry.base);
}

/**
 * Puts a test build first in the work file's list (one entry per base, at most MAX_BUILD_NAMES).
 * A list that can't be read or written is left as it is: it only words the card.
 */
async function noteWorkBuild(workId, name, number) {
	if (!workId || !wholeNumber(number)) return;
	try {
		const base = familyBase(name);
		const rest = (await workTestBuilds(workId)).filter((entry) => !sameBase(entry.base, base));
		const list = [{ base, number: wholeNumber(number) }, ...rest].slice(0, MAX_BUILD_NAMES);
		await kvSet(testBuildsKey(workId), list);
	} catch (error) {
		console.warn('ANY-INK could not remember the test build', error);
	}
}

/**
 * Remembers a test build that was written. Never lowers the stored number.
 * @param {String} name - the font name
 * @param {Number} number - the test number the file was made with
 * @param {{workId?: String}} [options] - workId: the work file's settings.project.id
 * @returns {Promise<Number>} the number now stored
 */
export async function noteTestBuilt(name, number, { workId = null } = {}) {
	await noteWorkBuild(workId, name, number);
	let stored;
	try {
		// strict: a failed read must not look like "nothing stored", or a lower number would win
		stored = wholeNumber(await kvGetStrict(testNumberKey(name)));
	} catch {
		return wholeNumber(number);
	}
	const next = Math.max(stored, wholeNumber(number));
	if (next !== stored) await kvSet(testNumberKey(name), next);
	return next;
}
