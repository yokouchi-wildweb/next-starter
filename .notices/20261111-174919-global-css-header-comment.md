# DOWNSTREAM NOTICE id:20261111-174919-global-css-header-comment
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T17:49:19+09:00
severity: info
checkpoint: global-css-header-comment
change: The upstream copy of the fork-owned src/styles/global.css loses its long explanatory header comment (stale paths, roles now documented in src/styles/README.md) and starts with a 1-line comment pointing at the README's quick reference and 「ファイルと所有権」, like palette.css / typography.css / overrides.css (notice 20261104-084812-shadow-tokens-style-docs). Every @import line and their order are unchanged. One-time upstream edit of a downstream-owned file (style docs decision D27).
why: upstream writes no explanations into fork-owned files, only pointers; new forks received the stale explanation as is
required_actions:
1. If merging conflicts on src/styles/global.css, keep the fork's version (`git checkout --ours src/styles/global.css`); the upstream side changed only the comment. Optionally replace the fork's old header comment with the same one line.
verify: src/styles/global.css keeps the fork's @import lines in the fork's order; pnpm test src/styles/core/styleTokens.test.mjs passes
manual_steps: -
refs: src/styles/global.css, src/styles/palette.css, src/styles/README.md, .notices/20261104-084812-shadow-tokens-style-docs.md, order 20261111-174757-global-css-header-comment
notes: rendering is unchanged (comment only).
