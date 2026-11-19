---
paths:
  - "src/lib/drizzle/**"
  - "src/config/lib/drizzle.config.ts"
---
# lib/drizzle
what: the PostgreSQL (Neon) client `db`, transaction helpers (runWithTransaction, TransactionClient) and the not-configured check (isDatabaseConfigured, DatabaseNotConfiguredError); closed lib, server-only, entry @/lib/drizzle
use: always
change: placement = src/config/lib/drizzle.config.ts (pool values, @lib-config/drizzle)
rules:
using:
- entry_only: read only through @/lib/drizzle, from server code only
- pool_values: pool values (max, idleTimeout, connectTimeout) are positive integers
editing:
- no_process_env: → core/lib.md closed_lib_env | this lib reads only DATABASE_URL
- prepare_fixed: prepare: false stays fixed, never a setting
read: change the pool → Extension | exports, transactions → API | tests → Verification
