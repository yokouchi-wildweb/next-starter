---
paths:
  - "src/domains/core/userLoginEvent/**"
---
# domains/userLoginEvent
what: login / signup successes and explicit logouts stored per IP (table user_login_events, ip = inet) for cross-user IP, subnet and device-handoff searches | entry @/domains/userLoginEvent/services/server (server-only)
use: always
change: none → /order <direct parent> | retention: retentionDays at record time or DEFAULT_LOGIN_EVENT_RETENTION_DAYS
rules:
using:
- login_event_evidence: same-IP and handoff results are reference evidence, never proof alone | combine with fingerprint, answers and behavior
- login_event_no_logout: a missing logout row never means the session goes on (cookie expiry, closed tabs and admin invalidation are not recorded)
- login_event_starts: count session starts with event_type IN ('login','signup') (the search functions count every row)
editing:
- login_event_best_effort: a failed write never blocks login, signup or logout (console.error only)
- login_event_ip_only: a row without an IP is not written
- login_event_logout_scope: logout = a session the user ended (logout, pause, withdraw after success), never an admin invalidation
- login_event_retention: → core/db.md pii_retention
- login_event_enum: an event_type value is added by ALTER TYPE ADD VALUE (db:push), never removed
read: IP / subnet / handoff searches, UI recipe → Usage | functions, table, indexes → API | retention → Extension | recording, logout limits, legacy fields → Internals
