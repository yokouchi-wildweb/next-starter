---
paths:
  - "src/features/**/entities/**"
  - "src/registry/schemaRegistry.ts"
---
# db
> **ROLE**: loaded when writing entities or the schema registry | holds the schema registry, the push round trip and DB identifier rules
> Tier1-owned: forks never edit (gap → /order <direct parent>)

schema_registry (MANDATORY): src/registry/schemaRegistry.ts = the only push entry (pnpm db:push) | generated whole by pnpm generate registry from every pgTable under src/features (core and business) | new table → pnpm generate registry + ship .notices with `[user-run] db:push` | unregistered = the table is never created, best-effort writes fail silently
push_roundtrip (MANDATORY when adding / changing an index): `pnpm db:push` (who runs it = repo.json agent.db_push: off = the user, manual = /allow dbp) → `pnpm db:push:check` must report zero statements (read-only dry run, the agent may run it) | ref: scripts/structure/registry/README.md
- a non-round-trip index = DROP+CREATE on every push = write lock on large tables → never `sql\`${col} DESC\`` (use .desc()), never mix plain columns and sql expressions in one index | push may lock tables → run at maintenance / low traffic
db_identifiers: PostgreSQL names ≤ 63 chars | drizzle's auto FK name `{table}_{column}_{reftable}_{refcolumn}_fk` gets truncated and can collide → keep table / column names short, or name the FK: `foreignKey({ name: "shortname_fk", columns: [...], foreignColumns: [...] })`
