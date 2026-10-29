---
paths:
  - "**/stores/**"
---
# STORES (zustand)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

placement: src/stores/ = app-wide only | domain-specific → features/\<domain\>/stores/ | one-frame-only → app/\<route\>/_layout/stores/ | structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts}, internalStore → useStore → hooks/useXxx (optional)
rules: state only (logic in services) | UI side effects in useStore's useEffect | internalStore accessed only from useStore.ts | ref: src/stores/README.md
