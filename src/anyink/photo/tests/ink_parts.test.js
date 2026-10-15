// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-core: a photo's parts and rows (docs/UX-BEGINNER.md 4.4 "Parts", section 10 B9 unit
// tests "parts on the tight and loose fixtures (the dotted i is one part); rows"). The fixtures
// are handwriting drawn in real Chrome with a felt-tip-like pen (fixtures/make_fixtures.mjs):
// a loose whole-alphabet page photographed with a phone (turned, in perspective, uneven light, a
// table around it, a JPEG with noise), a tight one through a flatbed scanner, one small j filling
// a phone photo, and B3's "B r e n a H d" row. Written before ink_parts.js existed (failed on the
// missing module), and the speck and tilt cases also fail with B3's stand-in rule
// (placement/tests/ink_parts_lite.js): its photo-area speck floor drops a felt-tip i dot on a
// 2000 px page, and its rows are plain up-and-down overlap, which joins the rows of a page turned
// 6 degrees.
import { beforeAll, describe, expect, it } from 'vitest';
import { arc, rasterize } from '../../placement/tests/raster.js';
import { LETTER_STROKES, turner } from '../../placement/tests/letters.js';
import { groupRows } from '../../placement/seat.js';
import { strokeWidthPx } from '../../placement/tests/ink_parts_lite.js';
import {
	DOT_GAP_SHARE,
	SPECK_STROKE_SHARE,
	attachMasks,
	findInk,
	findParts,
	partAt,
	partFromBox,
	photoInk,
	rowForBox,
	storedPart,
} from '../ink_parts.js';
import { keyCenter, keyHolder, loadPhotoFixture } from './fixture_image.js';

const FIXTURES = [
	'alphabet-loose-phone',
	'alphabet-tight-scan',
	'single-j-phone',
	'brenna-loose-phone',
	'brenna-tight-phone',
	'brennan-hand',
];
/** The paper each fixture was made on (paper_kind.js picks it in the app). */
const PAPER = {
	'alphabet-loose-phone': 'photo',
	'alphabet-tight-scan': 'scan',
	'single-j-phone': 'photo',
	'brenna-loose-phone': 'photo',
	'brenna-tight-phone': 'photo',
	'brennan-hand': 'scan',
};

const loaded = {};
beforeAll(async () => {
	for (const name of FIXTURES) {
		const fixture = await loadPhotoFixture(name);
		const { mask, width, height, junk } = photoInk(fixture.image, { paper: PAPER[name] });
		const found = findInk(mask, width, height);
		loaded[name] = { ...fixture, mask, width, height, junk, found };
	}
}, 60000);

