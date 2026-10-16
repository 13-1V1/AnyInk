// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 (UX-BEGINNER.md 4.7): the names of a test build and the final font. The test number lives in
// app storage (kv) keyed by font name and in the folder's own "Test<N>" files; it only counts up,
// never down after an Undo or a backup restore. Family names stay within 31 characters.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { twoLetterEditor } from '../../history/tests/two_letters.js';
import { kvGet, kvSet, setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	MAX_FAMILY_LENGTH,
	fileStem,
	finalBuildNames,
	fitFamily,
	highestTestInFolder,
	nextTestBuild,
	noteTestBuilt,
	storedTestNumber,
	testBuildNames,
	testNumberInFileName,
	testNumberKey,
} from '../build_names.js';

/** A folder handle with just what the scan reads: an async keys() over its file names. */
function folder(names, { failKeys = null } = {}) {
	return {
		kind: 'directory',
		name: 'My Fonts',
		async *keys() {
			if (failKeys) throw failKeys;
			for (const name of names) yield name;
		},
	};
}

let restoreDriver;
beforeEach(() => {
	restoreDriver = setStorageDriver(fakeDriver());
});
afterEach(() => restoreDriver());

describe('names', () => {
	it('a test build: family "<name> Test <n>", file "<NameNoSpaces>-Test<n>.otf"', () => {
		expect(testBuildNames('Brennan Hand', 3)).toEqual({
			number: 3,
			family: 'Brennan Hand Test 3',
			fileName: 'BrennanHand-Test3.otf',
		});
	});

	it('the final font: family "<name>", file "<NameNoSpaces>-Regular.otf"', () => {
		expect(finalBuildNames('Brennan Hand')).toEqual({
			family: 'Brennan Hand',
			fileName: 'BrennanHand-Regular.otf',
		});
	});

	it('extra spaces are tidied and characters Windows refuses leave the file name', () => {
		expect(testBuildNames('  Brennan   Hand ', 1).family).toBe('Brennan Hand Test 1');
		expect(fileStem('Brennan: Hand / "v2"?')).toBe('BrennanHandv2');
		expect(testBuildNames('A*B|C<D>', 2).fileName).toBe('ABCD-Test2.otf');
	});

	it('an empty name still gives a usable family and file', () => {
		const names = testBuildNames('   ', 1);
		expect(names.family).toBe('My Font Test 1');
		expect(names.fileName).toBe('MyFont-Test1.otf');
		expect(finalBuildNames('').fileName).toBe('MyFont-Regular.otf');
		expect(fileStem('???')).toBe('MyFont');
	});
});

describe('the 31-character limit', () => {
	const long = 'Brennan Meyer Everyday Handwriting Font';

	it('a long name is shortened before " Test n", never past 31 characters', () => {
		expect(MAX_FAMILY_LENGTH).toBe(31);
		const family = testBuildNames(long, 12).family;
		expect(family.length).toBeLessThanOrEqual(31);
		expect(family.endsWith(' Test 12')).toBe(true);
		expect(family).toBe('Brennan Meyer Everyday Test 12');
	});

	it('no space is left hanging where the name was cut', () => {
		expect(fitFamily('Brennan Meyer Everyday  Handwriting', ' Test 10')).toBe(
			'Brennan Meyer Everyday Test 10'
		);
	});

	// B14 + B15 finalize: the final family is cut once at a word boundary to 31 (here the same
	// words as the test base; a name that fits 31 stays whole: use_in_word_finalize.test.js)
	it('the final family is cut at a word boundary to 31', () => {
		const family = finalBuildNames(long).family;
		expect(family.length).toBeLessThanOrEqual(31);
		expect(family).toBe('Brennan Meyer Everyday');
	});

	it('a short name is left whole', () => {
		expect(fitFamily('Brennan Hand', ' Test 3')).toBe('Brennan Hand Test 3');
		expect(fitFamily('Brennan Hand')).toBe('Brennan Hand');
	});

	it('a letter outside the basic set is never split in half', () => {
		const name = 'a'.repeat(23) + '\u{1F58B}' + 'b';
		const family = fitFamily(name, ' Test 1');
		expect(family.length).toBeLessThanOrEqual(31);
		expect(family).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
	});
});

describe('reading a number from a file name', () => {
	it('only this font\'s test files count, any case, with or without a "(2)" copy number', () => {
		expect(testNumberInFileName('BrennanHand-Test4.otf', 'Brennan Hand')).toBe(4);
		expect(testNumberInFileName('brennanhand-test7.OTF', 'Brennan Hand')).toBe(7);
		expect(testNumberInFileName('BrennanHand-Test5 (2).otf', 'Brennan Hand')).toBe(5);
		expect(testNumberInFileName('BrennanHand-Regular.otf', 'Brennan Hand')).toBe(0);
		expect(testNumberInFileName('OtherFont-Test9.otf', 'Brennan Hand')).toBe(0);
		expect(testNumberInFileName('BrennanHandBold-Test9.otf', 'Brennan Hand')).toBe(0);
		expect(testNumberInFileName('BrennanHand-Test.otf', 'Brennan Hand')).toBe(0);
		expect(testNumberInFileName('BrennanHand-Test3.gs2', 'Brennan Hand')).toBe(0);
	});
});

