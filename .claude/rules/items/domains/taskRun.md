---
paths:
  - "src/domains/core/taskRun/**"
---
# domains/taskRun
what: the record of each named `pnpm task` run (table task_runs, one row per run) with its stop keys and unknown-result states, and the functions that read and write it | entry @/domains/taskRun/services/server (startRun, finishRun, findKeyHolders, findDryRunOf, findRun, resolveRun)
use: always
change: none → /order <direct parent>
rules:
using:
- task_run_writer: rows are written only through the task runner's flow (scripts/runner/task; pnpm task and pnpm ops data), never by a task, route or other code
- task_run_resolve: a row left running (the runner died) or unknown changes only by a human through `pnpm task --resolve <runId> succeeded|failed` (succeeded keeps its keys, failed frees them)
editing:
- task_run_internal: no HTTP route or admin screen | the registry access stays INTERNAL_ONLY
- task_run_finish_running: finishRun writes only to a running row
- task_run_db_target: db_target keeps the host and DB name only, never credentials
read: setup, resolve → Usage | columns, statuses, stop keys, functions → API | tests → Verification | the runner, task authoring → Related
