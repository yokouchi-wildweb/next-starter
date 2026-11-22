---
paths:
  - "src/domains/core/deviceFingerprint/**"
  - "src/config/domains/deviceFingerprint.config.ts"
---
# domains/deviceFingerprint
what: stores browser fingerprints (device_fingerprints) and matches users by device (@/domains/core/deviceFingerprint/services/server: findUsersBySimilarFingerprint, findUsersByExactFingerprint, compareUsersFingerprints) | collection lives in @/lib/fingerprint
use: deviceFingerprint (opt-in, default off) | fingerprintChallenge depends on it
change: counterpart = src/config/domains/deviceFingerprint.config.ts (collection values) | on / off = the gate switch only
rules:
using:
- reference_evidence: signals are spoofable → a match is reference evidence, never proof | action = a human, with IP, behavior and audit evidence (CLAUDE.md fingerprint)
- reporter_mount: useFingerprintReport may stay mounted whatever the switch (a closed feature answers 404)
- privacy_policy: opening it → list the collected signals in the privacy policy
- no_ip_in_dto: user-facing DTOs never expose IP or view counters (CLAUDE.md fingerprint)
editing:
- gate_only: no enabled key in config.ts | on / off = the gate rule deviceFingerprint
- authenticated_only: collect only in an authenticated context, never anonymous | demo users are not recorded
- strong_component: similarity candidates need a strong component match (weak-only matches never surface)
- retention: no unlimited keeping | row retention_days + the daily device-fingerprint-prune cron
read: threat model, signals → Overview | switch on, record, investigate → Usage | matching functions, table → API | config values → Extension | upsert, index, retention → Internals
