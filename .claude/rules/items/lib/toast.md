---
paths:
  - "src/lib/toast/**"
  - "src/config/lib/toast.config.ts"
---
# lib/toast
what: the closed lib of one-at-a-time toasts and toasts shown after a redirect (cookie handoff) | entry @/lib/toast (useToast, useLoadingToast, GlobalToast, RedirectToastProvider, setRedirectToastCookie)
use: always
change: placement → src/config/lib/toast.config.ts (@lib-config/toast: duration, position, size, ariaLabel)
rules:
using:
- toast_entry: read the lib only through its entry `@/lib/toast` | useToastStore only to read the store directly, otherwise useToast / useLoadingToast
- toast_one_root: GlobalToast is placed once, at the root
- toast_redirect: a toast after a redirect = setRedirectToastCookie on the NextResponse in proxy / route + RedirectToastProvider on the client
- toast_layer: the toast layer is always `toast`, no option to pick a layer
editing:
- toast_constants: the exit animation (350ms) and swipe threshold (50px) stay constants.ts constants paired with the CSS, never config keys
- toast_no_side_effects: package.json declares no `sideEffects` (the store is created at import)
read: placing, redirect toasts → Usage | hooks, parts, types → API | config keys → Extension | layer, outside press, deps → Internals | tests → Verification
