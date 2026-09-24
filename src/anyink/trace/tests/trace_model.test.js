// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 7, track A: the trace data model (pure functions, font units, y-up).
import { describe, expect, it } from 'vitest';
import { Glyph } from '../../../project_data/glyph.js';
import {
	ASSET_PRUNING_READY,
	clampOpacity,
	collectReferencedAssetIds,
	getTrace,
	hitTestTrace,
	makeTrace,
	MIN_SIZE_FU,
	moveTrace,
	normalizeTrace,
	OPACITY_MIN,
	oppositeCorner,
	scaleTraceFromCorner,
	setTrace,
	TRACE_CORNERS,
	TRACE_DEFAULTS,
	traceBounds,
	traceCorner,
} from '../trace_model.js';

const KEYS = [
	'asset',
	'width',
	'height',
	'x',
	'y',
	'scale',
	'opacity',
	'visible',
	'locked',
	'invert',
];

/** 200 x 100 px at 2 font units per pixel: 400 x 200 units, top-left (100, 900). */
function base(overrides = {}) {
	return normalizeTrace({
		asset: 'img-base0000',
		width: 200,
		height: 100,
		x: 100,
		y: 900,
		scale: 2,
		...overrides,
	});
}

describe('constants', () => {
	it('match the contract', () => {
		expect(TRACE_DEFAULTS).toEqual({ opacity: 0.4, visible: true, locked: false, invert: false });
		expect(Object.isFrozen(TRACE_DEFAULTS)).toBe(true);
		expect(OPACITY_MIN).toBe(0.05);
		expect(MIN_SIZE_FU).toBe(20);
		expect(TRACE_CORNERS).toEqual(['nw', 'ne', 'se', 'sw']);
	});

	it('asset pruning is switched on now that collectReferencedAssetIds is real', () => {
		expect(ASSET_PRUNING_READY).toBe(true);
	});
});

describe('normalizeTrace', () => {
	it('fills every default and keeps only the known fields', () => {
		const t = normalizeTrace({ asset: 'img-a1b2c3d4', width: 100, height: 50, scale: 2 });
		expect(t).toEqual({
			asset: 'img-a1b2c3d4',
			width: 100,
			height: 50,
			x: 0,
			y: 0,
			scale: 2,
			opacity: 0.4,
			visible: true,
			locked: false,
			invert: false,
		});
		expect(Object.keys(t)).toEqual(KEYS);
	});

	it('keeps valid values as they are', () => {
		const raw = {
			asset: 'img-a1b2c3d4',
			width: 640,
			height: 480,
			x: -12.5,
			y: 830,
			scale: 1.75,
			opacity: 0.8,
			visible: false,
			locked: true,
			invert: true,
		};
		expect(normalizeTrace(raw)).toEqual(raw);
	});

	it('never carries a Blob or any other extra field into the glyph', () => {
		const t = normalizeTrace({
			asset: 'img-a1b2c3d4',
			width: 10,
			height: 10,
			scale: 1,
			blob: new Blob(['x']),
			bitmap: { width: 10 },
			note: 'hi',
		});
		expect(Object.keys(t)).toEqual(KEYS);
		expect(JSON.parse(JSON.stringify(t))).toEqual(t);
	});

	it('clamps opacity to OPACITY_MIN..1 and defaults junk', () => {
		const at = (opacity) =>
			normalizeTrace({ asset: 'img-a', width: 1, height: 1, scale: 1, opacity }).opacity;
		expect(at(0)).toBe(OPACITY_MIN);
		expect(at(-1)).toBe(OPACITY_MIN);
		expect(at(0.049)).toBe(OPACITY_MIN);
		expect(at(0.05)).toBe(0.05);
		expect(at(0.051)).toBe(0.051);
		expect(at(1)).toBe(1);
		expect(at(1.0001)).toBe(1);
		expect(at(7)).toBe(1);
		expect(at('0.5')).toBe(0.5);
		expect(at('abc')).toBe(0.4);
		expect(at(null)).toBe(0.4);
		expect(at(undefined)).toBe(0.4);
		expect(at(NaN)).toBe(0.4);
		expect(at(Infinity)).toBe(0.4);
		expect(at(true)).toBe(0.4);
		expect(clampOpacity(0.3)).toBe(0.3);
	});

	it('rejects junk: not an object, no asset, no size, no scale', () => {
		const good = { asset: 'img-a', width: 10, height: 10, scale: 1 };
		for (const bad of [null, undefined, 0, 'img-a', [], [good], true]) {
			expect(normalizeTrace(bad), JSON.stringify(bad)).toBeNull();
		}
		const variants = [
			{ asset: undefined },
			{ asset: '' },
			{ asset: '   ' },
			{ asset: 42 },
			{ asset: { id: 'img-a' } },
			{ width: 0 },
			{ width: -10 },
			{ width: undefined },
			{ width: 'wide' },
			{ width: Infinity },
			{ height: 0 },
			{ height: NaN },
			{ height: null },
			{ scale: 0 },
			{ scale: -2 },
			{ scale: undefined },
			{ scale: 'abc' },
			{ scale: false },
			{ width: 1e308, scale: 1e10 },
		];
		for (const v of variants) {
			expect(normalizeTrace({ ...good, ...v }), JSON.stringify(v)).toBeNull();
		}
	});

	it('reads numeric strings, trims the asset id, and zeroes a broken position', () => {
		const t = normalizeTrace({
			asset: ' img-a ',
			width: '100',
			height: '50',
			scale: '0.5',
			x: 'left',
			y: NaN,
		});
		expect(t).toMatchObject({ asset: 'img-a', width: 100, height: 50, scale: 0.5, x: 0, y: 0 });
	});

	it('only real booleans count for visible / locked / invert', () => {
		const t = normalizeTrace({
			asset: 'img-a',
			width: 1,
			height: 1,
			scale: 1,
			visible: 'false',
			locked: 1,
			invert: 'yes',
		});
		expect(t).toMatchObject({ visible: true, locked: false, invert: false });
	});

	it('does not change its input', () => {
		const raw = { asset: 'img-a', width: 1, height: 1, scale: 1, opacity: 9 };
		const copy = { ...raw };
		normalizeTrace(raw);
		expect(raw).toEqual(copy);
	});
});

