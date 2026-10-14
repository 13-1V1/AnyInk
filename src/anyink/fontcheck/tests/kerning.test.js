// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1 fix: kerning and the font file. A kern value typed on the Kerning page is stored as
	typed (12.5, or 40,000), and the font file holds only whole numbers from -32,768 to
	32,767, so one typed value stopped the whole export. Now the export writes each value
	the way the font file can hold it (rounded, and pulled into range), whole-number values
	write exactly the bytes they did before, and the check names a pair whose value had
	to be pulled in. No mocks: real projects, the real exporter, the font file read back.
*/
import { FontFlux } from 'font-flux-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ioFont_exportFont } from '../../../formats_io/otf/font_export.js';
import { resetFileApi, setFileApi } from '../../files/file_api.js';
import { clearDialogs, fakeApi } from '../../files/tests/fakes.js';
import { forgetExportFolder } from '../../files/export_folder.js';
import { kvClear } from '../../storage/kv.js';
import { getExportKerning, kernValue, MAX_KERN, MIN_KERN } from '../export_kerning.js';
import { PROBLEM, validateFont } from '../validate.js';
import { kernSubject } from '../validate_kerning.js';
import { edgeProjectJSON, openProject } from './fixtures.js';

// jsdom has no Web Animations API; upstream's toast close path calls element.animate()
if (!Element.prototype.animate) Element.prototype.animate = () => ({});

/** The edge project (A B C D b é, kern-0 = A then B, -50) with kern-0 changed. */
function openKern(change = {}, app = {}) {
	const json = edgeProjectJSON({ app });
	Object.assign(json.kerning['kern-0'], change);
	return openProject(json);
}

/** Every kern pair in the exported font file, read back. */
async function exportedPairs(suffix = 'otf') {
	const buffer = await ioFont_exportFont(suffix, true);
	const font = FontFlux.open(buffer);
	return (font.kerning || []).map(({ left, right, value }) => [left, right, value]);
}

const TOO_BIG = {
	itemId: 'kern-0',
	problem: PROBLEM.kern,
	message: 'The gap between Capital A and Capital B is moved further than the font file can hold.',
};

let warn;
let error;
beforeEach(async () => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	error = vi.spyOn(console, 'error').mockImplementation(() => {});
	await kvClear();
	await forgetExportFolder();
	clearDialogs();
});
afterEach(() => {
	warn.mockRestore();
	error.mockRestore();
	resetFileApi();
	clearDialogs();
});

describe('kernValue: the number the font file holds', () => {
	it('whole numbers in range stay exactly as they are', () => {
		expect(kernValue(-50)).toBe(-50);
		expect(kernValue(0)).toBe(0);
		expect(kernValue(MIN_KERN)).toBe(-32768);
		expect(kernValue(MAX_KERN)).toBe(32767);
	});

	it('rounds like the exporter rounds points', () => {
		expect(kernValue(12.5)).toBe(13);
		expect(kernValue(12.4)).toBe(12);
		expect(kernValue(-12.5)).toBe(-12);
	});

	it('pulls a value the font file cannot hold into range', () => {
		expect(kernValue(40000)).toBe(32767);
		expect(kernValue(-40000)).toBe(-32768);
		expect(kernValue(32767.6)).toBe(32767);
	});

	it('anything that is not a number is no pair at all', () => {
		expect(kernValue(Infinity)).toBe(0);
		expect(kernValue(NaN)).toBe(0);
		expect(kernValue('12')).toBe(0);
		expect(kernValue(undefined)).toBe(0);
	});

	it('getExportKerning leaves the project alone', () => {
		const { project } = openKern({ value: 12.5 });
		const kerning = getExportKerning(project);
		expect(kerning['kern-0'].value).toBe(13);
		expect(kerning['kern-0'].leftGroup).toEqual(['0x41']);
		expect(kerning['kern-0'].rightGroup).toEqual(['0x42']);
		expect(project.kerning['kern-0'].value).toBe(12.5);
	});
});

describe('a typed decimal: the export, the font file and the check agree', () => {
	it('12.5: the font file is made, holds 13, and the check has nothing to say', async () => {
		const { project } = openKern({ value: 12.5 });
		for (const suffix of ['otf', 'ttf']) {
			expect(await exportedPairs(suffix)).toEqual([['uni0041', 'uni0042', 13]]);
		}
		expect(validateFont(project)).toEqual([]);
		// the project still holds what was typed: rounding is the font file's business
		expect(project.kerning['kern-0'].value).toBe(12.5);
	});

	it('the File menu export makes the font file instead of showing an error box', async () => {
		openKern({ value: 12.5 });
		const api = fakeApi({});
		setFileApi(api);
		expect(await ioFont_exportFont('otf')).toBe('download');
		expect(api.calls.download).toHaveLength(1);
		expect(document.querySelector('#error')).toBeNull();
	});

	it('a group of letters is rounded the same way', async () => {
		const { project } = openKern({
			leftGroup: ['0x41', '0x44'],
			rightGroup: ['0x42'],
			value: -7.5,
		});
		const buffer = await ioFont_exportFont('otf', true);
		const classes = FontFlux.open(buffer).data?.kerningClasses ?? [];
		const values = classes.flatMap((entry) => entry.pairs.map((pair) => pair.value));
		const pairs = (FontFlux.open(buffer).kerning || []).map((pair) => pair.value);
		expect([...values, ...pairs]).toContain(-7);
		expect([...values, ...pairs]).not.toContain(-7.5);
		expect(validateFont(project)).toEqual([]);
	});
});

