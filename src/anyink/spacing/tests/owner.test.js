// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 (UX-BEGINNER 7.2 "Spacing owner flag"): glyph.anyink.spacing is 'auto' or 'manual'; absent
// means manual, so old and imported fonts are never re-spaced behind his back. Any change to a
// letter's left space or width made by hand flips an automatic letter to manual.
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import {
	OWNER,
	flipToManualIfChanged,
	getSpacingOwner,
	hasSpacingOwner,
	isAutomatic,
	markAuto,
	markManual,
	setSpacingOwner,
	spacingChanged,
	spacingOf,
} from '../owner.js';
import { letter, rect, spacingProject } from './fixtures.js';

const box = () =>
	new Glyph({ id: 'glyph-0x48', shapes: [rect(88, 0, 600, 700)], advanceWidth: 776 });

describe('the owner flag', () => {
	it('has an owner only when it says auto or manual', () => {
		expect(hasSpacingOwner(box())).toBe(false);
		expect(hasSpacingOwner(null)).toBe(false);
		expect(hasSpacingOwner({ anyink: { spacing: 'sideways' } })).toBe(false);
		expect(hasSpacingOwner({ anyink: { spacing: 'auto' } })).toBe(true);
		expect(hasSpacingOwner({ anyink: { spacing: 'manual' } })).toBe(true);
	});

	it('reads absent, missing or unknown as manual', () => {
		expect(OWNER).toEqual({ auto: 'auto', manual: 'manual' });
		expect(getSpacingOwner(box())).toBe('manual');
		expect(getSpacingOwner({ anyink: { spacing: 'sideways' } })).toBe('manual');
		expect(getSpacingOwner(null)).toBe('manual');
		const auto = box();
		auto.anyink.spacing = 'auto';
		expect(getSpacingOwner(auto)).toBe('auto');
		expect(isAutomatic(auto)).toBe(true);
	});

	it('is set only to a known value, and says when it changed', () => {
		const item = box();
		expect(setSpacingOwner(item, 'auto')).toBe(true);
		expect(item.anyink.spacing).toBe('auto');
		expect(setSpacingOwner(item, 'auto')).toBe(false);
		expect(setSpacingOwner(item, 'later')).toBe(false);
		expect(item.anyink.spacing).toBe('auto');
		expect(setSpacingOwner(null, 'auto')).toBe(false);
	});

	it('markManual flips only an automatic letter; an old letter is left exactly as it was', () => {
		const old = box();
		const before = JSON.stringify(old.save());
		expect(markManual(old)).toBe(false);
		expect(JSON.stringify(old.save())).toBe(before);
		const auto = box();
		markAuto(auto);
		expect(markManual(auto)).toBe(true);
		expect(auto.anyink.spacing).toBe('manual');
		expect(markManual(auto)).toBe(false);
	});

	it('is kept by a save and a reload of the font', () => {
		const project = spacingProject(2048, { n: { anyink: { spacing: 'auto' } }, o: {} });
		const reloaded = new GlyphrStudioProject(project.save());
		expect(getSpacingOwner(letter(reloaded, 'n'))).toBe('auto');
		expect(getSpacingOwner(letter(reloaded, 'o'))).toBe('manual');
		expect(project.save().glyphs[letter(project, 'o').id].anyink).toBeUndefined();
	});
});

describe('who sets manual', () => {
	it('a sideways move or a width change is a spacing change; an up-down move is not', () => {
		const item = box();
		const before = spacingOf(item);
		expect(before).toEqual({ left: 88, width: 776 });
		item.updateGlyphPosition(0, 40);
		expect(spacingChanged(before, spacingOf(item))).toBe(false);
		item.updateGlyphPosition(12, 0);
		expect(spacingChanged(before, spacingOf(item))).toBe(true);
		const other = box();
		other.advanceWidth = 800;
		expect(spacingChanged(before, spacingOf(other))).toBe(true);
		// Rounding noise is not a change
		expect(spacingChanged({ left: 88, width: 776 }, { left: 88.3, width: 776 })).toBe(false);
	});

	it('a letter with no ink has its width as its only spacing', () => {
		const empty = new Glyph({ id: 'glyph-0x20', advanceWidth: 512 });
		expect(spacingOf(empty)).toEqual({ left: 0, width: 512 });
	});

	it('flipToManualIfChanged flips an automatic letter that was changed by hand', () => {
		const item = box();
		markAuto(item);
		const before = spacingOf(item);
		expect(flipToManualIfChanged(item, before)).toBe(false);
		expect(isAutomatic(item)).toBe(true);
		item.updateGlyphPosition(-20, 0);
		expect(flipToManualIfChanged(item, before)).toBe(true);
		expect(getSpacingOwner(item)).toBe('manual');
		// A manual letter stays manual, an old one gets no flag
		const old = box();
		old.updateGlyphPosition(5, 0);
		expect(flipToManualIfChanged(old, before)).toBe(false);
		expect(old.anyink.spacing).toBeUndefined();
	});
});
