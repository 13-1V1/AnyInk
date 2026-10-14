// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B1 item 6: when the real-font preview can't build the font, <font-preview> says so in plain
// words, names what broke it, offers [Show me], and never leaves a system font on screen
// pretending to be his. Every build here is the real FontFlux on a real project. Stand-ins: the
// browser refusing a built font (FontFace.load), which jsdom can't do, and (B1 fix pass) a gap
// that breaks the build: the preview now writes gaps the way the export does (rounded, pulled
// into range), so no gap value can break it any more, and the gap naming is a safety net.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentProjectEditor, setCurrentProjectEditor } from '../../../app/main.js';
import { FontPreview, FontPreviewBuilder } from '../../../controls/font-preview/font_preview.js';
import { writeGposKernDataToFont } from '../../../formats_io/otf/tables/gpos.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import simpleExampleProject from '../../../samples/simpleExampleProject.json';

const BANNED =
	/\b(glyph|character|unicode|otf|opentype|advance|metrics|baseline|path|item|font-flux)\b/i;

let loadResult;
let fontsAdded;

beforeAll(() => {
	if (!Element.prototype.animate) Element.prototype.animate = () => ({});
	if (!customElements.get('font-preview')) customElements.define('font-preview', FontPreview);
});

beforeEach(() => {
	loadResult = () => Promise.resolve();
	fontsAdded = [];
	// jsdom has no FontFace or document.fonts: stand-ins that load (or fail) on demand.
	window.FontFace = class {
		constructor(family) {
			this.family = family;
		}
		load() {
			return loadResult();
		}
	};
	Object.defineProperty(document, 'fonts', {
		configurable: true,
		value: { add: (face) => fontsAdded.push(face), delete: () => true },
	});
});

let previousEditor;
beforeEach(() => {
	previousEditor = getCurrentProjectEditor();
});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
	setCurrentProjectEditor(previousEditor);
});

function sampleProject() {
	return new GlyphrStudioProject(structuredClone(simpleExampleProject));
}

/** Lets the FontFace load promise settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(project, text = 'A') {
	const preview = new FontPreview({ project, text, previewFlavor: 'otf' });
	const events = [];
	preview.addEventListener('font-status', (event) => events.push(event.detail));
	document.body.appendChild(preview);
	return { preview, events };
}

const notice = (preview) => preview.shadowRoot.querySelector('.anyink-notice');
const textArea = (preview) => preview.shadowRoot.querySelector('.font-preview__text');

/** The sample with its gap between A, B or C and a following C (kern-0, -100) set to value. */
function projectWithGap(value) {
	const project = sampleProject();
	project.kerning['kern-0'].value = value;
	return project;
}

/**
 * The sample with kern-0 at 12.5, built the way the preview built it before the B1 fix pass:
 * the gap written as typed, which FontFlux refuses ("$.kerningClasses[0].value must be an
 * integer from -32768 to 32767."). Stands in for any gap that ever breaks the build.
 */
function projectWithBrokenGap() {
	const build = FontPreviewBuilder.prototype.buildFontFlux;
	vi.spyOn(FontPreviewBuilder.prototype, 'buildFontFlux').mockImplementation(function (text) {
		const font = build.call(this, text);
		writeGposKernDataToFont(font, this.project);
		return font;
	});
	return projectWithGap(12.5);
}

const noticeText = (preview) => notice(preview).querySelector('.anyink-notice__text').textContent;
const showMe = (preview) =>
	[...notice(preview).querySelectorAll('button')].find((b) => b.textContent === 'Show me');

