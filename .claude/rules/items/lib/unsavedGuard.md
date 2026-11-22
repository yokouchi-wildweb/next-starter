---
paths:
  - "src/lib/unsavedGuard/**"
---
# lib/unsavedGuard
what: stops navigation away from an edited, unsaved screen and asks first (link, router, plain <a>, back / forward, reload); closed lib, entry @/lib/unsavedGuard (UnsavedGuardProvider, useUnsavedGuard, useUnsavedTasks, useRouter)
use: always
change: counterpart = src/config/lib/unsavedGuard.config.ts (confirm texts per reason)
rules:
using:
- guarded_router: app code navigates with useRouter from @/lib/unsavedGuard, never next/navigation's useRouter (lint import-boundaries/router-via-guard)
- guard_edit_screens: an editing screen outside AppForm calls useUnsavedGuard(dirty); pending saves go through useUnsavedTasks().track
- closed_reasons: a guard picks a reason from the closed list (unsaved, inProgress), never its own text
- opt_out_prop: a lib that guards offers `guardUnsaved` (default true) to turn it off
editing:
- reads_nothing: the lib reads react and next/navigation only (no domains, src/components or other libs); the confirm UI arrives as a function value
- router_here_only: next/navigation's useRouter is read only inside this lib
read: wire and use it → Usage | entries → API | reasons and texts → Extension | routes, sentinel, limits → Internals | tests → Verification
