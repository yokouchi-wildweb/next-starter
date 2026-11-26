---
paths:
  - "src/**/extensionPoints*.ts"
  - "src/**/points.ts"
  - "scripts/structure/extensions/**"
  - "src/lib/forkOwnership/intake.txt"
---
# receptacles
> **ROLE**: loaded when declaring a receptacle (extensionPoints.ts) or its generator | holds the upstream side of extension points
> Tier1-owned: forks never edit (gap → /order next-starter)

receptacle limits (upstream):
- only for a request with a capability that really uses it, whatever the fork count
- order: existing means → value or part split → new receptacle | existing point forms only | a new form is an approval item only when it brings a check or MANDATORY rule binding forks (core/design.md authoring), else the usual path
- must not bypass a guard | named ReactNode stays banned in core
- same commit: README (timing, tx, on failure) + test + intake line
extension_points (declaring side): two levels, one reader: a district's own points in its extensionPoints.ts, each with its type (replace / override / add / counterpart), + the points of its kind in src/lib/districtMap/kinds.mjs (KINDS) | src/registry = generated lists, not an extension point | ref: scripts/structure/extensions/README.md, src/registry/README.md
  - a tier's own replace point under an upstream route's `_components/` → its own `src/app/<route>/_components/extensionPoints.ts` + `points.ts` (owner = that folder), never the upstream `_layout/extensionPoints.ts` | downstream replaces it with `.replace`, never edits it
  - lists: pnpm generate extensions lists add items into \<district\>/extensions/ (`target: "wiring"`: a lib owner's list goes to src/wiring/\<lib\>.ts; generated, a duplicate item key throws) | intake.txt's src rows are derived from the two levels by src/lib/districtMap/intakeRows.mjs
  - fields: `change` (required: add / override / counterpart / replace) | add point: 0+ items, `max` (empty = the owner's default), `order` where it means something, `load: "lazy"` or eager | contract type `type: { from, name }` from the owner's type-only entry points (a lib: ./points, others: \<owner\>/points.ts; items read it as a type only, lint import-boundaries/points-entry)
  - exactly one: a plugs point with `max: 1` + `required: true` (0 items stops generation) | its upstream item is a 1-line switch \<name\>.ts → \<name\>.default with a replace point in the plugging domain; a fork replaces it with \<name\>.replace, never adds a second | other 1-line switches = replace points (`default`)
  - selecting point: a plugs point + `select: { port, optional?, words, compat }` (still change add; the selection table picks one item, core/backends.md selection)
  - plugs point (`plugs: true`): items sit in the plugging side's own folder \<domain\>/plugs/\<point\>/\<name\>.ts(x) (a lib: \<lib\>/plugs/…), point names unique repo-wide
  - using a list: drop closed domains' items with gate.plugs(list) (client useGate().plugs(list)) | registries (src/registry) are never narrowed: they tell what exists, a closed domain stays 404 by path
  - startup: work at server start = items of the startupTasks point (lib src/lib/startup; list and knot src/wiring/startup.ts, run by instrumentation.ts register) | never code added to instrumentation.ts
  - override_refuse: an override key some items must never take → `overrideRefuse: { flag, key, value }` beside `overrideOf` (an item with `<flag>: true` refuses `<key>: <value>`; generate and check extensions stop), never a check in the reader
  - knot: a lib that needs its list bound declares `export const wire = { name, export, side }` once in its extensionPoints.ts → the generator writes src/wiring/\<lib\>.ts binding the gate-narrowed list to the lib
receptacle_or_config: a list forks add independent rows to = a receptacle (one file = one item) | a table matched by key = config (src/config/README.md)
