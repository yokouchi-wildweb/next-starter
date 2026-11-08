# DOWNSTREAM NOTICE id:20261108-192503-access-presets-to-lib
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-08T19:25:03+09:00
severity: breaking
checkpoint: config-common-c3
moved: src/config/app/domain-api-access.config.ts -> src/lib/domain/accessPresets.ts
change: the generic API access presets (ADMIN_RULE, ADMIN_ONLY, PUBLIC_READ, INTERNAL_ONLY, ADMIN_DATA_OPERATIONS, ADMIN_OR_DEBUGGER_RULE, ADMIN_OR_DEBUGGER) are now lib/domain constants in src/lib/domain/accessPresets.ts (import "@/lib/domain/accessPresets"); the fail-closed default DOMAIN_API_ACCESS_CONFIG.defaultRule became the constant DEFAULT_ACCESS_RULE there; src/config/app/domain-api-access.config.ts is deleted (not an overridable config any more) | values, types and access resolution are unchanged | domainEntry.ts may statically import only "@/lib/domain/types" and "@/lib/domain/accessPresets" (pnpm check registry) and pnpm generate domain writes the new import
why: every fork file that imports "@/config/app/domain-api-access.config" (each domainEntry.ts of your own domains, your routes that use ADMIN_OR_DEBUGGER_RULE etc.) fails pnpm typecheck and pnpm check registry after this checkpoint
required_actions:
1. Merge upstream up to this checkpoint. src/config/app/domain-api-access.config.ts: accept upstream's deletion (none of the five forks added its own preset there; if yours did, move that constant into your own file, e.g. your domain's constants/, and import it from there).
2. Rewrite every remaining import: `git grep -l "config/app/domain-api-access.config" -- src scripts servers` then, for each listed file, replace the specifier "@/config/app/domain-api-access.config" with "@/lib/domain/accessPresets" (e.g. `sed -i 's#@/config/app/domain-api-access\.config#@/lib/domain/accessPresets#g' <file>`). A relative import of the old file (../config/app/domain-api-access.config) → the same new specifier.
3. A fork file that read DOMAIN_API_ACCESS_CONFIG.defaultRule → import { DEFAULT_ACCESS_RULE } from "@/lib/domain/accessPresets".
4. `pnpm generate registry` and `pnpm check registry`.
verify: git grep -n "domain-api-access" -- src scripts servers prints nothing | pnpm typecheck | pnpm check registry | pnpm test scripts/structure/registry
manual_steps: -
refs: src/lib/domain/accessPresets.ts, src/lib/domain/README.md, .claude/rules/core/api-routes.md, scripts/structure/registry/serviceRegistry/discover.mjs, scripts/structure/domain/render/registry/presetAccess.mjs, council 20261023-175358-config-redesign decision D63, legate:l1 order:26
notes: files reading the old path outside upstream's core and sample domains, counted at the fork HEADs when writing (fork-owned domainEntry.ts and routes; the generator copy under the old scripts/domain-config layout moves with the earlier scripts notice): oripa-do 66, TriQ 23, boardgame-site 18, next-vnx 12, 88-base 10. Their old presets file had the same exports and defaultRule as upstream (nothing fork-specific to keep). | D63 also lets a fork keep its own presets (e.g. staff only) as constants on its side; the pnpm check registry allow list still names only the two lib/domain modules, so for now spread such a constant's literal value in the domainEntry or ask upstream with /order next-starter.
