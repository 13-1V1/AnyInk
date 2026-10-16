// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 fix-track fixtures: sketches a hand-edited or damaged work file, or a crash copy, could
	hold. Each call returns a fresh copy; every one uses DAMAGED_KEY so a shape tagged with it
	looks like that sketch's built shape.

	  DAMAGED_KEY
	  badShapeSketches()    v1 sketches whose points or pieces are the wrong kind of thing
	  unreadableVSketches() sketches whose v this app can't read (not 0, not 1, not a newer whole
	                        number)
*/

export const DAMAGED_KEY = 'sk_damaged01';

/** @returns {Array<[String, Object]>} [name, sketch] */
export function badShapeSketches() {
	const base = () => ({ v: 1, key: DAMAGED_KEY, way: 'center', thickness: 99, ends: 'round' });
	return [
		['pieces {}', { ...base(), points: {}, pieces: {} }],
		["pieces 'oops'", { ...base(), points: {}, pieces: 'oops' }],
		['pieces null', { ...base(), points: {}, pieces: null }],
		['points a list', { ...base(), points: [], pieces: [] }],
		['no points, no pieces', { v: 1, key: DAMAGED_KEY }],
	];
}

/** @returns {Array<[String, Object]>} [name, sketch] */
export function unreadableVSketches() {
	const base = () => ({ key: DAMAGED_KEY, points: {}, pieces: [{ id: 1, key: 'pc_a', parts: [] }] });
	return [
		["v 'abc'", { ...base(), v: 'abc' }],
		['v 0.5', { ...base(), v: 0.5 }],
		['v -1', { ...base(), v: -1 }],
		['v true', { ...base(), v: true }],
	];
}
