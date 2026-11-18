---
paths:
  - "src/features/core/userAcquisition/**"
  - "src/config/features/userAcquisition.config.ts"
---
# features/userAcquisition
what: stores the visit touches before signup (UTM, ad click ids, external referrer) in the service DB for first / last-touch and path analysis | public entry lib/classifyVisit (edge-safe), read API @/features/userAcquisition/services/server
use: userAcquisition
change: add = a channel row in channels/ (channels, extensionPoints.ts) | placement = src/config/features/userAcquisition.config.ts (click id rows, cookie values)
rules:
using:
- config_inside: userAcquisitionConfig is read only inside this domain; others use the lib/classifyVisit entry
- channel_enabled: a channel item whose owning feature can close sets `enabled` so its row disappears while closed
- invite_medium_apart: the invite medium (config referralParam) stays apart from `referral` (GA files natural external links under referral)
- ui_downstream: core ships no UI; screens call getUserAcquisition / getUserAcquisitionTouches from SSR or an admin API
- landing_keeps_utm: a redirecting entry keeps the UTM on the landing URL (touches are not taken on intercepted requests)
editing:
- edge_safe_lib: lib/attributionCookie.ts and lib/classifyVisit stay edge-safe (never import drizzle)
- record_best_effort: recordSignupAcquisition is best effort and never blocks registration
read: turn on, read data, recipes → Usage | entry, channel table, tables → API | add a channel, config → Extension | flow, touch rules, invite link, limits → Internals
