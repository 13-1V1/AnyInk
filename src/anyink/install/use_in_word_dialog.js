// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14: Use in Word (UX-BEGINNER.md 4.7, section 8), step 3. Opened by the rail's "3 Use in Word",
	the Next line's [Use in Word] (coach action 'useInWord'), Menu > Make my font file... and Ctrl+E
	in Simple (mode/doors.js USE_IN_WORD_EVENT). An ANY-INK dialog (the photo track's modal shell,
	photo/photo_dialog.js openModal: editor keys never reach the letter under it), shown only in
	Simple with 'useInWord' on. All tools keeps its File menu export.

	Before the file is made:
	  Use your font in Word                                             [x]
	  This makes a font file (".otf") that you install in Windows. Your work file stays as it is.
	  Font files go in: no folder yet  [Pick a folder...]    or "My Fonts" [Change]
	  Make a new folder inside Documents, for example "My Fonts" (...), then choose "Allow".
	  ! 51 letters aren't made yet. In Word they won't be in your handwriting.
	  ! 1 letter needs a look. [Show me]                       (only with B11's 'checks')
	  [ Make my font file ] (green)
	Make my font file runs the font check first, on exactly the letters the file will hold (B1:
	letters with no shapes left out, a space added when the font has none). A letter that fails
	blocks the build: no file, and "small a has a problem the font file can't hold. [Fix it]"
	(B1's Fix it, or [Show me] when there is no safe fix). Otherwise, inside the click, the folder
	is settled (export_folder.js prepareExportDestination: the remembered folder's permission, or
	the picker), the names are worked out (build_names.js: "<name> Test <n>" and
	"<NameNoSpaces>-Test<n>.otf", the number only counting up), and the font file is built with
	the B1 exporter options (font_export.js ioFont_exportFont). The work file is never changed, so
	no Undo step. While the file is built and written the dialog steps aside, so Chrome's and
	ANY-INK's own boxes (a same-named file: Replace / Keep both / Cancel) are never under it; it
	comes back with the install card (install_card.js), or with "Couldn't write to "My Fonts".
	Chrome may need your OK. [Try again] [Pick a different folder]". A build that fails leaves
	7.7's error box (font_export.js) and nothing else.
	"Make the final font" (on the card) is the same with build_names.js finalBuildNames.
	Fix pass (10/15/2026):
	  - a font file with no letter made (word_export.js hasLetterToMake: the exporter's own list)
	    is never built: "Make at least one letter first." and [Back to my letters] (green) take
	    the green button's place, and makeFontFile says 'noLetters' before a test number is used;
	  - the folder is picked by the dialog itself (export_folder.js chooseExportFolder), so a
	    cancelled picker says it once, in the dialog ("No folder picked. ..."), the grey tip gone,
	    and no toast; a folder already remembered goes through prepareExportDestination as before;
	  - the build is quiet (font_export.js exportOptions.quiet): no progress, folder or
	    "Exported ..." toast behind the dialog (B14 + B15 finalize; a download in place of the
	    folder still says why);
	  - one build at a time: while a font file is being made (the dialog may have stepped aside)
	    Use in Word does not open again, from any door; it says "Making your font file..." instead.
	Finalize (10/16/2026): a Cancel on Replace / Keep both / Cancel is said in the dialog ("No font
	file was made. ..."); [Change] closed with a folder remembered changes nothing; a picker whose
	click expired says "Press again ..." in the dialog; the final card keeps the work file's old
	names (build_names.js renamedTestNames).

	  USE_IN_WORD_NAME                     'useInWord' (data-anyink-dialog, the Next line's fact)
	  emptyLetters(project)                the board's letters with no ink, in board order
	  needsLookLetters(editor, { isOn, needsLook })   the board's letters with ink that need a look
	  blockingProblem(project)             the font check's first problem on the file's letters,
	                                       or null
	  blockedText(project, problem)        its sentence
	  makeFontFile(editor, { kind, destination, exportFont, onBuilding })
	                                       after the check: names, build, write; resolves
	                                       { status: 'made', model } | { status: 'notWritable' |
	                                       'cancelled' | 'writeCancelled' | 'failed' |
	                                       'noLetters' }
	  openUseInWord({ editor, cause, card })   the dialog (card: show that card), or null (not
	                                       Simple, the flag off, no font, a build in flight)
	  isBuildingFontFile()                 true while a Use in Word font file is being made
	  closeUseInWord() / isUseInWordOpen()
	  installUseInWord({ getEditor })      answers the door and the coach action; returns the
	                                       uninstall
	Words: install.* (words/sets/install.js). Look: use_in_word_dialog.css, install_card.css and
	the shared modal shell (photo/photo_dialog.css), tokens only.
*/
import { getCurrentProjectEditor } from '../../app/main.js';
import { ioFont_exportFont } from '../../formats_io/otf/font_export.js';
import { boardLetters, hasInk } from '../board/letter_set.js';
import { checksSource } from '../checks/cache.js';
import { hasCoachAction, runCoachAction, setCoachAction } from '../coach/actions.js';
import { noteCoach, setCoachFact } from '../coach/coach_state.js';
import { fontNameOf, letterItem } from '../coach/font_facts.js';
import {
	chooseExportFolder,
	getLastExportMessage,
	preloadExportFolder,
	prepareExportDestination,
} from '../files/export_folder.js';
import { hasDirectoryPicker, hasFileSystemAccess } from '../files/file_api.js';
import { PROBLEM, validateFont } from '../fontcheck/validate.js';
import { USE_IN_WORD_EVENT } from '../mode/doors.js';
import { isFeatureOn } from '../mode/features.js';
import { isSimpleMode } from '../mode/mode.js';
import { openModal } from '../photo/photo_dialog.js';
import { canFixProblem, fixProblem } from '../preview/fix_it.js';
import { showItem } from '../preview/show_item.js';
import { noteFontFile } from '../start/install_offer.js';
import { toast } from '../toast/toast.js';
import { goToLetters } from '../topbar/letters_page.js';
import { markWordGapStepShown } from '../tryit/word_note.js';
import { sayError } from '../words/error_box.js';
import { fontFileFailedWords } from '../words/error_words.js';
import { letterPhrase, sentenceStart } from '../words/letter_name.js';
import { wordHTML } from '../words/word_html.js';
import { word, wordEntry } from '../words/words.js';
import {
	familyBase,
	finalBuildNames,
	nextTestBuild,
	noteTestBuilt,
	renamedTestNames,
} from './build_names.js';
import { hasGapFixes, makeInstallCard } from './install_card.js';
import { hasLetterToMake, WORD_EXPORT_OPTIONS } from './word_export.js';
import './use_in_word_dialog.css';

export const USE_IN_WORD_NAME = 'useInWord';

/** B1's exporter options for every Use in Word build (4.7), word_export.js */
const EXPORT_OPTIONS = WORD_EXPORT_OPTIONS;
const MADE = ['folder', 'download'];

/** @type {{modal: Object, editor: Object} | null} */
let current = null;
/** A font file is being made (one build at a time, from any door) */
let building = false;

/** @returns {Boolean} */
export function isBuildingFontFile() {
	return building;
}

// --------------------------------------------------------------
// What the dialog says (no screen)
// --------------------------------------------------------------

/**
 * @param {Object} project
 * @returns {Array<String>} the board's letters with no ink, in board order
 */
export function emptyLetters(project) {
	if (!project) return [];
	return boardLetters(project).filter((char) => !hasInk(letterItem(project, char)));
}

/**
 * @param {Object} editor
 * @param {{isOn?: Function, needsLook?: Function}} [options] - needsLook(item, { editor }):
 *   B11's checks (checks/cache.js checksSource)
 * @returns {Array<Object>} the letters (Glyphs) with ink that need a look, in board order
 */
export function needsLookLetters(editor, { isOn = isFeatureOn, needsLook = checksSource } = {}) {
	const project = editor?.project;
	if (!project || !isOn('checks')) return [];
	return boardLetters(project)
		.map((char) => letterItem(project, char))
		.filter((item) => {
			if (!item || !hasInk(item)) return false;
			try {
				return !!needsLook(item, { editor });
			} catch (error) {
				console.warn('ANY-INK Use in Word: a letter check failed', error);
				return false;
			}
		});
}

/**
 * @param {Object} project
 * @returns {{itemId: String, problem: String, message: String} | null} the font check's first
 *   problem on the letters the file will hold (the exporter's own list, with B1's options)
 */
export function blockingProblem(project) {
	if (!project) return null;
	return validateFont(project, EXPORT_OPTIONS)[0] || null;
}

/**
 * @param {Object} project
 * @param {{itemId: String, problem: String, message: String}} problem
 * @returns {String} "small a has a problem the font file can't hold."
 */
export function blockedText(project, problem) {
	if (problem?.problem === PROBLEM.kern) return word('install.blockedGap');
	const item = problem?.itemId ? project?.getItem?.(problem.itemId) : null;
	const name = item?.chars ? letterPhrase(item.chars) : '';
	if (name) return word('install.blocked', { letter: sentenceStart(name) });
	return String(problem?.message || word('install.blockedGap'));
}

/**
 * Builds and writes the font file once the check passed and the folder is settled.
 * @param {Object} editor
 * @param {Object} options
 * @param {'test' | 'final'} [options.kind]
 * @param {{kind: String, dir?: Object}} options.destination - prepareExportDestination's
 * @param {Function} [options.exportFont] - font_export.js ioFont_exportFont
 * @param {Function} [options.onBuilding] - called just before the build
 * @returns {Promise<{status: 'made', model: Object} |
 *   {status: 'notWritable' | 'cancelled' | 'failed'}>}
 */
export async function makeFontFile(
	editor,
	{ kind = 'test', destination, exportFont = ioFont_exportFont, onBuilding } = {}
) {
	const project = editor?.project;
	if (!project) return { status: 'failed' };
	// nothing he wrote would be in it: no file, and no test number used up
	if (!hasLetterToMake(project)) return { status: 'noLetters' };
	if (destination?.kind === 'prompt') return { status: 'notWritable' };
	if (!MADE.includes(destination?.kind)) return { status: 'cancelled' };
	const name = fontNameOf(project);
	const dir = destination.kind === 'folder' ? destination.dir : null;
	// B14 + B15 fix pass (names): test builds remembered per work file, so a rename still names
	// the old name's last test build on the card
	const workId = project.settings?.project?.id || null;
	const names =
		kind === 'final' ? finalBuildNames(name) : await nextTestBuild(name, dir, { workId });
	onBuilding?.();
	const before = getLastExportMessage();
	const result = await exportFont('otf', false, {
		...EXPORT_OPTIONS,
		familyName: names.family,
		fileName: names.fileName,
		// the dialog says what happened to the folder; no toast behind it (export_folder.js)
		quiet: true,
	});
	if (result === 'prompt') return { status: 'notWritable' };
	// B14 + B15 finalize: a Cancel on "a file of that name is already there" (the folder was
	// fine), said in the dialog
	if (result === 'cancelled') return { status: 'writeCancelled' };
	if (!MADE.includes(result)) return { status: 'failed' };

	const record = getLastExportMessage();
	const fresh = record && record !== before ? record : null;
	if (kind !== 'final') await noteTestBuilt(name, names.number, { workId });
	noteCoach('fontFileMade');
	// (the install offer hears of it in afterMake, once the card is back: see there)
	return {
		status: 'made',
		model: {
			kind,
			// the one base every family and the search use (build_names.js familyBase)
			name: familyBase(name),
			fileName: fresh?.fileName || names.fileName,
			family: names.family,
			finalFamily: finalBuildNames(name).family,
			folder: result === 'folder' ? fresh?.folder || dir?.name || '' : '',
			downloaded: result === 'download',
			earlier: kind === 'final' ? null : names.earlier || null,
			// the work file's earlier names with test builds (build_names.js), for the card
			// B14 + B15 finalize: the final card names them too (Remove old test fonts)
			renamedFrom:
				kind === 'final' ? await renamedTestNames(name, workId) : names.renamedFrom || [],
			number: names.number ?? null,
			gapFixes: hasGapFixes(project),
			versions: false,
		},
	};
}

// --------------------------------------------------------------
// The dialog
// --------------------------------------------------------------

/**
 * @param {{editor?: Object, cause?: String, card?: Object}} [options]
 * @returns {{element: HTMLElement, close: Function} | null}
 */
export function openUseInWord({ editor = getCurrentProjectEditor(), card = null } = {}) {
	if (!isSimpleMode() || !isFeatureOn('useInWord') || !editor?.project) return null;
	if (building) {
		// the dialog stepped aside for the build: say so, and start nothing new
		toast('install.making', {}, { group: 'export' });
		return null;
	}
	const titleId = 'anyink-use-in-word-title';
	const modal = openModal({
		name: USE_IN_WORD_NAME,
		className: 'anyink-use-in-word',
		labelledBy: titleId,
	});
	const { dialog } = modal;
	// the one shared rule makes Chrome's and Windows' labels bold (common/resets.css)
	dialog.dataset.anyinkQuotes = 'bold';
	modal.cleanups.push(() => {
		if (current?.modal === modal) current = null;
	});
	current = { modal, editor };

	/**
	 * phase: 'before' | 'busy' | 'card' | 'notWritable'; folderNote: '' | 'cancelled' |
	 * 'pressAgain'; note: '' | 'writeCancelled'
	 */
	const state = { phase: card ? 'card' : 'before', card, blocked: null, folderNote: '', note: '' };

	const head = el('div', 'anyink-modal__head');
	const title = el('h2', 'anyink-modal__title', { id: titleId });
	const x = el('button', 'anyink-modal__close', {
		type: 'button',
		'aria-label': word('install.close'),
		'data-anyink-install-action': 'x',
	});
	x.textContent = '×';
	x.addEventListener('click', () => modal.close());
	head.append(title, x);
	const body = el('div', 'anyink-use-in-word__body');
	dialog.append(head, body);

	const draw = () => {
		if (modal.closed) return;
		dialog.dataset.anyinkInstallPhase = state.phase;
		if (state.phase === 'card') {
			title.textContent = word('install.title');
			body.replaceChildren(
				makeInstallCard(state.card, {
					onDone: () => modal.close(),
					onMakeFinal: () => make('final'),
				})
			);
			if (state.card?.gapFixes) markWordGapStepShown();
			return;
		}
		title.textContent = word('install.title');
		body.replaceChildren(...beforeParts());
	};

	/** The dialog before the file is made, with its notes */
	const beforeParts = () => {
		const parts = [];
		parts.push(
			para(
				'anyink-use-in-word__intro',
				wordHTML('install.intro', { type: word('install.quote.type') }, ['type'])
			)
		);
		if (!hasLetterToMake(editor.project)) return [...parts, ...noLetterParts()];
		parts.push(folderLine());
		if (!folderName() && state.folderNote !== 'cancelled') {
			parts.push(
				para(
					'anyink-use-in-word__tip',
					wordHTML(
						'install.folder.tip',
						{ folder: word('install.quote.myFonts'), allow: word('install.quote.allow') },
						['folder', 'allow']
					)
				)
			);
		}
		if (state.folderNote === 'cancelled') {
			// one sentence, once: it already says where to make the folder
			parts.push(note('folder', word('error.noFolderPicked')));
		} else if (state.folderNote === 'pressAgain') {
			// Chrome let the click's moment pass before the picker opened
			parts.push(note('folder', word('install.folder.pressAgain')));
		}
		const empty = emptyLetters(editor.project).length;
		if (empty > 0) parts.push(note('empty', word('install.note.empty', { count: empty })));
		const looks = needsLookLetters(editor);
		if (looks.length > 0) {
			const line = note('needsLook', word('install.note.needsLook', { count: looks.length }));
			const show = button('showNeedsLook', 'check.showMe', 'anyink-use-in-word__link');
			show.addEventListener('click', () => {
				modal.close();
				if (hasCoachAction('showNeedsLook')) runCoachAction('showNeedsLook', {}, { editor });
				else showItem(editor, looks[0].id);
			});
			line.append(' ', show);
			parts.push(line);
		}
		if (state.blocked) parts.push(blockedLine());
		if (state.note === 'writeCancelled') {
			parts.push(note('writeCancelled', word('install.note.writeCancelled')));
		}
		if (state.phase === 'notWritable') {
			const line = note(
				'notWritable',
				wordHTML('error.folderNotWritable', { folder: folderName() || '' }, ['folder']),
				true
			);
			parts.push(line);
			const row = el('div', 'anyink-modal__buttons');
			const again = button(
				'tryAgain',
				'error.button.tryAgain',
				'anyink-modal__button anyink-primary'
			);
			again.addEventListener('click', () => make(state.kind || 'test'));
			const other = button(
				'pickDifferentFolder',
				'error.button.pickDifferentFolder',
				'anyink-modal__button anyink-outlined'
			);
			other.addEventListener('click', () => pick());
			row.append(again, other);
			parts.push(row);
			return parts;
		}
		const row = el('div', 'anyink-modal__buttons');
		const makeButton = button('make', 'install.make', 'anyink-modal__button anyink-primary');
		if (state.phase === 'busy') {
			makeButton.disabled = true;
			makeButton.textContent = word('install.making');
		}
		makeButton.addEventListener('click', () => make('test'));
		row.append(makeButton);
		parts.push(row);
		return parts;
	};

	/** No letter made yet: one sentence, and the way back to the letters as the one green */
	const noLetterParts = () => {
		const row = el('div', 'anyink-modal__buttons');
		const back = button(
			'backToLetters',
			'mode.band.backToLetters',
			'anyink-modal__button anyink-primary'
		);
		back.addEventListener('click', () => {
			modal.close();
			goToLetters(editor);
		});
		row.append(back);
		return [note('noLetters', word('install.note.noLetters')), row];
	};

	const folderName = () => current?.folder ?? '';

	const folderLine = () => {
		const line = el('p', 'anyink-use-in-word__folder');
		line.dataset.anyinkInstallFolder = folderName() ? 'picked' : 'none';
		line.append(word('install.folder.label'), ' ');
		const name = folderName();
		if (name) {
			const quote = el('span', 'anyink-quote');
			quote.textContent = name;
			line.append(quote, ' ');
			const change = button('change', 'install.folder.change', 'anyink-use-in-word__link');
			change.addEventListener('click', () => pick());
			line.append(change);
		} else {
			const none = el('span', 'anyink-use-in-word__none');
			none.textContent = word('install.folder.none');
			line.append(none, ' ');
			const pickButton = button(
				'pick',
				'install.folder.pick',
				'anyink-modal__button anyink-outlined anyink-use-in-word__pick'
			);
			pickButton.addEventListener('click', () => pick());
			line.append(pickButton);
		}
		return line;
	};

	const blockedLine = () => {
		const problem = state.blocked;
		const line = note('blocked', blockedText(editor.project, problem), false, true);
		const fixable = canFixProblem(editor.project, problem);
		const fix = button(
			fixable ? 'fixIt' : 'showProblem',
			fixable ? 'check.fixIt' : 'check.showMe',
			'anyink-use-in-word__link'
		);
		fix.addEventListener('click', () => {
			if (fixable) {
				fixProblem(editor, problem);
				state.blocked = blockingProblem(editor.project);
				draw();
				return;
			}
			modal.close();
			showItem(editor, problem.itemId);
		});
		line.append(' ', fix);
		return line;
	};

	/** The picker's answer, said in the dialog only (no toast) */
	const tookFolder = (choice) => {
		if (choice.status === 'picked') {
			if (current) current.folder = choice.dir.name;
			state.folderNote = '';
			if (state.phase === 'notWritable') state.phase = 'before';
		} else if (choice.status === 'cancelled') {
			// B14 + B15 finalize: [Change] closed with a folder remembered changes nothing
			state.folderNote = folderName() ? '' : 'cancelled';
		} else if (choice.status === 'needsClick') {
			state.folderNote = 'pressAgain';
		}
	};

	/** [Pick a folder...] / [Change] / [Pick a different folder]: inside the click */
	const pick = () =>
		chooseExportFolder()
			.then((choice) => {
				tookFolder(choice);
				draw();
			})
			.catch((error) => fail(error));

	/**
	 * Where the file goes: the remembered folder through prepareExportDestination (its
	 * permission), or, with none, the dialog's own picker, which says nothing outside the dialog.
	 */
	const destinationFor = async () => {
		const remembered = await preloadExportFolder();
		if (!remembered && hasFileSystemAccess() && hasDirectoryPicker()) {
			const choice = await chooseExportFolder();
			tookFolder(choice);
			if (choice.status === 'cancelled') return { kind: 'cancelled' };
			if (choice.status !== 'picked') return { kind: 'stay' };
			return { kind: 'folder', dir: choice.dir };
		}
		// quiet: one more click, a refused folder, a cancelled picker are said in the dialog only
		return prepareExportDestination({ quiet: true });
	};

	/** Make my font file / Make the final font / Try again: inside the click */
	const make = (kind) => {
		if (state.phase === 'busy' || building) return;
		if (!hasLetterToMake(editor.project)) {
			if (state.phase === 'card') state.phase = 'before';
			draw();
			return;
		}
		const problem = blockingProblem(editor.project);
		if (problem) {
			state.blocked = problem;
			if (state.phase === 'card') state.phase = 'before';
			draw();
			return;
		}
		state.blocked = null;
		state.note = '';
		state.kind = kind;
		state.phase = 'busy';
		building = true;
		draw();
		// the folder first, while the click's activation is live (D-027)
		destinationFor()
			.then((destination) => {
				if (destination.kind === 'stay') return { status: 'cancelled' };
				if (destination.kind === 'folder' && current) current.folder = destination.dir.name;
				if (destination.kind === 'cancelled') state.folderNote = 'cancelled';
				return makeFontFile(editor, {
					kind,
					destination,
					onBuilding: () => modal.close({ silent: true }),
				});
			})
			.then((outcome) => afterMake(outcome, kind))
			.catch((error) => fail(error));
	};

	const afterMake = (outcome, kind) => {
		building = false;
		if (outcome.status === 'made') {
			// the build was quiet (no "Exported ..." toast to clear), so a toast from while the
			// dialog stepped aside, such as Delete's [Undo], stays (B14 + B15 finalize)
			reopen({ card: outcome.model });
			// B14 + B15 integration: only now, with the card open, so the install offer (B13) waits
			// for it to close; during the build the dialog stepped aside and the offer came in the gap
			noteFontFile();
			return;
		}
		if (outcome.status === 'failed') {
			// font_export.js already showed 7.7's box; the dialog stays out of its way
			if (!modal.closed) modal.close();
			else tellCoachClosed();
			return;
		}
		const phase = outcome.status === 'notWritable' ? 'notWritable' : 'before';
		const said = outcome.status === 'writeCancelled' ? 'writeCancelled' : '';
		if (modal.closed) {
			reopen({ phase, kind, said });
			return;
		}
		state.phase = phase;
		state.note = said;
		draw();
	};

	const reopen = ({ card: made = null, phase = 'before', kind = 'test', said = '' }) => {
		if (!modal.closed) modal.close({ silent: true });
		const again = openUseInWord({ editor, card: made });
		if (!again || made) return;
		again.setPhase?.(phase, kind, said);
	};

	const fail = (error) => {
		building = false;
		console.warn('ANY-INK Use in Word: the font file could not be made', error);
		if (!modal.closed) modal.close();
		else tellCoachClosed();
		sayError(fontFileFailedWords(), {
			actions: { 'error.button.tryAgain': () => openUseInWord({ editor }) },
		});
	};

	current.folder = '';
	preloadExportFolder()
		.then((dir) => {
			if (!current || current.modal !== modal) return;
			if (!current.folder) current.folder = dir?.name || '';
			draw();
		})
		.catch(() => {});

	draw();
	modal.show(
		dialog.querySelector(
			'[data-anyink-install-action="done"], [data-anyink-install-action="make"]'
		) || x
	);
	return {
		element: dialog,
		close: () => modal.close(),
		setPhase: (phase, kind, said = '') => {
			state.phase = phase;
			state.kind = kind;
			state.note = said;
			draw();
		},
	};
}

/** The dialog closed silently for the build and is not coming back: the Next line may speak */
function tellCoachClosed() {
	setCoachFact('dialog', null);
}

/** Closes Use in Word. */
export function closeUseInWord() {
	current?.modal.close();
}

/** @returns {Boolean} */
export function isUseInWordOpen() {
	return !!current && !current.modal.closed;
}

/**
 * @param {{getEditor?: Function}} [options]
 * @returns {Function} the uninstall
 */
export function installUseInWord({ getEditor = getCurrentProjectEditor } = {}) {
	const onDoor = () => openUseInWord({ editor: getEditor() });
	globalThis.addEventListener?.(USE_IN_WORD_EVENT, onDoor);
	const previous = setCoachAction('useInWord', (_args, { editor } = {}) => {
		return !!openUseInWord({ editor: editor || getEditor() });
	});
	return () => {
		globalThis.removeEventListener?.(USE_IN_WORD_EVENT, onDoor);
		setCoachAction('useInWord', previous);
	};
}

// --------------------------------------------------------------
// Pieces
// --------------------------------------------------------------

function el(tag, className, attributes = {}) {
	const element = globalThis.document.createElement(tag);
	if (className) element.className = className;
	Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
	return element;
}

/** A paragraph from safe HTML (wordHTML escapes every value) */
function para(className, markup) {
	const p = el('p', className);
	p.innerHTML = markup;
	return p;
}

/**
 * A note line with the amber mark.
 * @param {String} name - data-anyink-install-note
 * @param {String} text - plain words, or HTML when isHTML
 * @param {Boolean} [isHTML]
 * @param {Boolean} [stop] - a line that stops the build (the red-free amber edge, stronger)
 */
function note(name, text, isHTML = false, stop = false) {
	const p = el('p', `anyink-use-in-word__note${stop ? ' is-stop' : ''}`);
	p.dataset.anyinkInstallNote = name;
	const mark = el('span', 'anyink-use-in-word__mark', { 'aria-hidden': 'true' });
	mark.textContent = '!';
	const words = el('span', 'anyink-use-in-word__words');
	if (isHTML) words.innerHTML = text;
	else words.textContent = text;
	p.append(mark, words);
	return p;
}

function button(name, key, className) {
	const element = el('button', className, { type: 'button', 'data-anyink-install-action': name });
	element.textContent = word(key);
	const hint = wordEntry(key)?.hint;
	if (hint) element.title = hint;
	return element;
}
