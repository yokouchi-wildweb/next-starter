# DOWNSTREAM NOTICE id:20261103-172638-template-style-comment-paths
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T15:40:00+09:00
severity: info
checkpoint: template-style-comment-paths
resolves: 20261103-172638-template-style-comment-paths
change: Comments in src/config/ui/fonts.config.ts, site-theme.config.ts and variants.config.ts pointed to src/styles/custom/{typography,palette}.css; they now point to the current src/styles/typography.css / src/styles/palette.css. Comments only, no value change. The src/styles/*.css header comments were already current.
why: Every new fork inherited the stale paths and had to repoint them itself (TriQ did at fork-intake-extension-points).
required_actions: none
verify: `git grep "src/styles/custom" -- src` returns nothing; `pnpm test:notices` passes.
manual_steps: -
refs: src/config/ui/fonts.config.ts, src/config/ui/site-theme.config.ts, src/config/ui/variants.config.ts, src/styles/README.md
notes: src/config/ui/*.config.ts are fork-owned after creation, so a fork that edited these files keeps its own text; repointing the same comment lines by hand is optional (comments only).
