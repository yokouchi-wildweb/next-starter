# DOWNSTREAM NOTICE id:20261112-105826-devcheck-policy-name
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-12T10:58:26+09:00
severity: action-required
checkpoint: devcheck-policy-name
moved: scripts/workflow/devcheck/policy.default.json -> scripts/workflow/devcheck/policy.json
fixes: 20261112-104626-devcheck
change: devcheck's policy files follow the marks rule - the upstream body is plain policy.json and a fork overlays declared keys only with scripts/workflow/devcheck/policy.override.ts (export const override = { kind: "auto" | "manual" | "off" }); the intake row is now policy.override.ts
why: the marks are .default / .replace / .override only; .default is the default of a whole-replacement switch, data is a plain body plus a declared-keys .override.ts. policy.default.json and policy.override.json broke that rule and pnpm workflow ownership who could not name the overlay
required_actions:
1. Only if this fork created scripts/workflow/devcheck/policy.override.json (find it: git ls-files scripts/workflow/devcheck/policy.override.json): write the same keys and values as scripts/workflow/devcheck/policy.override.ts in the form `export const override = { "db-write": "off" };` and delete policy.override.json (git rm). No such file → nothing to do.
verify: pnpm workflow devcheck plan exits 0 and its 方針 line shows the fork's values; pnpm test scripts/workflow/devcheck passes; pnpm workflow ownership check passes
manual_steps: -
refs: scripts/workflow/devcheck/README.md (方針), scripts/workflow/devcheck/lib.ts (loadPolicy, readOverride), src/lib/forkOwnership/intake.txt
notes: an override with a key outside the kinds, a wrong value, no `override` export, or no policy.json beside it stops devcheck with exit 2; an empty override file is the same as none. Upstream never ships policy.override.ts. The earlier notice 20261112-104626-devcheck named policy.override.json; this notice replaces that name
