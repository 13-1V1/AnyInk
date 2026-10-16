// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B10 board-tiles: drops on the letter board (UX-BEGINNER.md 4.2 Drops and Tiles, 4.5; section
	10 B10 "drop routing"; B9's hand-off: "a photo on blank board space opens the photo dialog with
	the letter unknown").
	  - a photo on blank board space: the photo dialog, letter unknown (photo/photo_app.js takePhoto
	    with no letter)
	  - a photo on a tile: that letter, with the dialog when the photo has more than one part, else
	    straight to step C
	  - a work file (.gs2): it opens (B10 + B11 integration: files/open_font.js openDroppedFont,
	    with the file and the handle taken during the drop, so Save writes back in place)
	  - anything else: one sentence, "ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files
	    (.gs2)."
	  - while a photo is held over a tile, that tile shows it is the one (green)
	  - the page's drop guard (trace/trace_drop.js) sends every drop on the board here, so the board
	    page wires nothing; All tools and Simple without 'board' keep what they did
	Written before board_drop.js existed and before trace_drop.js routed the board.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setCurrentProjectEditor } from '../../../app/main.js';
import { GlyphrStudioProject } from '../../../project_data/glyphr_studio_project.js';
import { ProjectEditor } from '../../../project_editor/project_editor.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { setModeForTests } from '../../mode/mode.js';
import { closeHowCard } from '../../photo/how_card.js';
import { initPhotos, resetPhotoAppForTests } from '../../photo/photo_app.js';
import { closePhotoCard, photoCardState, resetPhotoCardForTests } from '../../photo/photo_card.js';
import { closePhotoDialog } from '../../photo/photo_dialog.js';
import { getFlow, resetPhotoFlowForTests, whenFlowSettled } from '../../photo/photo_flow.js';
import { loadPhotoFixture } from '../../photo/tests/fixture_image.js';
import { fakeDecoder } from '../../photo/tests/flow_fakes.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { setDecoderForTests } from '../../trace/bitmap_cache.js';
import { installPageDropGuard, routeStrayDrop } from '../../trace/trace_drop.js';
import { word } from '../../words/words.js';
import {
	boardDropChar,
	classifyBoardDrop,
	markBoardDropTarget,
	routeBoardDrop,
} from '../board_drop.js';
import { makeBoardTile } from '../tile_state.js';

vi.mock('../../autotrace/autotrace.js', async () => {
	const fakes = await import('../../photo/tests/flow_fakes.js');
	return { autoTraceImageData: vi.fn(fakes.fakeTrace) };
});
vi.mock('../../autotrace/trace_pixels.js', async () => {
	const fakes = await import('../../photo/tests/flow_fakes.js');
	return { readTracePixels: vi.fn(fakes.fakePixelsOf), READ_FAILED_MESSAGE: 'read failed' };
});

/** A drag event as Chrome sends it, with files (jsdom has no DragEvent or DataTransfer) */
function dragEvent(type, files = [], { relatedTarget = undefined } = {}) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', {
		value: { types: files.length ? ['Files'] : ['text/plain'], files, dropEffect: 'none' },
	});
	if (relatedTarget !== undefined) Object.defineProperty(event, 'relatedTarget', { value: relatedTarget });
	return event;
}

const file = (name, type = '') => new File([new Uint8Array(16)], name, { type });
const toastShown = () =>
	document.querySelector(
		'#toast[data-anyink-toast="simple"]:not([data-leaving]) .anyink-toast__text'
	)?.textContent ?? null;
const dialog = () => document.querySelector('[data-anyink-dialog="photoDialog"]');

let editor;
let loose;
let single;
let uninstall = () => {};

/** The board as the board page lays it out: a tile for some letters, and blank space */
function board(chars = ['B', 'e', 'j']) {
	const root = document.createElement('section');
	root.className = 'anyink-board';
	const blank = document.createElement('p');
	blank.id = 'blank';
	root.appendChild(blank);
	chars.forEach((char) => root.appendChild(makeBoardTile(editor.project, char)));
	document.body.appendChild(root);
	return root;
}
const tileOf = (char) => document.querySelector(`glyph-tile[data-anyink-char="${char}"]`);

beforeAll(async () => {
	loose = await loadPhotoFixture('brenna-loose-phone');
	single = await loadPhotoFixture('single-j-phone');
	if (!Element.prototype.animate)
		Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {} });
});

beforeEach(() => {
	document.body.innerHTML = '';
	setModeForTests('simple');
	setFeaturesForTests({ board: true });
	resetToastsForTests();
	editor = new ProjectEditor({ project: new GlyphrStudioProject() });
	setCurrentProjectEditor(editor);
	editor.nav.page = 'Overview';
});

