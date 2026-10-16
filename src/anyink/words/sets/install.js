// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B14 word set: Use in Word (UX-BEGINNER.md 4.7, section 8). Owner: the B14 dialog track
	(src/anyink/install/use_in_word_dialog.js and install_card.js). The card's wording is the
	fact-checked wording of docs/FACTCHECK_LOG.md section 8 (10/15/2026): Set As Default asks a
	question and the card names the answer; Word kerns only from the size in the box beside the
	tick; uninstalling is the "..." next to a font; only Chrome's "Allow" is quoted, never its
	prompt's title; the double-click step names no place for Install.
	Words other sets already have are used from there, not repeated: the folder errors and their
	buttons (errors.js error.noFolderPicked, error.folderNotWritable, error.button.tryAgain,
	error.button.pickDifferentFolder), Show me and Fix it (screens.js check.showMe, check.fixIt),
	Back to my letters (mode.js mode.band.backToLetters).
	Keys:
	  install.*          the dialog before the file is made: title, intro, folder line, notes,
	                     the blocked line, the green button
	  install.step.*     the card's numbered steps (4 only with gap fixes, in short steps of its
	                     own: install.step.gaps.*; 5 after M11)
	  install.more.*     the closed parts under the steps
	  install.quote.*    Windows', Word's and Chrome's own labels, and the example folder name:
	                     quote: true, shown as .anyink-quote (2.3)
	Fix pass (10/15/2026): one way to install in step 2 (the double-click; right-click and "Show
	more options" are in the closed "Not in Word's font list" part), the name typed in Word's font
	box as Help says it, no Chrome-refusal tip (the error says it), and the line a font with no
	letter made gets instead of the green button.
	Sentence case, buttons start with a verb where they act, no exclamation marks (2.2).
*/

/** @type {Object<String, Object>} */
const INSTALL = {
	// --------------------------------------------------------------
	// Before the file is made (4.7)
	// --------------------------------------------------------------
	'install.title': { text: 'Use your font in Word', feature: 'useInWord' },
	'install.close': { text: 'Close', hint: 'Closes Use in Word.', feature: 'useInWord' },
	'install.intro': {
		text: 'This makes a font file ({type}) that you install in Windows. Your work file stays as it is.',
		feature: 'useInWord',
	},
	'install.folder.label': { text: 'Font files go in:', feature: 'useInWord' },
	'install.folder.none': { text: 'no folder yet', feature: 'useInWord' },
	'install.folder.pick': { text: 'Pick a folder...', feature: 'useInWord' },
	'install.folder.change': {
		text: 'Change',
		hint: 'Pick another folder for your font files.',
		feature: 'useInWord',
	},
	'install.folder.tip': {
		text: "Make a new folder inside Documents, for example {folder} (Chrome won't let you pick Documents itself), then choose {allow}.",
		feature: 'useInWord',
	},
	'install.note.empty': {
		text: "{count|# letter isn't|# letters aren't} made yet. In Word {count|it won't|they won't} be in your handwriting.",
		feature: 'useInWord',
	},
	'install.note.needsLook': {
		text: '{count|# letter needs|# letters need} a look.',
		feature: 'useInWord',
	},
	'install.blocked': {
		text: "{letter} has a problem the font file can't hold.",
		feature: 'useInWord',
	},
	'install.blockedGap': {
		text: "A gap fix has a problem the font file can't hold.",
		feature: 'useInWord',
	},
	'install.note.writeCancelled': {
		text: 'No font file was made. Press Make my font file to try again.',
		feature: 'useInWord',
	},
	'install.folder.pressAgain': {
		text: 'Press again to pick a folder for your font files.',
		feature: 'useInWord',
	},
	'install.note.noLetters': {
		text: 'Make at least one letter first.',
		feature: 'useInWord',
	},
	'install.make': {
		text: 'Make my font file',
		hint: 'Makes a font file you can install. Your work file stays as it is.',
		feature: 'useInWord',
	},
	'install.making': { text: 'Making your font file...', feature: 'useInWord' },

	// --------------------------------------------------------------
	// After it is made: the card (4.7, section 8)
	// --------------------------------------------------------------
	'install.made': { text: 'Made {file}.', feature: 'useInWord' },
	'install.madeName': { text: "In Word it's called {family}.", feature: 'useInWord' },
	'install.step.find': {
		text: 'Open File Explorer, then Documents > {folder}.',
		feature: 'useInWord',
	},
	'install.step.findDownloads': {
		text: 'Open File Explorer, then {downloads}.',
		feature: 'useInWord',
	},
	'install.step.install': {
		text: 'Double-click {file}, then press {install}.',
		feature: 'useInWord',
	},
	'install.step.earlier': {
		text: "If you installed {earlier} earlier, you can uninstall it first so Word's font list stays short.",
		feature: 'useInWord',
	},
	'install.step.olderFinal': {
		text: 'If an older {family} is installed, uninstall it first.',
		feature: 'useInWord',
	},
	'install.how': {
		text: 'How',
		hint: 'Shows how to remove an old test font from Windows.',
		feature: 'useInWord',
	},
	'install.step.restart': {
		text: "Close Word completely, open it again, and type {family} in Word's font box.",
		feature: 'useInWord',
	},
	'install.step.gaps': { text: 'Turn on your gap fixes in Word:', feature: 'useInWord' },
	'install.step.gaps.open': { text: 'Press Ctrl+D and open {advanced}.', feature: 'useInWord' },
	'install.step.gaps.tick': { text: 'Tick {gapSetting}.', feature: 'useInWord' },
	'install.step.gaps.size': {
		text: 'If your text is smaller than the number beside it, type a smaller number (8 is the lowest).',
		feature: 'useInWord',
	},
	'install.step.gaps.keep': {
		text: 'To keep it for new files, press {setDefault}, choose {normal}, then {ok}.',
		feature: 'useInWord',
	},
	'install.step.versions': {
		text: 'Turn on your versions: on the same {advanced} tab, tick {versionSetting}.',
		feature: 'alternates',
	},
	'install.done': { text: 'Done', feature: 'useInWord' },

	// --------------------------------------------------------------
	// The closed parts under the steps
	// --------------------------------------------------------------
	'install.more.happy': { text: "When you're happy with it", feature: 'useInWord' },
	'install.more.makeFinal': {
		text: 'Make the final font',
		hint: 'Makes the font for keeps, named without a test number.',
		feature: 'useInWord',
	},
	'install.more.finalName': {
		text: 'It is named {family}. If an older {family} is installed, uninstall it first.',
		feature: 'useInWord',
	},
	'install.more.whyTest': { text: 'Why {test}?', feature: 'useInWord' },
	'install.more.whyTestText': {
		text: 'Windows and Word can keep showing an old copy of a font with the same name. A new number each time means Word always shows your latest letters.',
		feature: 'useInWord',
	},
	'install.more.removeOld': { text: 'Remove old test fonts: how', feature: 'useInWord' },
	'install.more.removeOldText': {
		text: 'Open Windows {fontSettings}, search {search}, press the {options} next to one, then {uninstall}.',
		feature: 'useInWord',
	},
	'install.more.removeOldRenamed': {
		text: 'Your font had another name before: search {search} too.',
		feature: 'useInWord',
	},
	'install.more.cantInstall': {
		text: "A web app can't install fonts for you, so these steps are yours.",
		feature: 'useInWord',
	},
	'install.more.notInList': {
		text: "Not in Word's font list after a restart?",
		feature: 'useInWord',
	},
	'install.more.notInListText': {
		text: 'Right-click the file, choose {moreOptions}, then {installAll}. Windows may ask for your OK.',
		feature: 'useInWord',
	},
	'install.more.testName': { text: 'Test {number}', feature: 'useInWord' },
	'install.more.searchName': { text: '{name} Test', feature: 'useInWord' },

	// --------------------------------------------------------------
	// Windows', Word's and Chrome's own labels (2.3: .anyink-quote)
	// --------------------------------------------------------------
	'install.quote.type': { text: '.otf', quote: true, feature: 'useInWord' },
	'install.quote.myFonts': { text: 'My Fonts', quote: true, feature: 'useInWord' },
	'install.quote.allow': { text: 'Allow', quote: true, feature: 'useInWord' },
	'install.quote.downloads': { text: 'Downloads', quote: true, feature: 'useInWord' },
	'install.quote.install': { text: 'Install', quote: true, feature: 'useInWord' },
	'install.quote.moreOptions': { text: 'Show more options', quote: true, feature: 'useInWord' },
	'install.quote.installAll': { text: 'Install for all users', quote: true, feature: 'useInWord' },
	'install.quote.advanced': { text: 'Advanced', quote: true, feature: 'useInWord' },
	'install.quote.gapSetting': { text: 'Kerning for fonts', quote: true, feature: 'useInWord' },
	'install.quote.setDefault': { text: 'Set As Default', quote: true, feature: 'useInWord' },
	'install.quote.normal': {
		text: 'All documents based on the Normal template',
		quote: true,
		feature: 'useInWord',
	},
	'install.quote.ok': { text: 'OK', quote: true, feature: 'useInWord' },
	'install.quote.versionSetting': {
		text: 'Use Contextual Alternates',
		quote: true,
		feature: 'alternates',
	},
	'install.quote.fontSettings': {
		text: 'Settings > Personalization > Fonts',
		quote: true,
		feature: 'useInWord',
	},
	'install.quote.options': { text: '...', quote: true, feature: 'useInWord' },
	'install.quote.uninstall': { text: 'Uninstall', quote: true, feature: 'useInWord' },
};

export default INSTALL;
