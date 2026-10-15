// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// B4: the one toast queue's order and priorities (UX-BEGINNER.md 4.0 Toasts). Pure: no DOM.
//   One toast shows at a time. Kinds, highest first: undo/redo, destructive, automatic, info.
//   A toast with a button is never replaced by an info toast; info toasts wait their turn.
import { describe, expect, it } from 'vitest';
import { KINDS, MAX_WAITING, createQueue, keepsPlace, rankOf } from '../queue.js';

const entry = (name, kind = 'info', extra = {}) => ({ name, kind, ...extra });
const names = (list) => list.map((e) => e?.name ?? null);

describe('kinds', () => {
	it('ranks undo/redo over destructive over automatic over info (4.0)', () => {
		expect(KINDS).toEqual(['undo', 'destructive', 'automatic', 'info']);
		expect(rankOf('undo')).toBeGreaterThan(rankOf('destructive'));
		expect(rankOf('destructive')).toBeGreaterThan(rankOf('automatic'));
		expect(rankOf('automatic')).toBeGreaterThan(rankOf('info'));
		expect(rankOf('nonsense')).toBe(rankOf('info'));
	});

	it('keepsPlace: higher kind stays, info waits its turn, same group gives way', () => {
		expect(keepsPlace(entry('u', 'undo'), entry('i'))).toBe(true);
		expect(keepsPlace(entry('i'), entry('u', 'undo'))).toBe(false);
		// fix track: "info toasts wait their turn" (4.0), button or not; the newer note waits
		expect(keepsPlace(entry('i'), entry('j'))).toBe(true);
		expect(
			keepsPlace(entry('i', 'info', { group: 'file' }), entry('j', 'info', { group: 'tool' }))
		).toBe(true);
		expect(keepsPlace(entry('i', 'info', { group: 'g' }), entry('j', 'info', { group: 'g' }))).toBe(
			false
		);
		expect(keepsPlace(entry('b', 'info', { action: {} }), entry('j'))).toBe(true);
		expect(keepsPlace(entry('d', 'destructive', { action: {} }), entry('d2', 'destructive'))).toBe(
			false
		);
		expect(keepsPlace(entry('u', 'undo', { group: 'g' }), entry('i', 'info', { group: 'g' }))).toBe(
			false
		);
	});
});