afterEach(() => {
	uninstall();
	uninstall = () => {};
	resetToastsForTests();
	document.body.innerHTML = '';
});

describe('what a drop on the board is', () => {
	it('photos (HEIC too, so the photo screens can say why not), work files, anything else', () => {
		expect(classifyBoardDrop(file('page.jpg', 'image/jpeg'))).toBe('photo');
		expect(classifyBoardDrop(file('page.png', 'image/png'))).toBe('photo');
		expect(classifyBoardDrop(file('page.webp'))).toBe('photo');
		expect(classifyBoardDrop(file('IMG_4410.HEIC'))).toBe('photo');
		expect(classifyBoardDrop(file('Brennan Hand.gs2'))).toBe('workFile');
		expect(classifyBoardDrop(file('shapes.svg', 'image/svg+xml'))).toBe('other');
		expect(classifyBoardDrop(file('notes.txt', 'text/plain'))).toBe('other');
		expect(classifyBoardDrop(file('BrennanHand.otf'))).toBe('other');
		expect(classifyBoardDrop(null)).toBe('other');
	});

	it('the tile under the drop, or blank space', () => {
		board();
		const onTile = dragEvent('drop');
		tileOf('e').dispatchEvent(onTile);
		expect(boardDropChar(onTile)).toBe('e');
		const onBlank = dragEvent('drop');
		document.querySelector('#blank').dispatchEvent(onBlank);
		expect(boardDropChar(onBlank)).toBe('');
	});
});

describe('where a drop on the board goes', () => {
	it('a photo on blank board space: the photo dialog with the letter unknown', async () => {
		board();
		const takePhoto = vi.fn(async () => true);
		const event = dragEvent('drop', [file('page.jpg', 'image/jpeg')]);
		document.querySelector('#blank').dispatchEvent(event);
		expect(await routeBoardDrop(event, { editor, takePhoto })).toBe('photo');
		expect(takePhoto).toHaveBeenCalledWith(event.dataTransfer.files[0], {
			editor,
			char: '',
			itemId: '',
		});
	});

	it('a photo on a tile: that letter', async () => {
		board();
		const takePhoto = vi.fn(async () => true);
		const event = dragEvent('drop', [file('page.jpg', 'image/jpeg')]);
		tileOf('B').dispatchEvent(event);
		expect(await routeBoardDrop(event, { editor, takePhoto })).toBe('photoOnLetter');
		expect(takePhoto).toHaveBeenCalledWith(event.dataTransfer.files[0], {
			editor,
			char: 'B',
			itemId: 'glyph-0x42',
		});
	});

	it('a work file opens (its handle taken in the drop); anything else gets one sentence', async () => {
		board();
		const takePhoto = vi.fn();
		const work = dragEvent('drop', [file('Brennan Hand.gs2')]);
		// Chrome hands the file's handle only while the drop is being dispatched
		const handle = { kind: 'file', name: 'Brennan Hand.gs2' };
		let dropping = true;
		const getAsFileSystemHandle = vi.fn(() =>
			dropping ? Promise.resolve(handle) : Promise.reject(new Error('too late'))
		);
		work.dataTransfer.items = [{ kind: 'file', getAsFileSystemHandle }];
		const openWorkFile = vi.fn(async () => 'opened');
		tileOf('B').dispatchEvent(work);
		const routed = routeBoardDrop(work, { editor, takePhoto, openWorkFile });
		dropping = false;
		expect(await routed).toBe('workFile');
		expect(getAsFileSystemHandle).toHaveBeenCalledTimes(1);
		expect(openWorkFile).toHaveBeenCalledTimes(1);
		const [{ editor: into, file: dropped, handle: asked }] = openWorkFile.mock.calls[0];
		expect(into).toBe(editor);
		expect(dropped.name).toBe('Brennan Hand.gs2');
		expect(await asked).toBe(handle);
		// the Ctrl+O sentence is for a letter's canvas; the board opens it
		expect(toastShown()).not.toBe(word('toast.dropWorkFile'));
		for (const other of [file('shapes.svg', 'image/svg+xml'), file('notes.txt', 'text/plain')]) {
			const event = dragEvent('drop', [other]);
			document.querySelector('#blank').dispatchEvent(event);
			expect(await routeBoardDrop(event, { editor, takePhoto })).toBe('other');
			expect(toastShown()).toBe(word('boardDrop.other'));
		}
		expect(word('boardDrop.other')).toBe(
			'ANY-INK takes photos (PNG, JPEG, WebP) and ANY-INK work files (.gs2).'
		);
		expect(takePhoto).not.toHaveBeenCalled();
	});

	it('the page\'s drop guard sends drops on the board here; off the board, as before', async () => {
		board();
		const takePhoto = vi.fn(async () => true);
		uninstall = installPageDropGuard({
			route: (event) => routeStrayDrop(event, { editor, takePhoto }),
		});
		const event = dragEvent('drop', [file('page.jpg', 'image/jpeg')]);
		tileOf('e').dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		await vi.waitFor(() => expect(takePhoto).toHaveBeenCalledTimes(1));
		expect(takePhoto.mock.calls[0][1]).toMatchObject({ char: 'e', itemId: 'glyph-0x65' });

		// Simple without 'board': B5's words, never the photo screens
		setFeaturesForTests({ board: false });
		routeStrayDrop(dragEvent('drop', [file('Brennan Hand.gs2')]), { editor, takePhoto });
		expect(toastShown()).toBe(word('toast.dropWorkFile'));
		// All tools: as before
		setModeForTests('all');
		setFeaturesForTests({ board: true });
		routeStrayDrop(dragEvent('drop', [file('page.jpg', 'image/jpeg')]), { editor, takePhoto });
		expect(takePhoto).toHaveBeenCalledTimes(1);
	});

	it('a photo held over a tile marks it; moving off, leaving the window or dropping clears it', () => {
		board();
		const over = (target) => {
			const event = dragEvent('dragover', [file('page.jpg', 'image/jpeg')]);
			target.dispatchEvent(event);
			markBoardDropTarget(event, { editor });
		};
		over(tileOf('B'));
		expect(tileOf('B').hasAttribute('drop-target')).toBe(true);
		over(tileOf('e'));
		expect(tileOf('B').hasAttribute('drop-target')).toBe(false);
		expect(tileOf('e').hasAttribute('drop-target')).toBe(true);
		over(document.querySelector('#blank'));
		expect(document.querySelectorAll('[drop-target]')).toHaveLength(0);
		over(tileOf('j'));
		const leave = dragEvent('dragleave', [file('page.jpg', 'image/jpeg')], { relatedTarget: null });
		document.body.dispatchEvent(leave);
		markBoardDropTarget(leave, { editor });
		expect(document.querySelectorAll('[drop-target]')).toHaveLength(0);
	});
});

