// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S4 (docs/SKETCH.md sections 5 and 7, "The card on a sketched letter", card section
	'sketchPiece'): what the letter card shows while Select on a sketch has something picked.
	Few buttons, the rest folded under More. Every press is one named step (select_tool.js
	runSketchEdit); the toast after Delete names it with [Undo].

	  A picked point   [Smooth] [Corner] (the point's kind pressed; letter/point_kind.js words)
	                   [Delete]; [Let it flow] only while its direction is locked by a grip.
	                   More: "This end" Round / Flat (open ends only).
	  A picked piece   [Delete]. More: [Helper line] (dashed, no ink; pressed again inks it).
	  Several picked   [Delete] (the window or Ctrl picks); drag or the arrows move them.

	  sketchPieceState(editor)              null, or { itemId, what: 'point' | 'piece' | 'many',
	                                        kind, locked, end, helper, count, moreOpen }
	  makeSketchPieceSection(state, editor) the section, or null
	  setPieceMoreOpen(open)                tests and the card's own fold
*/
import { makeElement } from '../../common/dom.js';
import { pointKindWords } from '../letter/point_kind.js';
import { word, wordEntry } from '../words/words.js';
import { isOpenEnd } from './edit_ops.js';
import { isAimed } from './grips.js';
import { getPiece, sketchOf } from './model.js';
import { runSketchEdit, sketchPickOf } from './select_tool.js';

/** More is folded until he opens it; it stays as he left it */
let moreOpen = false;

/** @param {Boolean} open */
export function setPieceMoreOpen(open) {
	moreOpen = !!open;
}

/**
 * @param {Object} editor
 * @returns {Object | null}
 */
export function sketchPieceState(editor) {
	const pick = sketchPickOf(editor);
	if (!pick) return null;
	const sketch = sketchOf(editor?.selectedItem);
	if (!sketch) return null;
	const count = pick.points.length + pick.pieces.length;
	const base = { itemId: pick.itemId, count, moreOpen };
	if (count === 1 && pick.points.length === 1) {
		const id = pick.points[0];
		const point = sketch.points[id];
		const end = isOpenEnd(sketch, id) ? point.end || sketch.ends || 'round' : null;
		return {
			...base,
			what: 'point',
			kind: point.kind === 'smooth' ? 'smooth' : 'corner',
			locked: isAimed(sketch, id),
			end,
		};
	}
	if (count === 1) {
		const piece = getPiece(sketch, pick.pieces[0]);
		return { ...base, what: 'piece', helper: piece?.use === 'helper' };
	}
	return { ...base, what: 'many' };
}

/**
 * @param {Object | null} state
 * @param {Object} editor
 * @returns {HTMLElement | null}
 */
export function makeSketchPieceSection(state, editor) {
	if (!state) return null;
	const section = makeElement({
		tag: 'div',
		className: 'anyink-sketch-card anyink-sketch-piece',
		attributes: { 'data-anyink-sketch-piece': state.what },
	});
	const title = makeElement({ tag: 'h4', className: 'anyink-letter-card__part-title' });
	title.textContent = word(state.what === 'point' ? 'sketch.card.point' : 'sketch.card.piece');
	section.appendChild(title);
	const run = (op) => () => runSketchEdit(editor, op);
	if (state.what === 'point') {
		const group = makeElement({
			tag: 'div',
			className: 'anyink-segmented',
			attributes: { role: 'group', 'aria-label': word('sketch.card.point') },
		});
		['smooth', 'corner'].forEach((kind) => {
			const words = pointKindWords(kind);
			const button = makeElement({
				tag: 'button',
				className: 'anyink-segmented__option',
				attributes: {
					type: 'button',
					'data-anyink-sketch': kind,
					'aria-pressed': String(state.kind === kind),
					title: words.hint,
				},
			});
			button.textContent = words.text;
			button.addEventListener('click', run(kind));
			group.appendChild(button);
		});
		section.appendChild(group);
	}
	const row = makeElement({ tag: 'div', className: 'anyink-letter-card__buttons' });
	row.appendChild(button('delete', 'sketch.card.delete', run('delete')));
	if (state.what === 'point' && state.locked) {
		row.appendChild(button('flow', 'sketch.card.letItFlow', run('flow')));
	}
	section.appendChild(row);
	const more = moreItems(state, run);
	if (more.length) {
		const fold = makeElement({
			tag: 'button',
			className: 'anyink-disclosure',
			attributes: {
				type: 'button',
				'data-anyink-toggle': 'sketchMore',
				'aria-expanded': String(state.moreOpen),
			},
		});
		fold.appendChild(
			makeElement({
				tag: 'span',
				className: 'anyink-disclosure__chevron',
				attributes: { 'aria-hidden': 'true' },
			})
		);
		const label = makeElement({ tag: 'span', className: 'anyink-disclosure__label' });
		label.textContent = word('sketch.more');
		fold.appendChild(label);
		fold.addEventListener('click', () => {
			setPieceMoreOpen(!moreOpen);
			editor?.publish?.('sketchPick', { itemId: state.itemId });
		});
		section.appendChild(fold);
		if (state.moreOpen) {
			const inside = makeElement({ tag: 'div', className: 'anyink-sketch-piece__more' });
			more.forEach((element) => inside.appendChild(element));
			section.appendChild(inside);
		}
	}
	return section;
}

/** What More holds for this pick */
function moreItems(state, run) {
	if (state.what === 'point' && state.end) {
		const label = makeElement({ tag: 'p', className: 'anyink-sketch-card__quiet' });
		label.textContent = word('sketch.ends.thisEnd');
		const group = makeElement({
			tag: 'div',
			className: 'anyink-segmented',
			attributes: { role: 'group', 'aria-label': word('sketch.ends.thisEnd') },
		});
		[
			['round', 'endRound'],
			['flat', 'endFlat'],
		].forEach(([end, op]) => {
			const option = makeElement({
				tag: 'button',
				className: 'anyink-segmented__option',
				attributes: {
					type: 'button',
					'data-anyink-sketch': op,
					'aria-pressed': String(state.end === end),
				},
			});
			option.textContent = word(`sketch.ends.${end}`);
			option.addEventListener('click', run(op));
			group.appendChild(option);
		});
		return [label, group];
	}
	if (state.what === 'piece') {
		const helper = button('helper', 'sketch.helperLine', run('helper'));
		helper.setAttribute('aria-pressed', String(!!state.helper));
		return [helper];
	}
	return [];
}

/** An outlined card button */
function button(name, key, onClick) {
	const element = makeElement({
		tag: 'button',
		className: 'anyink-letter-card__button',
		attributes: { type: 'button', 'data-anyink-sketch': name },
	});
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	element.addEventListener('click', onClick);
	return element;
}
