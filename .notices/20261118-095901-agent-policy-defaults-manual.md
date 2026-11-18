# DOWNSTREAM NOTICE id:20261118-095901-agent-policy-defaults-manual
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.1 | commit:e16346d25
date: 2026-11-18T00:59:01Z
severity: action-required
checkpoint: team-asks-policy-defaults
change: devcheck policy defaults when repo.json has no agent.* key are now manual for every normal kind (server, browser, login, db_write, db_delete, env_add, test, check, peer; was auto) and for the dangerous three (db_push, env_production, deploy; was off, an unknown value stays off); /quest and /ship notice:council now say a bound caravan party's segment notice carries quest material (written by its Convoy from the party's own draft); /flux says a team tool's member tab never asks the human in that tab
why: a fork with no policy written should run nothing without the human's one-time permit; the agent behaviour of forks without agent.* keys changes silently (checks now ask /allow each time)
required_actions:
1. Decide this fork's policy and write it: `/repo-policy` (or `pnpm workflow repo-json set agent.<kind> auto|manual|off` per kind, `agent.db_push|env_production|deploy` = manual|off). Nothing written → every kind runs only after /allow or the human's words. Upstream's repo.json agent.* lines are next-starter's own policy; repo.json is a self-owned file (taken from this fork's own version on merge), so they do not reach this fork.
2. No code change needed for /quest, /ship or /flux: the skill texts arrive with the merge (notice:council keeps its name; under a team tool's tab /flux raises approvals, questions, [user-run] steps and /allow through the team's lead).
verify: `pnpm workflow devcheck plan` shows each kind with the value you chose (manual for every key you left out); `cat repo.json` shows your own agent.* lines only
manual_steps: -
refs: scripts/workflow/devcheck/lib.kinds.mjs (agentPolicyOf), scripts/workflow/devcheck/README.md (方針), .claude/skills/quest/SKILL.md, .claude/skills/quest/convoy.md, .claude/skills/ship/SKILL.md, .claude/skills/flux/SKILL.md, repo.json
notes: segment team-asks-policy-defaults of build b1 (council 20261106-194813-tooling-ownership-and-growth). The devcheck tests that assumed the old defaults (auto / off) are aligned before this build ships.
