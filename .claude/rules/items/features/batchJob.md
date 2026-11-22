---
paths:
  - "src/domains/core/batchJob/**"
---
# domains/batchJob
what: a generic base that processes large data in chunks with progress tracking, idempotency and crash recovery; entry @/domains/batchJob/services/server (batchJobService), handler types @/domains/core/batchJob/types
use: always
change: add = a job handler in jobHandlers/ (receptacle jobHandlers in extensionPoints.ts)
rules:
using:
- service_entry: entry points (API routes etc.) import from @/domains/batchJob/services/server (its index guarantees the handler list)
- handler_one_mode: a handler defines exactly one of processChunk or processItem
- handler_enabled: a handler that imports the folder of a domain the gate can close needs `enabled` (the receptacle runs always on)
- job_type_const_apart: the jobType const shared by the handler and its facade lives in a file of its own (no import cycle with the handler)
- job_facade: (recommended) a domain that owns a job offers a facade function (create<Name>Job) so callers never handle jobType or the params shape
read: run a job → Usage | add a job → Extension | methods, routes, tables → API | modes and status flow → Internals
