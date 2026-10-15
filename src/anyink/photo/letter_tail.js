// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: Fine-tune > Tail (UX-BEGINNER.md 4.3 "Tail (g j p q y, Q J f only)", 4.4
	"Fine-tune > Tail ([It has a tail] / [No tail]) re-seats the letter if the guess was wrong"),
	the reader side. Pure and light: the letter card reads it without importing the photo flow;
	the press goes out as TAIL_EVENT and photo_app.js has the flow re-seat the letter
	(photo_flow_tail.js setLetterTail).

	The section shows only on a letter traced from a part of a photo in the font's photo list (a
	letter drawn with the Brush or the Point pen has no seat to change), whose letter may hang a
	tail (placement/classes.js tailKind: 'always' g j p q y, 'optional' Q J f). What it says is his
	own pick once he made one (the registry's use.tail), else what the letter shows: a tail when
	its ink reaches more than TAIL_BELOW_SHARE of the letter box below the writing line.

	  letterTail(project, item)   { asset, partId, kind, tail, chosen } or null
	  TAIL_EVENT                  'anyink-photo-tail' on window, detail { itemId, tail }
	  TAIL_BELOW_SHARE            0.05
*/
import { tailKind } from '../placement/classes.js';
import { inkBounds } from '../spacing/measure.js';
import { getTrace } from '../trace/trace_model.js';
import { getPhoto } from './photo_registry.js';

export const TAIL_EVENT = 'anyink-photo-tail';

/** Ink this share of the letter box below the writing line reads as a tail. */
export const TAIL_BELOW_SHARE = 0.05;

/**
 * @param {Object} project
 * @param {Object} item - Glyph
 * @returns {{asset: String, partId: String, kind: String, tail: Boolean, chosen: Boolean} | null}
 */
export function letterTail(project, item) {
	if (!project || !item) return null;
	const char = charOf(item);
	const kind = tailKind(char);
	if (kind === 'never') return null;
	const asset = getTrace(item)?.asset;
	const record = asset ? getPhoto(project, asset) : null;
	if (!record) return null;
	const entry = Object.entries(record.used || {}).find(([, use]) => use?.itemId === item.id);
	if (!entry) return null;
	const [partId, use] = entry;
	const chosen = typeof use.tail === 'boolean';
	return { asset, partId, kind, tail: chosen ? use.tail : inkBelow(project, item), chosen };
}

/** The letter's ink reaches well below the writing line. */
function inkBelow(project, item) {
	const ink = inkBounds(item);
	const font = project.settings?.font || {};
	const box = Math.abs(Number(font.ascent) || 0) + Math.abs(Number(font.descent) || 0);
	const size = box > 0 ? box : Number(font.upm) || 1000;
	return !!ink && Number.isFinite(ink.yMin) && ink.yMin < -TAIL_BELOW_SHARE * size;
}

function charOf(item) {
	if (typeof item?.char === 'string' && item.char) return item.char;
	const code = parseInt(String(item?.id || '').replace(/^glyph-/, ''), 16);
	return Number.isFinite(code) ? String.fromCodePoint(code) : '';
}
