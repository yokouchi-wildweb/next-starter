# DOWNSTREAM NOTICE id:20261108-205554-http-default-timeout
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-08T20:55:54+09:00
severity: action-required
checkpoint: http-default-timeout
resolves: 20261104-164647-app-wide-http-default-timeout
change: new closed lib src/lib/httpDefaults = one setting `timeoutMs` (default null = no timeout, today's behaviour) read through @lib-config/httpDefaults from the new upstream empty override src/config/lib/httpDefaults.config.ts | a request interceptor on the default axios instance adds that timeout only to client calls that have none (unset or 0); per-call timeouts win (CRUD's 60 s); calls marked `defaultTimeout: false` (new typed AxiosRequestConfig field) are skipped — CRUD's bulk*, replaceByQuery and duplicate carry it | axios.defaults and axios.create instances are untouched, server fetch is out of scope, no retries | registered once by the client part HttpDefaultsRoot inside src/wiring/AppProviders.tsx
why: forks can now set one value for every client axios call without its own timeout; oripa-do's interim src/lib/httpDefaults collides with the new upstream lib of the same name
required_actions:
1. Merge upstream up to this checkpoint. Every fork: src/config/lib/httpDefaults.config.ts arrives empty (no change in behaviour). To use a default timeout write `export default { timeoutMs: 30_000 } satisfies HttpDefaultsOverride;` there (keep its import type line).
2. oripa-do only (interim from the order): take upstream's src/lib/httpDefaults as is (on the add/add conflict in src/lib/httpDefaults/index.ts take upstream's file), delete src/lib/httpDefaults/HttpDefaultsProvider.tsx, remove the HttpDefaultsProvider import and wrapper from src/app/_providers/ForkProviders.tsx (keep its other providers), remove the `src/lib/httpDefaults` line from your own section of src/lib/CATALOG.md (upstream's section now has it), and write `export default { timeoutMs: 30_000 } satisfies HttpDefaultsOverride;` into src/config/lib/httpDefaults.config.ts to keep today's 30 s.
3. Fork client calls that must stay unbounded (long uploads, exports through the default axios) → add `defaultTimeout: false` to that call's config, only if you set timeoutMs.
4. `pnpm generate district-map`, `pnpm check lib-package`, `pnpm check config-overrides`.
verify: pnpm typecheck | pnpm test src/lib/httpDefaults | git grep -n "HttpDefaultsProvider" -- src prints nothing | pnpm check lib-package | pnpm check config-overrides
manual_steps: -
refs: src/lib/httpDefaults/README.md, src/lib/errors/README.md, src/lib/crud/client/apiClientFactory.ts, src/wiring/AppProviders.tsx, council 20261023-175358-config-redesign decision D62, legate:l1 order:29, order 20261104-164647-app-wide-http-default-timeout
notes: oripa-do's interim (HEAD at writing): src/lib/httpDefaults/{index.ts,HttpDefaultsProvider.tsx} with 30 s, used from src/app/_providers/ForkProviders.tsx, CATALOG line in its own section. Other forks have no such files. | The interceptor attaches to the default axios instance only, so axios.create instances (e.g. lib/storage's direct GCS transfer) never get the limit.
