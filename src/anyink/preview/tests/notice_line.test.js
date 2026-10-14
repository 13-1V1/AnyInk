// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { describe, expect, it, vi } from 'vitest';
import { makeNoticeLine, makeNoticeStyle } from '../notice_line.js';

describe('makeNoticeLine', () => {
	it('starts hidden and shows one sentence with a Show me button', () => {
		const onShowMe = vi.fn();
		const line = makeNoticeLine({ onShowMe });
		document.body.appendChild(line.element);
		expect(line.element.hidden).toBe(true);
		expect(line.visible).toBe(false);

		line.show({ text: "small a has a problem the font file can't hold.", itemId: 'glyph-0x61' });
		expect(line.element.hidden).toBe(false);
		expect(line.visible).toBe(true);
		expect(line.itemId).toBe('glyph-0x61');
		expect(line.element.getAttribute('role')).toBe('status');
		expect(line.element.textContent).toContain("small a has a problem the font file can't hold.");

		const button = line.element.querySelector('button');
		expect(button.textContent).toBe('Show me');
		expect(button.hidden).toBe(false);
		button.click();
		expect(onShowMe).toHaveBeenCalledWith('glyph-0x61');
		line.element.remove();
	});

	it('hides the button when there is no letter to show', () => {
		const line = makeNoticeLine({ onShowMe: vi.fn() });
		line.show({
			text: "Can't show your font yet: one of your letters needs fixing.",
			itemId: null,
		});
		expect(line.element.querySelector('button').hidden).toBe(true);
	});

	it('hides again and forgets the letter', () => {
		const line = makeNoticeLine({ onShowMe: vi.fn() });
		line.show({ text: 'x', itemId: 'glyph-0x61' });
		line.hide();
		expect(line.element.hidden).toBe(true);
		expect(line.visible).toBe(false);
		expect(line.itemId).toBe(null);
	});

	it('keeps the button click from reaching the sheet underneath', () => {
		const line = makeNoticeLine({ onShowMe: vi.fn() });
		const parent = document.createElement('div');
		const onParent = vi.fn();
		parent.addEventListener('click', onParent);
		parent.addEventListener('dblclick', onParent);
		parent.appendChild(line.element);
		line.show({ text: 'x', itemId: 'glyph-0x61' });
		line.element.querySelector('button').click();
		line.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(onParent).not.toHaveBeenCalled();
	});
});

describe('makeNoticeLine: Fix it and the count', () => {
	const notice = {
		text: 'small b has ink but no width, so the next letter would sit on top of it.',
		itemId: 'glyph-0x62',
		problem: 'ink-no-width',
	};
	const buttons = (line) => [...line.element.querySelectorAll('button')];
	const fixButton = (line) => buttons(line).find((b) => b.textContent === 'Fix it');

	it('offers Fix it, outlined beside Show me, when the problem can be fixed', () => {
		const onFixIt = vi.fn();
		const line = makeNoticeLine({ onShowMe: vi.fn(), onFixIt });
		line.show({ ...notice, fixable: true });
		expect(buttons(line).map((b) => b.textContent)).toEqual(['Show me', 'Fix it']);
		expect(fixButton(line).hidden).toBe(false);
		expect(fixButton(line).className).toBe('anyink-notice__button');
		fixButton(line).click();
		expect(onFixIt).toHaveBeenCalledWith({ itemId: 'glyph-0x62', problem: 'ink-no-width' });
	});

	it('hides Fix it when the problem has no safe fix, or nothing listens', () => {
		const line = makeNoticeLine({ onShowMe: vi.fn(), onFixIt: vi.fn() });
		line.show({ ...notice, problem: 'point-range', fixable: false });
		expect(fixButton(line).hidden).toBe(true);
		const quiet = makeNoticeLine({ onShowMe: vi.fn() });
		quiet.show({ ...notice, fixable: true });
		expect(fixButton(quiet).hidden).toBe(true);
	});

	it('says how many more letters need fixing, apart from the sentence', () => {
		const line = makeNoticeLine({ onShowMe: vi.fn() });
		line.show({ ...notice, more: '2 more letters need fixing too.' });
		const more = line.element.querySelector('.anyink-notice__more');
		expect(more.hidden).toBe(false);
		expect(more.textContent).toBe('2 more letters need fixing too.');
		expect(line.element.querySelector('.anyink-notice__text').textContent).toBe(notice.text);
		expect(line.element.title).toBe(`${notice.text} 2 more letters need fixing too.`);
		line.show(notice);
		expect(more.hidden).toBe(true);
	});
});

describe('makeNoticeStyle', () => {
	it('keeps CSS as text, even when a comment names an element', () => {
		const host = document.createElement('div');
		const root = host.attachShadow({ mode: 'open' });
		const css = '/* lives in the <font-preview> shadow root */ .anyink-notice { display: flex; }';
		root.appendChild(makeNoticeStyle(document, css));
		expect(root.querySelector('font-preview')).toBe(null);
		expect(root.querySelector('style').textContent).toBe(css);
	});
});
