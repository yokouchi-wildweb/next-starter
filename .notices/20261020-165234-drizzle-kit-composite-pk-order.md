# DOWNSTREAM NOTICE id:20261020-165234-drizzle-kit-composite-pk-order
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:52:34+09:00
severity: action-required
checkpoint: drizzle-kit-composite-pk-order
change: patches/drizzle-kit@0.31.8.patch gains a 4th fix (api.js / api.mjs / bin.cjs): composite primary key columns are read in PK definition order (pg_constraint.conkey) instead of the unordered information_schema join. Also: `pnpm db:push` / `db:push:check` print gated tables as one line `FeatureGate によるスキップ: N テーブル` instead of listing every table name.
why: on PostgreSQL 18 drizzle-kit read composite PK columns alphabetically, so every push ran `ALTER TABLE "analytics_daily_rollups" DROP CONSTRAINT "analytics_daily_rollups_pk"` + ADD CONSTRAINT for a PK that was already correct (rebuilds the PK index and locks the table each push; the old CLI push did the same silently because it did not print SQL). PostgreSQL 17 and older were not affected. drizzle-kit 0.31.11 still has the bug.
required_actions:
1. Merge upstream. On a conflict in patches/drizzle-kit@0.31.8.patch or the patchedDependencies hash in pnpm-lock.yaml take upstream's version (forks must not carry their own drizzle-kit patch edits; report needs with /upreq).
2. Run `pnpm install` so the patch is re-applied to node_modules/drizzle-kit.
verify: `grep -c "next-starter patch" node_modules/drizzle-kit/api.js` prints 4; `pnpm db:push:check` shows no `DROP CONSTRAINT "analytics_daily_rollups_pk"` (on PostgreSQL 18 it did before).
manual_steps: -
refs: scripts/registry/README.md (drizzle-kit へのパッチ, item 4), patches/drizzle-kit@0.31.8.patch
notes: Read-only change to how push compares schemas; no DB statement is needed. On PostgreSQL 17 or older nothing changes visibly. boardgame-site (PostgreSQL 18.6): checked — upstream's patched pushSchema no longer proposes the PK statement against its development DB. Other forks: not checked.
