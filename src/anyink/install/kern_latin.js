// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 + B15 integration (FACTCHECK_LOG 8.12): gap fixes listed for Latin text too. font-flux-js
	2.9.0 lists the font's "kern" feature only under the default script (DFLT), and a 2022 report
	says Word reads kerning only from the script the text is in (Latin, 'latn'). This adds a 'latn'
	script record pointing at the very same script table, so every script the font had, and
	everything under it, stays as it was; Latin text now finds the same features.

	It works on the finished font file's bytes (an OpenType file, .otf or .ttf): a new GPOS table
	is laid out as a new header and script list followed by the old table whole (its own offsets
	still good from the new places), and the file is written again with every table's checksum
	and head's checkSumAdjustment worked out afresh. A file with no GPOS, a GPOS that already has
	'latn', no DFLT, or offsets that would not fit, comes back unchanged.

	  withLatinKern(buffer)      ArrayBuffer: the font file with 'latn' added, or the same buffer
	  scriptTags(buffer)         the GPOS script tags, in order ([] with no GPOS); for tests
	  tableChecksumsOk(buffer)   true when every table's checksum and the whole-file sum agree
*/

const HEAD_MAGIC = 0xb1b0afba;

/** @returns {Array<{tag: String, checksum: Number, offset: Number, length: Number}>} */
function readDirectory(view) {
	const count = view.getUint16(4);
	const tables = [];
	for (let i = 0; i < count; i++) {
		const at = 12 + 16 * i;
		tables.push({
			tag: String.fromCharCode(
				view.getUint8(at),
				view.getUint8(at + 1),
				view.getUint8(at + 2),
				view.getUint8(at + 3)
			),
			checksum: view.getUint32(at + 4),
			offset: view.getUint32(at + 8),
			length: view.getUint32(at + 12),
		});
	}
	return tables;
}