describe('getTrace / setTrace', () => {
	it('an item with no trace (or no anyink at all) reads as null', () => {
		expect(getTrace(null)).toBeNull();
		expect(getTrace(undefined)).toBeNull();
		expect(getTrace({})).toBeNull();
		expect(getTrace({ anyink: {} })).toBeNull();
		expect(getTrace({ anyink: { trace: null } })).toBeNull();
		expect(getTrace({ objType: 'KernGroup', leftGroup: [] })).toBeNull();
		expect(getTrace(new Glyph({ id: 'glyph-0x41' }))).toBeNull();
	});

	it('returns a normalized copy, not the stored object', () => {
		const item = {
			anyink: { trace: { asset: 'img-a', width: 10, height: 20, scale: 3, opacity: 0 } },
		};
		const t = getTrace(item);
		expect(t).toMatchObject({ asset: 'img-a', opacity: OPACITY_MIN, visible: true });
		expect(t).not.toBe(item.anyink.trace);
		t.x = 999;
		expect(item.anyink.trace.x).toBeUndefined();
	});

	it('a stored trace that cannot be drawn reads as null', () => {
		expect(
			getTrace({ anyink: { trace: { asset: 'img-a', width: 0, height: 1, scale: 1 } } })
		).toBeNull();
		expect(getTrace({ anyink: { trace: 'img-a' } })).toBeNull();
	});

	it('stores a normalized copy that later edits to the argument cannot reach', () => {
		const item = new Glyph({ id: 'glyph-0x41' });
		const trace = { ...base(), opacity: 3, blob: new Blob(['x']) };
		expect(setTrace(item, trace)).toBe(true);
		trace.x = -5000;
		expect(item.anyink.trace).toEqual({ ...base(), opacity: 1 });
		expect('blob' in item.anyink.trace).toBe(false);
	});

	it('null or undefined deletes the trace and keeps other anyink data', () => {
		const item = { anyink: { trace: base(), nib: { strokes: [] } } };
		expect(setTrace(item, null)).toBe(true);
		expect(item.anyink).toEqual({ nib: { strokes: [] } });
		setTrace(item, base());
		expect(setTrace(item, undefined)).toBe(true);
		expect('trace' in item.anyink).toBe(false);
		expect(setTrace({}, null)).toBe(true);
	});

	it('an unusable trace or a missing item changes nothing', () => {
		const item = { anyink: { trace: base() } };
		expect(setTrace(item, { asset: '', width: 1, height: 1, scale: 1 })).toBe(false);
		expect(item.anyink.trace).toEqual(base());
		expect(setTrace(null, base())).toBe(false);
		expect(setTrace(undefined, null)).toBe(false);
	});

	it('creates item.anyink when an item has none', () => {
		const item = {};
		setTrace(item, base());
		expect(item.anyink.trace).toEqual(base());
	});

	it('a Glyph saves its trace as plain JSON and drops anyink when the trace is removed', () => {
		const glyph = new Glyph({ id: 'glyph-0x41' });
		setTrace(glyph, base());
		const saved = glyph.save();
		expect(saved.anyink.trace).toEqual(base());
		expect(JSON.parse(JSON.stringify(saved)).anyink.trace).toEqual(base());
		// A snapshot is a clone: editing the live glyph does not reach it
		setTrace(glyph, moveTrace(base(), 10, 0));
		expect(saved.anyink.trace.x).toBe(100);
		setTrace(glyph, null);
		expect('anyink' in glyph.save()).toBe(false);
		// And the saved trace comes back through the constructor
		expect(getTrace(new Glyph(saved))).toEqual(base());
	});
});

