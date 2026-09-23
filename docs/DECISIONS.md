# ANY-INK — Decisions log

Every significant decision, with the options considered and the strongest objection.
Newest at the bottom.

## D-001: Keep upstream's internal identifiers; rename only what a user sees
**Decided:** 09/23/2026
**Argued by:** Producer (rename everything for a clean brand) vs. Architect (rename only visible text)
**Options considered:** full rename of classes/functions/keys | visible strings only
**Chose:** visible strings only. `GlyphrStudioApp`, `GlyphrStudioProject`, `getGlyphrStudioApp`,
the `GlyphrStudio` localStorage key, and project-file keys keep their upstream names.
**Because:** the brief says "no visible Glyphr branding" and "keep upstream as a remote so fixes
merge cleanly". Renaming identifiers would touch hundreds of lines and make every upstream merge a
conflict, for no user-visible gain.
**Strongest objection:** code readers see "Glyphr" everywhere. Mitigated by the CLAUDE.md note.
**Revisit if:** upstream goes dormant and merges stop mattering.

## D-002: Keep the upstream version number for file compatibility; add `anyinkVersion`
**Decided:** 09/23/2026
**Argued by:** Architect (compatibility) vs. Producer (a fresh 0.1.0 everywhere)
**Options considered:** replace `version` with ANY-INK's own | keep both
**Chose:** `app_config.json` keeps `version` = upstream Glyphr Studio version (2.10.5) and gains
`anyinkVersion` (0.1.0). The About page shows both.
**Because:** project files record the app version that saved them and the loader refuses files from
a "future" version. A fresh 0.1.0 would refuse every existing `.gs2` file saved by upstream.
**Strongest objection:** two version numbers can confuse. Mitigated by showing "Built on Glyphr
Studio 2.10.5" only on About.
**Revisit if:** the project file format diverges enough that upstream files need a migration step anyway.

## D-003: Where the Glyphr Studio credit lives
**Decided:** 09/23/2026
**Options considered:** credit on every page | About page only | About + one line on landing/Help
**Chose:** About page has Credits and License tabs (full credit, upstream links, library list).
The landing page has one sentence ("Built on Glyphr Studio v2 ... under the GPL"). The Help page
keeps one link to the upstream help site because those articles still document the shared editor.
Donation buttons, socials, blog links, the "family of products" tab, and the support email are removed.
**Because:** the brief wants no Glyphr branding except credits and license, and a GPL fork owes
clear attribution. One line on landing and one link in Help is attribution, not branding.
**Strongest objection:** purists would remove the Help link too. Kept because Brennan benefits
from upstream's docs for pen/pointer/component features that ANY-INK does not re-document.

## D-004: Do not track `dist/`; use LF line endings everywhere
**Decided:** 09/23/2026
**Chose:** `dist/` is ignored (GitHub Pages will build it). `.gitattributes` forces LF and marks
binaries; `core.autocrlf` is off for this repo.
**Because:** upstream commits `dist/`, which adds 4 MB of churn per commit and guarantees merge
conflicts. The original Windows checkout was CRLF, which broke every multi-line edit until normalized.
**Strongest objection:** merging upstream will show `dist/` as modify/delete conflicts. Resolve with
`git rm -r dist` each time.

## D-005: Project file name is just the project name
**Decided:** 09/23/2026
**Chose:** Save suggests `MyFont.gs2` instead of `MyFont - Glyphr Studio Project.gs2`. Backups
still append a date stamp. The `.gs2` extension stays so upstream files open unchanged.
**Because:** shorter, and the extension already identifies the file type.
