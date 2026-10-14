// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 guide lines. An empty letter (no shapes, width 0) used to get the guide lines only as long
// as its width plus a small pad, so a first-timer saw tiny ticks and no idea where to draw.
// drawSystemGuidelines now draws an empty letter's lines the project's default letter width
// long, with a faint right edge there, and every other letter keeps lines as long as itself.
// The lines are drawn strong enough that the writing line (baseline) reaches 3:1 against the
// canvas on paper and on slate. Runs the real EditCanvas redraw on a vi-canvas-mock context,
// with the real tokens.css, and reads each fillRect call with the fill it used.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contrastRatio } from '../../anyink/metrics/guide_strength.js';
import { clearTokenCache, parseToRGB, token } from '../../anyink/theme/theme.js';
import { setCurrentProjectEditor } from '../../app/main.js';
import { Path } from '../../project_data/path.js';
import { Guide } from '../../project_editor/guide.js';
import { importGlyphrProjectFromText } from '../../project_editor/import_project.js';
import { ProjectEditor } from '../../project_editor/project_editor.js';
import simpleExampleProject from '../../samples/simpleExampleProject.json';
import { EditCanvas } from '../edit_canvas.js';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = readFileSync(join(here, '../../anyink/theme/tokens.css'), 'utf8');
const VIEW = Object.freeze({ dx: 300, dy: 700, dz: 0.25 });
const PAD = 50 * VIEW.dz; // drawEmHorizontalLine's pad on each side, in canvas pixels

let editor;
let ctx;
let tokensStyle;

function makeEditor(glyphID) {
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(structuredClone(simpleExampleProject));
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = glyphID;
	editor.selectedGlyph; // creates an empty letter the way opening it in the app does
	editor.selectedTool = 'resize';
	editor.view = { ...VIEW };
	Object.assign(editor.systemGuides, {
		ascent: true,
		capHeight: true,
		xHeight: true,
		baseline: true,
		descent: true,
		leftSide: true,
		rightSide: true,
	});
}

/** Runs the real redraw against a mock 2D context and returns the fillRect calls with their fill. */
function redraw(itemID) {
	const canvas = document.createElement('canvas');
	canvas.width = 1200;
	canvas.height = 1000;
	ctx = canvas.getContext('2d');
	const calls = [];
	const fillRect = ctx.fillRect.bind(ctx);
	ctx.fillRect = (x, y, w, h) => {
		calls.push({ x, y, w, h, fill: String(ctx.fillStyle) });
		fillRect(x, y, w, h);
	};
	const host = { ctx, width: 1200, height: 1000, editingItemID: itemID };
	EditCanvas.prototype.redraw.call(host, 'test');
	return calls;
}

/** The canvas y a horizontal guide at this font-unit height is drawn at. */
function lineY(em) {
	const y = VIEW.dy - em * VIEW.dz;
	return em > 0 ? Math.floor(y) : Math.ceil(y);
}

function horizontalAt(calls, em) {
	return calls.filter((c) => c.h === 1 && c.y === lineY(em) && c.x === VIEW.dx - PAD);
}

function verticalEdges(calls) {
	// drawEmVerticalLine: 1 px wide (2 on some scaled displays), from above the ascent line down
	// past the descent line
	return calls.filter((c) => (c.w === 1 || c.w === 2) && c.h > 200);
}

/** The width a horizontal line is drawn for a span in font units. */
const spanPx = (units) => units * VIEW.dz + PAD * 2;

/** Alpha of an rgba() fill; an opaque hex fill is 1. */
function alphaOf(fill) {
	const m = String(fill).match(/^rgba\([^)]*,\s*([\d.]+)\)$/);
	return m ? Number(m[1]) : 1;
}

/** The color the screen shows: the fill laid over the canvas background token. */
function onCanvas(fill) {
	const top = parseToRGB(fill);
	const bg = parseToRGB(token('--canvas-bg'));
	const a = alphaOf(fill);
	const mix = (k) => Math.round(top[k] * a + bg[k] * (1 - a));
	return `rgb(${mix('r')}, ${mix('g')}, ${mix('b')})`;
}

const contrastOnCanvas = (fill) => contrastRatio(onCanvas(fill), token('--canvas-bg'));

