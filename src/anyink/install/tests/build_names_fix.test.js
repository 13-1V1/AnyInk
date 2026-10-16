// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B14 + B15 fix pass (names): a long font name is cut ONCE, at a word boundary, short enough for
// the longest test tail (" Test 999"), and that same base names every test build, the final font
// and the "search <name> Test" line, so Windows Settings > Fonts finds what the card says. After a
// rename the card still points at the old name's last test build, remembered per work file.
// Written to fail first: fitFamily cut per build ("Everyday Test 9", "Everyda Test 10") and the
// test number (with its "earlier" line) was kept per font name only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exampleNames } from '../../help/help_word_steps.js';
import { setStorageDriver } from '../../storage/kv.js';
import { fakeDriver } from '../../storage/tests/fake_driver.js';
import {
	MAX_FAMILY_LENGTH,
	familyBase,
	finalBuildNames,
	nextTestBuild,
	noteTestBuilt,
	testBuildNames,
	testNumberKey,
} from '../build_names.js';

let restoreDriver;
beforeEach(() => {
	restoreDriver = setStorageDriver(fakeDriver());
});
afterEach(() => restoreDriver());

const LONG = 'Brennan Meyer’s Everyday Handwriting';

describe('a long name is cut once, at a word boundary', () => {
	// B14 + B15 finalize: the final font is cut at a word to 31, not to the test base (two names
	// that share a test base must not become one font in Word: use_in_word_finalize.test.js)
	it('every test build and the search share one base; the final font is cut at a word to 31', () => {
		const base = familyBase(LONG);
		expect(base).toBe('Brennan Meyer’s');
		expect(testBuildNames(LONG, 9).family).toBe(`${base} Test 9`);
		expect(testBuildNames(LONG, 10).family).toBe(`${base} Test 10`);
		expect(testBuildNames(LONG, 999).family).toBe(`${base} Test 999`);
		expect(finalBuildNames(LONG).family).toBe('Brennan Meyer’s Everyday');
	});

	it('the base leaves room for " Test 999" inside 31', () => {
		for (const name of [LONG, 'Brennan Meyer Everyday Handwriting Font', 'x'.repeat(64)]) {
			expect(testBuildNames(name, 999).family.length).toBeLessThanOrEqual(MAX_FAMILY_LENGTH);
			expect(familyBase(name).length).toBeLessThanOrEqual(MAX_FAMILY_LENGTH - ' Test 999'.length);
		}
	});

	it('a name that fits is left whole, as is a word that ends right at the limit', () => {
		expect(familyBase('Brennan Hand')).toBe('Brennan Hand');
		expect(familyBase('Brennan Meyer Everyday Handwriting Font')).toBe('Brennan Meyer Everyday');
	});

	it('one very long word is cut inside the word, never splitting a letter', () => {
		expect(familyBase('x'.repeat(64))).toBe('x'.repeat(22));
		const emoji = 'a'.repeat(21) + '\u{1F58B}' + 'b';
		expect(familyBase(emoji)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
	});

	it('a cut that would keep only a short first word cuts inside the next word instead', () => {
		const base = familyBase('A Supercalifragilisticexpialidocious');
		expect(base.startsWith('A Supercali')).toBe(true);
		expect(base.length).toBe(22);
	});

	it('no dash or comma is left hanging where it was cut', () => {
		expect(familyBase('Brennan Meyer - Everyday Handwriting')).toBe('Brennan Meyer');
		expect(familyBase('Brennan Meyer, Everyday Handwriting')).toBe('Brennan Meyer');
	});

	it("Help's clean-up step searches the same base the fonts are named with", () => {
		const names = exampleNames(LONG);
		expect(names.testName).toBe(`${familyBase(LONG)} Test 1`);
		expect(names.finalName).toBe(finalBuildNames(LONG).family);
		expect(names.search).toBe(`${familyBase(LONG)} Test`);
	});

	it('two long names with the same base count up together, so Word never gets two of one name', async () => {
		const other = 'Brennan Meyer’s Everyday Print';
		expect(familyBase(other)).toBe(familyBase(LONG));
		expect(testNumberKey(other)).toBe(testNumberKey(LONG));
		await noteTestBuilt(LONG, 3);
		expect((await nextTestBuild(other, null)).family).toBe(`${familyBase(LONG)} Test 4`);
	});
});

describe('after a rename, the card names the old test build', () => {
	const workId = 'g2_BRENNANHAND';

	it('the first build under the new name points at the last one under the old name', async () => {
		await noteTestBuilt('Brennan Hand', 1, { workId });
		await noteTestBuilt('Brennan Hand', 2, { workId });
		const build = await nextTestBuild('Brennan Script', null, { workId });
		expect(build.number).toBe(1);
		expect(build.family).toBe('Brennan Script Test 1');
		expect(build.earlier).toEqual({ number: 2, family: 'Brennan Hand Test 2' });
		expect(build.renamedFrom).toEqual(['Brennan Hand']);
	});

	it('the next build under the new name points at its own last one, and still lists the old name', async () => {
		await noteTestBuilt('Brennan Hand', 2, { workId });
		await noteTestBuilt('Brennan Script', 1, { workId });
		const build = await nextTestBuild('Brennan Script', null, { workId });
		expect(build.number).toBe(2);
		expect(build.earlier).toEqual({ number: 1, family: 'Brennan Script Test 1' });
		expect(build.renamedFrom).toEqual(['Brennan Hand']);
	});

	it('renamed back: the newest build made for this work file is the one named', async () => {
		await noteTestBuilt('Brennan Hand', 2, { workId });
		await noteTestBuilt('Brennan Script', 1, { workId });
		const build = await nextTestBuild('Brennan Hand', null, { workId });
		expect(build.number).toBe(3);
		expect(build.earlier).toEqual({ number: 1, family: 'Brennan Script Test 1' });
		expect(build.renamedFrom).toEqual(['Brennan Script']);
	});

	it('another work file never sees these names', async () => {
		await noteTestBuilt('Brennan Hand', 2, { workId });
		const build = await nextTestBuild('Pat Script', null, { workId: 'g2_OTHER' });
		expect(build.earlier).toBeNull();
		expect(build.renamedFrom).toEqual([]);
	});

	it('with no work file id it is as before: only this name counts', async () => {
		await noteTestBuilt('Brennan Hand', 2);
		const build = await nextTestBuild('Brennan Script', null);
		expect(build.earlier).toBeNull();
		expect(build.renamedFrom).toEqual([]);
	});
});