describe('parts on the realistic fixtures', () => {
	it.each(FIXTURES)('%s: one part per letter, each letter in exactly one part', (name) => {
		const { key, found } = loaded[name];
		expect(found.parts).toHaveLength(key.letters.length);
		keyHolder(found.parts, key).forEach((holders, i) => {
			expect(holders, `${key.letters[i].char} (#${i})`).toHaveLength(1);
		});
		for (const part of found.parts) {
			const held = key.letters.filter((letter) => {
				const [x, y] = keyCenter(letter);
				return x >= part.left && x < part.right && y >= part.top && y < part.bottom;
			});
			expect(held, part.id).toHaveLength(1);
		}
	});

	it.each(FIXTURES)('%s: parts come in reading order, ids p1, p2, ...', (name) => {
		const { key, found } = loaded[name];
		const holders = keyHolder(found.parts, key);
		expect(holders.map(([part]) => part.id)).toEqual(key.letters.map((_, i) => `p${i + 1}`));
	});

	it('the dotted i is one part: the loose page (dot drifted right) and the tight page (a fat felt-tip dot)', () => {
		for (const name of ['alphabet-loose-phone', 'alphabet-tight-scan']) {
			const { key, found } = loaded[name];
			const holders = keyHolder(found.parts, key);
			const index = key.letters.findIndex((letter) => letter.char === 'i');
			const [part] = holders[index];
			const [, top, , bottom] = key.letters[index].box;
			// the part reaches from the dot down to the stem's foot
			expect(part.top, name).toBeLessThanOrEqual(top + 3);
			expect(part.bottom, name).toBeGreaterThanOrEqual(bottom - 3);
		}
	});

	it('UX-BEGINNER 9.4: the loose B r e n a H d gives 7 parts, the tight one 8 with the dotted i as one', () => {
		expect(loaded['brenna-loose-phone'].found.parts).toHaveLength(7);
		const tight = loaded['brenna-tight-phone'];
		expect(tight.found.parts).toHaveLength(8);
		const i = tight.found.parts[7];
		const [, top, , bottom] = tight.key.letters[7].box;
		expect(tight.key.letters[7].char).toBe('i');
		expect(i.top).toBeLessThanOrEqual(top + 3);
		expect(i.bottom).toBeGreaterThanOrEqual(bottom - 3);
	});

	it('j, !, ?, : and ; keep their dots as one part', () => {
		for (const name of ['alphabet-loose-phone', 'alphabet-tight-scan', 'single-j-phone']) {
			const { key, found } = loaded[name];
			const holders = keyHolder(found.parts, key);
			key.letters.forEach((letter, i) => {
				if (!'j!?:;'.includes(letter.char)) return;
				const [part] = holders[i];
				const [, top, , bottom] = letter.box;
				expect(part.top, `${name} ${letter.char}`).toBeLessThanOrEqual(top + 3);
				expect(part.bottom, `${name} ${letter.char}`).toBeGreaterThanOrEqual(bottom - 3);
			});
		}
	});

	it('a part holds only its own ink: its mask is as big as its box, with ink in it', () => {
		const { found } = loaded['alphabet-tight-scan'];
		for (const part of found.parts) {
			expect(part.mask.length).toBe((part.right - part.left) * (part.bottom - part.top));
			expect(part.mask.some((v) => v === 1)).toBe(true);
		}
	});

	it('the table round the phone page and the paper dust are not parts', () => {
		const { found, width, height, junk } = loaded['alphabet-loose-phone'];
		// photoInk drops it as no pen's ink, or findInk as the photo's edge
		expect(found.edges.length + junk.filter((j) => j.why === 'edge').length).toBeGreaterThan(0);
		for (const part of found.parts) {
			expect(part.left > 0 && part.top > 0 && part.right < width && part.bottom < height).toBe(
				true
			);
		}
		expect(found.specks).toBeGreaterThanOrEqual(0);
	});

	it("the photo's stroke estimate: B3's own measure of the parts, and the pen plus the camera's blur", () => {
		for (const name of FIXTURES) {
			const { key, found } = loaded[name];
			const each = found.parts.map(strokeWidthPx).sort((a, b) => a - b);
			const middle = each[each.length >> 1];
			expect(found.stroke / middle, name).toBeGreaterThan(0.85);
			expect(found.stroke / middle, name).toBeLessThan(1.15);
			// a camera's blur and Photo mode's cutoff widen the ink by a pixel or two at most
			expect(found.stroke, name).toBeGreaterThan(0.85 * key.penPx);
			expect(found.stroke, name).toBeLessThan(key.penPx + 2.5);
		}
	});
});

