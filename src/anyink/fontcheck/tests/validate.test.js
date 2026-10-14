// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B1: the font check names, in plain words, every letter the font file can't hold:
	width a whole number 0 to 65,535 and points from -32,768 to 32,767 (after the exporter's
	rounding), every shape at least 3 points, a width above 0 when there is ink. Steps between
	points: point_steps.test.js; the space: space_width.test.js; kerning: kerning.test.js.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROBLEM, validateFont, validateItem } from '../validate.js';
import { edgeProjectJSON, openOblegg, openProject, square, twoPointShape } from './fixtures.js';

/** The edge project plus a few more letters, each given its own break by the test. */
function openWith(glyphs = {}, change = (json) => json) {
	const json = edgeProjectJSON();
	Object.assign(json.glyphs, glyphs);
	return openProject(change(json));
}

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

describe('a healthy font', () => {
	it('has no problems: fractional widths and points round, empty letters have no ink', () => {
		const { project } = openWith();
		expect(validateFont(project)).toEqual([]);
	});

	it('the check never changes the project', () => {
		const { project } = openWith();
		const before = Object.keys(project.glyphs).sort();
		validateFont(project);
		expect(Object.keys(project.glyphs).sort()).toEqual(before);
	});
});

describe('each rule names the right letter', () => {
	it('ink with a width of 0', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] },
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x61',
				problem: PROBLEM.inkNoWidth,
				message: 'small a has ink but no width, so the next letter would sit on top of it.',
			},
		]);
	});

	it('a fractional width that rounds to 0 counts as no width', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0.338, shapes: [square()] },
		});
		expect(validateFont(project).map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x61', PROBLEM.inkNoWidth],
		]);
	});

	it('a width wider than the font file allows', () => {
		const { project } = openWith({
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 70000, shapes: [square()] },
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x41',
				problem: PROBLEM.width,
				message: 'Capital A is wider than the font file allows.',
			},
		]);
	});

	it('65,535.4 rounds into range; 65,535.6 does not', () => {
		const { project } = openWith({
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 65535.4, shapes: [square()] },
			'glyph-0x45': { id: 'glyph-0x45', advanceWidth: 65535.6, shapes: [square()] },
		});
		expect(validateFont(project).map((p) => p.itemId)).toEqual(['glyph-0x45']);
	});

	it('a width below zero', () => {
		const { project } = openWith({
			'glyph-0x31': { id: 'glyph-0x31', advanceWidth: -12, shapes: [square()] },
		});
		const problems = validateFont(project);
		expect(problems[0]).toEqual({
			itemId: 'glyph-0x31',
			problem: PROBLEM.width,
			message: "The number 1 has a width below zero, which the font file can't hold.",
		});
		// a width problem is the whole story: no second "no width" line for the same letter
		expect(problems).toHaveLength(1);
	});

	it('a point too far out', () => {
		const far = square(100, 0, 400);
		far.pathPoints[2].p.coord.y = 40000;
		const { project } = openWith({
			'glyph-0x3F': { id: 'glyph-0x3F', advanceWidth: 600, shapes: [far] },
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x3F',
				problem: PROBLEM.point,
				message: 'The question mark has a point too far out for the font file to hold.',
			},
		]);
	});

	it('a curve handle too far out counts too', () => {
		const shape = square(100, 0, 400);
		shape.pathPoints[1].h2 = { coord: { x: -33000, y: 10 } };
		shape.pathPoints[1].type = 'corner';
		const { project } = openWith({
			'glyph-0x63': { id: 'glyph-0x63', advanceWidth: 600, shapes: [shape] },
		});
		expect(validateFont(project).map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x63', PROBLEM.point],
		]);
	});

	it('a shape with only 2 points', () => {
		const { project } = openWith({
			'glyph-0x62': { id: 'glyph-0x62', advanceWidth: 600, shapes: [square(), twoPointShape()] },
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x62',
				problem: PROBLEM.shape,
				message: 'small b has a shape with only 2 points. A shape needs at least 3.',
			},
		]);
	});

	it("a curved 2-point shape makes ink and the font file holds it (Oblegg's ff joins)", () => {
		const lens = twoPointShape();
		lens.pathPoints[1].h1 = { coord: { x: 500, y: 100 } };
		lens.pathPoints[1].h2 = { coord: { x: 100, y: 500 } };
		lens.pathPoints[1].type = 'flat';
		const { project } = openWith({
			'glyph-0x62': { id: 'glyph-0x62', advanceWidth: 600, shapes: [lens] },
		});
		expect(validateFont(project)).toEqual([]);
	});

	it('a 1-point shape', () => {
		const dot = { name: 'Dot', pathPoints: [{ p: { coord: { x: 100, y: 100 } } }] };
		const { project } = openWith({
			'glyph-0x62': { id: 'glyph-0x62', advanceWidth: 600, shapes: [square(), dot] },
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x62',
				problem: PROBLEM.shape,
				message: 'small b has a shape with only 1 point. A shape needs at least 3.',
			},
		]);
	});

	it('several short shapes are one line', () => {
		const { project } = openWith({
			'glyph-0x62': {
				id: 'glyph-0x62',
				advanceWidth: 600,
				shapes: [twoPointShape(), twoPointShape(500), twoPointShape(900)],
			},
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'glyph-0x62',
				problem: PROBLEM.shape,
				message: 'small b has 3 shapes with fewer than 3 points. A shape needs at least 3.',
			},
		]);
	});

	it('joined letters (a ligature) are named and get plural words', () => {
		const { project } = openWith({}, (json) => {
			json.ligatures['liga-0x66-0x69'].advanceWidth = 0;
			return json;
		});
		expect(validateFont(project)).toEqual([
			{
				itemId: 'liga-0x66-0x69',
				problem: PROBLEM.inkNoWidth,
				message:
					'The joined letters fi have ink but no width, so the next letter would sit on top of them.',
			},
		]);
	});

	it('a letter made from another letter is checked as the font file will hold it', () => {
		const far = square(100, 0, 400);
		far.pathPoints[0].p.coord.x = 32730;
		// b is A moved 50 to the right (fixtures): A fits, b's copy goes past 32,767
		const { project } = openWith({
			'glyph-0x41': { id: 'glyph-0x41', advanceWidth: 1200, shapes: [far] },
		});
		expect(validateFont(project).map((p) => [p.itemId, p.problem])).toEqual([
			['glyph-0x62', PROBLEM.point],
		]);
	});

	it('one letter can have several problems, in a fixed order', () => {
		const shape = twoPointShape();
		shape.pathPoints[0].p.coord.x = 50000;
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0, shapes: [shape] },
		});
		expect(validateFont(project).map((p) => p.problem)).toEqual([
			PROBLEM.inkNoWidth,
			PROBLEM.point,
			PROBLEM.shape,
		]);
	});
});

describe('the sample fonts', () => {
	it('Oblegg has no problems', () => {
		const { project } = openOblegg();
		expect(validateFont(project)).toEqual([]);
	});
});

describe('only letters the font file will hold', () => {
	it('a broken letter in a range that is off is not named', () => {
		const { project } = openWith({
			'glyph-0xE9': { id: 'glyph-0xE9', advanceWidth: 0, shapes: [twoPointShape()] },
		});
		expect(validateFont(project)).toEqual([]);
	});

	it('a broken ligature is not named when ligatures are not exported', () => {
		const { project } = openWith({}, (json) => {
			json.settings.app.exportLigatures = false;
			json.ligatures['liga-0x66-0x69'].shapes = [twoPointShape()];
			return json;
		});
		expect(validateFont(project)).toEqual([]);
	});

	it('validateItem checks one letter on its own', () => {
		const { project } = openWith({
			'glyph-0x61': { id: 'glyph-0x61', advanceWidth: 0, shapes: [square()] },
		});
		expect(validateItem(project.getItem('glyph-0x61'))).toHaveLength(1);
		expect(validateItem(project.getItem('glyph-0x41'))).toEqual([]);
	});
});
