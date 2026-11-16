# DOWNSTREAM NOTICE id:20261116-114820-agent-terminal-explicit-values
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-16T02:48:20Z
severity: info
checkpoint: agent-terminal-explicit-values
change: agent-terminal no longer reads team marker env names (legacyHandoff / isDrivenByAnotherTool removed); AGENT_TERMINAL only means the session uses tmux; the after-compact line gets a third value none (compactSelf --then none, new action pnpm workflow agent-terminal afterCompact) and the hand-off passes AGENT_COMPACT_THEN; mailbox.mjs reads team markers in one place (teamIssuer, from: and taken_by alike); peer README / tests drop TK_TEAM
why: a session driven by another tool is now told only by explicit values (AGENT_TERMINAL=tmux, AGENT_COMPACT_CMD, the after mark); a tool that still sets only its own marker names gets the plain-session behaviour (pane record, tmux guide, the continue line after a manual /compact)
required_actions: none
verify: pnpm test scripts/workflow/agent-terminal scripts/workflow/peer .claude/skills/order/mailbox.test.mjs
manual_steps: -
refs: scripts/workflow/agent-terminal/README.md (値の約束, 圧縮の後の 1 行), scripts/workflow/agent-terminal/afterCompact.mjs, .claude/skills/order/mailbox.mjs teamIssuer
notes: the team tools (~/.team) that pass AGENT_TERMINAL=tmux / AGENT_COMPACT_CMD and write the after mark ship with their switch; until a fork's team tools do, their tabs in that fork behave as plain sessions after taking this. Removed exports: legacyHandoff, isDrivenByAnotherTool (a fork importing them → use compactHandoff / readAgentTerminal)
