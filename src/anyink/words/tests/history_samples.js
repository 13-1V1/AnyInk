// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	B4 fixture: every Undo title the app records today (upstream's and ANY-INK's, found by a
	search of every addState / addWholeProjectChangePreState / addSettingsState call on
	10/14/2026), each with the plain words historyText() gives it (UX-BEGINNER 2.2, 2.4 G).
	'' means the step is never shown (looking around). Used by history_text.test.js and by the
	test page tests/words.html.
	  title     what History records
	  context   what the toast knows about the step: { chars } (the letter it's about) and,
	            for gap steps, { project }
	  text      what he reads
*/

/** A font with one gap fix between A and V, for the gap steps. */
export const GAP_PROJECT = Object.freeze({
	kerning: {
		'kern-3': { leftGroup: ['0x41'], rightGroup: ['0x56'], value: -40 },
		'kern-4': { leftGroup: ['0x41', '0x42'], rightGroup: ['0x56'], value: -10 },
	},
});

/** @type {ReadonlyArray<{title: String, context?: Object, text: String}>} */
// prettier-ignore
export const HISTORY_SAMPLES = Object.freeze([
	// Looking around is never shown (2.4 G)
	{ title: 'Navigated to Latin Small Letter B', text: '' },
	{ title: 'Navigated to Latin Capital Letter A', text: '' },
	{ title: 'Automatically navigated to Latin Small Letter D', text: '' },
	{ title: 'Automatically navigated to kern-2', text: '' },
	{ title: 'Created Latin Small Letter C', text: '' },
	{ title: '_whole_project_change_post_state_', text: '' },

	// B1: Fix it (already plain)
	{ title: 'gave small b a width', text: 'gave small b a width' },
	{ title: 'fixed the width of small b', text: 'fixed the width of small b' },
	{ title: 'removed 2 stray shapes from small b', text: 'removed 2 stray shapes from small b' },
	{ title: 'removed a stray shape from Capital Q', text: 'removed a stray shape from Capital Q' },
	{ title: 'gave the space a width', text: 'gave the space a width' },

	// ANY-INK's plain titles pass through (2.2: new actions write plain titles)
	{ title: 'traced r', text: 'traced r' },
	{ title: 'added numbers & symbols', text: 'added numbers & symbols' },
	{ title: 'named the font Brennan Hand', text: 'named the font Brennan Hand' },
	{ title: 'moved the small-letter line', text: 'moved the small-letter line' },
	{ title: 'moved e and n closer', text: 'moved e and n closer' },

	// The photo (M7's titles)
	{ title: 'Added a trace image', text: 'added a photo' },
	{ title: 'Replaced the trace image', text: 'changed the photo' },
	{ title: 'Removed the trace image', text: 'took the photo off' },
	{ title: 'Moved the trace image', text: 'moved the photo' },
	{ title: 'Resized the trace image', text: 'resized the photo' },
	{ title: 'Set trace opacity to 35%', text: 'changed the photo fade' },
	{ title: 'Showed the trace image', text: 'showed the photo' },
	{ title: 'Hid the trace image', text: 'hid the photo' },
	{ title: 'Locked the trace image', text: 'locked the photo' },
	{ title: 'Unlocked the trace image', text: 'unlocked the photo' },
	{ title: 'Inverted the trace image colors', text: 'turned on light ink on dark paper' },
	{ title: 'Restored the trace image colors', text: 'turned off light ink on dark paper' },
	{ title: 'Fit the trace image to the em', text: 'fit the photo to the letter box' },
	{ title: 'Fit the trace image to the cap height', text: 'fit the photo to the capitals line' },

	// Auto-trace (More tools keeps its counting title; apply.test checks it)
	{ title: 'Auto-traced 3 shapes (412 points)', context: { chars: 'B' }, text: 'traced Capital B' },
	{ title: 'Auto-traced 1 shape (1,204 points)', text: 'traced the photo' },

	// Shapes and points
	{ title: 'Deleted 2 paths', text: 'deleted 2 shapes' },
	{ title: 'Deleted path: Path 1', text: 'deleted a shape' },
	{ title: 'Deleted 3 path points', text: 'deleted 3 points' },
	{ title: 'Deleted path point: 4', text: 'deleted a point' },
	{ title: 'Moved 3 path points', text: 'moved 3 points' },
	{ title: 'Moved path point: 2', text: 'moved a point' },
	{ title: 'Moved path point: 2 p', text: 'moved a point' },
	{ title: 'Moved path point: 2 h1', text: 'moved a curve handle' },
	{ title: 'Moved path point: 0 h2', text: 'moved a curve handle' },
	{ title: 'Dragged the centerpoint of a curve after point 3.', text: 'bent a curve' },
	{ title: 'Added new path: Path 2', text: 'added a shape' },
	{ title: 'Added path: Rectangle 1', text: 'added a rectangle' },
	{ title: 'Added path: Oval 2', text: 'added an oval' },
	{ title: 'Added a default rectangle path', text: 'added a rectangle' },
	{ title: 'New path: added point 4', text: 'added a point' },
	{ title: 'Added point to path', text: 'added a point' },
	{ title: 'Inserted a new path point at position 3', text: 'added a point' },
	{ title: 'Path edit tool', text: 'changed the points' },
	{ title: 'Path resize tool', text: 'changed a shape' },
	{ title: 'Moved shape: Path 1', text: 'moved a shape' },
	{ title: 'Moved 2 shapes', text: 'moved 2 shapes' },
	{ title: 'Resized shape: Path 1', text: 'resized a shape' },
	{ title: 'Resized 2 shapes', text: 'resized 2 shapes' },
	{ title: 'Rotated shape', text: 'turned a shape' },
	{ title: 'Rotated shape: Path 1', text: 'turned a shape' },
	{ title: 'Rotated 2 shapes', text: 'turned 2 shapes' },
	{ title: 'Rotated 1 shape by 15°', text: 'turned a shape' },
	{ title: 'Rotated 2 shapes by -15°', text: 'turned 2 shapes' },
	{ title: 'Skew 1 shape by 10°', text: 'slanted a shape' },
	{ title: 'Skew 2 shapes by 0.25em', text: 'slanted 2 shapes' },
	{ title: 'Offset path for 2 shapes', text: 'made 2 shapes thicker or thinner' },
	{ title: 'Offset path for 1 shape', text: 'made a shape thicker or thinner' },
	{ title: 'Nudged shape(s) by 10, 0', text: 'nudged the picked shapes' },
	{ title: 'Nudged path points by 0, -10', text: 'nudged the picked points' },
	{ title: 'Nudged path point by 1, 0', text: 'nudged the picked point' },
	{ title: 'Toggled path winding to Clockwise', text: 'made a shape a hole' },
	{ title: 'Toggled path winding to Counter-clockwise', text: 'made a shape solid' },
	{ title: 'Changed point 3 to symmetric', text: 'made a point smooth' },
	{ title: 'Changed point 3 to flat', text: 'made a point smooth' },
	{ title: 'Changed point 3 to corner', text: 'made a point a corner' },
	{ title: 'Control Point: toggled handle 1 on', text: 'turned on a curve handle' },
	{ title: 'Control Point: toggled handle 2 off', text: 'turned off a curve handle' },
	{ title: 'Reset the handles for 2 path point(s)', text: 'reset the curve handles' },
	{ title: 'Merged path points', text: 'merged points' },
	{ title: 'Left aligned 3 shapes', text: 'lined up 3 shapes' },
	{ title: 'Middle aligned 2 shapes', text: 'lined up 2 shapes' },
	{ title: 'Bottom aligned 2 points', text: 'lined up 2 points' },
	{ title: 'Flipped all shapes in this glyph horizontally', context: { chars: 'b' }, text: 'flipped small b left-right' },
	{ title: 'Flipped all shapes in this glyph vertically', text: 'flipped this letter upside-down' },
	{ title: 'Flipped shape Path 1 horizontally', text: 'flipped a shape left-right' },
	{ title: 'Flipped shape Oval 1 vertically', text: 'flipped a shape upside-down' },
	{ title: 'Rounded all the path point and handle position values in this glyph', text: 'tidied the points' },
	{ title: 'Rounded all the path point and handle position values in this shape', text: 'tidied the points' },
	{ title: 'Rounded path point and handle position values for 3 path point(s)', text: 'tidied the points' },
	{ title: 'Rounded path point and handle position values for 2 shape(s)', text: 'tidied the points' },
	{ title: 'Moved layer up', text: 'moved a shape forward' },
	{ title: 'Moved layers up', text: 'moved the picked shapes forward' },
	{ title: 'Moved layer down', text: 'moved a shape back' },
	{ title: 'Moved layers down', text: 'moved the picked shapes back' },
	{ title: 'Moved layer to the top', text: 'moved a shape to the front' },
	{ title: 'Moved layers to the top', text: 'moved the picked shapes to the front' },
	{ title: 'Moved layer to the bottom', text: 'moved a shape to the back' },
	{ title: 'Moved layers to the bottom', text: 'moved the picked shapes to the back' },
	{ title: 'Combine: unite - all selected paths', text: 'merged the shapes' },
	{ title: 'Combine: divide - all selected paths', text: 'cut the shapes apart' },
	{ title: 'Combine: subtract - all selected paths', text: 'cut out a shape' },
	{ title: 'Combine: exclude - all selected paths', text: "kept where the shapes don't overlap" },
	{ title: 'Combine: intersect - all selected paths', text: 'kept where the shapes overlap' },
	{ title: 'Combine: unite - all glyph paths', text: 'merged the shapes' },
	{ title: 'Turned a path into a component instance', text: 'turned a shape into a linked copy' },
	{ title: 'Turned a component instance into a path', text: 'turned a linked copy into a shape' },
	{ title: 'Pasted shape', text: 'pasted a shape' },
	{ title: 'Pasted 3 shapes', text: 'pasted 3 shapes' },
	{ title: 'Paths were copied from Latin Capital Letter A.', text: 'copied shapes from Capital A' },
	{ title: '\n\t\t\t3 paths were copied<br>\n\t\t\tfrom My Font : Latin Capital Letter A', text: 'copied shapes from another font' },
	{ title: 'Component instance was linked from Latin Capital Letter A.', text: 'added a linked copy of Capital A' },
	{ title: 'Component was linked to Latin Capital Letter B.', text: 'used this part in Capital B' },
	{ title: 'Imported SVG to glyph Latin Small Letter G', text: 'brought a drawing into small g' },
	{ title: 'Imported SVG to glyph g', text: 'brought a drawing into small g' },

	// Letters
	{ title: 'Deleted Glyph glyph-0x63 : Latin Small Letter C', text: 'deleted small c' },
	{
		title: 'Deleted Glyph glyph-0x37 : Digit Seven, and unlinked instances where it was used as a component.',
		text: 'deleted the number 7',
	},
	{ title: 'Deleted Ligature liga-0x66-0x69 : Ligature fi', text: 'deleted the joined letters fi' },
	{ title: 'Deleted Component comp-0 : Bowl', text: 'deleted a reusable part' },
	{ title: 'Deleted Kern Group kern-2 : kern-2', text: 'removed a gap fix' },
	{ title: 'Auto-fit advance width', context: { chars: 'a' }, text: 'fitted the width of small a' },
	{ title: 'Changed advanceWidth for: Latin Small Letter A', text: 'changed the width of small a' },
	{ title: 'Changed leftSideBearing for: Latin Small Letter A', text: 'moved the left space' },
	{ title: 'Changed rightSideBearing for: Latin Small Letter A', text: 'moved the right space' },
	{ title: 'Changed x for: Path 1', text: 'changed a shape' },
	{ title: 'Changed name for: Path 1', text: 'renamed a shape' },
	{ title: 'Updated left side bearing.', text: 'moved the left space' },
	{ title: 'Updated right side bearing.', text: 'moved the right space' },

	// Guide lines (metrics_math labels before and after B4's display track, and the readouts)
	{ title: 'Set X height to 520', text: 'moved the small-letter line' },
	{ title: 'Moved Cap height to 700', text: 'moved the capitals line' },
	{ title: 'Moved Ascent to 800', text: 'moved the top line' },
	{ title: 'Set Descent to -200', text: 'moved the tail line' },
	{ title: 'Moved Small-letter line to 520', text: 'moved the small-letter line' },
	{ title: 'Moved tail line to -210', text: 'moved the tail line' },
	{ title: 'Set UPM to 2048', text: 'changed the grid size' },
	{ title: 'Set Line gap to 0', text: 'changed the space between lines' },
	{ title: 'Set Overshoot to 10', text: 'changed the guide lines' },
	{ title: 'Set Left side bearing to 40', text: 'moved the left space' },
	{ title: 'Moved My guide to 300', text: 'moved a guide line' },
	{ title: 'Moved baseline', text: 'moved the writing line' },
	{ title: 'Changed font metrics or guides', text: 'changed the guide lines' },
	{ title: 'Dragged x-height', text: 'moved the small-letter line' },

	// Gap fixes
	{ title: 'Nudged kern group kern-3 by -10', context: { project: GAP_PROJECT }, text: 'moved Capital A and Capital V closer' },
	{ title: 'Nudged kern group kern-3 by 10', context: { project: GAP_PROJECT }, text: 'moved Capital A and Capital V apart' },
	{ title: 'Nudged kern group kern-4 by -10', context: { project: GAP_PROJECT }, text: 'moved a gap closer' },
	{ title: 'Nudged kern group kern-3 by -10', text: 'moved a gap closer' },
	{ title: 'Kern group value: 40', text: 'changed a gap fix' },
	{ title: 'Edited kern group: kern-3', text: 'changed a gap fix' },
	{ title: 'Created a new kern group', text: 'added a gap fix' },
	{ title: 'Deleted letter pair AV from 2 kern groups', text: 'removed the gap fix between Capital A and Capital V' },
	{ title: 'Deleted letter pair AV from 1 kern group', text: 'removed the gap fix between Capital A and Capital V' },
	{ title: 'Kern exception for pair AV', text: 'made a gap fix for just one pair' },

	// More tools pages
	{ title: 'Created ligature ff', text: 'made the joined letters ff' },
	{ title: 'Created 3 ligatures', text: 'made 3 sets of joined letters' },
	{ title: 'Created component Bowl', text: 'made a reusable part' },
	{ title: 'Created a component', text: 'made a reusable part' },
	{ title: 'Global action: Flipped (52 items)', text: 'changed all letters' },
	{ title: 'Deleted 26 characters and removed character range: Basic Latin', text: 'removed a letter set and its letters' },
	{ title: 'Cross-project action: from Other Font<br>\n\t\tAdded 2 components', text: 'copied from another font' },
	{ title: 'Cross-project action: from Other Font<br>\n\t\tOverwrote settings for 4 items', text: 'copied from another font' },

	// Anything else
	{ title: 'Something new upstream did', text: 'your last change' },
	{ title: '', text: 'your last change' },
	{ title: 'moved the baseline', text: 'your last change' },
]);
