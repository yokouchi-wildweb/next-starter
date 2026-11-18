---
paths:
  - "src/lib/**"
  - "src/wiring/**"
  - "src/config/lib/**"
  - "src/utils/**"
---
# lib
> **ROLE**: loaded when writing a library, the wiring or a lib config | holds the library rules (CODE_PLACEMENT library)
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

library: src/lib/\<name\>/, all except entities | owner per library in src/lib/CATALOG.md (one section per owner repo; format: src/lib/README.md; test: pnpm test src/lib/folderCatalog/catalog.test.mjs) | closed lib = package.json exports + libs + own tsconfig.json, read via its exports only (lint lib-entry), config @lib-config/\<name\> → src/config/lib/ | closing one → src/lib/README.md
- new lib (any tier): add its line to YOUR section only | when a parent takes over your lib through an order, drop your copy + line when it ships
- lib owned by an ancestor repo: public entry only, never edit internals or delete the dir (unused = leave it), behavior change → /order <direct parent> | a fork file added inside it fails pnpm workflow ownership check → put it in your own lib and re-export
deps: lib→lib OK | lib→features NG, values and types (lint import-boundaries/lib-no-features, all tiers; type = lib's own or a type param, value = injected, bound in src/wiring) | features→features (UI): use the target's hooks | features→features (server): direct OK, no cycles | ref: docs/!must-read/設計思想とアーキテクチャ.md
