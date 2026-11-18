---
paths:
  - "src/lib/transitionGuard/**"
---
# lib/transitionGuard
what: a client-side guard for page transitions in a flow (consumable tokens in sessionStorage) | entry @/lib/transitionGuard (useGuardedNavigation, useTransitionGuard)
use: always
change: none → /order <direct parent>
rules:
using:
- tg_ux_only: a UX guard only (client side, bypassable), never a security guard | data and permissions stay guarded on the server
- tg_client_target: the target page runs useTransitionGuard in a "use client" file and shows a loader while isChecking
- tg_strict_key: a flow that needs strict checking passes the same key on both sides (guardedPush `key` + `tokenKey`)
editing:
- tg_exact_path: the target is matched by exact pathname (query and `#` ignored), never by prefix
read: source and target, cases → Usage | hooks, config, onFail → API | path matching → Internals | tests → Verification
