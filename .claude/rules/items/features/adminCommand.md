---
paths:
  - "src/domains/core/adminCommand/**"
---
# domains/adminCommand
what: the admin command palette (Ctrl/Cmd + Shift + Alt/Option + A, admins only) with categories, plugins and navigation items | entry @/domains/core/adminCommand (useAdminCommand), types in its base/types and types
use: always
change: add → navigation items: src/domains/core/adminCommand/extensionPoints.ts (navigationItems/<name>.ts) | categories, plugins: src/app/_layout/adminCommand/extensionPoints.ts (categories/<name>.tsx, plugins/<name>.tsx) | then pnpm generate extensions
rules:
using:
- palette_receptacles: a fork adds categories, plugins and navigation items only as files in the receptacles, never by editing upstream adminCommand files
- renderer_contract: a category Renderer sets `key` on Command, `autoFocus` on CommandInput, and calls onBack() on Backspace while the search value is ""
editing:
- palette_admin_only: categories and plugins stay `load: lazy` (read only once the user is an admin, never shipped to other users) | a plugin Provider wraps only the palette and GlobalComponent, never the whole screen
- palette_gate_place: the admin-frame gate filter is registered from inside the admin guard layout (AdminCommandGateBridge), never computed at root (no admin addresses in public HTML) | the general rule = core/proxy.md gate_values_in_range
read: add a navigation item, category or plugin → Usage | renderer props, types → API | receptacle places → Extension | gate filtering of items → Internals | tests → Verification
