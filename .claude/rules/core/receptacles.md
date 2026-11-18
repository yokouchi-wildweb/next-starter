---
paths:
  - "src/**/extensionPoints*.ts"
  - "scripts/structure/extensions/**"
  - "src/lib/forkOwnership/intake.txt"
---
# receptacles
> **ROLE**: loaded when declaring a receptacle (extensionPoints.ts) or its generator | holds the upstream side of extension points
> Tier1-owned: forks never edit (gap → /order <direct parent>)

receptacle limits (upstream):
- only for a request with a feature that really uses it, whatever the fork count
- order: existing means → value or part split → new receptacle | existing kinds only, a new kind is a window item (core/design.md)
- must not bypass a guard | named ReactNode stays banned in core
- same commit: README (timing, tx, on failure) + test + intake line
extension_points (declaring side): a district's extensionPoints.ts declares a receptacle → pnpm generate extensions lists its items into \<district\>/extensions/ (generated, a duplicate item key throws) | src/registry = generated lists, not an extension point | ref: scripts/structure/extensions/README.md, src/registry/README.md