function useTheme(theme) {
	document.documentElement.dataset.canvas = theme;
	clearTokenCache();
}

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (callback) => callback());
	vi.spyOn(console, 'warn').mockImplementation(() => {});
	tokensStyle = document.createElement('style');
	tokensStyle.textContent = TOKENS_CSS;
	document.head.appendChild(tokensStyle);
	useTheme('light');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	tokensStyle.remove();
	delete document.documentElement.dataset.canvas;
	clearTokenCache();
});

describe('Guide lines on an empty letter (width 0, no shapes)', () => {
	it('draws all five horizontal lines the default letter width long', () => {
		makeEditor('glyph-0x65');
		const glyph = editor.project.getItem('glyph-0x65');
		expect(glyph.shapes).toHaveLength(0);
		expect(glyph.advanceWidth).toBe(0);

		const calls = redraw('glyph-0x65');
		const font = editor.project.settings.font;
		const minWidth = spanPx(editor.project.defaultAdvanceWidth);
		expect(minWidth).toBe(150); // 500 units (half of 1000) at 0.25, plus the pads

		[font.capHeight, font.ascent, font.xHeight, font.descent, 0].forEach((em) => {
			const lines = horizontalAt(calls, em);
			expect(lines.length, `line at ${em}`).toBeGreaterThan(0);
			lines.forEach((line) => expect(line.w, `line at ${em}`).toBe(minWidth));
		});
	});

	it('draws the left edge at 0 and a faint right edge at the default letter width', () => {
		makeEditor('glyph-0x65');
		const edges = verticalEdges(redraw('glyph-0x65'));
		const rightX = Math.floor(VIEW.dx + editor.project.defaultAdvanceWidth * VIEW.dz);
		expect(edges.map((e) => e.x)).toEqual([Math.floor(VIEW.dx), rightX]);
		const [left, right] = edges;
		expect(alphaOf(right.fill)).toBeGreaterThan(0);
		expect(alphaOf(right.fill)).toBeLessThan(alphaOf(left.fill));
	});

	it('draws no faint right edge when the right edge guide is turned off', () => {
		makeEditor('glyph-0x65');
		editor.systemGuides.rightSide = false;
		const edges = verticalEdges(redraw('glyph-0x65'));
		expect(edges.map((e) => e.x)).toEqual([Math.floor(VIEW.dx)]);
	});

	it('also works when the lines are drawn on top of the letter', () => {
		makeEditor('glyph-0x65');
		editor.project.settings.app.guides.drawGuidesOnTop = true;
		const calls = redraw('glyph-0x65');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(editor.project.defaultAdvanceWidth)));
	});
});

describe('Custom guide lines on an empty letter (integration, B1)', () => {
	it('draw a horizontal custom guide as long as the system lines, not as a tick', () => {
		makeEditor('glyph-0x65');
		const guides = editor.project.settings.app.guides;
		guides.customShowGuides = true;
		guides.custom = [new Guide({ angle: 90, location: 300, visible: true })];
		const lines = horizontalAt(redraw('glyph-0x65'), 300);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(editor.project.defaultAdvanceWidth)));
	});
});

describe('Guide lines on letters with a width or ink keep the letter\'s own box', () => {
	it('a letter wider than the default width keeps lines as long as the letter', () => {
		makeEditor('glyph-0x41');
		const glyph = editor.project.getItem('glyph-0x41');
		glyph.advanceWidth = 1500;
		const calls = redraw('glyph-0x41');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(1500)));
		const edges = verticalEdges(calls).map((e) => e.x);
		expect(edges).toEqual([Math.floor(VIEW.dx), Math.floor(VIEW.dx + 1500 * VIEW.dz)]);
	});

	it('a narrow letter with ink stops its lines at its own width, not the default width', () => {
		makeEditor('glyph-0x42');
		const glyph = editor.project.getItem('glyph-0x42');
		expect(glyph.shapes.length).toBeGreaterThan(0);
		const itemXMax = Math.max(glyph.advanceWidth, glyph.maxes.xMax);
		expect(itemXMax).toBeLessThan(editor.project.defaultAdvanceWidth);
		const calls = redraw('glyph-0x42');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(itemXMax)));
		const edges = verticalEdges(calls).map((e) => e.x);
		expect(edges).toEqual([Math.floor(VIEW.dx), Math.floor(VIEW.dx + glyph.advanceWidth * VIEW.dz)]);
	});

	it('a narrow letter with a width but no shapes yet keeps its own width, with no faint edge', () => {
		makeEditor('glyph-0x65');
		editor.project.getItem('glyph-0x65').advanceWidth = 200;
		const calls = redraw('glyph-0x65');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(200)));
		const edges = verticalEdges(calls).map((e) => e.x);
		expect(edges).toEqual([Math.floor(VIEW.dx), Math.floor(VIEW.dx + 200 * VIEW.dz)]);
	});

	it('a letter with ink but width 0 (not spaced yet) keeps the default span and the faint edge', () => {
		makeEditor('glyph-0x42');
		const glyph = editor.project.getItem('glyph-0x42');
		glyph.advanceWidth = 0;
		const span = Math.max(glyph.maxes.xMax, editor.project.defaultAdvanceWidth);
		const calls = redraw('glyph-0x42');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(span)));
		const rightX = Math.floor(VIEW.dx + editor.project.defaultAdvanceWidth * VIEW.dz);
		expect(verticalEdges(calls).map((e) => e.x)).toEqual([Math.floor(VIEW.dx), rightX]);
	});
});

