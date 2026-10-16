// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B15 word set: Simple's Help page (UX-BEGINNER.md 4.10). Owner: the help track
	(src/anyink/help). It replaces B5's stand-in Help (simple_pages.js help.*), so its keys are
	helpPage.* and never collide with the stand-in's while those are retired.
	Each entry names the feature that ships what it describes (principle 8): the page shows an
	entry only while its flag is on.
	Keys:
	  helpPage.title, helpPage.contents, helpPage.section.*   the page, its contents list and
	                  the five section titles (how, words, word, keys, more)
	  helpPage.how.*  section 1: the three steps in short paragraphs (the How card's text is
	                  photo.how.*, B9's, read as it is)
	  helpPage.words.*   section 2: the glossary's small lines (words.js glossary() gives the
	                  entries)
	  helpPage.word.*    section 3: section 8's steps; Windows' and Word's own labels are Use in
	                  Word's install.quote.* (B14 + B15 integration: one copy), the file and font
	                  names B14's build_names.js
	  helpPage.keys.*    section 4: what each key does (the keys themselves are keys.js's)
	  helpPage.more.*    section 5: Look at an example font, Show tips again, the full manual,
	                  About
	B14 + B15 finalize: Install it gives one way (the double-click), as the card does; the gap-fix
	step is a lead line over the card's four short steps (install.step.gaps.*).
	No exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const HELP = {
	'helpPage.title': { text: 'Help', feature: 'help' },
	'helpPage.contents': { text: 'On this page', feature: 'help' },
	'helpPage.section.how': { text: 'How a font gets made', feature: 'help' },
	'helpPage.section.words': { text: 'What these words mean', feature: 'help' },
	'helpPage.section.word': { text: 'Get your font into Windows and Word', feature: 'useInWord' },
	'helpPage.section.keys': { text: 'Keyboard keys', feature: 'help' },
	'helpPage.section.more': { text: 'More', feature: 'help' },

	// 1. How a font gets made
	'helpPage.how.letters': {
		text: '1 Letters: open a letter and make it. A finished letter says Ready.',
		feature: 'coach',
	},
	'helpPage.how.lettersPhoto': {
		text: 'The fastest way is a photo: write your letters on paper, take one photo of the page, and ANY-INK finds each letter on it.',
		feature: 'photo',
	},
	'helpPage.how.lettersBrush': {
		text: 'You can also draw a letter yourself with the brush.',
		feature: 'brush',
	},
	'helpPage.how.tryIt': {
		text: '2 Try it: type words and see them in your letters. If two letters sit too far apart or too close, drag the gap between them.',
		feature: 'tryIt',
	},
	'helpPage.how.useInWord': {
		text: '3 Use in Word: make a font file, install it in Windows, and pick it in Word like any other font.',
		feature: 'useInWord',
	},

	// 2. What these words mean
	'helpPage.words.intro': {
		text: 'The words ANY-INK uses, and what each one means.',
		feature: 'help',
	},
	'helpPage.words.like': { text: 'Like: {like}', feature: 'help' },
	'helpPage.words.pro': {
		text: 'Pro word: {pro}',
		hint: 'Small print only (.anyink-pro-word): the word other font apps use.',
		feature: 'help',
	},

	// 3. Get your font into Windows and Word (section 8)
	'helpPage.word.intro': {
		text: "ANY-INK can't install fonts itself (no web app can), so here is how, step by step.",
		feature: 'useInWord',
	},
	'helpPage.word.make': {
		text: "Make it. Press 3 Use in Word, then Make my font file. The first time, pick a folder: make a new folder called {folder} inside Documents (Chrome won't let you pick Documents itself), select it, and press {allow}. ANY-INK writes a file like {file} there.",
		feature: 'useInWord',
	},
	'helpPage.word.find': {
		text: 'Find it. Open File Explorer, then Documents > {folder}.',
		feature: 'useInWord',
	},
	// B14 + B15 integration: the same steps as Use in Word's card (install.step.*), in the
	// fact-checked wording (FACTCHECK_LOG section 8): no "at the top", no "don't show up", the
	// points box, the Normal template, and the "..." before Uninstall
	'helpPage.word.install': {
		text: 'Install it. Double-click {file}, then press {install}.',
		feature: 'useInWord',
	},
	'helpPage.word.restart': {
		text: "Restart Word. Close Word completely and open it again. Not in Word's font list? Right-click the file, choose {moreOptions}, then {installAll}.",
		feature: 'useInWord',
	},
	'helpPage.word.use': {
		text: "Use it. In Word's font box, type its name, like {testName}, and pick it. Type your name.",
		feature: 'useInWord',
	},
	'helpPage.word.gaps': {
		text: 'Gap fixes (only if you fixed the gap between two letters):',
		feature: 'useInWord',
	},
	'helpPage.word.versions': {
		text: 'Versions (only if a letter has versions): on that same {advanced} tab, tick {versionSetting}.',
		feature: 'alternates',
	},
	'helpPage.word.nextTime': {
		text: "Next time: each new font file gets a new number (Test 2, Test 3...). Windows and Word can keep showing an old copy of a font with the same name, so a new number means Word always shows your latest letters. When you're happy, press Make the final font; it is named plain {finalName}.",
		feature: 'useInWord',
	},
	'helpPage.word.cleanUp': {
		text: 'Clean up old tests: open Windows {fontSettings}, search {search}, press the {options} next to one, then {uninstall}. Do this before installing the final font if an older {finalName} is installed.',
		feature: 'useInWord',
	},
	// B14 + B15 finalize: after a rename, the old name's tests (install/build_names.js)
	'helpPage.word.cleanUpRenamed': {
		text: 'Your font had another name before: search {search} too.',
		feature: 'useInWord',
	},
	// Windows', Word's and Chrome's own labels are Use in Word's: install.quote.* (one copy)

	// 4. Keyboard keys
	'helpPage.keys.intro': {
		text: 'These keys work the same on every screen of ANY-INK.',
		feature: 'help',
	},
	'helpPage.keys.undo': { text: 'Undo your last change', feature: 'help' },
	'helpPage.keys.redo': { text: 'Redo it', feature: 'help' },
	'helpPage.keys.save': { text: 'Save your work file', feature: 'help' },
	'helpPage.keys.open': { text: 'Open a saved font', feature: 'help' },
	'helpPage.keys.makeFontFile': { text: 'Make a font file', feature: 'help' },
	'helpPage.keys.copy': { text: 'Copy the picked shape', feature: 'help' },
	'helpPage.keys.paste': { text: 'Paste it', feature: 'help' },
	'helpPage.keys.tool': { text: 'Pick the {tool} tool', feature: 'help' },
	'helpPage.keys.openLetter': {
		text: 'On the letters, type a letter to open it (hold Shift for a capital)',
		feature: 'board',
	},
	'helpPage.keys.anyLetter': { text: 'A to Z', feature: 'board' },
	'helpPage.keys.delete': { text: 'Remove the picked shape or point', feature: 'help' },
	'helpPage.keys.pan': { text: 'Hold it and drag to move the view', feature: 'help' },
	'helpPage.keys.escape': { text: 'Close a box or a card', feature: 'help' },

	// 5. More
	'helpPage.more.example': {
		text: 'Look at an example font',
		hint: 'Opens an example font in a new window. Your font stays as it is.',
		feature: 'help',
	},
	'helpPage.more.tipsAgain': { text: 'Show tips again', feature: 'coach' },
	'helpPage.more.manual': {
		text: "Full manual (Glyphr Studio's help site, uses pro words)",
		feature: 'help',
	},
	'helpPage.more.about': { text: 'About and credits', feature: 'help' },
};

export default HELP;
