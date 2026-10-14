// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B3 placement on realistic photos (UX-BEGINNER B3 unit tests: "one scale per photo with B, r, e,
// n, a, H, d from one fixture (stroke weights within 15%)" and "placement of a, g, B, Q, f and a
// period"). The fixtures are synthetic handwriting drawn in real Chrome with one pen width and
// real wobble (tests/placement-fixture.mjs); their answer keys say where the pen sat. Read with
// the auto-trace's own gray + Otsu cutoff.
import { deflateSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import { getTrace, setTrace } from '../../trace/trace_model.js';
import { followPlan, placePart } from '../fit_lines.js';
import { applyFollow, photoScale } from '../photo_scale.js';
import { lineTargets } from '../classes.js';
import { groupRows, partGeometry } from '../seat.js';
import { decodePng, loadFixture, strokeWidthPx } from './fixture_photo.js';

const FONT = { upm: 2048, ascent: 1550, capHeight: 1480, xHeight: 1100, descent: -440 };
const BOX = 2048;
const O = 0.015 * BOX;
// UX-BEGINNER B11: a body bottom more than 2 % of the letter box off the writing line needs a look
const ON_THE_LINE = 0.02 * BOX;

const fontY = (placed, px) => placed.y - px * placed.scale;
/** Where the pen's writing line under the letter lands: the stroke's lower ink edge. */
const truthLine = (key, i) => key.letters[i].lineAtMiddle + key.penPx / 2;
const spread = (values) => Math.max(...values) / Math.min(...values) - 1;

/** The fixture as a photo with every part named in reading order. */
function namedPhoto(fixture, asset) {
	const uses = {};
	fixture.parts.forEach((part, i) => {
		uses[part.id] = { char: fixture.key.letters[i].char, itemId: `item-${part.id}` };
	});
	return { asset, parts: fixture.parts, uses };
}

describe('decodePng', () => {
	/** A PNG of these RGB rows, row y filtered with filter type y % 5 (CRCs left 0: not read). */
	function encodeRgb(rows) {
		const width = rows[0].length / 3;
		const paeth = (a, b, c) => {
			const p = a + b - c;
			const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
			return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
		};
		const raw = [];
		rows.forEach((row, y) => {
			const filter = y % 5;
			raw.push(filter);
			row.forEach((value, x) => {
				const left = x >= 3 ? row[x - 3] : 0;
				const up = y > 0 ? rows[y - 1][x] : 0;
				const upLeft = y > 0 && x >= 3 ? rows[y - 1][x - 3] : 0;
				const predict = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
				raw.push((value - predict) & 255);
			});
		});
		const chunk = (type, data) => {
			const out = new Uint8Array(12 + data.length);
			new DataView(out.buffer).setUint32(0, data.length);
			out.set(
				[...type].map((c) => c.charCodeAt(0)),
				4
			);
			out.set(data, 8);
			return out;
		};
		const header = new Uint8Array(13);
		new DataView(header.buffer).setUint32(0, width);
		new DataView(header.buffer).setUint32(4, rows.length);
		header.set([8, 2, 0, 0, 0], 8);
		const parts = [
			Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
			chunk('IHDR', header),
			chunk('IDAT', new Uint8Array(deflateSync(Uint8Array.from(raw)))),
			chunk('IEND', new Uint8Array(0)),
		];
		const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
		let at = 0;
		for (const part of parts) {
			bytes.set(part, at);
			at += part.length;
		}
		return bytes;
	}

	it('reads an RGB PNG through all five row filters', () => {
		const rows = [
			[10, 20, 30, 200, 210, 220],
			[250, 5, 128, 7, 99, 255],
			[0, 255, 1, 254, 2, 253],
			[60, 61, 62, 180, 30, 90],
			[13, 113, 213, 31, 131, 231],
		];
		const image = decodePng(encodeRgb(rows));
		expect([image.width, image.height]).toEqual([2, 5]);
		rows.forEach((row, y) => {
			for (let x = 0; x < 2; x++) {
				const at = (y * 2 + x) * 4;
				expect([...image.data.subarray(at, at + 4)]).toEqual([...row.slice(x * 3, x * 3 + 3), 255]);
			}
		});
	});

	it('refuses anything that is not a PNG', () => {
		expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow();
	});
});

describe('the photo "B r e n a H d": one pen, real wobble', () => {
	let fixture;
	let photo;
	let info;
	beforeAll(() => {
		fixture = loadFixture('brennan-hand');
		photo = namedPhoto(fixture, 'img-brennan-hand');
		info = photoScale(photo, FONT);
	});

	it('has 7 letters in one row, in order, and no paper specks', () => {
		expect(fixture.parts.length).toBe(7);
		expect(groupRows(fixture.parts).length).toBe(1);
		fixture.parts.forEach((part, i) => {
			const [left, top, right, bottom] = fixture.key.letters[i].box;
			const g = partGeometry(part);
			for (const [got, want] of [
				[g.left, left],
				[g.top, top],
				[g.right, right],
				[g.bottom, bottom],
			]) {
				expect(Math.abs(got - want)).toBeLessThanOrEqual(2);
			}
		});
	});

	it('the row writing line is within 2 px of where the pen sat', () => {
		const truth = fixture.key.letters
			.map((_, i) => truthLine(fixture.key, i))
			.sort((a, b) => a - b);
		for (const id of Object.keys(photo.uses))
			expect(Math.abs(info.lines[id] - truth[3])).toBeLessThanOrEqual(2);
	});

	it('every letter sits its ink on the writing line, wherever it was written; the pen line within B11 2 %', () => {
		fixture.parts.forEach((part, i) => {
			const placed = placePart(photo, part.id, FONT);
			const char = fixture.key.letters[i].char;
			expect(placed.seat).toBe('bottom');
			expect(placed.scale).toBe(info.scale);
			const bottom = fontY(placed, partGeometry(part).bottom);
			expect(Math.abs(bottom - lineTargets(char, FONT).bottom), char).toBeLessThanOrEqual(
				0.005 * BOX
			);
			expect(Math.abs(fontY(placed, truthLine(fixture.key, i))), char).toBeLessThanOrEqual(
				ON_THE_LINE
			);
			expect(Number.isInteger(placed.x) && Number.isInteger(placed.y)).toBe(true);
		});
	});

	it('the median of the letters picks the size: the small letters fill their line, his capitals stand taller', () => {
		const ratios = Object.values(info.ratios).sort((a, b) => a - b);
		expect(info.scale).toBe(ratios[3]);
		const fill = (char) => {
			const i = fixture.key.letters.findIndex((letter) => letter.char === char);
			const part = fixture.parts[i];
			const placed = placePart(photo, part.id, FONT);
			const g = partGeometry(part);
			const target = char === 'e' ? 1100 + 2 * O : 1100;
			return (fontY(placed, g.top) - fontY(placed, g.bottom)) / target;
		};
		// The letter whose ratio is the median (the a, written 4 % big) fills its line exactly; the
		// other small letters keep his wobble (the r is written 11 % short)
		const medianId = Object.keys(info.ratios).find((id) => info.ratios[id] === info.scale);
		const medianChar =
			fixture.key.letters[fixture.parts.findIndex((part) => part.id === medianId)].char;
		expect(medianChar).toBe('a');
		expect(Math.abs(fill('a') - 1)).toBeLessThanOrEqual(0.001);
		for (const char of ['r', 'e', 'n'])
			expect(Math.abs(fill(char) - 1), char).toBeLessThanOrEqual(0.12);
		// His small letters are 60 % of a capital, the font's 74 %: one scale keeps his proportions,
		// so B and H stand more than 8 % over the capitals line (B11 offers to move the line)
		for (const char of ['B', 'H']) {
			const i = fixture.key.letters.findIndex((letter) => letter.char === char);
			const placed = placePart(photo, fixture.parts[i].id, FONT);
			expect(fontY(placed, partGeometry(fixture.parts[i]).top), char).toBeGreaterThan(1.08 * 1480);
		}
	});

	it('one scale per photo keeps stroke weights within 15 %', () => {
		const weights = fixture.parts.map(
			(part) => strokeWidthPx(part) * placePart(photo, part.id, FONT).scale
		);
		expect(spread(weights)).toBeLessThanOrEqual(0.15);
	});

	it('fitting each letter to its own lines instead would not (his small letters are 60 % of a capital)', () => {
		const weights = fixture.parts.map((part) => strokeWidthPx(part) * info.ratios[part.id]);
		expect(spread(weights)).toBeGreaterThan(0.15);
	});

	describe('naming the letters one at a time, B first, as the photo dialog does', () => {
		function nameInTurn({ follow }) {
			const live = { asset: photo.asset, parts: photo.parts, uses: {} };
			const items = new Map();
			for (const part of photo.parts) {
				live.uses[part.id] = photo.uses[part.id];
				if (follow) {
					const plan = followPlan(live, FONT, { getItem: (id) => items.get(id), except: part.id });
					plan.forEach((entry) => applyFollow(items.get(entry.itemId), entry));
				}
				const placed = placePart(live, part.id, FONT);
				const item = new Glyph({ id: live.uses[part.id].itemId, advanceWidth: 0 });
				setTrace(item, {
					asset: live.asset,
					width: 1500,
					height: 520,
					x: placed.x,
					y: placed.y,
					scale: placed.scale,
				});
				item.anyink.photoFit = { asset: live.asset, part: part.id };
				items.set(item.id, item);
			}
			return photo.parts.map((part) => getTrace(items.get(photo.uses[part.id].itemId)).scale);
		}

		it('with earlier untouched letters following, every letter ends within 3 % of the photo scale', () => {
			const scales = nameInTurn({ follow: true });
			// The change each would still need is 3 % or less (the follow rule's own measure)
			for (const scale of scales)
				expect(Math.abs(info.scale / scale - 1)).toBeLessThanOrEqual(0.03 + 1e-9);
			const weights = photo.parts.map((part, i) => strokeWidthPx(part) * scales[i]);
			expect(spread(weights)).toBeLessThanOrEqual(0.15);
		});

		it('without following, B would keep the size it got alone and be off by more than 15 %', () => {
			const scales = nameInTurn({ follow: false });
			const weights = photo.parts.map((part, i) => strokeWidthPx(part) * scales[i]);
			expect(spread(weights)).toBeGreaterThan(0.15);
		});
	});
});

describe('the photo "a g B Q f .": tails, a bowl, a dot', () => {
	let fixture;
	let photo;
	let info;
	beforeAll(() => {
		fixture = loadFixture('tails-row');
		photo = namedPhoto(fixture, 'img-tails-row');
		info = photoScale(photo, FONT);
	});
	const index = (char) => fixture.key.letters.findIndex((letter) => letter.char === char);
	const partOf = (char) => fixture.parts[index(char)];
	const alone = (char, use = {}) => {
		const part = partOf(char);
		return { photo: { parts: [part], uses: { [part.id]: { char, ...use } } }, part };
	};

	it('in one row of 6: the line comes from a, B and the period; g, Q and f hang tails', () => {
		expect(fixture.parts.length).toBe(6);
		const tails = Object.fromEntries(
			fixture.parts.map((part, i) => [fixture.key.letters[i].char, info.tails[part.id]])
		);
		expect(tails).toEqual({ a: false, g: true, B: false, Q: true, f: true, '.': false });
		expect(placePart(photo, partOf('f').id, FONT).bodyFrom).toBe('row');
		for (const char of ['a', 'g', 'B', 'Q', 'f']) {
			const placed = placePart(photo, partOf(char).id, FONT);
			expect(placed.seat).toBe('bottom');
			expect(
				Math.abs(fontY(placed, truthLine(fixture.key, index(char)))),
				char
			).toBeLessThanOrEqual(ON_THE_LINE);
		}
		for (const char of ['g', 'Q', 'f']) {
			const placed = placePart(photo, partOf(char).id, FONT);
			expect(fontY(placed, partGeometry(partOf(char)).bottom), char).toBeLessThan(-200);
		}
	});

	it('the period never sizes the photo', () => {
		const before = info.scale;
		const without = { ...photo, uses: { ...photo.uses } };
		delete without.uses[partOf('.').id];
		expect(photoScale(without, FONT).scale).toBe(before);
	});

	describe('each letter cut out as its own photo', () => {
		const NEAR = 0.5;

		it('a: small-letter line to writing line', () => {
			const { photo: one, part } = alone('a');
			const placed = placePart(one, part.id, FONT);
			expect(Math.abs(fontY(placed, partGeometry(part).bottom))).toBeLessThanOrEqual(NEAR);
			expect(Math.abs(fontY(placed, partGeometry(part).top) - 1100)).toBeLessThanOrEqual(NEAR);
		});

		it('g: its bowl on the writing line from the bowl hole, tail hanging', () => {
			const { photo: one, part } = alone('g');
			const placed = placePart(one, part.id, FONT);
			expect(placed).toMatchObject({ tail: true, bodyFrom: 'counter' });
			expect(Math.abs(fontY(placed, truthLine(fixture.key, index('g'))))).toBeLessThanOrEqual(
				ON_THE_LINE
			);
			expect(fontY(placed, partGeometry(part).bottom)).toBeLessThan(-400);
		});

		it('B: capitals line to writing line', () => {
			const { photo: one, part } = alone('B');
			const placed = placePart(one, part.id, FONT);
			expect(Math.abs(fontY(placed, partGeometry(part).top) - 1480)).toBeLessThanOrEqual(NEAR);
			expect(Math.abs(fontY(placed, truthLine(fixture.key, index('B'))))).toBeLessThanOrEqual(
				ON_THE_LINE
			);
		});

		it('Q: its tail is found, its round bowl overshoots the writing line by 1.5 %', () => {
			const { photo: one, part } = alone('Q');
			const placed = placePart(one, part.id, FONT);
			expect(placed).toMatchObject({ tail: true, bodyFrom: 'counter' });
			expect(Math.abs(fontY(placed, truthLine(fixture.key, index('Q'))) - -O)).toBeLessThanOrEqual(
				ON_THE_LINE
			);
		});

		it('f alone: no tail until he says so; with [It has a tail] it spans top line to tail line', () => {
			const plain = alone('f');
			const sitting = placePart(plain.photo, plain.part.id, FONT);
			expect(sitting.tail).toBe(false);
			expect(Math.abs(fontY(sitting, partGeometry(plain.part).bottom))).toBeLessThanOrEqual(NEAR);

			const told = alone('f', { tail: true });
			const placed = placePart(told.photo, told.part.id, FONT);
			expect(placed).toMatchObject({ tail: true, bodyFrom: 'span' });
			expect(Math.abs(fontY(placed, partGeometry(told.part).top) - 1550)).toBeLessThanOrEqual(NEAR);
			expect(Math.abs(fontY(placed, partGeometry(told.part).bottom) - -396)).toBeLessThanOrEqual(
				NEAR
			);
			// With nothing else in the photo, where his line was is a guess from the lines' shares:
			// his tail is longer than the font's, so it lands under 7 % of the letter box high
			expect(Math.abs(fontY(placed, truthLine(fixture.key, index('f'))))).toBeLessThanOrEqual(
				0.07 * BOX
			);
		});

		it('f beside the a: the a shows where the line is', () => {
			const a = partOf('a');
			const f = partOf('f');
			const pair = { parts: [a, f], uses: { [a.id]: { char: 'a' }, [f.id]: { char: 'f' } } };
			const placed = placePart(pair, f.id, FONT);
			expect(placed).toMatchObject({ tail: true, bodyFrom: 'partner' });
			const aLine = fontY(placed, truthLine(fixture.key, index('a')));
			expect(Math.abs(aLine)).toBeLessThanOrEqual(ON_THE_LINE);
		});

		it('the period: 12 % of the small-letter height, on the writing line', () => {
			const { photo: one, part } = alone('.');
			const placed = placePart(one, part.id, FONT);
			expect(Math.abs(fontY(placed, partGeometry(part).bottom))).toBeLessThanOrEqual(NEAR);
			expect(Math.abs(fontY(placed, partGeometry(part).top) - 132)).toBeLessThanOrEqual(NEAR);
		});
	});
});