/** The OpenType table checksum: the sum of its 32-bit words, zero-padded */
function checksumOf(bytes) {
	const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
	padded.set(bytes);
	const view = new DataView(padded.buffer);
	let sum = 0;
	for (let i = 0; i < padded.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
	return sum;
}

const tagAt = (view, at) =>
	String.fromCharCode(
		view.getUint8(at),
		view.getUint8(at + 1),
		view.getUint8(at + 2),
		view.getUint8(at + 3)
	);

/**
 * @param {Uint8Array} old - the GPOS table
 * @returns {Uint8Array | null} the GPOS with 'latn', or null to leave it
 */
function gposWithLatin(old) {
	const view = new DataView(old.buffer, old.byteOffset, old.byteLength);
	if (old.length < 10 || view.getUint16(0) !== 1) return null;
	const minor = view.getUint16(2);
	const headerLength = minor >= 1 ? 14 : 10;
	const scriptList = view.getUint16(4);
	const featureList = view.getUint16(6);
	const lookupList = view.getUint16(8);
	const variations = minor >= 1 ? view.getUint32(10) : 0;
	if (!scriptList) return null;
	const count = view.getUint16(scriptList);
	const records = [];
	for (let i = 0; i < count; i++) {
		const at = scriptList + 2 + 6 * i;
		records.push({ tag: tagAt(view, at), offset: view.getUint16(at + 4) });
	}
	if (records.some((record) => record.tag === 'latn')) return null;
	const dflt = records.find((record) => record.tag === 'DFLT');
	if (!dflt) return null;
	records.push({ tag: 'latn', offset: dflt.offset });
	// Script records are sorted by tag, byte by byte ('DFLT' before 'latn')
	records.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

	const listLength = 2 + 6 * records.length;
	const shift = headerLength + listLength;
	const moved = (offset) => (offset ? shift + offset : 0);
	const scriptOffsets = records.map((record) => shift + scriptList + record.offset - headerLength);
	if ([moved(featureList), moved(lookupList), ...scriptOffsets].some((offset) => offset > 0xffff))
		return null;

	const out = new Uint8Array(shift + old.length);
	const write = new DataView(out.buffer);
	write.setUint16(0, 1);
	write.setUint16(2, minor);
	write.setUint16(4, headerLength);
	write.setUint16(6, moved(featureList));
	write.setUint16(8, moved(lookupList));
	if (minor >= 1) write.setUint32(10, moved(variations));
	write.setUint16(headerLength, records.length);
	records.forEach((record, i) => {
		const at = headerLength + 2 + 6 * i;
		for (let k = 0; k < 4; k++) write.setUint8(at + k, record.tag.charCodeAt(k));
		write.setUint16(at + 4, scriptOffsets[i]);
	});
	out.set(old, shift);
	return out;
}

/**
 * The font file again, with some tables replaced; checksums made afresh.
 * @param {ArrayBuffer} buffer
 * @param {Object<String, Uint8Array>} replaced - tag -> new bytes
 * @returns {ArrayBuffer}
 */
function rewrite(buffer, replaced) {
	const view = new DataView(buffer);
	const tables = readDirectory(view);
	const bytesOf = (table) =>
		replaced[table.tag] || new Uint8Array(buffer, table.offset, table.length);
	const headerLength = 12 + 16 * tables.length;
	const order = [...tables].sort((a, b) => a.offset - b.offset);
	const placed = new Map();
	let end = headerLength;
	order.forEach((table) => {
		placed.set(table.tag, end);
		end += Math.ceil(bytesOf(table).length / 4) * 4;
	});
	const out = new Uint8Array(end);
	out.set(new Uint8Array(buffer, 0, 12));
	const write = new DataView(out.buffer);
	tables.forEach((table, i) => {
		const bytes = bytesOf(table);
		const at = placed.get(table.tag);
		out.set(bytes, at);
		if (table.tag === 'head' && bytes.length >= 12) write.setUint32(at + 8, 0);
		const record = 12 + 16 * i;
		for (let k = 0; k < 4; k++) write.setUint8(record + k, table.tag.charCodeAt(k));
		write.setUint32(record + 4, checksumOf(out.subarray(at, at + bytes.length)));
		write.setUint32(record + 8, at);
		write.setUint32(record + 12, bytes.length);
	});
	const head = placed.get('head');
	if (head !== undefined) write.setUint32(head + 8, (HEAD_MAGIC - checksumOf(out)) >>> 0);
	return out.buffer;
}

/**
 * @param {ArrayBuffer} buffer - an OpenType font file
 * @returns {ArrayBuffer}
 */
export function withLatinKern(buffer) {
	try {
		const view = new DataView(buffer);
		const gpos = readDirectory(view).find((table) => table.tag === 'GPOS');
		if (!gpos) return buffer;
		const added = gposWithLatin(new Uint8Array(buffer, gpos.offset, gpos.length));
		return added ? rewrite(buffer, { GPOS: added }) : buffer;
	} catch (error) {
		console.warn(`Gap fixes for Latin text were not added: ${error.message}`);
		return buffer;
	}
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Array<String>}
 */
export function scriptTags(buffer) {
	const view = new DataView(buffer);
	const gpos = readDirectory(view).find((table) => table.tag === 'GPOS');
	if (!gpos) return [];
	const list = gpos.offset + view.getUint16(gpos.offset + 4);
	const count = view.getUint16(list);
	return Array.from({ length: count }, (_, i) => tagAt(view, list + 2 + 6 * i));
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Boolean}
 */
export function tableChecksumsOk(buffer) {
	const view = new DataView(buffer);
	const tables = readDirectory(view);
	const tablesOk = tables.every((table) => {
		const bytes = new Uint8Array(buffer, table.offset, table.length).slice();
		if (table.tag === 'head') new DataView(bytes.buffer).setUint32(8, 0);
		return checksumOf(bytes) === table.checksum;
	});
	return tablesOk && checksumOf(new Uint8Array(buffer)) === HEAD_MAGIC;
}
