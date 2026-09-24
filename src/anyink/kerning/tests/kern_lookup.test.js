// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { calculateKernOffset } from '../../../display_canvas/text_block.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { KernGroup } from '../../../project_data/kern_group.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';
import {
	buildKernLookup,
	getKernLookup,
	getKernLookupVersion,
	invalidateKernLookup,
	isOneByOne,
	kernGroupSortKey,
	kernOffsetFor,
	lookupKernPair,
	notifyKernPairsChanged,
	sortedKernGroupIDs,
	toKernHex,
} from '../kern_lookup.js';

/** A bare project-like object: only .kerning matters to the lookup. */
function fakeProject(groups) {
	const kerning = {};
	Object.keys(groups).forEach((id) => {
		kerning[id] = new KernGroup(groups[id]);
	});
	return { kerning };
}

describe('kern_lookup: helpers', () => {
	it('isOneByOne', () => {
		expect(isOneByOne(new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'] }))).toBe(true);
		expect(isOneByOne(new KernGroup({ leftGroup: ['0x41', '0x42'], rightGroup: ['0x56'] }))).toBe(false);
		expect(isOneByOne(undefined)).toBe(false);
	});

	it('sorts kern-N ids numerically, odd ids last', () => {
		expect(kernGroupSortKey('kern-7')).toBe(7);
		expect(kernGroupSortKey('kern-12')).toBe(12);
		expect(sortedKernGroupIDs({ 'kern-12': 1, custom: 1, 'kern-7': 1, 'kern-0': 1 })).toEqual([
			'kern-0',
			'kern-7',
			'kern-12',
			'custom',
		]);
	});

	it('toKernHex normalizes chars, hex, and unicode ids', () => {
		expect(toKernHex('A')).toBe('0x41');
		expect(toKernHex('0x41')).toBe('0x41');
		expect(toKernHex('0x0041')).toBe('0x41');
		expect(toKernHex('U+0041')).toBe('0x41');
		expect(toKernHex('')).toBe('');
	});
});

describe('kern_lookup: buildKernLookup priority', () => {
	it('keys are leftHex|rightHex with value and groupID', () => {
		const project = fakeProject({
			'kern-0': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x56'], value: -80 },
		});
		const map = buildKernLookup(project);
		expect(map.size).toBe(2);
		expect(map.get('0x41|0x56')).toMatchObject({ value: -80, groupID: 'kern-0' });
		expect(map.get('0x42|0x56')).toMatchObject({ value: -80, groupID: 'kern-0' });
	});

	it('one-by-one groups win over class groups regardless of id order', () => {
		const project = fakeProject({
			'kern-0': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x56', '0x57'], value: -80 },
			'kern-1': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -120 },
		});
		const map = buildKernLookup(project);
		expect(map.get('0x41|0x56')).toMatchObject({ value: -120, groupID: 'kern-1' });
		expect(map.get('0x42|0x56')).toMatchObject({ value: -80, groupID: 'kern-0' });

		const reversed = fakeProject({
			'kern-0': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -120 },
			'kern-1': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x56', '0x57'], value: -80 },
		});
		expect(buildKernLookup(reversed).get('0x41|0x56')).toMatchObject({ value: -120, groupID: 'kern-0' });
	});

	it('among class groups the lowest kern-N id wins', () => {
		const project = fakeProject({
			'kern-12': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x56'], value: -10 },
			'kern-3': { leftGroup: ['0x41', '0x43'], rightGroup: ['0x56'], value: -30 },
		});
		expect(buildKernLookup(project).get('0x41|0x56')).toMatchObject({ value: -30, groupID: 'kern-3' });
	});

	it('among one-by-one groups the lowest kern-N id wins', () => {
		const project = fakeProject({
			'kern-5': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -50 },
			'kern-2': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -20 },
		});
		expect(buildKernLookup(project).get('0x41|0x56')).toMatchObject({ value: -20, groupID: 'kern-2' });
	});

	it('handles an empty or missing kerning collection', () => {
		expect(buildKernLookup({ kerning: {} }).size).toBe(0);
		expect(buildKernLookup({}).size).toBe(0);
		expect(buildKernLookup(undefined).size).toBe(0);
	});
});

