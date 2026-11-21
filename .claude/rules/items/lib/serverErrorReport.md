---
paths:
  - "src/lib/serverErrorReport/**"
---
# lib/serverErrorReport
what: every server failure goes first to one default record (console.error, one JSON line), then to the reporter items (a fork's monitoring, e.g. Sentry), each independent with a time limit | entry @/lib/serverErrorReport (createServerErrorReport) | bound in @/wiring/serverErrors (serverErrorReport: register / onRequestError / report) | Next entry src/instrumentation.ts
use: always (no items upstream: the default line only)
change: add → src/wiring/serverErrors/reporters/<name>.ts `export const reporter` (pnpm generate extensions)
rules:
using:
- ser_entry: src/instrumentation.ts is upstream's version in every repo | a fork never edits it: its own register / onRequestError move into a reporter item
- ser_item_light: a reporter file imports nothing Node-only at its top level (node:*, firebase-admin, DB) → import() inside register / onRequestError (the entry is bundled for edge too)
- ser_item_fast: a reporter's onRequestError delays route handler responses (Next awaits it, limit 1.5 s) → never await slow delivery inline
- ser_no_secret: the default line never holds query strings, headers, cookies or bodies | an item that sends them owns that choice
editing:
- ser_default_first: the default line is written before any item runs | items never stop each other or the default line | register / onRequestError / report never throw
read: entry, line shape, timing → src/wiring/serverErrors/README.md Usage | item form → src/wiring/serverErrors/README.md Extension | API → src/lib/serverErrorReport/README.md API | failure handling, limits → src/lib/serverErrorReport/README.md Internals
