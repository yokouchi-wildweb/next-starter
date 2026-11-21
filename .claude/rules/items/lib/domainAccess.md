---
paths:
  - "src/lib/domainAccess/**"
---
# lib/domainAccess
what: the access types (DomainApiAccessConfig, rules, operation names) and presets (ADMIN_ONLY, PUBLIC_READ, INTERNAL_ONLY, ADMIN_RULE …) of the generic domain API and the admin data operations | closed lib, entry "." @/lib/domainAccess only, value-only files
use: always
change: none → /order <direct parent>
rules:
using:
- access_presets_read: domainEntry(.override).ts and routes take presets and operation names from @/lib/domainAccess, never a copy
editing:
- value_only: every file here stays value-only (types, const literals, re-exports; no function, call, class, side-effect import) | domainEntry.ts value-imports it and pnpm check registry follows every file
- presets_const: presets stay lib constants, never overridable config | DEFAULT_ACCESS_RULE stays fail-closed (admin only)
- generator_copy: a preset change → its copy in scripts/structure/domain/render/registry/presetAccess.mjs in the same commit (registry.test.mjs compares them)
read: what it holds, why value-only → Overview | names → API | how access resolves → src/lib/domain/README.md Internals
