# DOWNSTREAM NOTICE id:20261120-111721-coffee-break-unified-compact
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-20T11:17:21+09:00
severity: info
checkpoint: coffee-break-unified-compact
hotfix: team tools (D343 auto compact) start typing /coffee-break into team tabs; a workspace without this skill gets no automatic compact until it takes this in
change: Compacting has one way: new skill /coffee-break (pnpm workflow agent-terminal compactPlan → write the handoff file → compactSelf); after the compact the SessionStart hook reads the per-session handoff file back once and deletes it, whatever AGENT_TERMINAL is. New contract AGENT_COMPACT_CONTEXT (v=1, prepare=, then=) and AGENT_COMPACT_HANDOFF for tools that run sessions. The shortcut coffee-break line in .claude/rules/shortcuts.md is removed (the skill replaces it).
why: Two compact mechanisms (a shortcut line plus a personal hook in plain sessions, and the team tool's own save → /compact flow) are merged into one; team tools build on the same flow.
required_actions:
1. Find the fork's own references to the removed shortcut or to running compactSelf directly: `git grep -n -E 'coffee-break|compactSelf' -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items' .claude/skills ':!.claude/skills/coffee-break'` → rewrite each to /coffee-break. None → nothing to do.
verify: `ls .claude/skills/coffee-break/SKILL.md` exists; `pnpm test scripts/workflow/agent-terminal/agentTerminal.test.mjs` passes; `pnpm workflow agent-terminal compactPlan` prints a handoff: line inside a Claude Code session.
manual_steps: -
refs: .claude/skills/coffee-break/SKILL.md, scripts/workflow/agent-terminal/README.md (compactPlan, 引き継ぎの一時ファイル, 圧縮の文脈ファイル)
notes: A personal SessionStart hook that kept a handoff elsewhere (e.g. ~/.claude/hooks/compact-handoff.py) is no longer needed; remove it from your own settings if you had one.
