// Created by: Brennan Meyer with use of Claude Code 09/23/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/14/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
// Created by: Brennan Meyer with use of Claude Code 10/15/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import { makeBackToLettersButton } from '../anyink/mode/back_to_letters.js';
import { isSimpleMode } from '../anyink/mode/mode.js';
import { QUOTE_CLASS } from '../anyink/words/banned.js';
import { escapeWordHTML } from '../anyink/words/word_html.js';
import { word } from '../anyink/words/words.js';
import { getCurrentProjectEditor, getGlyphrStudioApp } from '../app/main.js';
import { addAsChildren, makeElement } from '../common/dom.js';
import logoVertical from '../common/graphics/anyink-wordmark-vertical.svg?raw';
import { TabControl } from '../controls/tabs/tab_control.js';
import { makeNavButton, toggleNavDropdown } from '../project_editor/navigator.js';

/**
 * Page > About
 * Version, credits, and license information for ANY-INK.
 * ANY-INK is a fork of Glyphr Studio v2. The credits and license here are
 * part of honoring its GPL license and must never be removed.
 * @returns {Element} - page content
 */
export function makePage_About() {
	const content = makeElement({
		tag: 'div',
		id: 'app__page',
		innerHTML: `
		<div class="content__page">
			<div class="content-page__left-area">
				<div class="content-page__nav-area">
					${makeNavButton({ level: 'l1', superTitle: 'PAGE', title: 'About' })}
				</div>
				<div id="content-page__panel"></div>
			</div>
			<div class="content-page__right-area"></div>
		</div>
	`,
	});

	// Page Selector
	let l1 = content.querySelector('#nav-button-l1');
	l1.addEventListener('click', function () {
		toggleNavDropdown(l1);
	});

	const rightArea = content.querySelector('.content-page__right-area');
	const tabControl = new TabControl(rightArea);

	tabControl.registerTab('Version', makeVersionInfo);
	tabControl.registerTab('Credits', makeCreditsInfo);
	tabControl.registerTab('License', makeLicenseInfo);

	tabControl.selectTab('Version');

	const panelArea = content.querySelector('#content-page__panel');
	addAsChildren(panelArea, [tabControl.makeTabs()]);
	// ANY-INK (B4 + B5 finalize): a way back to the letters in Simple (principle 7)
	if (isSimpleMode()) panelArea.appendChild(makeBackToLettersButton());

	return content;
}

/**
 * ANY-INK (B4 + B5 finalize, UX-BEGINNER 2.3): in Simple a library's own name is a quote (its
 * makers' spelling: "bezier-boolean", "XMLtoJSON"); All tools shows it as before.
 * @param {String} name
 * @returns {String} HTML
 */
function libraryName(name) {
	if (!isSimpleMode()) return name;
	return `<span class="${QUOTE_CLASS}">${escapeWordHTML(word('about.library', { name }))}</span>`;
}

/**
 * ANY-INK (B4 + B5 finalize): the Glyphr Studio credit; Simple says it in house words.
 * @returns {String} HTML
 */
function glyphrCredit() {
	if (isSimpleMode()) return escapeWordHTML(word('about.builtOn'));
	return `ANY-INK is a personal fork of Glyphr Studio v2, the free web-based font editor
			by Matthew LaGrandeur. The glyph editor, pen and pointer tools, boolean path
			operations, components, ligatures, kerning data, and font import and export
			all come from Glyphr Studio.`;
}

/**
 * Makes content for version info
 * @returns {Element}
 */
function makeVersionInfo() {
	const editor = getCurrentProjectEditor();
	const app = getGlyphrStudioApp();
	const content = makeElement({
		innerHTML: `
			<div class="about-page__logo">
				${logoVertical}
			</div><br><br>
			<h1>Version information</h1>
			<div class="page__card">
				<h3>ANY-INK</h3>
				<label>Version:</label> ${app.anyinkVersion}<br>
				<label>Built on:</label> Glyphr Studio ${app.version}<br>
				<label>Last updated on:</label> ${
					app.versionDate ? new Date(app.versionDate).toDateString() : '[n/a - dev build]'
				}
			</div>

			${
				// ANY-INK (B4 + B5 finalize, UX-BEGINNER 2.4 E): Simple hides the project's id and
				// versions (internal numbers, nothing to act on)
				isSimpleMode()
					? ''
					: `<div class="page__card">
				<h3>This project</h3>
				<label>Project name:</label> ${editor.project.settings.project.name}<br>
				<label>Unique project ID:</label> ${editor.project.settings.project.id}<br>
				<label>Initially created with:</label> Version ${
					editor.project.settings.project.initialVersion
				}
			</div>`
			}
		`,
	});

	return content;
}

