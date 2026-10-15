// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B6 (UX-BEGINNER.md 4.11 "Status pill"): the Simple top bar's pill says one of four states, each
// with its dot and, where there is something to press, an outlined button inside the pill:
//   "Saved" (green dot) | "Saving..." | "Not saved yet [Save]" (amber dot) | "Couldn't save [Fix]"
//   (red dot). Color is never alone: the words say the state.
import { describe, expect, it } from 'vitest';
import { word } from '../../words/words.js';
import { SIMPLE_PILL, simpleStatusPill } from '../save_status.js';

const state = (file, extra = {}) => ({ revision: 1, file, recovery: 'saved', error: '', ...extra });

describe('the four Simple states, with their dot and button', () => {
	it('Saved: green dot, nothing to press', () => {
		expect(simpleStatusPill(state('saved'), { workFile: true })).toMatchObject({
			status: 'saved',
			text: 'Saved',
			dot: '--touch',
			button: null,
		});
	});

	it('Saving...: a quiet dot, nothing to press (queued or running)', () => {
		const running = simpleStatusPill(state('saving'), { workFile: true });
		const queued = simpleStatusPill(state('pending', { queued: true }), { workFile: true });
		[running, queued].forEach((pill) =>
			expect(pill).toMatchObject({
				status: 'saving',
				text: 'Saving...',
				dot: '--chrome-text-muted',
				button: null,
			})
		);
	});

	it('Not saved yet [Save]: amber dot; Save picks where the work file goes, or writes it', () => {
		const noFile = simpleStatusPill(state('none', { recovery: 'none' }), { workFile: false });
		const behind = simpleStatusPill(state('pending'), { workFile: true });
		[noFile, behind].forEach((pill) =>
			expect(pill).toMatchObject({
				status: 'not-saved',
				text: 'Not saved yet',
				dot: '--warning',
				button: { key: 'term.save', action: 'save', text: word('term.save') },
			})
		);
	});

	it("Couldn't save [Fix]: red dot; Fix says what went wrong", () => {
		const pill = simpleStatusPill(state('failed', { error: 'The disk is full' }), {
			workFile: true,
		});
		expect(pill).toMatchObject({
			status: 'failed',
			text: "Couldn't save",
			dot: '--danger',
			button: { key: 'topbar.status.fix', action: 'fix', text: 'Fix' },
		});
		// the browser's own sentence is never in the pill
		expect(JSON.stringify(pill)).not.toMatch(/disk is full/);
	});

	it('every state the status can be in is one of the four, and its button matches it', () => {
		const files = ['none', 'pending', 'saving', 'saved', 'failed'];
		const seen = new Set();
		files.forEach((file) =>
			[true, false].forEach((workFile) =>
				[true, false].forEach((queued) => {
					const pill = simpleStatusPill(state(file, { queued }), { workFile });
					seen.add(pill.status);
					expect(SIMPLE_PILL[pill.status]).toBeTruthy();
					expect(pill.dot).toBe(SIMPLE_PILL[pill.status].dot);
					expect(pill.button?.action || null).toBe(SIMPLE_PILL[pill.status].action);
				})
			)
		);
		expect([...seen].sort()).toEqual(['failed', 'not-saved', 'saved', 'saving']);
	});
});
