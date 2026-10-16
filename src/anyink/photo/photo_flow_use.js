// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: Use it (docs/UX-BEGINNER.md 4.4 "Use it", 7.3), item 4 of photo_flow.js's
	header, which re-exports it. One Undo step titled "traced small r": an item step, or a
	whole-font one when earlier letters of the photo follow its new size; the toast names those.
	Fix pass, 10/15/2026: History sends a whole-font step's save status notice with its
	before-copy only, so after such a Use it the rail said one letter fewer was ready until the
	file was written; the notice is sent again once the change is made. Step C's save hold
	(photo_flow_hold.js) comes off the letter when Use it is in.
	B16: parts of two touching letters and letters far off their row's size don't size the photo
	(photo_flow_votes.js), so tracing them never resizes earlier letters; the toast says what a
	resize made better ("so all your letters from this photo stay one size"), and a letter that
	now needs a look is named calmly ("Have a look at small r too.").
	B16 (acceptance T2): Undo of Use it on a letter that was empty brings back the empty letter
	with the photo kept (its step carries that earlier state: history/simple_undo.js
	markStepBefore; a whole-font step's before-copy holds it), so Trace again is one press. A
	letter that had shapes gets back its earlier shapes with its earlier photo, as before.
*/
import { Glyph } from '../../project_data/glyph.js';
import { applyAutoTrace } from '../autotrace/apply.js';
import { markStepBefore } from '../history/simple_undo.js';
import { showTip } from '../coach/coach_state.js';
import { followPlan } from '../placement/fit_lines.js';
import { applyFollow } from '../placement/photo_scale.js';
import { markAuto } from '../spacing/owner.js';
import { toast } from '../toast/toast.js';
import { setTrace } from '../trace/trace_model.js';
import { flippedSince, lookOf, needsALookNow } from '../checks/fix_step.js';
import { showItem } from '../preview/show_item.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { photoData, placementFor } from './photo_flow_data.js';
import { isAsTraced, setPhotoFit, tracedCopies } from './photo_flow_fit.js';
import { releaseSavedTrace } from './photo_flow_hold.js';
import { settleOnLine } from './photo_flow_settle.js';
import { leftOutFollowers, votingFacts } from './photo_flow_votes.js';
import { currentEditor, emit, failure, stateOf, whenFlowSettled } from './photo_flow_state.js';
import { getPhoto, releaseItem, setScale, usePart } from './photo_registry.js';

/** The photo's fade once its letter is traced (4.4 Use it). */
export const USED_OPACITY = 0.25;

/**
 * @param {Object} [editor]
 * @param {{mode?: 'replace' | 'add'}} [options]
 * @returns {Promise<Object>} see the header
 */
export async function useIt(editor = currentEditor(), { mode = 'replace' } = {}) {
	await whenFlowSettled(editor);
	const s = stateOf(editor);
	const flow = s.flow;
	if (!flow) return failure('not-applied');
	if (flow.status !== 'ready' || !flow.result?.shapes?.length) {
		return failure(flow.error || 'not-applied');
	}
	const { project, itemId, asset, partId, char } = flow;
	const item = project.getItem(itemId);
	const record = getPhoto(project, asset);
	const history = editor.history;
	if (!item || !record || !history || editor.selectedItem !== item) return failure('not-applied');
	const add = mode === 'add';
	const copies = tracedCopies(flow.result.shapes);
	if (!copies.some((shape) => shape.pathPoints.length >= 2)) return failure('not-applied');

	// The photo after this letter is named: its scale, and the earlier letters that follow it
	const data = await photoData(s, editor, record);
	if (s.flow !== flow) return failure('not-applied');
	const draft = structuredClone(record);
	usePart(draft, partId, { char, itemId });
	const whole = placementFor(draft, data, { partId, char, itemId });
	const font = project.settings.font;
	// B16: parts of two touching letters and letters far off their row's size don't size the
	// photo, so they never resize the letters traced before them (photo_flow_votes.js)
	const facts = votingFacts(draft, whole, font);
	const { info } = facts;
	const follow = {
		except: partId,
		asset,
		getItem: (id) => {
			const other = project.getItem(id);
			return other && id !== itemId && isAsTraced(other, asset) ? other : null;
		},
	};
	const plan = [
		...followPlan(facts.photo, font, follow),
		...leftOutFollowers(whole, facts, font, follow),
	];

	const title = word('history.traced', { letter: letterPhrase(char) || char });
	// B10 + B11 finalize: a letter the checks would call a little off the line sits on it, with
	// its photo, inside this step (photo_flow_settle.js)
	const settled = add
		? { trace: flow.trace }
		: settleOnLine(char, copies, flow.trace, project.settings.font);
	const finalTrace = { ...settled.trace, opacity: USED_OPACITY, locked: true };
	const asTraced = !add || item.shapes.length === 0;
	// B16 (T2): the photo an Undo leaves on the letter: the one it is traced from when the letter
	// was empty, else the photo it had with its earlier shapes
	const wasEmpty = item.shapes.length === 0;
	const undoTrace = wasEmpty ? flow.trace : flow.before.trace;
	const commit = () => {
		releaseItem(project, itemId, { except: asset });
		usePart(record, partId, { char, itemId });
		setScale(record, info.scale > 0 ? info.scale : null);
		setTrace(item, finalTrace);
		markAuto(item);
		setPhotoFit(item, { asset, part: partId, shapes: asTraced ? copies : null });
	};
	const shapes = { editor, item, shapes: copies, mode: add ? 'add' : 'replace' };

	// B10 + B11 finalize: which letters need a look before, so the toast can say which this trace
	// made need one (4.2; the critic: "a trace that turns other letters amber says nothing")
	const before = needsALookNow(editor);
	flow.applying = true;
	let applied = false;
	try {
		if (plan.length) {
			// A whole-font step (4.4): the earlier letters change too. Its before-copy is the
			// font as it was before the photo card, so Undo puts back his earlier photo as well.
			setTrace(item, undoTrace);
			history.addWholeProjectChangePreState(title);
			commit();
			for (const entry of plan) {
				const other = project.getItem(entry.itemId);
				if (!other || !applyFollow(other, entry)) continue;
				setPhotoFit(other, { asset, part: entry.partId, shapes: other.shapes });
			}
			applied = applyAutoTrace({ ...shapes, editor: withoutSteps(editor) }, { round: true, title });
			history.addWholeProjectChangePostState();
		} else {
			const prior = item.save();
			if (wasEmpty) prior.anyink = { ...(prior.anyink || {}), trace: structuredClone(undoTrace) };
			commit();
			applied = applyAutoTrace(shapes, { round: true, title });
			if (applied && wasEmpty) markStepBefore(history, itemId, prior, (data) => new Glyph(data));
		}
	} finally {
		flow.applying = false;
	}
	if (!applied) {
		// Nothing went in (it can't, once the checks above pass): the photo card stays at step C
		setTrace(item, flow.trace);
		emit(flow);
		return failure('not-applied');
	}

	s.added.delete(asset);
	s.flow = null;
	clearTimeout(flow.timer);
	flow.run++;
	// Step C's save hold comes off: the letter as it is now is what saves (photo_flow_hold.js)
	releaseSavedTrace(item);
	// A whole-font step sent its "changed" notice with its before-copy, ahead of the change: say
	// it again now it is made, so the rail's ready count and the save status read the new letter
	if (plan.length) history.updateAfterSaveState?.();
	const resized = plan.filter((entry) => entry.resized).map((entry) => entry.char);
	const moved = plan.filter((entry) => !entry.resized).map((entry) => entry.char);
	const flipped = flippedSince(before, editor, { except: itemId });
	sayFollowers(editor, char, { resized, moved, flipped });
	try {
		showTip('photoStays');
	} catch (error) {
		console.warn('ANY-INK photo: the tip could not show', error);
	}
	emit(null, editor);
	return { ok: true, title, resized, moved, flipped };
}

/**
 * The editor as applyAutoTrace sees it, with its Undo steps left to the caller (the whole-font
 * step around it). Everything else is the real editor: its getters run on it.
 */
function withoutSteps(editor) {
	const quiet = {
		addState() {},
		addWholeProjectChangePreState() {},
		addWholeProjectChangePostState() {},
	};
	return new Proxy(editor, {
		get(target, key) {
			if (key === 'history') return quiet;
			const value = Reflect.get(target, key, target);
			return typeof value === 'function' ? value.bind(target) : value;
		},
	});
}

/**
 * The toast after Use it, when earlier letters of the photo followed (principle 6), or letters
 * now need a look that didn't (B10 + B11 finalize: said in the same toast, with [Show me], which
 * opens the first of them). A list names two letters, then how many more.
 */
function sayFollowers(editor, char, { resized, moved, flipped = [] }) {
	if (!resized.length && !moved.length && !flipped.length) return;
	const letter = letterPhrase(char) || char;
	const names = (chars) => listOf(chars.map((c) => letterPhrase(c) || c));
	let key = 'photoFlow.traced';
	let vars = { letter };
	if (resized.length && moved.length) {
		key = 'photoFlow.tracedResizedMoved';
		vars = { letter, resized: names(resized), moved: names(moved) };
	} else if (resized.length) {
		key = 'photoFlow.tracedResized';
		vars = { letter, others: names(resized) };
	} else if (moved.length) {
		key = 'photoFlow.tracedMoved';
		vars = { letter, others: names(moved) };
	}
	if (!flipped.length) {
		toast(key, vars, { kind: 'automatic' });
		return;
	}
	const first = editor.project?.getItem?.(flipped[0]);
	const said = word(key, vars);
	// B16 final: one letter says what it needs a look for (the critic: "Have a look at X too"
	// names no reason)
	const reason = flipped.length === 1 ? lookOf(editor, first)?.reason : '';
	const look =
		flipped.length === 1
			? reason
				? word('photoFlow.flippedReason', { reason })
				: word('photoFlow.flippedOne', { other: letterPhrase(first?.chars) || '' })
			: word('photoFlow.flippedMany', { count: flipped.length });
	toast(
		'photoFlow.saidAndFlipped',
		{ said, flipped: look },
		{ kind: 'automatic', action: { key: 'check.showMe', run: () => showItem(editor, flipped[0]) } }
	);
}

/**
 * "Capital B, small r and small e"; past three, "Capital B, small r and 9 other letters"
 * @param {Array<String>} names
 * @returns {String}
 */
export function listOf(names) {
	if (names.length < 2) return names[0] || '';
	if (names.length > 3) {
		return word('photoFlow.listMore', {
			first: names[0],
			second: names[1],
			count: names.length - 2,
		});
	}
	return word('photoFlow.listAnd', { first: names.slice(0, -1).join(', '), last: names.at(-1) });
}
