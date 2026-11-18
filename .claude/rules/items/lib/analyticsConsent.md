---
paths:
  - "src/lib/analyticsConsent/**"
  - "src/config/lib/analyticsConsent.config.ts"
---
# lib/analyticsConsent
what: the gate that decides whether browser analytics may be sent (@/lib/analyticsConsent, client): config enabled + consent state | isAnalyticsAllowed, setAnalyticsConsent, useAnalyticsConsent
use: always (sends nothing until the config enables it)
change: overlay = src/config/lib/analyticsConsent.config.ts (enabled, consent)
rules:
using:
- banner_owns_choice: a consent banner / CMP stores the choice itself and calls setAnalyticsConsent on load and on change
- not_required_explicit: consent "notRequired" is the fork's explicit choice, with no banner
editing:
- tracker_gate: a tracker added here waits for isAnalyticsAllowed() before init, checks it before every send, and stops on revoke via subscribeAnalyticsConsent
read: what it decides → Overview | connect a banner → Usage | functions → API | config → Extension | revoke, late grant → Internals
