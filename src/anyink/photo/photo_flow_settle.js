// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 + B11 finalize: a traced letter settles on the line the checks judge (UX-BEGINNER.md 4.4
	"Every letter's body bottom sits on the writing line", 4.2 "Ready", 7.2). Placement seats the
	part's ink in photo pixels before tracing (placement/seat.js levelBottom, held within
	LEVEL_HOLD_SHARE of the lowest ink); the checks measure the traced shapes (checks.js lineAt).
	The two read the bottom differently (the photo's turn, potrace's smoothing of the feet), and
	the critic's traced h came out 0.02 to 0.03 of the letter box up: "floats", on a letter the
	app had just placed. So, before Use it's step, a traced letter the checks would call off the
	line by a little (at most SETTLE_SHARE of the letter box) is moved up or down, with its photo,
	to where Sit on the line would put it: one step, never a second one. A letter further off is
	left as placement put it (the checks say so; the shape rules may disagree there).

	  settleOnLine(char, shapes, trace, font) -> { dy, trace }: shapes (Path objects, whole
	      points) are moved by dy in place; trace is the photo's record with y moved by dy (the
	      same object when dy is 0)
*/
import { CHECK, findChecks, measureLetter } from '../checks/checks.js';
import { lineTargets, guideLines } from '../placement/classes.js';
import { whole } from '../spacing/round.js';

/** A traced letter off the line by at most this share of the letter box is settled on it. */
export const SETTLE_SHARE = 0.05;

/**
 * @param {String} char - the letter
 * @param {Array<Object>} shapes - its traced shapes (Path objects; moved in place)
 * @param {Object} trace - the photo's record ({ x, y, scale, ... })
 * @param {Object} font - settings.font
 * @returns {{dy: Number, trace: Object}}
 */
export function settleOnLine(char, shapes, trace, font) {
	const none = { dy: 0, trace };
	if (typeof char !== 'string' || [...char].length !== 1 || !shapes?.length) return none;
	const probe = { id: '', chars: char, shapes, advanceWidth: 1 };
	const measures = measureLetter(probe, font);
	if (!measures) return none;
	const off = findChecks(probe, measures, { font }).some((check) => check.id === CHECK.offLine);
	const target = lineTargets(char, font);
	if (!off || target.seat !== 'bottom') return none;
	const dy = whole(target.bottom - measures.lineAt);
	if (!dy || Math.abs(dy) > SETTLE_SHARE * guideLines(font).box) return none;
	shapes.forEach((shape) => {
		(shape.pathPoints || []).forEach((point) => {
			[point.p, point.h1, point.h2].forEach((handle) => {
				if (handle?.coord) handle.coord.y = whole(handle.coord.y + dy);
			});
		});
		shape.changed?.();
	});
	const y = Number(trace?.y);
	return { dy, trace: Number.isFinite(y) ? { ...trace, y: y + dy } : trace };
}