describe('the test number', () => {
	it('starts at 1 with nothing stored and an empty folder', async () => {
		const build = await nextTestBuild('Brennan Hand', folder([]));
		expect(build.number).toBe(1);
		expect(build.family).toBe('Brennan Hand Test 1');
		expect(build.fileName).toBe('BrennanHand-Test1.otf');
		expect(build.earlier).toBeNull();
	});

	it('"Test4" already in the folder makes the next one 5', async () => {
		const dir = folder([
			'BrennanHand-Test2.otf',
			'BrennanHand-Test4.otf',
			'notes.txt',
			'OtherFont-Test9.otf',
		]);
		expect(await highestTestInFolder(dir, 'Brennan Hand')).toBe(4);
		const build = await nextTestBuild('Brennan Hand', dir);
		expect(build.number).toBe(5);
		expect(build.earlier).toEqual({ number: 4, family: 'Brennan Hand Test 4' });
	});

	it('the stored number wins when it is the larger (he deleted the old files)', async () => {
		await noteTestBuilt('Brennan Hand', 6);
		const build = await nextTestBuild('Brennan Hand', folder(['BrennanHand-Test2.otf']));
		expect(build.number).toBe(7);
		expect(build.earlier.family).toBe('Brennan Hand Test 6');
	});

	it('works with no folder picked yet, from the stored number alone', async () => {
		await noteTestBuilt('Brennan Hand', 2);
		expect((await nextTestBuild('Brennan Hand', null)).number).toBe(3);
	});

	it('a folder that cannot be read counts as empty', async () => {
		const dir = folder(['BrennanHand-Test8.otf'], { failKeys: new Error('NotAllowedError') });
		expect(await highestTestInFolder(dir, 'Brennan Hand')).toBe(0);
		await noteTestBuilt('Brennan Hand', 1);
		expect((await nextTestBuild('Brennan Hand', dir)).number).toBe(2);
	});

	it('only counts up: noting a lower number keeps the higher one', async () => {
		await noteTestBuilt('Brennan Hand', 5);
		expect(await noteTestBuilt('Brennan Hand', 3)).toBe(5);
		expect(await storedTestNumber('Brennan Hand')).toBe(5);
	});

	it('a stored number that could not be read is never written over with a lower one', async () => {
		restoreDriver();
		const driver = fakeDriver();
		restoreDriver = setStorageDriver(driver);
		await noteTestBuilt('Brennan Hand', 5);
		driver.failNext(2, new Error('read failed'));
		await noteTestBuilt('Brennan Hand', 2);
		expect(await storedTestNumber('Brennan Hand')).toBe(5);
	});

	it('is keyed by font name (spaces and case tidied), so another font counts on its own', async () => {
		await noteTestBuilt('Brennan Hand', 3);
		expect(await storedTestNumber('  brennan   HAND ')).toBe(3);
		expect(await storedTestNumber('Pat Script')).toBe(0);
		expect(testNumberKey('Brennan Hand')).toBe(testNumberKey('brennan hand'));
	});

	it('asking for the next number does not use it up', async () => {
		await nextTestBuild('Brennan Hand', folder([]));
		await nextTestBuild('Brennan Hand', folder([]));
		expect(await storedTestNumber('Brennan Hand')).toBe(0);
		expect((await nextTestBuild('Brennan Hand', folder([]))).number).toBe(1);
	});

	it('a damaged stored value is read as 0', async () => {
		await kvSet(testNumberKey('Brennan Hand'), 'oops');
		expect(await storedTestNumber('Brennan Hand')).toBe(0);
		await kvSet(testNumberKey('Brennan Hand'), -4);
		expect(await storedTestNumber('Brennan Hand')).toBe(0);
		await kvSet(testNumberKey('Brennan Hand'), 2.7);
		expect(await storedTestNumber('Brennan Hand')).toBe(2);
	});
});

describe('never goes down after an Undo or a backup restore', () => {
	let warn;
	beforeEach(() => {
		document.title = 'ANY-INK';
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});
	afterEach(() => warn.mockRestore());

	it('Undo and Redo leave the number where it is, and nothing is written into the font', async () => {
		const editor = twoLetterEditor();
		const settings = editor.project.settings;
		settings.project.name = 'Brennan Hand';
		settings.font.family = 'Brennan Hand';
		editor.history.addSettingsState('named the font Brennan Hand');
		const before = JSON.stringify(editor.project.save());

		const first = await nextTestBuild(settings.project.name, folder([]));
		await noteTestBuilt(settings.project.name, first.number);
		expect(JSON.stringify(editor.project.save())).toBe(before);

		settings.anyink.letterSet = 'quick+numbers';
		editor.history.addSettingsState('added numbers & symbols');
		editor.history.restoreState();
		editor.history.restoreState();
		editor.history.redoState();
		expect(settings.project.name).toBe('Brennan Hand');
		expect((await nextTestBuild('Brennan Hand', folder([]))).number).toBe(2);
	});

	it('a backup copy put back (older work, same name) still gets the next number', async () => {
		await noteTestBuilt('Brennan Hand', 4);
		// the backup copy's own data says nothing of test builds; the folder may hold fewer files
		const build = await nextTestBuild('Brennan Hand', folder(['BrennanHand-Test1.otf']));
		expect(build.number).toBe(5);
		expect(await kvGet(testNumberKey('Brennan Hand'))).toBe(4);
	});
});
