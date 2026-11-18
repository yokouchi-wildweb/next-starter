---
paths:
  - "src/features/core/userLineProfile/**"
---
# features/userLineProfile
what: links a signed-in user to a LINE account (user_line_profiles) and receives the LINE webhook | userLineProfileService (@/features/core/userLineProfile/services/server/userLineProfileService) | the LINE API, OAuth and messages live in @/lib/line
use: userLineProfile
change: add = webhookHandlers/<name>.ts (receptacle webhookHandlers)
rules:
using:
- event_handler: per-event work → a webhookHandlers item, never edit the webhook route (it only verifies, dispatches, answers)
- handler_order: handlers of one eventType all run in file order | a failing one is logged and the rest go on (LINE gets 200)
editing:
- no_profile_image: never store the LINE profile image (no URL, no file)
read: what the receptacle takes → src/features/core/userLineProfile/webhookHandlers/README.md Overview | call order → src/features/core/userLineProfile/webhookHandlers/README.md Internals
