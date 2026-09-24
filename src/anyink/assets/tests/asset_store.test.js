// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { beforeEach, describe, expect, it } from 'vitest';
import {
	AssetStore,
	IMAGE_TYPES,
	assetsSizeBytes,
	isImageType,
	makeAssetID,
	normalizeType,
} from '../asset_store.js';
import { blobToBytes } from '../base64.js';

// 1 x 1 transparent PNG, 70 bytes.
const PNG_BYTES = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x64, 0x60, 0xf8, 0x5f,
	0x0f, 0x00, 0x02, 0x87, 0x01, 0x80, 0xeb, 0x47, 0xba, 0x92, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
	0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const png = () => new Blob([PNG_BYTES], { type: 'image/png' });
const bytesOf = async (blob) => Array.from(await blobToBytes(blob));

describe('makeAssetID / type helpers', () => {
	it('makes ids of the form img-<8 base36 chars>, all different', () => {
		const ids = new Set();
		for (let i = 0; i < 200; i++) {
			const id = makeAssetID();
			expect(id).toMatch(/^img-[a-z0-9]{8}$/);
			ids.add(id);
		}
		expect(ids.size).toBe(200);
	});

	it('normalizes case, parameters, and JPEG aliases', () => {
		expect(normalizeType('image/PNG')).toBe('image/png');
		expect(normalizeType(' image/jpeg; q=0.9 ')).toBe('image/jpeg');
		expect(normalizeType('image/jpg')).toBe('image/jpeg');
		expect(normalizeType('image/pjpeg')).toBe('image/jpeg');
		expect(normalizeType('')).toBe('');
		expect(normalizeType(undefined)).toBe('');
	});

	it('isImageType accepts only PNG, JPEG, WebP', () => {
		expect(IMAGE_TYPES).toEqual(['image/png', 'image/jpeg', 'image/webp']);
		for (const t of ['image/png', 'image/jpeg', 'image/webp', 'image/jpg', 'IMAGE/PNG']) {
			expect(isImageType(t)).toBe(true);
		}
		for (const t of ['image/gif', 'image/svg+xml', 'image/heic', 'text/plain', '', undefined]) {
			expect(isImageType(t)).toBe(false);
		}
	});
});

describe('AssetStore: add / get / has / delete / ids / clear', () => {
	let store;
	beforeEach(() => {
		store = new AssetStore();
	});

	it('starts empty', () => {
		expect(store.ids()).toEqual([]);
		expect(store.has('img-anything')).toBe(false);
		expect(store.get('img-anything')).toBeUndefined();
		expect(assetsSizeBytes(store)).toBe(0);
	});

	it('add returns a new id and stores the blob with its type', () => {
		const blob = png();
		const id = store.add(blob);
		expect(id).toMatch(/^img-[a-z0-9]{8}$/);
		expect(store.has(id)).toBe(true);
		expect(store.get(id)).toEqual({ id, type: 'image/png', blob });
		expect(store.get(id).blob).toBe(blob);
		expect(store.ids()).toEqual([id]);
	});

	it('keeps a given id, and re-using it replaces the asset', () => {
		const first = png();
		const second = new Blob([PNG_BYTES, PNG_BYTES], { type: 'image/png' });
		expect(store.add(first, { id: 'img-known001' })).toBe('img-known001');
		expect(store.add(second, { id: 'img-known001' })).toBe('img-known001');
		expect(store.ids()).toEqual(['img-known001']);
		expect(store.get('img-known001').blob).toBe(second);
	});

	it('ids come back in insertion order; delete reports what it removed', () => {
		const a = store.add(png());
		const b = store.add(png());
		const c = store.add(png());
		expect(store.ids()).toEqual([a, b, c]);
		expect(store.delete(b)).toBe(true);
		expect(store.delete(b)).toBe(false);
		expect(store.ids()).toEqual([a, c]);
	});

	it('clear empties the store', () => {
		store.add(png());
		store.add(png());
		store.clear();
		expect(store.ids()).toEqual([]);
	});

	it('assetsSizeBytes sums every blob', () => {
		store.add(png());
		store.add(new Blob([PNG_BYTES, PNG_BYTES], { type: 'image/jpeg' }));
		expect(assetsSizeBytes(store)).toBe(PNG_BYTES.length * 3);
		expect(assetsSizeBytes(null)).toBe(0);
	});

	// M7 fix: copying traced items between projects finds an image the destination
	// already holds, so one shared image is stored once
	it('idOf finds the id holding that exact Blob, else an empty string', () => {
		const blob = png();
		const lookAlike = png();
		store.add(png());
		const id = store.add(blob);
		expect(store.idOf(blob)).toBe(id);
		expect(store.idOf(lookAlike)).toBe('');
		expect(store.idOf(null)).toBe('');
		store.delete(id);
		expect(store.idOf(blob)).toBe('');
	});
});

