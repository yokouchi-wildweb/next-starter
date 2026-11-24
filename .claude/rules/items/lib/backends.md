---
paths:
  - "src/lib/backends/**"
  - "src/**/plugs/backendCapabilities/**"
---
# lib/backends
what: the shared parts of a backend port's implementations: declaration / adapter types, capability names, billing scales, compat, backendRequirements, the builtin none, the reserved names none / fake, the owner's override slot maker, the startup status task maker | entries @/lib/backends (client-safe), @/lib/backends/node (contract tests), @/lib/backends/points (item type)
use: always
change: add → <your domain or lib>/plugs/backendCapabilities/<name>.ts `export const capabilities = { port, words }` (declared in src/lib/backends/extensionPoints.ts, pnpm generate extensions)
rules:
using:
- select_point: a port is chosen through a selecting point (`select` on a plugs point, owner = a lib or an always-open domain) | the owner imports `adapter` from its generated <owner>/extensions/<point>.ts, never an item directly
- literal_only: a declaration, a compat and a capabilities item are literals only (generators read them by AST, never run them)
- is_configured_pure: adapter.isConfigured is sync, no network, no SDK init | it returns env / setting names, never values
- reserved_names: none and fake are never an item's name | fake is never written in the selection table | tests put fake in through the port owner's override slot (createBackendOverride)
- none_throws: the none adapter throws a BackendNotConfiguredError child on every call | its isConfigured is configured:false
- contract_test: a port owner exposes its contract with defineBackendContract (lib port: its ./node entry) | the upstream implementation, the fake and a fork's implementation run the same contract
- fork_words: a fork adds a word only in its own lib's plugs item | it never redefines an existing word | upstream code never requires a fork's word
- selection_command: backend-selection.json is written only by pnpm workflow backend-selection fill | set (never by hand) | show reads it
- status_task: the startup report of a port is a generated line of src/wiring/startup.ts: createBackendStatusTask(<point>BackendStatus from the owner's public entry) | a new selecting point's owner exports <point>BackendStatus (BackendStatus: port, selected, isConfigured), never its adapter | the line carries names only, never env values
- prices_upstream: backendPrices (prices.ts) is upstream-only values keyed by priceKey | a fork reads it, never edits it
editing:
- entry_client_safe: the "." entry stays client-safe and node-free | contract code goes to ./node
read: shapes and functions → API | none, override slot, contract test → Usage | the capability point → Extension | none's Proxy → Internals
