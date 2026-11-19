---
paths:
  - "src/**/hooks/**"
  - "src/features/**/services/client/**"
  - "**/stores/**"
---
# client
> **ROLE**: loaded when writing hooks, client services or stores | holds the client layer rules (hooks, stores)
> Tier1-owned: forks never edit (gap → /order next-starter)

use_client: a file that calls a hook (useState, useEffect, any useXxx; not React's use()) starts with "use client" (lint use-client/hooks-need-directive, all tiers error) | a pure function or constant the server also needs → its own file outside hooks/, never beside a hook
- why: without it a server component reaching the file through an entry file breaks the production build, which only /ship --safe runs
hooks: one use\<Op\>\<Domain\> per operation | custom mutation hooks MUST build on useDomainMutation (@/lib/crud/hooks); useSWRMutation PROHIBITED | test: pnpm test src/lib/crud/hooks/internal/*.test.mjs

client_layer: client HTTP code lives in src/lib/** or services/client/** (axios only there: lint, Tier1 error, forks warn), always through normalizeHttpError, hooks call it | exceptions: streaming ClientService (SSE) may use fetch + ReadableStream; realtimeRoom useRoomState may use native WebSocket | server side: fetch OK
- lint: client-service-boundary/no-direct-import = UI importing services/client or a barrel's *Client → error in Tier1 UI, warn in forks → wrap in a hooks/ hook (useInfiniteScrollQuery / useDomainMutation / SWR) | a real exception = reasoned eslint-disable | test: pnpm test eslint-rules/client-service-boundary.test.mjs | ref: docs/!must-read/アプリ構築における構成層.md
swr_keys: a domain's SWR keys live in one keys file under hooks/, never inline strings at call sites
client_guards_ux_only: a client-side guard is UX only (bypassable) | data and permissions are guarded on the server
## stores (zustand)
placement: app-wide mechanism → closed lib src/lib/\<name\>/ (state inside, via its entry; no src/stores) | domain-specific → features/\<domain\>/stores/ | one-frame-only → app/\<route\>/_layout/stores/ | structure: stores/\<name\>/{index.ts, internalStore.ts, useStore.ts}, internalStore → useStore → hooks/useXxx (optional)
rules: state only (logic in services) | UI side effects in useStore's useEffect | internalStore accessed only from useStore.ts | ref: src/lib/toast/stores (a lib-internal store)