describe('makeTrace', () => {
	it('scales the image to ascent - descent, top at ascent, left at 0', () => {
		const t = makeTrace(
			{ asset: 'img-a', width: 400, height: 200 },
			{ ascent: 800, descent: -200, upm: 1000 }
		);
		expect(t).toEqual({
			asset: 'img-a',
			width: 400,
			height: 200,
			x: 0,
			y: 800,
			scale: 5,
			...TRACE_DEFAULTS,
		});
		expect(traceBounds(t)).toEqual({ xMin: 0, xMax: 2000, yMin: -200, yMax: 800 });
	});

	it('works for a portrait photo and any em size', () => {
		const t = makeTrace(
			{ asset: 'img-a', width: 1500, height: 2000 },
			{ ascent: 1638, descent: -410, upm: 2048 }
		);
		expect(t.scale).toBeCloseTo(2048 / 2000, 12);
		const b = traceBounds(t);
		expect(b.yMax).toBe(1638);
		expect(b.yMin).toBeCloseTo(-410, 9);
		expect(b.xMax).toBeCloseTo(1500 * (2048 / 2000), 9);
	});

	it('falls back to the em size when the font metrics are missing or broken', () => {
		const noFont = makeTrace({ asset: 'img-a', width: 100, height: 100 }, undefined);
		expect(noFont).toMatchObject({ y: 700, scale: 10 });
		const upmOnly = makeTrace({ asset: 'img-a', width: 100, height: 100 }, { upm: 2000 });
		expect(upmOnly.y).toBeCloseTo(1400, 9);
		expect(upmOnly.scale).toBeCloseTo(20, 9);
		const flat = makeTrace(
			{ asset: 'img-a', width: 100, height: 100 },
			{ ascent: 0, descent: 0, upm: 1000 }
		);
		expect(flat).toMatchObject({ y: 0, scale: 10 });
	});

	it('returns null for an image without an asset id or a size', () => {
		const font = { ascent: 800, descent: -200 };
		expect(makeTrace({ width: 10, height: 10 }, font)).toBeNull();
		expect(makeTrace({ asset: 'img-a', width: 0, height: 10 }, font)).toBeNull();
		expect(makeTrace({ asset: 'img-a', width: 10 }, font)).toBeNull();
		expect(makeTrace(null, font)).toBeNull();
	});
});

