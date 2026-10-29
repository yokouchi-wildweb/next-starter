# DOWNSTREAM NOTICE id:20261029-202403-notice-resolves-field
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-29T20:24:03+09:00
severity: info
checkpoint: notice-resolves-field
change: Notices gain an optional `resolves: <order id>, ...` field: upstream writes it when the shipped change resolves orders a downstream repo filed in its inbox (always for downstream orders, with an info notice if nothing else needs one). `pnpm ownership:check` now collects `resolves:` from the base's .notices/ and .notices/done/ and expires temporary permits whose upreq ids are all resolved (expired-resolved). /ship writes the field, /flux lists incoming `resolves:` that match the fork's own permits, `pnpm test:notices` checks its form.
why: Temporary permits (.fork-ownership/<fork-id>.permits.txt) must end when the upstream request they wait on is done; this is how the fork learns it.
required_actions: none
verify: `pnpm test:notices` passes.
manual_steps: -
refs: .notices/README.md「解決(resolves)」, src/lib/forkOwnership/README.md「一時許可」, .claude/skills/ship/SKILL.md, .claude/skills/flux/SKILL.md
notes: A fork that is itself an upstream (mid tier) writes `resolves:` the same way when it ships orders from its own downstream. Rejected orders are not written as resolves (see /wen).
