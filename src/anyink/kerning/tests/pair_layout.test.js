// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import { KernGroup } from '../../../project_data/kern_group.js';
import { caseOfHex, contextCharsFor, layoutPairView, pickContextGlyph } from '../pair_layout.js';
import { getRepresentatives, kernPairState, resetKernPairState, setRepresentative } from '../pair_state.js';

/** Minimal project stand-in: glyphs with advanceWidth and shapes, plus kerning. */
function fakeProject(glyphs, kerning = {}) {
	const items = {};
	Object.keys(glyphs).forEach((hex) => {
		const [advanceWidth, hasInk = true] = glyphs[hex];
		items[`glyph-${hex}`] = { id: `glyph-${hex}`, advanceWidth, shapes: hasInk ? [{}] : [] };
	});
	return {
		defaultAdvanceWidth: 500,
		kerning,
		getItem(id) {
			return items[id] || false;
		},
	};
}

describe('pair_layout: case and context characters', () => {
	it('caseOfHex', () => {
		expect(caseOfHex('0x61')).toBe('lower'); // a
		expect(caseOfHex('0x41')).toBe('upper'); // A
		expect(caseOfHex('0x31')).toBe('other'); // 1
		expect(caseOfHex('0x2E')).toBe('other'); // .
		expect(caseOfHex('')).toBe('other');
		expect(caseOfHex(undefined)).toBe('other');
	});

	it('contextCharsFor prefers n / H and falls back to o / O', () => {
		expect(contextCharsFor('0x61')).toEqual(['n', 'o']);
		expect(contextCharsFor('0x41')).toEqual(['H', 'O']);
		expect(contextCharsFor('0x31')[0]).toBe('o');
	});

	it('pickContextGlyph takes the first existing glyph with ink, or false', () => {
		const withN = fakeProject({ '0x6E': [520], '0x6F': [540] });
		expect(pickContextGlyph(withN, '0x61').id).toBe('glyph-0x6E');
		const onlyO = fakeProject({ '0x6E': [520, false], '0x6F': [540] });
		expect(pickContextGlyph(onlyO, '0x61').id).toBe('glyph-0x6F');
		const upper = fakeProject({ '0x48': [700], '0x4F': [720] });
		expect(pickContextGlyph(upper, '0x41').id).toBe('glyph-0x48');
		expect(pickContextGlyph(fakeProject({}), '0x41')).toBe(false);
		expect(pickContextGlyph(undefined, '0x41')).toBe(false);
	});
});

describe('pair_layout: layoutPairView', () => {
	const kern = (a, b) => (a === '0x48' && b === '0x41' ? -30 : a === '0x56' && b === '0x48' ? 10 : 0);

	it('places the left glyph ending at 0, the right at value, samples outward with kerning', () => {
		const project = fakeProject({ '0x41': [600], '0x56': [650], '0x48': [700] });
		const group = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'], value: -80 });
		const layout = layoutPairView(project, group, { left: '0x41', right: '0x56' }, kern);
		expect(layout.value).toBe(-80);
		expect(layout.left.x).toBe(-600);
		expect(layout.left.glyph.id).toBe('glyph-0x41');
		expect(layout.right.x).toBe(-80);
		// H before A: x = -600 - kern(H,A) - H.advance = -600 + 30 - 700
		expect(layout.leftContext.glyph.id).toBe('glyph-0x48');
		expect(layout.leftContext.x).toBe(-1270);
		// H after V: x = value + V.advance + kern(V,H) = -80 + 650 + 10
		expect(layout.rightContext.x).toBe(580);
	});

	it('uses the default advance width for a missing glyph and skips missing samples', () => {
		const project = fakeProject({ '0x56': [650] });
		const group = new KernGroup({ leftGroup: ['0x41'], rightGroup: ['0x56'], value: 0 });
		const layout = layoutPairView(project, group, { left: '0x41', right: '0x56' }, kern);
		expect(layout.left.glyph).toBe(false);
		expect(layout.left.x).toBe(-500);
		expect(layout.leftContext).toBeNull();
		expect(layout.rightContext).toBeNull();
	});

	it('returns an empty layout without a project or group', () => {
		expect(layoutPairView(undefined, undefined, { left: false, right: false })).toEqual({
			value: 0,
			left: null,
			right: null,
			leftContext: null,
			rightContext: null,
		});
	});
});

describe('pair_state: representatives', () => {
	const group = new KernGroup({ leftGroup: ['0x41', '0x42'], rightGroup: ['0x56', '0x57'], value: 0 });
	group.id = 'kern-9';

	beforeEach(() => resetKernPairState());

	it('defaults to the first member of each side', () => {
		expect(getRepresentatives(group)).toEqual({ left: '0x41', right: '0x56' });
		expect(getRepresentatives(undefined)).toEqual({ left: false, right: false });
	});

	it('remembers a chosen member per group and side', () => {
		expect(setRepresentative(group, 'right', '0x57')).toBe(true);
		expect(getRepresentatives(group)).toEqual({ left: '0x41', right: '0x57' });
		expect(setRepresentative(group, 'right', '0x57')).toBe(false); // unchanged
		expect(setRepresentative(group, 'left', '0x99')).toBe(false); // not a member
		expect(setRepresentative(group, 'middle', '0x41')).toBe(false);
	});

	it('falls back when the remembered member leaves the group', () => {
		setRepresentative(group, 'left', '0x42');
		group.leftGroup = ['0x41'];
		expect(getRepresentatives(group).left).toBe('0x41');
		group.leftGroup = ['0x41', '0x42'];
	});

	it('resetKernPairState clears hover, dragging, and memory', () => {
		kernPairState.hover = true;
		kernPairState.dragging = true;
		setRepresentative(group, 'left', '0x42');
		resetKernPairState();
		expect(kernPairState).toEqual({ hover: false, dragging: false, representative: {} });
	});
});
