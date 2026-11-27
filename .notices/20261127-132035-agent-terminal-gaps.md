# DOWNSTREAM NOTICE id:20261127-132035-agent-terminal-gaps
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:bc15406d4
date: 2026-11-27T13:20:35+09:00
severity: info
checkpoint: agent-terminal-gaps
change: /intervene and `pnpm workflow agent-terminal type`: a team lead's relay that quotes the user's words is a permit (as /allow, D433); the permit ends at the next human input, so after picking a target the run starts again from the permit (the old text said the permit was kept). `pnpm workflow agent-terminal compactPlan` no longer exits 3 when the conversation id is unknown: it prints `handoff: none(…)` and goes on, and /coffee-break skips writing the handoff then. compactSelf writes then=continue into the handoff head when the user types the /compact itself (fallback). scripts/workflow/agent-terminal/README.md now names the in-tool defaults (waiter 12 h cap, Enter delays 300 / 500 ms, empty text refused, AGENT_COMPACT_CMD waited without a time limit). lib.mjs no longer re-exports existsSync
why: the tools and their written rules disagreed, and a missing conversation id stopped a compact that needed nothing from it (research tooling.ns-cluster3 Q3, D493)
required_actions: none
verify: -
manual_steps: -
refs: scripts/workflow/agent-terminal/type.mjs, scripts/workflow/agent-terminal/compactPlan.mjs, scripts/workflow/agent-terminal/compactSelf.mjs, scripts/workflow/agent-terminal/lib.mjs, scripts/workflow/agent-terminal/README.md, .claude/skills/intervene/SKILL.md, .claude/skills/coffee-break/SKILL.md
notes: The compactPlan output lines keep their form (handoff: / prepare: / then: / typed by: / next:). Kept as decided: /coffee-break never compacts on the agent's own judgment. Fork-specific impact: not checked.
