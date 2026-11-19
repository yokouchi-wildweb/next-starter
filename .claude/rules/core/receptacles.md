---
paths:
  - "src/**/extensionPoints*.ts"
  - "scripts/structure/extensions/**"
  - "src/lib/forkOwnership/intake.txt"
---
# receptacles
> **ROLE**: loaded when declaring a receptacle (extensionPoints.ts) or its generator | holds the upstream side of extension points
> Tier1-owned: forks never edit (gap → /order next-starter)

receptacle limits (upstream):
- only for a request with a feature that really uses it, whatever the fork count
- order: existing means → value or part split → new receptacle | existing kinds only | a new kind goes through the window only when it brings a check or MANDATORY rule binding forks (core/design.md authoring), else the usual path
- must not bypass a guard | named ReactNode stays banned in core
- same commit: README (timing, tx, on failure) + test + intake line
extension_points (declaring side): a district's extensionPoints.ts declares a receptacle → pnpm generate extensions lists its items into \<district\>/extensions/ (generated, a duplicate item key throws) | src/registry = generated lists, not an extension point | ref: scripts/structure/extensions/README.md, src/registry/README.md
receptacle_or_config: a list forks add independent rows to = a receptacle (one file = one item) | a table matched by key = config (src/config/README.md)
