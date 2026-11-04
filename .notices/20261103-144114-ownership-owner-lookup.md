# DOWNSTREAM NOTICE id:20261103-144114-ownership-owner-lookup
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-04T16:20:00+09:00
severity: info
checkpoint: ownership-owner-lookup
resolves: 20261103-144114-ownership-owner-lookup
change: new read-only command `pnpm ownership:who <path...>` (src/lib/forkOwnership/who.mjs, whoCli.mjs) answers per path: owner (tier1 / middle tier <fork_id> / this fork / generated / missing), allowed actions (edit / add / replace / override / none → /order) and the evidence (merge-base, Tier1 version chain, intake row, current diff verdict with permit line draft, own permit line). Folders expand to their files; --json for agents. check.mjs now exposes the shared steps (resolveForkContext, judgeFork, treeSnapshot, reassignMiddleTier) that ownership:check and ownership:who both use; ownership:check output and exit codes are unchanged
why: ownership is decided by git (merge-base, the Tier1 version) since fork-name markers were dropped (D137), which is correct but invisible; a person or an agent can now ask about one file instead of reading the whole check
required_actions: none
verify: `pnpm test:fork-ownership` passes; `pnpm ownership:who src/config` answers with exit 0 (exit 2 = unverified under the same conditions as ownership:check)
manual_steps: -
refs: src/lib/forkOwnership/who.mjs | src/lib/forkOwnership/whoCli.mjs | src/lib/forkOwnership/who.test.mjs | src/lib/forkOwnership/check.mjs | src/lib/forkOwnership/README.md「持ち主を調べる(ownership:who)」 | package.json (ownership:who, test:fork-ownership) | order 20261103-144114-ownership-owner-lookup
notes: package.json gains the ownership:who script line and who.test.mjs in test:fork-ownership; a fork whose package.json changed those lines takes both by merge. The command fetches the direct parent like ownership:check (--no-fetch skips it) and writes no repo file
