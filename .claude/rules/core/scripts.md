---
paths:
  - "scripts/**"
  - "src/domains/**/scripts/**"
  - "**/seed.ts"
  - ".notices/*.mjs"
  - "eslint-rules/**"
  - "tests/**"
---
# scripts
> **ROLE**: loaded when writing scripts, domain scripts, seeds | holds the scripts placement and rules
> Tier1-owned: forks never edit (gap → /order next-starter) | extends CODE_PLACEMENT tool_deps

definition: scripts/ = tools that build, check and run this framework from outside the app | 4 categories: structure (generators + checkers, every one on a phase) | workflow (development-flow tools) | runner (entries, tests, tasks, seeds, guard) | operations (hand-run operations / inspection) | domain-owned tools (ops commands, migrations, seeds) live in the domain
- nothing the app reads at runtime | ref: scripts/README.md
placement: target = one folder scripts/\<category\>/\<target\>/ | action = a file directly in it (`<action>.ts|.mjs`; `*.test.*`, `lib.*` and subfolders are not actions) | pnpm ops / pnpm workflow pick them up, never add a package.json line | fork: a new target folder only, never a file inside an upstream folder (pnpm workflow ownership check) | tests of a running app → tests/e2e/ (pnpm e2e)
phases: a checker / generator rides phases by phase.json (check / generate entry file, gates, after, watch, features) | phase list = scripts/runner/phases/phases.json (upstream only) | build / build:post are offline: never reach a DB or an external service | build runs no tests (the gate tests of proxies ride ship only; Vercel's build has no .git) | ref: scripts/runner/phases/README.md
write_guard (MANDATORY): every entry that writes a DB / cloud / external starts with guardEntry({ write: true, ... }) (read-only entries write: false, deploys guardDeploy) from scripts/runner/guard, never reads dotenv itself, and is listed in guard.test.ts | default target development, others --env \<stage\>
- production: typing production on a TTY (--confirm=production skips it for a human there) | non-interactive = the repo.json agent.deploy / agent.env_production policy and the human's one-time permit (dep / evp), never --confirm=production alone (D420)
- ref: scripts/runner/guard/README.md
- env files: .env.development + .env.production, each with one APP_ENV=\<stage\> line, separate DBs | which file is read = ENV_FILE, never APP_ENV (APP_ENV is the stage) | personal overrides / secrets = .env.\<stage\>.local (git-ignored) | pnpm ops setup env writes both | ref: src/lib/appEnv/README.md
tasks: src/domains/\<domain\>/scripts/tasks/\<kebab\>.ts exporting `task: OneShotTask` (@/lib/task), name = \<domain\>:\<file\> | declare stopKeys(args) when a second run would hurt | usage / validation errors → TaskNotStartedError (failed, no key) | never call runAsSystem (the runner does, requestId = task_runs row id; core/audit.md context) | ref: src/lib/task/README.md
migrations: src/domains/\<domain\>/scripts/migrations/\<kebab\>.ts with notice: "\<id\>", shipped in the notice's commit (uses:), run once (key migration:\<notice\>:\<name\>) | \<name\>.local.ts = never committed (pnpm check local-migrations), real run only after a dry-run of the same content, the runner writes a journal draft
- removal: ship it with its notice in one commit → run it on your own DB → delete the tool and the notice's attachments in the next commit (never fold the first ship and the removal into one; .notices/README.md)
seed: \<domain\>/seed.ts = defineSeed data only (@/lib/seed), inserted through the domain service (seedCreate first), $unique on rows that must be reused | read only by the seed runner (lint seed-reader) | ref: src/lib/seed/README.md
records: every named pnpm task run and every pnpm ops data write is a task_runs row (kind task / migration / cron / data) | no row → no run | --due is not recorded | unknown = check the data, then pnpm task --resolve \<runId\> succeeded|failed
- incomplete = run stopped on its time budget (taskIncomplete, not key-holding) → run the same command again | TaskRerunnableError = failed after writes, result kept, rerunnable | ref: src/lib/task/README.md
lint (all tiers error): src-no-scripts | scripts-no-static-wiring (scripts/**, domains/**/scripts/**, codemods: @/wiring by import() only) | tools-no-db-write (domain tasks, scripts/operations except operations/db, seed.ts, workflow/dev-admin: no @/lib/drizzle, entities/drizzle, raw sql, drivers; migrations exempt) | seed-reader
- a reasoned eslint-disable for a real exception (e.g. a db test closing the pool)
tool_design: a tool does the work, then checks and records the result | it never restricts what the agent may do | it may stop only before production, a push or a human's decision | an ordinary step is never made "only the tool writes it" or "go through the tool"
tests: pnpm test [path|--changed|--db] = the test entry /sluice runs (checks_in_ship: never as a step of the work) | groups by name: \*.db.test.\* = db, tests/ outside tests/e2e/ = fork (tests a fork adds), else unit | the entry always adds the server-only preload and module mocks (never write them)
- phase_tests: a test a phase runs (phase.json `check` is a test file, or its `tests` list) runs once, in that phase: pnpm test skips it unless named (D389)
- feature_gate_env: tests never get FEATURE_GATE_OPEN from the shell; a switch test sets its own env
- temp_copy: a test that runs a command in a temp dir copies its code with copyByImports (scripts/runner/test/lib.copyByImports.mjs, from the import graph of what it runs) | its hand list = data the code reads as files only, never a code path | ref: scripts/runner/test/README.md
- node flags: `// test-flags:` on line 1, allowed list only | a test that spawns node --test drops NODE_TEST_CONTEXT from the child env (else a child failure exits 0) | ref: scripts/runner/test/README.md
