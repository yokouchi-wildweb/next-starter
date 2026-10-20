# DOWNSTREAM NOTICE id:20261020-165825-cron-task-override-export
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-20T16:58:25+09:00
severity: info
checkpoint: cron-task-override-export
change: `CronTaskOverride` is now exported from "@/lib/cron" (src/lib/cron/index.ts), so override.ts written as in src/lib/cron/README.md and notice 20261020-160342-cron-task-override (`import type { CronTaskOverride } from "@/lib/cron"`) compiles. Before this, that import failed tsc with TS2305 (test:cron-wiring and cron:check did not catch it; the Vercel build did). test:cron-wiring now also fails when README or a cron task.ts / override.ts / route.ts imports a name from "@/lib/cron" that index.ts does not export.
why: the documented import path of the override mechanism did not compile.
required_actions: none. Optional: override.ts files that work around the bug with `import type { CronTaskOverride } from "@/lib/cron/types"` may switch to "@/lib/cron" (both keep compiling).
verify: `pnpm tsc --noEmit` passes with `import type { CronTaskOverride } from "@/lib/cron"`; `pnpm test:cron-wiring` passes.
manual_steps: -
refs: src/lib/cron/index.ts, scripts/cron/cronWiring.test.mjs, src/lib/cron/README.md, upstream-request 20261020-165323-export-cron-task-override-type
notes: reported by boardgame-site (workaround in its commit 357b22d4).