/**
 * Makes content for the credits tab: the upstream project and the
 * third-party libraries this app ships with.
 * @returns {Element}
 */
function makeCreditsInfo() {
	const app = getGlyphrStudioApp();
	const content = makeElement({
		innerHTML: `
		<h1>Credits</h1>
		<div class="page__card">
			<h3>Glyphr Studio v2</h3>
			${glyphrCredit()}
			<br><br>
			<a href="https://www.glyphrstudio.com/" target="_blank">glyphrstudio.com</a>
			&nbsp;&middot;&nbsp;
			<a href="https://github.com/glyphr-studio/Glyphr-Studio-2" target="_blank">github.com/glyphr-studio/Glyphr-Studio-2</a>
			<br>
			Forked from release v${app.version}. Copyright © 2010 - 2026 Matthew LaGrandeur.
		</div>

		<br>
		<h2>Libraries</h2>
		<p>ANY-INK includes the following third-party libraries:</p>

		<div class="page__card">
			<h3>${libraryName('Font Flux JS')}</h3>
			Available on
			<a href="https://github.com/mattlag/Font-Flux-JS" target="_blank">GitHub</a>
			and
			<a href="https://www.npmjs.com/package/font-flux-js" target="_blank">NPM</a>.
			<br>
			Licensed under a
			<a href='https://www.gnu.org/licenses/gpl.html' target='_blank'>GNU General Public License</a>.
			<br>
			Copyright © 2026, Matthew LaGrandeur
		</div>

		<div class="page__card">
			<h3>${libraryName('bezier-boolean')}</h3>
			Available on
			<a href="https://github.com/mattlag/bezier-boolean" target="_blank">GitHub</a>
			and
			<a href="https://www.npmjs.com/package/bezier-boolean" target="_blank">NPM</a>.
			<br>
			Licensed under a
			<a href='https://www.gnu.org/licenses/gpl.html' target='_blank'>GNU General Public License</a>.
			<br>
			Copyright © 2026, Matthew LaGrandeur
		</div>

		<div class="page__card">
			<h3>${libraryName('SVG-to-Bézier')}</h3>
			Available on
			<a href="https://github.com/mattlag/SVG-to-Bezier" target="_blank">GitHub</a>
			and
			<a href="https://www.npmjs.com/package/svg-to-bezier" target="_blank">NPM</a>.
			<br>
			Licensed under a
			<a href='https://www.gnu.org/licenses/gpl.html' target='_blank'>GNU General Public License</a>.
			<br>
			Copyright © 2026, Matthew LaGrandeur
		</div>

		<div class="page__card">
			<h3>${libraryName('XMLtoJSON')}</h3>
			Available on
			<a href="https://github.com/mattlag/XMLtoJSON" target="_blank">GitHub</a>
			and
			<a href="https://www.npmjs.com/package/@mattlag/xmltojson" target="_blank">NPM</a>.
			<br>
			Licensed under a
			<a href='https://www.gnu.org/licenses/gpl.html' target='_blank'>GNU General Public License</a>.
			<br>
			Copyright © 2026, Matthew LaGrandeur
		</div>

		<div class="page__card">
			<h3>Potrace</h3>
			Auto-trace turns images into outlines with Potrace, the bitmap tracer by Peter Selinger.
			<br>
			<a href="https://potrace.sourceforge.net/" target="_blank">potrace.sourceforge.net</a>.
			<br>
			Licensed under the
			<a href='https://www.gnu.org/licenses/old-licenses/gpl-2.0.html' target='_blank'>GNU General Public License, version 2 or (at your option) any later version</a>.
			<br>
			Copyright © 2001 - 2019, Peter Selinger
		</div>

		<div class="page__card">
			<h3>${libraryName('esm-potrace-wasm')}</h3>
			Potrace compiled to WebAssembly for the browser, by Thomas Steiner.
			Available on
			<a href="https://github.com/tomayac/esm-potrace-wasm" target="_blank">GitHub</a>
			and
			<a href="https://www.npmjs.com/package/esm-potrace-wasm" target="_blank">NPM</a>.
			<br>
			Licensed under the
			<a href='https://www.gnu.org/licenses/old-licenses/gpl-2.0.html' target='_blank'>GNU General Public License, version 2 or (at your option) any later version</a>.
			<br>
			Copyright © 2021, Thomas Steiner
		</div>
		${brushCredits()}
	`,
	});

	return content;
}

