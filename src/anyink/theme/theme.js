// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	ANY-INK theme runtime.
	Bridges tokens.css to canvas drawing code, and owns the canvas light/dark toggle.
	- token('--canvas-guide') returns the computed value of a token, cached per document
	  and cleared whenever the theme changes.
	- withAlpha(color, alpha) turns any CSS color into an rgba() string (real alpha, no
	  blending toward white).
	- setCanvasTheme('dark') sets html[data-canvas], remembers the choice in app prefs,
	  and notifies listeners so canvases redraw.
	No DOM element other than <html> is touched here.
*/
import { getPref, setPref } from '../prefs/prefs.js';

const PREF_KEY = 'canvasTheme';
const EVENT_NAME = 'anyink-theme-change';
let caches = new WeakMap(); // document -> Map(tokenName -> value)
let listeners = [];

/**
 * Read a token's computed value from the document root.
 * @param {String} name - token name including the leading dashes, e.g. '--touch'
 * @param {Document} [doc] - document to read from (pop-out windows pass their own)
 * @returns {String} - CSS color string
 */
export function token(name, doc = document) {
	let cache = caches.get(doc);
	if (!cache) {
		cache = new Map();
		caches.set(doc, cache);
	}
	if (cache.has(name)) return cache.get(name);
	const value = getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
	if (value) cache.set(name, value);
	return value;
}

/** Forget cached values (call after any change to html[data-canvas] or the stylesheet). */
export function clearTokenCache() {
	caches = new WeakMap();
}

/**
 * Convert a CSS color to an rgba() string with the given alpha.
 * Accepts #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), hsl()/hsla(), and named colors
 * (named colors resolve through a canvas when one is available).
 * @param {String} color
 * @param {Number} alpha - 0 to 1
 * @returns {String}
 */
export function withAlpha(color, alpha = 1) {
	const rgb = parseToRGB(color);
	const a = Math.max(0, Math.min(1, Number(alpha)));
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Parse a CSS color into {r, g, b}. Exported for tests.
 * @param {String} color
 * @returns {{r: Number, g: Number, b: Number}}
 */
export function parseToRGB(color) {
	const c = String(color || '').trim();
	let m;
	if ((m = c.match(/^#([0-9a-f]{3,4})$/i))) {
		const h = m[1];
		return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
	}
	if ((m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i))) {
		const h = m[1];
		return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
	}
	if ((m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i))) {
		return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]) };
	}
	if ((m = c.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i))) {
		return hslToRGB(+m[1], +m[2], +m[3]);
	}
	// Named colors: let the browser normalize when a canvas exists.
	if (typeof document !== 'undefined') {
		try {
			const ctx = document.createElement('canvas').getContext('2d');
			ctx.fillStyle = c;
			const norm = String(ctx.fillStyle);
			if (norm !== c) return parseToRGB(norm);
		} catch {
			// fall through
		}
	}
	return { r: 0, g: 0, b: 0 };
}

function hslToRGB(h, s, l) {
	s /= 100;
	l /= 100;
	const k = (n) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return { r: Math.round(255 * f(0)), g: Math.round(255 * f(8)), b: Math.round(255 * f(4)) };
}

/** @returns {'light' | 'dark'} */
export function getCanvasTheme() {
	const attr = document.documentElement.dataset.canvas;
	return attr === 'dark' ? 'dark' : 'light';
}

/**
 * Apply a canvas theme, remember it, and notify listeners.
 * @param {'light' | 'dark'} theme
 * @param {Object} [options]
 * @param {Boolean} [options.remember=true] - persist to app prefs
 */
export function setCanvasTheme(theme, { remember = true } = {}) {
	const next = theme === 'dark' ? 'dark' : 'light';
	document.documentElement.dataset.canvas = next;
	clearTokenCache();
	if (remember) setPref(PREF_KEY, next);
	for (const fn of listeners) fn(next);
	window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { theme: next } }));
}

/** Flip between light and dark. @returns {'light' | 'dark'} the new theme */
export function toggleCanvasTheme() {
	const next = getCanvasTheme() === 'dark' ? 'light' : 'dark';
	setCanvasTheme(next);
	return next;
}

/**
 * Subscribe to theme changes.
 * @param {Function} fn - called with 'light' | 'dark'
 * @returns {Function} unsubscribe
 */
export function onThemeChange(fn) {
	listeners.push(fn);
	return () => {
		listeners = listeners.filter((l) => l !== fn);
	};
}

/**
 * Apply the remembered canvas theme. Call once, as early as possible, before the
 * first paint of any canvas.
 */
export function initTheme() {
	setCanvasTheme(getPref(PREF_KEY, 'light'), { remember: false });
}

/**
 * Copy the current canvas theme attribute onto another document (pop-out windows).
 * @param {Document} doc
 */
export function applyThemeTo(doc) {
	doc.documentElement.dataset.canvas = getCanvasTheme();
}

export const THEME_EVENT = EVENT_NAME;
