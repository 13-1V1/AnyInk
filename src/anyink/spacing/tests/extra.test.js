// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 (UX-BEGINNER 4.6): where the letter-spacing extra is kept. The font's value lives in
// settings.anyink.spacing = { extra }; each letter keeps how much of it its sides have now, so
// moving the slider back gives every letter exactly its own spacing again.
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { setExtra } from '../auto_space.js';
import { appliedExtra, extraRange, getExtra, recordApplied, storeExtra } from '../extra.js';
import { letter, spacingProject } from './fixtures.js';

describe("the font's extra", () => {
	it('is 0 when the font has none, and is read whole and inside -G..+G', () => {
		const project = spacingProject(2048, {});
		expect(getExtra(project)).toBe(0);
		project.settings.anyink.spacing = { extra: 30.6 };
		expect(getExtra(project)).toBe(31);
		project.settings.anyink.spacing = { extra: 500 };
		expect(getExtra(project)).toBe(88);
		project.settings.anyink.spacing = { extra: 'lots' };
		expect(getExtra(project)).toBe(0);
		expect(getExtra(null)).toBe(0);
	});

	it('is stored without losing other spacing settings', () => {
		const project = spacingProject(1000, {});
		project.settings.anyink.spacing = { extra: 3, later: true };
		storeExtra(project, -12);
		expect(project.settings.anyink.spacing).toEqual({ extra: -12, later: true });
	});

	it('has the slider ends -G and +G, from the font or the project', () => {
		const project = spacingProject(1000, {});
		expect(extraRange(project)).toEqual({ min: -40, max: 40 });
		expect(extraRange(project.settings.font)).toEqual({ min: -40, max: 40 });
	});

	it('survives a save and a load of the work file', () => {
		const project = spacingProject(2048, { n: {} });
		setExtra(project, -20);
		const reloaded = new GlyphrStudioProject(project.save());
		expect(getExtra(reloaded)).toBe(-20);
	});

	it("even when the font's value is lost, each letter's own spacing comes back", () => {
		// n's ink runs from 100 to 980: 100 units of space on each side
		const project = spacingProject(2048, {
			n: { anyink: { spacing: 'manual' }, advanceWidth: 1080 },
		});
		const before = JSON.stringify(letter(project, 'n').save());
		setExtra(project, -20);
		// A work file that lost the font's value (written before the template knew it): the
		// letters still keep their share
		const reloaded = new GlyphrStudioProject(project.save());
		delete reloaded.settings.anyink.spacing;
		expect(appliedExtra(letter(reloaded, 'n'), getExtra(reloaded))).toEqual({
			left: -20,
			right: -20,
		});
		setExtra(reloaded, 0);
		expect(JSON.stringify(letter(reloaded, 'n').save())).toBe(before);
	});
});

describe('a letter he left with no width', () => {
	it('keeps no width while the slider moves, and gets its spacing back exactly', () => {
		const project = spacingProject(2048, {
			n: { anyink: { spacing: 'manual' }, advanceWidth: 0 },
		});
		const n = letter(project, 'n');
		const before = JSON.stringify(n.save());
		setExtra(project, -88);
		expect(n.advanceWidth).toBe(0);
		setExtra(project, 88);
		setExtra(project, 0);
		expect(JSON.stringify(n.save())).toBe(before);
	});
});

describe("each letter's share", () => {
	it('is read from the letter, or is the whole extra when the letter has no record', () => {
		const project = spacingProject(2048, { n: {} });
		const n = letter(project, 'n');
		expect(appliedExtra(n, 0)).toEqual({ left: 0, right: 0 });
		expect(appliedExtra(n, -15)).toEqual({ left: -15, right: -15 });
		n.anyink.spacingExtra = { left: -10, right: 0 };
		expect(appliedExtra(n, -15)).toEqual({ left: -10, right: 0 });
		n.anyink.spacingExtra = { left: 'x' };
		expect(appliedExtra(n, 4)).toEqual({ left: 4, right: 4 });
	});

	it('is kept whole while it matters and dropped when it is all 0', () => {
		const project = spacingProject(2048, { n: {} });
		const n = letter(project, 'n');
		expect(recordApplied(n, { left: 0, right: 0 }, 0)).toBe(false);
		expect(n.anyink.spacingExtra).toBeUndefined();
		expect(recordApplied(n, { left: -9.6, right: 0 }, -10)).toBe(true);
		expect(n.anyink.spacingExtra).toEqual({ left: -10, right: 0 });
		expect(recordApplied(n, { left: -10, right: 0 }, -10)).toBe(false);
		// A share of 0 while the extra isn't 0 is kept: "no record" would mean the whole extra
		expect(recordApplied(n, { left: 0, right: 0 }, -10)).toBe(true);
		expect(n.anyink.spacingExtra).toEqual({ left: 0, right: 0 });
		expect(recordApplied(n, { left: 0, right: 0 }, 0)).toBe(true);
		expect(n.anyink.spacingExtra).toBeUndefined();
	});
});
