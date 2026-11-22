# DOWNSTREAM NOTICE id:20261122-192910-gate-closed-tables-stay
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-22T19:29:10+09:00
severity: info
checkpoint: gate-closed-tables-stay
fixes: 20261110-173039-tier1-close-addons
resolves: 20261118-113817-gate-closed-tables-drop-wording
change: wording only, no behavior change. pnpm db:push never proposes a DROP for a closed feature's tables: the schema gate (src/featureGate/node/gatedSchema.ts applySchemaGate, used by push.ts and check-schema-roundtrip.ts) removes them from both sides of the push (the pgTables from the code side, `!<table>` from the DB side), so a missing table is not created, an existing one stays with its data, and while closed its schema changes are not applied (reopening applies them at the next push). Two texts said otherwise and are corrected: notice 20261110-173039-tier1-close-addons (verify "pnpm db:push:check proposes no DROP of the fork's tables" and manual_steps "with an empty switch a closed feature's tables would be proposed for DROP" — there is no such DROP; read the risk of running db:push before its step 3 as: the tables of a feature the fork uses stop receiving schema changes until it is reopened) and src/featureGate/Internals.md (the upstream development section on FEATURE_GATE_OPEN=all), now stating the real behavior
why: the wrong warning made forks and their downstream treat db:push after that checkpoint as a data-loss risk and agents report a DROP risk that does not exist (measured in oripa-do: db:push:check skips 7 gated tables, 5 of them existing, and proposes no DROP)
required_actions: none
verify: -
manual_steps: -
refs: src/featureGate/Internals.md (スキーマゲート「仕組み」, 上流の開発の約束) | src/featureGate/node/gatedSchema.ts
notes: the one path where drizzle proposes DROP TABLE is a table removed from the code (schemaRegistry) while still in the DB, not a closed feature | a middle tier that relayed 20261110-173039-tier1-close-addons with the same warning corrects its own relay (oripa-do: 20261118-102317-relay-tier1-close-addons) | a temporary permit citing the resolved order expires with this notice
