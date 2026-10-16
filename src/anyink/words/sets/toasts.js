// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 word set: toasts (UX-BEGINNER.md 2.2 "Toasts, one voice", 2.4 G, 4.0 Toasts, 7.7).
	Owner: the B4 toast track: src/anyink/toast/toast.js (one queue, priorities), upstream_map.js
	(known upstream showToast messages mapped to keys here; unmapped ones are dropped in Simple)
	and the main-path call sites: history.js ("Restored deleted item", "Navigated without
	undo-ing", "No more undo"), trace_import.js, events_keyboard.js (rounding), the recovery
	module, panels/actions.js (Merge's "Uniting all glyph shapes"), the files module ("Saved
	project file" becomes the status pill only), and the drop toasts (toast/drop_toasts.js:
	an empty drawing, a work file dropped on a letter).

	Keys start with 'toast.'. Words the glossary already has (photo, shape, gap fix) are said the
	glossary's way; a letter is named with letterPhrase / letterName (words/letter_name.js) and
	passed in as {letter}; {file} is a file's own name, {name} a font's name.
	A short acknowledgement has no period ("Merged the shapes", as 4.0 writes them); a toast of
	two sentences ends each one with a period. No exclamation marks (2.2).
	Toasts with no key here: "No more undo", "No more redo", "Navigated without undo-ing" and the
	rounding notes are never shown in Simple (2.4 G), the save toast is the status pill only, and
	"Open the Recover tab" is removed in Simple; their All tools words stay where they are written.
*/

/** @type {Object<String, Object>} */
const TOASTS = {
	// --------------------------------------------------------------
	// Shapes (Merge, paste, drawings, the Rectangle and Oval tools)
	// --------------------------------------------------------------
	'toast.merging': { text: 'Merging the shapes...' },
	'toast.merged': { text: 'Merged the shapes' },
	'toast.mergeFailed': { text: "Couldn't merge the shapes" },
	'toast.pasted': { text: 'Pasted {count|a shape|# shapes}' },
	'toast.drawingImported': { text: 'Brought in {count|a shape|# shapes} from the drawing' },
	// fix track: a dropped drawing that brings nothing in says so (principle 6, never silently
	// wrong), in Simple; All tools shows nothing, as before
	'toast.drawingEmpty': { text: 'That drawing has no shapes ANY-INK can use.' },
	'toast.shapeTooSmall': { text: "That shape was too small, so it wasn't kept" },

	// --------------------------------------------------------------
	// Undo (upstream's own undo, All tools)
	// --------------------------------------------------------------
	'toast.broughtBack': { text: 'Brought back {letter}' },

	// --------------------------------------------------------------
	// The photo (trace_import.js, the drop and paste hints)
	// --------------------------------------------------------------
	// Simple only, until B9's photo card takes its place (2.4 G); All tools keeps its pointer to
	// the Trace panel's Start auto-trace
	'toast.photoAdded': { text: 'Added the photo under {letter}. It never goes in the font file.' },
	'toast.photoReplaced': { text: 'Replaced the photo' },
	'toast.photoRemoved': { text: 'Took the photo off. Undo brings it back.' },
	'toast.photoLoading': { text: 'Loading the photo. A big photo takes a few seconds.' },
	'toast.photoHeic': {
		text: "That's an iPhone HEIC photo, which Chrome can't open. Send it as a JPEG instead: on the iPhone, Settings > Camera > Formats > Most Compatible.",
	},
	'toast.photoWrongType': {
		text: "That file isn't a photo ANY-INK can use. Use a PNG, JPEG or WebP photo.",
	},
	'toast.photoDamaged': {
		text: "ANY-INK couldn't open that photo. The file may be damaged. Save it again as a PNG or JPEG and try again.",
	},
	'toast.photoTooBig': {
		text: "ANY-INK couldn't get that photo ready for tracing. Try a smaller PNG or JPEG.",
	},
	'toast.photoNoDecoder': {
		text: "This browser can't open photos for tracing. Use Chrome or Edge.",
	},
	'toast.photoSwitched': {
		text: "You opened something else while the photo was loading, so it wasn't added. Try again.",
	},
	'toast.photoPickAgain': { text: 'Press the button again to pick a photo.' },
	'toast.photoPickerFailed': {
		text: "ANY-INK couldn't open the file picker. Drop the photo on the letter instead.",
	},
	'toast.photoAlreadyFits': { text: 'The photo already fits' },
	'toast.openLetterFirst': { text: 'Open a letter first, then add its photo.' },
	'toast.dropHint': {
		text: 'Drop a photo (PNG, JPEG or WebP) to trace over it, or a drawing (.svg) to bring in its shapes.',
	},
	'toast.pasteTextHint': {
		text: 'To bring in a drawing, drop its .svg file on the letter. Paste a photo to trace over it.',
	},
	'toast.pasteFileHint': { text: 'Paste a PNG, JPEG or WebP photo to trace over it.' },
	// B8 + B9 integration: the words Simple said while it had no way to use a photo (the "can't
	// use photos yet" toast and the drawings-only drop and paste hints) are gone: B9's photo card
	// turned 'photo' on, and a photo dropped or pasted on a letter goes to the photo flow
	// fix track: his own work file dropped on a letter (7.7 names work files); Ctrl+O opens a
	// saved font in both modes (7.6). All tools keeps its drop hint.
	'toast.dropWorkFile': { text: "That's an ANY-INK work file. To open it, press Ctrl+O." },
	'toast.clipboardBlocked': {
		text: "ANY-INK isn't allowed to read the clipboard. Allow Clipboard in Chrome's site settings, or drop the photo on the letter.",
	},

	// --------------------------------------------------------------
	// Backup copies (the recovery module, 7.7)
	// --------------------------------------------------------------
	'toast.backupOpened': { text: 'Opened the backup copy of {name} from {ago}' },
	'toast.backupFailed': { text: "Couldn't save a backup copy. Press Save to keep your work." },

	// --------------------------------------------------------------
	// The font file (the File menu's Make a font file, until B14's Use in Word).
	// {file} and {folder} show as quotes (.anyink-quote): exact Windows names.
	// --------------------------------------------------------------
	'toast.fontFileMaking': { text: 'Making the font file...' },
	// B14 + B15 finalize: "Made", as Use in Word's card says it (no "Exported")
	'toast.fontFileExported': { text: 'Made {file} in {folder}' },
	'toast.fontFileDownloading': { text: 'Downloading {file}' },
	'toast.fontFileNoLongerAllowed': {
		text: "ANY-INK can't write to {folder} anymore, so it's downloading {file} instead.",
	},
	'toast.fontFileWriteFailed': {
		text: "ANY-INK couldn't write {file} to {folder}, so it's downloading it instead.",
	},
	'toast.fontFileCancelled': { text: 'No font file was made' },
	'toast.fontFolderPressAgain': { text: 'Press again to let ANY-INK write to {folder}.' },
	// B14 + B15 integration: the folder now lives in Use in Word, so these say what to do there
	'toast.fontFolderChooseAgain': { text: 'Press again to pick a folder for your font files.' },
	'toast.fontFolderRefused': {
		text: "ANY-INK wasn't allowed to write to {folder}. Pick a different folder.",
	},

	// --------------------------------------------------------------
	// The work file (open, save, recent fonts)
	// --------------------------------------------------------------
	'toast.pressOpenAgain': { text: 'Press Open again to choose your work file.' },
	'toast.pressSaveAgainWhere': { text: 'Press Save again to choose where to save.' },
	'toast.pressSaveAgain': { text: 'Press Save again to let ANY-INK write {file}.' },
	'toast.saveNotAllowed': { text: "ANY-INK wasn't allowed to write {file}. Choose a new file." },
	'toast.fileMoved': { text: '{file} is no longer where it was. Choose where to save it.' },
	'toast.fileMissing': { text: "{file} couldn't be found." },
	'toast.openNotAllowed': { text: "ANY-INK wasn't allowed to open {file}." },
	'toast.recentPressAgain': { text: 'Press once more to let ANY-INK open {file}.' },
	'toast.recentRefused': {
		text: "ANY-INK wasn't allowed to open {file}, so it's off the recent list.",
	},
	'toast.recentMissing': { text: "{file} couldn't be found, so it's off the recent list." },
};

export default TOASTS;
