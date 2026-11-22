---
paths:
  - "src/lib/startup/**"
---
# lib/startup
what: runs the work each server start needs once (e.g. a monitoring SDK's init), each item on its own with a time limit | closed lib: entry "." @/lib/startup (createStartup, wireStartup, StartupTask), entry "./points" @/lib/startup/points (the contract type StartupTask, types only)
  - the list is the startupTasks point (declared in src/lib/startup/extensionPoints.ts) | the generated knot src/wiring/startup.ts binds the gate-narrowed list (wireStartup, pnpm generate extensions) | its one reader is the register of src/instrumentation.ts
use: always (no items upstream)
change: add → <your domain or lib>/plugs/startupTasks/<name>.ts `export const task` (one item per file, pnpm generate extensions)
rules:
using:
- startup_item_not_entry: work at server start is an item of this point | never code added to src/instrumentation.ts or to the knot src/wiring/startup.ts (instrumentation.ts is upstream's in every repo, the knot is generated)
- startup_item_light: an item file imports nothing Node-only at its top level (node:*, firebase-admin, DB) → import() inside run (the entry is bundled for edge too)
- startup_item_runtime: `runtime` defaults to nodejs | an item that must run on edge too says "both" or "edge"
- startup_item_alone: items never depend on each other or on an order (they run together)
- startup_type_points: an item reads StartupTask as a type only from @/lib/startup/points
editing:
- startup_never_throws: register never throws | an item's throw, time-out or load failure = one line { level: "error", scope: "startup", task, phase, reason } and the other items keep running
- startup_no_list: the lib never reads the list or env itself | the list comes from the knot, the runtime from currentRuntime() in wire.ts
read: add an item → Usage, Extension | createStartup, wireStartup, StartupTask → API | lazy loading, failure lines → Internals | its test → Verification | failure reports, wiring → Related
