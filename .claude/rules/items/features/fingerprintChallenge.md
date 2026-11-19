---
paths:
  - "src/features/core/fingerprintChallenge/**"
  - "src/config/features/fingerprintChallenge.config.ts"
---
# features/fingerprintChallenge
what: a challenge form sent to a suspected user; submitting it forces device fingerprint + behavior capture | the domain holds the lifecycle (issue → answer → review) and data contract, no UI parts | entry @/features/core/fingerprintChallenge, hooks under its hooks/
use: fingerprintChallenge (default off, requires deviceFingerprint: open both)
change: placement → open in src/config/featureGate/switches.config.ts (config.ts has no on/off key) | process values in src/config/features/fingerprintChallenge.config.ts
rules:
using:
- challenge_page_range: an answer page lives outside (user)/(protected) under its own range guard.ts allowing ["active", "suspended"] + an `await guard()` layout (the protected range is active only) | the general rule = core/screens.md status_pages
- challenge_evidence: view and behavior signals are client-sourced reference evidence | cross-check them with userLoginEvent, never treat them as proof
editing:
- challenge_token_once: the raw token comes only in the issue response | the DB keeps its SHA-256 only, token_hash stays in hiddenColumns
- challenge_token_404: the token path answers 404 alike for a missing and another user's token | the own-scope path filters by user_id only
- challenge_me_statuses: the user routes pass config challenge.answerableStatuses to allowStatuses | other statuses stay 403
- challenge_expired_derived: "expired" is derived at read (pending + expires_at < now), never a stored status or a cron
- challenge_view_log: views count only while pending, one UPDATE + one INSERT, fail-soft (console.error, the read goes on), no per-view audit_logs | the user DTO never shows counters or IP
read: opening, answer page, form recipe, admin follow-up → Usage | routes, hooks, columns, tables → API | process values → Extension | lifecycle, view log, behavior capture → Internals | deviceFingerprint, lib → Related
