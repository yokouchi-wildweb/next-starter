# DOWNSTREAM NOTICE id:20261112-124043-agent-terminal-values
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-12T12:40:43+09:00
severity: info
checkpoint: agent-terminal-values
change: scripts/workflow/agent-terminal decides only on generic values - AGENT_TERMINAL=none means the terminal belongs to another tool (the hook records nothing, compactSelf never types), and a new key AGENT_COMPACT_CMD names the command that takes a compactSelf request (the focus in env AGENT_COMPACT_FOCUS; a failure prints the fallback line); the old environment names of the local team tools are read only by one function (lib.mjs legacyHandoff) as the legacy form
why: a shipped tool must not carry the names of one local tool set; a tool that drives the agent's terminal passes these generic values instead, like DEVCHECK_CONTEXT
required_actions: none
verify: pnpm test scripts/workflow/agent-terminal passes
manual_steps: -
refs: scripts/workflow/agent-terminal/README.md (値の約束), scripts/workflow/agent-terminal/lib.mjs (compactHandoff, legacyHandoff, isDrivenByAnotherTool), scripts/workflow/agent-terminal/compactSelf.mjs
notes: behavior is unchanged for a plain session (no values) and for tabs started by today's team tools (the legacy form keeps today's call). A person who exported AGENT_TERMINAL=none sees the same fallback line as before. The legacy form is removed by a later notice once the team tools write AGENT_TERMINAL=none and AGENT_COMPACT_CMD (and read AGENT_COMPACT_FOCUS); nothing for forks to do now