/**
 * ANY-INK (B8 + B9 integration): the Brush's libraries (src/anyink/nib, docs/FACTCHECK_LOG.md).
 * Their license texts, in full, ship beside the app as THIRD-PARTY-NOTICES.txt (src/public), as
 * the BSD licenses ask of a built app.
 * @returns {String} HTML
 */
function brushCredits() {
	const cards = [
		{
			name: 'Clipper2 (clipper2-ts)',
			what: 'Joins the Brush’s round pen marks into one outline. Clipper2 by Angus Johnson; TypeScript port by Jeremy Tribby.',
			link: 'https://github.com/countertype/clipper2-ts',
			license: ['Boost Software License 1.0', 'https://www.boost.org/LICENSE_1_0.txt'],
			copyright: 'Copyright © 2010 - 2025, Angus Johnson',
		},
		{
			name: 'perfect-freehand',
			what: 'Draws the Brush’s live line while the pen is down, by Steve Ruiz.',
			link: 'https://github.com/steveruizok/perfect-freehand',
			license: ['MIT License', 'https://opensource.org/license/mit'],
			copyright: 'Copyright © 2021, Stephen Ruiz Ltd',
		},
		{
			name: '1€ filter (1eurofilter)',
			what: 'Smooths the shake out of a hand-drawn line, by Géry Casiez and Alix Goguey.',
			link: 'https://gery.casiez.net/1euro/',
			license: ['BSD 3-Clause License', 'https://opensource.org/license/bsd-3-clause'],
			copyright: 'Copyright © 2019, Inria',
		},
		{
			name: 'fit-curve',
			what: 'Fits smooth curves through the Brush’s line (Philip J. Schneider’s method).',
			link: 'https://github.com/soswow/fit-curve',
			license: ['MIT License', 'https://opensource.org/license/mit'],
			copyright: 'Copyright © 2014, Volker Poplawski',
		},
		{
			name: 'Simplify.js',
			what: 'Thins out the points of a hand-drawn line, by Vladimir Agafonkin.',
			link: 'https://mourner.github.io/simplify-js/',
			license: ['BSD 2-Clause License', 'https://opensource.org/license/bsd-2-clause'],
			copyright: 'Copyright © 2017, Vladimir Agafonkin',
		},
	];
	const html = cards
		.map(
			(card) => `
		<div class="page__card">
			<h3>${libraryName(card.name)}</h3>
			${card.what}
			<a href="${card.link}" target="_blank">${card.link.replace(/^https:\/\//, '')}</a>.
			<br>
			Licensed under the
			<a href='${card.license[1]}' target='_blank'>${card.license[0]}</a>.
			<br>
			${card.copyright}
		</div>`
		)
		.join('');
	return `${html}
		<p>
			The full license texts of these five are in
			<a href="THIRD-PARTY-NOTICES.txt" target="_blank">THIRD-PARTY-NOTICES.txt</a>.
		</p>`;
}

/**
 * Makes content for license info
 * @returns {Element}
 */
function makeLicenseInfo() {
	const content = makeElement({
		innerHTML: `
		<h1>License</h1>
		<div class="page__card">
			<h3>ANY-INK</h3>
			ANY-INK is licensed under the
			<a href='https://www.gnu.org/licenses/gpl.html' target='_blank'>GNU General Public License, version 3 or later</a>,
			the same license as Glyphr Studio. It is a free / open source 'copyleft' license: you are
			free to use, distribute, and modify this app as long as the license and its freeness stay intact.
			<br><br>
			Glyphr Studio: Copyright © 2010 - 2026 Matthew LaGrandeur<br>
			ANY-INK changes: Copyright © 2026 Brennan Meyer
		</div>

		<br><br>
		<h2>Fonts you create</h2>
		<p>
			Any font you create belongs 100% to you, and you decide how to license it.
		</p>
	`,
	});

	return content;
}
