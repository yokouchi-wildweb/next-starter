# DOWNSTREAM NOTICE id:20261126-090548-startup-status-nodejs-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-26T09:05:48+09:00
severity: info
checkpoint: startup-status-nodejs-only
resolves: 20261125-195321-startup-mail-webhooks-edge
change: pnpm generate extensions writes each backend status line of src/wiring/startup.ts with its imports inside `if (process.env.NEXT_RUNTIME === "nodejs")` (Next's runtime-specific instrumentation import), returning a no-op nodejs task on edge; the owner's entry (@/lib/mail: send, webhooks with node:crypto) no longer enters the Edge instrumentation bundle
why: after notice 20261124-172037-backend-s0 the status line imported @/lib/mail unconditionally, so a fork whose app compiles an edge bundle warned on every pnpm dev start: "A Node.js module is loaded (node:crypto) which is not supported in the Edge Runtime" (trace instrumentation.ts ← wiring/startup.ts ← lib/mail ← lib/mail/webhooks)
required_actions:
1. Merge upstream up to this checkpoint, then `pnpm generate extensions` (src/wiring/startup.ts is generated; a merge conflict there is resolved by regenerating, never by hand).
2. `git grep -n "mailBackendStatus" -- src/wiring/startup.ts` shows the line with `process.env.NEXT_RUNTIME === "nodejs"`.
verify: pnpm dev starts without the node:crypto Edge Runtime warning; the start log still has `{"scope":"backends","port":"mail",…}` | pnpm check extensions passes
manual_steps: -
refs: scripts/structure/extensions/select.mjs (planSelection status lines), scripts/structure/extensions/README.md 選ぶ点, src/wiring/startup.ts, node_modules/next/dist/docs/01-app/02-guides/instrumentation.md (Importing runtime-specific code) | order 20261126-085944-startup-mail-webhooks-edge
notes: @/lib/mail's entries are unchanged (a status-only entry ./backendStatus is outside the closed entry names of lib packages) | Tier1 compiles no edge bundle, so the warning did not reproduce here; the status line still prints on Node (checked with pnpm dev)