describe('<font-preview> when the font cannot be built', () => {
	it('shows the text in his font and no notice when the build works', async () => {
		const { preview, events } = mount(sampleProject());
		await settle();
		expect(fontsAdded.length).toBe(1);
		expect(notice(preview).hidden).toBe(true);
		expect(textArea(preview).style.display).toBe('');
		expect(preview.buildProblem).toBe(null);
		expect(events.at(-1)).toEqual({ ok: true, itemId: null });
	});

	it('keeps its notice styles in their own style element, with nothing nested', async () => {
		const { preview } = mount(sampleProject());
		await settle();
		expect(preview.shadowRoot.querySelectorAll('style').length).toBe(2);
		expect(preview.shadowRoot.querySelector('font-preview, preview-strip')).toBe(null);
	});

	it('safety net: names a gap that breaks the build and hides the system-font text', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { preview, events } = mount(projectWithBrokenGap(), 'AC');
		await settle();

		const line = notice(preview);
		expect(line.hidden).toBe(false);
		expect(noticeText(preview)).toBe(
			"Can't show your font yet: the gap between Capital A, Capital B or Capital C and Capital C needs fixing."
		);
		expect(line.textContent).not.toMatch(BANNED);
		expect(showMe(preview).hidden).toBe(false);

		// Nothing typed in a fallback font stays on screen.
		expect(textArea(preview).style.display).toBe('none');
		expect(fontsAdded.length).toBe(0);
		expect(preview.buildProblem).toEqual({ itemId: 'kern-0' });
		expect(events.at(-1)).toEqual({ ok: false, itemId: 'kern-0' });
	});

	it('Show me opens that gap on the page that edits it', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const editor = { nav: { page: 'Overview' }, selectedItemID: false, navigate: vi.fn() };
		setCurrentProjectEditor(editor);
		const { preview } = mount(projectWithBrokenGap(), 'AC');
		await settle();

		showMe(preview).click();
		expect(editor.nav.page).toBe('Kerning');
		expect(editor.selectedItemID).toBe('kern-0');
		expect(editor.navigate).toHaveBeenCalledTimes(1);
	});

	it('comes back as soon as the gap is a whole number again', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const project = projectWithBrokenGap();
		const { preview, events } = mount(project, 'AC');
		await settle();
		expect(notice(preview).hidden).toBe(false);

		project.kerning['kern-0'].value = 13;
		preview.rebuildAndRedraw();
		await settle();
		expect(notice(preview).hidden).toBe(true);
		expect(textArea(preview).style.display).toBe('');
		expect(preview.buildProblem).toBe(null);
		expect(events.at(-1)).toEqual({ ok: true, itemId: null });
	});

	it('still says so when the browser refuses the font', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		loadResult = () => Promise.reject(new Error('OTS parsing error'));
		const { preview, events } = mount(sampleProject(), 'A');
		await settle();

		expect(notice(preview).hidden).toBe(false);
		expect(notice(preview).textContent).toContain(
			"Can't show your font yet: one of your letters needs fixing."
		);
		expect(notice(preview).querySelector('button').hidden).toBe(true);
		expect(textArea(preview).style.display).toBe('none');
		expect(events.at(-1)).toEqual({ ok: false, itemId: null });
	});

	it('only the newest build decides what is shown', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		let rejectFirst;
		loadResult = () =>
			new Promise((resolve, reject) => {
				rejectFirst = reject;
			});
		const { preview } = mount(sampleProject(), 'A');
		loadResult = () => Promise.resolve();
		preview.rebuildAndRedraw();
		await settle();
		rejectFirst(new Error('late failure of an old build'));
		await settle();
		expect(notice(preview).hidden).toBe(true);
		expect(textArea(preview).style.display).toBe('');
	});
});

// B1 fix pass: the export writes a gap rounded and pulled into range (export_kerning.js), but the
// preview wrote it as typed, so a gap of 12.5 made a font file with no complaint, a silent font
// check, and a Real font sheet that said "Can't show your font yet". The three now agree.
describe('<font-preview> writes gaps the way the font file holds them', () => {
	it('builds with a decimal gap (12.5), as the export does', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const project = projectWithGap(12.5);
		expect(() => new FontPreviewBuilder(project).buildFontBuffer('AB')).not.toThrow();
		expect(() => new FontPreviewBuilder(project, { flavor: 'otf' }).buildFontBuffer('AC')).not.toThrow();
	});

	it('builds with a gap too big for the font file (40,000), pulled into range like the export', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const project = projectWithGap(40000);
		expect(() => new FontPreviewBuilder(project, { flavor: 'otf' }).buildFontBuffer('AC')).not.toThrow();
		expect(project.kerning['kern-0'].value).toBe(40000); // the project itself is never changed
	});

	it("shows his letters, with no \"Can't show your font yet\", for a gap of 12.5", async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { preview, events } = mount(projectWithGap(12.5), 'AC');
		await settle();
		expect(notice(preview).hidden).toBe(true);
		expect(fontsAdded.length).toBe(1);
		expect(textArea(preview).style.display).toBe('');
		expect(events.at(-1)).toEqual({ ok: true, itemId: null });
	});
});