describe('traceBounds / traceCorner', () => {
	it('y is the top edge (y-up font units)', () => {
		expect(traceBounds(base())).toEqual({ xMin: 100, xMax: 500, yMin: 700, yMax: 900 });
	});

	it('handles negative coordinates', () => {
		const t = base({ x: -300, y: -100, width: 200, height: 100, scale: 0.5 });
		expect(traceBounds(t)).toEqual({ xMin: -300, xMax: -200, yMin: -150, yMax: -100 });
		expect(traceCorner(t, 'nw')).toEqual({ x: -300, y: -100 });
		expect(traceCorner(t, 'se')).toEqual({ x: -200, y: -150 });
		expect(traceCorner(t, 'center')).toEqual({ x: -250, y: -125 });
	});

	it('names every corner by where it sits on screen', () => {
		const t = base();
		expect(traceCorner(t, 'nw')).toEqual({ x: 100, y: 900 });
		expect(traceCorner(t, 'ne')).toEqual({ x: 500, y: 900 });
		expect(traceCorner(t, 'sw')).toEqual({ x: 100, y: 700 });
		expect(traceCorner(t, 'se')).toEqual({ x: 500, y: 700 });
		expect(traceCorner(t, 'middle')).toBeNull();
		expect(oppositeCorner('nw')).toBe('se');
		expect(oppositeCorner('sw')).toBe('ne');
	});

	it('null in, null out', () => {
		expect(traceBounds(null)).toBeNull();
		expect(traceCorner(null, 'nw')).toBeNull();
	});
});

describe('hitTestTrace', () => {
	// bounds x 0..1000, y 500..1000
	const t = base({ x: 0, y: 1000, width: 100, height: 50, scale: 10 });

	it('finds each corner', () => {
		expect(hitTestTrace(t, { x: 0, y: 1000 }, 20)).toBe('nw');
		expect(hitTestTrace(t, { x: 1000, y: 1000 }, 20)).toBe('ne');
		expect(hitTestTrace(t, { x: 0, y: 500 }, 20)).toBe('sw');
		expect(hitTestTrace(t, { x: 1000, y: 500 }, 20)).toBe('se');
	});

	it('corners win over the body, and reach a little outside the image', () => {
		expect(hitTestTrace(t, { x: 15, y: 985 }, 20)).toBe('nw');
		expect(hitTestTrace(t, { x: -20, y: 1020 }, 20)).toBe('nw');
		expect(hitTestTrace(t, { x: 1019, y: 481 }, 20)).toBe('se');
		expect(hitTestTrace(t, { x: 21, y: 979 }, 20)).toBe('move');
	});

	it('the body moves; outside is nothing', () => {
		expect(hitTestTrace(t, { x: 500, y: 750 }, 20)).toBe('move');
		expect(hitTestTrace(t, { x: 0, y: 750 }, 20)).toBe('move');
		expect(hitTestTrace(t, { x: 500, y: 1000 }, 20)).toBe('move');
		expect(hitTestTrace(t, { x: -21, y: 1000 }, 20)).toBe(false);
		expect(hitTestTrace(t, { x: 1100, y: 750 }, 20)).toBe(false);
		expect(hitTestTrace(t, { x: 500, y: 499 }, 20)).toBe(false);
	});

	it('the handle radius is in font units, so a bigger radius reaches further', () => {
		expect(hitTestTrace(t, { x: 40, y: 960 }, 20)).toBe('move');
		expect(hitTestTrace(t, { x: 40, y: 960 }, 50)).toBe('nw');
		expect(hitTestTrace(t, { x: -40, y: 1000 }, 50)).toBe('nw');
	});

	it('with no radius only the exact corner point counts', () => {
		expect(hitTestTrace(t, { x: 0, y: 1000 }, 0)).toBe('nw');
		expect(hitTestTrace(t, { x: 1, y: 999 }, 0)).toBe('move');
		expect(hitTestTrace(t, { x: 1, y: 999 }, NaN)).toBe('move');
		expect(hitTestTrace(t, { x: 1, y: 999 }, -5)).toBe('move');
	});

	it('on a tiny image the nearest corner wins', () => {
		// 20 x 10 units: every corner zone overlaps the others
		const tiny = base({ x: 0, y: 1000, width: 2, height: 1, scale: 10 });
		expect(hitTestTrace(tiny, { x: 18, y: 992 }, 20)).toBe('se');
		expect(hitTestTrace(tiny, { x: 19, y: 1000 }, 20)).toBe('ne');
		expect(hitTestTrace(tiny, { x: 1, y: 991 }, 20)).toBe('sw');
	});

	it('works with negative coordinates', () => {
		const neg = base({ x: -300, y: -100, width: 200, height: 100, scale: 0.5 });
		expect(hitTestTrace(neg, { x: -300, y: -100 }, 5)).toBe('nw');
		expect(hitTestTrace(neg, { x: -250, y: -125 }, 5)).toBe('move');
		expect(hitTestTrace(neg, { x: -250, y: -160 }, 5)).toBe(false);
	});

	it('bad input is a miss, never a throw', () => {
		expect(hitTestTrace(null, { x: 0, y: 0 }, 5)).toBe(false);
		expect(hitTestTrace(t, null, 5)).toBe(false);
		expect(hitTestTrace(t, { x: 'a', y: 0 }, 5)).toBe(false);
	});
});

