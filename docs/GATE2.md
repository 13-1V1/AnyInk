# Gate 2: your first font, start to finish

About 30 minutes. This is the real test of ANY-INK: can someone who has never made a font get
his handwriting into Word without help? You are that someone. The automated run (9.4) has passed;
only you can tell us how it feels, and only your PC can answer the Windows and Word questions at
the end.

The full rules are in `docs/UX-BEGINNER.md` section 9. This page is the short version.

## Before you start (10 minutes, the day before is fine)

1. **Get the newest ANY-INK.** Either:
   - the live site, https://13-1v1.github.io/AnyInk/ (it updates a few minutes after the B16 work is
     pushed to GitHub), or
   - on this PC: `npm run build`, then `npm run preview`, and open the address it prints.
   Open it with **no** `?ui=...` on the end. It should open on the start screen ("Make a new font").
2. **Use a fresh Chrome profile** (Chrome menu > your profile icon > Add > Continue without an
   account). That way nothing from earlier tests is remembered.
3. **Write the letters.** On plain white paper, with a black felt-tip pen, write **B r e n a H d**
   in one row: about 1 inch tall, about a finger's width apart.
4. **Photograph it** with your phone, straight on, in good light. Send it to the PC so it sits in
   **Downloads** as a JPEG. (iPhone: Settings > Camera > Formats > Most Compatible makes JPEGs.)
5. **Make sure Word is installed** and closed.
6. Have someone sit beside you to read the task cards and keep time, or read them yourself and
   use a stopwatch. The helper reads each card once, then stays quiet. If you ask for help, the
   helper notes it and gives the smallest hint possible.

## The tasks, in order

Read each card, do it, stop the clock when you think it's done.

| # | Task card | You're done when | Time limit |
|---|---|---|---|
| T1 | "Make a new font called Brennan Hand." | You see the letter board and the top bar says "Saved" | 1:00 |
| T2 | "Make the capital B from your photo." | B says "Ready" on the board | 3:00 |
| T3 | "Make the rest of the letters in your photo." | r, e, n, a, H and d all say "Ready" (or you pressed "Looks fine to me") | 4:00 |
| T4 | "Draw a small o yourself." | small o has ink, drawn with the Brush | 3:00 |
| T5 | "Type Brennan Hand and check that it looks right." | Try it shows "Brennan Hand" in your letters, none touching | 1:30 |
| T6 | "One gap looks too wide. Make it closer." | You dragged one gap closer | 1:30 |
| T7 | "Undo that, then put it back." | The gap went back, then came back again | 0:30 |
| T8 | "Get your font into Word and type your name." | Word lists "Brennan Hand Test 1" and "Brennan Hand" types in your letters | 5:00 |
| T9 | "Close ANY-INK. Open it again and get back to your font." | You're back on the board with your letters | 0:30 |

The limits add up to 20 minutes. Under 20 total is a pass; 20 to 30 means one more round of fixes;
over 30 means a screen needs rethinking.

**T10, the crash test (the helper does this part, about 2 minutes):**
- *No work file:* start a new font, press Cancel in the save box, trace one letter, wait 10
  seconds. Open Chrome's Task Manager (Shift+Esc), pick the ANY-INK tab, press End process. Open
  ANY-INK again. The start screen should offer the unsaved work, and [Continue with it] brings the
  letter back.
- *With a work file:* in Brennan Hand, change a letter, wait 10 seconds, end the process the same
  way, open again. Either the crash card brings the change back, or [Continue] opens the font with
  the change already in it.

## What to watch for

The helper writes down:
- every pause longer than about 10 seconds,
- every wrong click (one that leads away from the task and needs Back or Undo),
- every "what does this mean?",
- the time for each task.

It passes when:
- you asked for help **zero** times,
- there were **3 or fewer** wrong clicks in total,
- every time you stopped, the screen showed one green button, or the "Next:" line named what to do,
- you saw no font jargon (no "glyph", "kerning", "bearing" and the like) on the main path,
- in Word your name types with no letters overlapping, all sitting on one line.

**Afterwards, two questions:**
1. "How lost did you feel, from 1 (never) to 5 (totally)?" A pass is 2 or lower.
2. "Would you use this to make the rest of the alphabet?" A pass is yes.

## Only your PC can answer these

ANY-INK can't install fonts or click inside Word, so these were checked against Microsoft's own
pages but never seen happen (`docs/FACTCHECK_LOG.md` section 8). During T8, please notice:

1. **Installing the font.** Double-click "BrennanHand-Test1.otf" in your My Fonts folder. Does a
   preview window open with an **Install** button, and where is the button? If you right-click
   instead, is "Install" there, or only under "Show more options"? (8.3, 8.5)
2. **Word finds it.** After installing, close Word completely and open it again. Is "Brennan Hand
   Test 1" in Word's font list? If not, try right-click > Show more options > "Install for all
   users" (Windows may ask for your OK). (8.6, 8.7, 8.8)
3. **Gap fixes in Word.** In Word press Ctrl+D, open the "Advanced" tab, tick "Kerning for fonts".
   Does the e|n gap you fixed in T6 look closer in Word than with the box unticked? (8.9, 8.12)
4. **Set As Default.** In the same box, press "Set As Default" and choose "All documents based on
   the Normal template". Open a new blank document: is "Kerning for fonts" still ticked? (8.11)
5. **A new test font.** Make one more font file (Use in Word again: it will be "Test 2"), install
   it, restart Word. Does Word show Test 2 with your newest letters, and is Test 1 still there? If
   you install Test 1 again over itself, does Word keep showing the old letters? (8.14)
6. **Tall letters.** Type your H, d and B large (72 pt). Is the top of any letter cut off? Draw a
   letter with a long tail (a g or y) with the Brush, make a new test font, and check its bottom
   isn't cut off either. (8.19)
7. **Missing letters.** Type a letter you haven't made yet, like "z". Does Word show it in
   another font, or as an empty box? (8.18)
8. **Brush strokes.** Your small o was drawn with the Brush, which can leave overlapping shapes.
   Does it look solid in Word, with no white gaps where strokes cross? (8.20)
9. **Closing for real.** In T9, close Chrome with the window's X right after a change. Does the
   crash card show when you open it again? (The automated check could only close Chrome the way a
   test program does.)

## Afterwards

The results go into `docs/TEST_LOG.md` (9.5): the date, the build, each task's time and notes,
help requests, wrong clicks, your two answers, and the answers to the nine PC questions above.
Anything that failed becomes a fix, and that task is tried again.
