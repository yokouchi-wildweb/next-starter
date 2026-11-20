---
paths:
  - "src/lib/libPackage/**"
---
# lib/libPackage
what: the one reader and shape check of a lib's package.json (exports, libs, peers, sideEffects), read by the lint entry/only-entries, the standalone tsconfig check and the closed-lib check; entry @/lib/libPackage/index.mjs
use: always
change: none → /order <direct parent>
rules:
using:
- lp_one_reader: a lib's package.json is read only through this lib, never parsed elsewhere
- lp_one_discovery: finding the libs under src/lib goes through listLibs / listLibsFrom
- lp_clear_cache: code that rewrites a package.json calls clearLibPackageCache() before reading again
editing:
- lp_node_only: it imports Node built-ins only (no other lib, no features), so lint, scripts and tests can all read it
- lp_no_tsconfig: it never reads the per-lib tsconfig.json (the standalone type check owns that)
read: functions → API | problem codes → API | where the declaration shape is written → Overview | tests → Verification
