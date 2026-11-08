# DOWNSTREAM NOTICE id:20261108-132256-flux-segment-gate-migration-order
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-08T13:22:56+09:00
severity: info
checkpoint: flux-segment-gate-migration-order
change: /flux states an explicit gate before the next segment (all architecture follow-up applied, data fixes done, checks passed and pushed, anything left only as order: / human: / migration:), and lets the human split a large fork follow-up into a self order: each plan with fork follow-up shows a workload estimate plus one fixed line, the reply `再計画 移行は別の依頼` re-plans without that migration, and after go the order is filed and recorded as `open: <item> | migration:<id>` so the next segment may start
why: the full-apply rule was spread over several sections and not always followed; a too-large migration had no way out other than stopping
required_actions: none
verify: -
manual_steps: -
refs: .claude/skills/flux/SKILL.md (次の区間へ進む条件 / 移行を別の依頼に切り出す) | .claude/skills/fmt/flux-stop.md
notes: /flux reads its skill from the upstream tip, so the gate applies from the next run. Ledger rows may now carry `open: ... | migration:<id>` (an order in the fork's own inbox); ownership:check permits are unchanged
