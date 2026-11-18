---
paths:
  - "src/features/core/userProfile/**"
---
# features/userProfile
what: per-role profile tables (one profile.json per role with hasProfile) with one CRUD / search interface; server userProfileService and getProfileBase (utils/profileBaseHelpers), client hooks @/features/core/userProfile/hooks
use: always
change: add = a profile JSON profiles/<role>.profile.json (pnpm forge) | overlay = profiles/<role>.profile.override.ts (tags, searchFields, audit; profileDefinitions in extensionPoints.ts)
rules:
using:
- override_literal: an override file holds only relative `import type` and `export const override = { … }` with literal values (read as text, never run)
- no_media_fields: a profile has no mediaUploader / mediaCollection field; an image goes to another domain's column, or /order upstream for profile storage binding
- entry_choice: per-user operations use userProfileService; table-wide search / list / query use getProfileBase(role)
- server_helpers_direct: server-only helpers (getProfileBase, createProfileBase) are imported by their file path, never through utils/index.ts
- extra_where_ssr: extraWhere (raw SQL) is used only from SSR through getProfileBase, never through the API routes
- cross_search: user + profile search uses userService.searchWithProfile; profile CRUD search stays on getProfileBase(role).search()
- url_field_name: a field holding a URL is named `<name>Url` (upsertProfile then lets only http / https through)
- typed_wrapper: role-specific types come from a thin wrapper over the generic hooks, never by retyping the generic layer
editing:
- tag_source: profile tags are added or removed only in constants/fieldTags.mjs
read: write or change a profile JSON → Extension | server / client calls → Usage | ProfileBase, routes, helpers → src/features/core/userProfile/API.md API | generation, checks → Internals
