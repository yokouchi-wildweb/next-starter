---
paths:
  - "src/features/core/messaging/**"
  - "src/config/features/messaging.config.ts"
---
# features/messaging
what: messages to users (email, inbox, LINE, fork channels): definitions messages/<name>.ts sent by messagingService (@/features/messaging/services/server), recorded as dispatches and deliveries
use: sending is always open | messagingDispatches, messagingBroadcast, messagingTemplates, messagingOverrides, messagingPreferences, messagingInbox, messagingTracking
change: placement = src/config/features/messaging.config.ts | overlay = <name>.override.ts | add = receptacle items (extensionPoints.ts) | replace = layouts/<name>/ .replace
rules:
using:
- var_names: a definition gives varNames (alias, description) for every vars key
- idempotency: new send screens and batches always pass idempotencyKey | 409 = already sent
- system_send: cron / CLI sends run inside runAsSystem
- category: every message has a category (one user-facing event) | new one → pnpm generate message
- channels: set by the category, never per message (code sends pass none) | other channels → another category
- no_reassign: a category's kind never changes (another kind → another category) | an upstream message moves to another category only through its override's category, never by editing it
- functional: functional messages are never disabled, throttled, admin-overridden or stripped of email | judged on the category after the override
- stop_unit: a category group is a heading only | stop together → one category
- audience: condition-based audience → userGroup | event recipient → recipient, not a group
- legal_notice: a legally required notice uses a category with email
- system_template: keep at least one usable system template per sendable kind
editing:
- raw_sql_files: raw SQL builders live in db-less files listed in services/server/rawSqlParams.test.ts
read: model, gates → Overview | send, target, add a message → Usage | endpoints → API | config, receptacles → Extension | parts and why → src/features/core/messaging/Internals.md Internals | system templates → src/features/core/messaging/templates/README.md API
