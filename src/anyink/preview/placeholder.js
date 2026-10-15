// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	The sentence on an empty preview sheet (the strip and the Overview, both modes; B4 + B5 fix
	pass). Which one fits depends on what is typed and what shows:
	  - nothing typed (or only spaces)       strip.nothingToShow  "Type something to see your
	                                                               letters here."
	  - typed, but no made letter on the     strip.lettersNotMade "Your letters show here as you
	    sheet (not made yet, or past its                           make them."
	    edge at a big type size)
	  - a made letter on the sheet           '' (no sentence)
	A letter is made when it has a shape; it is on the sheet when the layout placed it there
	(TextBlock charData.isVisible).

	  placeholderKey(text, textBlock)   -> a words key, or ''
*/

/**
 * @param {String} text - the text being previewed
 * @param {{data: Array<Array<Object>>} | null | undefined} textBlock - its layout (TextBlock)
 * @returns {'' | 'strip.nothingToShow' | 'strip.lettersNotMade'}
 */
export function placeholderKey(text, textBlock) {
	if (!String(text ?? '').trim()) return 'strip.nothingToShow';
	return hasMadeLetterShowing(textBlock) ? '' : 'strip.lettersNotMade';
}

/**
 * @param {{data: Array<Array<Object>>} | null | undefined} textBlock
 * @returns {Boolean} true when a letter with a shape is placed on the sheet
 */
function hasMadeLetterShowing(textBlock) {
	const blocks = Array.isArray(textBlock?.data) ? textBlock.data : [];
	return blocks.some(
		(block) =>
			Array.isArray(block) &&
			block.some((charData) => charData?.isVisible && charData.item?.shapes?.length > 0)
	);
}
