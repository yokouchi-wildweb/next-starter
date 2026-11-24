# DOWNSTREAM NOTICE id:20261124-200132-claude-md-size-line
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-24T20:01:32+09:00
severity: info
checkpoint: claude-md-size-line
change: pnpm check rules no longer notifies at 38,000 chars for CLAUDE.md and no longer asks the shipping session to file a condense order: only the 40,000 fail line stays (D316); core/design.md size says CLAUDE.md fail 40,000 only, and authoring drops its notify-line sub-line
why: the notify line printed on every check (and in every fork's /flux) while CLAUDE.md is still changing; condensing is decided upstream once it settles
required_actions: none
verify: `pnpm check rules` prints no 知らせ line for CLAUDE.md below 40,000 chars
manual_steps: -
refs: .claude/rules/core/design.md size, authoring; scripts/workflow/rules/lib.ruleSize.mjs; scripts/workflow/rules/size.mjs
notes: key table: no key of CLAUDE.md / core / cards renamed or removed (core/design.md authoring lost one sub-line, size keeps its key) | a fork that filed a condense order to next-starter only because of the old notify line may withdraw it