describe('rows', () => {
	it.each(FIXTURES)('%s: every part carries its row, rows top to bottom as written', (name) => {
		const { key, found } = loaded[name];
		const holders = keyHolder(found.parts, key);
		const rows = key.letters.map((letter) => letter.row ?? 0);
		expect(holders.map(([part]) => part.row)).toEqual(rows);
		expect(found.rows).toHaveLength(Math.max(...rows) + 1);
		found.rows.forEach((row, r) => {
			expect(row.every((id) => found.parts.find((p) => p.id === id).row === r)).toBe(true);
		});
	});

	it("placement's groupRows keeps the rows ink_parts gave (the parts carry row numbers)", () => {
		const { found } = loaded['alphabet-loose-phone'];
		const rows = groupRows(found.parts);
		expect(rows.map((row) => row.map((part) => part.id))).toEqual(found.rows);
	});

	it('a page turned 6 degrees with rows close under each other keeps its rows apart', () => {
		const width = 1900;
		const height = 900;
		const unit = 1.4;
		const pen = 9;
		const turn = turner(6, width, height);
		const strokes = [];
		const truth = [];
		const chars = 'nHaxBneHnaxeH';
		[250, 470, 690].forEach((base, row) => {
			[...chars].forEach((char, i) => {
				const x0 = 80 + i * 132;
				for (const stroke of LETTER_STROKES[char]({})) {
					strokes.push(stroke.map(([x, y]) => turn([x0 + x * unit, base + y * unit])));
				}
				truth.push({ row, middle: turn([x0 + 20 * unit, base - 40 * unit]) });
			});
		});
		const found = findInk(rasterize(width, height, strokes, pen), width, height);
		expect(found.parts).toHaveLength(truth.length);
		expect(found.rows).toHaveLength(3);
		for (const { row, middle } of truth) {
			const [x, y] = middle;
			const part = found.parts.find(
				(p) => x >= p.left && x < p.right && y >= p.top && y < p.bottom
			);
			expect(part?.row).toBe(row);
		}
		// plain up-and-down overlap (seat.js groupRows on parts with no row) joins them
		const unnumbered = found.parts.map(({ row, ...rest }) => (row === undefined ? rest : rest));
		expect(groupRows(unnumbered).length).toBeLessThan(3);
	});

	it('a period, a comma, an apostrophe and a hyphen join the row they were written in', () => {
		const width = 1200;
		const height = 700;
		const unit = 1.5;
		const strokes = [];
		const marks = [];
		[260, 560].forEach((base, row) => {
			[..."Ha.n,e'x-"].forEach((char, i) => {
				const x0 = 70 + i * 120;
				for (const stroke of LETTER_STROKES[char]({})) {
					strokes.push(stroke.map(([x, y]) => [x0 + x * unit, base + y * unit]));
				}
				if (".,'-".includes(char)) marks.push({ row, x: x0 + 2 * unit });
			});
		});
		const found = findInk(rasterize(width, height, strokes, 9), width, height);
		expect(found.rows).toHaveLength(2);
		for (const { row, x } of marks) {
			const part = found.parts.find((p) => x >= p.left - 2 && x < p.right + 2 && p.row === row);
			expect(part, `mark at ${x} row ${row}`).toBeTruthy();
		}
	});
});

describe('rows: grouped by where the letters sit, never chained through one tall piece', () => {
	/** Lines of letters (cap units, placement/tests/letters.js; a space skips a place). */
	function lines(texts, { pitch, unit = 1.4, pen = 9, width = 1500, height = 760, top = 230 }) {
		const strokes = [];
		const truth = [];
		texts.forEach((chars, row) => {
			const base = top + row * pitch * unit;
			[...chars].forEach((char, i) => {
				if (char === ' ') return;
				const x0 = 160 + i * 130;
				const own = LETTER_STROKES[char]({}).map((stroke) =>
					stroke.map(([x, y]) => [x0 + x * unit, base + y * unit])
				);
				strokes.push(...own);
				// a point on its ink: where its first stroke starts
				truth.push({ row, char, at: own[0][0].map(Math.round) });
			});
		});
		return { truth, width, height, mask: rasterize(width, height, strokes, pen), unit };
	}

	/** The row of the part holding each letter. */
	const rowsOf = (found, truth) =>
		truth.map(({ at: [x, y] }) => {
			const part = found.parts.find(
				(p) => x >= p.left - 1 && x < p.right + 1 && y >= p.top - 1 && y < p.bottom + 1
			);
			return part?.row;
		});

	it('a long stroke reaching from one line down into the next does not join the two lines', () => {
		// a notebook margin line or a long pen slip, as tall as two lines
		const sheet = lines(['naxeHnaxe', 'naxeHnaxe'], { pitch: 180 });
		const unit = sheet.unit;
		for (let y = Math.round(230 - 100 * unit); y < 230 + 180 * unit; y++) {
			for (let x = 86; x < 95; x++) sheet.mask[y * sheet.width + x] = 1;
		}
		const found = findInk(sheet.mask, sheet.width, sheet.height);
		const rows = rowsOf(found, sheet.truth);
		const first = rows.filter((_, i) => sheet.truth[i].row === 0);
		const second = rows.filter((_, i) => sheet.truth[i].row === 1);
		expect(new Set(first).size).toBe(1);
		expect(new Set(second).size).toBe(1);
		expect(first[0]).toBeLessThan(second[0]);
	});

	it("tails and a mark between two tight lines don't join them; the mark keeps its own line", () => {
		// g, p, y and j hang down beside an apostrophe written at the next line's capitals line
		const sheet = lines(['ag pyjx', "Hn'anel"], { pitch: 130 });
		const found = findInk(sheet.mask, sheet.width, sheet.height);
		expect(found.parts).toHaveLength(13);
		expect(found.rows).toHaveLength(2);
		expect(rowsOf(found, sheet.truth)).toEqual(sheet.truth.map((t) => t.row));
	});
});

