---
paths:
  - "scripts/**"
  - "src/features/**/scripts/**"
  - "**/seed.ts"
  - ".notices/*.mjs"
---
# SCRIPTS (tooling layer)
> part of the CLAUDE.md contract (see CORE_RULES, CODE_PLACEMENT tool_deps): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

definition: scripts/ = tools that build, check and run this framework from outside the app | 4 categories: structure (generators + checkers, every one on a gate) | workflow (development-flow tools) | runner (entries, tests, tasks, seeds, guard) | operations (hand-run operations / inspection) | domain-owned tools (ops commands, migrations, seeds) live in the domain | nothing the app reads at runtime | ref: scripts/README.md
placement: target = one folder scripts/\<category\>/\<target\>/ | action = a file directly in it (`<action>.ts|.mjs`; `*.test.*`, `lib.*` and subfolders are not actions) | pnpm ops / pnpm workflow pick them up, never add a package.json line | fork: a new target folder only, never a file inside an upstream folder (pnpm workflow ownership check) | tests of a running app → tests/ (pnpm e2e)
gates: a checker / generator rides gates by gate.json (check / generate entry file, gates, after, watch, features) | gate list = scripts/runner/gates/gates.json (upstream only) | build / build:post are offline: never reach a DB or an external service | ref: scripts/runner/gates/README.md
write_guard (MANDATORY): every entry that writes a DB / cloud / external starts with guardEntry({ write: true, ... }) (read-only entries write: false, deploys guardDeploy) from scripts/runner/guard, never reads dotenv itself, and is listed in guard.test.ts | default target development, others --env \<stage\>, production = typing production on a TTY or --confirm=production | ref: scripts/runner/guard/README.md
- env files: .env.development + .env.production, each with one APP_ENV=\<stage\> line, separate DBs | personal overrides / secrets = .env.\<stage\>.local (git-ignored) | pnpm ops setup env writes both | ref: src/lib/appEnv/README.md
tasks: src/features/\<domain\>/scripts/tasks/\<kebab\>.ts exporting `task: OneShotTask` (@/lib/task), name = \<domain\>:\<file\> | declare stopKeys(args) when a second run would hurt | usage / validation errors → TaskNotStartedError (failed, no key) | never call runAsSystem (the runner does, requestId = task_runs row id) | ref: src/lib/task/README.md
migrations: src/features/\<domain\>/scripts/migrations/\<kebab\>.ts with notice: "\<id\>", shipped in the notice's commit (uses:), run once (key migration:\<notice\>:\<name\>), deleted later | \<name\>.local.ts = never committed (pnpm check local-migrations), real run only after a dry-run of the same content, the runner writes a journal draft
seed: \<domain\>/seed.ts = defineSeed data only (@/lib/seed), inserted through the domain service (seedCreate first), $unique on rows that must be reused | read only by the seed runner (lint seed-reader) | ref: src/lib/seed/README.md
records: every named pnpm task run and every pnpm ops data write is a task_runs row (kind task / migration / cron / data) | no row → no run | --due is not recorded | unknown = check the data, then pnpm task --resolve \<runId\> succeeded|failed
lint (all tiers error): src-no-scripts | scripts-no-static-wiring (scripts/**, features/**/scripts/**, codemods: @/wiring by import() only) | tools-no-db-write (domain tasks, scripts/operations except operations/db, seed.ts, workflow/dev-admin: no @/lib/drizzle, entities/drizzle, raw sql, drivers; migrations exempt) | seed-reader | a reasoned eslint-disable for a real exception (e.g. a db test closing the pool)
tests: pnpm test [path|--changed|--db] | groups by name: \*.db.test.\* = db, tests/ = fork, else unit | the entry always adds the server-only preload and module mocks (never write them) | other node flags: `// test-flags:` on line 1, allowed list only | a test that spawns node --test drops NODE_TEST_CONTEXT from the child env (else a child failure exits 0) | ref: scripts/runner/test/README.md
