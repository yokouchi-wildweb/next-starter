---
paths:
  - "src/domains/core/userAcquisition/**"
  - "src/config/domains/userAcquisition.config.ts"
---
# domains/userAcquisition
what: stores the visit touches before signup (UTM, ad click ids, external referrer) in the service DB for first / last-touch and path analysis | public entry lib/classifyVisit (edge-safe), read API @/domains/userAcquisition/services/server
use: userAcquisition
change: add = a channel row in channels/ (channels, extensionPoints.ts) | placement = src/config/domains/userAcquisition.config.ts (click id rows, invite source / medium, cookie lifetime, touch cap)
rules:
using:
- config_inside: userAcquisitionConfig is read only inside this domain; others use the lib/classifyVisit entry
- channel_enabled: a channel item whose owning feature can close sets `enabled` so its row disappears while closed
- invite_medium_apart: config referralParam.medium is never `referral` (GA files natural external links under medium referral; invites would merge into them)
- ui_downstream: core ships no UI; a downstream page's loader (SSR) or an admin API calls getUserAcquisition / getUserAcquisitionTouches
- landing_keeps_utm: a redirect to a landing page carries utm_* / click-id params to the target URL (touches are not taken on requests an intercepting proxy answered)
editing:
- edge_safe_lib: lib/attributionCookie.ts and lib/classifyVisit.ts stay edge-safe (never import drizzle)
- record_best_effort: recordSignupAcquisition is best effort and never blocks registration
read: turn on, read data, recipes → Usage | entry, channel table, tables → API | add a channel, config → Extension | flow, touch rules, invite link, limits → Internals