describe('createQueue', () => {
	it('shows the first toast at once', () => {
		const q = createQueue();
		const step = q.add(entry('a'));
		expect(names([step.show, step.hide])).toEqual(['a', null]);
		expect(q.current.name).toBe('a');
	});

	it('one at a time: a newer info toast waits its turn behind an info toast with no button', () => {
		// fix track: an error toast ("ANY-INK wasn't allowed to write ...") is info with no
		// button; a tool key's "Switched to Rectangle (R)" 50 ms later used to wipe it for good
		const q = createQueue();
		const error = entry('not allowed', 'info', { group: 'file' });
		q.add(error);
		const step = q.add(entry('switched', 'info', { group: 'toolSwitch' }));
		expect(names([step.show, step.hide])).toEqual([null, null]);
		expect(q.current).toBe(error);
		expect(names(q.waiting)).toEqual(['switched']);
		expect(q.done(error).show.name).toBe('switched');
	});

	it('the same words again (no group, no button) are the same toast: the newer takes its place', () => {
		const q = createQueue();
		q.add(entry('undid', 'undo'));
		q.add(entry('small', 'info', { text: 'That shape was too small' }));
		const step = q.add(entry('small again', 'info', { text: 'That shape was too small' }));
		expect(names(step.dropped)).toEqual(['small']);
		expect(names(q.waiting)).toEqual(['small again']);
		// different words, or a button, never count as the same toast
		q.add(entry('other', 'info', { text: 'Pasted a shape' }));
		q.add(entry('offer', 'info', { text: 'Pasted a shape', action: {} }));
		expect(names(q.waiting)).toEqual(['small again', 'other', 'offer']);
	});

	it('an undo toast stays; info waits its turn and shows when the undo toast is done', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo', { action: {} });
		q.add(undo);
		const step = q.add(entry('saved'));
		expect(names([step.show, step.hide])).toEqual([null, null]);
		expect(names(q.waiting)).toEqual(['saved']);
		expect(q.done(undo).show.name).toBe('saved');
		expect(q.current.name).toBe('saved');
	});

	it('a toast with a button is never replaced by an info toast', () => {
		const q = createQueue();
		const fix = entry('backup', 'info', { action: {} });
		q.add(fix);
		q.add(entry('note'));
		expect(q.current).toBe(fix);
		expect(names(q.waiting)).toEqual(['note']);
	});

	it('a higher kind replaces a lower one at once', () => {
		const q = createQueue();
		q.add(entry('note'));
		q.add(entry('made a hole', 'automatic', { action: {} }));
		const step = q.add(entry('undid', 'undo', { action: {} }));
		expect(names([step.show, step.hide])).toEqual(['undid', 'made a hole']);
	});

	it('waiting toasts come out highest kind first, then oldest first', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo');
		q.add(undo);
		q.add(entry('i1'));
		q.add(entry('auto', 'automatic'));
		q.add(entry('i2'));
		q.add(entry('cleared', 'destructive'));
		expect(names(q.waiting)).toEqual(['cleared', 'auto', 'i1', 'i2']);
		const order = [];
		let next = q.done(undo).show;
		while (next) {
			order.push(next.name);
			next = q.done(next).show;
		}
		expect(order).toEqual(['cleared', 'auto', 'i1', 'i2']);
		expect(q.current).toBeNull();
	});

	it('a newer toast of the same group takes the place of a waiting or showing one', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo');
		q.add(undo);
		q.add(entry('merging', 'info', { group: 'merge' }));
		const step = q.add(entry('merged', 'info', { group: 'merge' }));
		expect(names(step.dropped)).toEqual(['merging']);
		expect(names(q.waiting)).toEqual(['merged']);

		const p = createQueue();
		p.add(entry('loading', 'info', { group: 'photo', action: {} }));
		const replaced = p.add(entry('added', 'info', { group: 'photo' }));
		expect(names([replaced.show, replaced.hide])).toEqual(['added', 'loading']);
	});

	it(`keeps at most ${MAX_WAITING} waiting, dropping the oldest of the lowest kind`, () => {
		const q = createQueue();
		q.add(entry('undid', 'undo'));
		const dropped = [];
		['i1', 'i2', 'i3', 'i4', 'i5'].forEach((name) => dropped.push(...q.add(entry(name)).dropped));
		expect(names(dropped)).toEqual(['i1']);
		expect(names(q.waiting)).toEqual(['i2', 'i3', 'i4', 'i5']);
		dropped.push(...q.add(entry('auto', 'automatic')).dropped);
		expect(names(dropped)).toEqual(['i1', 'i2']);
		expect(names(q.waiting)).toEqual(['auto', 'i3', 'i4', 'i5']);
	});

	it('never drops a waiting toast with a button for plain info toasts (trim)', () => {
		// fix track: "Couldn't save a backup copy [Save]" waited behind an undo toast and four
		// "The photo already fits" pushed it out of the line, never shown
		const q = createQueue();
		const undo = entry('brought back c', 'undo');
		q.add(undo);
		const backup = entry('backup [Save]', 'info', { tone: 'warning', action: {} });
		q.add(backup);
		const dropped = [];
		['f1', 'f2', 'f3', 'f4'].forEach((name, i) =>
			dropped.push(...q.add(entry(name, 'info', { text: `fits ${i}` })).dropped)
		);
		expect(names(dropped)).toEqual(['f1']);
		expect(q.waiting).toContain(backup);
		expect(names(q.waiting)).toEqual(['backup [Save]', 'f2', 'f3', 'f4']);
	});

	it('trim drops a toast with no button and no warning before a warning, and both before a button', () => {
		const q = createQueue({ maxWaiting: 2 });
		q.add(entry('undid', 'undo'));
		q.add(entry('offer', 'info', { action: {} }));
		q.add(entry('warning', 'info', { tone: 'warning' }));
		const step = q.add(entry('plain'));
		expect(names(step.dropped)).toEqual(['plain']);
		expect(names(q.add(entry('auto', 'automatic')).dropped)).toEqual(['auto']);
		// two warnings: the older goes; the offer never goes for either
		expect(names(q.add(entry('warning 2', 'info', { tone: 'warning' })).dropped)).toEqual([
			'warning',
		]);
		expect(names(q.waiting)).toEqual(['offer', 'warning 2']);
	});

	it('an offer (info with a button) a higher kind pushed aside comes back when its turn comes', () => {
		// fix track: the export check's [Show me] (D-035: "its button is never lost") was gone
		// for good the moment an undo toast arrived
		const q = createQueue();
		const check = entry('needs fixing [Show me]', 'info', { group: 'export', action: {} });
		q.add(check);
		const undo = entry('brought back c', 'undo');
		const step = q.add(undo);
		expect(names([step.show, step.hide])).toEqual(['brought back c', 'needs fixing [Show me]']);
		expect(q.waiting).toEqual([check]);
		expect(q.done(undo).show).toBe(check);
	});

	it('a button that belongs to the newest change does not come back once a higher kind arrives', () => {
		const q = createQueue();
		q.add(entry('made a hole [Make it solid]', 'automatic', { action: {} }));
		q.add(entry('undid: made a hole [Redo]', 'undo', { action: {} }));
		expect(q.waiting).toEqual([]);
		const p = createQueue();
		p.add(entry('undid A [Redo]', 'undo', { action: {} }));
		p.add(entry('undid B [Redo]', 'undo', { action: {} })); // the newer press
		expect(p.waiting).toEqual([]);
	});

	it('clear({ keepOffers }) keeps offers, showing and waiting, and drops the rest', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo', { action: {} });
		const backup = entry('backup [Save]', 'info', { tone: 'warning', action: {} });
		q.add(undo);
		q.add(backup);
		q.add(entry('note'));
		const step = q.clear({ keepOffers: true });
		expect(step.hide).toBe(undo);
		expect(names(step.dropped)).toEqual(['note']);
		expect(step.show).toBe(backup);
		expect(q.current).toBe(backup);
		// an offer showing stays where it is
		const again = q.clear({ keepOffers: true });
		expect([again.hide, again.show, again.dropped]).toEqual([null, null, []]);
		expect(q.current).toBe(backup);
		// without keepOffers everything goes, as before
		expect(q.clear().hide).toBe(backup);
		expect(q.current).toBeNull();
	});

	it('done() on a toast that is not showing only takes it out of the line', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo');
		const note = entry('note');
		q.add(undo);
		q.add(note);
		expect(q.done(note).show).toBeNull();
		expect(q.current).toBe(undo);
		expect(q.waiting).toEqual([]);
	});

	it('clear() hides the current toast and drops the line', () => {
		const q = createQueue();
		const undo = entry('undid', 'undo');
		q.add(undo);
		q.add(entry('note'));
		const step = q.clear();
		expect(step.hide).toBe(undo);
		expect(names(step.dropped)).toEqual(['note']);
		expect(q.current).toBeNull();
		expect(q.waiting).toEqual([]);
	});
});
