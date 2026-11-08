# DOWNSTREAM NOTICE id:20261109-073800-domain-delete-gate-override
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T07:38:00+09:00
severity: info
checkpoint: domain-delete-gate-override
change: pnpm generate domain -- --delete <Domain> --confirm <snake> --remove-config on a closable domain (domain.json closable: true) now also removes its override src/config/features/<camel>.config.ts and its gate rule src/featureGate/rules/<camel>.ts (both listed before deleting); the rule is removed only when it still equals what the generator writes, a hand-edited rule is kept and reported (remove it by hand, exit 1) | a delete that keeps domain.json (no --remove-config, regenerate later) keeps the rule and the override | the rule and the override no longer count as "code that still imports the domain" for the delete stop | new gateLeftovers in scripts/structure/domain/pipeline/remove/index.mjs
why: before, deleting a closable domain left the rule (typecheck fails on its missing config import) and an override without owner (pnpm check config-overrides fails); the delete also stopped on the rule's import of the domain config
required_actions: none
verify: pnpm test scripts/structure/domain/tests/deleteStop.test.mjs
manual_steps: -
refs: scripts/structure/domain/README.md, scripts/structure/domain/pipeline/remove/index.mjs, scripts/structure/domain/cli/delete.mjs, council 20261023-175358-config-redesign decisions L1.20 L1.27, legate:l1 order:36
notes: after a delete that removed a rule, run pnpm generate extensions (the rule list) as the command prints. | forks that already deleted a closable domain by hand need nothing.
