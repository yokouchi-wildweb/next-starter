# DOWNSTREAM NOTICE id:20261022-210000-dc-generate-domain-folder-check
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T21:00:00+09:00
severity: action-required
checkpoint: dc-generate-domain-folder-check
change: `pnpm dc:generate` / `dc:generate:all` now refuse to run (exit 1, nothing written) when a domain folder under src/features/ is not camelCase(domain.json `singular`). `:all` checks every selected domain before generating any. Check: scripts/domain-config/utils/domainFolder.mjs (test: pnpm test:dc-domain-folder).
why: every generator (entities / services / hooks / components / admin routes / registry, and relation imports from other domains) builds paths as `src/features/<camel(singular)>/`. A renamed folder (e.g. oripa-do src/features/namePool/ with singular `name_pool_entry`) made regeneration silently write files into a new `namePoolEntry/` folder, add registry imports to nonexistent paths, and register the service as ADMIN_ONLY because its apiAccess could not be read. Supporting arbitrary folder names across all generators was rejected: the convention is created by dc:init and relied on by every cross-domain import.
required_actions:
1. Merge upstream, then list mismatched domains: `pnpm dc:generate:all --yes` in a throwaway git worktree (it stops before writing if any domain mismatches and prints every one), or run `pnpm test:dc-domain-folder` (its last case checks your src/features/). No mismatch → nothing else to do.
2. For each mismatched domain, rename the folder to the expected name printed in the error: `git mv src/features/<old> src/features/<expected>`. Do NOT change `singular` instead (it changes table names, FK names and the db:push diff).
3. Update imports to the old folder: `grep -rn "@/features/<old>/" src scripts servers` and replace with `@/features/<expected>/` (registry files in src/registry/ included; keep the existing identifiers such as service variable names unless you want to rename them too).
verify: `pnpm test:dc-domain-folder` passes | `npx tsc --noEmit` passes | `grep -rn "@/features/<old>/" src` returns nothing
manual_steps: -
refs: scripts/domain-config/README.md (フォルダ名 = singular の camelCase), src/features/README.md singular row, upstream-request 20261022-112932-dc-generate-domain-folder-name-mismatch
notes: Known affected: oripa-do and pandora `namePool` (singular `name_pool_entry` → expected `namePoolEntry`). Forks whose folders already match see no change. No DB change.
