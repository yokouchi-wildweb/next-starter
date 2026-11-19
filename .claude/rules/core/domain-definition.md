---
paths:
  - "src/features/**/domain.json"
  - "**/*.role.json"
  - "**/*.profile.json"
  - "src/features/**/services/server/domainEntry*.ts"
---
# domain-definition
> **ROLE**: loaded when writing domain.json, role / profile JSON or domainEntry.ts | holds the domain-definition rules (commands, roles, field types, config utils; reading domain config from parts → components.md domain_config)
> Tier1-owned: forks never edit (gap → /order <direct parent>)

commands: write domain.json / *.role.json / *.profile.json by hand (no interactive builders) → `pnpm forge` (gates: check forge:pre → generate role → domain → registry → extensions → routes → check forge:post + tests, prints the db:push step, ref: scripts/structure/forge/README.md)
- single steps: pnpm generate domain -- \<Domain\> [--only \<categories\>] (no Domain = all) / pnpm generate domain -- --delete \<Domain\> --confirm \<snake_name\> | no prompts by default, `-i` = interactive (agents / CI / notices never use it, no [user-run]) | ref: scripts/structure/domain/README.md
roles: added roles src/features/core/user/roles/*.role.json, core roles (admin, user, debugger; a fork cannot delete or disable them) in coreRoles/ → pnpm forge (or pnpm generate role -- \<id\> | --all) → src/features/core/user/extensions/roles.ts | category = admin or user | debugger role = user category, bypasses maintenance + opens /debug
- list order = enum user_role order, keep it | a fork changes values only in \<json name\>.override.ts beside the JSON | ref: src/features/core/user/README.md
media_collection: several media per record → a mediaCollection field (pnpm generate domain writes the owned child domain and wires it), never a new mediaUploaderMulti text[] column (existing multi columns keep working) | ref: src/features/README.md, src/lib/crud/collections/README.md
field_types: a fieldType's meaning (column, Zod, TS, form default, check group, datetime) = only the table src/lib/domain/fields/fieldTypes.mjs (fieldTypeSpec / helpers) | never compare or list fieldType names outside it (lint field-type-guard: error in Tier1, warn in forks) | ref: src/lib/domain/README.md
config_utils: src/lib/domain/ (extractFields, getRelationsOf and the other *Of functions take a domain copy; client index.ts, server server.ts)
