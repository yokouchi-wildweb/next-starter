# DOWNSTREAM NOTICE id:20261125-045533-card-receptacle-paths
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-25T04:55:33+09:00
severity: info
checkpoint: card-receptacle-paths
change: pnpm check rules (format) lets a card's paths hold the receptacle places its item declares (`src/**/plugs/<point>/**`, one brace pair for several points; a point the item does not declare is refused) and, in Tier1 only, requires every declared plugs point's place; the 29 Tier1 cards with plugs points carry the line, so they now load where items are written into their points; core/design.md cards frontmatter says the form
why: an item written into an upstream point (plugs/<point>/<name>.ts) now loads the point owner's card and its rules
required_actions: none
verify: `pnpm check rules` passes
manual_steps: -
refs: .claude/rules/core/design.md cards; scripts/workflow/rules/lib.ruleFormat.mjs; scripts/workflow/rules/format.mjs
notes: key table: no key of CLAUDE.md / core / cards renamed or removed (core/design.md cards frontmatter line extended)
