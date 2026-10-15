// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B8 + B9 integration: Fine-tune > Tail re-seats a traced letter (UX-BEGINNER.md 4.3, 4.4
	"Fine-tune > Tail ([It has a tail] / [No tail]) re-seats the letter if the guess was wrong";
	B3 placement). photo_flow.js re-exports it; the letter card's press reaches it through
	photo_app.js (letter_tail.js TAIL_EVENT).

	setLetterTail(editor, itemId, tail) -> Promise<{ ok, moved, title } | { ok: false, code, key,
	button }>: his pick is stored with the photo (photo_registry.js setTail), the part is placed
	again at the letter's own scale (placement/fit_lines.js placePart with the pick), and the
	letter's shapes and its photo move up or down together by the difference (photo_scale.js
	applyFollow; the left ink edge stays, so spacing is untouched), all in one whole-font Undo step
	("said small g has no tail"), since the pick lives in settings.anyink and an item step doesn't
	hold it. A letter still as traced stays as traced (its ink print is taken again). A pick that
	moves nothing is still stored, in the same kind of step.
*/
import { placePart } from '../placement/fit_lines.js';
import { applyFollow } from '../placement/photo_scale.js';
import { getTrace } from '../trace/trace_model.js';
import { letterPhrase } from '../words/letter_name.js';
import { word } from '../words/words.js';
import { letterTail } from './letter_tail.js';
import { photoData, placementFor } from './photo_flow_data.js';
import { isAsTraced, setPhotoFit } from './photo_flow_fit.js';
import { currentEditor, failure, stateOf } from './photo_flow_state.js';
import { getPhoto, setTail } from './photo_registry.js';

/**
 * @param {Object} [editor]
 * @param {String} itemId - the letter
 * @param {Boolean} tail - [It has a tail] (true) / [No tail] (false)
 * @returns {Promise<Object>}
 */
export async function setLetterTail(editor = currentEditor(), itemId, tail) {
	const project = editor?.project;
	const item = project?.getItem?.(itemId);
	const facts = letterTail(project, item);
	if (!facts || typeof tail !== 'boolean' || !editor.history) return failure('not-applied');
	const record = getPhoto(project, facts.asset);
	const from = getTrace(item);
	const use = record?.used?.[facts.partId];
	if (!record || !from || !use) return failure('not-applied');

	let data;
	try {
		data = await photoData(stateOf(editor), editor, record);
	} catch {
		return failure('read-failed');
	}
	if (editor.project !== project || project.getItem(itemId) !== item) return failure('not-applied');

	const draft = structuredClone(record);
	setTail(draft, facts.partId, tail);
	const photo = placementFor(draft, data, { partId: facts.partId, char: use.char, itemId });
	const placed = placePart(photo, facts.partId, project.settings.font, { scale: from.scale });
	if (!placed) return failure('not-applied');

	const char = use.char;
	const title = word(tail ? 'letter.step.tailOn' : 'letter.step.tailOff', {
		name: letterPhrase(char) || char,
	});
	const asTraced = isAsTraced(item, facts.asset);
	const to = { ...from, y: placed.y };
	const moved = to.y !== from.y;
	editor.history.addWholeProjectChangePreState(title);
	setTail(record, facts.partId, tail);
	if (moved) applyFollow(item, { from, to });
	if (asTraced) setPhotoFit(item, { asset: facts.asset, part: facts.partId, shapes: item.shapes });
	editor.history.addWholeProjectChangePostState();
	editor.publish('traceLayer', item);
	editor.publish('currentItem', item);
	return { ok: true, moved, title };
}