describe('AssetStore: type rules', () => {
	let store;
	beforeEach(() => {
		store = new AssetStore();
	});

	it('accepts PNG, JPEG, and WebP', () => {
		for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
			const id = store.add(new Blob([PNG_BYTES], { type }));
			expect(store.get(id).type).toBe(type);
		}
	});

	it('folds image/jpg into image/jpeg and lets the type option fill an empty blob type', () => {
		const a = store.add(new Blob([PNG_BYTES], { type: 'image/jpg' }));
		expect(store.get(a).type).toBe('image/jpeg');
		const b = store.add(new Blob([PNG_BYTES]), { type: 'image/webp' });
		expect(store.get(b).type).toBe('image/webp');
	});

	it('rejects other types with a TypeError that names the type in plain words', () => {
		const bad = ['text/plain', 'image/gif', 'image/svg+xml', 'image/heic', 'application/pdf'];
		for (const type of bad) {
			expect(() => store.add(new Blob([PNG_BYTES], { type }))).toThrow(TypeError);
			expect(() => store.add(new Blob([PNG_BYTES], { type }))).toThrow(
				`Only PNG, JPEG, or WebP images can be added (this file is "${type}").`
			);
		}
		expect(store.ids()).toEqual([]);
	});

	it('rejects a blob with no type, and the type option cannot smuggle a bad one in', () => {
		expect(() => store.add(new Blob([PNG_BYTES]))).toThrow('this file has no type');
		expect(() => store.add(png(), { type: 'image/gif' })).toThrow('"image/gif"');
	});

	it('rejects things that are not Blobs', () => {
		for (const notBlob of [null, undefined, 'image/png', 42, {}, { type: 'image/png' }, []]) {
			expect(() => store.add(notBlob)).toThrow(TypeError);
			expect(() => store.add(notBlob)).toThrow('this is not a file');
		}
	});
});