describe('moveTrace', () => {
	it('returns a moved copy and leaves the original alone', () => {
		const t = base();
		const moved = moveTrace(t, -150, 25.5);
		expect(moved).toEqual({ ...t, x: -50, y: 925.5 });
		expect(moved).not.toBe(t);
		expect(t.x).toBe(100);
	});

	it('a non-number delta moves nothing on that axis', () => {
		expect(moveTrace(base(), NaN, 'up')).toEqual(base());
		expect(moveTrace(null, 1, 1)).toBeNull();
	});
});

describe('scaleTraceFromCorner', () => {
	// base(): 200 x 100 px, scale 2 -> 400 x 200 units, bounds x 100..500, y 700..900
	const expectFixed = (t, corner, point) => {
		const c = traceCorner(t, corner);
		expect(c.x).toBeCloseTo(point.x, 9);
		expect(c.y).toBeCloseTo(point.y, 9);
	};

	it('dropping a corner where it already is changes nothing', () => {
		for (const corner of TRACE_CORNERS) {
			const t = scaleTraceFromCorner(base(), corner, traceCorner(base(), corner));
			expect(t.scale).toBeCloseTo(2, 12);
			expect(t.x).toBeCloseTo(100, 9);
			expect(t.y).toBeCloseTo(900, 9);
		}
	});

	it('se: the nw corner stays put', () => {
		const t = scaleTraceFromCorner(base(), 'se', { x: 900, y: 500 });
		expect(t.scale).toBeCloseTo(4, 12);
		expectFixed(t, 'nw', { x: 100, y: 900 });
		expectFixed(t, 'se', { x: 900, y: 500 });
	});

	it('nw: the se corner stays put', () => {
		const t = scaleTraceFromCorner(base(), 'nw', { x: 300, y: 800 });
		expect(t.scale).toBeCloseTo(1, 12);
		expectFixed(t, 'se', { x: 500, y: 700 });
		expectFixed(t, 'nw', { x: 300, y: 800 });
	});

	it('ne: the sw corner stays put', () => {
		const t = scaleTraceFromCorner(base(), 'ne', { x: 900, y: 1100 });
		expect(t.scale).toBeCloseTo(4, 12);
		expectFixed(t, 'sw', { x: 100, y: 700 });
		expectFixed(t, 'ne', { x: 900, y: 1100 });
	});

	it('sw: the ne corner stays put, into negative coordinates', () => {
		const t = scaleTraceFromCorner(base(), 'sw', { x: -300, y: 500 });
		expect(t.scale).toBeCloseTo(4, 12);
		expectFixed(t, 'ne', { x: 500, y: 900 });
		expectFixed(t, 'sw', { x: -300, y: 500 });
	});

	it('keeps the aspect ratio when the pointer is off the diagonal', () => {
		// Straight right from the se corner: projected onto the diagonal
		const t = scaleTraceFromCorner(base(), 'se', { x: 900, y: 700 });
		expect(t.scale).toBeCloseTo(3.6, 12);
		expect(t.width).toBe(200);
		expect(t.height).toBe(100);
		const b = traceBounds(t);
		expect((b.xMax - b.xMin) / (b.yMax - b.yMin)).toBeCloseTo(2, 12);
		expectFixed(t, 'nw', { x: 100, y: 900 });
	});

	it('fromCenter keeps the center put', () => {
		const t = scaleTraceFromCorner(base(), 'se', { x: 700, y: 600 }, { fromCenter: true });
		expect(t.scale).toBeCloseTo(4, 12);
		expectFixed(t, 'center', { x: 300, y: 800 });
		expect(traceBounds(t).xMin).toBeCloseTo(-100, 9);
		expect(traceBounds(t).yMax).toBeCloseTo(1000, 9);
		const nw = scaleTraceFromCorner(base(), 'nw', { x: 200, y: 850 }, { fromCenter: true });
		expect(nw.scale).toBeCloseTo(1, 12);
		expectFixed(nw, 'center', { x: 300, y: 800 });
	});

	it('never smaller than MIN_SIZE_FU on the short side, and never flips', () => {
		// Dragged the se corner far past the nw corner
		const t = scaleTraceFromCorner(base(), 'se', { x: -5000, y: 5000 });
		expect(t.height * t.scale).toBeCloseTo(MIN_SIZE_FU, 9);
		expect(t.width * t.scale).toBeCloseTo(MIN_SIZE_FU * 2, 9);
		expectFixed(t, 'nw', { x: 100, y: 900 });

		const centered = scaleTraceFromCorner(base(), 'ne', { x: 300, y: 800 }, { fromCenter: true });
		expect(centered.height * centered.scale).toBeCloseTo(MIN_SIZE_FU, 9);
		expectFixed(centered, 'center', { x: 300, y: 800 });

		// Portrait: the short side is the width
		const tall = base({ width: 50, height: 200 });
		const small = scaleTraceFromCorner(tall, 'sw', traceCorner(tall, 'ne'));
		expect(small.width * small.scale).toBeCloseTo(MIN_SIZE_FU, 9);
		expectFixed(small, 'ne', traceCorner(tall, 'ne'));
	});

	it('an unknown corner or point returns an unchanged copy; null stays null', () => {
		const t = base();
		for (const [corner, point] of [
			['move', { x: 0, y: 0 }],
			['north', { x: 0, y: 0 }],
			['se', null],
			['se', { x: NaN, y: 0 }],
		]) {
			const out = scaleTraceFromCorner(t, corner, point);
			expect(out).toEqual(t);
			expect(out).not.toBe(t);
		}
		expect(scaleTraceFromCorner(null, 'se', { x: 0, y: 0 })).toBeNull();
	});

	it('does not change its input', () => {
		const t = base();
		scaleTraceFromCorner(t, 'se', { x: 900, y: 500 });
		expect(t).toEqual(base());
	});
});