describe('a value the font file cannot hold', () => {
	it('40,000: the font file holds 32,767 and the check names the pair', async () => {
		const { project } = openKern({ value: 40000 });
		expect(await exportedPairs()).toEqual([['uni0041', 'uni0042', 32767]]);
		expect(validateFont(project)).toEqual([TOO_BIG]);
	});

	it('-40,000: the font file holds -32,768 and the check names the pair', async () => {
		const { project } = openKern({ value: -40000 });
		expect(await exportedPairs()).toEqual([['uni0041', 'uni0042', -32768]]);
		expect(validateFont(project)).toEqual([TOO_BIG]);
	});

	it('-32,768 and 32,767 fit', () => {
		expect(validateFont(openKern({ value: -32768 }).project)).toEqual([]);
		expect(validateFont(openKern({ value: 32767 }).project)).toEqual([]);
		expect(validateFont(openKern({ value: 32767.4 }).project)).toEqual([]);
		expect(validateFont(openKern({ value: 32767.5 }).project)).toEqual([TOO_BIG]);
	});

	it('a value that is no number at all: no pair in the font file, and the check names it', async () => {
		// typing "Infinity" in the value field stores it (a saved file would turn it into 0)
		const { project } = openKern();
		project.kerning['kern-0'].value = Infinity;
		expect(await exportedPairs()).toEqual([]);
		expect(validateFont(project)).toEqual([TOO_BIG]);
	});

	it('kerning comes after the letters, in the project order', () => {
		const json = edgeProjectJSON();
		json.kerning['kern-0'].value = 50000;
		json.glyphs['glyph-0x61'] = { id: 'glyph-0x61', advanceWidth: 0, shapes: [] };
		json.glyphs['glyph-0x61'].shapes.push({
			name: 'Square',
			pathPoints: [
				{ p: { coord: { x: 0, y: 0 } } },
				{ p: { coord: { x: 100, y: 0 } } },
				{ p: { coord: { x: 100, y: 100 } } },
			],
		});
		const { project } = openProject(json);
		expect(validateFont(project).map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x61', PROBLEM.inkNoWidth],
			['kern-0', PROBLEM.kern],
		]);
	});
});

describe('only kerning the font file will hold', () => {
	it('a pair whose letters are not in the font file is not named', () => {
		// é is in a letter range that is off
		const { project } = openKern({ rightGroup: ['0xE9'], value: 40000 });
		expect(validateFont(project)).toEqual([]);
	});

	it('nothing is named when kerning is not exported', () => {
		const { project } = openKern({ value: 40000 }, { exportKerning: false });
		expect(validateFont(project)).toEqual([]);
	});

	it('a value of 0 writes no pair and is not named', () => {
		const { project } = openKern({ value: 0 });
		expect(validateFont(project)).toEqual([]);
	});
});

describe('naming a pair in plain words', () => {
	it('one letter on each side', () => {
		const { project } = openKern();
		expect(kernSubject(project, 'kern-0')).toBe('the gap between Capital A and Capital B');
	});

	it('groups name their letters with "or", leaving out letters the font file does not hold', () => {
		const { project } = openKern({
			leftGroup: ['0x41', '0x44', '0xE9'],
			rightGroup: ['0x42', '0x62'],
		});
		expect(kernSubject(project, 'kern-0')).toBe(
			'the gap between Capital A or Capital D and Capital B or small b'
		);
	});

	it('a long group names three letters and counts the rest', () => {
		const { project } = openKern({
			leftGroup: ['0x41', '0x42', '0x43', '0x44', '0x62'],
			rightGroup: ['0x41'],
		});
		expect(kernSubject(project, 'kern-0')).toBe(
			'the gap between Capital A, Capital B, Capital C or 2 more and Capital A'
		);
	});

	it('an id that is not a kern pair has no name', () => {
		const { project } = openKern();
		expect(kernSubject(project, 'kern-404')).toBe('');
		expect(kernSubject(project, 'glyph-0x41')).toBe('');
	});
});