describe('B9\'s hand-off, end to end: the drop guard, the board, the photo screens', () => {
	beforeEach(() => {
		resetPhotoFlowForTests();
		resetPhotoCardForTests();
		setDecoderForTests(fakeDecoder({ 'brenna-loose.jpg': loose.image, 'single-j.jpg': single.image }));
		initPhotos({ getEditor: () => editor });
		uninstall = installPageDropGuard();
	});
	afterEach(() => {
		closePhotoDialog();
		closeHowCard();
		closePhotoCard();
		resetPhotoAppForTests();
		setDecoderForTests(null);
		resetPhotoFlowForTests();
	});

	const looseFile = () => new File([loose.bytes], 'brenna-loose.jpg', { type: 'image/jpeg' });
	const singleFile = () => new File([single.bytes], 'single-j.jpg', { type: 'image/jpeg' });

	it('a whole page dropped on blank board space: "Which letter is in the green box?"', async () => {
		board();
		const steps = editor.history.queue.length;
		document.querySelector('#blank').dispatchEvent(dragEvent('drop', [looseFile()]));
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('unknown');
		expect(editor.nav.page).toBe('Overview');
		// a photo coming in is no Undo step (7.3)
		expect(editor.history.queue.length).toBe(steps);
	});

	it('the same page dropped on small e\'s tile: the dialog asks which part is small e', async () => {
		board();
		tileOf('e').dispatchEvent(dragEvent('drop', [looseFile()]));
		await vi.waitFor(() => expect(dialog()).not.toBe(null));
		expect(dialog().getAttribute('data-anyink-photo-dialog')).toBe('known');
		expect(dialog().textContent).toContain(word('photo.dialog.titleKnown', { letter: 'small e' }));
	});

	it('a one-letter photo dropped on small j\'s tile goes straight to step C on small j', async () => {
		board();
		tileOf('j').dispatchEvent(dragEvent('drop', [singleFile()]));
		await vi.waitFor(() => expect(getFlow(editor)).not.toBe(null));
		const flow = await whenFlowSettled(editor);
		expect(dialog()).toBe(null);
		expect(flow).toMatchObject({ char: 'j' });
		expect(photoCardState()).toMatchObject({ step: 'result', char: 'j' });
		expect(editor.nav.page).toBe('Characters');
	});
});
