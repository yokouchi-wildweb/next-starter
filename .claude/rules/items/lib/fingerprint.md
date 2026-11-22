---
paths:
  - "src/lib/fingerprint/**"
---
# lib/fingerprint
what: domain-free collection, normalizing and hashing of browser device signals (collectFingerprintPayload) and headless form behavior capture (useBehavioralCapture) | entry @/lib/fingerprint
use: always (the domains that store and use it: deviceFingerprint, fingerprintChallenge)
change: none → /order <direct parent>
rules:
using:
- payload_as_is: send the collectFingerprintPayload result to the ingest API unchanged
- capture_on_container: useBehavioralCapture goes on the form's wrapper by spreading `containerProps`; read the stats with getPayload() at submit
- behavior_no_raw: behavior capture keeps aggregates only (pointer distance, speed, straightness), never raw coordinates
editing:
- no_db_http: the lib holds no DB access and no HTTP (storing and matching live in domains/core/deviceFingerprint)
- fail_soft_signals: each signal is collected in its own try-catch and becomes null where unavailable
read: collect, signals, behavior capture → API | storing and challenge → Related
