---
paths:
  - "src/lib/serverErrorReport/**"
  - "src/**/plugs/serverErrorReporters/**"
---
# lib/serverErrorReport
what: every server failure goes first to one default record (console.error, one JSON line), then to the reporter items (a fork's monitoring, e.g. Sentry), each independent with a time limit | entry @/lib/serverErrorReport (createServerErrorReport) | bound in the generated @/wiring/serverErrorReport (serverErrorReport: onRequestError / report) | Next entry src/instrumentation.ts
use: always (no items upstream: the default line only)
change: add → <your domain or lib>/plugs/serverErrorReporters/<name>.ts `export const reporter` (declared in src/lib/serverErrorReport/extensionPoints.ts, pnpm generate extensions)
rules:
using:
- ser_entry: src/instrumentation.ts is upstream's version in every repo | a fork never edits it: its own startup work moves into an item of the startupTasks point (src/lib/startup), its onRequestError into a reporter item
- ser_item_light: a reporter file imports nothing Node-only at its top level (node:*, firebase-admin, DB) → import() inside register / onRequestError (the entry is bundled for edge too)
- ser_item_fast: a reporter's onRequestError delays route handler responses (Next awaits it, limit 1.5 s) → never await slow delivery inline
- ser_no_secret: the default line never holds query strings, headers, cookies or bodies | an item that sends them owns that choice
editing:
- ser_default_first: the default line is written before any item runs | items never stop each other or the default line | register / onRequestError / report never throw
read: entry, line shape, timing → src/lib/serverErrorReport/README.md Extension, Internals | item form → src/lib/serverErrorReport/README.md Extension | API → src/lib/serverErrorReport/README.md API | failure handling, limits → src/lib/serverErrorReport/README.md Internals
