# DOWNSTREAM NOTICE id:20261022-120000-service-registry-preset-names
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T12:00:00+09:00
severity: action-required
checkpoint: service-registry-preset-names
change: dc:generate's serviceRegistry writer (scripts/domain-config/generator/registry/updateServiceRegistry.mjs) now emits a preset name (ADMIN_ONLY / PUBLIC_READ / ADMIN_OR_DEBUGGER) when a domain's apiAccess deep-equals a preset (undeclared apiAccess → ADMIN_ONLY), and rewrites the `@/config/app/domain-api-access.config` import line in src/registry/serviceRegistry.ts to exactly the names used in the file (dc:delete does the same). Non-preset access is still written as a JSON literal, unchanged. Upstream sampleCategory / sampleTag lines are now `access: PUBLIC_READ`.
why: the generator used to write every access as an expanded JSON literal, which left `PUBLIC_READ` imported but unused (lint warning inherited by every fork) and rewrote hand-written `access: ADMIN_ONLY` lines of apiAccess-undeclared domains into long literals on every regeneration. Runtime behavior is identical (preset ≡ literal); this is about keeping the registry clean.
required_actions:
1. Merge upstream. In src/registry/serviceRegistry.ts take upstream's lines for the preset import and the sample / sampleCategory / sampleTag entries; keep every fork-owned entry and fork-added import as is.
2. Run `pnpm dc:generate:all --yes` once so that every fork domain line is rewritten to the new form (preset name where it matches) and the preset import is trimmed to the names in use. Then revert any changes outside src/registry/serviceRegistry.ts that this run produced only because of pre-existing local drift (inspect `git status`; generated files the fork deliberately hand-edits should have their generateFiles category off already).
3. If src/registry/serviceRegistry.ts still imports a preset name that nothing in the file references (possible only when no dc:generate target domain exists in the fork), remove that name from the import by hand.
verify: `pnpm test:dc-registry` passes | `npx tsc --noEmit` passes | `npx eslint src/registry/serviceRegistry.ts` reports no unused-vars | running `pnpm dc:generate:all --yes` a second time leaves src/registry/serviceRegistry.ts unchanged
manual_steps: -
refs: scripts/domain-config/generator/registry/utils/presetAccess.mjs, scripts/domain-config/generator/registry/updateServiceRegistry.mjs, scripts/domain-config/delete.mjs, scripts/domain-config/README.md (registry section), src/config/app/domain-api-access.config.ts
notes: The line rewrite happens once; after that regeneration is stable (no churn). If a fork adds or changes a preset in src/config/app/domain-api-access.config.ts, mirror it in ACCESS_PRESETS of presetAccess.mjs — test:dc-registry fails on mismatch. Forks: not checked.
