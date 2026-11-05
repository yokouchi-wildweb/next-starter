# DOWNSTREAM NOTICE id:20261105-191948-gate-features-tableless-domains
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T19:19:48+09:00
severity: info
checkpoint: gate-features-tableless-domains
change: feature-gate rule `features:` now accepts any folder at a domain position (src/features/core/<name> or src/features/<name>), including domains with 0 pgTable (tables: []); a nested path (e.g. core/wallet/entities) or `core` alone now stops extensions:generate with "ドメインの位置でない"
why: the old test ("the folder has a pgTable") blocked table-less domains such as the Firestore core/chatRoom; the check's job is catching a wrong folder name, so it now tests the domain position instead
required_actions:
1. Run `pnpm extensions:check`. If it stops with `features の "<folder>" はドメインの位置でない`, rewrite that entry of the named src/featureGate/rules/<name>.ts to the domain folder that holds it (core/<name> or <name>), then `pnpm extensions:generate`. Otherwise nothing to do.
verify: pnpm extensions:check passes and FEATURE_GATE_CHECK=all pnpm test:feature-gate passes
manual_steps: -
refs: scripts/extensions/derive/featureTables.mjs | scripts/proxies/proxyFrame.test.mjs | src/featureGate/checks/dependencies.test.mjs | src/featureGate/README.md | order 20261105-190546-gate-features-allow-tableless-domains
notes: a table-less domain gets the /api/<key> paths from its domainEntry.ts as before and is covered by the folder-caller dependency check. The route-import and always-on entry checks in featureGate.test.mjs still only look at rules with tables (unchanged). No upstream rule changed.
