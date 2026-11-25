# DOWNSTREAM NOTICE id:20261125-100341-message-definition-enabled
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261125-100059-message-definition-default-enabled | commit:- (this commit)
date: 2026-11-25T10:03:41+09:00
severity: info
checkpoint: message-definition-enabled
resolves: 20261125-100019-message-definition-default-enabled
change: a message definition (defineMessage / MessageDefinition in @/lib/messaging) takes an optional `enabled` (default true). `enabled: false` = not sent by default: applyMessageOverride resolves enabled as override's enabled > definition's enabled > true, so the send paths treat it exactly like an override's enabled:false (no dispatch, not listed on the admin send screen) and an override with `enabled: true` turns it back on. A required message with `enabled: false` is the existing problem required_disabled. Definitions without the field and every override behave as before.
why: a fork could stop one of its own domain's messages by default only by writing an override next to its own definition, which the ownership check flags (and the definition had no enabled field: TS2353)
required_actions: none. A fork that stops its own message with `plugs/messages/<name>.override.ts` holding only `{ enabled: false }` may move it into the definition (`enabled: false` in `<name>.ts`) and delete that override; grep: `git grep -l -E 'enabled: *false' -- 'src/domains/*/plugs/messages/*.override.ts' ':!src/domains/core'`
verify: a definition with `enabled: false` is not sent (sendMessage returns without a dispatch); adding an override `{ enabled: true }` sends it
manual_steps: -
refs: src/lib/messaging/definition/types.ts (MessageDefinition.enabled), src/lib/messaging/definition/validate.ts (applyMessageOverride, required_disabled), src/lib/messaging/definition.test.ts, src/lib/messaging/README.md
notes: upstream overrides of upstream messages are unchanged (an override is still how a fork stops an upstream message)