describe('the speck filter (B11: smaller than a quarter of the stroke squared, not over or under a piece)', () => {
	/** A row of letters with a felt-tip i, at the size a 2000 px phone page gives (B3's
	 * stand-in dropped pieces under 0.005 % of the photo: 150 px here, an i dot is about 80). */
	function bigPage(extra = []) {
		const width = 2000;
		const height = 1500;
		const unit = 0.9;
		const pen = 7;
		const strokes = [];
		[...'nHaxe'].forEach((char, i) => {
			const x0 = 200 + i * 140;
			for (const stroke of LETTER_STROKES[char]({})) {
				strokes.push(stroke.map(([x, y]) => [x0 + x * unit, 600 + y * unit]));
			}
		});
		// an i: stem and a round felt-tip dot just above it
		strokes.push([
			[1000, 600 - 60 * unit],
			[1000, 600],
		]);
		strokes.push(arc(1000, 600 - 80 * unit, 1.5, 1.5, 0, Math.PI * 2, 12));
		strokes.push(...extra);
		return { width, height, mask: rasterize(width, height, strokes, pen) };
	}

	it('a felt-tip i dot on a big page is not a speck: the i is one part reaching up to its dot', () => {
		const { width, height, mask } = bigPage();
		const found = findInk(mask, width, height);
		expect(found.parts).toHaveLength(6);
		const i = found.parts.find((p) => p.left <= 1000 && p.right > 1000);
		expect(i.bottom - i.top).toBeGreaterThan(75 * 0.9);
	});

	it('a speck under a quarter of the stroke squared, away from the letters, is dropped', () => {
		const { width, height, mask } = bigPage();
		// a 2 x 1 speck (stroke 7: the limit is 12.25 px), far from any letter
		mask[1200 * width + 1500] = 1;
		mask[1200 * width + 1501] = 1;
		const found = findInk(mask, width, height);
		expect(found.parts).toHaveLength(6);
		expect(found.specks).toBe(1);
		expect(SPECK_STROKE_SHARE).toBe(0.25);
	});

	it('the same speck sitting just over a letter is a dot: it joins that letter', () => {
		const { width, height, mask } = bigPage();
		// over the n (left 200), inside the dot reach
		const y = Math.round(600 - 60 * 0.9 - 10);
		mask[y * width + 220] = 1;
		mask[y * width + 221] = 1;
		const found = findInk(mask, width, height);
		expect(found.parts).toHaveLength(6);
		expect(found.specks).toBe(0);
		const n = found.parts.find((p) => p.left <= 205 && p.right > 205);
		expect(n.top).toBeLessThanOrEqual(y);
		expect(DOT_GAP_SHARE).toBe(0.6);
	});

	it('a big piece that touches the edge of the photo (the table, a page edge) is not a part', () => {
		const { width, height, mask } = bigPage();
		for (let y = 0; y < height; y++) for (let x = 0; x < 40; x++) mask[y * width + x] = 1;
		const found = findInk(mask, width, height);
		expect(found.parts).toHaveLength(6);
		expect(found.edges).toHaveLength(1);
	});

	it('a thin dark frame round a close-up of one letter is not part of the letter', () => {
		// a scanner lid's edge or a screenshot's border: one pixel round the photo
		const width = 600;
		const height = 800;
		const frame = (mask) => {
			for (let x = 0; x < width; x++) mask[x] = mask[(height - 1) * width + x] = 1;
			for (let y = 0; y < height; y++) mask[y * width] = mask[y * width + width - 1] = 1;
			return mask;
		};
		const n = LETTER_STROKES.n({}).map((s) => s.map(([x, y]) => [150 + x * 6, 600 + y * 6]));
		const alone = findInk(frame(rasterize(width, height, n, 30)), width, height);
		expect(alone.parts).toHaveLength(1);
		expect(alone.edges).toHaveLength(1);
		expect(alone.parts[0].right - alone.parts[0].left).toBeLessThan(300);
		const i = [
			[
				[300, 300],
				[300, 650],
			],
			arc(300, 200, 2, 2, 0, Math.PI * 2, 12),
		];
		const dotted = findInk(frame(rasterize(width, height, i, 30)), width, height);
		expect(dotted.parts).toHaveLength(1);
		expect(dotted.parts[0].top).toBeLessThan(200);
		expect(dotted.parts[0].bottom - dotted.parts[0].top).toBeLessThan(500);
	});

	it('a close-up i whose stem runs off the photo is still one part with its dot', () => {
		const width = 400;
		const height = 600;
		const strokes = [
			[
				[200, 250],
				[200, 640],
			],
			arc(200, 150, 3, 3, 0, Math.PI * 2, 12),
		];
		const found = findInk(rasterize(width, height, strokes, 40), width, height);
		expect(found.parts).toHaveLength(1);
		expect(found.edges).toHaveLength(0);
		expect(found.parts[0].top).toBeLessThan(140);
	});

	it('one letter alone touching the edge of the photo is still its part', () => {
		const width = 300;
		const height = 300;
		const strokes = LETTER_STROKES.H({}).map((s) => s.map(([x, y]) => [x * 2.5, 260 + y * 2.5]));
		const found = findInk(rasterize(width, height, strokes, 12), width, height);
		expect(found.parts).toHaveLength(1);
		expect(found.edges).toHaveLength(0);
	});

	it('an empty photo has no parts', () => {
		const found = findInk(new Uint8Array(100 * 80), 100, 80);
		expect(found.parts).toEqual([]);
		expect(found.rows).toEqual([]);
		expect(findParts(new Uint8Array(0), 0, 0)).toEqual([]);
	});
});

