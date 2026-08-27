# DOWNSTREAM NOTICE id:20260827-051935-fingerprint-basis
from: next-starter (Tier1 upstream) | branch:main | commit:70c3e405
date: 2026-08-27T05:19:35Z
severity: action-required
change: Added browser-fingerprint basis — src/lib/fingerprint/ (collector + headless behavioral-capture hook) and two core domains deviceFingerprint (device-axis cross-user match) + fingerprintChallenge (fraud-suspect answer form). Both are opt-in and default OFF (src/config/app/fingerprint.config.ts). Two new Neon tables (device_fingerprints, fingerprint_challenges) were added to the drizzle schema registry.
why: schemaRegistry now includes the two new tables, so downstream DB schema drifts from code until pushed. No code writes to the tables while the feature is disabled, but db:push diffs will list them and the drift should be reconciled on merge. No app behavior changes unless downstream opts in.
required_actions:
1. [user-run] pnpm db:push   # creates device_fingerprints + fingerprint_challenges (idempotent; safe while feature disabled)
2. No code changes required. The feature stays inert until you set FINGERPRINT_CONFIG.collection.enabled / challenge.enabled = true in src/config/app/fingerprint.config.ts. To adopt: read src/features/core/deviceFingerprint/README.md (all-page collector recipe) and src/features/core/fingerprintChallenge/README.md (answer-form recipe — UI is downstream-owned; copy the recipe and swap question fields).
verify: run `pnpm db:tables` and confirm device_fingerprints and fingerprint_challenges exist; `npx tsc --noEmit` stays green.
manual_steps: If you enable collection, add the collected signals to your privacy policy (JP: 改正電気通信事業法 外部送信規律の整理対象になり得る。不正検知目的は比較的通しやすい類型)。Add the two cron entries from vercel.json.example (device-fingerprint-prune) to your deployed scheduler only if you enable the feature.
refs: src/lib/fingerprint/, src/features/core/deviceFingerprint/README.md, src/features/core/fingerprintChallenge/README.md, src/config/app/fingerprint.config.ts, docs/reference/cron-tasks.md (device-fingerprint-prune)
notes: deviceFingerprint is the device-axis sibling of the existing userLoginEvent (IP-axis) domain; the READMEs show how to combine them for fraud investigation. Signals are client-declared and spoofable — treat results as reference evidence, never as sole proof.
