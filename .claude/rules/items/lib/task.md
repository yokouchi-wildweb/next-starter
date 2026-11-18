---
paths:
  - "src/lib/task/**"
---
# lib/task
what: the types of domain tasks and migrations run by `pnpm task <domain>:<name>` (OneShotTask, TaskNotStartedError, taskIncomplete, TaskRerunnableError) | entry @/lib/task
use: always
change: none → /order <direct parent>
rules:
using:
- task_core_rules: placement, names, stopKeys, runAsSystem, records and .local.ts migrations follow core/scripts.md tasks / migrations / records
- task_lazy_deps: run() imports heavy dependencies dynamically inside
- task_service_writes: scripts/tasks/ writes through domain services, never @/lib/drizzle, table definitions, raw SQL or drivers (lint tools-no-db-write) | direct SQL only in scripts/migrations/
- task_shared_part: a part shared by tasks = lib.<name>.ts in the same folder (not counted as a task), tests beside it
- task_incomplete_idempotent: taskIncomplete and TaskRerunnableError only in idempotent tasks that resume when run again | a non-idempotent task just fails (unknown)
- task_local_dry_run: a .local.ts migration honors `--dry-run` itself (no writes) | once downstream needs it, drop `.local` and add `notice:`
editing:
- task_no_deps: the lib reads no features, shelf or @/wiring
read: add a task / migration, .local.ts → Usage | types and marks → API | stop checks, notice check, run records → Internals | taskRun, cron → Related
