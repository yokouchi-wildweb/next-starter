# DOWNSTREAM NOTICE id:20261109-125507-config-base-override-folder
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T12:55:07+09:00
severity: info
checkpoint: config-base-override-folder
change: src/config gains a 5th folder rule: featureGate/ = overrides of the src-root base src/featureGate (council D91), files named by their content (e.g. switches.config.ts, placed later by the gate council; upstream ships none yet) | pnpm check config-overrides checks it: owner fixed to src/featureGate, flat, only <name>.config.ts and README.md, no missing check (BASE_OVERRIDE_FOLDERS in src/lib/districtMap/kinds.mjs) | the override lints config-overrides/literal-only and owner-reads-only also cover src/config/featureGate/*.config.ts (readable only from files inside src/featureGate) | the lint gate-rule-owner/one-district-config (warn, added by config-common-c1) is removed with eslint-rules/gate-rule-owner.mjs: feature switches go to the gate rule files and featureGate/switches.config.ts (D92), so a rule no longer has to read one district's config.ts | src/config/README.md describes the 5 folders and the base override rule
why: the C1 notice said the one-district-config warnings would become errors later and fork rules would have to move their values: that no longer happens (pnpm lint drops those warnings); the new folder is ready for the gate council's switches file
required_actions: none
verify: pnpm lint shows no gate-rule-owner warnings | pnpm check config-overrides
manual_steps: -
refs: src/config/README.md, scripts/structure/config-overrides/README.md, eslint-rules/config-overrides.mjs, src/featureGate/README.md, council 20261023-175358-config-redesign decisions D91 D92 L1.29 L1.30 L1.31, legate:l1 order:37
notes: supersedes the "one-district-config warnings ... error later" line in the notes of notice 20261108-191005-config-common-c1. | if a fork disabled or configured gate-rule-owner rules in eslint.config.fork.mjs, delete those lines (the plugin is gone).