describe('a box he draws, a click, and parts kept without their masks', () => {
	it('partFromBox: the ink inside the box, tightened; null when the box holds no ink', () => {
		const { mask, width, height, found } = loaded['brennan-hand'];
		const first = found.parts[0];
		const part = partFromBox(mask, width, height, {
			left: first.left - 20,
			top: first.top - 20,
			right: first.right + 20,
			bottom: first.bottom + 20,
		});
		expect([part.left, part.top, part.right, part.bottom]).toEqual([
			first.left,
			first.top,
			first.right,
			first.bottom,
		]);
		expect(part.mask.length).toBe((part.right - part.left) * (part.bottom - part.top));
		expect(partFromBox(mask, width, height, { left: 5, top: 5, right: 40, bottom: 40 })).toBe(null);
		// a box past the photo's edge is cut to the photo
		const edge = partFromBox(mask, width, height, {
			left: -50,
			top: -50,
			right: 99999,
			bottom: 99999,
		});
		expect(edge.left).toBeGreaterThanOrEqual(0);
		expect(edge.right).toBeLessThanOrEqual(width);
	});

	it('partFromBox cuts a letter that touches its neighbour at the box', () => {
		const width = 200;
		const height = 120;
		const mask = new Uint8Array(width * height);
		for (let y = 20; y < 100; y++) for (let x = 20; x < 180; x++) mask[y * width + x] = 1;
		const part = partFromBox(mask, width, height, { left: 50, top: 0, right: 90, bottom: 120 });
		expect([part.left, part.top, part.right, part.bottom]).toEqual([50, 20, 90, 100]);
	});

	it('partAt: the part under a click; the smallest when boxes overlap; null on bare paper', () => {
		const parts = [
			{ id: 'p1', left: 0, top: 0, right: 100, bottom: 100 },
			{ id: 'p2', left: 40, top: 40, right: 60, bottom: 60 },
			{ id: 'p3', left: 200, top: 0, right: 260, bottom: 100 },
		];
		expect(partAt(parts, 50, 50).id).toBe('p2');
		expect(partAt(parts, 10, 10).id).toBe('p1');
		expect(partAt(parts, 230, 99).id).toBe('p3');
		expect(partAt(parts, 150, 50)).toBe(null);
		// near a part (within the reach, image pixels) still picks it
		expect(partAt(parts, 196, 50, { reach: 6 }).id).toBe('p3');
	});

	it('rowForBox: a drawn box joins the row it overlaps most, else a new row under the rest', () => {
		const { found } = loaded['alphabet-loose-phone'];
		const second = found.parts.filter((p) => p.row === 1);
		const box = {
			left: second[2].left,
			top: second[2].top,
			right: second[3].right,
			bottom: second[3].bottom,
		};
		expect(rowForBox(found.parts, box)).toBe(1);
		expect(rowForBox(found.parts, { left: 10, top: 1580, right: 50, bottom: 1595 })).toBe(
			found.rows.length
		);
		expect(rowForBox([], { left: 0, top: 0, right: 5, bottom: 5 })).toBe(0);
	});

	it('storedPart keeps only plain numbers (JSON-safe); attachMasks gives the masks back', () => {
		const { mask, width, height, found } = loaded['alphabet-tight-scan'];
		const stored = found.parts.map(storedPart);
		const json = JSON.parse(JSON.stringify(stored));
		expect(json).toEqual(stored);
		expect(Object.keys(stored[0]).sort()).toEqual(['bottom', 'id', 'left', 'right', 'row', 'top']);
		// a box he drew rides along and gets the ink inside it
		const drawn = {
			id: 'b1',
			left: stored[0].left,
			top: stored[0].top,
			right: stored[1].right,
			bottom: stored[1].bottom,
			row: 0,
			drawn: true,
		};
		const back = attachMasks([...json, drawn], mask, width, height);
		expect(back).toHaveLength(stored.length + 1);
		back.slice(0, -1).forEach((part, i) => {
			expect(part.id).toBe(found.parts[i].id);
			expect(Array.from(part.mask)).toEqual(Array.from(found.parts[i].mask));
		});
		const box = back.at(-1);
		expect(box.drawn).toBe(true);
		expect(box.mask.length).toBe((box.right - box.left) * (box.bottom - box.top));
		expect(box.mask.reduce((a, b) => a + b, 0)).toBeGreaterThan(
			found.parts[0].mask.reduce((a, b) => a + b, 0)
		);
	});
});