describe('The first pen click on an empty letter (B1 fix pass)', () => {
	// A new letter stays at width 0 while it is drawn (until it is spaced). One Pen click makes a
	// one-point shape; the lines used to shrink to 10 units and the faint right edge vanished.
	const clickOnce = (points) => {
		makeEditor('glyph-0x65');
		const glyph = editor.project.getItem('glyph-0x65');
		glyph.addOneShape(new Path({ pathPoints: points.map(([x, y]) => ({ p: { coord: { x, y } } })) }));
		expect(glyph.shapes).toHaveLength(1);
		expect(glyph.advanceWidth).toBe(0);
		return redraw('glyph-0x65');
	};

	it('one point: the lines keep the default letter width and the faint right edge stays', () => {
		const calls = clickOnce([[10, 0]]);
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(spanPx(editor.project.defaultAdvanceWidth)));
		const rightX = Math.floor(VIEW.dx + editor.project.defaultAdvanceWidth * VIEW.dz);
		expect(verticalEdges(calls).map((e) => e.x)).toEqual([Math.floor(VIEW.dx), rightX]);
	});

	it('two points: still the default width, not "as long as the ink so far"', () => {
		const calls = clickOnce([
			[80, 0],
			[380, 0],
		]);
		horizontalAt(calls, 0).forEach((line) => expect(line.w).toBe(spanPx(editor.project.defaultAdvanceWidth)));
	});
});

describe('The kern pair view keeps its own guide lines', () => {
	it('the letter-width default is not applied to a kern pair', () => {
		makeEditor('glyph-0x41');
		editor.nav.page = 'Kerning';
		editor.selectedKernGroupID = 'kern-0';
		editor.view = { ...VIEW }; // views are kept per item
		const calls = redraw('kern-0');
		const lines = horizontalAt(calls, 0);
		expect(lines.length).toBeGreaterThan(0);
		lines.forEach((line) => expect(line.w).toBe(PAD * 2));
	});
});

describe('Guide line strength at the default Transparency (B1)', () => {
	['light', 'dark'].forEach((theme) => {
		const name = theme === 'light' ? 'paper' : 'slate';
		it(`${name}: the writing line and the left edge reach 3:1 against the canvas`, () => {
			useTheme(theme);
			makeEditor('glyph-0x65');
			// A new font's setting (the sample project stores 10)
			editor.project.settings.app.guides.systemTransparency = 70;
			const calls = redraw('glyph-0x65');
			const writing = horizontalAt(calls, 0)[0];
			const left = verticalEdges(calls)[0];
			expect(contrastOnCanvas(writing.fill)).toBeGreaterThanOrEqual(3);
			expect(contrastOnCanvas(left.fill)).toBeGreaterThanOrEqual(3);
		});

		it(`${name}: the writing line stays the strongest, then the top and tail lines`, () => {
			useTheme(theme);
			makeEditor('glyph-0x65');
			editor.project.settings.app.guides.systemTransparency = 70;
			const font = editor.project.settings.font;
			const calls = redraw('glyph-0x65');
			const strength = (em) => contrastOnCanvas(horizontalAt(calls, em)[0].fill);
			expect(strength(0)).toBeGreaterThan(strength(font.ascent));
			expect(strength(font.ascent)).toBeCloseTo(strength(font.descent), 5);
			expect(strength(font.ascent)).toBeGreaterThan(strength(font.capHeight));
			expect(strength(font.capHeight)).toBeCloseTo(strength(font.xHeight), 5);
		});
	});

	it('the Transparency setting still works at both ends', () => {
		makeEditor('glyph-0x65');
		const guides = editor.project.settings.app.guides;
		guides.systemTransparency = 100;
		expect(alphaOf(horizontalAt(redraw('glyph-0x65'), 0)[0].fill)).toBe(0);
		guides.systemTransparency = 0;
		expect(alphaOf(horizontalAt(redraw('glyph-0x65'), 0)[0].fill)).toBe(1);
	});
});

