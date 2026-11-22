---
paths:
  - "src/domains/core/demo/**"
  - "src/config/domains/demo.config.ts"
---
# domains/demo
what: demo mode, demo login and the admin demo user list | a core domain with no table (the demo user mark = users.is_demo, owned by user) | config demoConfig, server demoLogin, hooks useDemoLogin / useBankTransferVisionDemo, admin list components/DemoUserList
use: always (always-open, declared) | its addresses are closed by the rules demoPages, demoLogin, adminDemoUsers (dependsOn demoLogin)
change: counterpart = src/config/domains/demo.config.ts | replace = services/server/onDemoUserCreated.ts → a fork's onDemoUserCreated.replace.ts (rows added for a new demo user)
rules:
using:
- mode_needs_pages: `mode.enabled: true` needs the feature demoPages open (declared in featureRequirements; pnpm check proxies stops the build otherwise)
- array_override_replaces: a config values file's `mode.allowedPaths` / `mode.allowedPrefixes` replaces the whole array
editing:
- always_open: declared always-open (`export const alwaysOpen = true` in its extensionPoints.ts), so no rule lists it (check) (its proxy item demoMode, in its own plugs/, reads its values)
- reader_checks_feature: each reader of a value checks the feature that gives it meaning (demoMode → demoPages, session length → demoLogin, the list → adminDemoUsers)
- user_owns_rows: demo user rows and `is_demo` are user's (createGuestDemoUser, createDemoUser) and token issuing is auth's | demoLogin calls them, never writes users itself
read: config keys, readers → Extension | API, screens, services → API | gate and other domains → Internals
