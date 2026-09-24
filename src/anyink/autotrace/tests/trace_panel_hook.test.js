// Created by: Brennan Meyer with use of Claude Code 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Milestone 8 scaffold: the Trace panel (src/anyink/trace/trace_panel.js) appends whatever
// makeAutoTraceCard returns, after its own cards, and nothing when it returns null. The card
// module is mocked here, so this file holds whatever track C puts inside it.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// vitest-setup.js imports the whole app (src/app/main.js) before this file runs, so a
// hoisted vi.mock would come too late for trace_panel.js. Mock the card, then load a fresh
// module graph that picks the mock up.
const makeAutoTraceCard = vi.fn(() => null);
let setCurrentProjectEditor;
let makePanel;
let importGlyphrProjectFromText;
let ProjectEditor;
let setTrace;
let simpleExampleProject;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('../autotrace_panel.js', () => ({ makeAutoTraceCard }));
	({ setCurrentProjectEditor } = await import('../../../app/main.js'));
	({ makePanel } = await import('../../../panels/panels.js'));
	({ importGlyphrProjectFromText } = await import('../../../project_editor/import_project.js'));
	({ ProjectEditor } = await import('../../../project_editor/project_editor.js'));
	({ setTrace } = await import('../../trace/trace_model.js'));
	simpleExampleProject = (await import('../../../samples/simpleExampleProject.json')).default;
});

let editor;

function makeEditor() {
	editor = new ProjectEditor();
	setCurrentProjectEditor(editor);
	editor.project = importGlyphrProjectFromText(simpleExampleProject);
	editor.nav.page = 'Characters';
	editor.nav.panel = 'Trace';
	editor.selectedGlyphID = 'glyph-0x41';
}

function addTrace() {
	const asset = editor.assets.add(new Blob(['png'], { type: 'image/png' }));
	setTrace(editor.project.getItem('glyph-0x41'), {
		asset,
		width: 400,
		height: 800,
		x: 0,
		y: 800,
		scale: 1.25,
		opacity: 0.4,
		visible: true,
		locked: false,
		invert: false,
	});
}

describe('Trace panel hook for the Auto-trace card', () => {
	beforeEach(() => {
		makeAutoTraceCard.mockReset();
		makeAutoTraceCard.mockReturnValue(null);
		makeEditor();
	});

	it('is not asked for a card while the item has no trace', () => {
		makePanel();
		expect(makeAutoTraceCard).not.toHaveBeenCalled();
	});

	it('appends the card last, with the editor and the item', () => {
		addTrace();
		const card = document.createElement('div');
		card.className = 'panel__card anyink-autotrace-test-card';
		makeAutoTraceCard.mockReturnValue(card);
		const content = makePanel();
		const host = content.querySelector('.anyink-trace-panel');
		expect(host.lastElementChild).toBe(card);
		expect(host.children.length).toBeGreaterThan(1);
		const args = makeAutoTraceCard.mock.calls[0][0];
		expect(args.editor).toBe(editor);
		expect(args.item).toBe(editor.project.getItem('glyph-0x41'));
	});

	it('appends nothing when the card maker returns null', () => {
		addTrace();
		const content = makePanel();
		expect(makeAutoTraceCard).toHaveBeenCalledTimes(1);
		expect(content.querySelector('.anyink-autotrace-test-card')).toBeNull();
		expect(content.querySelector('.anyink-trace-panel').children.length).toBe(3);
	});
});
