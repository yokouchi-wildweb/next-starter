---
paths:
  - "src/features/core/taskRun/**"
---
# features/taskRun
what: the record of each named `pnpm task` run (table task_runs, one row per run) with its stop keys and unknown-result states, and the functions that read and write it | entry @/features/taskRun/services/server (startRun, finishRun, findKeyHolders, findDryRunOf, resolveRun)
use: always
change: none → /order <direct parent>
rules:
using:
- task_run_writer: rows are written only by the task runner scripts/runner/task, never by a task, route or other code
- task_run_resolve: a running / unknown row changes only by a human through `pnpm task --resolve` (succeeded keeps its keys, failed frees them)
editing:
- task_run_internal: no HTTP route or admin screen | the registry access stays INTERNAL_ONLY
- task_run_finish_running: finishRun writes only to a running row
- task_run_db_target: db_target keeps the host and DB name only, never credentials
read: setup, resolve → Usage | columns, statuses, stop keys, functions → API | tests → Verification | the runner, task authoring → Related
