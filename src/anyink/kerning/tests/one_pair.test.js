// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B12 (UX-BEGINNER.md 4.6 Gap handle, "one-pair kern groups through kern_lookup"): the gap fixes
// Simple makes are one-pair rules (one left and one right letter). kern_lookup answers which
// group is a pair's own rule, what the pair would get without it, and lists every pair's rule.
// Written to fail first: kern_lookup had no one-pair helpers before B12.
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import {
	isGapFix,
	isSingleKernHex,
	kernOffsetFor,
	kernOffsetWithout,
	markGapFix,
	onePairFixes,
	onePairGroupID,
} from '../kern_lookup.js';

function fakeProject(groups, marks) {
	const kerning = {};
	Object.keys(groups).forEach((id) => {
		kerning[id] = new KernGroup(groups[id]);
	});
	const project = { kerning, settings: { anyink: {} } };
	if (marks) project.settings.anyink.gapFixes = marks;
	return project;
}

describe("a pair's own rule", () => {
	it('is the one-pair group for exactly those two letters, by letter or hex', () => {
		const project = fakeProject({
			'kern-0': { leftGroup: ['0x65', '0x6F'], rightGroup: ['0x6E'], value: -40 },
			'kern-1': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -90 },
		});
		expect(onePairGroupID(project, 'e', 'n')).toBe('kern-1');
		expect(onePairGroupID(project, '0x65', '0x6E')).toBe('kern-1');
		// o n is only in the class group: no rule of its own
		expect(onePairGroupID(project, 'o', 'n')).toBe('');
		expect(onePairGroupID(project, 'n', 'e')).toBe('');
		expect(onePairGroupID(null, 'e', 'n')).toBe('');
	});

	it('of two for one pair, the lowest id is the one the lookup uses', () => {
		const project = fakeProject({
			'kern-4': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -10 },
			'kern-2': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -70 },
		});
		expect(onePairGroupID(project, 'e', 'n')).toBe('kern-2');
		expect(kernOffsetFor(project, 'e', 'n')).toBe(-70);
	});
});

describe('what a pair gets without a group', () => {
	it('falls back to the class group under the rule, or 0', () => {
		const project = fakeProject({
			'kern-0': { leftGroup: ['0x65', '0x6F'], rightGroup: ['0x6E'], value: -40 },
			'kern-1': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -90 },
			'kern-2': { leftGroup: ['0x61'], rightGroup: ['0x76'], value: -30 },
		});
		expect(kernOffsetWithout(project, 'e', 'n', 'kern-1')).toBe(-40);
		expect(kernOffsetWithout(project, 'a', 'v', 'kern-2')).toBe(0);
		// leaving out a group that doesn't cover the pair changes nothing
		expect(kernOffsetWithout(project, 'e', 'n', 'kern-2')).toBe(-90);
		expect(kernOffsetWithout(project, 'e', 'n', '')).toBe(-90);
	});
});

describe('every gap fix', () => {
	it('lists each pair with a rule of its own once, in id order, with its live value', () => {
		const project = fakeProject(
			{
				'kern-0': { leftGroup: ['0x65', '0x6F'], rightGroup: ['0x6E'], value: -40 },
				'kern-3': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -120 },
				'kern-1': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -90 },
				'kern-5': { leftGroup: ['0x65'], rightGroup: ['0x6E'], value: 15 },
			},
			['0x65|0x6E', '0x41|0x56']
		);
		expect(onePairFixes(project)).toEqual([
			{ groupID: 'kern-1', left: '0x65', right: '0x6E', value: -90 },
			{ groupID: 'kern-3', left: '0x41', right: '0x56', value: -120 },
		]);
		project.kerning['kern-1'].value = 20;
		expect(onePairFixes(project)[0].value).toBe(20);
		expect(onePairFixes({})).toEqual([]);
	});
});

// B12 fix pass (finding: "'Gaps you fixed' lists every one-pair kern group, including hundreds from
// an imported font"). Written to fail first: onePairFixes listed every one-by-one group, and
// kern_lookup had no gap-fix mark.
describe('only the gap fixes Simple made', () => {
	it("leaves out an imported font's one-pair rules and joined letters, until the handle marks one", () => {
		const project = fakeProject({
			// an imported OTF: every GPOS pair is a one-by-one group
			'kern-0': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -80 },
			'kern-1': { leftGroup: ['0x54'], rightGroup: ['0x6F'], value: -60 },
			// a pair with joined letters (a ligature id)
			'kern-2': { leftGroup: ['0x660x69'], rightGroup: ['0x6E'], value: -20 },
		});
		expect(onePairFixes(project)).toEqual([]);
		expect(isGapFix(project, 'A', 'V')).toBe(false);
		markGapFix(project, 'A', 'V', true);
		expect(isGapFix(project, 'A', 'V')).toBe(true);
		expect(isGapFix(project, '0x41', '0x56')).toBe(true);
		expect(onePairFixes(project)).toEqual([
			{ groupID: 'kern-0', left: '0x41', right: '0x56', value: -80 },
		]);
		project.settings.anyink.gapFixes.push('0x660x69|0x6E');
		expect(onePairFixes(project)).toHaveLength(1);
		markGapFix(project, 'A', 'V', false);
		expect(onePairFixes(project)).toEqual([]);
		expect(isSingleKernHex('0x65')).toBe(true);
		expect(isSingleKernHex('0x660x69')).toBe(false);
		expect(isSingleKernHex('')).toBe(false);
	});

	it('drops the marks of pairs that lost their rule, and a project with no settings is safe', () => {
		const project = fakeProject({ 'kern-0': { leftGroup: ['0x65'], rightGroup: ['0x6E'] } }, [
			'0x6F|0x6E',
		]);
		markGapFix(project, 'e', 'n', true);
		expect(project.settings.anyink.gapFixes).toEqual(['0x65|0x6E']);
		expect(() => markGapFix({ kerning: {} }, 'e', 'n', true)).not.toThrow();
		expect(onePairFixes({ kerning: {} })).toEqual([]);
	});

	it('keeps its marks through a save and a load of the project', () => {
		const project = new GlyphrStudioProject();
		project.addItemByType(
			new KernGroup({ leftGroup: ['0x65'], rightGroup: ['0x6E'], value: -50 }),
			'KernGroup'
		);
		markGapFix(project, 'e', 'n', true);
		const loaded = new GlyphrStudioProject(JSON.parse(JSON.stringify(project.save())));
		expect(isGapFix(loaded, 'e', 'n')).toBe(true);
		expect(onePairFixes(loaded)).toEqual([
			expect.objectContaining({ left: '0x65', right: '0x6E', value: -50 }),
		]);
	});
});
