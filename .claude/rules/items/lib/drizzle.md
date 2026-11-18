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
- no_process_env: the lib never reads process.env; values arrive through the override file
- prepare_fixed: prepare: false stays fixed, never a setting
read: change the pool → Extension | entry and files → API | tests → Verification
