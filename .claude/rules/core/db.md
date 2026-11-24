---
paths:
  - "src/domains/**/entities/**"
  - "src/registry/schemaRegistry.ts"
---
# db
> **ROLE**: loaded when writing entities or the schema registry | holds the schema registry, the push round trip and DB identifier rules
> Tier1-owned: forks never edit (gap → /order next-starter)

schema_registry (MANDATORY): src/registry/schemaRegistry.ts = the only push entry (pnpm db:push) | generated whole by pnpm generate registry from every pgTable under src/domains (core and business) | new table → pnpm generate registry + ship .notices with `[user-run] db:push` | unregistered = the table is never created, best-effort writes fail silently
push_roundtrip (MANDATORY when adding / changing an index): `pnpm db:push` (who runs it = the repo.json agent.db_push policy) → `pnpm db:push:check` must report zero statements (a read-only dry run of the DB, not a code check; the agent may run it) | ref: scripts/structure/registry/README.md
- a non-round-trip index = DROP+CREATE on every push = write lock on large tables → never `sql\`${col} DESC\`` (use .desc()), never mix plain columns and sql expressions in one index | push may lock tables → run at maintenance / low traffic
upstream_tables: more data on an upstream domain's records → a table in your own domain (FK to the upstream row), or /order <direct parent> | never a column added to an upstream domain's table (its entities are parent-owned)
seq_scans: a large table read mostly by sequential scans → find it with `pnpm ops db inspect seqscans` (read-only; Neon resets the stats on a compute restart) → add an index for its hot filter, or declare its shared read as cache (src/domains/README.md cache)
db_identifiers: PostgreSQL names ≤ 63 chars | drizzle's auto FK name `{table}_{column}_{reftable}_{refcolumn}_fk` gets truncated and can collide → keep table / column names short, or name the FK: `foreignKey({ name: "shortname_fk", columns: [...], foreignColumns: [...] })`
outbox_rows: a durable external side effect of a DB write is one outbox row written in the same transaction (enqueueOutbox, never a provider call inside the transaction) | its table outbox_jobs is created only while the feature outbox is open | → items/domains/outbox.md
pii_retention: rows holding personal data (IP and the like) carry a per-row retention_days and a daily prune, never kept forever (auditLog, userLoginEvent) | a new prune = an expiryRules item with pii: true (items/lib/cron.md expiry_rules), never its own cron folder