describe("the first-timer's phone photos: only his letters are parts (the B8 + B9 walk)", () => {
	const FIRST_TIMER = ['first-try-phone', 'notebook-alphabet-phone', 'single-g-phone'];
	const seen = {};
	beforeAll(async () => {
		for (const name of FIRST_TIMER) {
			const fixture = await loadPhotoFixture(name);
			const { mask, width, height } = photoInk(fixture.image, { paper: fixture.key.paper });
			seen[name] = { ...fixture, width, height, found: findInk(mask, width, height) };
		}
	}, 60000);

	/** What should be a part: each letter, two written touching as one, the crossed-out one. */
	function expectedParts(key) {
		const groups = [];
		key.letters.forEach((letter, i) => {
			const before = key.letters[i - 1];
			const touching =
				before?.row === letter.row && key.touching.includes(`${before.char}${letter.char}`);
			if (touching) groups[groups.length - 1].push(letter);
			else groups.push([letter]);
		});
		if (key.crossedOut) groups.push([key.crossedOut]);
		return groups.sort((a, b) => a[0].row - b[0].row || a[0].center[0] - b[0].center[0]);
	}
	const inside = (part, [x, y]) =>
		x >= part.left && x < part.right && y >= part.top && y < part.bottom;
	const holderOf = (found, group) => [
		...new Set(group.flatMap((letter) => found.parts.filter((p) => inside(p, letter.center)))),
	];

	it.each(FIRST_TIMER)(
		'%s: one part per letter written (two written touching make one), and nothing else',
		(name) => {
			const { key, found } = seen[name];
			const groups = expectedParts(key);
			for (const group of groups) {
				expect(holderOf(found, group), group.map((l) => l.char).join('')).toHaveLength(1);
			}
			for (const part of found.parts) {
				const held = groups.filter((group) => group.some((l) => inside(part, l.center)));
				expect(
					held,
					`${part.id} [${part.left},${part.top},${part.right},${part.bottom}]`
				).toHaveLength(1);
			}
			expect(found.parts).toHaveLength(groups.length);
		}
	);

	it("first try: the hand's shadow is not a part, and no part touches the photo's edge", () => {
		const { found, width, height } = seen['first-try-phone'];
		expect(found.parts).toHaveLength(6);
		for (const p of found.parts) {
			expect(p.left > 0 && p.top > 0 && p.right < width && p.bottom < height, p.id).toBe(true);
		}
	});

	it("first try: the smudge under the e is not the e's: its part ends at the e's own ink", () => {
		const { key, found } = seen['first-try-phone'];
		const e = key.letters.find((letter) => letter.char === 'e');
		const [part] = holderOf(found, [e]);
		// the key's box is round the turned letter's corners, a little past its ink
		expect(part.bottom).toBeLessThanOrEqual(e.box[3] + 3);
		expect(found.parts.some((p) => inside(p, key.smudges[0].center))).toBe(false);
	});

	it("first try: a box he draws round the e and the smudge under it holds only the e's ink", () => {
		const { key, image, width, height } = seen['first-try-phone'];
		const { mask } = photoInk(image, { paper: key.paper });
		const e = key.letters.find((letter) => letter.char === 'e');
		const smudgeBottom = key.smudges[0].center[1] + key.smudges[0].radius;
		const drawn = partFromBox(mask, width, height, {
			left: e.box[0] - 20,
			top: e.box[1] - 20,
			right: e.box[2] + 40,
			bottom: smudgeBottom,
		});
		expect(drawn.bottom).toBeLessThanOrEqual(e.box[3] + 3);
	});

	it('notebook: no punch hole, piece of the margin line or smudge is in a part', () => {
		const { key, found } = seen['notebook-alphabet-phone'];
		for (const hole of key.holes) {
			expect(found.parts.some((p) => inside(p, hole.center))).toBe(false);
		}
		const { top, bottom } = key.marginLine;
		for (const p of found.parts) {
			const y = (p.top + p.bottom) / 2;
			const x = top[0] + ((bottom[0] - top[0]) * (y - top[1])) / (bottom[1] - top[1]);
			expect(x >= p.left - 2 && x < p.right + 2, p.id).toBe(false);
		}
		expect(found.parts.some((p) => inside(p, key.smudges[0].center))).toBe(false);
	});

	it('notebook: the rows as written (abcdefghi and jklmnopqr apart), read in order', () => {
		const { key, found } = seen['notebook-alphabet-phone'];
		expect(found.rows).toHaveLength(key.rows);
		const groups = expectedParts(key);
		const holders = groups.map((group) => holderOf(found, group)[0]);
		expect(holders.map((part) => part.id)).toEqual(groups.map((_, i) => `p${i + 1}`));
		holders.forEach((part, i) => expect(part.row, groups[i][0].char).toBe(groups[i][0].row));
	});
});
