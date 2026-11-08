# DOWNSTREAM NOTICE id:20261109-073132-features-set-override
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T07:31:32+09:00
severity: info
checkpoint: features-set-override
change: pnpm ops features set <rule> on|off now writes the override of an owner that composes one: when the rule reads <X>_CONFIG.enabled from @/features/<d>/config and that config.ts imports @/config/features/<name>.config, it writes `enabled: true|false` directly under `export default { … }` of src/config/features/<name>.config.ts (adds it when missing, rewrites it when present; always writes the value, also when it equals the default; type lines, other keys and satisfies stay) | owners without an override keep the old path (the literal enabled in config.ts) | other shapes still print where the value is read and exit 2 | new helpers readOverrideFile / rewriteOverrideEnabled in src/featureGate/node/setEnabled.ts
why: the note of notice 20261108-191005-config-common-c1 ("pnpm ops features set cannot write a domain whose config.ts composes an override, write enabled by hand") no longer applies: today pnpm ops features set sampleDomain off writes src/config/features/sample.config.ts
required_actions: none
verify: pnpm ops features set sampleDomain off then pnpm ops features list shows sampleDomain 閉 (set it back with on; it then writes enabled: true) | FEATURE_GATE_CHECK=all pnpm test src/featureGate
manual_steps: -
refs: src/featureGate/README.md, src/featureGate/node/setEnabled.ts, scripts/operations/features/set.ts, src/config/README.md, council 20261023-175358-config-redesign decisions L1.20 L1.26, legate:l1 order:35
notes: a fork that already wrote `enabled: false` into src/config/features/sample.config.ts by hand (C1 step 2) needs nothing; set rewrites that same key. | db:push is still yours after opening a feature with tables.
