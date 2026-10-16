// Created by: Brennan Meyer with use of Claude Code 10/16/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	S1 word set: sketched letters (docs/SKETCH.md, D-047). Every house word, tip, Next line,
	button, canvas label, toast and Undo title the design names. Owner: the S1 words track; later
	S's add their words here. Every entry ships with the 'sketch' flag (features.js; off until S9),
	so no screen, tip or Help line shows a sketch word while it is off.

	A letter's name is {letter} (letterPhrase: 'small n', 'Capital B'); a sentence that starts with
	it keeps its name ('small n leans left.', as checks.js does), so a caller uses
	sentenceStart(letterPhrase(char)). Sizes read in inches on the "1 in capitals" scale
	({width}, {length} are already in inches; {angle} in degrees). No exclamation marks (2.2).

	Keys start with 'sketch.':
	  sketch.rail.heading   the tool column's small heading over the sketch tools (section 2)
	  sketch.tool.*         Line, Arc, Spline, Circle, Rectangle, with their tooltips
	  sketch.tip.*          first-use tips (section 2 Tips; the coach shows them)
	  sketch.tag.*          words at the cursor while snapping (section 6 Hints)
	  sketch.readout.line   a Line part's length and angle at the cursor, never typed
	  sketch.readout.across / .size / .radius   a Circle's size across, an oval's or a
	                        Rectangle's width x height, an Arc's radius, at the cursor
	  sketch.label.*        canvas labels on pieces that make no ink
	  sketch.mirrorLine / sketch.helperLine / sketch.more   the buttons under More
	  sketch.thickness.*    the Thickness slider, its readout and Use on all (section 3)
	  sketch.ends.*         Round / Flat ends (section 3)
	  sketch.card.*         the card on a sketched letter (section 5); S3: Fine-tune's Sketch
	                        part (heading, wayCenter / wayOutline), the Brush's slider there
	                        (brushSize, brushSlider); S3 finalize: a set-aside sketch (setAside,
	                        useAgain; its step sketch.step.usedAgain)
	  sketch.door.*         the empty letter's doors (section 7)
	  sketch.part.*         a part's name ('arch'); sketch.partA.* with its article ('an arch'),
	                        for "Add an arch" (sketch.part.add) and the dropped-part Undo title
	  sketch.where.*        where a missing part runs, for sketch.next.missingPartWhere
	  sketch.next.*         Next line sentences and their buttons (section 7 rules 19-27, Bumpy);
	                        S3 fix pass (door-coach): sketch.next.firstLetter, rule 11's first line
	  sketch.unfinished.*   S3 fix pass (door-coach, board/sketch_unfinished.js): a sketched letter
	                        plainly missing strokes, as "Needs a look" says it, and its tile's short
	                        words (S5's missing-part rule replaces it)
	  sketch.check.bumpy    the Bumpy check's short reason ("Needs a look: bumpy line")
	  sketch.compare.*      Compare's one sentence and its buttons (section 7)
	  sketch.toast.*        toasts (each offers [Undo] through the toast module)
	  sketch.undo.*         the top bar Undo / Redo tooltips while a piece is open
	  sketch.step.*         the Undo titles (section 7): plain titles starting with a small
	                        letter; words/history_text.js maps each back to its key
	  sketch.term.*         the glossary lines (section 7), listed in SKETCH_GLOSSARY, which
	                        core.js's GLOSSARY places right after the brush
	Exports: default (the entries), SKETCH_GLOSSARY, SKETCH_STEPS.
*/

const F = 'sketch';

/** @type {Object<String, Object>} */
const SKETCH = {
	// --------------------------------------------------------------
	// 2. The tools
	// --------------------------------------------------------------
	'sketch.rail.heading': { text: 'Sketch', feature: F },
	'sketch.tool.line': {
		text: 'Line',
		hint: 'Straight lines with corners. Click, click; double-click or Enter to finish.',
		feature: F,
	},
	'sketch.tool.arc': {
		text: 'Arc',
		hint: 'A round curve. From an open end, one click sets where it ends; after a corner, click the end, then how far it bends.',
		feature: F,
	},
	'sketch.tool.spline': { text: 'Spline', hint: 'Fewer points, smoother curve.', feature: F },
	'sketch.tool.circle': {
		text: 'Circle',
		hint: 'Click the center and drag the size. Or click one guide line, then another.',
		feature: F,
	},
	'sketch.tool.rectangle': {
		text: 'Rectangle',
		hint: 'Click one corner, then the other.',
		feature: F,
	},

	'sketch.tip.line': {
		text: 'Click, click. Double-click, right-click or Enter to finish. Drag once for a single line. Pull back over the last end for an arc.',
		feature: F,
	},
	'sketch.tip.spline': { text: 'Fewer points, smoother curve.', feature: F },
	// S2: first-pick tips of the tools SKETCH.md section 2 gives none (its table's own words)
	'sketch.tip.arc': {
		// S3 fix: the bend click sets the arc and the piece stays open for more (critic 15-arc-done)
		text: 'From an open end, one click sets where the arc ends. Or click the start, the end, then how far it bends. Press Enter or double-click to finish.',
		feature: F,
	},
	'sketch.tip.circle': {
		text: 'Click the center and drag the size. Or click one guide line, then another.',
		feature: F,
	},
	'sketch.tip.rectangle': { text: 'Click one corner, then the other.', feature: F },
	'sketch.tip.dots': {
		text: 'Filled dot: stuck to a line or another piece. Hollow: free to move.',
		feature: F,
	},
	'sketch.tip.tailLine': { text: 'tail line: where g, p and y hang to', feature: F },
	'sketch.tip.topLine': { text: 'top line: where b, d, h and l reach', feature: F },

	// Words at the cursor (section 6 Hints); a guide line's own name is core.js's line.*
	'sketch.tag.joins': { text: 'joins', feature: F },
	'sketch.tag.onPiece': { text: 'on the {part}', feature: F },
	'sketch.tag.onCurve': { text: 'on the curve', feature: F },
	'sketch.tag.middle': { text: 'middle', feature: F },
	'sketch.tag.level': { text: 'level', feature: F },
	'sketch.tag.plumb': { text: 'plumb', feature: F },
	'sketch.tag.halfway': { text: 'half-way line', feature: F },
	'sketch.tag.mirror': { text: 'mirror line', feature: F },
	'sketch.tag.letGo': { text: 'let go of the {line}', feature: F },
	'sketch.tag.letGoLevel': { text: 'let go of the level', feature: F },
	// S2 finalize: after the Arc's end click (a fresh Arc, or one after a corner), the next click
	'sketch.tag.bend': { text: 'click to set how far it bends', feature: F },
	'sketch.readout.line': { text: '{length} in, {angle}°', feature: F },
	// S2 fix: Circle, Arc and Rectangle say their size too (never typed)
	'sketch.readout.across': { text: '{size} in across', feature: F },
	'sketch.readout.size': { text: '{width} x {height} in', feature: F },
	'sketch.readout.radius': { text: 'R {radius} in', feature: F },

	'sketch.label.helper': { text: 'helper line', feature: F },
	'sketch.label.gap': { text: 'gap: not filled yet', feature: F },
	// S3 build: the name a built shape is given (only More and All tools' shape list show it)
	'sketch.shapeName': { text: 'Sketch piece {number}', feature: F },

	// Buttons under More (section 2)
	'sketch.more': { text: 'More', feature: F },
	'sketch.mirrorLine': {
		text: 'Mirror line',
		hint: 'Drops a plumb line. Every point you draw on one side gets its twin on the other.',
		feature: F,
	},
	'sketch.helperLine': {
		text: 'Helper line',
		hint: 'Turns the piece dashed and leaves it out of the ink. Press again to ink it.',
		feature: F,
	},

	// --------------------------------------------------------------
	// 3. Thickness and ends
	// --------------------------------------------------------------
	'sketch.thickness.label': {
		text: 'Thickness',
		hint: 'How wide the strokes of this letter are. New sketched letters start at it too.',
		feature: F,
	},
	'sketch.thickness.thin': { text: 'thin', feature: F },
	'sketch.thickness.thick': { text: 'thick', feature: F },
	'sketch.thickness.slider': { text: 'Stroke thickness', feature: F },
	'sketch.thickness.readout': {
		text: '{width} in wide on 1 in capitals',
		hint: 'How wide the stroke is when the capitals are 1 inch tall.',
		feature: F,
	},
	'sketch.thickness.useOnAll': { text: 'Use on all', feature: F },
	'sketch.thickness.justThisOne': { text: 'Just this one', feature: F },
	'sketch.thickness.useOnAllLetters': { text: 'Use this thickness on all letters', feature: F },
	'sketch.thickness.rebuilding': { text: 'Rebuilding letters...', feature: F },

	'sketch.ends.label': {
		text: 'Ends',
		hint: 'How the open ends of the strokes finish: round like a marker, or cut flat.',
		feature: F,
	},
	'sketch.ends.round': { text: 'Round', feature: F },
	'sketch.ends.flat': { text: 'Flat', feature: F },
	'sketch.ends.thisEnd': { text: 'This end', feature: F },

	// --------------------------------------------------------------
	// 5. The card on a sketched letter
	// --------------------------------------------------------------
	'sketch.card.point': { text: 'Point', feature: F },
	'sketch.card.piece': { text: 'Piece', feature: F },
	'sketch.card.smooth': { text: 'Smooth', hint: 'The curve flows through this point.', feature: F },
	'sketch.card.corner': {
		text: 'Corner',
		hint: 'The line turns sharply at this point.',
		feature: F,
	},
	'sketch.card.delete': { text: 'Delete', feature: F },
	'sketch.card.letItFlow': {
		text: 'Let it flow',
		hint: 'Lets go of the direction you set, so the curve flows through on its own again.',
		feature: F,
	},
	'sketch.card.redraw': {
		text: 'Redraw this piece',
		hint: "Draw a new one with any sketch tool. It takes this piece's place and keeps its joins.",
		feature: F,
	},
	'sketch.card.fewerPoints': {
		text: 'Fewer points',
		hint: 'Smooths the piece with about half the points. Press again until it is clean.',
		feature: F,
	},
	'sketch.card.centerline': {
		text: 'Centerline',
		hint: 'This piece is the middle of a stroke.',
		feature: F,
	},
	'sketch.card.outline': {
		text: 'Outline',
		hint: 'This loop is an edge of the letter.',
		feature: F,
	},
	'sketch.card.closeFirst': { text: 'Close it first', feature: F },
	'sketch.card.insideLoop': {
		text: 'Inside loop',
		hint: 'Drag inward to add a loop a set wall inside this one. It follows when you change this one.',
		feature: F,
	},
	'sketch.card.wall': { text: 'wall {width} in', feature: F },
	'sketch.card.makeOutline': {
		text: 'Make it an outline',
		hint: 'Turns every stroke into loops that look the same, so you can make parts thinner.',
		feature: F,
	},
	'sketch.card.showCenterline': { text: 'Show where the centerline was', feature: F },
	'sketch.card.hideCenterline': { text: 'Hide where the centerline was', feature: F },
	'sketch.card.editSketch': { text: 'Edit sketch', feature: F },
	'sketch.card.newer': { text: 'This sketch was made by a newer ANY-INK.', feature: F },
	'sketch.card.setAside': {
		text: 'The sketch is set aside. The shapes are your own now.',
		feature: F,
	},
	'sketch.card.useAgain': {
		text: 'Use the sketch again',
		hint: 'Builds the ink from the sketch again. Your changes to its shapes go.',
		feature: F,
	},
	// S3: Fine-tune's Sketch part (sketch/card_section.js): its title and the letter's way
	'sketch.card.heading': { text: 'Sketch', feature: F },
	'sketch.card.wayCenter': {
		text: 'Sketched down the middle of each stroke.',
		hint: 'The thickness builds the ink around the lines you sketched.',
		feature: F,
	},
	// S3 fix: the Brush's slider on a sketched letter says it sizes new Brush strokes, so it never
	// reads as a second Thickness (critic 54-fine-tune.png)
	'sketch.card.brushSize': {
		text: 'Size of new Brush strokes',
		hint: 'How wide the Brush draws from now on. The sketch keeps its own Thickness.',
		feature: F,
	},
	'sketch.card.brushSlider': { text: 'Size of new Brush strokes', feature: F },
	'sketch.card.wayOutline': {
		text: 'Sketched as its outline. Loops inside are holes.',
		hint: 'Each closed loop is an edge of the letter.',
		feature: F,
	},

	// --------------------------------------------------------------
	// 7. The empty letter's doors and Parts
	// --------------------------------------------------------------
	'sketch.door.sketchIt': { text: 'Sketch it', feature: F },
	'sketch.door.sketchItLine': {
		text: 'Lines, arcs and splines down the middle of the stroke, then pick a thickness',
		feature: F,
	},
	'sketch.door.outline': { text: 'or sketch the outline instead', feature: F },
	'sketch.door.moreWays': { text: 'More ways', feature: F },
	'sketch.door.brush': {
		text: 'Draw with the brush (freehand; you can clean it up after)',
		feature: F,
	},
	'sketch.door.parts': { text: 'Start from a part:', feature: F },

	'sketch.part.stem': { text: 'stem', feature: F },
	'sketch.part.bowl': { text: 'bowl', feature: F },
	'sketch.part.arch': { text: 'arch', feature: F },
	'sketch.part.bar': { text: 'bar', feature: F },
	'sketch.part.dot': { text: 'dot', feature: F },
	'sketch.partA.stem': { text: 'a stem', feature: F },
	'sketch.partA.bowl': { text: 'a bowl', feature: F },
	'sketch.partA.arch': { text: 'an arch', feature: F },
	'sketch.partA.bar': { text: 'a bar', feature: F },
	'sketch.partA.dot': { text: 'a dot', feature: F },
	'sketch.part.add': { text: 'Add {part}', feature: F },
	'sketch.where.archToRight': {
		text: "from the stem's top to the writing line on the right",
		feature: F,
	},

	// --------------------------------------------------------------
	// 7. The Next line (rules 19-27) and the Bumpy check
	// --------------------------------------------------------------
	// S3 integration: rule 8's empty-letter line with 'sketch' on names the door's [Sketch it]
	'sketch.next.empty': { text: '{letter} is empty. Sketch it.', feature: F },
	'sketch.next.emptyPhoto': {
		text: '{letter} is empty. Sketch it, or use a photo of it.',
		feature: F,
	},
	'sketch.next.pieceOpen': {
		text: 'Finish the line: double-click, press Enter, or click the first point to close it.',
		feature: F,
	},
	'sketch.next.done': { text: 'Done', hint: 'Finishes the line (Enter).', feature: F },
	'sketch.next.outlineGap': {
		text: 'The outline of {letter} has a gap. Click its first point to close it.',
		feature: F,
	},
	'sketch.next.closeIt': { text: 'Close it', hint: 'Joins the two ends with a line.', feature: F },
	'sketch.next.loopCrosses': {
		text: 'A loop on {letter} crosses itself. Drag a point to untangle it.',
		feature: F,
	},
	'sketch.next.loose': {
		text: '{count|A point|# points} of {letter} {count|is|are} loose.',
		hint: 'A hollow dot near a guide line. Drag it onto the line to stick it there.',
		feature: F,
	},
	'sketch.next.showMe': { text: 'Show me', feature: F },
	'sketch.next.missingPart': { text: '{letter} still needs its {part}.', feature: F },
	'sketch.next.missingPartWhere': {
		text: '{letter} still needs its {part}, {where}.',
		feature: F,
	},
	'sketch.next.looksDone': { text: 'Looks done to me', feature: F },
	'sketch.next.thickness': {
		text: 'Pull the thickness until {letter} matches the gray guide letter.',
		feature: F,
	},
	'sketch.next.looksGood': { text: 'Looks good', feature: F },
	'sketch.next.thicknessForAll': {
		text: 'Use this thickness on all {count} sketched letters?',
		feature: F,
	},
	'sketch.next.outlineTeach': {
		text: "Now drag a loop's inside to make some parts thinner.",
		feature: F,
	},
	'sketch.next.bumpyBrush': {
		text: 'The stroke on {letter} is bumpy. Make it a sketch you can fix point by point.',
		feature: F,
	},
	'sketch.next.firstLetter': {
		text: 'Start by sketching {letter}, or write your letters on paper and take one photo of the page.',
		feature: F,
	},
	'sketch.unfinished.narrow': {
		text: '{letter} looks unfinished: it is much narrower than the gray guide letter.',
		feature: F,
	},
	'sketch.unfinished.short': {
		text: '{letter} looks unfinished: it is much shorter than the gray guide letter.',
		feature: F,
	},
	'sketch.unfinished.tipLooks': { text: 'looks unfinished', feature: F },
	'sketch.unfinished.tipDot': { text: 'needs its dot', feature: F },
	'sketch.next.bumpySketch': {
		text: 'A line on {letter} is bumpy. Use fewer points to smooth it.',
		feature: F,
	},
	'sketch.next.makeSketch': {
		text: 'Make it a sketch',
		hint: 'Turns the stroke into a few points you can drag, with the same thickness.',
		feature: F,
	},
	'sketch.check.bumpy': {
		text: 'bumpy line',
		hint: 'The line wobbles back and forth instead of flowing.',
		feature: F,
	},

	// Compare (section 7): one sentence names the biggest difference
	'sketch.compare.lower': { text: 'The {part} sits lower than the {line}.', feature: F },
	'sketch.compare.higher': { text: 'The {part} sits higher than the {line}.', feature: F },
	'sketch.compare.shorter': { text: "The {part} is shorter than the guide's.", feature: F },
	'sketch.compare.taller': { text: "The {part} is taller than the guide's.", feature: F },
	'sketch.compare.narrower': { text: "The {part} is narrower than the guide's.", feature: F },
	'sketch.compare.wider': { text: "The {part} is wider than the guide's.", feature: F },
	'sketch.compare.leansLeft': { text: '{letter} leans left.', feature: F },
	'sketch.compare.leansRight': { text: '{letter} leans right.', feature: F },
	'sketch.compare.sides': {
		text: 'The two sides of {letter} are different sizes.',
		feature: F,
	},
	'sketch.compare.close': { text: '{letter} is close to the guide letter.', feature: F },
	'sketch.compare.seeInWords': {
		text: 'See it in words',
		hint: 'Shows your letter between its neighbors in Try it.',
		feature: F,
	},

	// --------------------------------------------------------------
	// Toasts and the Undo tooltips while a piece is open
	// --------------------------------------------------------------
	'sketch.toast.cantKeepBoth': {
		text: "Can't keep both: a point of {letter} let go of the {line}.",
		feature: F,
	},
	// S4: a later drag rule moved a point off the piece it was on
	'sketch.toast.cantKeepPiece': {
		text: "Can't keep both: a point of {letter} came off its piece.",
		feature: F,
	},
	'sketch.toast.insideLoopFree': {
		text: 'The inside loop of {letter} is on its own now.',
		feature: F,
	},
	'sketch.toast.setAside': {
		text: "{letter}'s sketch is set aside. Your changes to the shapes are kept.",
		feature: F,
	},
	'sketch.toast.pointDeleted': { text: 'Deleted a sketch point of {letter}.', feature: F },
	'sketch.toast.pieceDeleted': { text: 'Deleted a piece of {letter}.', feature: F },
	// S4: Delete on a pick of several
	'sketch.toast.pointsDeleted': { text: 'Deleted {count} sketch points of {letter}.', feature: F },
	'sketch.toast.piecesDeleted': { text: 'Deleted {count} pieces of {letter}.', feature: F },
	'sketch.toast.undo': { text: 'Undo', feature: F },
	'sketch.undo.takeBack': { text: 'Take back the last point', feature: F },
	'sketch.undo.finishFirst': { text: 'Finish the line first', feature: F },

	// --------------------------------------------------------------
	// Undo titles (section 7): one step each; plain, starting with a small letter
	// --------------------------------------------------------------
	'sketch.step.line': { text: 'sketched a line on {letter}', feature: F },
	'sketch.step.arc': { text: 'sketched an arc on {letter}', feature: F },
	'sketch.step.spline': { text: 'sketched a spline on {letter}', feature: F },
	'sketch.step.circle': { text: 'sketched a circle on {letter}', feature: F },
	'sketch.step.rectangle': { text: 'sketched a rectangle on {letter}', feature: F },
	// S2 finalize: a 1-point piece (Enter on one point, or a double-click in place)
	'sketch.step.dot': { text: 'put a dot on {letter}', feature: F },
	'sketch.step.closed': { text: 'closed the outline of {letter}', feature: F },
	'sketch.step.pointMoved': { text: 'moved a sketch point on {letter}', feature: F },
	'sketch.step.bent': { text: 'bent a curve on {letter}', feature: F },
	'sketch.step.lineMoved': { text: 'moved a line on {letter}', feature: F },
	'sketch.step.aimed': { text: 'aimed a curve on {letter}', feature: F },
	'sketch.step.flow': { text: 'let a curve flow on {letter}', feature: F },
	'sketch.step.smooth': { text: 'made a point smooth on {letter}', feature: F },
	'sketch.step.corner': { text: 'made a point a corner on {letter}', feature: F },
	'sketch.step.pointAdded': { text: 'added a sketch point on {letter}', feature: F },
	'sketch.step.pointDeleted': { text: 'deleted a sketch point on {letter}', feature: F },
	'sketch.step.pieceDeleted': { text: 'deleted a piece of {letter}', feature: F },
	'sketch.step.partMoved': { text: 'moved part of {letter}', feature: F },
	'sketch.step.partResized': { text: 'resized part of {letter}', feature: F },
	'sketch.step.circleResized': { text: 'resized a circle on {letter}', feature: F },
	'sketch.step.nudged': { text: 'nudged sketch points on {letter}', feature: F },
	'sketch.step.thickness': { text: 'changed the thickness of {letter}', feature: F },
	'sketch.step.endsRound': { text: 'made the ends round on {letter}', feature: F },
	'sketch.step.endsFlat': { text: 'made the ends flat on {letter}', feature: F },
	'sketch.step.endRound': { text: 'made one end round on {letter}', feature: F },
	'sketch.step.endFlat': { text: 'made one end flat on {letter}', feature: F },
	'sketch.step.outline': { text: 'made {letter} an outline', feature: F },
	'sketch.step.pieceOutline': { text: 'made a piece an outline on {letter}', feature: F },
	'sketch.step.pieceCenterline': { text: 'made a piece a centerline on {letter}', feature: F },
	'sketch.step.insideLoop': { text: 'added an inside loop to {letter}', feature: F },
	'sketch.step.fromBrush': { text: 'made Brush stroke {number} a sketch', feature: F },
	'sketch.step.redrew': { text: 'redrew a piece of {letter}', feature: F },
	'sketch.step.fewerPoints': { text: 'used fewer points on {letter}', feature: F },
	'sketch.step.mirrorAdded': { text: 'added a mirror line to {letter}', feature: F },
	'sketch.step.mirrorRemoved': { text: 'removed the mirror line from {letter}', feature: F },
	'sketch.step.helperMade': { text: 'made a helper line on {letter}', feature: F },
	'sketch.step.helperInked': { text: 'inked a helper line on {letter}', feature: F },
	'sketch.step.droppedPart': { text: 'dropped {part} on {letter}', feature: F },
	'sketch.step.thicknessAll': { text: 'set the thickness for every sketched letter', feature: F },
	'sketch.step.setAside': { text: "set {letter}'s sketch aside", feature: F },
	'sketch.step.usedAgain': { text: "used {letter}'s sketch again", feature: F },

	// --------------------------------------------------------------
	// Glossary lines (section 7), in SKETCH_GLOSSARY's order
	// --------------------------------------------------------------
	'sketch.term.sketch': {
		text: 'sketch',
		hint: 'The lines, arcs and curves a letter is built from. The ink is rebuilt from it every time you change it.',
		like: 'A SolidWorks sketch before the feature',
		pro: 'skeleton, construction geometry',
		feature: F,
	},
	'sketch.term.line': {
		text: 'Line',
		hint: 'A straight part of a sketch. Click, click; corners where it turns.',
		like: 'The Line tool in SolidWorks',
		pro: 'line segment',
		feature: F,
	},
	'sketch.term.arc': {
		text: 'Arc',
		hint: 'A round part of a sketch, a piece of a circle.',
		like: 'A tangent arc in SolidWorks',
		pro: 'circular arc, bulge',
		feature: F,
	},
	'sketch.term.spline': {
		text: 'Spline',
		hint: 'A smooth curve through the points you click. Fewer points, smoother curve.',
		like: 'A through-point spline in SolidWorks',
		pro: 'Hobby spline, cubic curve',
		feature: F,
	},
	'sketch.term.circle': {
		text: 'Circle',
		hint: 'A round loop from its center and size. Shift while dragging makes it an oval.',
		like: 'The Circle tool in SolidWorks',
		pro: 'circle, ellipse',
		feature: F,
	},
	'sketch.term.rectangle': {
		text: 'Rectangle',
		hint: 'A closed loop of four lines, from one corner to the other.',
		like: 'A corner rectangle in SolidWorks',
		pro: 'corner rectangle',
		feature: F,
	},
	'sketch.term.centerline': {
		text: 'Centerline',
		hint: 'Sketch the middle of each stroke; the thickness builds the ink around it.',
		like: 'A sweep along a sketch with a round profile',
		pro: 'skeleton, stroke, sweep',
		feature: F,
	},
	'sketch.term.outline': {
		text: 'Outline',
		hint: 'The letter drawn as its outside line; loops inside are holes. See-through only changes how the screen shows it.',
		like: 'A closed profile before an extrude',
		pro: 'outline, closed profile',
		feature: F,
	},
	'sketch.term.seeThrough': {
		text: 'See-through',
		hint: 'Shows your shapes as thin lines instead of filled in. It changes only the screen, never the letter.',
		like: 'Wireframe view',
		pro: 'outline view, keyline',
		feature: F,
	},
	'sketch.term.thickness': {
		text: 'Thickness',
		hint: 'How wide the strokes are. One thickness per letter, so its strokes match.',
		like: 'The diameter of a ball end mill',
		pro: 'stroke weight, nib size',
		feature: F,
	},
	'sketch.term.ends': {
		text: 'Ends',
		hint: 'How a stroke stops: Round like a marker, or Flat, cut straight across.',
		like: 'A ball end mill or a flat end mill',
		pro: 'line cap, terminal',
		feature: F,
	},
	'sketch.term.round': {
		text: 'Round',
		hint: 'An end that finishes in a half circle.',
		like: 'The mark a felt-tip marker leaves',
		pro: 'round cap',
		feature: F,
	},
	'sketch.term.flat': {
		text: 'Flat',
		hint: 'An end cut straight across. On a guide line it is cut along the line.',
		like: 'A saw cut',
		pro: 'butt cap',
		feature: F,
	},
	'sketch.term.mirrorLine': {
		text: 'Mirror line',
		hint: 'A plumb line down the letter. Draw one side and the other side follows.',
		like: 'Dynamic Mirror in SolidWorks',
		pro: 'symmetry line, mirror axis',
		feature: F,
	},
	'sketch.term.helperLine': {
		text: 'Helper line',
		hint: 'A dashed piece that guides you and never makes ink.',
		like: 'Construction geometry in SolidWorks',
		pro: 'construction line',
		feature: F,
	},
	'sketch.term.insideLoop': {
		text: 'Inside loop',
		hint: 'A loop a set wall inside another one, like the hole of an o. It follows the outer loop.',
		like: 'Offset Entities in SolidWorks',
		pro: 'inner offset, inset loop',
		feature: F,
	},
	'sketch.term.wall': {
		text: 'wall',
		hint: 'How far an inside loop sits inside its outer loop.',
		like: 'Wall thickness of a shelled part',
		pro: 'offset distance',
		feature: F,
	},
	'sketch.term.piece': {
		text: 'piece',
		hint: 'Lines and curves drawn in one go, end to end, until you finish.',
		like: 'One chain of sketch entities',
		pro: 'sketch chain, open or closed path',
		feature: F,
	},
	'sketch.term.dots': {
		text: 'filled and hollow dots',
		hint: 'Filled dot: stuck to a line or another piece. Hollow: free to move. Green: picked.',
		like: 'Black and blue sketch entities in SolidWorks',
		pro: 'fully defined, under defined',
		feature: F,
	},
	'sketch.term.grip': {
		text: 'grip',
		hint: 'Drag the diamond to turn the curve at a point, the arrow to pull it, the circle for both.',
		like: 'Spline handles in SolidWorks',
		pro: 'tangent handle, tension',
		feature: F,
	},
	'sketch.term.bend': {
		text: 'bend',
		hint: 'Drag a curve itself to bow it. An arc keeps its ends and gets rounder or flatter.',
		like: 'Pulling a flexible ruler',
		pro: 'curve drag, bend tool',
		feature: F,
	},
	'sketch.term.loose': {
		text: 'loose',
		hint: 'A hollow point near a guide line. Drag it onto the line to stick it there.',
		like: 'An under-defined sketch point',
		pro: 'unconstrained point',
		feature: F,
	},
	'sketch.term.joins': {
		text: 'joins',
		hint: 'A point that is stuck to the end of another piece, so the two move together.',
		like: 'A coincident relation',
		pro: 'coincident, merge points',
		feature: F,
	},
};

/** The glossary lines, in Help's order; core.js puts them right after the brush. */
export const SKETCH_GLOSSARY = Object.freeze([
	'sketch.term.sketch',
	'sketch.term.line',
	'sketch.term.arc',
	'sketch.term.spline',
	'sketch.term.circle',
	'sketch.term.rectangle',
	'sketch.term.centerline',
	'sketch.term.outline',
	'sketch.term.seeThrough',
	'sketch.term.thickness',
	'sketch.term.ends',
	'sketch.term.round',
	'sketch.term.flat',
	'sketch.term.mirrorLine',
	'sketch.term.helperLine',
	'sketch.term.insideLoop',
	'sketch.term.wall',
	'sketch.term.piece',
	'sketch.term.dots',
	'sketch.term.grip',
	'sketch.term.bend',
	'sketch.term.loose',
	'sketch.term.joins',
]);

/** Every Undo title key, sorted (history_text.js maps titles back to these). */
export const SKETCH_STEPS = Object.freeze(
	Object.keys(SKETCH)
		.filter((key) => key.startsWith('sketch.step.'))
		.sort()
);

export default SKETCH;