describe('AssetStore: save object (base64) round trip', () => {
	it('empty store gives {} and loading {} / undefined empties the store', async () => {
		const store = new AssetStore();
		expect(await store.toSaveObject()).toEqual({});
		store.add(png());
		expect(await store.loadSaveObject({})).toEqual([]);
		expect(store.ids()).toEqual([]);
		store.add(png());
		expect(await store.loadSaveObject(undefined)).toEqual([]);
		expect(store.ids()).toEqual([]);
	});

	it('writes { [id]: { type, data } } with base64 data', async () => {
		const store = new AssetStore();
		store.add(png(), { id: 'img-aaaaaaaa' });
		const saved = await store.toSaveObject();
		expect(saved).toEqual({ 'img-aaaaaaaa': { type: 'image/png', data: PNG_BASE64 } });
		expect(() => JSON.stringify(saved)).not.toThrow();
	});

	it('round trip through JSON is byte-exact and keeps ids, types, and order', async () => {
		const store = new AssetStore();
		const twice = new Uint8Array([...PNG_BYTES, ...PNG_BYTES]);
		const a = store.add(png());
		const b = store.add(new Blob([twice], { type: 'image/jpeg' }));
		const c = store.add(new Blob([PNG_BYTES], { type: 'image/webp' }));

		const json = JSON.stringify(await store.toSaveObject());
		const loaded = new AssetStore();
		const skipped = await loaded.loadSaveObject(JSON.parse(json));

		expect(skipped).toEqual([]);
		expect(loaded.ids()).toEqual([a, b, c]);
		expect(loaded.get(a).type).toBe('image/png');
		expect(loaded.get(b).type).toBe('image/jpeg');
		expect(loaded.get(c).type).toBe('image/webp');
		expect(loaded.get(a).blob.type).toBe('image/png');
		expect(await bytesOf(loaded.get(a).blob)).toEqual(Array.from(PNG_BYTES));
		expect(await bytesOf(loaded.get(b).blob)).toEqual(Array.from(twice));
		expect(await bytesOf(loaded.get(c).blob)).toEqual(Array.from(PNG_BYTES));
		expect(assetsSizeBytes(loaded)).toBe(assetsSizeBytes(store));

		// Saving the loaded store again gives the same text.
		expect(JSON.stringify(await loaded.toSaveObject())).toBe(json);
	});

	it('loadSaveObject replaces what was there', async () => {
		const store = new AssetStore();
		store.add(png(), { id: 'img-old00000' });
		await store.loadSaveObject({ 'img-new00000': { type: 'image/png', data: PNG_BASE64 } });
		expect(store.ids()).toEqual(['img-new00000']);
	});

	it('skips entries it cannot decode, reports them, and keeps the good ones', async () => {
		const store = new AssetStore();
		const skipped = await store.loadSaveObject({
			'img-good0001': { type: 'image/png', data: PNG_BASE64 },
			'img-nodata00': { type: 'image/png' },
			'img-badtype0': { type: 'image/gif', data: PNG_BASE64 },
			'img-notb64ke': { type: 'image/png', data: '***not base64***' },
			'img-nullentr': null,
			'img-good0002': { type: 'image/JPG', data: PNG_BASE64 },
		});
		expect(store.ids()).toEqual(['img-good0001', 'img-good0002']);
		expect(store.get('img-good0002').type).toBe('image/jpeg');
		expect(skipped.map((s) => s.id)).toEqual([
			'img-nodata00',
			'img-badtype0',
			'img-notb64ke',
			'img-nullentr',
		]);
		for (const s of skipped) expect(typeof s.reason).toBe('string');
		expect(skipped[0].reason).toBe('The image data is missing.');
		expect(skipped[1].reason).toContain('"image/gif"');
	});
});

