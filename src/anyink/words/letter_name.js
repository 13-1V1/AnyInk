// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
/**
	Letter names in plain words (UX-BEGINNER 2.2, started in B1, extended in B4).
	  letterName(char)     'small a', 'Capital A', 'number 7', 'question mark', 'space',
	                       'joined letters fi'; '' when there is nothing to name
	  letterPhrase(char)   the same name as it sits inside a sentence: numbers,
	                       punctuation and joined letters take "the" ('the number 7',
	                       'the question mark'); letters never do ('small a')
	  sentenceStart(text)  capitalizes a leading "the" only, so 'small a' keeps its name
	A letter name is always written in full and never uppercased. Unicode names and codes
	never appear: a character this table can't name is called 'the sign §'.
*/

const PUNCTUATION_NAMES = {
	' ': 'space',
	' ': 'no-break space',
	'!': 'exclamation mark',
	'"': 'quotation mark',
	'#': 'hash sign',
	$: 'dollar sign',
	'%': 'percent sign',
	'&': 'ampersand',
	"'": 'apostrophe',
	'(': 'left parenthesis',
	')': 'right parenthesis',
	'*': 'asterisk',
	'+': 'plus sign',
	',': 'comma',
	'-': 'hyphen',
	'.': 'period',
	'/': 'slash',
	':': 'colon',
	';': 'semicolon',
	'<': 'less-than sign',
	'=': 'equals sign',
	'>': 'greater-than sign',
	'?': 'question mark',
	'@': 'at sign',
	'[': 'left square bracket',
	'\\': 'backslash',
	']': 'right square bracket',
	'^': 'caret',
	_: 'underscore',
	'`': 'backtick',
	'{': 'left curly bracket',
	'|': 'vertical bar',
	'}': 'right curly bracket',
	'~': 'tilde',
	'¡': 'upside-down exclamation mark',
	'¿': 'upside-down question mark',
	'¢': 'cent sign',
	'£': 'pound sign',
	'€': 'euro sign',
	'¥': 'yen sign',
	'§': 'section sign',
	'©': 'copyright sign',
	'®': 'registered sign',
	'™': 'trademark sign',
	'°': 'degree sign',
	'×': 'times sign',
	'÷': 'division sign',
	'·': 'middle dot',
	'•': 'bullet',
	'…': 'three dots',
	'–': 'short dash',
	'—': 'long dash',
	'‘': 'left single quote',
	'’': 'right single quote',
	'“': 'left double quote',
	'”': 'right double quote',
	'«': 'left double angle quote',
	'»': 'right double angle quote',
};

/**
 * One string from a character, a string of characters, or a code point number.
 * @param {String | Number} char
 * @returns {String}
 */
function toText(char) {
	if (typeof char === 'number') {
		if (!Number.isInteger(char) || char < 0 || char > 0x10ffff) return '';
		return String.fromCodePoint(char);
	}
	return typeof char === 'string' ? char : '';
}

/**
 * @param {String} c - one character
 * @returns {{name: String, takesThe: Boolean}}
 */
function nameOne(c) {
	if (PUNCTUATION_NAMES[c]) return { name: PUNCTUATION_NAMES[c], takesThe: true };
	if (/^\p{Nd}$/u.test(c)) return { name: `number ${c}`, takesThe: true };
	const lower = c.toLowerCase();
	const upper = c.toUpperCase();
	if (c !== upper && c === lower) return { name: `small ${c}`, takesThe: false };
	if (c !== lower && c === upper) return { name: `Capital ${c}`, takesThe: false };
	if (/^\p{L}$/u.test(c)) return { name: `letter ${c}`, takesThe: true };
	// Nothing to show: control characters, combining marks on their own, invisible formats.
	if (/^[\p{C}\p{M}\p{Z}]$/u.test(c)) return { name: '', takesThe: false };
	return { name: `sign ${c}`, takesThe: true };
}

/**
 * @param {String | Number} char
 * @returns {{name: String, takesThe: Boolean}}
 */
function describe(char) {
	const text = toText(char);
	const chars = [...text];
	if (chars.length === 0) return { name: '', takesThe: false };
	if (chars.length > 1) return { name: `joined letters ${text}`, takesThe: true };
	return nameOne(chars[0]);
}

/**
 * The plain name of a letter.
 * @param {String | Number} char - one character, several (joined letters), or a code point
 * @returns {String} 'small a', 'Capital A', 'number 7', 'question mark'; '' when unnamed
 */
export function letterName(char) {
	return describe(char).name;
}

/**
 * The name as it sits inside a sentence.
 * @param {String | Number} char
 * @returns {String} 'small a', 'Capital A', 'the number 7', 'the question mark'
 */
export function letterPhrase(char) {
	const { name, takesThe } = describe(char);
	if (!name) return '';
	return takesThe ? `the ${name}` : name;
}

/**
 * For a phrase that starts a sentence: 'the question mark' -> 'The question mark'.
 * Letter names are left alone ('small a' stays 'small a').
 * @param {String} text
 * @returns {String}
 */
export function sentenceStart(text) {
	const value = String(text ?? '');
	return value.startsWith('the ') ? `T${value.slice(1)}` : value;
}