describe('collectReferencedAssetIds', () => {
	const withTrace = (asset) => ({ anyink: { trace: { asset, width: 1, height: 1, scale: 1 } } });

	it('gathers the images used by glyphs, ligatures, components, and alternates', () => {
		const project = {
			glyphs: {
				'glyph-0x41': withTrace('img-glyph001'),
				'glyph-0x42': { anyink: {} },
				'glyph-0x43': {},
				'glyph-0x44': withTrace('img-glyph001'),
			},
			ligatures: { 'liga-f-i': withTrace('img-liga0001') },
			components: { 'comp-0': withTrace('img-comp0001') },
			alternates: { 'alt-0x61-1': withTrace('img-alt00001') },
			kerning: { 'kern-1': withTrace('img-kern0001') },
		};
		expect([...collectReferencedAssetIds(project)].sort()).toEqual([
			'img-alt00001',
			'img-comp0001',
			'img-glyph001',
			'img-liga0001',
		]);
	});

	it('keeps the image of a damaged trace, so a save never drops it', () => {
		const project = { glyphs: { a: { anyink: { trace: { asset: 'img-broken00', width: 0 } } } } };
		expect([...collectReferencedAssetIds(project)]).toEqual(['img-broken00']);
	});

	it('empty or missing projects give an empty Set', () => {
		for (const p of [{}, null, undefined, { glyphs: null }, { glyphs: [] }]) {
			const ids = collectReferencedAssetIds(p);
			expect(ids).toBeInstanceOf(Set);
			expect(ids.size).toBe(0);
		}
		expect(
			collectReferencedAssetIds({ glyphs: { a: { anyink: { trace: { asset: '' } } } } }).size
		).toBe(0);
	});
});