describe('Guide line strength on a display scaled above 100% (B1 fix pass)', () => {
	// The edit canvas buffer is its CSS size, so on a Windows display at 125% or 150% Chrome
	// stretches it and smooths each canvas pixel over 1.25 or 1.5 screen pixels (bilinear). A 1 px
	// line then lost up to 40% of its strength: the writing line measured 2.09:1 at 125% and
	// 2.45:1 at 150% in real Chrome. This models that stretch for every sub-pixel position and
	// checks the brightest screen row of the line still reaches 3:1.

	/**
	 * The strongest alpha any screen row shows for a run of canvas rows, at the worst sub-pixel
	 * position of the canvas against the screen's pixel grid.
	 * @param {Number[]} rows - alpha of each canvas row, 0 to 1
	 * @param {Number} scale - screen pixels per canvas pixel
	 */
	function worstPeak(rows, scale) {
		if (scale === 1) return Math.max(...rows); // drawn 1:1, no smoothing
		const padded = [0, 0, ...rows, 0, 0];
		const at = (i) => padded[i] ?? 0;
		let worst = Infinity;
		for (let phase = 0; phase < 1; phase += 1 / 64) {
			let peak = 0;
			for (let j = 0; j < padded.length * scale + 2; j++) {
				const s = (j + 0.5) / scale + phase - 0.5; // canvas coordinate of this screen row
				const i = Math.floor(s);
				const t = s - i;
				peak = Math.max(peak, at(i) * (1 - t) + at(i + 1) * t);
			}
			worst = Math.min(worst, peak);
		}
		return worst;
	}

	/** The writing line's canvas rows (alpha per row) from the fillRect calls of one redraw. */
	function writingLineRows(calls) {
		const line = calls.find((c) => c.y === lineY(0) && c.x === VIEW.dx - PAD);
		return Array.from({ length: line.h }, () => alphaOf(line.fill));
	}

	const shownContrast = (alpha) => {
		const fill = token('--canvas-guide');
		const top = parseToRGB(fill);
		const bg = parseToRGB(token('--canvas-bg'));
		const mix = (k) => Math.round(top[k] * alpha + bg[k] * (1 - alpha));
		return contrastRatio(`rgb(${mix('r')}, ${mix('g')}, ${mix('b')})`, token('--canvas-bg'));
	};

	[1.25, 1.5, 1.75, 2, 2.5].forEach((scale) => {
		['light', 'dark'].forEach((theme) => {
			const name = theme === 'light' ? 'paper' : 'slate';
			it(`${name} at ${scale * 100}%: the writing line still reaches 3:1 on screen`, () => {
				vi.stubGlobal('devicePixelRatio', scale);
				useTheme(theme);
				makeEditor('glyph-0x65');
				editor.project.settings.app.guides.systemTransparency = 70;
				const calls = redraw('glyph-0x65');
				const peak = worstPeak(writingLineRows(calls), scale);
				expect(shownContrast(peak)).toBeGreaterThanOrEqual(3);
				// The left edge is drawn the same way
				const left = verticalEdges(calls)[0];
				expect(left.w).toBe(writingLineRows(calls).length);
			});
		});
	});

	it('at 100% nothing changes: 1 px lines at the 3:1 alpha', () => {
		vi.stubGlobal('devicePixelRatio', 1);
		makeEditor('glyph-0x65');
		editor.project.settings.app.guides.systemTransparency = 70;
		const calls = redraw('glyph-0x65');
		expect(writingLineRows(calls)).toHaveLength(1);
		expect(shownContrast(worstPeak(writingLineRows(calls), 1))).toBeGreaterThanOrEqual(3);
	});
});
