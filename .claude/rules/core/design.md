---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".claude/rules/**"
---
# design
> **ROLE**: loaded when writing CLAUDE.md, AGENTS.md or anything under .claude/rules/ | holds the map of all core files (below); the authoring ladder, card / service / context-file formats, size lines and who to consult arrive later
> part of the CLAUDE.md contract (see CORE_RULES): upstream-owned, never edit downstream (gap → /order <upstream>) | FORMAT_RULE applies

map (every core file, loaded by its paths):
- .claude/rules/core/api-routes.md: API_ROUTES detail
- .claude/rules/core/audit.md: AUDIT detail
- .claude/rules/core/backends.md: BACKENDS / SERVERS rules
- .claude/rules/core/change.md: the change types (CHANGE_TYPES)
- .claude/rules/core/client.md: the client layer rules (hooks, stores)
- .claude/rules/core/components.md: COMPONENTS detail
- .claude/rules/core/db.md: table, index and DB identifier rules
- .claude/rules/core/design.md: the map of all core files (below); the authoring ladder, card / service / context-file formats, size lines and who to consult arrive later
- .claude/rules/core/domain-definition.md: the domain definition rules
- .claude/rules/core/extensions.md: FORK_EXTENSION (judge, guards, want → means, copy and own marks)
- .claude/rules/core/generated.md: DIRECTORY_STRUCTURE code_generation (generated / write-once / hand-owned)
- .claude/rules/core/lib.md: the library rules (CODE_PLACEMENT library)
- .claude/rules/core/notices.md: DOWNSTREAM_NOTICES detail
- .claude/rules/core/ownership.md: who owns what (CORE_FILES, fork_ownership)
- .claude/rules/core/proxy.md: PROXY detail
- .claude/rules/core/readme-format.md: the README format
- .claude/rules/core/receptacles.md: the upstream side of extension points
- .claude/rules/core/screens.md: SCREENS detail
- .claude/rules/core/scripts.md: the scripts placement and rules
- .claude/rules/core/services.md: CRUD_SERVICE (createCrudService) service-side rules
- .claude/rules/core/skills.md: the skill format
- .claude/rules/core/style.md: STYLE_OWNERSHIP detail
