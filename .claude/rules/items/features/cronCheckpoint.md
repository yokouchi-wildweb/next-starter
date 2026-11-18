---
paths:
  - "src/features/core/cronCheckpoint/**"
---
# features/cronCheckpoint
what: a monotonic watermark (table cron_checkpoints + a few functions) that incremental crons and resumable batches use to remember "processed up to here", entry @/features/cronCheckpoint/services/server
use: always
change: none → /order <direct parent>
rules:
using:
- checkpoint_name: one name per task, namespaced (e.g. `user-metrics-refresh`)
- checkpoint_cap: advance at most to the run's start time (rows updated after it may not have been scanned)
- checkpoint_reset_ops: resetCheckpoint only from an ops task or script, never on a cron path | a rewind needs an idempotent recompute
- checkpoint_prefer_refresh: a watermark scan → createIncrementalRefresh (@/features/incrementalRefresh) before hand-writing one on these functions
editing:
- checkpoint_internal: server-internal only, no HTTP route
read: use the functions, rewind → Usage | functions, table → API | monotonic write → Internals
