// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
		Guide
		An object used by the UI for drawing guide
		lines on the edit canvas, and for saving
		custom guides to a Glyphr Studio Project.
**/

import { token, withAlpha } from '../anyink/theme/theme.js';

export class Guide {
	constructor(oa = {}) {
		// log(`Guide.constructor`, 'start');
		this.objType = 'Guide';
		this.angle = oa.angle === 0 ? 0 : 90;
		this.name = oa.name;
		this.location = !isNaN(parseInt(oa.location)) ? parseInt(oa.location) : 200;
		// Kept for project-file compatibility only; the canvas draws every guide in --canvas-guide.
		this.color = oa.color || '';
		this.visible = !!oa.visible;
		// log(`Guide.constructor`, 'end');
	}

	save() {
		let result = {};

		let n = this.name;
		if (n !== 'Horizontal guide' && n !== 'Vertical guide' && n !== 'Guide') {
			result.name = this.name;
		}
		if (this.angle !== 90) result.angle = this.angle;
		if (this.location !== 200) result.location = this.location;
		if (this.color) result.color = this.color;
		if (!this.visible) result.visible = this.visible;

		return result;
	}

	get name() {
		if (!this._name) {
			if (this.angle === 90) this._name = 'Horizontal guide';
			else if (this.angle === 0) this._name = 'Vertical guide';
			else this._name = 'Guide';
		}
		return this._name;
	}

	set name(newName) {
		if (!newName) {
			if (this.angle === 90) newName = 'Horizontal guide';
			else if (this.angle === 0) newName = 'Vertical guide';
			else newName = 'Guide';
		}
		this._name = newName;
	}
}

// --------------------------------------------------------------
// Colors
// --------------------------------------------------------------

/**
 * Relative opacity of each system guide level. Multiplied into the
 * user's guide transparency setting when the edit canvas draws them,
 * so the baseline (dark) always reads stronger than cap height (light).
 */
export const guideLevelOpacity = { light: 0.4, medium: 0.7, dark: 1 };

/**
 * Wraps a token read so it happens when the color is used, never at
 * module load (tokens switch with the canvas theme). The result is a
 * function, so call it: guideColorDark(). It also coerces to a string,
 * so older call sites that drop it into a template literal
 * (`fill="${guideColorDark}"`) keep working until they switch to calling it.
 * @param {Function} read - returns the current CSS color string
 * @returns {Function}
 */
function lazyColor(read) {
	const fn = () => read();
	fn.toString = fn;
	return fn;
}

/** Cap height, x height. */
export const guideColorLight = lazyColor(() =>
	withAlpha(token('--canvas-guide'), guideLevelOpacity.light)
);
/** Ascent, descent. */
export const guideColorMedium = lazyColor(() =>
	withAlpha(token('--canvas-guide'), guideLevelOpacity.medium)
);
/** Baseline, left side, right side. */
export const guideColorDark = lazyColor(() => token('--canvas-guide'));
/** Background grid. */
export const gridColor = lazyColor(() => token('--canvas-grid'));
