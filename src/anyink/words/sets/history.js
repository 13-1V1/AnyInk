// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 word set: Undo titles in plain words (UX-BEGINNER.md 2.2 "Undo titles, one rule", 2.4 G).
	Owner: B4 core (src/anyink/words/history_text.js picks the key for each title it knows).
	B6 shows them as "Undid: <text>" and in the Undo / Redo tooltips.

	Each text is the change in the past tense, starting small, so it reads after "Undid: ".
	{letter} is a letter as it sits in a sentence (letterPhrase: 'small b', 'the period'),
	{count|one|other} picks by number. history.navigated and history.opened are never shown
	(looking around is never a step); they are here so the words exist if a screen needs them.
*/

/** @type {Object<String, Object>} */
const HISTORY = {
	'history.unknown': { text: 'your last change' },
	'history.thisLetter': { text: 'this letter' },
	'history.navigated': { text: 'went to {letter}' },
	'history.opened': { text: 'opened {letter}' },

	// B1 (Fix it) and the auto-trace
	'history.gaveWidth': { text: 'gave {letter} a width' },
	'history.fixedWidth': { text: 'fixed the width of {letter}' },
	'history.removedStray': { text: 'removed {count|a stray shape|# stray shapes} from {letter}' },
	'history.traced': { text: 'traced {letter}' },
	'history.tracedPhoto': { text: 'traced the photo' },

	// The photo
	'history.photoAdded': { text: 'added a photo' },
	'history.photoReplaced': { text: 'changed the photo' },
	'history.photoRemoved': { text: 'took the photo off' },
	'history.photoMoved': { text: 'moved the photo' },
	'history.photoResized': { text: 'resized the photo' },
	'history.photoFade': { text: 'changed the photo fade' },
	'history.photoShown': { text: 'showed the photo' },
	'history.photoHidden': { text: 'hid the photo' },
	'history.photoLocked': { text: 'locked the photo' },
	'history.photoUnlocked': { text: 'unlocked the photo' },
	'history.photoLightInk': { text: 'turned on light ink on dark paper' },
	'history.photoDarkInk': { text: 'turned off light ink on dark paper' },
	'history.photoFitBox': { text: 'fit the photo to the letter box' },
	'history.photoFitCapitals': { text: 'fit the photo to the capitals line' },

	// Shapes, points and curve handles
	'history.shapesDeleted': { text: 'deleted {count|a shape|# shapes}' },
	'history.pointsDeleted': { text: 'deleted {count|a point|# points}' },
	'history.pointsMoved': { text: 'moved {count|a point|# points}' },
	'history.handleMoved': { text: 'moved a curve handle' },
	'history.curveBent': { text: 'bent a curve' },
	'history.shapeAdded': { text: 'added a shape' },
	'history.rectangleAdded': { text: 'added a rectangle' },
	'history.ovalAdded': { text: 'added an oval' },
	'history.pointAdded': { text: 'added a point' },
	'history.pointsChanged': { text: 'changed the points' },
	'history.shapeChanged': { text: 'changed a shape' },
	'history.shapeRenamed': { text: 'renamed a shape' },
	'history.shapesMoved': { text: 'moved {count|a shape|# shapes}' },
	'history.shapesResized': { text: 'resized {count|a shape|# shapes}' },
	'history.shapesTurned': { text: 'turned {count|a shape|# shapes}' },
	'history.shapesSlanted': { text: 'slanted {count|a shape|# shapes}' },
	'history.shapesThickness': { text: 'made {count|a shape|# shapes} thicker or thinner' },
	'history.shapesNudged': { text: 'nudged the picked shapes' },
	'history.pointsNudged': { text: 'nudged {count|the picked point|the picked points}' },
	'history.madeHole': { text: 'made a shape a hole' },
	'history.madeSolid': { text: 'made a shape solid' },
	'history.pointSmooth': { text: 'made a point smooth' },
	'history.pointCorner': { text: 'made a point a corner' },
	'history.handleOn': { text: 'turned on a curve handle' },
	'history.handleOff': { text: 'turned off a curve handle' },
	'history.handlesReset': { text: 'reset the curve handles' },
	'history.pointsMerged': { text: 'merged points' },
	'history.shapesLinedUp': { text: 'lined up {count|a shape|# shapes}' },
	'history.pointsLinedUp': { text: 'lined up {count|a point|# points}' },
	'history.letterFlippedLeftRight': { text: 'flipped {letter} left-right' },
	'history.letterFlippedUpsideDown': { text: 'flipped {letter} upside-down' },
	'history.shapeFlippedLeftRight': { text: 'flipped a shape left-right' },
	'history.shapeFlippedUpsideDown': { text: 'flipped a shape upside-down' },
	'history.pointsTidied': { text: 'tidied the points' },
	'history.shapesForward': { text: 'moved {count|a shape|the picked shapes} forward' },
	'history.shapesBack': { text: 'moved {count|a shape|the picked shapes} back' },
	'history.shapesToFront': { text: 'moved {count|a shape|the picked shapes} to the front' },
	'history.shapesToBack': { text: 'moved {count|a shape|the picked shapes} to the back' },
	'history.shapesMerged': { text: 'merged the shapes' },
	'history.shapesCutApart': { text: 'cut the shapes apart' },
	'history.shapeCutOut': { text: 'cut out a shape' },
	'history.keptNonOverlap': { text: "kept where the shapes don't overlap" },
	'history.keptOverlap': { text: 'kept where the shapes overlap' },
	'history.madeLinkedCopy': { text: 'turned a shape into a linked copy' },
	'history.madeShapeFromCopy': { text: 'turned a linked copy into a shape' },
	'history.shapesPasted': { text: 'pasted {count|a shape|# shapes}' },
	'history.shapesCopiedFrom': { text: 'copied shapes from {letter}' },
	'history.shapesFromOtherFont': { text: 'copied shapes from another font' },
	'history.linkedCopyAdded': { text: 'added a linked copy of {letter}' },
	'history.partUsedIn': { text: 'used this part in {letter}' },
	'history.drawingBroughtIn': { text: 'brought a drawing into {letter}' },

	// Letters, spaces and widths
	'history.letterDeleted': { text: 'deleted {letter}' },
	'history.partDeleted': { text: 'deleted a reusable part' },
	'history.widthFitted': { text: 'fitted the width of {letter}' },
	'history.widthChanged': { text: 'changed the width of {letter}' },
	'history.leftSpaceMoved': { text: 'moved the left space' },
	'history.rightSpaceMoved': { text: 'moved the right space' },

	// Guide lines
	'history.lineMoved': { text: 'moved the {line}' },
	'history.guideMoved': { text: 'moved a guide line' },
	'history.guideLinesChanged': { text: 'changed the guide lines' },
	'history.gridChanged': { text: 'changed the grid size' },
	'history.lineGapChanged': { text: 'changed the space between lines' },

	// Gap fixes
	'history.gapCloser': { text: 'moved {left} and {right} closer' },
	'history.gapApart': { text: 'moved {left} and {right} apart' },
	'history.someGapCloser': { text: 'moved a gap closer' },
	'history.someGapApart': { text: 'moved a gap apart' },
	'history.gapFixChanged': { text: 'changed a gap fix' },
	'history.gapFixAdded': { text: 'added a gap fix' },
	'history.gapFixRemoved': { text: 'removed a gap fix' },
	'history.gapFixRemovedPair': { text: 'removed the gap fix between {left} and {right}' },
	'history.gapFixOnePair': { text: 'made a gap fix for just one pair' },

	// More tools pages
	'history.joinedMade': { text: 'made {letter}' },
	'history.joinedMadeMany': { text: 'made {count|one set|# sets} of joined letters' },
	'history.partMade': { text: 'made a reusable part' },
	'history.allLettersChanged': { text: 'changed all letters' },
	'history.letterSetRemoved': { text: 'removed a letter set and its letters' },
	'history.copiedFromOtherFont': { text: 'copied from another font' },
};

export default HISTORY;
