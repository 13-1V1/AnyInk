// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B9 photo-flow: every word the flow puts in front of him passes the banned-word scan
// (UX-BEGINNER.md 2.3): the toast after Use it when earlier letters followed, every message a
// screen shows for a flow code with its fix button, step C's quiet notes (fix pass), and the
// Undo title (scripted Simple flow).
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setModeForTests } from '../../mode/mode.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { word } from '../../words/words.js';
import { loadPhotoFixture } from './fixture_image.js';
import { fakeDecoder } from './flow_fakes.js';
import {
	FLOW_ERRORS,
	addPhotoFile,
	resetPhotoFlowForTests,
	startPart,
	useIt,
	whenFlowSettled,
} from '../photo_flow.js';
import { getPhoto, guessPart } from '../photo_registry.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('./flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

let loose;
let editor;

beforeEach(async () => {
	loose ||= await loadPhotoFixture('brenna-loose-phone');
	document.body.innerHTML = '';
	resetPhotoFlowForTests();
	setDecoderForTests(fakeDecoder({ 'brenna-loose.jpg': loose.image }));
	setModeForTests('simple');
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Characters';
	editor.selectedGlyphID = 'glyph-0x61';
});

afterEach(() => {
	setDecoderForTests(null);
	resetPhotoFlowForTests();
});

scanSimpleScreen(
	'photo flow: Use it twice from one photo, the second resizing the first',
	async ({ toasts }) => {
		const added = await addPhotoFile(
			new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' }),
			{
				editor,
			}
		);
		const titles = [];
		for (const char of ['B', 'r']) {
			await startPart({
				editor,
				asset: added.asset,
				partId: guessPart(getPhoto(editor.project, added.asset)),
				char,
			});
			await whenFlowSettled(editor);
			const result = await useIt(editor);
			expect(result.ok).toBe(true);
			titles.push(historyText(result.title));
		}
		// The toast that names the letter that followed reached the page, so the scan reads it
		toasts.flush();
		expect(toasts.messages.join(' ')).toMatch(/Traced small r\. Also resized Capital B/);
		return {
			root: document.body,
			texts: {
				'undo titles': titles,
				'flow messages': Object.values(FLOW_ERRORS).flatMap(({ key, button }) =>
					button ? [word(key), word(button)] : [word(key)]
				),
				// Fix pass: step C's quiet notes (photo_flow_notes.js)
				'step C notes': [
					word('photoFlow.note.twoLetters'),
					word('photoFlow.note.reachesAbove', { letter: 'small f' }),
					word('photoFlow.note.reachesBelow', { letter: 'Capital Q' }),
				],
			},
		};
	}
);
