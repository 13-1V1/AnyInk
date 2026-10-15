// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 (UX-BEGINNER.md 2.2, 2.3, 7.3): the Brush's words. Its Undo title is a plain title,
	"drew a stroke on Capital B", which historyText passes through as it is, and a stroke, its
	Undo and its Redo say no banned word anywhere (the toasts, the title, the Brush's own words).
*/
import { afterEach, describe, expect, it, vi } from 'vitest';
import { B, twoLetterEditor } from '../../history/tests/two_letters.js';
import { setFeaturesForTests } from '../../mode/features.js';
import { showItem } from '../../preview/show_item.js';
import { resetToastsForTests } from '../../toast/toast.js';
import { historyText } from '../../words/history_text.js';
import { scanSimpleScreen } from '../../words/tests/banned_scan.js';
import { wordKeys, word } from '../../words/words.js';
import { makeNibTool } from '../nib_tool.js';
import { stepTitle } from '../commit.js';
import { strokeName } from '../stroke_record.js';
import { line } from './strokes.js';

afterEach(() => {
	resetToastsForTests();
	document.body.innerHTML = '';
});

function drawOn(editor, path) {
	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);
	const tool = makeNibTool(canvas, { getEditor: () => editor });
	let clock = 0;
	const event = (type, [x, y]) => ({
		type,
		pointerId: 1,
		isPrimary: true,
		button: type === 'pointermove' ? -1 : 0,
		clientX: editor.view.dx + x * editor.view.dz,
		clientY: editor.view.dy - y * editor.view.dz,
		timeStamp: (clock += 8),
		preventDefault() {},
	});
	tool.down(event('pointerdown', path[0]));
	path.slice(1).forEach((point) => tool.move(event('pointermove', point)));
	tool.up(event('pointerup', path.at(-1)));
}

describe('the Brush’s words', () => {
	it('its Undo title names the letter in full and passes through historyText as it is', () => {
		const editor = twoLetterEditor();
		showItem(editor, B);
		expect(stepTitle(editor.selectedItem)).toBe('drew a stroke on Capital B');
		expect(historyText('drew a stroke on Capital B')).toBe('drew a stroke on Capital B');
		expect(stepTitle({ chars: '?' })).toBe('drew a stroke on the question mark');
		expect(stepTitle({})).toBe('drew a stroke on this letter');
	});

	it('a stroke’s shape is named for its stroke', () => {
		expect(strokeName(3)).toBe('Brush stroke 3');
	});

	it('every brush word ships with the Brush', () => {
		const keys = wordKeys().filter((key) => key.startsWith('brush.'));
		expect(keys.length).toBeGreaterThan(0);
		keys.forEach((key) => expect(word(key, { name: 'x', number: 1 }).length).toBeGreaterThan(0));
	});

	scanSimpleScreen('a stroke on Capital B, then Undo and Redo', () => {
		setFeaturesForTests({ brush: true, coach: true });
		if (!Element.prototype.animate) Element.prototype.animate = () => ({});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const editor = twoLetterEditor();
		showItem(editor, B);
		editor.view = { dx: 100, dy: 900, dz: 1 };
		editor.editCanvas = { redraw: () => {} };
		editor.selectedTool = 'nib';
		drawOn(editor, line([100, 0], [100, 500]));
		const title = editor.history.queue[0].title;
		editor.history.restoreState();
		editor.history.redoState();
		warn.mockRestore();
		return {
			root: null,
			texts: {
				'Undo title': [historyText(title)],
				'brush words': wordKeys()
					.filter((key) => key.startsWith('brush.'))
					.map((key) => word(key, { name: 'Capital B', number: 1 })),
			},
		};
	});
});