// Milestone 7 (09/24/2026): the .gs2 writes only assets some trace still uses.
describe('AssetStore: toSaveObject({ ids }) limits the output', () => {
	const build = () => {
		const store = new AssetStore();
		store.add(png(), { id: 'img-aaaaaaaa' });
		store.add(new Blob([PNG_BYTES], { type: 'image/jpeg' }), { id: 'img-bbbbbbbb' });
		store.add(new Blob([PNG_BYTES], { type: 'image/webp' }), { id: 'img-cccccccc' });
		return store;
	};

	it('no argument, an empty options object, or ids: undefined / null writes every asset', async () => {
		const store = build();
		const all = ['img-aaaaaaaa', 'img-bbbbbbbb', 'img-cccccccc'];
		expect(Object.keys(await store.toSaveObject())).toEqual(all);
		expect(Object.keys(await store.toSaveObject({}))).toEqual(all);
		expect(Object.keys(await store.toSaveObject({ ids: undefined }))).toEqual(all);
		expect(Object.keys(await store.toSaveObject({ ids: null }))).toEqual(all);
	});

	it('a Set keeps only those ids, in store order, with the same entries', async () => {
		const store = build();
		const all = await store.toSaveObject();
		const some = await store.toSaveObject({ ids: new Set(['img-cccccccc', 'img-aaaaaaaa']) });
		expect(Object.keys(some)).toEqual(['img-aaaaaaaa', 'img-cccccccc']);
		expect(some['img-aaaaaaaa']).toEqual(all['img-aaaaaaaa']);
		expect(some['img-cccccccc']).toEqual({ type: 'image/webp', data: PNG_BASE64 });
	});

	it('an Array works too, and ids the store does not hold are ignored', async () => {
		const store = build();
		const some = await store.toSaveObject({ ids: ['img-bbbbbbbb', 'img-missing0'] });
		expect(Object.keys(some)).toEqual(['img-bbbbbbbb']);
		expect(some['img-bbbbbbbb'].type).toBe('image/jpeg');
	});

	it('an empty Set writes nothing, and never touches the store itself', async () => {
		const store = build();
		expect(await store.toSaveObject({ ids: new Set() })).toEqual({});
		expect(store.ids()).toEqual(['img-aaaaaaaa', 'img-bbbbbbbb', 'img-cccccccc']);
		expect(Object.keys(store.toBlobMap())).toHaveLength(3);
	});

	it('a limited save still round-trips through loadSaveObject', async () => {
		const store = build();
		const json = JSON.stringify(await store.toSaveObject({ ids: new Set(['img-bbbbbbbb']) }));
		const loaded = new AssetStore();
		expect(await loaded.loadSaveObject(JSON.parse(json))).toEqual([]);
		expect(loaded.ids()).toEqual(['img-bbbbbbbb']);
		expect(await bytesOf(loaded.get('img-bbbbbbbb').blob)).toEqual(Array.from(PNG_BYTES));
	});
});

describe('AssetStore: blob map round trip (crash recovery)', () => {
	it('toBlobMap hands out the same Blob objects with their types', () => {
		const store = new AssetStore();
		const blob = png();
		const id = store.add(blob);
		const map = store.toBlobMap();
		expect(Object.keys(map)).toEqual([id]);
		expect(map[id].type).toBe('image/png');
		expect(map[id].blob).toBe(blob);
	});

	it('loadBlobMap rebuilds the store from a map, replacing existing content', () => {
		const store = new AssetStore();
		const a = store.add(png());
		const b = store.add(new Blob([PNG_BYTES], { type: 'image/webp' }));
		const map = store.toBlobMap();

		const loaded = new AssetStore();
		loaded.add(png(), { id: 'img-stale000' });
		expect(loaded.loadBlobMap(map)).toEqual([]);
		expect(loaded.ids()).toEqual([a, b]);
		expect(loaded.get(a).blob).toBe(store.get(a).blob);
		expect(loaded.get(b).type).toBe('image/webp');
		expect(loaded.toBlobMap()).toEqual(map);
	});

	it('empty store gives {}; loading null / {} empties the store', () => {
		const store = new AssetStore();
		expect(store.toBlobMap()).toEqual({});
		store.add(png());
		expect(store.loadBlobMap(null)).toEqual([]);
		expect(store.ids()).toEqual([]);
		store.add(png());
		store.loadBlobMap({});
		expect(store.ids()).toEqual([]);
	});

	it('skips entries without a usable blob or type and reports them', () => {
		const store = new AssetStore();
		const skipped = store.loadBlobMap({
			'img-good0001': { type: 'image/png', blob: png() },
			'img-noblob00': { type: 'image/png' },
			'img-badtype0': { type: 'image/gif', blob: png() },
			'img-notype00': { blob: new Blob([PNG_BYTES]) },
		});
		expect(store.ids()).toEqual(['img-good0001']);
		expect(skipped.map((s) => s.id)).toEqual(['img-noblob00', 'img-badtype0', 'img-notype00']);
	});
});
