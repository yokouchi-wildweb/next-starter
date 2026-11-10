# DOWNSTREAM NOTICE id:20261110-154130-explicit-child-check
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T15:41:30+09:00
severity: info
checkpoint: config-explicit-child-check
change: the build gate `pnpm check proxies` also runs src/featureGate/checks/explicitChildren.ts (decision D121): a feature set to true in src/config/featureGate/switches.config.ts whose dependsOn (transitive) is closed by rule values fails the build with 2 fixes (open the parent / remove the child's line) | features not written in switches (upstream defaultEnabled true children) and anyOf are not checked | new ruleList reader explicitlyOpened(), checkExplicitChildren exported from @/featureGate/node | the head comment of src/config/featureGate/switches.config.ts now says "書かない機能は規則のファイルの defaultEnabled(必須)" (was "省略 = 開", stale since notice 20261110-094112-rule-default-explicit)
why: none of the five forks writes switches.config.ts yet, so nothing fails today; once a fork opens a child (e.g. payment: true) while its parent is closed (wallet: false), pnpm build stops instead of leaving the child silently closed
required_actions: none
verify: pnpm check proxies prints "switches で開けた機能 N 件の親 OK"
manual_steps: -
refs: src/featureGate/README.md「門 build の検査」, src/featureGate/checks/explicitChildren.ts, council 20261023-175358-config-redesign decisions D121 L1.44 L1.45, legate:l1 order 47
notes: src/config/featureGate/switches.config.ts is fork-owned after creation: if your copy still says "defaultEnabled(省略 = 開)" in its head comment, change it to "defaultEnabled(必須)" (comment only, values untouched).