describe('kern_lookup: cache', () => {
	let project;
	beforeEach(() => {
		project = fakeProject({
			'kern-0': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -100 },
		});
	});

	it('caches on the project under a non-enumerable property', () => {
		const first = getKernLookup(project);
		expect(getKernLookup(project)).toBe(first);
		expect(Object.keys(project)).toEqual(['kerning']);
		expect(JSON.stringify(project)).not.toContain('anyink');
	});

	it('invalidateKernLookup bumps the version and rebuilds', () => {
		const first = getKernLookup(project);
		const before = getKernLookupVersion();
		invalidateKernLookup();
		expect(getKernLookupVersion()).toBe(before + 1);
		const second = getKernLookup(project);
		expect(second).not.toBe(first);
		expect(second.get('0x41|0x56')).toMatchObject({ value: -100 });
	});

	it('rebuilds when a group is added or removed without an invalidation', () => {
		const first = getKernLookup(project);
		project.kerning['kern-1'] = new KernGroup({ leftGroup: ['0x42'], rightGroup: ['0x56'], value: -5 });
		const second = getKernLookup(project);
		expect(second).not.toBe(first);
		expect(second.get('0x42|0x56')).toMatchObject({ groupID: 'kern-1' });
		delete project.kerning['kern-1'];
		expect(getKernLookup(project).has('0x42|0x56')).toBe(false);
	});

	it('rebuilds when a group object is swapped (undo) or its members are reassigned', () => {
		const first = getKernLookup(project);
		project.kerning['kern-0'] = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x57'], value: -7 });
		const second = getKernLookup(project);
		expect(second).not.toBe(first);
		expect(second.has('0x41|0x56')).toBe(false);
		expect(second.get('0x41|0x57')).toMatchObject({ value: -7 });

		project.kerning['kern-0'].rightGroup = ['0x58'];
		const third = getKernLookup(project);
		expect(third).not.toBe(second);
		expect(third.has('0x41|0x58')).toBe(true);
	});

	it('kernOffsetFor reads the value live from the group', () => {
		expect(kernOffsetFor(project, 'A', 'V')).toBe(-100);
		project.kerning['kern-0'].value = -42; // a drag tick: no invalidation
		expect(kernOffsetFor(project, 'A', 'V')).toBe(-42);
		expect(kernOffsetFor(project, '0x41', '0x56')).toBe(-42);
		expect(kernOffsetFor(project, 'A', 'Z')).toBe(0);
		expect(kernOffsetFor(project, '', 'V')).toBe(0);
		expect(kernOffsetFor(undefined, 'A', 'V')).toBe(0);
	});

	it('lookupKernPair returns null for unknown pairs', () => {
		expect(lookupKernPair(project, 'A', 'V')).toMatchObject({ groupID: 'kern-0' });
		expect(lookupKernPair(project, 'Z', 'V')).toBeNull();
		expect(lookupKernPair(project, 'AB', 'V')).toBeNull();
	});

	it('notifyKernPairsChanged invalidates and publishes kernPairs', () => {
		const before = getKernLookupVersion();
		const editor = { publish: vi.fn() };
		notifyKernPairsChanged(editor, { groupID: 'kern-0', value: -1 });
		expect(getKernLookupVersion()).toBe(before + 1);
		expect(editor.publish).toHaveBeenCalledWith('kernPairs', {
			version: before + 1,
			dragging: false,
			groupID: 'kern-0',
			value: -1,
		});
		expect(() => notifyKernPairsChanged(undefined)).not.toThrow();
	});
});

describe('kern_lookup: calculateKernOffset through a GlyphrStudioProject', () => {
	let project;
	beforeEach(() => {
		project = new GlyphrStudioProject(structuredClone(simpleExampleProject));
		setCurrentProjectEditor(new ProjectEditor({ project }));
	});

	it('finds the sample project pairs and returns 0 for others', () => {
		// kern-0: A B C | C = -100 ; kern-1: Q R S | S = -100 ; kern-2: A..I Q R S | S = -100
		expect(calculateKernOffset('A', 'C')).toBe(-100);
		expect(calculateKernOffset('B', 'C')).toBe(-100);
		expect(calculateKernOffset('Q', 'S')).toBe(-100);
		expect(calculateKernOffset('A', 'S')).toBe(-100);
		expect(calculateKernOffset('A', 'B')).toBe(0);
		expect(calculateKernOffset('C', 'A')).toBe(0);
		expect(calculateKernOffset('', 'A')).toBe(0);
		expect(calculateKernOffset('A', undefined)).toBe(0);
	});

	it('an exception group added later beats the class group for its pair only', () => {
		project.kerning['kern-3'] = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x43'], value: -25 });
		expect(calculateKernOffset('A', 'C')).toBe(-25);
		expect(calculateKernOffset('B', 'C')).toBe(-100);
		expect(lookupKernPair(project, 'A', 'C')).toMatchObject({ groupID: 'kern-3', exception: true });
	});

	it('the pair Q S is covered by kern-1 and kern-2; the lower id wins deterministically', () => {
		project.kerning['kern-2'].value = -300;
		expect(calculateKernOffset('Q', 'S')).toBe(-100);
		expect(lookupKernPair(project, 'Q', 'S').groupID).toBe('kern-1');
		expect(calculateKernOffset('D', 'S')).toBe(-300);
	});

	it('a value change on the winning group shows up without invalidation', () => {
		project.kerning['kern-0'].value = -60;
		expect(calculateKernOffset('A', 'C')).toBe(-60);
	});
});
