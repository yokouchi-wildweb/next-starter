# DOWNSTREAM NOTICE id:20261104-084812-shadow-tokens-style-docs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:48:12+09:00
severity: info
checkpoint: shadow-tokens-style-docs
change: Layout appearance shadows (raised / outlined / frosted / soft / radiant) now read tokens --appearance-shadow-<name> defined in _base/palette.defaults.css (:root / .dark, same values as before); src/styles/README.md is rewritten (2 principles, layer map, quick reference "what to change → which file", win order, what tokens move); .claude/rules/core/style.md gains the part-building duties; the upstream copies of the root palette.css / typography.css / overrides.css are reduced to a 1-line comment pointing at the README.
why: A fork can now change card shadows in palette.css like colors, without touching core. The README states the contract for fork CSS: target only [data-slot] marks and :root / .dark / [data-area] values (id, class names, data-component and DOM shape are not a contract). Rendering is unchanged.
required_actions:
1. If merging conflicts on src/styles/palette.css, src/styles/typography.css or src/styles/overrides.css, keep the fork's version (`git checkout --ours <file>`); the upstream side is only a comment. Removing the old long upstream comment from the fork's version is optional.
verify: pnpm typecheck passes; pnpm test:style-tokens passes; grep -n "rgba" src/components/Layout/appearance.ts finds nothing
manual_steps: -
refs: src/styles/_base/palette.defaults.css, src/components/Layout/appearance.ts, src/styles/README.md, .claude/rules/core/style.md, docs/journal/2026-11-04--next-starter--styles-readme-history.md
notes: Optional for forks: a fork that restyled Layout appearance shadows with className or overrides.css can move the values to palette.css (`:root { --appearance-shadow-raised: ... }`, `.dark { ... }`). The radiant shadow token is computed on <html>, so it follows --primary set on :root / .dark / [data-area], but not --primary set on a deeper element (previously the utility followed it on that element too). The README's both-list (main, page-title, sec-title, admin-sec-title) names elements whose data-slot marks are added in a later step; until then those selectors match nothing. Forks not checked.
