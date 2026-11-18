---
paths:
  - "src/**/hooks/**"
  - "src/features/**/services/client/**"
  - "**/stores/**"
---
# client
> **ROLE**: loaded when writing hooks, client services or stores | holds the client layer rules (hooks, stores)
> Tier1-owned: forks never edit (gap → /order <direct parent>)

hooks: one use\<Op\>\<Domain\> per operation | custom mutation hooks MUST build on useDomainMutation (@/lib/crud/hooks); useSWRMutation PROHIBITED | test: pnpm test src/lib/crud/hooks/internal/*.test.mjs

client_layer: client HTTP code lives in src/lib/** or services/client/** (axios only there: lint, Tier1 error, forks warn), always through normalizeHttpError, hooks call it | exceptions: streaming ClientService (SSE) may use fetch + ReadableStream; realtimeRoom useRoomState may use native WebSocket | server side: fetch OK
- lint: client-service-boundary/no-direct-import = UI importing services/client or a barrel's *Client → error in Tier1 UI, warn in forks → wrap in a hooks/ hook (useInfiniteScrollQuery / useDomainMutation / SWR) | a real exception = reasoned eslint-disable | test: pnpm test eslint-rules/client-service-boundary.test.mjs | ref: docs/!must-read/アプリ構築における構成層.md
## stores (zustand)
placement: app-wide mechanism → closed lib src/lib/\<name\>/ (state inside, via its entry; no src/stores) | domain-specific → features/\<domain\>/stores/ | one-frame-only → app/\<route\>/_layout/stores/ | structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts}, internalStore → useStore → hooks/useXxx (optional)
rules: state only (logic in services) | UI side effects in useStore's useEffect | internalStore accessed only from useStore.ts | ref: src/lib/toast/stores (a lib-internal store)
