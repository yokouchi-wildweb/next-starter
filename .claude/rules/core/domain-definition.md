---
paths:
  - "src/domains/**/domain.json"
  - "src/domains/**/entities/*/entity.json"
  - "**/*.role.json"
  - "**/*.profile.json"
  - "src/domains/**/entities/*/entity.override.ts"
---
# domain-definition
> **ROLE**: loaded when writing a domain's declaration (domain.json, entities/\<registration\>/entity.json), role / profile JSON or entity.override.ts | holds the domain-definition rules (commands, roles, field types, config utils; reading domain config from parts → components.md domain_config)
> Tier1-owned: forks never edit (gap → /order next-starter)

declaration: one domain = \<domain\>/domain.json (domainConfigVersion "2.0" + label only) + one entities/\<registration\>/entity.json per table (table and registration keys; `generate` lives here, D337) | no table = no registration
- the registrations = the folders under entities/ holding entity.json or a drizzle/schema/form/model.ts, never listed by hand | a one-table domain: registration name = domain name
- statements of no table (API input shapes, aggregate types, constants) → \<domain\>/types/ and constants/, never entities/\<registration\>/ (D341)
- read the declarations only through src/lib/domain readDomain (scripts) or the registration's entity.json import (server) | keys and shapes → src/lib/domain/README.md 宣言の形
commands: write domain.json / entity.json / *.role.json / *.profile.json by hand (no interactive builders) → `pnpm forge` (phases: check forge:pre → generate role → domain → registry → extensions → routes → check forge:post + tests, prints the db:push step, ref: scripts/structure/forge/README.md)
- single steps: pnpm generate domain -- \<Domain\> [--only \<categories\>] (no Domain = all) / pnpm generate domain -- --delete \<Domain\> --confirm \<snake_name\> | no prompts by default, `-i` = interactive (agents / CI / notices never use it, no [user-run]) | ref: scripts/structure/domain/README.md
roles: added roles src/domains/core/user/roles/*.role.json, core roles (admin, user, debugger; a fork cannot delete or disable them) in coreRoles/ → pnpm forge (or pnpm generate role -- \<id\> | --all) → src/domains/core/user/extensions/roles.ts | category = admin or user | debugger role = user category, bypasses maintenance + opens /debug
- list order = enum user_role order, source = the user config roleOrder (src/config/domains/user.config.ts, the generator reads it; upstream holds none): listed roles in that order, others keep their place, a new one goes last (ADD VALUE only) | to match a DB's enum order (read it with pnpm ops db inspect) → write roleOrder, then pnpm forge, never a hand edit of roles.ts
- a fork changes values only in \<json name\>.override.ts beside the JSON | ref: src/domains/core/user/README.md
media_collection: several media per record → a mediaCollection field (collection.registration = the child), never a new mediaUploaderMulti text[] column (existing multi columns keep working) | ref: src/domains/README.md, src/lib/crud/collections/README.md
- the child is a registration in the owner's domain (entities/\<child\>/), never a domain of its own: pnpm generate domain writes and wires it | ownership = the owner's field + the same domain + the child's required CASCADE belongsTo, no mark
field_types: a fieldType's meaning (column, Zod, TS, form default, check group, datetime) = only the table src/lib/domain/fields/fieldTypes.mjs (fieldTypeSpec / helpers) | never compare or list fieldType names outside it (lint field-type-guard: error in Tier1, warn in forks) | ref: src/lib/domain/README.md
cache_declaration: a read's cache lives in its owner's declaration (D353) → `pnpm generate cache` writes services/server/\<registration\>CachedReads.ts | shape, lifetime caps, readsDomains → src/domains/README.md cache | checked by pnpm check domain (generate false too)
- a registration's standard reads → its entities/\<registration\>/entity.json "cache" (every registration, no domain-wide default) | fork: entity.override.ts "cache" replaces it
- a read spanning registrations → domain.json "cache.reads" (vocabulary pending) | no cache.json
- a hand-managed registration's \<registration\>Base.ts passes createCrudService `cacheTags: { domain: "<camel>" }` itself (generate true: pnpm generate domain writes it)
config_utils: src/lib/domain/ (extractFields, getRelationsOf and the other *Of functions take a domain copy; client index.ts, server server.ts)
