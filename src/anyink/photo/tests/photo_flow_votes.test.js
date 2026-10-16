// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B16: which letters of a photo size it (photo_flow_votes.js). The flow-level regression is
// b16_photo_scale.test.js (first-try photo); these pin the rule on plain boxes.
import { describe, expect, it } from 'vitest';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { photoScale } from '../../placement/photo_scale.js';
import { OFF_SIZE_SHARE, offSizeParts, votingFacts } from '../photo_flow_votes.js';

const FONT = new GlyphrStudioProject().settings.font;
// B r e (na) H d as the impatient run's photo had them: the H written 1.45 times as tall as B
const parts = [
	{ id: 'B', left: 435, top: 448, right: 691, bottom: 718, row: 0 },
	{ id: 'r', left: 769, top: 565, right: 871, bottom: 711, row: 0 },
	{ id: 'e', left: 1225, top: 543, right: 1369, bottom: 723, row: 0 },
	{ id: 'na', left: 1468, top: 516, right: 1740, bottom: 728, row: 0 },
	{ id: 'H', left: 1945, top: 355, right: 2221, bottom: 748, row: 0 },
	{ id: 'd', left: 2309, top: 451, right: 2449, bottom: 683, row: 0 },
];
const record = { parts, used: {}, skipped: [] };
const photo = (names) => ({
	parts,
	uses: Object.fromEntries(Object.entries(names).map(([id, char]) => [id, { char }])),
});

describe('letters left out of the photo size', () => {
	it('the tall H is far off its row; B r e d are not', () => {
		expect(OFF_SIZE_SHARE).toBe(0.3);
		const p = photo({ B: 'B', r: 'r', e: 'e', H: 'H', d: 'd' });
		expect([...offSizeParts(p, FONT)]).toEqual(['H']);
	});

	it('needs three letters in the row to say what is usual', () => {
		expect([...offSizeParts(photo({ B: 'B', H: 'H' }), FONT)]).toEqual([]);
	});

	it('the "na" part named n and the H size nothing; the other letters keep their size', () => {
		const base = photoScale(photo({ B: 'B', r: 'r', e: 'e' }), FONT).scale;
		const facts = votingFacts(record, photo({ B: 'B', r: 'r', e: 'e', na: 'n', H: 'H' }), FONT);
		expect([...facts.out].sort()).toEqual(['H', 'na']);
		expect(facts.info.scale).toBeCloseTo(base, 9);
		// the left-out letters can still be placed: their tails are known
		expect('na' in facts.info.tails && 'H' in facts.info.tails).toBe(true);
	});

	it('named m, the wide part is one letter and sizes the photo', () => {
		const facts = votingFacts(record, photo({ B: 'B', r: 'r', e: 'e', na: 'm' }), FONT);
		expect(facts.out.has('na')).toBe(false);
	});

	it('when nothing else is named, a left-out letter sizes the photo after all', () => {
		const facts = votingFacts(record, photo({ na: 'n' }), FONT);
		expect(facts.out.size).toBe(0);
		expect(facts.info.scale).toBeGreaterThan(0);
	});
});
