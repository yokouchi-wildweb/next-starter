---
paths:
  - "src/lib/**"
  - "src/wiring/**"
  - "src/config/lib/**"
  - "src/utils/**"
---
# lib
> **ROLE**: loaded when writing a library, the wiring or a lib config | holds the library rules (CODE_PLACEMENT library)
> Tier1-owned: forks never edit (gap → /order next-starter)

library: src/lib/\<name\>/, all except entities | owner per library in src/lib/CATALOG.md (one section per owner repo; format: src/lib/README.md; test: pnpm test src/lib/folderCatalog/catalog.test.mjs) | closed lib = package.json exports + libs + own tsconfig.json, read via its exports only (lint lib-entry), config @lib-config/\<name\> → src/config/lib/ | closing one → src/lib/README.md
- new lib (any tier): add its line to YOUR section only | when a parent takes over your lib through an order, drop your copy + line when it ships
- lib owned by an ancestor repo: public entry only, never edit internals or delete the dir (unused = leave it), behavior change → /order <direct parent> | a fork file added inside it fails pnpm workflow ownership check → put it in your own lib and re-export
deps: lib→lib OK | lib→features NG, values and types (lint import-boundaries/lib-no-features, all tiers; type = lib's own or a type param, value = injected, bound in src/wiring) | features→features (UI): use the target's hooks | features→features (server): through the target's public services (its services/server entry), no cycles | ref: docs/!must-read/設計思想とアーキテクチャ.md
closed_lib_package: a closed lib has its own tsconfig.json whose paths cover only its libs closure | a lib with config.ts needs its override src/config/lib/\<name\>.config.ts | config is composed with @/lib/defineConfig, never a hand-rolled merge | sideEffects only where measured | check: pnpm check lib-package (scripts/structure/lib-package/README.md)
entry_no_use_client: a closed lib's entry (index.ts) never starts with "use client" | mark client only on the part files that need it (an entry marked client turns every value a server reads through it into a client reference)
closed_lib_env: a closed lib never reads process.env (one exception: lib/url's getAppBaseUrl reads the runtime origin APP_BASE_URL / VERCEL_ENV / VERCEL_URL) | its values arrive through its override src/config/lib/\<name\>.config.ts (the override may read process.env, `@/business` and the stage)
facts_not_policy: a lib returns facts; the calling domain owns the policy (allow / reject, limits, deletion)
no_toggle_env: no behavior-toggle env | a feature that needs a secret is on exactly when the secret is set, with no fallback to another secret
