# DOWNSTREAM NOTICE id:20261126-173234-backend-requires-features
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261028-103550-backend-strategy.1 | commit:- (this commit)
date: 2026-11-26T08:32:34Z
severity: info
checkpoint: backend-requires-features
change: a port implementation's declaration (export const declaration in <owner>/plugs/<point>/<name>.ts) may list an optional requiresFeatures: FeatureName[] (gate rule names, literal; omitted = none); pnpm generate extensions and pnpm check extensions stop when a selected implementation's feature is closed, unknown, or the feature states cannot be read, naming two fixes (pnpm ops features set <feature> on / pnpm workflow backend-selection set <port> <other>)
why: an implementation that needs a feature open (e.g. an external auth provider needing the outbox) can say so and the selection check stops a broken selection before deploy; no implementation declares it yet
required_actions: none
verify: pnpm check extensions passes; pnpm test scripts/structure/extensions/select.test.mjs passes
manual_steps: -
refs: src/lib/backends/types.ts (FeatureName, BackendDeclaration.requiresFeatures, exported from @/lib/backends); src/lib/districtMap/declarations.mjs (readBackendDeclaration: optional key, result carries requiresFeatures); scripts/structure/extensions/select.mjs (planSelection); .claude/rules/items/lib/backends.md key requires_features; .claude/rules/core/backends.md selection (selecting point, accepted fork-binding checks); src/lib/backends/README.md; scripts/structure/extensions/README.md; commits 9af4561e0 a3c9a2de2
notes: the forks change nothing: implementation declarations found read-only — TriQ, next-vnx, 88-base none; oripa-do, boardgame-site only the upstream src/lib/mail/plugs/mail/resend.ts / sendgrid.ts (git grep -l 'export const declaration' -- 'src/**/plugs/**'); a fork's own declaration keeps passing (other unknown keys are still refused). Declaring requiresFeatures on the Firebase / Supabase implementations comes later in its own notice with how to open the outbox, the [user-run] db:push and pnpm generate cron. Not a capability name or dependsOn. No core key added or renamed.
