---
paths:
  - "src/lib/seed/**"
---
# lib/seed
what: types and functions for development / sample seed data written as data in each domain's seed.ts (defineSeed, ref, planSeeds, resolveRow) | entry @/lib/seed | inserted by the runner scripts/runner/seed (pnpm ops db seed)
use: always
change: add = src/features/<domain>/seed.ts of your own domain
rules:
using:
- server_only_data: a seed.ts starts with `import "server-only"` and holds data only
- after_lists_refs: `after` names every domain the seed points to with ref
- unique_for_reuse: rows that must not grow on a rerun carry `$unique` (upstream seeds put it on every row)
- seed_create_for_external: a domain whose create also writes outside the DB (Firebase …) offers `seedCreate` for seeds
- fork_seeds_own_domain: a fork never adds seeds to a core domain; its data goes to its own domain's seed.ts (upstream rows are reachable by ref)
editing:
- no_deps: the lib reads no features, shelf, @/wiring or DB
read: write a seed.ts → Usage | exports → API | stop / skip rules → Internals | tests → Verification
