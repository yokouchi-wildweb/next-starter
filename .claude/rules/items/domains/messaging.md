---
paths:
  - "src/domains/core/messaging/**"
  - "src/config/domains/messaging.config.ts"
---
# domains/messaging
what: messages to users (email, inbox, LINE, fork channels): definitions messages/<name>.ts sent by messagingService (@/domains/messaging/services/server), recorded as dispatches and deliveries
use: sending is always open | messagingDispatches, messagingBroadcast, messagingTemplates, messagingOverrides, messagingPreferences, messagingInbox, messagingTracking
change: counterpart = src/config/domains/messaging.config.ts | override = <name>.override.ts | add = receptacle items (extensionPoints.ts) | replace = layouts/<name>/ .replace
rules:
using:
- send_entry: messages to users go through messagingService only: a definition (messages/<name>.ts) → sendMessage / sendMessageToMany | admin free text → sendFreeMessage (a layout or a DB template) | never lib/mail send() or a channel directly
- var_names: a definition gives varNames (alias, description) for every vars key | admin-entered values → adminVars, values read from the record → recordVars (both vars keys)
- idempotency: new send screens and batches always pass idempotencyKey | 409 = already sent
- system_send: cron / CLI sends run inside runAsSystem
- category: every message has a category (one user-facing event) | new one → pnpm generate message
- channels: set by the category, never per message (code sends pass none) | other channels → another category | a definition only fixes channels inside its category with channelModes (on / off / free)
- no_reassign: a category's kind never changes (another kind → another category) | an upstream message moves to another category only through its override's category, never by editing it
- functional: functional messages are never disabled, throttled, admin-overridden or stripped of email | judged on the category after the override
- overrides: an upstream message changes only through messages/<name>.override.ts (label, values, extras, enabled, adminEditableOnly, record, throttle, category, channelModes, adminText; channelModes and adminText replaced whole) | an upstream record target only through recordTargets/<name>.override.ts (messages)
- send_screens: a fixed-text send = a definition with adminTargets + the owner domain's recordTargets/<name>.ts + definitionBulkAction (the generic DefinitionSendModal) or an own modal from the public hooks (hooks/index.ts) and parts | MessageSendModal / bulkMessageAction only for text the admin writes on the spot, never to build a fixed text
- scheduled_edit: a scheduled send changes only its text, channels and time before it starts (PATCH dispatches/[id], the fields edit-options lists) | never its target or recipients → delete it and send again
- stop_unit: a category group is a heading only | stop together → one category
- audience: condition-based audience → userGroup | event recipient → recipient, not a group
- legal_notice: a legally required notice uses a category with email
editing:
- raw_sql_files: raw SQL builders live in db-less files listed in services/server/rawSqlParams.test.ts
read: model, gates → Overview | send, target, add a message → Usage | endpoints → API | config, receptacles → Extension | parts and why → src/domains/core/messaging/Internals.md Internals | which send screen → src/domains/core/messaging/components/README.md Usage
