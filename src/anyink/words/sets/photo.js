// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B9 word set: the photo screens (UX-BEGINNER.md 4.4, 4.5, 7.7): the How card, the photo dialog
	(step B) and the photo card (steps A and C) in src/anyink/photo. Owner: B9 photo-ui track.
	Keys:
	  photo.how.*       the How card: its title, the five numbered steps, its two buttons. Step 3
	                    names the letters of the Try-it text ({text} the text, {letters} its
	                    letters once each, "B r e n a H d"); with none, only the whole alphabet.
	                    Fix pass (first-timer finding 4): printer paper, not lined notebook
	                    paper (its lines became parts); the alphabet in rows (26 one-inch
	                    capitals a finger apart need about 30 in of line, a page has about 8),
	                    so it may take more than one page: one photo of each
	  photo.dialog.*    the photo dialog: its question (letter known: "Which part is your
	                    small r?"; unknown: "Which letter is in the green box?"), the field and
	                    what it understood ("That's: small r"), its buttons, and the one-line
	                    messages under the photo
	  photo.card.*      the photo card in the letter card: step A (pick a photo) and step C
	                    (look at the result, Adjust)
	{letter} and {name} are letterName (words/letter_name.js): 'small r', 'Capital B', 'period'.
	"Use it" is core.js's action.useIt. "Ink cutoff" is said the glossary's way (term.inkCutoff).
	Every entry ships with 'photo' (B9). Buttons start with a verb (2.2), except the fixed labels
	the spec gives ("I have my photo", "Done with this photo"). No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const PHOTO = {
	// --------------------------------------------------------------
	// The How card (4.4 "The How card")
	// --------------------------------------------------------------
	'photo.how.title': { text: 'How to photograph your letters', feature: 'photo' },
	'photo.how.pen': {
		text: 'Use a black felt-tip pen (a Sharpie works) on plain white printer paper, not lined notebook paper.',
		feature: 'photo',
	},
	'photo.how.size': {
		text: "Write every letter about 1 inch tall, all the same size, with a finger's width between letters, a thumb's width between rows.",
		feature: 'photo',
	},
	'photo.how.firstTry': {
		text: 'For a first try, write the letters in "{text}" once each: {letters}.',
		feature: 'photo',
	},
	'photo.how.orAlphabet': {
		text: "Or write the whole alphabet: capitals in rows, then small letters in rows, then . , ' ? ! -",
		feature: 'photo',
	},
	'photo.how.alphabet': {
		text: "Write the whole alphabet: capitals in rows, then small letters in rows, then . , ' ? ! -",
		feature: 'photo',
	},
	'photo.how.light': {
		text: 'Lay the page flat in even light. Hold the phone straight above it and take one photo. More than one page? Take one photo of each.',
		feature: 'photo',
	},
	'photo.how.transfer': {
		text: 'Get the photo onto this PC: email it to yourself, or use Phone Link, and save it to Downloads.',
		feature: 'photo',
	},
	'photo.how.havePhoto': {
		text: 'I have my photo',
		hint: 'Opens the Windows picker to choose the photo.',
		feature: 'photo',
	},
	'photo.how.close': { text: 'Close', feature: 'photo' },

	// --------------------------------------------------------------
	// The photo dialog (4.4 step B, 4.5)
	// --------------------------------------------------------------
	'photo.dialog.titleKnown': { text: 'Which part is your {letter}?', feature: 'photo' },
	'photo.dialog.titleUnknown': { text: 'Which letter is in the green box?', feature: 'photo' },
	'photo.dialog.close': {
		text: 'Close',
		hint: 'Closes the photo. Nothing changes.',
		feature: 'photo',
	},
	'photo.dialog.hint': {
		text: 'Click a letter in the photo, or drag a box around it.',
		feature: 'photo',
	},
	'photo.dialog.view': {
		text: 'Your photo. Click a letter, or drag a box around it. Arrow keys move the green box.',
		feature: 'photo',
	},
	'photo.dialog.field': { text: 'The letter in the green box', feature: 'photo' },
	'photo.dialog.thats': { text: "That's: {name}", feature: 'photo' },
	'photo.dialog.usedFor': { text: 'Used for {name}', feature: 'photo' },
	'photo.dialog.traceIt': {
		text: 'Trace it',
		hint: 'Traces the part in the green box and shows you the result.',
		feature: 'photo',
	},
	'photo.dialog.cancel': {
		text: 'Cancel',
		hint: 'Closes the photo. Nothing changes.',
		feature: 'photo',
	},
	// finalize: what it is for, so he never skips a letter he still has to make
	'photo.dialog.skip': {
		text: 'Not a letter, skip it',
		hint: "Moves the green box on. Use it for a smudge or a letter you don't want.",
		feature: 'photo',
	},
	'photo.dialog.done': {
		text: 'Done with this photo',
		hint: 'Stops asking about the rest of this photo. Its letters stay ready under Use the same photo.',
		feature: 'photo',
	},
	'photo.dialog.loading': { text: 'Loading the photo...', feature: 'photo' },
	// finalize: the green box on a part that may hold two letters written touching
	'photo.dialog.twoLetters': {
		text: 'Two letters touch here. Drag a box around each one.',
		feature: 'photo',
	},
	'photo.dialog.typeFirst': {
		text: 'Type the letter that is in the green box first.',
		feature: 'photo',
	},
	'photo.dialog.pickFirst': {
		text: 'Click a letter in the photo first, or drag a box around it.',
		feature: 'photo',
	},
	'photo.dialog.noInkBox': {
		text: 'No ink found in that part. Draw the box again around the letter.',
		feature: 'photo',
	},
	'photo.dialog.allNamed': {
		text: 'Every letter in this photo has a name. Click one to trace it again, or press Done with this photo.',
		feature: 'photo',
	},
	'photo.dialog.noneFound': {
		text: 'ANY-INK found no letters in this photo. Drag a box around one, or press Done with this photo.',
		feature: 'photo',
	},
	'photo.dialog.noneFoundKnown': {
		text: 'ANY-INK found no letters in this photo. Drag a box around yours.',
		feature: 'photo',
	},

	// --------------------------------------------------------------
	// The photo card, step A: pick (4.4 "Step A, pick")
	// --------------------------------------------------------------
	'photo.card.region': { text: 'Photo card', feature: 'photo' },
	'photo.card.pickTitle': { text: 'Photo of your {letter}', feature: 'photo' },
	'photo.card.choose': {
		text: 'Choose a photo...',
		hint: 'Opens the Windows picker to choose a photo of your letter.',
		feature: 'photo',
	},
	'photo.card.inFont': { text: 'Photos in this font:', feature: 'photo' },
	'photo.card.usePhoto': { text: 'Use this photo', feature: 'photo' },
	'photo.card.how': { text: 'No photo yet? How to take one', feature: 'photo' },
	'photo.card.cancel': {
		text: 'Cancel',
		hint: 'Puts everything back as it was. Your letter is not changed.',
		feature: 'photo',
	},

	// --------------------------------------------------------------
	// The photo card, step C: the result (4.4 "Step C, result")
	// --------------------------------------------------------------
	'photo.card.lookRight': { text: 'Look right?', feature: 'photo' },
	'photo.card.wrongPart': { text: 'Wrong part?', feature: 'photo' },
	'photo.card.drawBox': {
		text: 'Draw a box',
		hint: 'Opens the photo again to pick the part with your letter.',
		feature: 'photo',
	},
	'photo.card.replaces': {
		text: 'This replaces your {count|shape|# shapes}. Undo brings {count|it|them} back.',
		feature: 'photo',
	},
	'photo.card.addInstead': {
		text: 'Add to my shapes instead',
		hint: 'Keeps the shapes this letter has and adds the traced ones.',
		feature: 'photo',
	},
	'photo.card.tracing': { text: 'Tracing...', feature: 'photo' },
	// B8 + B9 integration: the no-ink sentence is the flow's one (photoFlow.noInk), said once
	'photo.card.adjust': {
		text: 'Adjust',
		hint: 'How much counts as ink, how smooth the edges are, and the paper.',
		feature: 'photo',
	},
	'photo.card.inkCutoff': {
		text: 'Ink cutoff',
		hint: 'How dark something must be to count as ink.',
		pro: 'threshold',
		feature: 'photo',
	},
	'photo.card.lessInk': { text: 'less ink', feature: 'photo' },
	'photo.card.moreInk': { text: 'more ink', feature: 'photo' },
	'photo.card.auto': {
		text: 'Auto',
		hint: 'ANY-INK picks the ink cutoff for this photo.',
		feature: 'photo',
	},
	'photo.card.smooth': { text: 'Smooth', feature: 'photo' },
	'photo.card.detailed': { text: 'Detailed', feature: 'photo' },
	'photo.card.smoothDetail': {
		text: 'Smooth or detailed',
		hint: 'Smooth rounds off wobbles. Detailed keeps every corner and bump of your pen.',
		feature: 'photo',
	},
	'photo.card.specks': {
		text: 'Remove specks',
		hint: 'Leaves out dust and tiny dots that are not part of the letter.',
		feature: 'photo',
	},
	'photo.card.lightInk': {
		text: 'Light ink on dark paper',
		hint: 'For a white pen on black paper, or chalk on a board.',
		feature: 'photo',
	},
	'photo.card.paper': { text: 'Paper:', feature: 'photo' },
	'photo.card.paperScan': {
		text: 'Flat scan',
		hint: 'A scanner, or a photo with even light all over the page.',
		feature: 'photo',
	},
	'photo.card.paperPhoto': {
		text: 'Phone photo',
		hint: 'A phone photo, where the light is brighter on one side of the page.',
		feature: 'photo',
	},
	'photo.card.paperPicked': { text: 'picked for you', feature: 'photo' },
};

export default PHOTO;
