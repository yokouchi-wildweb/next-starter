# DOWNSTREAM NOTICE id:20261122-192646-inapp-silent-send
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261122-190102-quest-inapp-silent-send-hotfix | commit:- (this commit)
date: 2026-11-22T19:26:46+09:00
severity: info
checkpoint: inapp-silent-send
resolves: 20261121-203205-urgent-inapp-silent-send
hotfix: messaging-switch removed the silent in-app send; forks that sent silent notices (e.g. purchase complete) now pop the unread modal on every send for real users
change: message definition input `silent?: boolean` (src/lib/messaging MessageDefinition) — true writes the inApp inbox row with metadata.silent = true (listed in the inbox, not counted as unread, not in unreadOnly / the unread modal); default not silent, other channels unaffected
why: the new send path (messagingService.sendMessage / sendMessageToMany) had no way to send a silent row; only the legacy-copy task set metadata.silent
required_actions:
1. only if this fork sends a message that must be silent (the old notificationService send with `silent: true`, or a send left as a normal message "until the silent send arrives"): find them with `git grep -n -E 'silent|静か' -- 'src/features/**/messages/*.ts' 'src/features/**/services/server/**'` | add `silent: true` to that message's definition (`src/features/<domain>/messages/<name>.ts`, the `export const message` object, beside `layout` / `values`) | drop the provisional comments that say the send is normal until the silent send arrives | no other change: every send of that definition (immediate, cron, throttle, all / role shared row) writes the silent row
verify: pnpm typecheck | pnpm test src/features/core/messaging/channels/inApp src/features/core/messaging/services/server/sendMessage/sender.test.ts src/features/core/messaging/services/server/sendMessage/dispatchResolved.test.ts src/features/core/messaging/services/server/inbox
manual_steps: -
refs: src/lib/messaging/definition/types.ts (MessageDefinition.silent) | src/features/core/messaging/services/server/sendMessage/content.ts (inApp content gets silent: true) | src/features/core/messaging/channels/inApp/createInAppChannel.ts (inboxMetadataOf → row metadata) | src/features/core/messaging/services/server/sendMessage/dispatchResolved.ts (cron reads silent from the code definition) | src/features/core/messaging/services/server/inbox/readState.ts (isSilent / inboxSilentSql, unchanged) | order 20261121-203205-urgent-inapp-silent-send
notes: silent is a definition key, not a per-send argument: a message is silent as a whole, and cron / throttle / shared rows re-read it from the code definition like throttle and required | not overridable by messages/<name>.override.ts (a fork wanting an upstream message silent → /order next-starter) | rows already sent stay as written (no backfill) | no DB change
