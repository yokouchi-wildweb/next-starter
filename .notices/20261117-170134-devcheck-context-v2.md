# DOWNSTREAM NOTICE id:20261117-170134-devcheck-context-v2
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-17T08:01:34Z
severity: info
checkpoint: devcheck-context-v2
change: devcheck's DEVCHECK_CONTEXT contract goes to v=2 (v=1 still read): auto=<kind,…> = a manual normal kind is auto inside that context only (off / agent.enabled false / the dangerous three / the fixed stops unchanged); plan / run (lib.facts.ts loadSetup) and the PreToolUse hook (hook.mjs) apply it through one function (lib.kinds.mjs applyAuto). run server: the recount and the start are one step under a repo-wide lock (git common dir devcheck-server.lock), so two worktrees starting at once no longer pass dev_max
why: the team tools hand their tabs one context file and may carry the human's override inside a team (the council's decisions D244 / D246); the dev_max count raced with the start
required_actions: none
verify: pnpm test scripts/workflow/devcheck
manual_steps: -
refs: scripts/workflow/devcheck/README.md (種類 server, 文脈の約束), lib.kinds.mjs (applyAuto, contextAutoKinds), lib.ts (parseContext), lib.facts.ts (withRepoLock), lib.exec.ts (server), hook.mjs
notes: without DEVCHECK_CONTEXT nothing changes; a fork's own tool writing v=1 keeps working
