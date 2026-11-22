---
paths:
  - "src/domains/core/userLineProfile/**"
---
# domains/userLineProfile
what: links a signed-in user to a LINE account (user_line_profiles) and receives the LINE webhook | userLineProfileService (@/domains/core/userLineProfile/services/server/userLineProfileService) | the LINE API, OAuth and messages live in @/lib/line
use: userLineProfile
change: add = <domain>/plugs/userLineProfileWebhookHandlers/<name>.ts (point userLineProfileWebhookHandlers)
rules:
using:
- event_handler: per-event work → a userLineProfileWebhookHandlers item, never edit the webhook route (it only verifies, dispatches, answers)
- handler_order: handlers of one eventType all run in file order | a failing one is logged and the rest go on (LINE gets 200)
editing:
- no_profile_image: never store the LINE profile image (no URL, no file)
read: what the point takes → src/domains/core/userLineProfile/README.md Overview | call order → src/domains/core/userLineProfile/README.md Internals
