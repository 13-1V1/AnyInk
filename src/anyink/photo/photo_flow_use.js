// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 photo-flow: Use it (docs/UX-BEGINNER.md 4.4 "Use it", 7.3), item 4 of photo_flow.js's
	header, which re-exports it. One Undo step titled "traced small r": an item step, or a
	whole-font one when earlier letters of the photo follow its new size; the toast names those.
	Fix pass, 10/15/2026: History sends a whole-font step's save status notice with its
	before-copy only, so after such a Use it the rail said one letter fewer was ready until the
	file was written; the notice is sent again once the change is made. Step C's save hold
	(photo_flow_hold.js) comes off the letter when Use it is in.
*/
import { applyAutoTrace } from '../autotrace/apply.js';
import { showTip } from '../coach/coach_state.js';
import { followPlan } from '../placement/fit_lines.js';
import { applyFollow, photoScale } from '../placement/photo_scale.js';
import { markAuto } from '../spacing/owner.js';
import { toast } from '../toast/toast.js';
import { setTrace } from '../trace/trace_model.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { photoData, placementFor } from './photo_flow_data.js';
import { isAsTraced, setPhotoFit, tracedCopies } from './photo_flow_fit.js';
import { releaseSavedTrace } from './photo_flow_hold.js';
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
	const photo = placementFor(draft, data, { partId, char, itemId });
	const font = project.settings.font;
	const info = photoScale(photo, font);
	const plan = followPlan(photo, font, {
		except: partId,
		asset,
		getItem: (id) => {
			const other = project.getItem(id);
			return other && id !== itemId && isAsTraced(other, asset) ? other : null;
		},
	});

	const title = word('history.traced', { letter: letterPhrase(char) || char });
	const finalTrace = { ...flow.trace, opacity: USED_OPACITY, locked: true };
	const asTraced = !add || item.shapes.length === 0;
	const commit = () => {
		releaseItem(project, itemId, { except: asset });
		usePart(record, partId, { char, itemId });
		setScale(record, info.scale > 0 ? info.scale : null);
		setTrace(item, finalTrace);
		markAuto(item);
		setPhotoFit(item, { asset, part: partId, shapes: asTraced ? copies : null });
	};
	const shapes = { editor, item, shapes: copies, mode: add ? 'add' : 'replace' };

	flow.applying = true;
	let applied = false;
	try {
		if (plan.length) {
			// A whole-font step (4.4): the earlier letters change too. Its before-copy is the
			// font as it was before the photo card, so Undo puts back his earlier photo as well.
			setTrace(item, flow.before.trace);
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
			commit();
			applied = applyAutoTrace(shapes, { round: true, title });
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
	sayFollowers(char, resized, moved);
	try {
		showTip('photoStays');
	} catch (error) {
		console.warn('ANY-INK photo: the tip could not show', error);
	}
	emit(null, editor);
	return { ok: true, title, resized, moved };
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

/** The toast after Use it, when earlier letters of the photo followed (principle 6). */
function sayFollowers(char, resized, moved) {
	if (!resized.length && !moved.length) return;
	const letter = letterPhrase(char) || char;
	const names = (chars) => listOf(chars.map((c) => letterPhrase(c) || c));
	if (resized.length && moved.length) {
		toast(
			'photoFlow.tracedResizedMoved',
			{ letter, resized: names(resized), moved: names(moved) },
			{ kind: 'automatic' }
		);
	} else if (resized.length) {
		toast('photoFlow.tracedResized', { letter, others: names(resized) }, { kind: 'automatic' });
	} else {
		toast('photoFlow.tracedMoved', { letter, others: names(moved) }, { kind: 'automatic' });
	}
}

/** "Capital B, small r and small e" */
function listOf(names) {
	if (names.length < 2) return names[0] || '';
	return word('photoFlow.listAnd', { first: names.slice(0, -1).join(', '), last: names.at(-1) });
}
